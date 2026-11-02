// Xtream Codes pela API player_api.php (evita o HTTP 522 do get.php) — porta de Xtream.kt.
import { getJson, getText, getQuick } from './net.js';
import { enc, b64txt } from './util.js';

export const SERIES_EXT = '.xs';

export function creds(url) {
  try {
    const m = /^(https?:\/\/[^/?#]+)(\/[^?#]*)?\?([^#]*)/i.exec(url.trim());
    if (!m) return null;
    const path = m[2] || '';
    if (!/(get|player_api)\.php$/.test(path)) return null;
    const q = {};
    for (const p of m[3].split('&')) { const i = p.indexOf('='); if (i > 0) q[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' ')); }
    if (!q.username || !q.password) return null;
    return mk(m[1], q.username, q.password);
  } catch (e) { return null; }
}
function mk(base, user, pass) {
  return { base, user, pass, api: (action, extra) => base + '/player_api.php?username=' + enc(user) + '&password=' + enc(pass) + (action ? '&action=' + action : '') + (extra || '') };
}
const dec = (s) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; } };
export function credsFromStream(url) {
  const m = /^(https?:\/\/[^/]+)\/series\/([^/]+)\/([^/]+)\/(\d+)\.xs$/.exec(url);
  return m ? [mk(m[1], dec(m[2]), dec(m[3])), m[4]] : null;
}
const streamRe = /^(https?:\/\/[^/]+)\/(movie|series|live)\/([^/]+)\/([^/]+)\/(\d+)\.([A-Za-z0-9]+)$/;
export function parseStream(url) {
  const m = streamRe.exec(url);
  return m ? { c: mk(m[1], dec(m[3]), dec(m[4])), type: m[2], id: m[5], ext: m[6] } : null;
}

