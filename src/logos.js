// Logos dos canais que a lista não traz (ou que não abrem): mapa do iptv-org que vai dentro do app
// (logos.json, gerado por tools/build-logos.mjs). Só é lido se algum canal precisar.
import { logoKey } from './logokey.js';

let map = null, loading = null;

function load() {
  if (map) return Promise.resolve(map);
  // fetch() não lê arquivo do próprio app (file://) no navegador da TV; XMLHttpRequest lê
  if (!loading) loading = new Promise((res) => {
    const x = new XMLHttpRequest();
    x.onload = () => { try { map = JSON.parse(x.responseText); } catch (e) { map = {}; } res(map); };
    x.onerror = () => { map = {}; res(map); };
    x.open('GET', 'logos.json'); x.send();
  });
  return loading;
}
function expand(u) {
  if (u && u[0] === '~') {
    // "~m<id>": cópia no GitHub Pages do projeto (o imgur não abre na TV)
    if (u[1] === 'm') return (map._p['~m'] || 'https://natanpg.github.io/NTPlay-webOS/l/') + u.slice(2) + '.webp';
    const p = map._p && map._p[u.slice(0, 2)]; if (p) return p + u.slice(2);
  }
  return u || '';
}
/** endereço original no imgur de um logo copiado (reserva se a cópia faltar) */
export function original(url) {
  const m = /\/NTPlay-webOS\/l\/([A-Za-z0-9]+)\.webp$/.exec(url || '');
  return m ? 'https://i.imgur.com/' + m[1] + '.png' : '';
}
/** devolve [logo, exato?] — exato = o nome do canal bate inteiro com a base */
// apelidos que as listas brasileiras usam e a base escreve diferente
const ALIAS = { discoveryhehealth: 'discoveryhomeehealthlatinamerica', discoveryhomehealth: 'discoveryhomeehealthlatinamerica', sony: 'sonychannel',
  studiouniversal: 'studiouniversallatinamerica', tntseries: 'tntserieslatinamerica', disneyjr: 'disneyjunior', warner: 'warnerchannel', universaltv: 'universal' };
const exact = (k) => map[k] || map[ALIAS[k]] || map[k.replace(/^canal/, '')] || map['canal' + k] || map[k + 'channel'] || map[k + 'latinamerica'];
export function find2(name) {
  if (!map) return ['', false];
  const k = logoKey(name);
  if (k.length < 2) return ['', false];
  const u = exact(k);
  return u ? [expand(u), true] : [find(name), false];
}
export function find(name) {
  if (!map) return '';
  const k = logoKey(name);
  if (k.length < 2) return '';
  let u = exact(k);
  if (!u) {
    // "Globo Bahia", "Band SP": tira palavras do fim até achar a rede ("Band")
    const w = String(name).replace(/\[.*?\]|\(.*?\)/g, ' ').split(/[\s|:\-]+/).filter(Boolean);
    while (!u && w.length > 1) { w.pop(); const kk = logoKey(w.join(' ')); if (kk.length >= 3) u = exact(kk); }
  }
  return expand(u);
}
/** completa os logos que faltam e guarda um reserva para quando o logo da lista não abrir */
export async function apply(lib) {
  if (!lib.live.length) return;
  await load();
  for (const it of lib.live) {
    const [f, exact] = find2(it.title);
    if (!f || f === it.logo) continue;
    it.logoOrig = original(f);
    if (!it.logo) it.logo = f;
    // logo da base com o nome exato do canal é conferido e leve: vem primeiro; o da lista fica de reserva.
    // Muitas listas trazem logo quebrado, lento ou transparente, que nunca dá erro e deixa o card vazio.
    else if (exact) { it.logoAlt = it.logo; it.logo = f; }
    else it.logoAlt = f;
  }
}
