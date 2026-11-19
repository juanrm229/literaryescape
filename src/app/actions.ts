'use server';

import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { ProgressData } from '@/db/schema';
import { gateEnv, getViewer, loadCase, loadProgress, saveProgress, rules, loadDocMd, sentCount, logEvent, loadPuzzleSolution } from '@/lib/game';
import { berkasStamp, kenalStamp, stamp } from '@/lib/stamps';
import { nameCandidates, tembangStanzas } from '@/lib/text';

async function ctx(slug: string) {
  const v = await getViewer();
  if (!v.readerId) throw new Error('No reader cookie');
  const c = await loadCase(slug, v.admin);
  if (!c) throw new Error('Case not found');
  const [p, env] = await Promise.all([loadProgress(v.readerId, c.id), gateEnv(c)]);
  return { rid: v.readerId, c, p, env, r: rules(c, p, env) };
}

export async function acceptCase(slug: string) {
  const { rid, c, p } = await ctx(slug);
  if (!p.acceptedAt) { await saveProgress(rid, c.id, { data: p.data, acceptedAt: new Date() }); await logEvent(c.id, rid, 'accept'); }
  return { ok: true };
}

export type Award = { kind: 'berkas' | 'kenal'; title: string; svg: string };

/** Called by the reader when a document is actually opened (not on prefetch). */
export async function markRead(slug: string, code: string): Promise<{ awards: Award[] }> {
  const { rid, c, p, r, env } = await ctx(slug);
  const doc = c.docs.find((d) => d.code === code);
  if (!doc || doc.lock || !r.docOpen(code) || p.data.read[code]) return { awards: [] };
  const now = new Date().toISOString();
  const data: ProgressData = { ...p.data, read: { ...p.data.read, [code]: now } };
  const awards: Award[] = [];
  const after = rules(c, { ...p, data }, env);
  const b = c.berkas.find((x) => x.code === doc.berkasCode)!;
  if (b.code !== c.config.finale?.berkas && !data.stamps[b.code] && after.berkasDone(b.code)) {
    data.stamps = { ...data.stamps, [b.code]: now };
    awards.push({ kind: 'berkas', title: `Berkas ${b.code} · ${b.title}`, svg: berkasStamp(c.config, b) });
  }
  if (c.config.kenal[code] && !data.kenal[code]) {
    data.kenal = { ...data.kenal, [code]: now };
    awards.push({ kind: 'kenal', title: c.config.kenal[code][0], svg: kenalStamp(c.config, code) });
  }
  await saveProgress(rid, c.id, { data });
  await logEvent(c.id, rid, 'read', { code, berkas: doc.berkasCode });
  return { awards };
}

export async function setOpened(slug: string, code: string) {
  const { rid, c, p } = await ctx(slug);
  await saveProgress(rid, c.id, { data: { ...p.data, opened: { ...p.data.opened, [code]: true } } });
}

type DeskPatch = Partial<Pick<ProgressData, 'board' | 'extra' | 'notes' | 'bekal' | 'believe' | 'hintsShown'>>;
export async function updateDesk(slug: string, patch: DeskPatch) {
  const { rid, c, p } = await ctx(slug);
  const clean: DeskPatch = {};
  if (patch.board && typeof patch.board === 'object') clean.board = Object.fromEntries(Object.entries(patch.board).filter(([, v]) => ['', 'menunggu', 'sampai'].includes(String(v))).slice(0, 200)) as Record<string, string>;
  if (Array.isArray(patch.extra)) clean.extra = patch.extra.map(String).map((s) => s.slice(0, 80)).slice(0, 60);
  if (typeof patch.notes === 'string') clean.notes = patch.notes.slice(0, 20000);
  if (patch.bekal && typeof patch.bekal === 'object') clean.bekal = Object.fromEntries(Object.entries(patch.bekal).map(([k, v]) => [k.slice(0, 20), !!v]).slice(0, 20));
  if (typeof patch.believe === 'boolean') clean.believe = patch.believe;
  if (typeof patch.hintsShown === 'number' && patch.hintsShown > p.data.hintsShown) await logEvent(c.id, rid, 'hint', { n: patch.hintsShown });
  if (typeof patch.hintsShown === 'number') clean.hintsShown = Math.max(1, Math.min(c.config.hints.length, Math.floor(patch.hintsShown)));
  await saveProgress(rid, c.id, { data: { ...p.data, ...clean } });
}

