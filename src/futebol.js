// ⚽ Futebol: jogos do dia (API pública da ESPN) + canais da lista que passam cada jogo (pela programação).
import { getJson } from './net.js';
import { norm } from './util.js';
import * as X from './xtream.js';

export const LEAGUES = [
  ['bra.1', 'Brasileirão Série A'], ['bra.2', 'Brasileirão Série B'], ['bra.copa_do_brazil', 'Copa do Brasil'],
  ['conmebol.libertadores', 'Libertadores'], ['conmebol.sudamericana', 'Sul-Americana'],
  ['bra.camp.paulista', 'Paulistão'], ['bra.camp.carioca', 'Carioca'], ['bra.camp.mineiro', 'Mineiro'], ['bra.camp.gaucho', 'Gauchão'],
  ['fifa.world', 'Copa do Mundo'], ['fifa.worldq.conmebol', 'Eliminatórias'], ['fifa.cwc', 'Mundial de Clubes'], ['fifa.friendly', 'Amistosos'],
  ['uefa.champions', 'Champions League'], ['uefa.europa', 'Europa League'], ['uefa.europa.conf', 'Conference League'],
  ['eng.1', 'Premier League'], ['esp.1', 'La Liga'], ['ita.1', 'Serie A (Itália)'], ['ger.1', 'Bundesliga'], ['fra.1', 'Ligue 1'], ['por.1', 'Liga Portugal'],
  ['arg.1', 'Argentina'], ['ksa.1', 'Liga Saudita'], ['usa.1', 'MLS'],
];
export const SPORT = /esporte|sport|futebol|futbol|soccer|premiere|\bespn|\btnt\b|combate|band ?sports|\bsportv|\bdazn|paramount|\bcaz[ée]|\bge\b|nosso futebol|\bppv\b|eventos?|jogos?/i;
const GAME = /\bx\b|\bvs\.?\b|\bversus\b|futebol|campeonato|copa|libertadores|brasileir|champions|liga|premier|rodada/i;
const NOT = /reprise|compacto|melhores momentos|debate|resenha|program|jornal|replay|\bvt\b/i;

const cache = {};
const dstr = (off) => { const d = new Date(Date.now() + off * 86400000); const p = (x) => (x < 10 ? '0' : '') + x; return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()); };

export async function games(off, force) {
  const k = dstr(off);
  const c = cache[k];
  if (c && !force && Date.now() - c.ts < (c.live ? 60000 : 600000)) return c.list;
  const out = [];
  let live = false;
  const jobs = LEAGUES.map(([id, name]) =>
    getJson('https://site.api.espn.com/apis/site/v2/sports/soccer/' + id + '/scoreboard?dates=' + k + '&lang=pt&region=br', 15000).then((j) => {
      for (const ev of j.events || []) {
        const cp = ev.competitions && ev.competitions[0]; if (!cp) continue;
        const t = cp.competitors || [];
        const home = t.find((x) => x.homeAway === 'home') || t[0], away = t.find((x) => x.homeAway === 'away') || t[1];
        if (!home || !away) continue;
        const st = (ev.status && ev.status.type) || {};
        if (st.state === 'in') live = true;
        out.push({ id: ev.id, league: name, date: new Date(ev.date).getTime(), state: st.state, detail: st.shortDetail || '',
          home: home.team.shortDisplayName || home.team.displayName, away: away.team.shortDisplayName || away.team.displayName,
          hs: home.score, as: away.score, hl: home.team.logo, al: away.team.logo });
      }
    }).catch(() => {}));
  await Promise.all(jobs);
  out.sort((a, b) => (a.state === 'in' ? 0 : 1) - (b.state === 'in' ? 0 : 1) || a.date - b.date);
  cache[k] = { ts: Date.now(), list: out, live };
  return out;
}

// palavras do nome do time que valem para casar com a programação ("Atlético-MG" → "atletico")
const STOP = new Set(['fc', 'ec', 'sc', 'cf', 'de', 'do', 'da', 'club', 'clube', 'esporte', 'sport', 'united', 'city', 'real', 'atletico']);
export function teamWords(n) { const w = norm(n).split(' ').filter((x) => x.length > 2 && !STOP.has(x)); return w.length ? w : norm(n).split(' ').filter((x) => x.length > 2); }
const hasTeam = (txt, team) => teamWords(team).some((w) => (' ' + txt + ' ').indexOf(' ' + w + ' ') >= 0);

let epgTs = 0, epgNow = new Map(), loading = null;
/** programa atual dos canais de esporte (Xtream get_short_epg), 5 por vez, até 120 canais-base */
export function loadEpg(lib, force) {
  if (loading) return loading;
  if (!force && Date.now() - epgTs < 300000) return Promise.resolve(epgNow);
  loading = (async () => {
    const reps = new Map();
    for (const c of lib.live) {
      if (!SPORT.test(c.title + ' ' + c.group) || !X.parseStream(c.eps[0].url)) continue;
      const k = norm(c.title).replace(/\b(fhd|hd|sd|4k|uhd|h265|alt)\b/g, '').replace(/\s+/g, ' ').trim();
      if (k && !reps.has(k)) reps.set(k, c);
    }
    const list = Array.from(reps.values()).slice(0, 120);
    const m = new Map();
    let i = 0;
    const worker = async () => {
      while (i < list.length) {
        const c = list[i++];
        const ps = await X.shortEpg(c.eps[0].url, 4);
        const now = Date.now();
        const cur = ps.find((p) => p.start <= now && p.stop > now);
        m.set(c.key, { cur, list: ps });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    epgNow = m; epgTs = Date.now(); loading = null;
    return m;
  })();
  return loading;
}

/** canais que passam (●) ou vão passar o jogo, pela programação; reserva: canal de evento com os dois nomes */
export function channelsFor(g, lib) {
  const out = [];
  for (const c of lib.live) {
    const e = epgNow.get(c.key);
    const name = norm(c.title);
    if (e) {
      const hit = (p) => { const t = norm(p.title + ' ' + p.desc); return hasTeam(t, g.home) && hasTeam(t, g.away) && !NOT.test(p.title); };
      if (e.cur && hit(e.cur)) { out.push({ c, now: true }); continue; }
      const p = e.list.find((x) => hit(x) && Math.abs(x.start - g.date) < 3 * 3600000);
      if (p) { out.push({ c, at: p.start }); continue; }
    }
    if (hasTeam(name, g.home) && hasTeam(name, g.away)) out.push({ c, now: g.state === 'in' });
  }
  return out.slice(0, 6);
}
/** canais cujo programa atual parece jogo */
export function playingNow(lib) {
  const out = [];
  for (const c of lib.live) { const e = epgNow.get(c.key); if (e && e.cur && GAME.test(e.cur.title) && !NOT.test(e.cur.title)) out.push({ c, title: e.cur.title }); }
  return out.slice(0, 40);
}
