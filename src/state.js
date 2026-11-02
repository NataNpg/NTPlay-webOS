// Estado do app: listas, biblioteca, favoritos, grupos, progresso e conta na nuvem.
// A lógica de sincronização é a mesma do AppState.kt para os dados casarem com a TV Android.
import { Store, Idb } from './store.js';
import { Library } from './library.js';
import * as X from './xtream.js';
import * as Sync from './sync.js';
import { getText } from './net.js';
import { sleep } from './util.js';

const listeners = [];
export const S = {
  lib: Library.empty(),
  busy: false, status: '', lastErr: '',
  favs: new Set(Store.favs),
  prog: Store.prog,
  acctInfo: {}, // id -> conta Xtream (vencimento/telas)
  locked: true, accessMsg: '', syncMsg: '', syncBusy: false,
  on(fn) { listeners.push(fn); },
  emit(what) { for (const f of listeners) try { f(what); } catch (e) { console.error(e); } },
};
const toast = (m) => S.emit({ toast: m });

// ---------------------------------------------------------------- biblioteca
export async function reload() {
  const texts = [];
  for (const l of Store.lists()) {
    if (!l.active) continue;
    const t = await Idb.get('lists', l.id).catch(() => null);
    if (t) texts.push({ id: l.id, text: t });
  }
  const p = Store.prefs;
  S.lib = Library.build(texts, { adult: p.adult, b64: p.b64, adultByName: p.adultByName !== false });
  S.emit('lib');
}

async function download(url, progress) {
  const c = X.creds(url);
  if (c) {
    try { return await X.buildM3u(c, progress); } catch (e) {
      progress('API Xtream falhou (' + e.message + '); tentando a M3U…');
      try { return await getText(url, 120000); } catch (e2) { throw e; }
    }
  }
  progress('Baixando a lista…');
  return getText(url, 120000);
}

