// Capas que a lista não traz (ou que não abrem): só para cards que aparecem na tela, 3 de cada vez,
// guardadas no aparelho (não busca de novo). Ordem: servidor Xtream → iTunes (filmes) / TVMaze (séries).
import { Idb } from './store.js';
import { getQuick as getQ } from './net.js';
import * as X from './xtream.js';
import { cleanT, yearOf, norm } from './util.js';

let cache = null, dirty = false, saveT = null;
const queue = [], waiting = new Map(); // key -> [callbacks]
let running = 0;

export const init = () => loadCache();
async function loadCache() {
  if (cache) return;
  try { cache = (await Idb.get('cache', 'covers3')) || {}; } catch (e) { cache = {}; }
}
function save() {
  dirty = true; clearTimeout(saveT);
  saveT = setTimeout(() => {
    const ks = Object.keys(cache);
    if (ks.length > 5000) { ks.sort((a, b) => cache[a].t - cache[b].t); for (const k of ks.slice(0, ks.length - 5000)) delete cache[k]; }
    Idb.put('cache', 'covers3', cache).catch(() => {}); dirty = false;
  }, 3000);
}
const DAY = 86400000;

/** capa já conhecida (síncrono, para desenhar o card de uma vez) */
export function known(it) { const c = cache && cache[it.key]; return c && c.u ? c.u : ''; }

/** pede a capa; cb(url) quando achar */
export function want(it, cb) {
  loadCache().then(() => {
    const c = cache[it.key];
    if (c && (c.u || Date.now() - c.t < DAY)) { if (c.u) cb(c.u); return; } // "não achei" vale 1 dia
    const w = waiting.get(it.key);
    if (w) { w.push(cb); return; }
    waiting.set(it.key, [cb]); queue.push(it); pump();
  });
}
/** a capa veio de outro lugar (tela de detalhes) */
export function put(it, url) { if (!url || !cache) return; cache[it.key] = { u: url, t: Date.now() }; save(); }

function pump() {
  while (running < 4 && queue.length) {
    const it = queue.pop(); // o último pedido é o que está na tela agora
    running++;
    const st = { net: false };
    find(it, st).catch(() => '').then((u) => {
      running--;
      // sem resposta de nenhuma fonte (sem internet/site bloqueado na TV): não marca "não achei"
      if (u || st.net) { cache[it.key] = { u: u || '', t: Date.now() }; save(); }
      const cbs = waiting.get(it.key) || []; waiting.delete(it.key);
      if (u) for (const f of cbs) try { f(u); } catch (e) {}
      pump();
    });
  }
}

// títulos iguais nos DOIS sentidos ("A Fera" não pode casar com "A Bela e a Fera"); números precisam bater
const STOPW = new Set(['a', 'o', 'as', 'os', 'e', 'de', 'do', 'da', 'dos', 'das', 'the', 'of', 'and', 'um', 'uma']);
function sameT(a, b) {
  const x = norm(a), y = norm(b); if (!x || !y) return false; if (x === y) return true;
  const wa = x.split(' ').filter((w) => !STOPW.has(w)), wb = y.split(' ').filter((w) => !STOPW.has(w));
  if (!wa.length || !wb.length) return false;
  const inB = wa.filter((w) => wb.indexOf(w) >= 0).length, inA = wb.filter((w) => wa.indexOf(w) >= 0).length;
  const nums = (l) => l.filter((w) => /^\d+$/.test(w) && w.length < 4).join(',');
  if (nums(wa) !== nums(wb)) return false;
  return inB / wa.length >= 0.85 && inA / wb.length >= 0.85;
}

