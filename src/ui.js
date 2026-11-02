// Interface para TV (1920x1080, controle remoto). Telas: entrada, navegação, detalhes, busca, listas, futebol.
import { S, reload, addUrl, addXtream, refreshList, deleteList, toggleList, loadAccounts, toggleFav, groups, groupAdd, groupDelete,
  continueList, removeProg, login, logout, accessText, syncNow, retryPending, dropPending } from './state.js';
import { Store } from './store.js';
import { focus, first, pushKeys, K, current } from './nav.js';
import { esc, yearOf, quality, audioTag, animeSrc, cleanT, fmt, hhmm, norm } from './util.js';
import * as X from './xtream.js';
import * as F from './futebol.js';
import { play, isOpen, close as closePlayer } from './player.js';
import * as Covers from './covers.js';

const $ = (s, r) => (r || document).querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const WHATS = '5542920028569';
const TABS = [['rec', 'RECOMENDAÇÕES'], ['live', 'TV AO VIVO'], ['movies', 'FILMES'], ['series', 'SÉRIES'], ['anime', 'ANIMES'], ['favs', 'FAVORITOS'], ['fut', 'FUTEBOL']];

const V = { tab: 'rec', group: {}, year: '', animeSrc: '', stack: [], scroll: {} };

// ---------------------------------------------------------------- toast
export function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 4000);
}

