// Preferências em localStorage; conteúdo das listas (M3U grandes) em IndexedDB.
import { uuid } from './util.js';

const LS = window.localStorage;
const get = (k, d) => { try { const v = LS.getItem('nt.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const set = (k, v) => { try { LS.setItem('nt.' + k, JSON.stringify(v)); } catch (e) { console.warn('localStorage cheio', k); } };

export const Store = {
  get, set,
  get deviceId() { let d = get('dev', ''); if (!d) { d = uuid(); set('dev', d); } return d; },
  lists() { return get('lists', []); },
  saveLists(l) { set('lists', l); },
  get favs() { return get('favs', []); }, set favs(v) { set('favs', v); },
  get groups() { return get('groups', {}); }, set groups(v) { set('groups', v); },
  get prog() { return get('prog', {}); }, set prog(v) { set('prog', v); },
  get intro() { return get('intro', {}); }, set intro(v) { set('intro', v); },
  get prefs() { return Object.assign({ adult: false, autoNext: true, subs: false, skipIntro: 85, autoUpd: 0, updOpen: false }, get('prefs', {})); },
  set prefs(v) { set('prefs', v); },
  // conta
  get acct() { return get('acct', { user: '', auth: '', enc: '', ts: 0, hash: '', exp: 0, last: '' }); },
  set acct(v) { set('acct', v); },
};

// ---------------------------------------------------------------- IndexedDB
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('ntplay', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('lists'); r.result.createObjectStore('cache'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(store, mode, fn) {
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('IndexedDB abortado (espaço cheio?)'));
  }));
}
export const Idb = {
  put: (store, k, v) => tx(store, 'readwrite', (s) => s.put(v, k)),
  get: (store, k) => tx(store, 'readonly', (s) => s.get(k)),
  del: (store, k) => tx(store, 'readwrite', (s) => s.delete(k)),
};
