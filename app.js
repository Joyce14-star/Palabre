import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=2';
import { QUESTIONS, THEMES } from './questions.js?v=2';

const $app = document.getElementById('app');
const C = { bg: '#121019', panel: '#1D1A29', ink: '#F5F3FA', yellow: '#FFD23F', blue: '#5B8CFF', orange: '#FF8A3D', light: '#F5F3FA' };

/* ---------- Outils ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('palabre:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('palabre:' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
};
const baseUrl = () => location.origin + location.pathname;
const publicLink = (id) => `${baseUrl()}#/d/${id}`;
const ownerLink = (id, token) => `${baseUrl()}#/g/${id}/${token}`;
const pct = (a, b) => { const t = a + b; return t ? [Math.round((a / t) * 100), 100 - Math.round((a / t) * 100)] : [50, 50]; };

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* rien */ }
    ta.remove(); return ok;
  }
}

async function rpc(fn, args) {
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };
  if (!SUPABASE_KEY.startsWith('sb_')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`Erreur serveur (${r.status})`);
  return r.json();
}

const ICON = {
  logo: (s = 30) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 30 30"><path d="M3 5h15a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H10l-5 4v-4H3z" fill="${C.blue}"/><path d="M27 12H14a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h7l4 4v-4h2z" fill="${C.orange}"/></svg>`,
  back: `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`,
  arrow: `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  check: `<svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>`,
  shield: `<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>`,
  share: `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`,
};

const topBack = (title, href = '#/') => `<div class="top"><a class="back" href="${href}" aria-label="Retour">${ICON.back}</a><h1>${esc(title)}</h1></div>`;
const loading = () => { $app.innerHTML = `<div class="loader">Chargement…</div>`; };
const fail = (msg) => { $app.innerHTML = `${topBack('Oups')}<div class="error">${esc(msg)}</div><p><a class="btn btn-yellow" href="#/">Retour à l’accueil</a></p>`; };

function scoreBlock(d) {
  const [pa, pb] = pct(d.count_a, d.count_b);
  return `<div class="bar" role="img" aria-label="${esc(d.side_a)} ${pa} %, ${esc(d.side_b)} ${pb} %"><i class="a" style="width:${pa}%"></i><i class="b" style="width:${pb}%"></i></div>
  <div class="score"><span class="a">${esc(d.side_a)} · ${pa} %</span><span class="b">${esc(d.side_b)} · ${pb} %</span></div>`;
}

/* ---------- Routeur ---------- */
let cleanup = null;
function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  window.scrollTo(0, 0);
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'd' && b) return viewAnswer(b);
  if (a === 'g' && b && c) return viewOwner(b, c);
  if (a === 'nouveau') return viewCreate(b);
  if (a === 'questions') return viewBank(b ? decodeURIComponent(b) : 'Tout');
  return viewHome();
}
window.addEventListener('hashchange', route);

/* ---------- Accueil ---------- */
function viewHome() {
  const day = Math.floor(Date.now() / 86400000);
  const qi = day % QUESTIONS.length;
  const q = QUESTIONS[qi];
  const mine = store.get('mine', []);
  $app.innerHTML = `
  <div class="top"><a class="brand" href="#/">${ICON.logo()}<b>palabre</b></a></div>
  <section class="hero" aria-labelledby="qdj">
    <div class="row"><span class="kicker">Question du jour</span><span class="chip">${esc(q.theme)}</span></div>
    <p class="big-q" id="qdj">${esc(q.q)}</p>
    <a class="btn btn-dark" href="#/nouveau/${qi}">Lancer ce débat ${ICON.arrow}</a>
  </section>
  <h2>Choisir par thème</h2>
  <div class="grid2">${THEMES.map((t) => `<a class="tile" href="#/questions/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>
  <p style="margin-top:12px"><a class="btn btn-ghost" href="#/nouveau">Écrire ma propre question</a></p>
  ${mine.length ? `<h2>Mes débats</h2><div class="stack">${mine.map((m) => `
    <a class="panel" href="#/g/${esc(m.id)}/${esc(m.token)}"><span class="q">${esc(m.question)}</span>
    <span class="meta"><span>${new Date(m.at).toLocaleDateString('fr-FR')}</span><span style="color:var(--yellow);font-weight:700">Voir les réponses</span></span></a>`).join('')}</div>` : ''}
  <p class="footer">Les réponses sont anonymes : ni nom ni numéro n’est enregistré.</p>`;
}

/* ---------- Banque de questions ---------- */
function viewBank(theme) {
  const list = QUESTIONS.map((q, i) => ({ ...q, i })).filter((q) => theme === 'Tout' || q.theme === theme);
  $app.innerHTML = `${topBack('Lance un débat')}
  <div class="pills" role="group" aria-label="Thèmes">${['Tout', ...THEMES].map((t) =>
    `<a class="pill ${t === theme ? 'on' : ''}" style="display:inline-flex;align-items:center" href="#/questions/${encodeURIComponent(t)}" ${t === theme ? 'aria-current="true"' : ''}>${esc(t)}</a>`).join('')}</div>
  <div class="stack" style="margin-top:18px">${list.map((q) => `
    <a class="panel" href="#/nouveau/${q.i}"><span class="q">${esc(q.q)}</span>
    <span class="meta"><span>${esc(q.theme)} · ${esc(q.a)} / ${esc(q.b)}</span><span style="color:var(--yellow);font-weight:700">Choisir</span></span></a>`).join('')}</div>
  <p style="margin-top:16px"><a class="btn btn-ghost" href="#/nouveau">Écrire ma propre question</a></p>`;
}

/* ---------- Création ---------- */
function viewCreate(idx) {
  const preset = idx !== undefined && idx !== '' ? QUESTIONS[Number(idx)] : null;
  const author = store.get('author', '');
  $app.innerHTML = `${topBack('Ton débat', preset ? `#/questions/${encodeURIComponent(preset.theme)}` : '#/')}
  <form id="f" class="stack" style="gap:18px;margin-top:8px" novalidate>
    <div class="field"><label for="q">La question</label>
      <textarea id="q" maxlength="200" required placeholder="Ex. : l’argent fait-il le bonheur ?">${esc(preset?.q || '')}</textarea></div>
    <div class="field"><span class="small muted" style="font-weight:700;text-transform:uppercase;letter-spacing:1px">Les deux camps</span>
      <div class="grid2">
        <input type="text" id="a" maxlength="30" aria-label="Camp 1" value="${esc(preset?.a || 'Oui')}" style="border-color:var(--blue)">
        <input type="text" id="b" maxlength="30" aria-label="Camp 2" value="${esc(preset?.b || 'Non')}" style="border-color:var(--orange)">
      </div></div>
    <div class="field"><label for="n">Ton prénom ou pseudo</label>
      <input type="text" id="n" maxlength="40" required value="${esc(author)}" placeholder="Il apparaît sur la carte : « Débat lancé par … »"></div>
    <div id="err"></div>
    <button class="btn btn-yellow" id="go" type="submit">Créer mon débat</button>
  </form>`;
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (id) => document.getElementById(id).value.trim();
    const q = v('q'), a = v('a'), b = v('b'), n = v('n');
    const err = document.getElementById('err');
    if (q.length < 5) return (err.innerHTML = `<div class="error">Écris une question d’au moins 5 caractères.</div>`);
    if (!a || !b) return (err.innerHTML = `<div class="error">Donne un nom aux deux camps.</div>`);
    if (!n) return (err.innerHTML = `<div class="error">Indique ton prénom ou un pseudo.</div>`);
    const btn = document.getElementById('go'); btn.disabled = true; btn.textContent = 'Création…';
    try {
      const r = await rpc('palabre_create_debate', { p_question: q, p_side_a: a, p_side_b: b, p_author: n, p_theme: preset?.theme || null });
      if (!r.ok) { err.innerHTML = `<div class="error">Ce texte contient un mot bloqué par le filtre. Reformule-le.</div>`; btn.disabled = false; btn.textContent = 'Créer mon débat'; return; }
      store.set('author', n);
      const mine = store.get('mine', []);
      mine.unshift({ id: r.id, token: r.token, question: q, at: Date.now() });
      store.set('mine', mine.slice(0, 30));
      location.hash = `#/g/${r.id}/${r.token}`;
    } catch (ex) {
      err.innerHTML = `<div class="error">Impossible de créer le débat pour l’instant. Vérifie ta connexion et réessaie.</div>`;
      btn.disabled = false; btn.textContent = 'Créer mon débat';
    }
  });
}

