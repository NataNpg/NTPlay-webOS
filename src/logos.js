// Logos dos canais que a lista não traz (ou que não abrem): mapa do iptv-org que vai dentro do app
// (logos.json, gerado por tools/build-logos.mjs). Só é lido se algum canal precisar.
import { logoKey } from './logokey.js';

let map = null, loading = null;

function load() {
  if (map) return Promise.resolve(map);
  if (!loading) loading = fetch('logos.json').then((r) => r.json()).then((m) => { map = m; return m; }).catch(() => { map = {}; return map; });
  return loading;
}
function expand(u) {
  if (u && u[0] === '~') { const p = map._p && map._p[u.slice(0, 2)]; if (p) return p + u.slice(2); }
  return u || '';
}
export function find(name) {
  if (!map) return '';
  const k = logoKey(name);
  if (k.length < 2) return '';
  let u = map[k] || map[k.replace(/^canal/, '')] || map['canal' + k];
  if (!u) {
    // "Globo Bahia", "Band SP": tira palavras do fim até achar a rede ("Band")
    const w = String(name).replace(/\[.*?\]|\(.*?\)/g, ' ').split(/[\s|:\-]+/).filter(Boolean);
    while (!u && w.length > 1) { w.pop(); const kk = logoKey(w.join(' ')); if (kk.length >= 3) u = map[kk]; }
  }
  return expand(u);
}
/** completa os logos que faltam e guarda um reserva para quando o logo da lista não abrir */
export async function apply(lib) {
  if (!lib.live.length) return;
  await load();
  for (const it of lib.live) {
    const f = find(it.title);
    if (!f) continue;
    if (!it.logo) it.logo = f; else if (f !== it.logo) it.logoAlt = f;
  }
}
