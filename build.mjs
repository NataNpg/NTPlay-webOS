// Gera dist/ (app pronto para o ares-package). Uso: node build.mjs [versão]
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const ver = process.argv[2] || pkg.version;
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/js', { recursive: true });
mkdirSync('dist/vendor', { recursive: true });
cpSync('app', 'dist', { recursive: true });

const info = JSON.parse(readFileSync('app/appinfo.json', 'utf8'));
info.version = ver;
if (process.env.RES) info.resolution = process.env.RES; // ex.: RES=1280x720 para o pacote das TVs Full HD
writeFileSync('dist/appinfo.json', JSON.stringify(info, null, 2));

await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, sourcemap: false,
  outfile: 'dist/js/app.js', format: 'iife',
  target: ['chrome53'], // webOS 4.x (2018) usa Chromium 53
  define: { __VER__: JSON.stringify(ver) },
  logLevel: 'info',
});
cpSync('node_modules/hls.js/dist/hls.min.js', 'dist/vendor/hls.min.js');
cpSync('node_modules/mpegts.js/dist/mpegts.js', 'dist/vendor/mpegts.js');
cpSync('node_modules/qrcode-generator/qrcode.js', 'dist/vendor/qrcode.js');
console.log('dist/ pronto — versão', ver);
