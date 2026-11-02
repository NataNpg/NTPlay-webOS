// Navegação pelo controle remoto: setas escolhem o elemento ".f" mais próximo na direção.
// Também funciona com o Magic Remote (ponteiro): passar o mouse foca, clicar aciona.

export const K = {
  LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, ESC: 27, BKSP: 8,
  PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413, FF: 417, RW: 412, CHUP: 33, CHDOWN: 34,
  RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406, INFO: 457,
};

let cur = null;
const handlers = []; // pilha de tratadores de teclas (o de cima recebe primeiro)

export function current() { return cur && document.body.contains(cur) ? cur : null; }

function scope() {
  const layers = document.querySelectorAll('.layer.open');
  return layers.length ? layers[layers.length - 1] : document.getElementById('app');
}
function visible(el) {
  if (!el.offsetParent && el.style.position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function focus(el, noScroll) {
  if (!el) return;
  if (cur) cur.classList.remove('focus');
  cur = el;
  el.classList.add('focus');
  if (!noScroll) reveal(el);
  if (el.onfocus2) el.onfocus2();
  if (hook) hook(el);
}
let hook = null;
/** função chamada a cada mudança de foco (prévia do canal) */
export function onFocus(fn) { hook = fn; }

function reveal(el) {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const st = getComputedStyle(p);
    if (/(auto|scroll|hidden)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 2) {
      const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect(), pad = 60;
      if (r.top < pr.top + pad) p.scrollTop -= pr.top + pad - r.top;
      else if (r.bottom > pr.bottom - pad) p.scrollTop += r.bottom - pr.bottom + pad;
    }
    if (/(auto|scroll|hidden)/.test(st.overflowX) && p.scrollWidth > p.clientWidth + 2) {
      const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect(), pad = 80;
      if (r.left < pr.left + pad) p.scrollLeft -= pr.left + pad - r.left;
      else if (r.right > pr.right - pad) p.scrollLeft += r.right - pr.right + pad;
    }
    p = p.parentElement;
  }
}

export function first(root) {
  const sc = root || scope();
  const pref = sc.querySelector('.f.autof');
  if (pref && visible(pref)) return focus(pref);
  const all = sc.querySelectorAll('.f');
  for (let i = 0; i < all.length; i++) if (visible(all[i])) return focus(all[i]);
}

export function move(dir) {
  const sc = scope();
  if (!cur || !sc.contains(cur) || !visible(cur)) return first(sc);
  // um elemento pode dizer para onde vai (ex.: sair da grade para a barra lateral)
  const hook = cur['on' + dir];
  if (hook && hook() === true) return;
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  const all = sc.querySelectorAll('.f');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el === cur || !visible(el)) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    let main, side, overlap;
    if (dir === 'left') { if (b.right > a.left + 4) continue; main = a.left - b.right; side = Math.abs(by - ay); overlap = b.bottom > a.top && b.top < a.bottom; }
    else if (dir === 'right') { if (b.left < a.right - 4) continue; main = b.left - a.right; side = Math.abs(by - ay); overlap = b.bottom > a.top && b.top < a.bottom; }
    else if (dir === 'up') { if (b.bottom > a.top + 4) continue; main = a.top - b.bottom; side = Math.abs(bx - ax); overlap = b.right > a.left && b.left < a.right; }
    else { if (b.top < a.bottom - 4) continue; main = b.top - a.bottom; side = Math.abs(bx - ax); overlap = b.right > a.left && b.left < a.right; }
    // para os lados só vale quem está na mesma linha (senão a seta "pula" para as abas lá em cima)
    if (!overlap && (dir === 'left' || dir === 'right')) continue;
    const s = Math.max(0, main) + side * (overlap ? 0.3 : 2.5) + (overlap ? 0 : 400);
    if (s < bs) { bs = s; best = el; }
  }
  if (best) focus(best);
  else if (cur.onedge) cur.onedge(dir);
}

export function pushKeys(fn) { handlers.push(fn); return () => { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); }; }

let okDown = 0, holdFired = false, okEaten = false;
function onKey(e) {
  const k = e.keyCode;
  const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
  if (typing) {
    // digitando: setas ↑↓ e Voltar saem do campo; o resto é do teclado virtual
    if (k === K.UP || k === K.DOWN || k === K.BACK || k === K.ESC) { ae.blur(); e.preventDefault(); if (k === K.UP || k === K.DOWN) move(k === K.UP ? 'up' : 'down'); return; }
    if (k === K.OK) { okEaten = true; ae.blur(); if (ae.onenter) ae.onenter(); e.preventDefault(); }
    return;
  }
  if (k === K.OK && !e.repeat) okEaten = false;
  for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i](e, k) === true) { if (k === K.OK) okEaten = true; e.preventDefault(); return; }
  switch (k) {
    case K.LEFT: move('left'); break;
    case K.RIGHT: move('right'); break;
    case K.UP: move('up'); break;
    case K.DOWN: move('down'); break;
    case K.OK:
      if (e.repeat) { if (!holdFired && Date.now() - okDown > 700 && cur && cur.onhold) { holdFired = true; cur.onhold(); } break; }
      okDown = Date.now(); holdFired = false; break;
    case K.RED: case K.INFO: if (cur && cur.onhold) cur.onhold(); break;
    default: return;
  }
  e.preventDefault();
}
function onKeyUp(e) {
  if (e.keyCode !== K.OK) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  if (holdFired) { holdFired = false; return; }
  if (okEaten) { okEaten = false; return; }
  const c = current();
  if (!c) return;
  if (Date.now() - okDown > 700 && c.onhold) { c.onhold(); return; }
  activate(c);
}
export function activate(c) {
  if (c.tagName === 'INPUT') { c.focus(); return; }
  if (c.onok) c.onok(); else if (c.onclick) c.onclick();
}

export function init() {
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKeyUp, true);
  // Magic Remote / mouse
  document.addEventListener('mouseover', (e) => { const f = e.target.closest && e.target.closest('.f'); if (f && f !== cur && scope().contains(f)) focus(f, true); });
  document.addEventListener('click', (e) => {
    const f = e.target.closest && e.target.closest('.f'); if (!f || !scope().contains(f)) return;
    if (f.tagName === 'INPUT') return;
    if (f.onok && !f.onclick) { e.preventDefault(); f.onok(); }
  });
  // roda do Magic Remote / mouse: rola a lista sob o cursor (exigência do checklist da LG)
  document.addEventListener('wheel', (e) => {
    let p = e.target;
    while (p && p !== document.body) {
      const vert = p.scrollHeight > p.clientHeight + 2 && /(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY);
      const hor = !vert && p.scrollWidth > p.clientWidth + 2 && p.classList.contains('row-h');
      if (vert || hor) {
        if (vert) p.scrollTop += e.deltaY; else p.scrollLeft += e.deltaY || e.deltaX;
        if (vert && p.scrollTop + p.clientHeight > p.scrollHeight - 700) { const g = p.querySelector('.grid'); if (g && g._more) g._more(); }
        e.preventDefault(); return;
      }
      p = p.parentElement;
    }
  }, { passive: false });
  // cursor do Magic Remote some: volta o foco visual
  document.addEventListener('cursorStateChange', (e) => { if (e.detail && !e.detail.visibility && !current()) first(); });
}
