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

// confirma que a imagem abre de verdade antes de aceitar (o servidor Xtream às vezes devolve link quebrado)
function imgOk(u) {
  return new Promise((res) => {
    if (!u) return res(false);
    const im = new Image(); const t = setTimeout(() => res(false), 10000);
    im.onload = () => { clearTimeout(t); res(im.naturalWidth > 2); };
    im.onerror = () => { clearTimeout(t); res(false); };
    im.src = u;
  });
}
const viaProxy = (u) => 'https://images.weserv.nl/?w=360&we&output=jpg&url=' + encodeURIComponent(u.replace(/^https?:\/\//, ''));
async function good(u) { if (!u) return ''; if (await imgOk(u)) return u; const p = viaProxy(u); return (await imgOk(p)) ? p : ''; }

async function find(it) {
  let u = '';
  try { const i = await X.info(it); if (i && i.img) u = await good(i.img); } catch (e) {}
  if (u) return u;
  u = await find2(it);
  return good(u);
}
async function find2(it) {
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
  // Wikipédia (pt, depois en): imagem principal do artigo cujo título bate com o nome
  const hint = it.kind === 'm' ? ['filme', 'film'] : it.kind === 's' ? ['série', 'series'] : ['canal de televisão', 'tv channel'];
  for (const [lang, h] of [['pt', hint[0]], ['en', hint[1]]]) {
    const txt = await getQuick('https://' + lang + '.wikipedia.org/w/api.php?origin=*&format=json&action=query&generator=search&gsrlimit=5&gsrsearch=' +
      encodeURIComponent(t + ' ' + (y ? y + ' ' : '') + h) + '&prop=pageimages&piprop=thumbnail&pithumbsize=300');
    if (!txt) continue;
    let pages = [];
    try { pages = Object.values((JSON.parse(txt).query || {}).pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0)); } catch (e) {}
    for (const p of pages) {
      const name = (p.title || '').replace(/\s*\(.*?\)\s*$/, '');
      if (p.thumbnail && p.thumbnail.source && sameT(t, name)) return p.thumbnail.source;
    }
  }
  return '';
}
