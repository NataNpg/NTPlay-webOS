// Chave de nome de canal — igual ao Logos.key da TV Android (tira FHD/HD/4K, acentos, colchetes etc.)
const tags = /\b(fhd|hd|sd|uhd|4k|8k|fhdr|hdr|h\.?265|hevc|h\.?264|leg|legendado|dub|dublado|alt|backup|br|bra|brasil|24h|24 horas|1080p|720p|60fps|50fps|tv)\b/g;
const brk = /\[.*?\]|\(.*?\)|\{.*?\}/g;
export function logoKey(name) {
  let t = String(name || '').toLowerCase();
  if (t.normalize) t = t.normalize('NFD');
  t = t.replace(/[̀-ͯ]/g, '').replace(brk, ' ').replace(/\+/g, ' plus ').replace(/&/g, ' e ').replace(tags, ' ');
  return t.replace(/[^a-z0-9]+/g, '');
}