// ---------------------------------------------------------------- imagens sob demanda
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) { const i = e.target; io.unobserve(i); i._go(); }
}, { rootMargin: '400px' }) : null;
/** miss: chamado quando não há imagem (ou nenhuma abriu) e o card está na tela — busca a capa em outro lugar */
function img(src, cls, alt, miss, alt2) {
  const i = h('img', cls || '');
  i.decoding = 'async';
  // ordem: imagem da lista → reserva → as mesmas pelo proxy de imagens (contorna bloqueio de site, http, formato
  // que a TV não abre e imagem enorme) → busca de capa em outro lugar
  const q = [];
  const add = (u) => { if (u && q.indexOf(u) < 0) q.push(u); };
  add(src); add(alt); add(alt2); add(proxy(src)); add(proxy(alt));
  let k = 0;
  if (miss) i._miss = () => { i._miss = null; miss((u) => { q.length = 0; k = 0; add(u); add(proxy(u)); i.style.visibility = ''; i.src = q[k++]; }); };
  const fail = () => {
    clearTimeout(i._t);
    if (k < q.length) { i.src = q[k++]; arm(); return; }
    i.style.visibility = 'hidden'; if (i.parentNode) i.parentNode.classList.remove('ok');
    if (i._miss) i._miss();
  };
  // servidor lento: depois de 10 s passa para a próxima opção
  const arm = () => { clearTimeout(i._t); i._t = setTimeout(() => { if (!i.complete && document.body.contains(i)) fail(); }, 10000); };
  i.onerror = fail;
  // carregou: esconde o nome escrito atrás (logo transparente não mistura com o texto); imagem vazia (1x1) conta como erro
  i.onload = () => { clearTimeout(i._t); if (i.naturalWidth <= 2) return fail(); if (i.parentNode) i.parentNode.classList.add('ok'); };
  i._go = () => { if (k < q.length) { i.src = q[k++]; arm(); } else if (i._miss) i._miss(); };
  if (!q.length) i.style.visibility = 'hidden';
  if (io) io.observe(i); else i._go();
  return i;
}
/** proxy público de imagens (images.weserv.nl): busca do lado do servidor e entrega PNG pequeno */
function proxy(u) {
  if (!u || /^data:|images\.weserv\.nl|imgur\.com/.test(u)) return ''; // o imgur recusa o proxy
  return 'https://images.weserv.nl/?w=360&we&output=png&url=' + encodeURIComponent(u.replace(/^https?:\/\//, ''));
}

// ---------------------------------------------------------------- cartões
function card(it, ctx) {
  const live = it.kind === 'l';
  const c = h('div', 'f card' + (live ? ' ch' : ''));
  const art = h('div', 'art');
  art.appendChild(img(it.logo || Covers.known(it), '', it.logoAlt, (set) => Covers.want(it, set), it.logoOrig));
  const ph = h('div', 'ph', esc(cleanT(it.title)));
  art.appendChild(ph);
  if (!live) { const t = audioTag(it); if (t) art.appendChild(h('span', 'tag ' + t.toLowerCase(), t)); }
  if (S.favs.has(it.key)) art.appendChild(h('span', 'star', '★'));
  c.appendChild(art);
  const y = yearOf(it.title), q = quality(it.title);
  c.appendChild(h('div', 'cap', '<b>' + esc(cleanT(it.title) || it.title) + '</b><small>' + esc([y, q, it.kind === 's' && it.eps.length > 1 ? it.eps.length + ' ep.' : ''].filter(Boolean).join(' · ')) + '</small>'));
  c.onok = () => open(it, ctx);
  c.onhold = () => { const f = toggleFav(it.key); toast(f ? '★ Adicionado aos favoritos' : 'Removido dos favoritos'); };
  return c;
}
function open(it, ctx) {
  if (it.kind === 'l') { V.focusKey = it.key; play(it, it.eps[0], { list: (ctx && ctx.list) || S.lib.live, back: restoreFocus }); }
  else showDetail(it);
}
function restoreFocus() {
  const k = V.focusKey;
  const el = k && document.querySelector('[data-k="' + CSS_ESC(k) + '"]');
  if (el) focus(el); else first();
}
const CSS_ESC = (s) => s.replace(/["\\]/g, '\\$&');

/** grade com carregamento progressivo (listas de 10 mil itens não travam a TV) */
function grid(items, ctx, empty) {
  const g = h('div', 'grid');
  if (!items.length) { g.appendChild(h('div', 'empty', esc(empty || 'Nada por aqui.'))); return g; }
  let n = 0;
  const more = () => {
    const end = Math.min(items.length, n + 40);
    for (; n < end; n++) {
      const c = card(items[n], ctx); c.dataset.k = items[n].key;
      if (n >= end - 10) { const mark = n; c.onfocus2 = () => { if (mark >= n - 10 && n < items.length) more(); }; }
      g.appendChild(c);
    }
  };
  more();
  g._more = () => { if (n < items.length) more(); };
  return g;
}
function shelf(title, items, ctx, extra) {
  if (!items.length) return null;
  const s = h('div', 'shelf');
  s.appendChild(h('h2', '', esc(title)));
  const row = h('div', 'row-h');
  items.slice(0, 20).forEach((it) => { const c = card(it, ctx); c.dataset.k = it.key; if (extra) extra(c, it); row.appendChild(c); });
  s.appendChild(row);
  return s;
}

// ---------------------------------------------------------------- tela principal
export function renderApp() {
  const app = $('#app');
  app.innerHTML = '';
  const top = h('div', 'top');
  top.appendChild(h('img', 'logo')).src = 'img/logo.png';
  const tabs = h('div', 'tabs');
  TABS.forEach(([id, name]) => {
    const t = h('div', 'f tab' + (V.tab === id ? ' sel' : ''), name);
    t.id = 'tab-' + id;
    t.onok = () => { if (V.tab !== id) { V.tab = id; V.year = ''; renderApp(); focus($('#tab-' + id)); } };
    tabs.appendChild(t);
  });
  top.appendChild(tabs);
  const act = h('div', 'acts');
  const bs = h('div', 'f btn', '🔍 Buscar'); bs.onok = showSearch; act.appendChild(bs);
  const bl = h('div', 'f btn', '☰ Listas'); bl.onok = showLists; act.appendChild(bl);
  top.appendChild(act);
  app.appendChild(top);
  const body = h('div', 'body');
  app.appendChild(body);
  if (S.busy) body.appendChild(h('div', 'busy', esc(S.status || 'Carregando…')));
  if (!Store.lists().length && !S.busy) {
    const w = h('div', 'welcome', '<h1>Bem-vindo ao NTPlay</h1><p>Adicione sua lista (link M3U ou Xtream Codes) para começar.</p>');
    const b = h('div', 'f btn big autof', '☰ Adicionar lista'); b.onok = showLists; w.appendChild(b);
    body.appendChild(w); return;
  }
  ({ rec: renderRec, live: () => renderBrowse('live'), movies: () => renderBrowse('movies'), series: () => renderBrowse('series'),
    anime: renderAnime, favs: renderFavs, fut: renderFut })[V.tab](body);
}

function renderRec(body) {
  const sc = h('div', 'scroll shelves');
  const lib = S.lib;
  const cont = continueList();
  const s1 = shelf('Continuar assistindo', cont, null, (c, it) => {
    const x = h('div', 'f mini', '✕'); x.onok = () => { removeProg(it.key); renderApp(); first(); }; c.appendChild(x);
  });
  if (s1) sc.appendChild(s1);
  const fl = lib.live.filter((i) => S.favs.has(i.key));
  const s2 = shelf('Canais favoritos', fl, { list: fl }); if (s2) sc.appendChild(s2);
  // destaques: os títulos mais recentes (ano no nome) de filmes e séries
  const recent = (l) => l.filter((i) => !i.adult && i.logo).map((i) => [i, +yearOf(i.title) || 0]).sort((a, b) => b[1] - a[1]).slice(0, 30).map((x) => x[0]);
  const s3 = shelf('Lançamentos — Filmes', recent(lib.movies)); if (s3) sc.appendChild(s3);
  const s4 = shelf('Lançamentos — Séries', recent(lib.series)); if (s4) sc.appendChild(s4);
  const fm = lib.movies.concat(lib.series).filter((i) => S.favs.has(i.key));
  const s5 = shelf('Meus favoritos', fm); if (s5) sc.appendChild(s5);
  for (const [g, items] of lib.movieGroups.slice(0, 4)) { if (items[0].adult) continue; const s = shelf(g, items); if (s) sc.appendChild(s); }
  if (!sc.children.length) sc.appendChild(h('div', 'empty', 'A lista ainda está carregando ou está vazia.'));
  body.appendChild(sc);
}

function yearBtn(items, rerender) {
  const b = h('div', 'f btn sm', V.year ? '📅 ' + V.year + ' ✕' : '📅 Ano');
  b.onok = () => {
    if (V.year) { V.year = ''; rerender(); return; }
    const ys = Array.from(new Set(items.map((i) => yearOf(i.title)).filter(Boolean))).sort().reverse();
    if (!ys.length) return toast('Nenhum ano encontrado nos nomes desta lista.');
    pick('Filtrar por ano', ys.map((y) => ({ name: y })), (x) => { V.year = x.name; rerender(); });
  };
  return b;
}
const byYear = (l) => (V.year ? l.filter((i) => yearOf(i.title) === V.year) : l);

function renderBrowse(kind) {
  const lib = S.lib;
  const groupsL = kind === 'live' ? lib.liveGroups : kind === 'movies' ? lib.movieGroups : lib.serieGroups;
  const all = kind === 'live' ? lib.live : kind === 'movies' ? lib.movies : lib.series;
  const body = $('.body');
  const side = h('div', 'side scroll');
  const main = h('div', 'main');
  const sel = V.group[kind] || '';
  const mk = (name, label, count) => {
    const b = h('div', 'f grp' + (sel === name ? ' sel' : ''), esc(label) + '<small>' + count + '</small>');
    b.onok = () => { V.group[kind] = name; renderApp(); const s = document.querySelector('.grp.sel'); if (s) focus(s); };
    b.onright = () => { const c = main.querySelector('.card'); if (c) { focus(c); return true; } };
    side.appendChild(b);
  };
  mk('', 'Todos', all.length);
  for (const [g, items] of groupsL) mk(g, g, items.length);
  const gsel = sel ? (groupsL.find((x) => x[0] === sel) || [0, []])[1] : all;
  const items = byYear(gsel);
  const head = h('div', 'mhead', '<h2>' + esc(sel || 'Todos') + ' <small>' + items.length + '</small></h2>');
  if (kind !== 'live') head.appendChild(yearBtn(gsel, () => { renderApp(); first(); }));
  main.appendChild(head);
  const sc = h('div', 'scroll gridwrap');
  sc.appendChild(grid(items, { list: items }, 'Nenhum item nesta categoria.'));
  main.appendChild(sc);
  body.appendChild(side); body.appendChild(main);
}

function renderAnime(body) {
  const main = h('div', 'main full');
  let items = S.lib.anime;
  if (V.animeSrc) items = items.filter((i) => animeSrc(i) === V.animeSrc);
  items = byYear(items);
  const head = h('div', 'mhead', '<h2>Animes <small>' + items.length + '</small></h2>');
  [['', 'Todos'], ['CR', 'Crunchyroll'], ['FN', 'Funimation Now']].forEach(([k, n]) => {
    const b = h('div', 'f btn sm' + (V.animeSrc === k ? ' sel' : ''), n); b.onok = () => { V.animeSrc = k; renderApp(); first(); }; head.appendChild(b);
  });
  head.appendChild(yearBtn(S.lib.anime, () => { renderApp(); first(); }));
  main.appendChild(head);
  const sc = h('div', 'scroll gridwrap'); sc.appendChild(grid(items, { list: items }, 'Nenhum anime encontrado na lista.')); main.appendChild(sc);
  body.appendChild(main);
}
function renderFavs(body) {
  const sc = h('div', 'scroll shelves');
  const lib = S.lib;
  const f = (l) => l.filter((i) => S.favs.has(i.key));
  const add = (s) => { if (s) sc.appendChild(s); };
  const fl = f(lib.live);
  add(shelf('★ Canais', fl, { list: fl })); add(shelf('★ Filmes', f(lib.movies))); add(shelf('★ Séries', f(lib.series)));
  const gs = groups();
  for (const name of Object.keys(gs)) {
    const items = gs[name].map((k) => lib.byKey.get(k)).filter(Boolean);
    const s = shelf('📁 ' + name, items) || h('div', 'shelf', '<h2>📁 ' + esc(name) + '</h2><p class="muted">Grupo vazio. Abra um filme ou série e use “＋ Grupo”.</p>');
    const del = h('div', 'f btn sm', 'Excluir grupo');
    del.onok = () => confirmBox('Excluir o grupo "' + name + '"? Os títulos continuam na lista.', () => { groupDelete(name); renderApp(); first(); });
    s.querySelector('h2').appendChild(del);
    sc.appendChild(s);
  }
  if (!sc.children.length) sc.appendChild(h('div', 'empty', 'Nenhum favorito ainda. Segure OK (ou aperte o botão vermelho) sobre um título para favoritar.'));
  body.appendChild(sc);
}

// ---------------------------------------------------------------- futebol
let futOff = 0;
async function renderFut(body) {
  const sc = h('div', 'scroll fut');
  const bar = h('div', 'mhead');
  [[-1, 'Ontem'], [0, 'Hoje'], [1, 'Amanhã']].forEach(([o, n]) => { const b = h('div', 'f btn sm' + (futOff === o ? ' sel' : ''), n); b.onok = () => { futOff = o; renderApp(); first(); }; bar.appendChild(b); });
  sc.appendChild(bar);
  const box = h('div', '', '<div class="busy">Buscando os jogos…</div>');
  sc.appendChild(box);
  body.appendChild(sc);
  const myTab = V.tab;
  const [list] = await Promise.all([F.games(futOff), futOff === 0 ? F.loadEpg(S.lib).catch(() => null) : null]);
  if (V.tab !== myTab || !document.body.contains(box)) return;
  box.innerHTML = '';
  const now = futOff === 0 ? F.playingNow(S.lib) : [];
  if (now.length) {
    const s = h('div', 'shelf'); s.appendChild(h('h2', '', '● Passando jogo agora'));
    const row = h('div', 'row-h');
    now.forEach(({ c, title }) => { const b = h('div', 'f chip', '<b>' + esc(c.title) + '</b><small>' + esc(title) + '</small>'); b.onok = () => open(c, { list: now.map((x) => x.c) }); row.appendChild(b); });
    s.appendChild(row); box.appendChild(s);
  }
  if (!list.length) { box.appendChild(h('div', 'empty', 'Nenhum jogo encontrado nesta data.')); return; }
  let lg = '', wrap = null;
  for (const g of list.sort((a, b) => a.league.localeCompare(b.league) || a.date - b.date)) {
    if (g.league !== lg) { lg = g.league; box.appendChild(h('h2', 'lg', esc(lg))); wrap = h('div', 'games'); box.appendChild(wrap); }
    const chs = F.channelsFor(g, S.lib);
    const st = g.state === 'in' ? '<span class="live">● ' + esc(g.detail) + '</span>' : g.state === 'post' ? esc(g.detail || 'Encerrado') : hhmm(g.date);
    const sc2 = g.state === 'pre' ? 'x' : (g.hs || 0) + ' x ' + (g.as || 0);
    const c = h('div', 'f game', '<div class="st">' + st + '</div><div class="tm"><img src="' + esc(g.hl || '') + '" onerror="this.style.visibility=\'hidden\'">' + esc(g.home) +
      '<b>' + sc2 + '</b>' + esc(g.away) + '<img src="' + esc(g.al || '') + '" onerror="this.style.visibility=\'hidden\'"></div>' +
      '<div class="chs">' + (chs.length ? chs.map((x) => '📺 ' + esc(x.c.title) + (x.now ? ' <i>● AGORA</i>' : x.at ? ' <i>' + hhmm(x.at) + '</i>' : '')).join('<br>') : '<span class="muted">Sem canal na sua lista</span>') + '</div>');
    c.onok = () => { if (chs.length) open(chs[0].c, { list: chs.map((x) => x.c) }); else toast('Nenhum canal da sua lista passa este jogo.'); };
    wrap.appendChild(c);
  }
}

// ---------------------------------------------------------------- detalhes
const infoCache = new Map();
function pushView(render, onBack) {
  const prev = current();
  const layer = h('div', 'layer open view');
  $('#views').appendChild(layer);
  const un = pushKeys((e, k) => {
    if (isOpen()) return false;
    if (k === K.BACK || k === K.ESC || k === K.BKSP) { closeView(); return true; }
    return false;
  });
  const v = { layer, un, prev, onBack };
  V.stack.push(v);
  render(layer);
  return v;
}
function closeView() {
  const v = V.stack.pop(); if (!v) return;
  v.un(); v.layer.remove();
  if (v.onBack) v.onBack();
  if (v.prev && document.body.contains(v.prev)) focus(v.prev); else first();
}
function closeAllViews() { while (V.stack.length) closeView(); }

export function showDetail(it) {
  pushView((L) => {
    L.classList.add('detail');
    const bg = h('div', 'dbg'); L.appendChild(bg);
    const left = h('div', 'dleft');
    const poster = h('div', 'poster'); poster.appendChild(h('div', 'ph', esc(cleanT(it.title)))); poster.appendChild(img(it.logo || Covers.known(it), '', '', (set) => Covers.want(it, set))); left.appendChild(poster);
    const right = h('div', 'dright scroll');
    right.appendChild(h('h1', '', esc(cleanT(it.title) || it.title)));
    const meta = h('div', 'meta', esc([yearOf(it.title), quality(it.title), it.group, audioTag(it) === 'DUB' ? 'Dublado' : audioTag(it) === 'LEG' ? 'Legendado' : ''].filter(Boolean).join(' · ')));
    right.appendChild(meta);
    const ov = h('p', 'ov muted', 'Carregando sinopse…'); right.appendChild(ov);
    const btns = h('div', 'dbtns');
    const eps = it.eps.slice();
    const resumeEp = () => {
      let best = null, ts = 0;
      for (const e of eps) { const p = S.prog[e.url]; if (p && p.ts > ts) { ts = p.ts; best = p.done ? eps[eps.indexOf(e) + 1] || e : e; } }
      return best;
    };
    const bp = h('div', 'f btn big autof', '▶ Assistir');
    const setPlay = () => {
      const r = resumeEp();
      bp.innerHTML = it.kind === 's' ? (r ? '▶ Continuar T' + r.s + ' E' + r.e : eps.length ? '▶ Assistir T' + eps[0].s + ' E' + eps[0].e : '▶ Assistir')
        : (S.prog[it.eps[0].url] && !S.prog[it.eps[0].url].done && S.prog[it.eps[0].url].t > 10000 ? '▶ Continuar de ' + fmt(S.prog[it.eps[0].url].t) : '▶ Assistir');
    };
    bp.onok = () => { const e = it.kind === 's' ? (resumeEp() || eps[0]) : it.eps[0]; if (e) play(it, e, { eps, back: () => { setPlay(); renderEps(); focus(bp); } }); };
    btns.appendChild(bp);
    const bf = h('div', 'f btn', S.favs.has(it.key) ? '★ Favorito' : '☆ Favoritar');
    bf.onok = () => { const f = toggleFav(it.key); bf.innerHTML = f ? '★ Favorito' : '☆ Favoritar'; };
    btns.appendChild(bf);
    const bg2 = h('div', 'f btn', '＋ Grupo'); bg2.onok = () => groupDialog(it); btns.appendChild(bg2);
    right.appendChild(btns);
    const epBox = h('div', 'eps');
    right.appendChild(epBox);
    L.appendChild(left); L.appendChild(right);

    let season = 0;
    function renderEps() {
      if (it.kind !== 's') return;
      epBox.innerHTML = '';
      if (!eps.length) return;
      const seasons = Array.from(new Set(eps.map((e) => e.s))).sort((a, b) => a - b);
      if (!season || seasons.indexOf(season) < 0) { const r = resumeEp(); season = r ? r.s : seasons[0]; }
      const sb = h('div', 'seasons');
      seasons.forEach((s) => { const b = h('div', 'f btn sm' + (s === season ? ' sel' : ''), 'Temporada ' + s); b.onok = () => { season = s; renderEps(); focus(epBox.querySelector('.seasons .sel')); }; sb.appendChild(b); });
      epBox.appendChild(sb);
      const list = h('div', 'eplist');
      eps.filter((e) => e.s === season).forEach((e) => {
        const p = S.prog[e.url];
        const nm = e.name && !/s\d+\s?e\d+|\d+x\d+/i.test(e.name) ? e.name : 'Episódio ' + e.e;
        const r = h('div', 'f ep', '<b>' + e.e + '</b><span>' + esc(nm) + '</span>' + (p ? (p.done ? '<i>✓ visto</i>' : '<i>' + fmt(p.t) + '</i>') : '') +
          (p && p.d && !p.done ? '<div class="pbar"><i style="width:' + Math.min(100, Math.round(100 * p.t / p.d)) + '%"></i></div>' : ''));
        r.onok = () => play(it, e, { eps, back: () => { setPlay(); renderEps(); first(); } });
        list.appendChild(r);
      });
      epBox.appendChild(list);
    }
    setPlay();
    // episódios Xtream sob demanda
    const xs = it.kind === 's' && eps.length === 1 && /\.xs$/.test(eps[0].url);
    if (xs) {
      const loadEps = () => {
        epBox.innerHTML = '<div class="busy">Carregando episódios…</div>';
        X.episodes(it.eps[0].url).then((l) => {
          eps.length = 0; for (const e of l) eps.push(e);
          if (!eps.length) epBox.innerHTML = '<p class="muted">O servidor não tem episódios para esta série.</p>';
          else { setPlay(); renderEps(); }
        }).catch((e) => {
          epBox.innerHTML = '<p class="muted">Não consegui carregar os episódios: ' + esc(e.message) + '</p>';
          const b = h('div', 'f btn', '↻ Tentar de novo'); b.onok = loadEps; epBox.appendChild(b);
        });
      };
      loadEps();
    } else renderEps();
    // capa e sinopse
    const k = it.key;
    const apply = (inf) => {
      if (!inf) { ov.textContent = ''; return; }
      if (inf.ov) ov.textContent = inf.ov; else ov.textContent = '';
      if (inf.img) { const o = poster.querySelector('img'); if (o) o.remove(); poster.appendChild(img(inf.img)); bg.style.backgroundImage = 'url("' + inf.img.replace(/"/g, '%22') + '")'; }
      meta.textContent = [inf.y || yearOf(it.title), inf.r ? '★ ' + inf.r.toFixed(1) : '', inf.genre, quality(it.title)].filter(Boolean).join(' · ');
    };
    if (it.logo) bg.style.backgroundImage = 'url("' + it.logo.replace(/"/g, '%22') + '")';
    if (infoCache.has(k)) apply(infoCache.get(k));
    else X.info(it).then((inf) => { infoCache.set(k, inf); if (inf && inf.img) Covers.put(it, inf.img); apply(inf); }).catch(() => apply(null));
    first(L);
  });
}

function groupDialog(it) {
  const gs = groups();
  const items = Object.keys(gs).map((n) => ({ name: (gs[n].indexOf(it.key) >= 0 ? '✓ ' : '') + n, g: n }));
  items.push({ name: '＋ Novo grupo…', nw: true });
  pick('Adicionar a um grupo', items, (x) => {
    if (x.nw) return prompt1('Nome do novo grupo', '', (n) => { n = n.trim(); if (!n) return; groupAdd(n, it.key); toast('Adicionado a "' + n + '"'); });
    const added = groupAdd(x.g, it.key); toast(added ? 'Adicionado a "' + x.g + '"' : 'Removido de "' + x.g + '"');
  });
}

// ---------------------------------------------------------------- busca (só filmes, séries e animes, como na TV 1.10.6)
function showSearch() {
  pushView((L) => {
    L.classList.add('search');
    const inp = h('input', 'f inp autof'); inp.placeholder = 'Digite o nome do filme ou série'; inp.type = 'text';
    const top = h('div', 'shead'); top.appendChild(inp); L.appendChild(top);
    const res = h('div', 'scroll gridwrap'); L.appendChild(res);
    let t = null;
    const run = () => {
      const q = norm(inp.value);
      res.innerHTML = '';
      if (q.length < 2) { res.appendChild(h('div', 'empty', 'Digite pelo menos 2 letras.')); return; }
      const ws = q.split(' ');
      const hit = (i) => { const n = i.norm; return ws.every((w) => n.indexOf(w) >= 0); };
      const l = S.lib.movies.filter(hit).concat(S.lib.series.filter(hit)).slice(0, 600);
      res.appendChild(grid(l, null, 'Nada encontrado para "' + inp.value + '".'));
    };
    inp.oninput = () => { clearTimeout(t); t = setTimeout(run, 400); };
    inp.onenter = () => { run(); const c = res.querySelector('.card'); if (c) focus(c); };
    run();
    first(L);
  });
}

// ---------------------------------------------------------------- caixas genéricas
function modal(build) {
  const prev = current();
  const m = h('div', 'layer open modal');
  const box = h('div', 'box'); m.appendChild(box);
  $('#modals').appendChild(m);
  const un = pushKeys((e, k) => { if (!document.body.contains(m)) { un(); return false; } if (k === K.BACK || k === K.ESC || k === K.BKSP) { close(); return true; } return false; });
  function close() { un(); m.remove(); if (prev && document.body.contains(prev)) focus(prev); else first(); }
  build(box, close);
  first(m);
  return close;
}
function pick(title, items, onpick) {
  modal((box, close) => {
    box.appendChild(h('h2', '', esc(title)));
    const l = h('div', 'plist scroll');
    items.forEach((x) => { const b = h('div', 'f row', esc(x.name)); b.onok = () => { close(); onpick(x); }; l.appendChild(b); });
    box.appendChild(l);
  });
}
function confirmBox(msg, yes) {
  modal((box, close) => {
    box.appendChild(h('p', '', esc(msg)));
    const r = h('div', 'dbtns');
    const a = h('div', 'f btn autof', 'Cancelar'); a.onok = close;
    const b = h('div', 'f btn danger', 'Confirmar'); b.onok = () => { close(); yes(); };
    r.appendChild(a); r.appendChild(b); box.appendChild(r);
  });
}
function prompt1(title, val, ok) {
  modal((box, close) => {
    box.appendChild(h('h2', '', esc(title)));
    const i = h('input', 'f inp autof'); i.value = val || ''; box.appendChild(i);
    const b = h('div', 'f btn', 'OK'); b.onok = () => { close(); ok(i.value); }; i.onenter = () => focus(b);
    box.appendChild(b);
  });
}

// ---------------------------------------------------------------- QR
export function qr(text, cell) {
  try {
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const d = h('div', 'qr'); d.innerHTML = q.createSvgTag(cell || 5, 2); return d;
  } catch (e) { return h('div', ''); }
}
function contactBox() {
  const w = h('div', 'contact');
  w.appendChild(qr('https://wa.me/' + WHATS, 4));
  w.appendChild(h('div', '', '<b>Peça seu acesso ao aplicativo</b><br>WhatsApp (42) 92002-8569'));
  return w;
}

// ---------------------------------------------------------------- ☰ Listas (conta, listas, preferências)
function showLists() {
  modal((box, close) => {
    box.classList.add('wide');
    const sc = h('div', 'scroll lists'); box.appendChild(sc);
    const vals = {};
    const render = () => {
      const ae = document.activeElement;
      if (ae && ae.tagName === 'INPUT' && sc.contains(ae)) return; // não apaga o que está sendo digitado
      const keep = current() && current().id;
      sc.querySelectorAll('input').forEach((i) => { vals[i.id] = i.value; });
      sc.innerHTML = '';
      // conta
      const a = Store.acct;
      const acc = h('div', 'panel');
      acc.appendChild(h('h2', '', '☁ Conta NTPlay'));
      acc.appendChild(h('p', '', 'Usuário: <b>' + esc(a.user) + '</b> · ' + esc(accessText()) + (S.syncMsg ? '<br><span class="muted">' + esc(S.syncMsg) + '</span>' : '')));
      const r1 = h('div', 'dbtns');
      const bsync = h('div', 'f btn', S.syncBusy ? 'Sincronizando…' : '↻ Sincronizar agora'); bsync.id = 'l-sync'; bsync.onok = () => syncNow(true);
      const bout = h('div', 'f btn danger', 'Sair da conta'); bout.onok = () => confirmBox('Sair da conta nesta TV?', () => { close(); logout(); });
      r1.appendChild(bsync); r1.appendChild(bout); acc.appendChild(r1);
      sc.appendChild(acc);
      // listas
      const pl = h('div', 'panel');
      pl.appendChild(h('h2', '', 'Minhas listas'));
      const lib = S.lib;
      pl.appendChild(h('p', 'muted', 'Na biblioteca: ' + lib.live.length + ' canais · ' + lib.movies.length + ' filmes · ' + lib.series.length + ' séries'));
      if (S.busy) pl.appendChild(h('div', 'busy', esc(S.status || 'Carregando…')));
      for (const l of Store.lists()) {
        const ai = S.acctInfo[l.id];
        let badge = '';
        if (ai) {
          const days = ai.exp ? Math.floor((ai.exp - Date.now()) / 86400000) : null;
          const cls = days == null ? '' : days < 0 ? 'red' : days <= 7 ? 'yellow' : 'green';
          badge = '<span class="badge ' + cls + '">' + (days == null ? 'sem vencimento' : days < 0 ? 'vencida' : 'vence em ' + days + ' dias') + ' · telas ' + ai.active + '/' + ai.maxCon + '</span>';
        }
        const row = h('div', 'lrow', '<div><b>' + esc(l.name) + '</b> ' + badge + '<br><small class="muted">' + esc(l.url.replace(/password=[^&]*/, 'password=•••')) + '</small></div>');
        const bt = h('div', 'lbtns');
        const t = h('div', 'f btn sm', l.active ? '● Ligada' : '○ Desligada'); t.id = 'l-t-' + l.id; t.onok = async () => { await toggleList(l.id); render(); };
        const u = h('div', 'f btn sm', '↻ Atualizar'); u.id = 'l-u-' + l.id; u.onok = () => refreshList(l.id);
        const d = h('div', 'f btn sm danger', 'Excluir'); d.onok = () => confirmBox('Excluir a lista "' + l.name + '"?', async () => { await deleteList(l.id); render(); });
        bt.appendChild(t); bt.appendChild(u); bt.appendChild(d); row.appendChild(bt); pl.appendChild(row);
      }
      for (const pd of Store.pending) {
        const row = h('div', 'lrow', '<div><b>' + esc(pd.name || 'Lista') + '</b> <span class="badge red">não baixou nesta TV</span><br><small class="muted">' + esc((pd.err || '').slice(0, 140)) + '</small></div>');
        const bt = h('div', 'lbtns');
        const t = h('div', 'f btn sm', '↻ Tentar de novo'); t.onok = async () => { await retryPending(pd.url); render(); };
        const d = h('div', 'f btn sm danger', 'Excluir'); d.onok = () => confirmBox('Excluir "' + (pd.name || 'lista') + '"? Ela some da nuvem e da TV Android também.', () => { dropPending(pd.url); render(); });
        bt.appendChild(t); bt.appendChild(d); row.appendChild(bt); pl.appendChild(row);
      }
      sc.appendChild(pl);
      // adicionar
      const ad = h('div', 'panel');
      ad.appendChild(h('h2', '', 'Adicionar lista'));
      ad.appendChild(h('p', 'muted', 'O NTPlay é só um reprodutor: não vende nem fornece canais, filmes ou listas. Use apenas listas e conteúdos que você tem direito de assistir.'));
      ad.appendChild(h('p', 'muted', 'Xtream Codes (servidor, usuário e senha):'));
      const xs = h('input', 'f inp'); xs.placeholder = 'Servidor (ex.: http://meuservidor.com:8080)';
      const xu = h('input', 'f inp half'); xu.placeholder = 'Usuário';
      const xp = h('input', 'f inp half'); xp.placeholder = 'Senha';
      [[xs, 'x-s'], [xu, 'x-u'], [xp, 'x-p']].forEach(([i, id]) => { i.id = id; i.value = vals[id] || ''; });
      const xb = h('div', 'f btn', '＋ Adicionar Xtream'); xb.id = 'x-b';
      xb.onok = async () => { if (await addXtream(xs.value, xu.value, xp.value)) { vals['x-s'] = vals['x-u'] = vals['x-p'] = ''; xs.value = xu.value = xp.value = ''; loadAccounts(); render(); } };
      ad.appendChild(xs); ad.appendChild(xu); ad.appendChild(xp); ad.appendChild(xb);
      ad.appendChild(h('p', 'muted', 'Ou link M3U:'));
      const mu = h('input', 'f inp'); mu.placeholder = 'http://…/lista.m3u';
      mu.id = 'm-u'; mu.value = vals['m-u'] || '';
      const mb = h('div', 'f btn', '＋ Adicionar M3U'); mb.id = 'm-b';
      mb.onok = async () => { if (await addUrl(mu.value)) { vals['m-u'] = ''; mu.value = ''; loadAccounts(); render(); } };
      mu.onenter = () => focus(mb);
      ad.appendChild(mu); ad.appendChild(mb);
      if (S.lastErr) ad.appendChild(h('p', 'err', esc(S.lastErr)));
      sc.appendChild(ad);
      // preferências
      const pf = h('div', 'panel');
      pf.appendChild(h('h2', '', 'Preferências'));
      const p = Store.prefs;
      const opt = (label, key, vals, after) => {
        const cur = vals.find((v) => v[0] === p[key]) || vals[0];
        const b = h('div', 'f btn sm', esc(label) + ': <b>' + esc(cur[1]) + '</b>'); b.id = 'p-' + key;
        b.onok = async () => { const i = vals.indexOf(cur); const nx = vals[(i + 1) % vals.length]; const q = Store.prefs; q[key] = nx[0]; Store.prefs = q; if (after) await after(); render(); };
        pf.appendChild(b);
      };
      const yn = [[false, 'Não'], [true, 'Sim']];
      opt('Mostrar conteúdo adulto', 'adult', yn, reload);
      opt('Próximo episódio automático', 'autoNext', [[true, 'Sim'], [false, 'Não']]);
      opt('Pular abertura avança', 'skipIntro', [[85, '85 s'], [60, '60 s'], [100, '100 s'], [120, '120 s']]);
      opt('Atualizar listas ao abrir', 'updOpen', yn);
      opt('Atualização automática', 'autoUpd', [[0, 'Desligada'], [6, '6 h'], [12, '12 h'], [24, '24 h']]);
      opt('Nomes em Base64 (Xtream)', 'b64', yn, reload);
      opt('Adulto pelo nome da categoria', 'adultByName', [[true, 'Sim'], [false, 'Não']], reload);
      sc.appendChild(pf);
      const ct = h('div', 'panel'); ct.appendChild(contactBox()); sc.appendChild(ct);
      const cl = h('div', 'f btn', 'Fechar'); cl.onok = close; sc.appendChild(cl);
      const k = keep && document.getElementById(keep);
      if (k) focus(k); else first(box);
    };
    render();
    loadAccounts();
    const off = (w) => { if (document.body.contains(sc) && (w === 'busy' || w === 'acct' || w === 'sync' || w === 'lib')) render(); };
    S.on(off);
  });
}

// ---------------------------------------------------------------- tela de entrada
export function renderLogin() {
  closeAllViews();
  const app = $('#app');
  app.innerHTML = '';
  const w = h('div', 'login');
  const l = h('div', 'lcol');
  l.appendChild(h('img', 'biglogo')).src = 'img/logo.png';
  l.appendChild(h('h1', '', 'Entrar no NTPlay'));
  const u = h('input', 'f inp autof'); u.placeholder = 'Usuário'; u.autocapitalize = 'off';
  const p = h('input', 'f inp'); p.placeholder = 'Senha'; p.type = 'password';
  const b = h('div', 'f btn big', S.syncBusy ? 'Entrando…' : 'Entrar');
  b.onok = () => login(u.value, p.value);
  u.onenter = () => focus(p); p.onenter = () => focus(b);
  l.appendChild(u); l.appendChild(p); l.appendChild(b);
  l.appendChild(h('p', 'err', esc(S.accessMsg)));
  w.appendChild(l);
  const r = h('div', 'rcol');
  r.appendChild(contactBox());
  r.appendChild(h('p', 'muted', 'O NTPlay é só um reprodutor de listas M3U/Xtream. Não fornece canais, filmes nem listas.'));
  r.appendChild(h('p', 'muted', 'O acesso é liberado pelo administrador. Use o mesmo usuário e senha do NTPlay na TV Android: suas listas, favoritos e “continuar assistindo” vêm junto.'));
  w.appendChild(r);
  app.appendChild(w);
  first(app);
}

export function onState(w) {
  if (w && w.toast) return toast(w.toast);
  if (w === 'locked') {
    if (S.locked) { if (isOpen()) closePlayer(true); document.querySelectorAll('#modals .modal').forEach((m) => m.remove()); renderLogin(); }
    else if (!$('.top')) { renderApp(); first(); }
    else { const e = $('.login .err'); if (e) e.textContent = S.accessMsg; }
    return;
  }
  if (S.locked) { const e = $('.login .err'); if (e) e.textContent = S.accessMsg; return; }
  if (w === 'lib' || w === 'busy' || w === 'favs') {
    if (V.stack.length || isOpen() || document.querySelector('.modal')) return;
    const c = current(); const id = c && c.id; const k = c && c.dataset && c.dataset.k;
    renderApp();
    const el = (id && document.getElementById(id)) || (k && document.querySelector('[data-k="' + CSS_ESC(k) + '"]'));
    if (el) focus(el); else first();
  }
}
