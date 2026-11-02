// Copia os logos do imgur para o GitHub Pages do projeto (site/l/<id>.webp, no máximo 240x150).
// Motivo: o imgur não abre no navegador da TV/simulador da LG; o GitHub Pages abre e é rápido.
// Depois troca no app/logos.json os endereços do imgur que foram copiados por "~m<id>" (o app expande).
// Uso: node tools/mirror-logos.mjs <pasta de saída do site> <pasta de cache>
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import sharp from 'sharp';

const out = (process.argv[2] || 'site') + '/l';
const cache = process.argv[3] || '.logo-cache';
mkdirSync(out, { recursive: true }); mkdirSync(cache, { recursive: true });
const map = JSON.parse(readFileSync('app/logos.json', 'utf8'));
const ids = new Set();
for (const [k, u] of Object.entries(map)) if (k !== '_p' && typeof u === 'string' && u.startsWith('~i')) ids.add(u.slice(2).replace(/\.[a-z]+$/i, ''));
const list = Array.from(ids);
let ok = 0, fail = 0, i = 0;
const done = new Set();
async function one(id) {
  const c = cache + '/' + id + '.webp';
  if (!existsSync(c)) {
    let buf = null;
    for (let t = 0; t < 2 && !buf; t++) {
      try {
        const r = await fetch('https://i.imgur.com/' + id + '.png', { headers: { 'User-Agent': 'Mozilla/5.0 NTPlay-logo-mirror' } });
        if (r.ok && !/removed/.test(r.url)) buf = Buffer.from(await r.arrayBuffer());
      } catch (e) {}
    }
    if (!buf) { fail++; return; }
    try { await sharp(buf).resize(240, 150, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(c); }
    catch (e) { fail++; return; }
  }
  copyFileSync(c, out + '/' + id + '.webp'); done.add(id); ok++;
}
async function worker() { while (i < list.length) await one(list[i++]); }
await Promise.all(Array.from({ length: 12 }, worker));
for (const [k, u] of Object.entries(map)) {
  if (k === '_p' || typeof u !== 'string' || !u.startsWith('~i')) continue;
  const id = u.slice(2).replace(/\.[a-z]+$/i, '');
  if (done.has(id)) map[k] = '~m' + id;
}
map._p['~m'] = 'https://natanpg.github.io/NTPlay-webOS/l/';
writeFileSync('app/logos.json', JSON.stringify(map));
console.log('logos copiados:', ok, '· falharam:', fail, '· total:', list.length);
