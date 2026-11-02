// Gera app/logos.json (nome do canal normalizado → logo) a partir da base pública do iptv-org.
// Uso: node tools/build-logos.mjs <pasta data do iptv-org/database>
// O arquivo vai junto no app: nada é baixado na TV, que só lê o mapa quando um canal não tem logo.
import { readFileSync, writeFileSync } from 'fs';
import { logoKey } from '../src/logokey.js';

const dir = process.argv[2] || '/tmp/iptvdb/data';
function csv(file) {
  const t = readFileSync(dir + '/' + file, 'utf8');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift();
  return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] || ''])));
}

// países que costumam aparecer nas listas brasileiras (o Brasil tem prioridade no nome repetido)
const KEEP = new Set(['BR', 'PT', 'US', 'GB', 'INT', 'AR', 'MX']);
const rank = (c) => (c === 'BR' ? 3 : c === 'PT' ? 2 : c === 'US' ? 1 : 0);

const logo = new Map();
for (const l of csv('logos.csv')) {
  if (!l.channel || !l.url || l.in_use === 'FALSE') continue;
  if (l.format && !/png|jpe?g|webp|svg/i.test(l.format)) continue;
  const o = logo.get(l.channel);
  if (!o || (o.feed && !l.feed) || (!o.feed === !l.feed && (+l.width || 0) > (+o.width || 0) && (+l.width || 0) <= 800)) logo.set(l.channel, l);
}
const out = new Map(); // key -> [url, rank]
for (const c of csv('channels.csv')) {
  if (c.closed || c.is_nsfw === 'TRUE' || !KEEP.has(c.country)) continue;
  const lg = logo.get(c.id); if (!lg) continue;
  const names = [c.name].concat(c.alt_names ? c.alt_names.split(';') : []);
  for (let i = 0; i < names.length; i++) {
    // nome oficial vale mais que apelido ("A&E" é apelido do AMC Break em Portugal)
    const r = rank(c.country) + (i === 0 ? 10 : 0);
    const k = logoKey(names[i]); if (k.length < 2) continue;
    const o = out.get(k);
    if (!o || r > o[1]) out.set(k, [lg.url, r]);
  }
}
// redes brasileiras cujo nome genérico não está na base
const ALIAS = { sbt: 'SBTNacional.br', record: 'Record.br', recordtv: 'Record.br', band: 'Band.br' };
for (const k of Object.keys(ALIAS)) { const lg = logo.get(ALIAS[k]); if (lg) out.set(k, [lg.url, 99]); }
// encurta os endereços mais comuns (o app expande): fica bem menor para a TV ler
const PFX = [['https://i.imgur.com/', '~i'], ['https://upload.wikimedia.org/wikipedia/', '~w'], ['https://raw.githubusercontent.com/', '~g']];
const obj = { _p: Object.fromEntries(PFX.map(([a, b]) => [b, a])) };
for (const [k, v] of Array.from(out.entries()).sort()) { let u = v[0].replace(/(\/thumb\/.+\/)\d{3,4}px-/, '$1330px-'); // miniatura de 330 px: leve para a TV
   for (const [a, b] of PFX) if (u.startsWith(a)) { u = b + u.slice(a.length); break; } obj[k] = u; }
writeFileSync('app/logos.json', JSON.stringify(obj));
console.log('logos.json:', out.size, 'canais,', Math.round(JSON.stringify(obj).length / 1024), 'KB');
