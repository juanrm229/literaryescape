'use server';

import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { ProgressData } from '@/db/schema';
import { getViewer, loadCase, loadProgress, saveProgress, rules, loadDocMd, sentCount } from '@/lib/game';
import { berkasStamp, kenalStamp } from '@/lib/stamps';
import { nameCandidates, tembangStanzas } from '@/lib/text';

async function ctx(slug: string) {
  const [v, c] = await Promise.all([getViewer(), loadCase(slug)]);
  if (!v.readerId) throw new Error('No reader cookie');
  if (!c) throw new Error('Case not found');
  const p = await loadProgress(v.readerId, c.id);
  return { rid: v.readerId, c, p, r: rules(c, p) };
}

export async function acceptCase(slug: string) {
  const { rid, c, p } = await ctx(slug);
  if (!p.acceptedAt) await saveProgress(rid, c.id, { data: p.data, acceptedAt: new Date() });
  return { ok: true };
}

export type Award = { kind: 'berkas' | 'kenal'; title: string; svg: string };

/** Called by the reader when a document is actually opened (not on prefetch). */
export async function markRead(slug: string, code: string): Promise<{ awards: Award[] }> {
  const { rid, c, p, r } = await ctx(slug);
  const doc = c.docs.find((d) => d.code === code);
  if (!doc || doc.lock || !r.berkasUnlocked(doc.berkasCode) || p.data.read[code]) return { awards: [] };
  const now = new Date().toISOString();
  const data: ProgressData = { ...p.data, read: { ...p.data.read, [code]: now } };
  const awards: Award[] = [];
  const after = rules(c, { ...p, data });
  const b = c.berkas.find((x) => x.code === doc.berkasCode)!;
  if (b.code !== c.config.finale.berkas && !data.stamps[b.code] && after.berkasDone(b.code)) {
    data.stamps = { ...data.stamps, [b.code]: now };
    awards.push({ kind: 'berkas', title: `Berkas ${b.code} · ${b.title}`, svg: berkasStamp(c.config, b) });
  }
  if (c.config.kenal[code] && !data.kenal[code]) {
    data.kenal = { ...data.kenal, [code]: now };
    awards.push({ kind: 'kenal', title: c.config.kenal[code][0], svg: kenalStamp(c.config, code) });
  }
  await saveProgress(rid, c.id, { data });
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
      return { ok: true, name: hit.name };
    }
  }
  for (const k of cands) {
    const [w] = await db.select().from(schema.wrongAnswers).where(and(eq(schema.wrongAnswers.caseId, c.id), eq(schema.wrongAnswers.alias, k)));
    if (w) return reply(w.code);
  }
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
  return { ok: true, count: await sentCount(c.id) };
}

