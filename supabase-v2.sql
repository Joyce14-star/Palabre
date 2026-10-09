-- PALABRE v2 : ajoute le mode "question libre" (sans camps)
alter table public.palabre_debates add column if not exists mode text not null default 'debate';
alter table public.palabre_debates drop constraint if exists palabre_debates_mode_check;
alter table public.palabre_debates add constraint palabre_debates_mode_check check (mode in ('debate','open'));
alter table public.palabre_debates alter column side_a drop not null, alter column side_b drop not null;
alter table public.palabre_responses drop constraint if exists palabre_responses_side_check;
alter table public.palabre_responses add constraint palabre_responses_side_check check (side in ('A','B','O'));

drop function if exists public.palabre_create_debate(text,text,text,text,text);
create or replace function public.palabre_create_debate(p_question text, p_side_a text default null, p_side_b text default null, p_author text default null, p_theme text default null, p_mode text default 'debate')
returns json language plpgsql security definer set search_path = public as $$
declare v_id text; v_token uuid; i int := 0;
begin
  if p_mode not in ('debate','open') then return json_build_object('ok', false, 'reason', 'mode'); end if;
  if coalesce(trim(p_author), '') = '' then return json_build_object('ok', false, 'reason', 'author'); end if;
  if p_mode = 'debate' and (coalesce(trim(p_side_a), '') = '' or coalesce(trim(p_side_b), '') = '') then
    return json_build_object('ok', false, 'reason', 'sides');
  end if;
  if palabre_is_insult(p_question) or palabre_is_insult(p_side_a) or palabre_is_insult(p_side_b) or palabre_is_insult(p_author) then
    return json_build_object('ok', false, 'reason', 'insult');
  end if;
  loop
    v_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 7);
    exit when not exists (select 1 from palabre_debates where id = v_id);
    i := i + 1;
    if i > 10 then raise exception 'id generation failed'; end if;
  end loop;
  insert into palabre_debates (id, question, side_a, side_b, author, theme, mode)
  values (v_id, trim(p_question),
          case when p_mode = 'open' then null else trim(p_side_a) end,
          case when p_mode = 'open' then null else trim(p_side_b) end,
          trim(p_author), p_theme, p_mode)
  returning admin_token into v_token;
  return json_build_object('ok', true, 'id', v_id, 'token', v_token);
end $$;

create or replace function public.palabre_get_debate(p_id text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', d.id, 'question', d.question, 'side_a', d.side_a, 'side_b', d.side_b, 'author', d.author, 'mode', d.mode,
    'count_a', (select count(*) from palabre_responses r where r.debate_id = d.id and r.side = 'A' and not r.hidden),
    'count_b', (select count(*) from palabre_responses r where r.debate_id = d.id and r.side = 'B' and not r.hidden),
    'count_o', (select count(*) from palabre_responses r where r.debate_id = d.id and r.side = 'O' and not r.hidden))
  from palabre_debates d where d.id = p_id;
$$;

create or replace function public.palabre_submit(p_id text, p_side text, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare v_body text := trim(coalesce(p_body, '')); v_mode text;
begin
  select mode into v_mode from palabre_debates where id = p_id;
  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if (v_mode = 'open' and p_side <> 'O') or (v_mode = 'debate' and p_side not in ('A','B')) then
    return json_build_object('ok', false, 'reason', 'side');
  end if;
  if v_mode = 'open' and char_length(v_body) < 2 then return json_build_object('ok', false, 'reason', 'empty'); end if;
  if char_length(v_body) > 500 then return json_build_object('ok', false, 'reason', 'too_long'); end if;
  if palabre_is_insult(v_body) then
    update palabre_debates set blocked_count = blocked_count + 1 where id = p_id;
    return json_build_object('ok', false, 'reason', 'insult');
  end if;
  if (select count(*) from palabre_responses where debate_id = p_id) >= 5000 then return json_build_object('ok', false, 'reason', 'full'); end if;
  insert into palabre_responses (debate_id, side, body) values (p_id, p_side, v_body);
  return (to_jsonb(palabre_get_debate(p_id)) || '{"ok": true}'::jsonb)::json;
end $$;

create or replace function public.palabre_owner_get(p_id text, p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', d.id, 'question', d.question, 'side_a', d.side_a, 'side_b', d.side_b, 'mode', d.mode,
    'author', d.author, 'blocked', d.blocked_count, 'created_at', d.created_at,
    'responses', coalesce((select json_agg(json_build_object('id', r.id, 'side', r.side, 'body', r.body, 'hidden', r.hidden, 'at', r.created_at) order by r.created_at desc)
      from palabre_responses r where r.debate_id = d.id), '[]'::json))
  from palabre_debates d where d.id = p_id and d.admin_token = p_token;
$$;

revoke all on function public.palabre_create_debate(text,text,text,text,text,text) from public;
grant execute on function public.palabre_create_debate(text,text,text,text,text,text) to anon, authenticated;