/* ---------- Réponse anonyme (vue des contacts) ---------- */
async function viewAnswer(id) {
  loading();
  let d;
  try { d = await rpc('palabre_get_debate', { p_id: id }); } catch { return fail('Impossible de charger ce débat. Vérifie ta connexion.'); }
  if (!d) return fail('Ce débat n’existe pas ou a été supprimé.');
  const answered = store.get('answered', {});
  let side = null;

  const header = `<div class="top"><a class="brand" href="#/">${ICON.logo()}<b>palabre</b></a></div>
    <div style="display:flex;align-items:center;gap:12px;margin:8px 0 18px">
      <div style="width:44px;height:44px;border-radius:22px;background:var(--yellow);color:var(--bg);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:18px">${esc(d.author.charAt(0).toUpperCase())}</div>
      <div><div style="font-weight:700">${esc(d.author)} lance un débat</div><div class="small muted">Ta réponse reste 100 % anonyme</div></div></div>`;

  const done = (data) => {
    $app.innerHTML = `${header}
      <div class="okmark">${ICON.check}</div>
      <p class="big-q" style="margin:20px 0">Envoyé. Personne ne saura que c’est toi.</p>
      <div class="panel"><span class="small muted">Le score pour l’instant</span>${scoreBlock(data)}</div>
      <p class="muted" style="font-size:15px;line-height:1.45">${esc(d.author)} repostera les meilleures réponses en statut. Garde un œil sur ses statuts.</p>
      <div class="stack" style="margin-top:20px">
        <a class="btn btn-yellow" href="#/">Lance ton propre débat</a>
      </div>`;
  };
  if (answered[id]) return done(d);

  $app.innerHTML = `${header}
    <p class="big-q">${esc(d.question)}</p>
    <form id="f" class="stack" style="gap:20px;margin-top:22px" novalidate>
      <fieldset style="border:0;padding:0;margin:0" class="field">
        <legend class="small muted" style="font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">1 · Ton camp</legend>
        <div class="sides">
          <button type="button" class="side a" data-s="A" aria-pressed="false">${esc(d.side_a)}</button>
          <button type="button" class="side b" data-s="B" aria-pressed="false">${esc(d.side_b)}</button>
        </div>
      </fieldset>
      <div class="field"><label for="t">2 · Ton argument</label>
        <textarea id="t" maxlength="500" placeholder="Explique ton point de vue en quelques phrases…"></textarea>
        <div class="count"><span id="cnt">0</span> / 500</div>
        <div class="small muted" style="display:flex;gap:6px;align-items:center">${ICON.shield} Insultes et attaques personnelles bloquées automatiquement</div>
      </div>
      <div id="err"></div>
      <button class="btn btn-yellow" id="go" type="submit">Envoyer anonymement</button>
    </form>`;
  const sideBtns = [...$app.querySelectorAll('.side')];
  sideBtns.forEach((bt) => bt.addEventListener('click', () => {
    side = bt.dataset.s;
    sideBtns.forEach((x) => { x.classList.toggle('on', x === bt); x.setAttribute('aria-pressed', String(x === bt)); });
  }));
  const ta = document.getElementById('t');
  ta.addEventListener('input', () => { document.getElementById('cnt').textContent = ta.value.length; });
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('err');
    if (!side) return (err.innerHTML = `<div class="error">Choisis d’abord ton camp.</div>`);
    const body = ta.value.trim();
    if (body.length < 3) return (err.innerHTML = `<div class="error">Écris au moins une phrase pour défendre ton camp.</div>`);
    const btn = document.getElementById('go'); btn.disabled = true; btn.textContent = 'Envoi…';
    try {
      const r = await rpc('palabre_submit', { p_id: id, p_side: side, p_body: body });
      if (!r.ok) {
        const msg = { insult: 'Ton message contient des insultes. Reformule-le poliment : un bon argument convainc mieux.', too_long: 'Ton message est trop long (500 caractères max).', full: 'Ce débat a reçu trop de réponses.', not_found: 'Ce débat n’existe plus.' }[r.reason] || 'Réponse refusée.';
        err.innerHTML = `<div class="error">${esc(msg)}</div>`; btn.disabled = false; btn.textContent = 'Envoyer anonymement'; return;
      }
      answered[id] = true; store.set('answered', answered);
      done(r);
    } catch {
      err.innerHTML = `<div class="error">L’envoi a échoué. Vérifie ta connexion et réessaie.</div>`;
      btn.disabled = false; btn.textContent = 'Envoyer anonymement';
    }
  });
}

