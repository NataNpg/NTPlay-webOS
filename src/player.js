// Player: <video> nativo do webOS (HLS, MP4, MKV, TS) com hls.js e mpegts.js como alternativas.
import { S, saveProg, resumeOf, toggleFav } from './state.js';
import { Store } from './store.js';
import { focus, first, pushKeys, K, current } from './nav.js';
import { esc, fmt, hhmm } from './util.js';
import * as X from './xtream.js';

let P = null; // sessão atual
const $ = (s, r) => (r || document).querySelector(s);

function engines(url, live) {
  const u = url.toLowerCase().split('?')[0];
  const hasMse = !!window.MediaSource;
  const out = [];
  if (u.endsWith('.m3u8')) { out.push(['native', url]); if (hasMse && window.Hls && Hls.isSupported()) out.push(['hls', url]); if (live) out.push(['mpegts', url.replace(/\.m3u8(\?|$)/i, '.ts$1')]); }
  else if (live) {
    // TV LG de verdade: o player nativo do webOS toca TS com o decodificador da TV e mantém áudio e vídeo juntos.
    // O mpegts.js (JavaScript) fica de reserva — é ele que roda no simulador/PC e pode atrasar o áudio.
    const onTv = !!(window.PalmSystem || window.webOSSystem) && !/Simulator/i.test(navigator.userAgent);
    if (onTv) out.push(['native', url]);
    if (hasMse && window.mpegts && mpegts.getFeatureList().mseLivePlayback) out.push(['mpegts', url]);
    if (!onTv) out.push(['native', url]);
    if (u.endsWith('.ts')) { const h = url.replace(/\.ts(\?|$)/i, '.m3u8$1'); out.push(['native', h]); if (hasMse && window.Hls && Hls.isSupported()) out.push(['hls', h]); }
  } else {
    out.push(['native', url]);
    // filme/episódio de servidor Xtream: o mesmo id costuma existir em outros formatos.
    // Quando o arquivo é MKV/AVI ou o áudio é AC3, o .m3u8/.ts do servidor ainda pode tocar.
    const x = /^(https?:\/\/[^/]+\/(?:movie|series)\/[^/]+\/[^/]+\/\d+)\.([a-z0-9]+)(\?.*)?$/i.exec(url);
    if (x && x[2].toLowerCase() !== 'xs') {
      const ext = x[2].toLowerCase(), q = x[3] || '';
      if (ext !== 'm3u8') { out.push(['native', x[1] + '.m3u8' + q]); if (hasMse && window.Hls && Hls.isSupported()) out.push(['hls', x[1] + '.m3u8' + q]); }
      if (ext !== 'mp4') out.push(['native', x[1] + '.mp4' + q]);
      if (ext !== 'ts' && hasMse && window.mpegts) out.push(['mpegtsvod', x[1] + '.ts' + q]);
    } else if (hasMse && window.Hls && Hls.isSupported() && /m3u8/i.test(u)) out.push(['hls', url]);
  }
  return out;
}

function stopEngine() {
  if (!P) return;
  clearTimeout(P.watch);
  const v = P.v;
  try { if (P.hls) P.hls.destroy(); } catch (e) {}
  try { if (P.mp) { P.mp.pause(); P.mp.unload(); P.mp.detachMediaElement(); P.mp.destroy(); } } catch (e) {}
  P.hls = null; P.mp = null;
  try { v.removeAttribute('src'); v.load(); } catch (e) {}
}