export async function resetProgress(slug: string) {
  const { rid, c } = await ctx(slug);
  await db.delete(schema.progress).where(and(eq(schema.progress.readerId, rid), eq(schema.progress.caseId, c.id)));
}

/* ------------------------------------------------------------------ */
/* The envelope                                                         */
/* ------------------------------------------------------------------ */
export type PlaceResult = { ok: true; name: string } | { ok: false; code: string; message: string };

export async function placeName(slug: string, raw: string): Promise<PlaceResult> {
  const { rid, c, p, r } = await ctx(slug);
  const reply = (code: string): PlaceResult => ({ ok: false, code, message: c.config.replies[code] ?? code });
  if (!r.kabarUnlocked) return reply('none');
  if (p.data.believe) return reply('believe');
  if (p.sentAt) return reply('dup');
  const cands = nameCandidates(String(raw).slice(0, 80));
  if (!cands.length) return reply('none');
  const all = await db.select({ idx: schema.answers.idx, name: schema.answers.name, aliases: schema.answers.aliases }).from(schema.answers).where(eq(schema.answers.caseId, c.id));
  for (const k of cands) {
    const hit = all.find((a) => a.aliases.includes(k));
    if (hit) {
      if (p.data.placed.includes(hit.idx)) return reply('dup');
      await saveProgress(rid, c.id, { data: { ...p.data, placed: [...p.data.placed, hit.idx] } });
      await logEvent(c.id, rid, 'name_ok', { idx: hit.idx });
      return { ok: true, name: hit.name };
    }
  }
  for (const k of cands) {
    const [w] = await db.select().from(schema.wrongAnswers).where(and(eq(schema.wrongAnswers.caseId, c.id), eq(schema.wrongAnswers.alias, k)));
    if (w) { await logEvent(c.id, rid, 'name_wrong', { input: cands[0], code: w.code }); return reply(w.code); }
  }
  await logEvent(c.id, rid, 'name_wrong', { input: cands[0], code: 'none' });
  return reply('none');
}

export async function unplace(slug: string, idx: number) {
  const { rid, c, p } = await ctx(slug);
  if (p.sentAt) return;
  await saveProgress(rid, c.id, { data: { ...p.data, placed: p.data.placed.filter((i) => i !== idx), recited: p.data.recited.filter((i) => i !== idx) } });
}

async function totalAnswers(caseId: number) {
  return (await db.select({ idx: schema.answers.idx }).from(schema.answers).where(eq(schema.answers.caseId, caseId))).length;
}

export async function recite(slug: string, idx: number) {
  const { rid, c, p } = await ctx(slug);
  if (p.data.placed.length !== await totalAnswers(c.id) || !p.data.placed.includes(idx)) return { ok: false };
  if (!p.data.recited.includes(idx)) await saveProgress(rid, c.id, { data: { ...p.data, recited: [...p.data.recited, idx] } });
  return { ok: true };
}

/** Idempotent: sets the reader's tembang progress to `line` (never backwards, never past the end). */
export async function tembangNext(slug: string, line?: number) {
  const { rid, c, p } = await ctx(slug);
  const total = await totalAnswers(c.id);
  if (p.data.placed.length !== total || p.data.recited.length !== total) return { ok: false };
  const md = (await loadDocMd(c.id, c.config.finale.song)) ?? '';
  const lines = tembangStanzas(md).reduce((n, s) => n + s.lines.length, 0);
  const target = Math.min(lines, Math.max(p.data.tembangLine, typeof line === 'number' ? Math.floor(line) : p.data.tembangLine + 1));
  await saveProgress(rid, c.id, { data: { ...p.data, tembangLine: target } });
  return { ok: true, done: target >= lines };
}

