// Leitura da M3U e montagem da biblioteca — porta de Library.kt (mesmas chaves de item).
import { maybeB64, isAdult, guess, cleanG, epInfo, norm, theme } from './util.js';

function attr(l, key) {
  const k = key + '="';
  const i = l.toLowerCase().indexOf(k.toLowerCase());
  if (i < 0) return '';
  const s = i + k.length, e = l.indexOf('"', s);
  return e < 0 ? '' : l.substring(s, e);
}

export function parseM3u(text, cb) {
  let tvg = '', name = '', group = '', logo = '', has = false, tvgUrl = '';
  let pos = 0;
  const n = text.length;
  while (pos < n) {
    let e = text.indexOf('\n', pos);
    if (e < 0) e = n;
    const l = text.substring(pos, e).trim();
    pos = e + 1;
    if (!l) continue;
    if (l.charCodeAt(0) === 35) { // '#'
      if (l.startsWith('#EXTINF')) {
        has = true;
        logo = attr(l, 'tvg-logo'); tvg = attr(l, 'tvg-id'); group = attr(l, 'group-title');
        const q = l.lastIndexOf('"');
        const c = l.indexOf(',', q > 0 ? q : 0);
        name = c < 0 ? '' : l.substring(c + 1).trim();
        if (!name) name = attr(l, 'tvg-name');
      } else if (l.startsWith('#EXTGRP:')) { if (!group) group = l.substring(8).trim(); }
      else if (l.startsWith('#EXTM3U')) { tvgUrl = attr(l, 'url-tvg') || attr(l, 'x-tvg-url'); }
      continue;
    }
    if (!/^https?:\/\//i.test(l)) continue;
    const nm = has && name ? name : (l.split('?')[0].split('/').pop() || 'Canal');
    cb(nm, l, group || 'Sem grupo', logo, tvg);
    has = false; name = ''; group = ''; logo = ''; tvg = '';
  }
  return tvgUrl;
}

export class Library {
  constructor(live, movies, series) {
    this.live = live; this.movies = movies; this.series = series;
    this.every = live.concat(movies, series);
    this.byKey = new Map();
    for (const i of this.every) this.byKey.set(i.key, i);
    const grp = (l) => {
      const m = new Map();
      for (const i of l) { let a = m.get(i.group); if (!a) { a = []; m.set(i.group, a); } a.push(i); }
      return Array.from(m.entries()).sort((a, b) => (a[1][0].adult - b[1][0].adult) || a[0].toLowerCase().localeCompare(b[0].toLowerCase()));
    };
    this.liveGroups = grp(live); this.movieGroups = grp(movies); this.serieGroups = grp(series);
    this.kids = movies.concat(series, live).filter((i) => theme(i) === 'INFANTIL');
    this.anime = series.concat(movies, live).filter((i) => theme(i) === 'ANIMES');
  }
  static empty() { return new Library([], [], []); }

  /** texts: [{id, text}] */
  static build(texts, opt) {
    const showAdult = !!opt.adult, b64 = !!opt.b64, adultByName = opt.adultByName !== false;
    const live = [], mv = [], sm = new Map(), seenLive = new Set(), seenMovie = new Set();
    const epgUrls = [];
    for (const t of texts) {
      const u = parseM3u(t.text, (rawName, url, rawGroup, logo, tvgId) => {
        const name = b64 ? maybeB64(rawName) : rawName;
        const group = b64 ? maybeB64(rawGroup) : rawGroup;
        const adult = adultByName && isAdult(name + ' ' + group);
        if (adult && !showAdult) return;
        const k = guess(url, group, name);
        if (k === 'm') {
          if (!seenMovie.has(url)) { seenMovie.add(url); mv.push(item('m', 'm:' + url, name, cleanG(group), logo, [{ name, url, s: 0, e: 0 }], adult)); }
        } else if (k === 's') {
          const i = epInfo(name);
          const ti = i ? i[0] : name;
          const key = 's:' + group + '|' + ti.toLowerCase();
          let o = sm.get(key);
          if (!o) { o = item('s', key, ti, cleanG(group), logo, [], adult); sm.set(key, o); }
          o.eps.push({ name, url, s: i ? i[1] : 1, e: i ? i[2] : o.eps.length + 1 });
          if (!o.logo) o.logo = logo;
        } else if (!seenLive.has(url)) {
          seenLive.add(url);
          const it = item('l', 'l:' + url, name, cleanG(group), logo, [{ name, url, s: 0, e: 0 }], adult);
          it.tvgId = tvgId; it.list = t.id;
          live.push(it);
        }
      });
      if (u) epgUrls.push(u);
    }
    // canais sem logo herdam o logo de outra versão (FHD/HD/SD) do mesmo canal
    const lk = new Map();
    const base = (s) => norm(s).replace(/\b(fhd|hd|sd|4k|uhd|h265|hevc|alt|backup|\d+fps)\b/g, '').replace(/\s+/g, ' ').trim();
    for (const o of live) if (o.logo) { const k = base(o.title); if (!lk.has(k)) lk.set(k, o.logo); }
    for (const o of live) if (!o.logo) { const l = lk.get(base(o.title)); if (l) o.logo = l; }
    const ser = Array.from(sm.values());
    for (const o of ser) o.eps.sort((a, b) => a.s - b.s || a.e - b.e);
    // capa repetida em muitos títulos não é capa (é logo do provedor)
    const cnt = new Map();
    for (const o of mv.concat(ser)) if (o.logo) cnt.set(o.logo, (cnt.get(o.logo) || 0) + 1);
    for (const o of mv.concat(ser)) if ((cnt.get(o.logo) || 0) > 2) o.logo = '';
    const byAdult = (a, b) => a.adult - b.adult;
    const lib = new Library(live.sort(byAdult), mv.sort(byAdult), ser.sort(byAdult));
    lib.epgUrls = epgUrls;
    return lib;
  }
}

function item(kind, key, title, group, logo, eps, adult) {
  return { kind, key, title, group, logo, eps, adult, tvgId: '', _n: null, get norm() { return this._n || (this._n = norm(this.title)); } };
}