function tryEngine(i, startAt) {
  stopEngine();
  if (!P) return;
  if (i >= P.eng.length) return fail();
  P.ei = i; P.started = false;
  const [kind, url] = P.eng[i];
  const v = P.v;
  setStatus(P.live && P.retries ? 'Reconectando… (' + P.retries + ')' : 'Carregando…');
  if (kind === 'native') { v.src = url; }
  else if (kind === 'hls') {
    const h = new Hls({ maxBufferLength: P.live ? 30 : 60, liveSyncDurationCount: 4, manifestLoadingTimeOut: 20000, fragLoadingTimeOut: 30000 });
    P.hls = h; h.loadSource(url); h.attachMedia(v);
    h.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) next('hls: ' + d.details); });
    h.on(Hls.Events.MANIFEST_PARSED, () => { tracksChanged(); });
  } else if (kind === 'mpegts' || kind === 'mpegtsvod') {
    const p = mpegts.createPlayer({ type: 'mpegts', isLive: kind === 'mpegts', url }, { enableWorker: false, lazyLoad: false, liveBufferLatencyChasing: false, autoCleanupSourceBuffer: true, fixAudioTimestampGap: false, accurateSeek: true });
    P.mp = p; p.attachMediaElement(v); p.load();
    p.on(mpegts.Events.ERROR, (t, d) => { if (P && P.started) reconnect('mpegts: ' + d); else next('mpegts: ' + d); });
    // servidor que entrega o canal em pedaços e fecha a conexão: reconecta na hora
    p.on(mpegts.Events.LOADING_COMPLETE, () => { if (P && P.live && kind === 'mpegts') reconnect('fim do pedaço'); });
  }
  if (startAt > 0) {
    const seek = () => { v.removeEventListener('loadedmetadata', seek); try { v.currentTime = startAt / 1000; } catch (e) {} };
    v.addEventListener('loadedmetadata', seek);
  }
  const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
  P.watch = setTimeout(() => { if (P && !P.started) next('sem imagem em ' + (P.live ? 15 : 30) + ' s'); }, P.live ? 15000 : 30000);
}
const ERR = { 1: 'interrompido', 2: 'erro de rede/servidor', 3: 'erro ao decodificar', 4: 'formato não suportado ou servidor recusou' };
function next(why) {
  if (!P) return;
  const e = P.eng[P.ei]; const ex = (e[1].split('?')[0].match(/\.([a-z0-9]+)$/i) || [0, ''])[1];
  P.why.push(e[0].replace('mpegtsvod', 'mpegts') + (ex ? ' .' + ex : '') + ': ' + why);
  tryEngine(P.ei + 1, P.resumeAt);
}
function reconnect(why) {
  if (!P || !P.live) return;
  if (P.retries >= 8) return fail();
  P.retries++;
  setTimeout(() => { if (P) tryEngine(P.ei, 0); }, 800);
}
function fail() {
  if (!P) return;
  stopEngine();
  const why = P.why.join('\n');
  const ext = (P.ep.url.split('?')[0].match(/\.([a-z0-9]+)$/i) || [0, '?'])[1].toUpperCase();
  const sim = /Simulator|Electron/i.test(navigator.userAgent) || !(window.PalmSystem || window.webOSSystem);
  setStatus('Não foi possível reproduzir (arquivo ' + ext + ').' +
    (P.live ? ' O canal pode estar fora do ar ou a conta da lista já está em uso em outra tela.'
      : sim ? ' Você está no simulador/PC: ele não tem os decodificadores da TV LG (MKV, H.265, AC3/Dolby). Teste na TV.'
        : ' Esta TV não decodifica este arquivo (codec ou áudio), ou o servidor recusou o acesso.') +
    (why ? '\n' + why : ''), true);
  showUi(true);
}
function setStatus(t, err) {
  const s = $('#pl-status'); if (!s) return;
  s.textContent = t || ''; s.className = 'pl-status' + (t ? ' on' : '') + (err ? ' err' : '');
}

// ---------------------------------------------------------------- abrir / fechar
/** item + episódio; ctx.list = lista para trocar de canal/episódio */
export function play(item, ep, ctx) {
  close(true);
  const layer = $('#player');
  layer.innerHTML = '<video id="pl-v" autoplay></video><div id="pl-ui" class="pl-ui"></div><div id="pl-status" class="pl-status"></div><div id="pl-hint" class="pl-hint"></div><div id="pl-side" class="pl-side"></div>';
  layer.classList.add('open');
  const v = $('#pl-v');
  const live = item.kind === 'l';
  P = { item, ep, ctx: ctx || {}, v, live, eng: engines(ep.url, live), ei: 0, why: [], retries: 0, resumeAt: live ? 0 : resumeOf(ep), uiT: null, epg: [], hideAt: 0 };
  v.addEventListener('playing', () => { if (!P) return; P.started = true; P.retries = 0; clearTimeout(P.watch); setStatus(''); renderInfo(); });
  v.addEventListener('waiting', () => { if (P && P.started) setStatus('Carregando…'); });
  v.addEventListener('error', () => { if (!P) return; if (P.started && P.live) reconnect('erro de vídeo'); else if (!P.mp && !P.hls) next(v.error ? ERR[v.error.code] || 'erro ' + v.error.code : 'erro'); });
  v.addEventListener('ended', () => { if (!P) return; if (P.live) reconnect('fim'); else onEnded(); });
  v.addEventListener('timeupdate', onTime);
  v.addEventListener('loadedmetadata', tracksChanged);
  P.unkeys = pushKeys(onKey);
  if (P.resumeAt) hint('Continuando de ' + fmt(P.resumeAt));
  tryEngine(0, P.resumeAt);
  renderUi(); showUi(true);
  if (live) loadEpg();
}