const clean = (s) => String(s == null ? '' : s).replace(/"/g, "'").replace(/[\r\n]/g, ' ').trim();

async function cats(c, action) {
  const m = {};
  try { for (const o of await getJson(c.api(action), 60000) || []) m[String(o.category_id)] = o.category_name || ''; } catch (e) {}
  return m;
}
async function streams(c, action, cm, kind, out) {
  const arr = await getJson(c.api(action), 180000);
  if (!Array.isArray(arr)) return 0;
  const u = enc(c.user), p = enc(c.pass);
  let n = 0;
  for (const o of arr) {
    const id = String(o.stream_id || o.series_id || ''), name = o.name ? String(o.name) : '';
    if (!id || id === 'undefined' || !name) continue;
    const link = kind === 'l' ? c.base + '/live/' + u + '/' + p + '/' + id + '.ts'
      : kind === 'm' ? c.base + '/movie/' + u + '/' + p + '/' + id + '.' + (o.container_extension || 'mp4')
        : c.base + '/series/' + u + '/' + p + '/' + id + SERIES_EXT;
    const g = cm[String(o.category_id)] || 'Sem grupo';
    const epg = kind === 'l' && o.epg_channel_id ? 'tvg-id="' + clean(o.epg_channel_id) + '" ' : '';
    out.push('#EXTINF:-1 ' + epg + 'tvg-logo="' + clean(o.stream_icon || o.cover || '') + '" group-title="' + clean(g) + '",' + clean(name) + '\n' + link);
    n++;
  }
  return n;
}

/** monta a M3U a partir da API (igual à TV) */
export async function buildM3u(c, progress) {
  const auth = await getText(c.api(''), 40000).catch(() => null);
  if (!auth) throw new Error('o servidor não respondeu à API (player_api.php)');
  let ui = null;
  try { ui = JSON.parse(auth).user_info; } catch (e) {}
  if (ui && ui.auth === 0) throw new Error('usuário ou senha recusados pelo servidor');
  if (ui && ui.status && String(ui.status).toLowerCase() !== 'active') throw new Error('conta ' + ui.status + ' no servidor');
  const out = ['#EXTM3U url-tvg="' + c.base + '/xmltv.php?username=' + enc(c.user) + '&password=' + enc(c.pass) + '"'];
  let total = 0;
  const step = async (label, a, ca, k) => { progress(label); try { total += await streams(c, a, await cats(c, ca), k, out); } catch (e) { console.warn(a, e); } };
  await step('Baixando canais…', 'get_live_streams', 'get_live_categories', 'l');
  await step('Baixando filmes…', 'get_vod_streams', 'get_vod_categories', 'm');
  await step('Baixando séries…', 'get_series', 'get_series_categories', 's');
  if (!total) throw new Error('a API do servidor não devolveu nenhum item');
  return out.join('\n');
}

export async function account(url) {
  const c = creds(url); if (!c) return null;
  const t = await getQuick(c.api('')); if (!t) return null;
  try {
    const ui = JSON.parse(t).user_info; if (!ui) return null;
    return { exp: (+ui.exp_date || 0) * 1000, status: ui.status || '', maxCon: +ui.max_connections || 0, active: +ui.active_cons || 0 };
  } catch (e) { return null; }
}

const siCache = new Map();
async function seriesInfo(c, id) {
  const k = c.base + '|' + id;
  if (siCache.has(k)) return siCache.get(k);
  let t = null;
  for (let i = 0; i < 2 && !t; i++) t = await getQuick(c.api('get_series_info', '&series_id=' + id));
  if (t && t.length > 20) { siCache.set(k, t); if (siCache.size > 30) siCache.delete(siCache.keys().next().value); }
  return t;
}

/** episódios de uma série Xtream (carregados ao abrir) */
export async function episodes(url) {
  const x = credsFromStream(url); if (!x) return [];
  const [c, id] = x;
  const txt = await seriesInfo(c, id);
  if (!txt) throw new Error('o servidor não respondeu');
  const eps = JSON.parse(txt).episodes;
  if (!eps) return [];
  const out = [], u = enc(c.user), p = enc(c.pass);
  for (const k of Object.keys(eps)) {
    (eps[k] || []).forEach((e, i) => {
      if (!e || !e.id) return;
      const s = +e.season || +k || 1, n = +e.episode_num || i + 1;
      out.push({ name: e.title || 'Episódio ' + n, url: c.base + '/series/' + u + '/' + p + '/' + e.id + '.' + (e.container_extension || 'mp4'), s, e: n });
    });
  }
  return out.sort((a, b) => a.s - b.s || a.e - b.e);
}

/** capa, sinopse, nota e ano do próprio servidor */
export async function info(item) {
  const url = item.eps[0] && item.eps[0].url; if (!url) return null;
  const m = parseStream(url); if (!m) return null;
  const txt = m.type === 'movie' ? await getQuick(m.c.api('get_vod_info', '&vod_id=' + m.id))
    : m.type === 'series' && m.ext === 'xs' ? await seriesInfo(m.c, m.id) : null;
  if (!txt) return null;
  let o; try { o = JSON.parse(txt).info; } catch (e) { return null; }
  if (!o || Array.isArray(o)) return null;
  const s = (k) => (o[k] == null || o[k] === 'null' ? '' : String(o[k]).trim());
  const img = s('movie_image') || s('cover_big') || s('cover');
  const ov = s('plot') || s('description');
  let r = parseFloat(s('rating').replace(',', '.')) || 0; if (r > 10) r /= 10;
  const y = (s('releasedate') || s('releaseDate')).slice(0, 4).replace(/\D/g, '');
  const genre = s('genre');
  if (!img && !ov) return null;
  return { img, ov, r, y, genre };
}

/** guia curto (agora/próximo) de um canal ao vivo */
export async function shortEpg(url, limit) {
  const m = parseStream(url); if (!m || m.type !== 'live') return [];
  const t = await getQuick(m.c.api('get_short_epg', '&stream_id=' + m.id + '&limit=' + (limit || 4)));
  if (!t) return [];
  try {
    return (JSON.parse(t).epg_listings || []).map((o) => ({ title: b64txt(o.title).trim(), desc: b64txt(o.description).trim(), start: (+o.start_timestamp || 0) * 1000, stop: (+o.stop_timestamp || 0) * 1000 }))
      .filter((p) => p.stop > Date.now()).sort((a, b) => a.start - b.start);
  } catch (e) { return []; }
}
