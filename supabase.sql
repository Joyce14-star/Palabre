-- ============================================================
-- PALABRE — base de données
-- À coller en entier dans Supabase > SQL Editor > Run
-- ============================================================

-- 1. Tables ---------------------------------------------------
create table if not exists public.palabre_debates (
  id            text primary key,
  question      text not null check (char_length(question) between 5 and 200),
  side_a        text not null check (char_length(side_a) between 1 and 30),
  side_b        text not null check (char_length(side_b) between 1 and 30),
  author        text not null check (char_length(author) between 1 and 40),
  theme         text,
  admin_token   uuid not null default gen_random_uuid(),
  blocked_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.palabre_responses (
  id         bigint generated always as identity primary key,
  debate_id  text not null references public.palabre_debates(id) on delete cascade,
  side       char(1) not null check (side in ('A','B')),
  body       text not null default '' check (char_length(body) <= 500),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists palabre_responses_debate_idx on public.palabre_responses(debate_id, created_at desc);

-- Personne ne lit ni n'écrit directement dans les tables :
-- tout passe par les fonctions ci-dessous.
alter table public.palabre_debates   enable row level security;
alter table public.palabre_responses enable row level security;
revoke all on public.palabre_debates, public.palabre_responses from anon, authenticated;

-- 2. Filtre anti-insultes -------------------------------------
create or replace function public.palabre_is_insult(t text)
returns boolean language sql immutable as $$
  select coalesce(t, '') ~* (
    '(\mcon(ne|nard|nards|nasse|nasses)?s?\M|\msalop|\mputes?\M|\mputain|\mencul|\mniqu|\mntm\M|\mfdp\M|'
    || '\mb[aâ]tard|\mpd\M|\mp[ée]d[ée]s?\M|\mtapette|\msalaud|\mabruti|\mcrevard|\mgrosse vache|'
    || '\mfuck|\mbitch|\mwhore|\mslut|\mnigg|\mfaggot|\mmotherf|\mshithead)'
  );
$$;

-- 3. Fonctions publiques (RPC) --------------------------------

-- Créer un débat -> renvoie l'id public et le jeton secret du propriétaire
create or replace function public.palabre_create_debate(
  p_question text, p_side_a text, p_side_b text, p_author text, p_theme text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token uuid;
  i int := 0;
begin
  if public.palabre_is_insult(p_question) or public.palabre_is_insult(p_side_a)
     or public.palabre_is_insult(p_side_b) or public.palabre_is_insult(p_author) then
    return json_build_object('ok', false, 'reason', 'insult');
  end if;
  loop
    v_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 7);
    exit when not exists (select 1 from palabre_debates where id = v_id);
    i := i + 1;
    if i > 10 then raise exception 'id generation failed'; end if;
  end loop;
  insert into palabre_debates (id, question, side_a, side_b, author, theme)
  values (v_id, trim(p_question), trim(p_side_a), trim(p_side_b), trim(p_author), p_theme)
  returning admin_token into v_token;
  return json_build_object('ok', true, 'id', v_id, 'token', v_token);
end $$;

-- Lire un débat (vue publique : question + scores, jamais les réponses)
create or replace function public.palabre_get_debate(p_id text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', d.id, 'question', d.question, 'side_a', d.side_a, 'side_b', d.side_b,
    'author', d.author,
    'count_a', (select count(*) from palabre_responses r where r.debate_id = d.id and r.side = 'A' and not r.hidden),
    'count_b', (select count(*) from palabre_responses r where r.debate_id = d.id and r.side = 'B' and not r.hidden))
  from palabre_debates d where d.id = p_id;
$$;

-- Répondre anonymement (aucune IP, aucun nom n'est enregistré)
create or replace function public.palabre_submit(p_id text, p_side text, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_body text := trim(coalesce(p_body, ''));
begin
  if not exists (select 1 from palabre_debates where id = p_id) then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;
  if p_side not in ('A','B') then
    return json_build_object('ok', false, 'reason', 'side');
  end if;
  if char_length(v_body) > 500 then
    return json_build_object('ok', false, 'reason', 'too_long');
  end if;
  if public.palabre_is_insult(v_body) then
    update palabre_debates set blocked_count = blocked_count + 1 where id = p_id;
    return json_build_object('ok', false, 'reason', 'insult');
  end if;
  if (select count(*) from palabre_responses where debate_id = p_id) >= 5000 then
    return json_build_object('ok', false, 'reason', 'full');
  end if;
  insert into palabre_responses (debate_id, side, body) values (p_id, p_side, v_body);
  return (to_jsonb(public.palabre_get_debate(p_id)) || '{"ok": true}'::jsonb)::json;
end $$;

-- Espace propriétaire : toutes les réponses (avec le jeton secret)
create or replace function public.palabre_owner_get(p_id text, p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', d.id, 'question', d.question, 'side_a', d.side_a, 'side_b', d.side_b,
    'author', d.author, 'blocked', d.blocked_count, 'created_at', d.created_at,
    'responses', coalesce((
      select json_agg(json_build_object('id', r.id, 'side', r.side, 'body', r.body,
                                        'hidden', r.hidden, 'at', r.created_at)
                      order by r.created_at desc)
      from palabre_responses r where r.debate_id = d.id), '[]'::json))
  from palabre_debates d where d.id = p_id and d.admin_token = p_token;
$$;

-- Masquer / réafficher une réponse
create or replace function public.palabre_owner_hide(p_id text, p_token uuid, p_response bigint, p_hidden boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from palabre_debates where id = p_id and admin_token = p_token) then
    return false;
  end if;
  update palabre_responses set hidden = p_hidden where id = p_response and debate_id = p_id;
  return true;
end $$;

-- 4. Droits ---------------------------------------------------
revoke all on function public.palabre_create_debate(text,text,text,text,text) from public;
revoke all on function public.palabre_get_debate(text) from public;
revoke all on function public.palabre_submit(text,text,text) from public;
revoke all on function public.palabre_owner_get(text,uuid) from public;
revoke all on function public.palabre_owner_hide(text,uuid,bigint,boolean) from public;
grant execute on function public.palabre_create_debate(text,text,text,text,text) to anon, authenticated;
grant execute on function public.palabre_get_debate(text) to anon, authenticated;
grant execute on function public.palabre_submit(text,text,text) to anon, authenticated;
grant execute on function public.palabre_owner_get(text,uuid) to anon, authenticated;
grant execute on function public.palabre_owner_hide(text,uuid,bigint,boolean) to anon, authenticated;