export type SendResult = { ok: true; count: number } | { ok: false; reason: 'incomplete' | 'recite' | 'tembang' | 'believe' };
export async function sendKabar(slug: string): Promise<SendResult> {
  const { rid, c, p } = await ctx(slug);
  if (p.sentAt) return { ok: true, count: await sentCount(c.id) };
  if (p.data.believe) return { ok: false, reason: 'believe' };
  const total = await totalAnswers(c.id);
  if (p.data.placed.length !== total) return { ok: false, reason: 'incomplete' };
  if (p.data.recited.length !== total) return { ok: false, reason: 'recite' };
  const md = (await loadDocMd(c.id, c.config.finale.song)) ?? '';
  const lines = tembangStanzas(md).reduce((n, s) => n + s.lines.length, 0);
  if (p.data.tembangLine < lines) return { ok: false, reason: 'tembang' };
  await saveProgress(rid, c.id, { data: p.data, sentAt: new Date() });
  await logEvent(c.id, rid, 'sent', { minutes: p.acceptedAt ? Math.round((Date.now() - new Date(p.acceptedAt).getTime()) / 60000) : null });
  return { ok: true, count: await sentCount(c.id) };
}


/* ------------------------------------------------------------------ */
/* Puzzles & locks — every answer is checked here, never in the browser */
/* ------------------------------------------------------------------ */
export type PuzzleResult =
  | { ok: true; message: string; stamp?: string; stampTitle?: string }
  | { ok: false; message: string; cooldown?: number };

const COOLDOWN_AFTER = 5;      // wrong tries before the lock gets heavy
const COOLDOWN_MS = 8000;

function checkAnswer(kind: string, sol: Record<string, unknown>, answer: unknown): boolean {
  switch (kind) {
    case 'text': case 'cipher': {
      const list = ((sol.answers as string[]) || []).map(norm);
      return typeof answer === 'string' && list.includes(norm(answer));
    }
    case 'padlock': return typeof answer === 'string' && answer.toUpperCase() === String(sol.code || '').toUpperCase();
    case 'date': return typeof answer === 'string' && answer === sol.date;
    case 'order': return Array.isArray(answer) && JSON.stringify(answer) === JSON.stringify(sol.order);
    case 'match': {
      const pairs = (sol.pairs || {}) as Record<string, string>;
      const a = (answer || {}) as Record<string, string>;
      return Object.keys(pairs).length > 0 && Object.entries(pairs).every(([k, v]) => a[k] === v) && Object.keys(a).length === Object.keys(pairs).length;
    }
    case 'hotspot': {
      const t = sol as { x: number; y: number; r: number };
      const a = answer as { x: number; y: number };
      return !!a && Math.hypot(a.x - t.x, a.y - t.y) <= t.r;
    }
    case 'frequency': {
      const t = sol as { freq: number; tol?: number };
      return typeof answer === 'number' && Math.abs(answer - t.freq) <= (t.tol ?? 0.15);
    }
    default: return false;
  }
}
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

