import { parseMd as parse } from '@/lib/md';

const PREFIXES = ['almarhumah', 'almarhum', 'almh', 'alm', 'bapak', 'paklik', 'ibu', 'mbah', 'mbok', 'kang', 'mbak', 'mas', 'pak', 'bu', 'sdri', 'sdr', 'yu', 'lik', 'si', 'nduk', 'le'];

export const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

/** "Mbah Jo" → ["mbahjo", "jo"]: as typed first, then with honorifics stripped. */
export function nameCandidates(raw: string) {
  const words = (raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter(Boolean);
  const out: string[] = [];
  const push = (w: string[]) => { const k = w.join(''); if (k && !out.includes(k)) out.push(k); };
  push(words);
  let w = words.slice();
  while (w.length > 1 && PREFIXES.includes(w[0])) { w = w.slice(1); push(w); }
  return out;
}

/** Tembang doc → stanzas of lines (+ translation). */
export function tembangStanzas(md: string) {
  const blocks = parse(md).filter((b: { t: string }) => b.t === 'quote');
  if (!blocks.length) return [] as { lines: string[]; tr: string }[];
  const jv = parse(blocks[0].lines.join('\n')).filter((b: { t: string }) => b.t === 'p')
    .map((b: { raw: string }) => (b.raw.match(/\*[^*]+\*/g) || []).map((x) => x.slice(1, -1).trim()));
  const tr = blocks[1] ? parse(blocks[1].lines.join('\n')).filter((b: { t: string }) => b.t === 'p').map((b: { raw: string }) => b.raw) : [];
  return jv.map((lines: string[], i: number) => ({ lines, tr: tr[i] || '' }));
}