export function close(silent) {
  if (!P) return;
  saveNow();
  stopEngine();
  if (P.unkeys) P.unkeys();
  clearInterval(P.epgT);
  const back = P.ctx.back;
  P = null;
  const layer = $('#player');
  layer.classList.remove('open'); layer.innerHTML = '';
  if (!silent && back) back();
}
export const isOpen = () => !!P;

function saveNow() {
  if (!P || P.live || !P.started) return;
  const v = P.v; const d = (v.duration || 0) * 1000;
  if (isFinite(d) && d > 0) saveProg(P.ep, P.item, v.currentTime * 1000, d);
}

// ---------------------------------------------------------------- tempo, abertura, próximo episódio
let lastSave = 0;
function onTime() {
  if (!P) return;
  const v = P.v, t = v.currentTime * 1000, d = v.duration * 1000;
  if (Date.now() - lastSave > 10000) { lastSave = Date.now(); saveNow(); }
  const bar = $('#pl-bar i'); if (bar && d > 0 && isFinite(d)) bar.style.width = (100 * t / d) + '%';
  const tm = $('#pl-time'); if (tm) tm.textContent = fmt(t) + (isFinite(d) && d > 0 ? ' / ' + fmt(d) : '');
  if (P.live || !isFinite(d) || d <= 0) return;
  // pular abertura
  const sk = $('#pl-skip');
  const mem = P.item.kind === 's' ? Store.intro[P.item.key] : null;
  let showSkip = false;
  if (mem) showSkip = t >= mem[0] - 3000 && t < mem[1] - 2000;
  else showSkip = P.item.kind === 's' && t > 3000 && t < 240000;
  if (sk) sk.style.display = showSkip ? '' : 'none';
  // próximo episódio
  const nx = nextEp();
  const nb = $('#pl-nextpop');
  if (nb) nb.style.display = nx && d - t < 40000 ? '' : 'none';
}
function skipIntro() {
  const v = P.v, t = v.currentTime * 1000;
  const mem = Store.intro[P.item.key];
  let to;
  if (mem && t < mem[1]) to = mem[1];
  else {
    to = t + (Store.prefs.skipIntro || 85) * 1000;
    const m = Store.intro; m[P.item.key] = [Math.round(t), Math.round(to)]; Store.intro = m;
  }
  v.currentTime = to / 1000; hint('Abertura pulada');
}
function nextEp() {
  if (!P || P.item.kind !== 's') return null;
  const eps = P.ctx.eps || P.item.eps; const i = eps.indexOf(P.ep);
  return i >= 0 && i < eps.length - 1 ? eps[i + 1] : null;
}
function goNext() {
  const n = nextEp(); if (!n) return;
  saveProg(P.ep, P.item, 0, 0, true);
  play(P.item, n, P.ctx);
}
function onEnded() {
  saveProg(P.ep, P.item, 0, 0, true);
  if (nextEp() && Store.prefs.autoNext) goNext(); else close();
}

// ---------------------------------------------------------------- canais
function zap(dir) {
  const list = P.ctx.list; if (!P.live || !list || list.length < 2) return;
  let i = list.indexOf(P.item); if (i < 0) i = 0;
  const it = list[(i + dir + list.length) % list.length];
  play(it, it.eps[0], P.ctx);
  hint(it.title);
}

// ---------------------------------------------------------------- guia (agora / a seguir)
async function loadEpg() {
  const me = P;
  const run = async () => {
    const l = await X.shortEpg(me.ep.url, 4);
    if (P !== me) return;
    P.epg = l; renderInfo();
  };
  run(); P.epgT = setInterval(run, 120000);
}