export async function addUrl(url, name, silent) {
  let u = (url || '').trim().replace(/\s/g, '');
  if (!u) { S.lastErr = 'Informe o link da lista M3U.'; toast(S.lastErr); return false; }
  if (u.indexOf('://') < 0) u = 'http://' + u;
  if (Store.lists().some((l) => l.url === u)) { if (!silent) toast('Essa lista já está adicionada.'); return true; }
  S.busy = true; S.lastErr = ''; S.emit('busy');
  try {
    const text = await download(u, (m) => { S.status = m; S.emit('busy'); });
    if (text.indexOf('#EXTINF') < 0 && text.indexOf('http') < 0) throw new Error('o link não devolveu uma lista M3U');
    const id = 'l' + Date.now().toString(36);
    await Idb.put('lists', id, text);
    const nm = name || (X.creds(u) ? X.creds(u).user : (u.replace(/^https?:\/\//, '').split('/')[0]));
    const l = Store.lists(); l.push({ id, name: nm, url: u, active: true, ts: Date.now() }); Store.saveLists(l);
    await reload();
    if (!silent) toast('Lista adicionada.');
    syncSoon();
    return true;
  } catch (e) {
    S.lastErr = 'Não consegui carregar a lista: ' + (e.message || e) + (e.message === 'Failed to fetch' ? ' (servidor fora do ar ou bloqueando o acesso)' : '');
    if (!silent) toast(S.lastErr);
    return false;
  } finally { S.busy = false; S.status = ''; S.emit('busy'); }
}

export function addXtream(server, user, pass, name) {
  let h = (server || '').trim().replace(/\/+$/, '');
  if (!h || !user || !pass) { toast('Preencha servidor, usuário e senha.'); return Promise.resolve(false); }
  if (h.indexOf('://') < 0) h = 'http://' + h;
  h = h.replace(/\/(get|player_api)\.php.*$/, '');
  return addUrl(h + '/get.php?username=' + encodeURIComponent(user.trim()).replace(/%20/g, '+') + '&password=' + encodeURIComponent(pass.trim()).replace(/%20/g, '+') + '&type=m3u_plus&output=ts', name || user.trim());
}

export async function refreshList(id) {
  const l = Store.lists().find((x) => x.id === id);
  if (!l || !l.url) return;
  S.busy = true; S.emit('busy');
  try {
    const t = await download(l.url, (m) => { S.status = m; S.emit('busy'); });
    await Idb.put('lists', id, t);
    const ls = Store.lists(); const x = ls.find((y) => y.id === id); if (x) x.ts = Date.now(); Store.saveLists(ls);
    await reload(); toast('Lista atualizada.');
  } catch (e) { toast('Falha ao atualizar: ' + (e.message || e)); }
  finally { S.busy = false; S.status = ''; S.emit('busy'); }
}
export async function deleteList(id) {
  Store.saveLists(Store.lists().filter((x) => x.id !== id));
  await Idb.del('lists', id).catch(() => {});
  await reload(); syncSoon();
}
export async function toggleList(id) {
  const ls = Store.lists(); const x = ls.find((y) => y.id === id); if (x) x.active = !x.active; Store.saveLists(ls);
  await reload(); syncSoon();
}
export async function loadAccounts() {
  for (const l of Store.lists()) { if (X.creds(l.url)) { X.account(l.url).then((a) => { if (a) { S.acctInfo[l.id] = a; S.emit('acct'); } }); } }
}

/** atualização automática das listas (opcional, como na TV) */
export async function autoUpdate(onOpen) {
  const p = Store.prefs;
  const every = (p.autoUpd || 0) * 3600000;
  for (const l of Store.lists()) {
    if (!l.url) continue;
    const old = Date.now() - (l.ts || 0);
    if ((onOpen && p.updOpen) || (every > 0 && old > every)) await refreshList(l.id);
  }
}

// ---------------------------------------------------------------- favoritos, grupos, progresso
export function toggleFav(key) {
  if (S.favs.has(key)) S.favs.delete(key); else S.favs.add(key);
  Store.favs = Array.from(S.favs); S.emit('favs'); syncSoon();
  return S.favs.has(key);
}
export const groups = () => Store.groups;
export function groupAdd(name, key) {
  const g = Store.groups; const l = g[name] || (g[name] = []);
  const i = l.indexOf(key); if (i >= 0) l.splice(i, 1); else l.push(key);
  Store.groups = g; S.emit('favs'); syncSoon();
  return i < 0;
}
export function groupDelete(name) { const g = Store.groups; delete g[name]; Store.groups = g; S.emit('favs'); syncSoon(); }

export function saveProg(ep, item, pos, dur, done) {
  S.prog[ep.url] = { t: Math.round(pos), d: Math.round(dur), ts: Date.now(), done: !!done || (dur > 0 && pos > dur * 0.95), k: item.key, n: item.title };
  const ks = Object.keys(S.prog);
  if (ks.length > 400) { ks.sort((a, b) => S.prog[a].ts - S.prog[b].ts); for (const k of ks.slice(0, ks.length - 400)) delete S.prog[k]; }
  Store.prog = S.prog;
}
export function removeProg(itemKey) {
  for (const u of Object.keys(S.prog)) if (S.prog[u].k === itemKey) delete S.prog[u];
  Store.prog = S.prog; S.emit('favs');
}
export function resumeOf(ep) { const p = S.prog[ep.url]; return p && !p.done && p.t > 10000 ? p.t : 0; }
/** "continuar assistindo": último episódio/filme por item, mais recente primeiro (sem canais) */
export function continueList() {
  const by = new Map();
  for (const u of Object.keys(S.prog)) {
    const p = S.prog[u]; if (!p.k || p.k[0] === 'l') continue;
    const o = by.get(p.k); if (!o || p.ts > o.ts) by.set(p.k, Object.assign({ url: u }, p));
  }
  return Array.from(by.values()).sort((a, b) => b.ts - a.ts).map((p) => S.lib.byKey.get(p.k)).filter((i) => i && !(i.kind === 'm' && S.prog[i.eps[0].url] && S.prog[i.eps[0].url].done)).slice(0, 30);
}

// ---------------------------------------------------------------- conta + nuvem
let syncTimer = null, failed = 0;
const devName = 'LG webOS TV';

export function initAccess() {
  const a = Store.acct;
  S.locked = !a.user || (a.exp > 0 && Date.now() > a.exp);
  if (a.user && a.exp > 0 && Date.now() > a.exp) S.accessMsg = 'Seu acesso expirou. Conecte-se à internet e entre de novo ou peça a renovação.';
}
export function accessText() {
  const e = Store.acct.exp; if (!e) return '';
  const d = new Date(e); const p = (x) => (x < 10 ? '0' : '') + x;
  return 'Válido até ' + p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}
function lockOut(msg) {
  const a = Store.acct; Store.acct = { user: '', auth: '', enc: '', ts: 0, hash: '', exp: 0, last: a.last };
  S.accessMsg = msg; S.locked = true; S.emit('locked');
}
function accessFailed(r) {
  if (r.ok) { if (r.exp > 0) { const a = Store.acct; a.exp = r.exp; Store.acct = a; } return false; }
  if (r.code === 401 || r.code === 403) { lockOut(r.msg); return true; }
  const a = Store.acct;
  if (r.code === 0 && a.exp > 0 && Date.now() > a.exp) { lockOut('Seu acesso expirou. Conecte-se à internet e entre de novo ou peça a renovação.'); return true; }
  return false;
}
async function wipeLocal() {
  for (const l of Store.lists()) await Idb.del('lists', l.id).catch(() => {});
  Store.saveLists([]); Store.pending = []; S.favs = new Set(); Store.favs = []; Store.groups = {}; S.prog = {}; Store.prog = {};
  await reload();
}

const failMsg = () => '☁ Salvo. ' + Store.pending.length + ' lista(s) da nuvem não baixaram nesta TV (veja abaixo).';
export async function retryPending(url) {
  const p = Store.pending.find((x) => x.url === url); if (!p) return;
  const ok = await addUrl(p.url, p.name, false);
  if (ok) Store.pending = Store.pending.filter((x) => x.url !== url);
  else { const l = Store.pending; const e = l.find((x) => x.url === url); if (e) { e.tried = Date.now(); e.err = S.lastErr; } Store.pending = l; }
  S.emit('acct');
}
export function dropPending(url) { Store.pending = Store.pending.filter((x) => x.url !== url); syncSoon(); S.emit('acct'); }
function payload(withTs) {
  const loc = Store.lists().filter((l) => l.url);
  const all = loc.concat(Store.pending.filter((p) => !loc.some((l) => l.url === p.url)));
  const lists = all.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)).map((m) => ({ name: m.name, url: m.url, active: m.active }));
  const favs = Array.from(S.favs).sort();
  const groups = Store.groups;
  const prog = {};
  for (const u of Object.keys(S.prog).sort((a, b) => S.prog[b].ts - S.prog[a].ts).slice(0, 150)) { const p = S.prog[u]; prog[u] = { t: p.t, d: p.d, ts: p.ts, done: p.done, k: p.k, n: p.n }; }
  return { lists, favs, groups, prog, ts: withTs };
}
// mesma fórmula do hashOf da TV (detecção de mudança local)
function hashOf(o) {
  let s = JSON.stringify(o.lists).replace(/\//g, '\\/') + '|' + JSON.stringify(o.favs).replace(/\//g, '\\/') + '|';
  for (const k of Object.keys(o.groups).sort()) s += k + '=' + JSON.stringify(o.groups[k]).replace(/\//g, '\\/') + ';';
  return Sync.sha(s);
}

async function applyRemote(r, merge) {
  const rf = new Set(r.favs || []);
  const nf = merge ? new Set(Array.from(S.favs).concat(Array.from(rf))) : rf;
  S.favs = nf; Store.favs = Array.from(nf);
  const rg = r.groups || {};
  if (merge) {
    const m = Store.groups;
    for (const k of Object.keys(rg)) { const l = m[k] || (m[k] = []); for (const x of rg[k]) if (l.indexOf(x) < 0) l.push(x); }
    Store.groups = m;
  } else Store.groups = rg;
  if (r.prog) {
    for (const u of Object.keys(r.prog)) { const p = r.prog[u]; const o = S.prog[u]; if (!o || p.ts > o.ts) S.prog[u] = p; }
    Store.prog = S.prog;
  }
  const remoteUrls = new Set();
  let pend = Store.pending;
  for (const x of r.lists || []) {
    remoteUrls.add(x.url);
    const have = Store.lists().find((l) => l.url === x.url);
    if (!have) {
      const pe = pend.find((p) => p.url === x.url);
      if (pe) { pe.name = x.name; pe.active = x.active !== false; }
      // lista que já falhou: só tenta de novo a cada 30 min (antes tentava a cada 90 s e travava a sincronização)
      if (pe && Date.now() - (pe.tried || 0) < 30 * 60000) continue;
      S.syncMsg = 'Baixando a lista "' + (x.name || '') + '" da nuvem…'; S.emit('sync');
      const ok = await addUrl(x.url, x.name, true);
      pend = Store.pending;
      if (!ok) {
        const e = pend.find((p) => p.url === x.url);
        if (e) { e.tried = Date.now(); e.err = S.lastErr; } else pend.push({ name: x.name, url: x.url, active: x.active !== false, tried: Date.now(), err: S.lastErr });
        Store.pending = pend; failed++;
      } else {
        pend = pend.filter((p) => p.url !== x.url); Store.pending = pend;
        if (x.active === false) { const ls = Store.lists(); const y = ls.find((l) => l.url === x.url); if (y) { y.active = false; Store.saveLists(ls); } }
      }
    } else if (!merge && have.active !== (x.active !== false)) {
      // só segue a nuvem quando nada mudou aqui; se você ligou/desligou nesta TV, vale o que fez aqui
      const ls = Store.lists(); ls.find((l) => l.id === have.id).active = x.active !== false; Store.saveLists(ls);
    }
  }
  if (!merge && r.lists) {
    const ls = Store.lists(); const rm = ls.filter((l) => l.url && !remoteUrls.has(l.url));
    if (rm.length) { Store.saveLists(ls.filter((l) => rm.indexOf(l) < 0)); for (const m of rm) await Idb.del('lists', m.id).catch(() => {}); }
    Store.pending = Store.pending.filter((p) => remoteUrls.has(p.url));
  }
  await reload();
  S.emit('favs');
}

export async function syncNow(manual) {
  const a = Store.acct; if (!a.user || S.syncBusy) return;
  S.syncBusy = true; failed = 0; S.emit('sync');
  try {
    const dev = Store.deviceId;
    const g = await Sync.call('get', a.user, a.auth, dev, devName);
    if (accessFailed(g)) return;
    if (!g.ok) { S.syncMsg = g.msg; return; }
    const txt = g.data ? await Sync.decrypt(g.data, a.enc) : null;
    let remote = null; try { remote = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (g.data && !remote) { S.syncMsg = 'Não consegui abrir os dados da nuvem (senha diferente da usada ao salvar?).'; return; }
    const changed = (await hashOf(payload(0))) !== Store.acct.hash;
    if (remote && g.ts > Store.acct.ts) {
      await applyRemote(remote, changed);
      if (!changed) { const b = Store.acct; b.ts = g.ts; b.hash = await hashOf(payload(0)); Store.acct = b; S.syncMsg = failed ? failMsg() : '☁ Atualizado da nuvem.'; return; }
    } else if (!changed && remote) { if (manual) S.syncMsg = '☁ Tudo em dia.'; return; }
    const now = Date.now();
    const p = payload(now);
    const encd = await Sync.encrypt(JSON.stringify(p), a.enc);
    const pr = await Sync.call('put', a.user, a.auth, dev, devName, encd, now);
    if (accessFailed(pr)) return;
    if (pr.ok) { const b = Store.acct; b.ts = now; b.hash = await hashOf(p); Store.acct = b; S.syncMsg = failed || Store.pending.length ? failMsg() : '☁ Salvo na nuvem.'; } else S.syncMsg = pr.msg;
  } catch (e) { S.syncMsg = 'Falha ao sincronizar: ' + (e.message || e); }
  finally { S.syncBusy = false; S.emit('sync'); }
}
export function syncSoon() {
  if (!Store.acct.user) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 10000);
}
export function startSyncLoop() { setInterval(() => { if (!S.locked) syncNow(false); }, 90000); }

export async function login(user, pass) {
  const u = (user || '').trim().toLowerCase();
  if (u.length < 3) { S.accessMsg = 'Digite o usuário.'; S.emit('locked'); return; }
  if ((pass || '').length < 6) { S.accessMsg = 'Digite a senha (mínimo 6 caracteres).'; S.emit('locked'); return; }
  if (!window.crypto || !crypto.subtle) { S.accessMsg = 'Esta TV não tem a criptografia necessária (WebCrypto). Atualize o sistema da TV.'; S.emit('locked'); return; }
  if (S.syncBusy) return;
  S.syncBusy = true; S.accessMsg = 'Entrando…'; S.emit('locked');
  try {
    const [ak, ek] = await Sync.derive(u, pass);
    const r = await Sync.call('get', u, ak, Store.deviceId, devName);
    if (!r.ok) { S.accessMsg = r.msg; return; }
    const old = Store.acct;
    if (old.last && old.last !== u) await wipeLocal(); // outro usuário nesta TV: não mistura os dados
    Store.acct = { user: u, auth: ak, enc: ek, ts: 0, hash: '', exp: r.exp, last: u };
    S.locked = false; S.accessMsg = ''; S.syncMsg = 'Entrou! Baixando seus dados…';
  } finally { S.syncBusy = false; S.emit('locked'); }
  await syncNow(true);
}
export function logout() { lockOut('Você saiu. Entre de novo para usar o app.'); }
export { sleep };
