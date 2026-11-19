import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { ProgressData } from '@/db/schema';
import { getSession, isAdminEmail } from '@/lib/auth';
import type { CaseConfig } from '@/lib/case-config';
import { parseYMD } from '@/lib/jw';

export const emptyProgress = (): ProgressData => ({
  read: {}, opened: {}, stamps: {}, kenal: {}, board: {}, extra: [], notes: '', bekal: {},
  placed: [], recited: [], tembangLine: 0, believe: false, hintsShown: 1,
});

/** "Now" on the server. PM_TODAY lets you rehearse the windu date outside production. */
export function serverNow() {
  const t = process.env.NODE_ENV !== 'production' ? process.env.PM_TODAY : '';
  if (t) { const d = parseYMD(t); d.setHours(21); return d; }
  return new Date();
}

/* ------------------------------------------------------------------ */
/* Reader identity                                                     */
/* ------------------------------------------------------------------ */
export type Viewer = { readerId: string | null; user: { id: string; email: string; name: string } | null; admin: boolean };

async function mergeProgress(fromReader: string, intoReader: string) {
  const rows = await db.select().from(schema.progress).where(eq(schema.progress.readerId, fromReader));
  for (const r of rows) {
    const [mine] = await db.select().from(schema.progress).where(and(eq(schema.progress.readerId, intoReader), eq(schema.progress.caseId, r.caseId)));
    if (!mine) {
      await db.insert(schema.progress).values({ ...r, readerId: intoReader });
      continue;
    }
    const a = mine.data, b = r.data;
    const merged: ProgressData = {
      ...a,
      read: { ...b.read, ...a.read }, opened: { ...b.opened, ...a.opened }, stamps: { ...b.stamps, ...a.stamps }, kenal: { ...b.kenal, ...a.kenal },
      board: { ...b.board, ...a.board }, bekal: { ...b.bekal, ...a.bekal },
      extra: Array.from(new Set([...a.extra, ...b.extra])),
      notes: [a.notes, b.notes].filter(Boolean).join('\n\n'),
      placed: Array.from(new Set([...a.placed, ...b.placed])),
      recited: Array.from(new Set([...a.recited, ...b.recited])),
      tembangLine: Math.max(a.tembangLine, b.tembangLine),
      hintsShown: Math.max(a.hintsShown, b.hintsShown),
      believe: a.believe && b.believe,
    };
    await db.update(schema.progress).set({
      data: merged,
      acceptedAt: mine.acceptedAt ?? r.acceptedAt,
      sentAt: mine.sentAt ?? r.sentAt,
      updatedAt: new Date(),
    }).where(and(eq(schema.progress.readerId, intoReader), eq(schema.progress.caseId, r.caseId)));
  }
  await db.delete(schema.readers).where(eq(schema.readers.id, fromReader));
}