// ---------------------------------------------------------------- faixas
function tracksChanged() { /* só para atualizar os botões quando houver faixas */ }
function audioList() {
  if (P.hls) return P.hls.audioTracks.map((t, i) => ({ name: t.name || t.lang || 'Faixa ' + (i + 1), on: i === P.hls.audioTrack, set: () => { P.hls.audioTrack = i; } }));
  const at = P.v.audioTracks;
  if (at && at.length) { const o = []; for (let i = 0; i < at.length; i++) { const t = at[i]; o.push({ name: t.label || t.language || 'Faixa ' + (i + 1), on: t.enabled, set: () => { for (let j = 0; j < at.length; j++) at[j].enabled = j === i; } }); } return o; }
  return [];
}
function subList() {
  const o = [{ name: 'Desligada', on: true, set: () => {} }];
  if (P.hls && P.hls.subtitleTracks.length) {
    o[0] = { name: 'Desligada', on: P.hls.subtitleTrack < 0, set: () => { P.hls.subtitleTrack = -1; } };
    P.hls.subtitleTracks.forEach((t, i) => o.push({ name: t.name || t.lang || 'Legenda ' + (i + 1), on: P.hls.subtitleTrack === i, set: () => { P.hls.subtitleTrack = i; } }));
    return o;
  }
  const tt = P.v.textTracks;
  if (tt) for (let i = 0; i < tt.length; i++) {
    const t = tt[i]; if (t.mode === 'showing') o[0].on = false;
    o.push({ name: t.label || t.language || 'Legenda ' + (i + 1), on: t.mode === 'showing', set: () => { for (let j = 0; j < tt.length; j++) tt[j].mode = j === i ? 'showing' : 'disabled'; } });
  }
  if (tt) o[0].set = () => { for (let j = 0; j < tt.length; j++) tt[j].mode = 'disabled'; };
  return o;
}
function sidePick(title, items, onpick) {
  const s = $('#pl-side');
  s.innerHTML = '<h3>' + esc(title) + '</h3><div class="pl-list"></div>';
  const l = s.querySelector('.pl-list');
  let sel = null;
  items.forEach((it) => {
    const b = document.createElement('div'); b.className = 'f row' + (it.on ? ' on' : ''); b.innerHTML = esc(it.name);
    b.onok = () => { onpick(it); hideSide(); };
    l.appendChild(b); if (it.on && !sel) sel = b;
  });
  s.classList.add('open', 'layer');
  focus(sel || l.firstChild);
}
function hideSide() { const s = $('#pl-side'); if (s) { s.classList.remove('open', 'layer'); s.innerHTML = ''; } showUi(true); }

// ---------------------------------------------------------------- interface
function renderUi() {
  const ui = $('#pl-ui');
  const live = P.live;
  const btn = (id, t, extra) => '<div class="f pbtn" id="' + id + '"' + (extra || '') + '>' + t + '</div>';
  ui.innerHTML =
    '<div class="pl-top"><div class="pl-title"></div><div class="pl-epg"></div></div>' +
    '<div class="pl-bottom">' +
    (live ? '' : '<div class="pl-prog"><div id="pl-bar" class="pl-bar f" tabindex="-1"><i></i></div><span id="pl-time"></span></div>') +
    '<div class="pl-btns">' +
    (live ? btn('b-chdn', '▼ Canal') + btn('b-chup', '▲ Canal') + btn('b-chs', '📺 Canais')
      : btn('b-rw', '⏪ 10s') + btn('b-pp', '⏯', ' class="autof"') + btn('b-ff', '10s ⏩') + (P.item.kind === 's' ? btn('b-next', 'Próximo ⏭') : '')) +
    btn('b-sub', 'CC Legenda') + btn('b-aud', '🔊 Áudio') + btn('b-fav', S.favs.has(P.item.key) ? '★ Favorito' : '☆ Favoritar') + btn('b-exit', '✕ Sair') +
    '</div></div>' +
    (live ? '' : '<div class="f pbtn pl-skip" id="pl-skip" style="display:none">Pular abertura ⏩</div><div class="f pbtn pl-nextpop" id="pl-nextpop" style="display:none">Próximo episódio ⏭</div>');
  const on = (id, fn) => { const e = $('#' + id); if (e) e.onok = () => { fn(); showUi(true); }; };
  on('b-rw', () => seek(-10)); on('b-ff', () => seek(10)); on('b-pp', togglePause);
  on('b-next', goNext); on('b-chup', () => zap(1)); on('b-chdn', () => zap(-1));
  on('b-exit', () => close());
  on('b-fav', () => { const f = toggleFav(P.item.key); $('#b-fav').textContent = f ? '★ Favorito' : '☆ Favoritar'; hint(f ? 'Adicionado aos favoritos' : 'Removido dos favoritos'); });
  on('b-aud', () => { const l = audioList(); if (l.length < 2) return hint(l.length ? 'Só existe uma faixa de áudio' : 'A TV não informou as faixas de áudio'); sidePick('Áudio', l, (t) => t.set()); });
  on('b-sub', () => { const l = subList(); if (l.length < 2) return hint('Sem legendas neste vídeo'); sidePick('Legenda', l, (t) => t.set()); });
  on('b-chs', () => {
    const list = (P.ctx.list || []).slice(0, 400);
    sidePick('Canais', list.map((it) => ({ name: it.title, on: it === P.item, it })), (x) => play(x.it, x.it.eps[0], P.ctx));
  });
  const sk = $('#pl-skip'); if (sk) sk.onok = skipIntro;
  const np = $('#pl-nextpop'); if (np) np.onok = goNext;
  const bar = $('#pl-bar');
  if (bar) { bar.onleft = () => { seek(-10); return true; }; bar.onright = () => { seek(10); return true; }; bar.onok = togglePause; }
  renderInfo();
}
function renderInfo() {
  if (!P) return;
  const t = $('.pl-title'); if (!t) return;
  const v = P.v;
  const q = v.videoHeight ? ' · ' + (v.videoHeight >= 2000 ? '4K' : v.videoHeight >= 1000 ? 'Full HD ' + v.videoHeight + 'p' : v.videoHeight + 'p') : '';
  const sub = P.item.kind === 's' ? ' — T' + P.ep.s + ' E' + P.ep.e + (P.ep.name && !/^epis/i.test(P.ep.name) && !/s\d+\s?e\d+|\d+x\d+/i.test(P.ep.name) ? ' · ' + P.ep.name : '') : '';
  t.innerHTML = esc(P.item.title) + '<small>' + esc(sub) + esc(q) + '</small>';
  const e = $('.pl-epg');
  if (!e) return;
  if (!P.live || !P.epg.length) { e.innerHTML = ''; return; }
  const now = Date.now();
  const cur = P.epg.find((p) => p.start <= now && p.stop > now);
  const nx = P.epg.find((p) => p.start > now);
  let h = '';
  if (cur) h += '<div class="now"><b>Agora</b> ' + hhmm(cur.start) + '–' + hhmm(cur.stop) + ' · ' + esc(cur.title) + '<div class="epgbar"><i style="width:' + Math.round(100 * (now - cur.start) / (cur.stop - cur.start)) + '%"></i></div></div>';
  if (nx) h += '<div class="nxt"><b>A seguir</b> ' + hhmm(nx.start) + ' · ' + esc(nx.title) + '</div>';
  e.innerHTML = h;
}

