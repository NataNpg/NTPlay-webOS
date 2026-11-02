// Contador anônimo de uso (mesmo formato "ntp1." do PC e da TV Android): só {id diário, p, v, t}.
// Sem lista, nome, conteúdo assistido, usuário ou senha. Vai cifrado só para o painel.
const PUB = 'BHI9Apeb-q1NfFyzK1M50pJL7IWEGH0pJbwT0FXFtTD6B4986Gp-qjGP0IeKLIEMFH_UfcvuDGTL3GqAs3k8g4A';
const TOPIC = 'ntplay-pres-381affd473dafb5cac';

const b64 = (a) => { let s = ''; const u = new Uint8Array(a); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };

async function presId() {
  let salt = localStorage.getItem('nt.salt');
  if (!salt) { salt = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), (x) => (x < 16 ? '0' : '') + x.toString(16)).join(''); localStorage.setItem('nt.salt', salt); }
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + new Date().toISOString().slice(0, 10))));
  return 'a' + Array.prototype.map.call(h.subarray(0, 6), (x) => (x < 16 ? '0' : '') + x.toString(16)).join('');
}
async function seal(obj) {
  const C = crypto.subtle;
  const pub = await C.importKey('raw', unb64(PUB), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eph = await C.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const sh = await C.deriveBits({ name: 'ECDH', public: pub }, eph.privateKey, 256);
  const key = await C.importKey('raw', await C.digest('SHA-256', sh), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await C.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return 'ntp1.' + b64(await C.exportKey('raw', eph.publicKey)) + '.' + b64(iv) + '.' + b64(ct);
}
async function send(ver) {
  try { await fetch('https://ntfy.sh/' + TOPIC, { method: 'POST', body: await seal({ id: await presId(), p: 'webos', v: ver, t: Date.now() }), headers: { 'X-Firebase': 'no' } }); } catch (e) {}
}
export function start(ver) {
  if (!window.crypto || !crypto.subtle || localStorage.getItem('nt.pres') === '0') return;
  setTimeout(() => send(ver), 6000);
  setInterval(() => send(ver), 5 * 60000);
}
