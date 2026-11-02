// Utilitários — porta fiel de Util.kt (Android TV). As chaves dos itens precisam bater com a TV
// para favoritos, grupos e "continuar assistindo" funcionarem entre aparelhos pela nuvem.

export const UA_NOTE = 'webOS não deixa trocar o User-Agent (o navegador bloqueia esse cabeçalho).';

const diac = /[̀-ͯ]/g;
const paren = /\(.*?\)|\[.*?\]/g;
const words = /\b(dublado|legendado|dual|nacional|4k|fhd|uhd|hd|1080p|720p|web-?dl)\b/gi;
const non = /[^a-z0-9]+/g;
const ws = /\s+/g;
const adr = /\bxxx\b|adult|\+18|18\+|er[óo]tic|porn|sexy|sexo/i;
const ep1 = /^(.*?)[\s._\-–|:]*[\[(]?\b[sStT]\s?(\d{1,2})\s?[eExX]\s?(\d{1,3})\b/;
const ep2 = /^(.*?)[\s._\-–|:]*\b(\d{1,2})x(\d{1,3})\b/;
const serieG = /s[eé]rie|novela|anime|dorama|temporada/i;
const movieG = /filme|movie|vod|cinema|lan[çc]amento/i;
const kids = /kids|infantil|desenho|cartoon|baby|junior|gloob|nick|disney jr|gloobinho/i;
const animeR = /anime/i;
const cleanGr = /^\s*(filmes?|movies?|s[eé]ries?|series|vod|canais?)\s*[|:\->»]+\s*/i;
const crR = /crunchy\s*roll/i;
const fnR = /funimation/i;
const legR = /\b(leg|legendad[oa]s?)\b|\[l\]|\(l\)/i;
const dubR = /\b(dub|dublad[oa]s?|dual)\b|\[d\]|\(d\)/i;
const yrR = /\((\d{4})\)/;
const qR = /\b(4k|uhd|2160p|fhd|1080p|hd|720p|sd|h\.?265|hevc)\b/gi;
const b64re = /^[A-Za-z0-9+/]{8,}={0,2}$/;

export function norm(s) {
  let t = (s || '').toLowerCase();
  if (t.normalize) t = t.normalize('NFD');
  t = t.replace(diac, '').replace(paren, ' ').replace(words, ' ');
  return t.replace(non, ' ').trim();
}
export const cleanT = (s) => s.replace(paren, ' ').replace(words, ' ').replace(ws, ' ').trim();
export const yearOf = (s) => { const m = yrR.exec(s || ''); return m ? m[1] : ''; };
export function quality(s) {
  const f = new Set((s.match(qR) || []).map((x) => x.toLowerCase().replace('.', '')));
  const has = (a) => a.some((x) => f.has(x));
  const res = has(['4k', 'uhd', '2160p']) ? '4K' : has(['fhd', '1080p']) ? 'Full HD' : has(['hd', '720p']) ? 'HD' : f.has('sd') ? 'SD' : '';
  const c = has(['h265', 'hevc']) ? 'H.265' : '';
  return [res, c].filter(Boolean).join(' · ');
}
export const isAdult = (s) => adr.test(s);

export function maybeB64(s) {
  const t = (s || '').trim();
  if (t.length % 4 !== 0 || !b64re.test(t)) return s;
  try {
    const bin = atob(t);
    const d = decodeURIComponent(escape(bin));
    if (d.trim() && d.length >= 2 && !/[\x00-\x08\x0e-\x1f]/.test(d)) return d;
  } catch (e) {}
  return s;
}
export function b64txt(s) { // títulos do get_short_epg vêm em Base64
  try { return decodeURIComponent(escape(atob(s || ''))); } catch (e) { return s || ''; }
}
export function cleanG(g) {
  const r = g.replace(cleanGr, '').trim();
  return r || (g.trim() || 'Sem grupo');
}
export function epInfo(n) {
  const m = ep1.exec(n) || ep2.exec(n);
  if (!m) return null;
  return [m[1].trim() || n, parseInt(m[2], 10), parseInt(m[3], 10)];
}
/** 'l' = ao vivo, 'm' = filme, 's' = série */
export function guess(u, g, n) {
  const x = u.toLowerCase().split('?')[0];
  if (x.indexOf('/live/') >= 0) return 'l';
  if (epInfo(n)) return 's';
  if (x.indexOf('/series/') >= 0) return 's';
  if (x.indexOf('/movie/') >= 0) return 'm';
  if (serieG.test(g)) return 's';
  if (movieG.test(g) || /\.(mp4|mkv|avi)$/.test(x)) return 'm';
  return 'l';
}
export function animeSrc(it) { const s = it.group + ' ' + it.title; return crR.test(s) ? 'CR' : fnR.test(s) ? 'FN' : ''; }
export function audioTag(it) {
  const s = it.title + ' ' + it.group + ' ' + ((it.eps[0] && it.eps[0].name) || '');
  if (dubR.test(s)) return 'DUB';
  if (legR.test(s)) return 'LEG';
  return '';
}
export function theme(it) {
  const t = it.kind === 'l' ? it.group + ' ' + it.title : it.group;
  if (animeR.test(t) || (it.kind !== 'l' && animeSrc(it))) return 'ANIMES';
  if (kids.test(t)) return 'INFANTIL';
  return '';
}
export function fmt(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (x) => (x < 10 ? '0' : '') + x;
  return h > 0 ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
}
export const hhmm = (ms) => { const d = new Date(ms); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); };
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// igual ao URLEncoder do Java (a URL vira chave de favorito; precisa bater com a TV)
export const enc = (s) => encodeURIComponent(s).replace(/[!'()~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g, '+');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function uuid() {
  const a = crypto.getRandomValues(new Uint8Array(16));
  return Array.prototype.map.call(a, (x) => (x < 16 ? '0' : '') + x.toString(16)).join('');
}