export async function solvePuzzle(slug: string, key: string, answer: unknown): Promise<PuzzleResult> {
  const { rid, c, p } = await ctx(slug);
  const meta = c.puzzles.find((z) => z.key === key);
  const pz = await loadPuzzleSolution(c.id, key);
  if (!meta || !pz) return { ok: false, message: 'Gembok ini tidak ada.' };
  if (p.data.solved?.[key]) return { ok: true, message: 'Sudah terbuka.' };
  const attempts = (p.data.attempts?.[key] ?? 0);
  const last = p.data.lastWrong?.[key] ? new Date(p.data.lastWrong[key]).getTime() : 0;
  if (attempts >= COOLDOWN_AFTER && Date.now() - last < COOLDOWN_MS) {
    return { ok: false, message: 'Gemboknya macet. Tunggu sebentar.', cooldown: Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000) };
  }
  const sol = pz.solution as Record<string, unknown>;
  const now = new Date().toISOString();
  if (checkAnswer(pz.kind, sol, answer)) {
    const data = { ...p.data, solved: { ...(p.data.solved ?? {}), [key]: now } };
    await saveProgress(rid, c.id, { data });
    await logEvent(c.id, rid, 'puzzle_solve', { key, attempts: attempts + 1, hints: p.data.pzHints?.[key] ?? 0 });
    const reward = (pz.reward || {}) as { message?: string; stamp?: { title: string; sub?: string; motif?: string; palette?: string; year?: string } };
    const stampSvg = reward.stamp ? stamp({ title: reward.stamp.title, sub: reward.stamp.sub || meta.title, motif: reward.stamp.motif || 'key', palette: reward.stamp.palette || 'night', year: reward.stamp.year || '' }) as string : undefined;
    return { ok: true, message: reward.message || 'Terbuka.', stamp: stampSvg, stampTitle: reward.stamp?.title };
  }
  const replies = (sol.replies || {}) as Record<string, string>;
  const specific = typeof answer === 'string' ? replies[norm(answer)] : undefined;
  await saveProgress(rid, c.id, { data: { ...p.data, attempts: { ...(p.data.attempts ?? {}), [key]: attempts + 1 }, lastWrong: { ...(p.data.lastWrong ?? {}), [key]: now } } });
  await logEvent(c.id, rid, 'puzzle_wrong', { key, input: typeof answer === 'string' ? norm(answer).slice(0, 40) : JSON.stringify(answer).slice(0, 80) });
  return { ok: false, message: specific || (sol.wrongMessage as string) || 'Belum.' };
}

/** Next hint for a puzzle. Costs clue tokens when the case uses a clue economy. */
export async function puzzleHint(slug: string, key: string): Promise<{ ok: boolean; hints: string[]; message?: string; tokens: number | null }> {
  const { rid, c, p, r } = await ctx(slug);
  const pz = await loadPuzzleSolution(c.id, key);
  const all = ((pz?.solution as { hints?: string[] })?.hints) ?? [];
  const opened = p.data.pzHints?.[key] ?? 0;
  const tokens = Number.isFinite(r.tokens) ? r.tokens : null;
  if (opened >= all.length) return { ok: false, hints: all.slice(0, opened), message: 'Tidak ada clue lagi.', tokens };
  const cost = c.config.clues?.cost ?? 0;
  if (tokens !== null && tokens < cost) return { ok: false, hints: all.slice(0, opened), message: 'Token clue habis. Selesaikan berkas untuk dapat token.', tokens };
  const data = { ...p.data, pzHints: { ...(p.data.pzHints ?? {}), [key]: opened + 1 }, tokensSpent: (p.data.tokensSpent ?? 0) + cost };
  await saveProgress(rid, c.id, { data });
  await logEvent(c.id, rid, 'puzzle_hint', { key, n: opened + 1 });
  return { ok: true, hints: all.slice(0, opened + 1), tokens: tokens === null ? null : tokens - cost };
}

/** Radio dial: the server answers only with signal strength, never the frequency. */
export async function tunePuzzle(slug: string, key: string, freq: number): Promise<{ signal: number }> {
  const { c } = await ctx(slug);
  const pz = await loadPuzzleSolution(c.id, key);
  if (!pz || pz.kind !== 'frequency') return { signal: 0 };
  const t = pz.solution as { freq: number; tol?: number };
  const d = Math.abs(Number(freq) - t.freq);
  return { signal: Math.max(0, Math.min(1, 1 - d / 2.5)) };
}
