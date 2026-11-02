/* Funções que o navegador das TVs LG 2018–2019 (Chrome 53) ainda não tem. Carregado antes de tudo. */
(function () {
  if (!Object.values) Object.values = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };
  if (!Object.entries) Object.entries = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }); };
  if (!Object.fromEntries) Object.fromEntries = function (l) { var o = {}; Array.prototype.forEach.call(Array.from(l), function (e) { o[e[0]] = e[1]; }); return o; };
  if (!String.prototype.padStart) String.prototype.padStart = function (n, s) { var t = String(this); s = s === undefined ? ' ' : String(s); while (t.length < n) t = s + t; return t.slice(t.length - Math.max(n, String(this).length)); };
  if (!String.prototype.padEnd) String.prototype.padEnd = function (n, s) { var t = String(this); s = s === undefined ? ' ' : String(s); while (t.length < n) t += s; return t.slice(0, Math.max(n, String(this).length)); };
  if (typeof Promise !== 'undefined' && !Promise.prototype.finally) Promise.prototype.finally = function (f) { return this.then(function (v) { return Promise.resolve(f()).then(function () { return v; }); }, function (e) { return Promise.resolve(f()).then(function () { throw e; }); }); };
  if (!Array.prototype.flat) Array.prototype.flat = function (d) { d = d === undefined ? 1 : d; return d > 0 ? this.reduce(function (a, v) { return a.concat(Array.isArray(v) ? v.flat(d - 1) : v); }, []) : this.slice(); };
})();
