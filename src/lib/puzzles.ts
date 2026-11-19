import 'server-only';
import type { CaseBundle, Progress, Rules } from '@/lib/game';
import { loadPuzzleSolution } from '@/lib/game';
import { render } from '@/lib/md';
import { stamp } from '@/lib/stamps';
import { photo, map, sketch } from '@/lib/svg';

/** What the browser is allowed to know about a puzzle. Never contains the solution. */
export type PuzzleView = {
  key: string; kind: string; title: string; promptHtml: string;
  config: Record<string, unknown>;
  solved: boolean; hints: string[]; hintTotal: number; tokens: number | null; hintCost: number;
  stamp?: string; message?: string; artSvg?: string;
};

/**
 * Uji Ingatan. Not pass/fail: any complete set of answers opens it. What the reader gets back is a mirror —
 * how many of their "memories" came from the radio play (or the 2018 thread) rather than from the evidence.
 */
export type MemorySolution = { truth: ('b' | 's')[]; sandiwara?: number[]; utas?: number[]; messages?: { sandiwara?: string; utas?: string; perfect?: string; clean?: string; after?: string } };
export function memoryResult(sol: MemorySolution, answers: string[]) {
  const hitB = (n: number) => answers[n - 1] === 'b';
  const fromPlay = (sol.sandiwara ?? []).filter(hitB).length;
  const fromThread = (sol.utas ?? []).some(hitB);
  const correct = sol.truth.filter((t, i) => answers[i] === t).length;
  const m = sol.messages ?? {};
  const parts: string[] = [];
  if (fromPlay && m.sandiwara) parts.push(m.sandiwara.replace(/\[X\]|\{X\}/g, String(fromPlay)));
  if (fromThread && m.utas) parts.push(m.utas);
  if (correct === sol.truth.length && m.perfect) parts.push(m.perfect);
  if (!parts.length && m.clean) parts.push(m.clean.replace(/\{C\}/g, String(correct)).replace(/\{N\}/g, String(sol.truth.length)));
  if (m.after) parts.push(m.after);
  return { fromPlay, fromThread, correct, total: sol.truth.length, message: parts.join('\n\n') };
}

export const puzzleKeysIn = (md: string) => Array.from(md.matchAll(/^::puzzle\[([\w-]+)\]\s*$/gm)).map((m) => m[1]);

export async function puzzleViews(c: CaseBundle, p: Progress, r: Rules, keys: string[]): Promise<PuzzleView[]> {
  const out: PuzzleView[] = [];
  for (const key of Array.from(new Set(keys))) {
    const meta = c.puzzles.find((z) => z.key === key);
    if (!meta) continue;
    const sol = await loadPuzzleSolution(c.id, key);
    const hintsAll = ((sol?.solution as { hints?: string[] })?.hints) ?? [];
    const opened = p.data.pzHints?.[key] ?? 0;
    const solved = !!p.data.solved?.[key];
    const reward = (meta.reward || {}) as { message?: string; stamp?: { title: string; sub?: string; motif?: string; palette?: string; year?: string } };
    out.push({
      key, kind: meta.kind, title: meta.title, promptHtml: render(meta.prompt || ''), config: meta.config,
      solved, hints: hintsAll.slice(0, opened), hintTotal: hintsAll.length,
      tokens: Number.isFinite(r.tokens) ? r.tokens : null, hintCost: c.config.clues?.cost ?? 0,
      stamp: solved && reward.stamp ? stamp({ title: reward.stamp.title, sub: reward.stamp.sub || meta.title, motif: reward.stamp.motif || 'key', palette: reward.stamp.palette || 'night', year: reward.stamp.year || '' }) as string : undefined,
      message: solved ? (meta.kind === 'memory' && p.data.memory?.[key] ? memoryResult(sol?.solution as MemorySolution, p.data.memory[key]).message : reward.message) : undefined,
      artSvg: meta.kind === 'hotspot' ? ({ photo, map, sketch } as Record<string, () => string>)[String((meta.config as { art?: string }).art)]?.() : undefined,
    });
  }
  return out;
}