// confirma que a imagem abre de verdade antes de aceitar (o servidor Xtream às vezes devolve link quebrado)
function imgOk(u) {
  return new Promise((res) => {
    if (!u) return res(false);
    const im = new Image(); const t = setTimeout(() => res(false), 8000);
    im.onload = () => { clearTimeout(t); res(im.naturalWidth > 2); };
    im.onerror = () => { clearTimeout(t); res(false); };
    im.src = u;
  });
}
const viaProxy = (u) => 'https://images.weserv.nl/?w=360&we&output=jpg&url=' + encodeURIComponent(u.replace(/^https?:\/\//, ''));
async function good(u) { if (!u) return ''; if (await imgOk(u)) return u; const p = viaProxy(u); return (await imgOk(p)) ? p : ''; }

async function find(it, st) {
  let u = '';
  try { const i = await X.info(it); if (i) st.net = true; if (i && i.img) u = await good(i.img); } catch (e) {}
  if (u) return u;
  u = await find2(it, st);
  return good(u);
}
async function find2(it, st) {
  const getQuick = async (url) => { const t = await getQ(url); if (t) st.net = true; return t; };
  let t = cleanT(it.title).replace(/^\d+\s*-\s*/, '').replace(/\s*-\s*\d{4}$/, '').trim();
  if (it.kind === 'l') t = t.replace(/\b(sd|hd|fhd|uhd|4k|h265|hevc|alt|24h)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const y = yearOf(it.title);
  if (!t) return '';
  if (it.kind === 's') {
    const txt = await getQuick('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(t));
    if (txt) {
      for (const r of JSON.parse(txt) || []) {
        const s = r.show; if (!s || !s.image || !sameT(t, s.name || '')) continue;
        if (y && s.premiered && Math.abs(+s.premiered.slice(0, 4) - +y) > 1) continue;
        return s.image.medium || s.image.original || '';
      }
    }
  }
  const w = await wiki(it, st);
  return w ? w.img : '';
}

const clean = (it) => cleanT(it.title).replace(/^\d+\s*-\s*/, '').replace(/\s*-\s*\d{4}$/, '')
  .replace(it.kind === 'l' ? /\b(sd|hd|fhd|uhd|4k|h265|hevc|alt|24h)\b/gi : /$^/, ' ').replace(/\s+/g, ' ').trim();
const wcache = new Map();
/** Wikipédia (pt, depois en): capa e resumo do artigo cujo título bate com o nome. {img, ov, lang} ou null */
export async function wiki(it, st) {
  const t = clean(it); if (!t) return null;
  if (wcache.has(it.key)) return wcache.get(it.key);
  const y = yearOf(it.title);
  // título de uma palavra só e sem ano ("A Fera", "A Baleia", "Fragmentado") casa com o filme errado com frequência
  if (!y && it.kind !== 'l' && norm(t).split(' ').filter((w) => !STOPW.has(w)).length < 2) { wcache.set(it.key, null); return null; }
  const hint = it.kind === 'm' ? ['filme', 'film'] : it.kind === 's' ? ['série', 'series'] : ['canal de televisão', 'tv channel'];
  let found = null;
  for (const [lang, h] of [['pt', hint[0]], ['en', hint[1]]]) {
    const txt = await getQ('https://' + lang + '.wikipedia.org/w/api.php?origin=*&format=json&action=query&generator=search&gsrlimit=6&gsrsearch=' +
      encodeURIComponent(t + ' ' + (y ? y + ' ' : '') + h) + '&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=300&exintro=1&explaintext=1&exsentences=4&exlimit=6');
    if (!txt) continue;
    if (st) st.net = true;
    let pages = [];
    try { const q = JSON.parse(txt).query; pages = q && q.pages ? Object.keys(q.pages).map((k) => q.pages[k]).sort((a, b) => (a.index || 0) - (b.index || 0)) : []; } catch (e) {}
    for (const p of pages) {
      const name = (p.title || '').replace(/\s*\(.*?\)\s*$/, '');
      if (!sameT(t, name)) continue;
      // com ano no nome, o artigo precisa citar o ano (evita o livro, o remake ou outro filme de mesmo nome)
      if (y && p.extract && !(new RegExp('\\b(' + (+y - 1) + '|' + y + '|' + (+y + 1) + ')\\b')).test(p.extract)) continue;
      const f = { img: p.thumbnail && p.thumbnail.source ? p.thumbnail.source : '', ov: lang === 'pt' && p.extract ? p.extract.trim() : '', lang };
      if (!found) found = f; else { if (!found.img) found.img = f.img; if (!found.ov) found.ov = f.ov; }
      break;
    }
    if (found && found.img && found.ov) break;
  }
  wcache.set(it.key, found);
  return found;
}
/** resumo de série pelo TVMaze (em inglês), quando a Wikipédia não tem */
export async function tvmazeSummary(it) {
  const t = clean(it); if (!t) return '';
  const txt = await getQ('https://api.tvmaze.com/singlesearch/shows?q=' + encodeURIComponent(t));
  if (!txt) return '';
  try { const s = JSON.parse(txt); if (!sameT(t, s.name || '')) return ''; return (s.summary || '').replace(/<[^>]+>/g, '').trim(); } catch (e) { return ''; }
}
