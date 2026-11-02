// Copia TODOS os logos da base para o GitHub Pages do projeto (site/l/<nome>.webp, no máximo 240x150).
// Motivo: vários sites de imagem (imgur, postimg, wikimedia…) não abrem no navegador de TVs LG mais antigas
// ou no simulador; o GitHub Pages abre e as imagens ficam pequenas. Troca no app/logos.json por "~m<nome>".
// Uso: node tools/mirror-logos.mjs <pasta de saída do site> <pasta de cache>
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import sharp from 'sharp';

const out = (process.argv[2] || 'site') + '/l';
const cache = process.argv[3] || '.logo-cache';
mkdirSync(out, { recursive: true }); mkdirSync(cache, { recursive: true });
const map = JSON.parse(readFileSync('app/logos.json', 'utf8'));
const P = map._p || {};
const full = (u) => { if (u && u[0] === '~') { const p = P[u.slice(0, 2)]; if (p) return p + u.slice(2); } return u; };
// nome do arquivo: id do imgur, ou "x-<hash>" para os outros sites (o "-" nunca aparece em id do imgur)
function fnv(str, seed) { let h = seed >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
const nameOf = (url) => { const m = /^https:\/\/i\.imgur\.com\/([A-Za-z0-9]+)\.[a-z]+$/i.exec(url); return m ? m[1] : 'x-' + fnv(url, 2166136261) + fnv(url, 5381); };
const jobs = new Map(); // nome -> url
for (const [k, u] of Object.entries(map)) {
  if (k === '_p' || typeof u !== 'string' || u.startsWith('~m')) continue;
  const url = full(u); if (!/^https?:/.test(url)) continue;
  jobs.set(nameOf(url), url);
}
const list = Array.from(jobs.entries());
let ok = 0, fail = 0, i = 0;
const done = new Set();
async function one([name, url]) {
  const c = cache + '/' + name + '.webp';
  if (!existsSync(c)) {
    let buf = null;
    const wm = /wikimedia\.org/.test(url);
    for (let t = 0; t < (wm ? 5 : 2) && !buf; t++) {
      try {
        if (wm) await wmSlot();
        const r = await fetch(url, { headers: { 'User-Agent': 'NTPlay-logo-mirror/1.0 (https://github.com/NataNpg/NTPlay-webOS; djnatan0@live.com)' }, signal: AbortSignal.timeout(20000) });
        if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 4000 * (t + 1))); continue; }
        if (r.ok && !/removed/.test(r.url)) buf = Buffer.from(await r.arrayBuffer());
      } catch (e) {}
    }
    if (!buf) { fail++; return; }
    try { await sharp(buf, { density: 150 }).resize(240, 150, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(c); }
    catch (e) { fail++; return; }
  }
  copyFileSync(c, out + '/' + name + '.webp'); done.add(name); ok++;
}
// no máximo ~4 pedidos por segundo à wikimedia
let wmNext = 0;
async function wmSlot() { const now = Date.now(); const at = Math.max(now, wmNext); wmNext = at + 250; if (at > now) await new Promise((ok) => setTimeout(ok, at - now)); }
async function worker() { while (i < list.length) await one(list[i++]); }
await Promise.all(Array.from({ length: 16 }, worker));
for (const [k, u] of Object.entries(map)) {
  if (k === '_p' || typeof u !== 'string' || u.startsWith('~m')) continue;
  const name = nameOf(full(u));
  if (done.has(name)) map[k] = '~m' + name;
}
map._p['~m'] = 'https://natanpg.github.io/NTPlay-webOS/l/';
writeFileSync('app/logos.json', JSON.stringify(map));
console.log('logos copiados:', ok, '· falharam:', fail, '· total:', list.length);