/**
 * Who is reading. Anonymous readers are identified by the `pm_reader` cookie (set in proxy.ts).
 * When signed in, the account's reader wins; an unclaimed anonymous reader is claimed or merged into it.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const jar = await cookies();
  const cookieId = jar.get('pm_reader')?.value ?? null;
  // no session cookie → anonymous, zero DB round trips
  if (!jar.getAll().some((c) => c.name.includes('better-auth.session_token'))) return { readerId: cookieId, user: null, admin: false };
  const session = await getSession().catch(() => null);
  if (!session?.user) return { readerId: cookieId, user: null, admin: false };

  const u = { id: session.user.id, email: session.user.email, name: session.user.name };
  const admin = isAdminEmail(u.email);
  const [[mine], [anon]] = await Promise.all([
    db.select().from(schema.readers).where(eq(schema.readers.userId, u.id)),
    cookieId ? db.select().from(schema.readers).where(eq(schema.readers.id, cookieId)) : Promise.resolve([] as (typeof schema.readers.$inferSelect)[]),
  ]);

  if (mine) {
    if (anon && !anon.userId && anon.id !== mine.id) await mergeProgress(anon.id, mine.id);
    return { readerId: mine.id, user: u, admin };
  }
  if (anon && !anon.userId) {
    await db.update(schema.readers).set({ userId: u.id }).where(eq(schema.readers.id, anon.id));
    return { readerId: anon.id, user: u, admin };
  }
  const id = !anon && cookieId ? cookieId : crypto.randomUUID();
  await db.insert(schema.readers).values({ id, userId: u.id }).onConflictDoNothing();
  return { readerId: id, user: u, admin };
});

export async function ensureReader(id: string) {
  await db.insert(schema.readers).values({ id }).onConflictDoNothing();
}

/* ------------------------------------------------------------------ */
/* Case data                                                           */
/* ------------------------------------------------------------------ */
export type DocMeta = { code: string; title: string; berkasCode: string; sort: number; lock: 'solve' | 'date' | null; words: number };
export type CaseBundle = {
  id: number; slug: string; no: string; title: string; tagline: string; hook: string; author: string; status: string;
  config: CaseConfig;
  berkas: { code: string; title: string; intro: string; sort: number }[];
  docs: DocMeta[];
};

/* Content changes only through /admin or a deploy, so keep it in memory for a minute per server
   instance instead of asking the database on every tap. Admin writes call clearContentCache(). */
const g = globalThis as unknown as { pmMemo?: Map<string, { at: number; v: Promise<unknown> }> };
const memoStore = (g.pmMemo ??= new Map());
const TTL = 60_000;
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memoStore.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v as Promise<T>;
  const v = fn().catch((e) => { memoStore.delete(key); throw e; });
  memoStore.set(key, { at: Date.now(), v });
  return v;
}
export function clearContentCache() { memoStore.clear(); }

export const listCases = cache(async () => memo('cases', () =>
  db.select({ id: schema.cases.id, slug: schema.cases.slug, no: schema.cases.no, title: schema.cases.title, tagline: schema.cases.tagline, hook: schema.cases.hook, status: schema.cases.status, config: schema.cases.config })
    .from(schema.cases).where(sql`${schema.cases.status} <> 'draft'`).orderBy(asc(schema.cases.sort))));

export const loadCase = cache((slug: string): Promise<CaseBundle | null> => memo('case:' + slug, async () => {
  const [c] = await db.select().from(schema.cases).where(eq(schema.cases.slug, slug));
  if (!c || c.status !== 'live') return null;
  const [b, docs] = await Promise.all([db.select({ code: schema.berkas.code, title: schema.berkas.title, intro: schema.berkas.intro, sort: schema.berkas.sort })
    .from(schema.berkas).where(eq(schema.berkas.caseId, c.id)).orderBy(asc(schema.berkas.sort)),
  db.select({
    code: schema.documents.code, title: schema.documents.title, berkasCode: schema.documents.berkasCode, sort: schema.documents.sort, lock: schema.documents.lock,
    words: sql<number>`coalesce(array_length(regexp_split_to_array(${schema.documents.md}, '\\s+'), 1), 0)`,
  }).from(schema.documents).where(eq(schema.documents.caseId, c.id)).orderBy(asc(schema.documents.sort))]);
  return { ...c, config: c.config as unknown as CaseConfig, berkas: b, docs };
}));

export function loadDocMd(caseId: number, code: string) {
  return memo(`md:${caseId}:${code}`, async () => {
    const [d] = await db.select({ md: schema.documents.md }).from(schema.documents).where(and(eq(schema.documents.caseId, caseId), eq(schema.documents.code, code)));
    return d?.md ?? null;
  });
}

