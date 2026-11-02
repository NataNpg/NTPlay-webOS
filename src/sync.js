// Conta NTPlay — mesmo protocolo do Sync.kt (Android TV) e do painel contas.html.
// A senha nunca sai do aparelho: dela saem a chave de login (PBKDF2 "ntplay-auth:<user>")
// e a chave que cifra os dados com AES-256-GCM (PBKDF2 "ntplay-enc:<user>").

export const URL = 'https://baylcjfedxnjnjkvaufw.supabase.co/functions/v1/ntsync';
const te = new TextEncoder();
const td = new TextDecoder();

function b64(bytes, urlSafe) {
  let s = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  s = btoa(s);
  return urlSafe ? s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : s;
}
function unb64(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

async function pbkdf(pass, salt) {
  const k = await crypto.subtle.importKey('raw', te.encode(pass), { name: 'PBKDF2' }, false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: te.encode(salt), iterations: 40000, hash: 'SHA-1' }, k, 256);
}

/** devolve [chave de login, chave de criptografia], ambas em base64 url-safe sem "=" (igual ao Kotlin) */
export async function derive(user, pass) {
  const u = user.trim().toLowerCase();
  return [b64(await pbkdf(pass, 'ntplay-auth:' + u), true), b64(await pbkdf(pass, 'ntplay-enc:' + u), true)];
}

async function aes(encKey, use) {
  return crypto.subtle.importKey('raw', unb64(encKey), { name: 'AES-GCM' }, false, [use]);
}
export async function encrypt(plain, encKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, await aes(encKey, 'encrypt'), te.encode(plain)));
  const all = new Uint8Array(12 + c.length);
  all.set(iv, 0); all.set(c, 12);
  return b64(all, false);
}
export async function decrypt(blob, encKey) {
  try {
    const all = unb64(blob);
    const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12), tagLength: 128 }, await aes(encKey, 'decrypt'), all.subarray(12));
    return td.decode(p);
  } catch (e) { return null; }
}
export async function sha(s) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)));
  return Array.prototype.map.call(h, (x) => (x < 16 ? '0' : '') + x.toString(16)).join('');
}

/** a = "get" | "put". Resposta: {ok, code, msg, data, ts, exp} */
export async function call(a, user, authKey, dev, devName, data, ts) {
  const o = { a, u: user.trim().toLowerCase(), k: authKey, dev, dn: devName };
  if (data != null) { o.data = data; o.ts = ts; }
  try {
    const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(o) });
    let j = {};
    try { j = JSON.parse(await r.text()); } catch (e) {}
    if (r.ok && j.ok) return { ok: true, code: r.status, msg: '', data: j.data || '', ts: +j.ts || 0, exp: +j.exp || 0 };
    return { ok: false, code: r.status, msg: j.msg || 'Erro do servidor (' + r.status + ')', data: '', ts: 0, exp: 0 };
  } catch (e) {
    return { ok: false, code: 0, msg: 'Sem conexão com o servidor: ' + (e.message || e), data: '', ts: 0, exp: 0 };
  }
}
