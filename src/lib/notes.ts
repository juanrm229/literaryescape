import 'server-only';
import { and, count, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { memo } from '@/lib/game';

/**
 * Margin notes are public, so they are scrubbed of anything that would solve the case for someone else:
 * every answer name and alias, and every lock's solution. The writer's own words survive; the spoiler doesn't.
 */
const secrets = (caseId: number) => memo('secrets:' + caseId, async () => {
  const [answers, puzzles] = await Promise.all([
    db.select({ name: schema.answers.name, aliases: schema.answers.aliases }).from(schema.answers).where(eq(schema.answers.caseId, caseId)),
    db.select({ solution: schema.puzzles.solution }).from(schema.puzzles).where(eq(schema.puzzles.caseId, caseId)),
  ]);
  const out = new Set<string>();
  for (const a of answers) { out.add(a.name); a.aliases.forEach((x) => out.add(x)); }
  for (const { solution: s } of puzzles) {
    for (const k of ['code', 'date', 'freq']) if (s[k] != null) out.add(String(s[k]));
    if (Array.isArray(s.answers)) (s.answers as unknown[]).forEach((x) => out.add(String(x)));
  }
  return [...out].filter((w) => w.trim().length >= 3).sort((a, b) => b.length - a.length);
});

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function redact(caseId: number, text: string) {
  const words = await secrets(caseId);
  if (!words.length) return text;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(escRe).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  return text.replace(re, (_, pre: string, w: string) => pre + '▮'.repeat(Math.min(8, Math.max(3, w.length))));
}

export async function notesFor(caseId: number, code: string, limit = 40) {
  const rows = await db.select().from(schema.docNotes)
    .where(and(eq(schema.docNotes.caseId, caseId), eq(schema.docNotes.code, code), eq(schema.docNotes.hidden, false)))
    .orderBy(desc(schema.docNotes.at)).limit(limit);
  return rows;
}

export async function noteCount(caseId: number, code: string) {
  const [{ n }] = await db.select({ n: count() }).from(schema.docNotes)
    .where(and(eq(schema.docNotes.caseId, caseId), eq(schema.docNotes.code, code), eq(schema.docNotes.hidden, false)));
  return Number(n);
}
