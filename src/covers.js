// Capas que a lista não traz (ou que não abrem): só para cards que aparecem na tela, 3 de cada vez,
// guardadas no aparelho (não busca de novo). Ordem: servidor Xtream → iTunes (filmes) / TVMaze (séries).
import { Idb } from './store.js';
import { getQuick } from './net.js';
import * as X from './xtream.js';
import { cleanT, yearOf, norm } from './util.js';

let cache = null, dirty = false, saveT = null;
const queue = [], waiting = new Map(); // key -> [callbacks]
let running = 0;

export const init = () => loadCache();
async function loadCache() {
  if (cache) return;
  try { cache = (await Idb.get('cache', 'covers')) || {}; } catch (e) { cache = {}; }
}
function save() {
  dirty = true; clearTimeout(saveT);
  saveT = setTimeout(() => {
    const ks = Object.keys(cache);
    if (ks.length > 5000) { ks.sort((a, b) => cache[a].t - cache[b].t); for (const k of ks.slice(0, ks.length - 5000)) delete cache[k]; }
    Idb.put('cache', 'covers', cache).catch(() => {}); dirty = false;
  }, 3000);
}
const DAY = 86400000;

/** capa já conhecida (síncrono, para desenhar o card de uma vez) */
export function known(it) { const c = cache && cache[it.key]; return c && c.u ? c.u : ''; }

/** pede a capa; cb(url) quando achar */
export function want(it, cb) {
  if (it.kind === 'l') return;
  loadCache().then(() => {
    const c = cache[it.key];
    if (c && (c.u || Date.now() - c.t < 7 * DAY)) { if (c.u) cb(c.u); return; } // "não achei" vale 7 dias
    const w = waiting.get(it.key);
    if (w) { w.push(cb); return; }
    waiting.set(it.key, [cb]); queue.push(it); pump();
  });
}
/** a capa veio de outro lugar (tela de detalhes) */
export function put(it, url) { if (!url || !cache) return; cache[it.key] = { u: url, t: Date.now() }; save(); }

function pump() {
  while (running < 3 && queue.length) {
    const it = queue.pop(); // o último pedido é o que está na tela agora
    running++;
    find(it).catch(() => '').then((u) => {
      running--;
      cache[it.key] = { u: u || '', t: Date.now() }; save();
      const cbs = waiting.get(it.key) || []; waiting.delete(it.key);
      if (u) for (const f of cbs) try { f(u); } catch (e) {}
      pump();
    });
  }
}

const sameT = (a, b) => { const x = norm(a), y = norm(b); if (!x || !y) return false; if (x === y) return true; const wa = x.split(' '); const hit = wa.filter((w) => (' ' + y + ' ').indexOf(' ' + w + ' ') >= 0).length; return hit / wa.length >= 0.85; };

async function find(it) {
  try { const i = await X.info(it); if (i && i.img) return i.img; } catch (e) {}
  const t = cleanT(it.title).replace(/^\d+\s*-\s*/, '').replace(/\s*-\s*\d{4}$/, '').trim();
  const y = yearOf(it.title);
  if (!t) return '';
  if (it.kind === 'm') {
    const txt = await getQuick('https://itunes.apple.com/search?media=movie&entity=movie&country=BR&limit=8&term=' + encodeURIComponent(t));
    if (!txt) return '';
    let best = null;
    for (const r of (JSON.parse(txt).results || [])) {
      if (!r.artworkUrl100 || !sameT(t, r.trackName || '')) continue;
      const ry = (r.releaseDate || '').slice(0, 4);
      if (y && ry && Math.abs(+ry - +y) > 1) continue;
      best = r; break;
    }
    return best ? best.artworkUrl100.replace(/\/\d+x\d+bb\./, '/300x450bb.') : '';
  }
  const txt = await getQuick('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(t));
  if (!txt) return '';
  for (const r of JSON.parse(txt) || []) {
    const s = r.show; if (!s || !s.image || !sameT(t, s.name || '')) continue;
    if (y && s.premiered && Math.abs(+s.premiered.slice(0, 4) - +y) > 1) continue;
    return s.image.medium || s.image.original || '';
  }
  return '';
}
