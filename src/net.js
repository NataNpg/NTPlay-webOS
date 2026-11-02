// Rede. webOS 4 (Chromium 53) não tem AbortController: o tempo-limite é uma corrida de promessas.

function withTimeout(p, ms, what) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error((what || 'servidor') + ' não respondeu em ' + Math.round(ms / 1000) + ' s')), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}

async function once(url, ms, opts) {
  const r = await withTimeout(fetch(url, Object.assign({ cache: 'no-store' }, opts || {})), ms);
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return withTimeout(r.text(), ms * 4, 'download');
}

/** baixa texto; se https falhar (certificado vencido em servidor IPTV é comum), tenta http */
export async function getText(url, ms) {
  ms = ms || 30000;
  try { return await once(url, ms); } catch (e) {
    if (e.status || !/^https:/i.test(url)) throw e;
    return once(url.replace(/^https:/i, 'http:'), ms);
  }
}
export async function getJson(url, ms) { return JSON.parse(await getText(url, ms)); }
export async function getQuick(url) { try { return await getText(url, 15000); } catch (e) { return null; } }

export async function postJson(url, body, ms) {
  const r = await withTimeout(fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ms || 20000);
  let j = {};
  try { j = JSON.parse(await r.text()); } catch (e) {}
  return { status: r.status, ok: r.ok, j };
}