/* ---------- Espace propriétaire ---------- */
async function viewOwner(id, token) {
  loading();
  let d;
  const load = async () => rpc('palabre_owner_get', { p_id: id, p_token: token });
  try { d = await load(); } catch { return fail('Impossible de charger ton débat. Vérifie ta connexion.'); }
  if (!d) return fail('Lien invalide : ce débat n’existe pas ou le lien secret est incorrect.');

  // Si on arrive via le lien secret sur un autre téléphone, on l'enregistre.
  const mine = store.get('mine', []);
  if (!mine.some((m) => m.id === id)) { mine.unshift({ id, token, question: d.question, at: Date.now() }); store.set('mine', mine.slice(0, 30)); }

  const st = { color: 0, selected: [] };
  const colors = [{ bg: C.yellow, ink: C.bg, label: 'Jaune' }, { bg: C.bg, ink: C.yellow, label: 'Nuit' }, { bg: C.light, ink: C.bg, label: 'Clair' }];
  const link = publicLink(id);
  const caption = `${d.question}\nRéponds anonymement ici : ${link}`;

  const counts = () => {
    const vis = d.responses.filter((r) => !r.hidden);
    return { count_a: vis.filter((r) => r.side === 'A').length, count_b: vis.filter((r) => r.side === 'B').length };
  };

  async function render() {
    const c = counts();
    const total = c.count_a + c.count_b;
    const withText = d.responses.filter((r) => r.body);
    $app.innerHTML = `${topBack('Ton débat')}
      <p class="big-q" style="font-size:26px">${esc(d.question)}</p>

      <h2>1 · Poste ta question en statut</h2>
      <img class="preview" id="qprev" alt="Aperçu de la carte question">
      <div class="swatches" role="group" aria-label="Couleur de la carte">${colors.map((co, i) =>
        `<button class="sw ${i === st.color ? 'on' : ''}" data-c="${i}" style="background:${co.bg}" aria-label="Carte ${co.label}" aria-pressed="${i === st.color}"></button>`).join('')}</div>
      <div class="stack" style="margin-top:8px">
        <button class="btn btn-green" id="shareQ">${ICON.share} Partager la carte</button>
        <button class="btn btn-ghost" id="copyL">Copier le lien pour la légende</button>
      </div>
      <p class="small muted" style="line-height:1.45">Sur WhatsApp, le lien n’est pas cliquable sur une image : colle-le dans la légende du statut, ou poste-le en statut texte juste après.</p>

      <h2>2 · Réponses <span class="muted" style="font-weight:600">(${total})</span></h2>
      <div class="panel">${scoreBlock({ ...d, ...c })}
        <div class="small muted" style="display:flex;justify-content:space-between"><span>${d.blocked} message(s) bloqué(s) par le filtre</span><button class="mini" id="refresh">Actualiser</button></div></div>
      <p class="small muted">Touche « Choisir » sur 2 réponses au maximum pour ta carte verdict. « Masquer » retire une réponse du score et de la carte.</p>
      <div class="stack" id="list">${withText.length ? withText.map((r) => {
        const sel = st.selected.includes(r.id);
        const sideCls = r.side === 'A' ? 'a' : 'b';
        return `<div class="panel resp ${sel ? 'sel' : ''} ${r.hidden ? 'hid' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center"><span class="tag ${sideCls}">${esc(r.side === 'A' ? d.side_a : d.side_b)}</span>
          <span class="small muted">${new Date(r.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
          <div class="resp-body">${esc(r.body)}</div>
          <div class="resp-actions">
            ${r.hidden ? '' : `<button class="mini ${sel ? 'on' : ''}" data-sel="${r.id}" aria-pressed="${sel}">${sel ? 'Choisie ✓' : 'Choisir'}</button>`}
            <button class="mini" data-hide="${r.id}">${r.hidden ? 'Réafficher' : 'Masquer'}</button>
          </div></div>`;
      }).join('') : `<div class="notice">Pas encore de réponse. Poste ta carte en statut et reviens dans quelques minutes.</div>`}</div>

      <h2>3 · Reposte le verdict</h2>
      <img class="preview" id="vprev" alt="Aperçu de la carte verdict">
      <div class="stack" style="margin-top:14px">
        <button class="btn btn-green" id="shareV" ${total ? '' : 'disabled'}>${ICON.share} Partager le verdict</button>
      </div>

      <h2>Ton lien secret</h2>
      <div class="notice">Ce lien est ta clé pour voir les réponses. Garde-le pour toi : quiconque l’a peut lire les réponses. Il est enregistré sur ce téléphone, mais copie-le quelque part au cas où.</div>
      <p><button class="btn btn-ghost" id="copyO">Copier mon lien secret</button></p>`;

    drawQuestion(st.color).then((cv) => { const img = document.getElementById('qprev'); if (img) img.src = cv.toDataURL('image/png'); });
    drawVerdict().then((cv) => { const img = document.getElementById('vprev'); if (img) img.src = cv.toDataURL('image/png'); });

    $app.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => { st.color = Number(b.dataset.c); render(); }));
    $app.querySelectorAll('[data-sel]').forEach((b) => b.addEventListener('click', () => {
      const rid = Number(b.dataset.sel);
      if (st.selected.includes(rid)) st.selected = st.selected.filter((x) => x !== rid);
      else { st.selected.push(rid); if (st.selected.length > 2) st.selected.shift(); }
      render();
    }));
    $app.querySelectorAll('[data-hide]').forEach((b) => b.addEventListener('click', async () => {
      const rid = Number(b.dataset.hide);
      const r = d.responses.find((x) => x.id === rid);
      try {
        await rpc('palabre_owner_hide', { p_id: id, p_token: token, p_response: rid, p_hidden: !r.hidden });
        r.hidden = !r.hidden; st.selected = st.selected.filter((x) => x !== rid); render();
      } catch { toast('Action impossible, réessaie.'); }
    }));
    document.getElementById('refresh').addEventListener('click', refresh);
    document.getElementById('copyL').addEventListener('click', async () => { toast((await copy(link)) ? 'Lien copié. Colle-le dans la légende.' : link); });
    document.getElementById('copyO').addEventListener('click', async () => { toast((await copy(ownerLink(id, token))) ? 'Lien secret copié.' : 'Copie impossible.'); });
    document.getElementById('shareQ').addEventListener('click', async () => {
      await copy(link);
      shareCanvas(await drawQuestion(st.color), `palabre-${id}.png`, caption, 'Lien copié : colle-le dans la légende de ton statut.');
    });
    document.getElementById('shareV').addEventListener('click', async () => {
      await copy(link);
      shareCanvas(await drawVerdict(), `palabre-verdict-${id}.png`, `Le verdict : ${d.question}\nDonne ton avis : ${link}`, 'Lien copié : colle-le dans la légende.');
    });
  }

  async function refresh() {
    try { const nd = await load(); if (nd) { d = nd; render(); toast('À jour'); } } catch { toast('Pas de connexion'); }
  }

  /* --- Cartes (images 1080 × 1920 pour les statuts) --- */
  async function drawQuestion(ci) {
    await fontsReady();
    const { cv, ctx } = canvas();
    const { bg, ink } = colors[ci];
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1920);
    header(ctx, ink, 'DÉBAT');
    const fit = fitText(ctx, d.question, 900, 860, 128, 60, `800`, DISPLAY, 1.04);
    // Bloc (auteur + question + camps) centré verticalement entre l'en-tête et le pied.
    const blockH = 110 + fit.lines.length * fit.size * 1.04 + 70 + 130;
    let y = Math.max(280, 260 + (1600 - 260 - blockH) / 2);
    ctx.fillStyle = ink; ctx.font = `600 44px ${BODY}`; ctx.textBaseline = 'top';
    ctx.fillText(`Débat lancé par ${d.author}`, 90, y);
    y += 110;
    ctx.font = `800 ${fit.size}px ${DISPLAY}`; ctx.fillStyle = ink;
    fit.lines.forEach((l) => { ctx.fillText(l, 90, y); y += fit.size * 1.04; });
    y += 70;
    const w = (900 - 30) / 2;
    [[d.side_a, C.blue], [d.side_b, C.orange]].forEach(([label, col], i) => {
      const x = 90 + i * (w + 30);
      ctx.fillStyle = col; rr(ctx, x, y, w, 130, 65); ctx.fill();
      ctx.fillStyle = C.bg; const f = fitText(ctx, label, w - 50, 70, 56, 30, '700', BODY, 1);
      ctx.font = `700 ${f.size}px ${BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.lines[0], x + w / 2, y + 66); ctx.textAlign = 'left';
    });
    ctx.fillStyle = ink; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 50px ${BODY}`; ctx.fillText('Réponds anonymement', 90, 1690);
    ctx.font = `500 40px ${BODY}`; ctx.globalAlpha = 0.8; ctx.fillText('Le lien est dans la légende', 90, 1755); ctx.globalAlpha = 1;
    return cv;
  }

  async function drawVerdict() {
    await fontsReady();
    const { cv, ctx } = canvas();
    const c = counts(); const total = c.count_a + c.count_b;
    const [pa, pb] = pct(c.count_a, c.count_b);
    ctx.fillStyle = C.light; ctx.fillRect(0, 0, 1080, 1920);
    header(ctx, C.bg, `${total} AVIS ANONYMES`);
    let y = 300;
    const q = fitText(ctx, d.question, 900, 300, 80, 48, '800', DISPLAY, 1.06);
    ctx.fillStyle = C.bg; ctx.font = `800 ${q.size}px ${DISPLAY}`; ctx.textBaseline = 'top';
    q.lines.forEach((l) => { ctx.fillText(l, 90, y); y += q.size * 1.06; });
    y += 50;
    const aWins = pa >= pb;
    const big = aWins ? pa : pb, label = aWins ? d.side_a : d.side_b;
    ctx.fillStyle = aWins ? '#2F5BD3' : '#C2410C'; ctx.font = `800 200px ${DISPLAY}`;
    ctx.fillText(`${total ? big : 0} %`, 82, y);
    const bw = ctx.measureText(`${total ? big : 0} %`).width;
    ctx.fillStyle = C.bg; const lf = fitText(ctx, `disent « ${label} »`, 900 - bw - 40, 60, 54, 30, '700', BODY, 1);
    ctx.font = `700 ${lf.size}px ${BODY}`; ctx.textBaseline = 'alphabetic'; ctx.fillText(lf.lines[0], 90 + bw + 30, y + 175);
    y += 240;
    ctx.fillStyle = C.blue; rr(ctx, 90, y, Math.max(24, 900 * pa / 100 - 6), 36, 18); ctx.fill();
    ctx.fillStyle = C.orange; rr(ctx, 90 + 900 * pa / 100 + 6, y, Math.max(24, 900 * pb / 100 - 6), 36, 18); ctx.fill();
    y += 90;
    ctx.font = `700 38px ${BODY}`; ctx.fillStyle = '#2F5BD3'; ctx.fillText(`${d.side_a} ${pa} %`, 90, y);
    ctx.fillStyle = '#C2410C'; ctx.textAlign = 'right'; ctx.fillText(`${d.side_b} ${pb} %`, 990, y); ctx.textAlign = 'left';
    y += 50;
    const picks = st.selected.map((rid) => d.responses.find((r) => r.id === rid)).filter(Boolean);
    const avail = 1580 - y;
    const maxH = picks.length === 2 ? avail / 2 - 30 : avail - 30;
    // Même taille de texte pour toutes les citations : la plus petite qui convient à chacune.
    const qsize = Math.min(...picks.map((r) => fitText(ctx, `« ${r.body} »`, 820, maxH - 130, 46, 30, '500', BODY, 1.35).size), 46);
    picks.forEach((r) => {
      const f = fitText(ctx, `« ${r.body} »`, 820, maxH - 130, qsize, 30, '500', BODY, 1.35);
      const lines = f.lines;
      const h = 110 + lines.length * f.size * 1.35;
      ctx.fillStyle = '#FFFFFF'; rr(ctx, 90, y, 900, h, 36); ctx.fill();
      ctx.strokeStyle = '#E4E0EE'; ctx.lineWidth = 3; ctx.stroke();
      const tagTxt = r.side === 'A' ? d.side_a : d.side_b;
      ctx.font = `700 30px ${BODY}`; const tw = ctx.measureText(tagTxt).width + 40;
      ctx.fillStyle = r.side === 'A' ? C.blue : C.orange; rr(ctx, 130, y + 34, tw, 48, 24); ctx.fill();
      ctx.fillStyle = C.bg; ctx.textBaseline = 'middle'; ctx.fillText(tagTxt, 150, y + 59);
      ctx.font = `500 ${f.size}px ${BODY}`; ctx.textBaseline = 'top';
      let ly = y + 104; lines.forEach((l) => { ctx.fillText(l, 130, ly); ly += f.size * 1.35; });
      y += h + 30;
    });
    ctx.fillStyle = C.bg; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 64px ${DISPLAY}`; ctx.fillText('Et toi, t’en penses quoi ?', 90, 1720);
    ctx.font = `500 40px ${BODY}`; ctx.globalAlpha = 0.75; ctx.fillText('Le lien est dans la légende', 90, 1785); ctx.globalAlpha = 1;
    return cv;
  }

  const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
  document.addEventListener('visibilitychange', onVis);
  cleanup = () => document.removeEventListener('visibilitychange', onVis);
  render();
}

/* ---------- Dessin ---------- */
const DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif';
const BODY = '"Instrument Sans", system-ui, sans-serif';
let fontsPromise;
function fontsReady() {
  fontsPromise ||= Promise.all([
    document.fonts.load(`800 100px ${DISPLAY}`), document.fonts.load(`700 40px ${BODY}`),
    document.fonts.load(`600 40px ${BODY}`), document.fonts.load(`500 40px ${BODY}`),
  ]).catch(() => {});
  return fontsPromise;
}
function canvas() { const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; return { cv, ctx: cv.getContext('2d') }; }
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function wrap(ctx, text, maxW) {
  const lines = [];
  String(text).split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).filter(Boolean).forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxW || !line) line = test; else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
  });
  return lines.length ? lines : [''];
}
function fitText(ctx, text, maxW, maxH, start, min, weight, family, lh) {
  for (let s = start; s >= min; s -= 2) {
    ctx.font = `${weight} ${s}px ${family}`;
    const lines = wrap(ctx, text, maxW);
    if (lines.length * s * lh <= maxH && lines.every((l) => ctx.measureText(l).width <= maxW)) return { size: s, lines };
  }
  ctx.font = `${weight} ${min}px ${family}`;
  let lines = wrap(ctx, text, maxW);
  const maxLines = Math.max(1, Math.floor(maxH / (min * lh)));
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return { size: min, lines };
}
function header(ctx, ink, tag) {
  const logo = new Path2D('M3 5h15a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H10l-5 4v-4H3z');
  const logo2 = new Path2D('M27 12H14a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h7l4 4v-4h2z');
  ctx.save(); ctx.translate(86, 100); ctx.scale(2.6, 2.6);
  // Sur fond coloré, le logo passe en monochrome sombre pour rester lisible.
  ctx.fillStyle = ink; ctx.fill(logo); ctx.globalAlpha = 0.55; ctx.fill(logo2); ctx.restore();
  ctx.fillStyle = ink; ctx.font = `800 62px ${DISPLAY}`; ctx.textBaseline = 'middle'; ctx.fillText('palabre', 180, 140);
  ctx.font = `700 30px ${BODY}`; const w = ctx.measureText(tag).width + 48;
  ctx.strokeStyle = ink; ctx.lineWidth = 3; rr(ctx, 990 - w, 112, w, 58, 29); ctx.stroke();
  ctx.fillText(tag, 990 - w + 24, 142);
}
async function shareCanvas(cv, filename, text, fallbackMsg) {
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); toast(fallbackMsg); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Image téléchargée. ' + fallbackMsg);
}

route();
