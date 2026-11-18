/**
 * Markdown archive → berkas + documents.
 * One file per berkas:  "# Berkas IV · Windu"  then  "## IV-01 · Title"  per document.
 * Lines meant for the site builder (production notes, "Hanya tampil…", "[Formulir…") are stripped.
 */
export type ParsedDoc = { code: string; title: string; md: string };
export type ParsedBerkas = { code: string; title: string; intro: string; docs: ParsedDoc[] };

const trimRules = (s: string) => s.replace(/^\s+/, '').replace(/(\n\s*---\s*)+\s*$/, '').trim();

export function parseBerkasFile(text: string): ParsedBerkas {
  const lines = text.replace(/\r/g, '').split('\n');
  const h1 = lines.findIndex((l) => l.startsWith('# '));
  if (h1 < 0) throw new Error('Missing "# Berkas X · Title" heading');
  const head = lines[h1].slice(2).trim();
  const m = head.match(/^Berkas\s+(\S+)\s+·\s+(.+)$/);
  const code = m ? m[1] : '0';
  const title = m ? m[2] : 'Pengantar';

  const parts = lines.slice(h1 + 1).join('\n').split(/^## /m);
  let intro = parts.shift()!
    .split('\n')
    .filter((l) => !/^\w{3} \d+, \d{4} · @/.test(l))
    .filter((l) => !l.includes('Catatan produksi'))
    .join('\n');
  intro = trimRules(intro);
  if (/^-+$/.test(intro)) intro = '';

  const docs = parts.map((p) => {
    const nl = p.indexOf('\n');
    const [dcode, ...rest] = p.slice(0, nl).trim().split(' · ');
    let md = p.slice(nl + 1);
    const form = md.indexOf('*\\[Formulir');
    if (form >= 0) md = md.slice(0, form);
    md = md.split('\n').filter((l) => !l.startsWith('*\\[Hanya tampil') && !l.includes('Catatan produksi')).join('\n');
    return { code: dcode.trim(), title: rest.join(' · ').trim(), md: trimRules(md) };
  });
  return { code, title, intro, docs };
}

/** "**Jika tanggal hari ini sebelum …:**" sections → endings */
export function parseEndings(md: string) {
  const cut = (label: RegExp) => {
    const m = md.match(label);
    if (!m || m.index === undefined) return '';
    const after = md.slice(m.index + m[0].length);
    const next = after.search(/\n\*\*Jika /);
    return (next < 0 ? after : after.slice(0, next)).trim();
  };
  return {
    before: cut(/\*\*Jika tanggal hari ini sebelum[^*]*\*\*/),
    incomplete: cut(/\*\*Jika jawaban belum lengkap[^*]*\*\*/),
    after: cut(/\*\*Jika tanggal sudah lewat[^*]*\*\*/),
  };
}

export const ROMAN_ORDER = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const berkasSort = (code: string) => { const i = ROMAN_ORDER.indexOf(code); return i < 0 ? 99 : i; };
