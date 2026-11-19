import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { CaseConfig } from '@/lib/case-config';
import { parseBerkasFile, parseEndings, berkasSort } from './parse';

/** Replace one berkas (and its documents) from a markdown file. Returns a short summary. */
export async function importBerkasMarkdown(caseId: number, text: string) {
  const parsed = parseBerkasFile(text);
  const [c] = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId));
  if (!c) throw new Error('Case not found');
  const cfg = c.config as unknown as CaseConfig;
  const finale = cfg.finale;

  await db.transaction(async (tx) => {
    await tx.insert(schema.berkas)
      .values({ caseId, code: parsed.code, title: parsed.title, intro: parsed.intro, sort: berkasSort(parsed.code) })
      .onConflictDoUpdate({ target: [schema.berkas.caseId, schema.berkas.code], set: { title: parsed.title, intro: parsed.intro, sort: berkasSort(parsed.code) } });
    await tx.delete(schema.documents).where(and(eq(schema.documents.caseId, caseId), eq(schema.documents.berkasCode, parsed.code)));
    let i = 0;
    for (const d of parsed.docs) {
      if (finale?.endingsDoc && d.code === finale.endingsDoc) {
        const endings = parseEndings(d.md);
        await tx.update(schema.cases).set({ config: { ...cfg, endings } as unknown as Record<string, unknown>, updatedAt: new Date() }).where(eq(schema.cases.id, caseId));
        continue;
      }
      const lock = finale && d.code === finale.tape ? 'solve' : finale && d.code === finale.epilogue ? 'date' : null;
      await tx.insert(schema.documents).values({
        caseId, berkasCode: parsed.code, code: d.code, title: d.title, md: d.md,
        sort: berkasSort(parsed.code) * 1000 + i++, lock,
      });
    }
  });
  return { berkas: parsed.code, title: parsed.title, docs: parsed.docs.length };
}

export type AnswerInput = { name: string; aliases: string[]; habit: string; question: string; year: number };

export async function replaceAnswers(caseId: number, list: AnswerInput[], wrong: Record<string, string[]>) {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const seen = new Set<string>();
  for (const a of list) for (const al of [a.name, ...a.aliases]) {
    const k = norm(al);
    if (seen.has(k)) continue;
    seen.add(k);
  }
  for (const [, names] of Object.entries(wrong)) for (const n of names) {
    if (seen.has(norm(n))) throw new Error(`"${n}" is both a right and a wrong answer`);
  }
  await db.transaction(async (tx) => {
    await tx.delete(schema.answers).where(eq(schema.answers.caseId, caseId));
    await tx.delete(schema.wrongAnswers).where(eq(schema.wrongAnswers.caseId, caseId));
    if (list.length) {
      await tx.insert(schema.answers).values(list.map((a, idx) => ({
        caseId, idx, name: a.name, habit: a.habit, question: a.question, year: a.year,
        aliases: Array.from(new Set([a.name, ...a.aliases].map(norm).filter(Boolean))),
      })));
    }
    const rows: { caseId: number; alias: string; code: string }[] = [];
    const used = new Set<string>();
    for (const [code, names] of Object.entries(wrong)) for (const n of names) {
      const alias = norm(n);
      if (!alias || used.has(alias)) continue;
      used.add(alias);
      rows.push({ caseId, alias, code });
    }
    if (rows.length) await tx.insert(schema.wrongAnswers).values(rows);
  });
  return { answers: list.length };
}

export type PuzzleInput = { key: string; kind: string; title?: string; prompt?: string; config?: Record<string, unknown>; solution: Record<string, unknown>; reward?: Record<string, unknown> };
const PUZZLE_KINDS = ['text', 'cipher', 'padlock', 'date', 'order', 'match', 'hotspot', 'frequency'];

/** Replace every puzzle of a case. Solutions are stored server-side only. */
export async function replacePuzzles(caseId: number, list: PuzzleInput[]) {
  const keys = new Set<string>();
  for (const p of list) {
    if (!p.key || !/^[\w-]+$/.test(p.key)) throw new Error(`Puzzle key tidak valid: ${p.key}`);
    if (keys.has(p.key)) throw new Error(`Puzzle key dobel: ${p.key}`);
    keys.add(p.key);
    if (!PUZZLE_KINDS.includes(p.kind)) throw new Error(`Jenis puzzle "${p.kind}" tidak dikenal (${PUZZLE_KINDS.join(', ')})`);
    if (!p.solution || typeof p.solution !== 'object') throw new Error(`Puzzle ${p.key} butuh "solution"`);
  }
  await db.transaction(async (tx) => {
    await tx.delete(schema.puzzles).where(eq(schema.puzzles.caseId, caseId));
    if (list.length) {
      await tx.insert(schema.puzzles).values(list.map((p, i) => ({
        caseId, key: p.key, kind: p.kind, title: p.title ?? '', prompt: p.prompt ?? '',
        config: p.config ?? {}, solution: p.solution, reward: p.reward ?? {}, sort: i,
      })));
    }
  });
  return { puzzles: list.length };
}