function showUi(keepFocus) {
  if (!P) return;
  const ui = $('#pl-ui'); ui.classList.add('on');
  const side = $('#pl-side');
  if (!(side && side.classList.contains('open'))) {
    const c = current();
    if (!keepFocus || !c || !ui.contains(c)) first(ui);
  }
  clearTimeout(P.uiT);
  P.uiT = setTimeout(hideUi, 6000);
}
function hideUi() {
  if (!P) return;
  const side = $('#pl-side'); if (side && side.classList.contains('open')) return;
  if (!P.started) return; // com erro ou carregando, deixa os controles à vista
  $('#pl-ui').classList.remove('on');
}
const uiOn = () => P && $('#pl-ui').classList.contains('on');

function seek(s) {
  const v = P.v; if (P.live || !isFinite(v.duration)) return;
  v.currentTime = Math.max(0, Math.min(v.duration - 1, v.currentTime + s));
  onTime();
}
function togglePause() { const v = P.v; if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); hint('▶'); } else { v.pause(); hint('⏸'); } }
function hint(t) {
  const h = $('#pl-hint'); if (!h) return;
  h.textContent = t; h.classList.add('on');
  clearTimeout(hint.t); hint.t = setTimeout(() => h.classList.remove('on'), 2500);
}

function onKey(e, k) {
  if (!P) return false;
  const side = $('#pl-side');
  const sideOpen = side && side.classList.contains('open');
  if (k === K.BACK || k === K.ESC || k === K.BKSP) {
    if (sideOpen) { hideSide(); return true; }
    if (uiOn() && P.started) { $('#pl-ui').classList.remove('on'); return true; }
    close(); return true;
  }
  if (sideOpen) { clearTimeout(P.uiT); return false; }
  if (k === K.PLAY) { const p = P.v.play(); if (p && p.catch) p.catch(() => {}); return true; }
  if (k === K.PAUSE || k === K.PLAYPAUSE) { togglePause(); return true; }
  if (k === K.STOP) { close(); return true; }
  if (k === K.FF) { seek(30); return true; }
  if (k === K.RW) { seek(-30); return true; }
  if (k === K.CHUP) { zap(1); return true; }
  if (k === K.CHDOWN) { zap(-1); return true; }
  if (!uiOn()) {
    if (P.live && (k === K.UP || k === K.DOWN)) { zap(k === K.UP ? 1 : -1); return true; }
    if (!P.live && (k === K.LEFT || k === K.RIGHT)) { seek(k === K.LEFT ? -10 : 10); showUi(false); const b = $('#pl-bar'); if (b) focus(b); return true; }
    if ([K.OK, K.UP, K.DOWN, K.LEFT, K.RIGHT].indexOf(k) >= 0) { showUi(false); return true; }
    return false;
  }
  clearTimeout(P.uiT); P.uiT = setTimeout(hideUi, 6000);
  return false;
}