export async function loadProgress(readerId: string | null, caseId: number) {
  if (!readerId) return { acceptedAt: null as Date | null, sentAt: null as Date | null, data: emptyProgress() };
  const [p] = await db.select().from(schema.progress).where(and(eq(schema.progress.readerId, readerId), eq(schema.progress.caseId, caseId)));
  if (!p) return { acceptedAt: null as Date | null, sentAt: null as Date | null, data: emptyProgress() };
  return { acceptedAt: p.acceptedAt, sentAt: p.sentAt, data: { ...emptyProgress(), ...p.data } };
}
export type Progress = Awaited<ReturnType<typeof loadProgress>>;

export async function saveProgress(readerId: string, caseId: number, patch: { data?: ProgressData; acceptedAt?: Date; sentAt?: Date }) {
  try { await upsertProgress(readerId, caseId, patch); } catch {
    // first write of a brand-new reader: create the reader row, then retry
    await ensureReader(readerId);
    await upsertProgress(readerId, caseId, patch);
  }
}
async function upsertProgress(readerId: string, caseId: number, patch: { data?: ProgressData; acceptedAt?: Date; sentAt?: Date }) {
  const now = new Date();
  await db.insert(schema.progress).values({ readerId, caseId, data: patch.data ?? emptyProgress(), acceptedAt: patch.acceptedAt, sentAt: patch.sentAt, updatedAt: now })
    .onConflictDoUpdate({
      target: [schema.progress.readerId, schema.progress.caseId],
      set: { ...(patch.data ? { data: patch.data } : {}), ...(patch.acceptedAt ? { acceptedAt: patch.acceptedAt } : {}), ...(patch.sentAt ? { sentAt: patch.sentAt } : {}), updatedAt: now },
    });
}

export const sentCount = cache(async (caseId: number) => {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.progress).where(and(eq(schema.progress.caseId, caseId), isNotNull(schema.progress.sentAt)));
  return r?.n ?? 0;
});

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */
export function rules(c: CaseBundle, p: Progress) {
  const read = p.data.read;
  const finale = c.config.finale;
  const readable = c.docs.filter((d) => !d.lock && d.berkasCode !== finale.berkas);
  const docsOf = (code: string) => c.docs.filter((d) => d.berkasCode === code);
  const berkasUnlocked = (code: string) => {
    const i = c.berkas.findIndex((b) => b.code === code);
    if (i <= 0) return true;
    if (code === finale.berkas) return !!read[finale.unlockAfter];
    const prev = docsOf(c.berkas[i - 1].code);
    return prev.length === 0 || !!read[prev[prev.length - 1].code];
  };
  const berkasDone = (code: string) => code === finale.berkas ? !!p.sentAt : docsOf(code).filter((d) => !d.lock).every((d) => read[d.code]);
  const nextUnread = readable.find((d) => !read[d.code] && berkasUnlocked(d.berkasCode)) ?? null;
  return {
    readable, docsOf, berkasUnlocked, berkasDone, nextUnread,
    readCount: readable.filter((d) => read[d.code]).length,
    stampCount: Object.keys(p.data.stamps).length + (p.sentAt ? 1 : 0),
    kabarUnlocked: berkasUnlocked(finale.berkas),
    windu: parseYMD(finale.windu),
    epilogueOpen: !!p.sentAt && serverNow() >= parseYMD(finale.epilogueDate),
  };
}

import type { Person } from '@/lib/stamps';
export async function placedPeople(caseId: number, idxs: number[]): Promise<Person[]> {
  if (!idxs.length) return [];
  const rows = await db.select({ idx: schema.answers.idx, name: schema.answers.name, habit: schema.answers.habit, question: schema.answers.question, year: schema.answers.year })
    .from(schema.answers).where(and(eq(schema.answers.caseId, caseId), inArray(schema.answers.idx, idxs)));
  return idxs.map((i) => rows.find((r) => r.idx === i)).filter(Boolean) as Person[];
}


export const answerCount = cache((caseId: number) => memo('answers:' + caseId, async () => {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.answers).where(eq(schema.answers.caseId, caseId));
  return r?.n ?? 0;
}));

export const minutes = (words: number) => Math.max(1, Math.round(words / 200));
export { isAdminEmail };
