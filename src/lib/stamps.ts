import { stamp, blankStamp, ORDER } from '@/lib/svg';
import type { CaseConfig } from '@/lib/case-config';

/** Server-side stamp art (SVG strings). Generated on the server so ids never clash during hydration. */
export const berkasStamp = (cfg: CaseConfig, b: { code: string; title: string }) => {
  const meta = cfg.berkas[b.code] ?? { years: '', motif: 'wave', palette: 'sea' };
  return stamp({
    title: b.code === '0' ? 'Pengantar' : b.title, sub: `Berkas ${b.code} · ${meta.years}`,
    motif: meta.motif, palette: meta.palette, value: 'Rp 50', year: (meta.years.match(/\d{4}/) || [''])[0],
  }) as string;
};

export const kenalStamp = (cfg: CaseConfig, code: string) => {
  const k = cfg.kenal[code];
  if (!k) return blankStamp('?') as string;
  const [name, habit, boat] = k;
  const i = Object.keys(cfg.kenal).indexOf(code);
  return stamp({ title: name, sub: boat, initial: name[0], habit, palette: ORDER[i % ORDER.length], year: '1979' }) as string;
};

export type Person = { idx: number; name: string; habit: string; question: string; year: number };
export const kabarStamp = (p: Person, postmarked: boolean, baseYear = 1979) => stamp({
  title: p.name, sub: p.year === baseYear ? `Laut · ${p.year}` : `Windu · ${p.year}`, initial: p.name[0], habit: p.habit,
  palette: p.year === baseYear ? ORDER[p.idx % ORDER.length] : ['red', 'sand', 'ink', 'green', 'olive', 'slate', 'green', 'plum'][Math.max(0, p.idx - 19) % 8],
  year: String(p.year), postmark: postmarked ? ['WIS YA', 'LAUT'] : null,
}) as string;

export { blankStamp, stamp };
