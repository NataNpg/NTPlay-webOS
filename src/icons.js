// Ícones em SVG embutido. Símbolos de texto (☰ ↻ ⏯ ⏭ …) dependem da fonte da TV e aparecem como
// quadrado em muitos modelos LG; SVG desenha igual em qualquer TV e herda a cor do texto.
const P = {
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15.5 15.5l5.5 5.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M20 3v6h-6z" fill="currentColor"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
  pause: '<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor"/>',
  playpause: '<path d="M3 5v14l9-7z" fill="currentColor"/><path d="M14 5h3v14h-3zM19 5h3v14h-3z" fill="currentColor"/>',
  next: '<path d="M4 5v14l10-7z" fill="currentColor"/><path d="M16 5h3.5v14H16z" fill="currentColor"/>',
  rw: '<path d="M11.5 5v14L2.5 12zM21.5 5v14l-9-7z" fill="currentColor"/>',
  ff: '<path d="M12.5 5v14l9-7zM2.5 5v14l9-7z" fill="currentColor"/>',
  star: '<path d="M12 2.8l2.85 5.8 6.4.93-4.63 4.5 1.1 6.37L12 17.4l-5.72 3 1.1-6.37-4.63-4.5 6.4-.93z" fill="currentColor"/>',
  staro: '<path d="M12 2.8l2.85 5.8 6.4.93-4.63 4.5 1.1 6.37L12 17.4l-5.72 3 1.1-6.37-4.63-4.5 6.4-.93z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  tv: '<rect x="2.5" y="5" width="19" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 21h8M9 2.5l3 2.5 3-2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  audio: '<path d="M3 9.5h4l5-4.5v14l-5-4.5H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  folder: '<path d="M2.5 6.5a2 2 0 0 1 2-2h5l2 2.5h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" fill="currentColor"/>',
  plus: '<path d="M12 4.5v15M4.5 12h15" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  check: '<path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  cloud: '<path d="M7 19h10.5a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.6 9.1 5 5 0 0 0 7 19z" fill="currentColor"/>',
  on: '<circle cx="12" cy="12" r="6.5" fill="currentColor"/>',
  off: '<circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  up: '<path d="M12 6l8 11H4z" fill="currentColor"/>',
  down: '<path d="M12 18L4 7h16z" fill="currentColor"/>',
  wait: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".35"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  ball: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z" fill="currentColor"/>',
};
/** devolve o SVG do ícone (para usar dentro de innerHTML) */
export function ic(name) {
  return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';
}
