import 'server-only';
import { cache } from 'react';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { ProgressData } from '@/db/schema';
import { emptyProgress, ensureReader, type CaseBundle } from '@/lib/game';

/**
 * Co-op rooms. A room owns one progress row (reader id `room:<code>`); every member reads and writes it.
 * Because the whole engine already works on "a progress row", gates, stamps, puzzles and the envelope
 * become shared without any special cases. Concurrent writes are reconciled with a three-way merge.
 */
export const MAX_MEMBERS = 4;
export const SEAT_COLORS = ['#f4d23c', '#7cc4d6', '#e58a6b', '#a7c97a'];
const ONLINE_MS = 25_000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

export type Member = { readerId: string; name: string; seat: number; online: boolean; color: string };
export type RoomInfo = { code: string; caseId: number; progressId: string; hostId: string; mode: 'together' | 'split'; shared: string[]; members: Member[]; me: Member };

const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join('');
export const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

async function members(code: string): Promise<Member[]> {
  const rows = await db.select().from(schema.roomMembers).where(eq(schema.roomMembers.code, code)).orderBy(schema.roomMembers.seat);
  const now = Date.now();
  return rows.map((m) => ({ readerId: m.readerId, name: m.name, seat: m.seat, online: now - m.lastSeen.getTime() < ONLINE_MS, color: SEAT_COLORS[m.seat % SEAT_COLORS.length] }));
}

/** The room this reader sits in for this case, if any (one per case). */
export const roomFor = cache(async (readerId: string | null, caseId: number): Promise<RoomInfo | null> => {
  if (!readerId) return null;
  const [row] = await db.select({ room: schema.rooms }).from(schema.roomMembers)
    .innerJoin(schema.rooms, eq(schema.rooms.code, schema.roomMembers.code))
    .where(and(eq(schema.roomMembers.readerId, readerId), eq(schema.rooms.caseId, caseId))).limit(1);
  if (!row) return null;
  const ms = await members(row.room.code);
  const me = ms.find((m) => m.readerId === readerId);
  if (!me) return null;
  return { ...row.room, mode: row.room.mode as RoomInfo['mode'], members: ms, me };
});

export async function roomByCode(code: string) {
  const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.code, normCode(code)));
  if (!room) return null;
  return { ...room, members: await members(room.code) };
}

/** Which progress row a reader plays on for a case: the room's when seated, their own otherwise. */
export async function progressIdFor(readerId: string | null, caseId: number) {
  const r = await roomFor(readerId, caseId);
  return r ? r.progressId : readerId;
}

export async function createRoom(c: CaseBundle, host: { readerId: string; name: string }, opts: { mode: 'together' | 'split'; fromMine: boolean }) {
  await leaveCaseRooms(host.readerId, c.id);
  let code = newCode();
  for (let i = 0; i < 5 && (await roomByCode(code)); i++) code = newCode();
  const progressId = `room:${code}`;
  await ensureReader(progressId);
  let data = emptyProgress();
  if (opts.fromMine) {
    const [mine] = await db.select().from(schema.progress).where(and(eq(schema.progress.readerId, host.readerId), eq(schema.progress.caseId, c.id)));
    if (mine && !mine.sentAt) data = { ...emptyProgress(), ...mine.data, believe: false };
  }
  await db.insert(schema.rooms).values({ code, caseId: c.id, progressId, hostId: host.readerId, mode: opts.mode });
  await db.insert(schema.progress).values({ readerId: progressId, caseId: c.id, data, acceptedAt: new Date() });
  await db.insert(schema.roomMembers).values({ code, readerId: host.readerId, name: host.name, seat: 0 });
  await say(code, host.readerId, 'join', `${host.name} membuka meja.`);
  return code;
}

export type JoinResult = { ok: true; code: string } | { ok: false; reason: 'missing' | 'full' };
export async function joinRoom(code: string, who: { readerId: string; name: string }): Promise<JoinResult> {
  const room = await roomByCode(code);
  if (!room) return { ok: false, reason: 'missing' };
  if (room.members.some((m) => m.readerId === who.readerId)) return { ok: true, code: room.code };
  if (room.members.length >= MAX_MEMBERS) return { ok: false, reason: 'full' };
  await leaveCaseRooms(who.readerId, room.caseId);
  await ensureReader(who.readerId);
  const taken = new Set(room.members.map((m) => m.seat));
  const seat = [0, 1, 2, 3].find((s) => !taken.has(s)) ?? room.members.length;
  await db.insert(schema.roomMembers).values({ code: room.code, readerId: who.readerId, name: who.name, seat }).onConflictDoNothing();
  await say(room.code, who.readerId, 'join', `${who.name} duduk di meja.`);
  return { ok: true, code: room.code };
}

export async function leaveRoom(code: string, readerId: string) {
  const room = await roomByCode(code);
  const me = room?.members.find((m) => m.readerId === readerId);
  if (!room || !me) return;
  await db.delete(schema.roomMembers).where(and(eq(schema.roomMembers.code, room.code), eq(schema.roomMembers.readerId, readerId)));
  await say(room.code, readerId, 'leave', `${me.name} meninggalkan meja.`);
}

async function leaveCaseRooms(readerId: string, caseId: number) {
  const cur = await db.select({ code: schema.roomMembers.code }).from(schema.roomMembers)
    .innerJoin(schema.rooms, eq(schema.rooms.code, schema.roomMembers.code))
    .where(and(eq(schema.roomMembers.readerId, readerId), eq(schema.rooms.caseId, caseId)));
  for (const r of cur) await leaveRoom(r.code, readerId);
}

export async function say(code: string, readerId: string, kind: string, text: string) {
  await db.insert(schema.roomMsgs).values({ code, readerId, kind, text: text.slice(0, 400) }).catch(() => {});
}

export async function touch(code: string, readerId: string) {
  await db.update(schema.roomMembers).set({ lastSeen: new Date() }).where(and(eq(schema.roomMembers.code, code), eq(schema.roomMembers.readerId, readerId)));
}

export async function messagesAfter(code: string, after: number, limit = 60) {
  const rows = after > 0
    ? await db.select().from(schema.roomMsgs).where(and(eq(schema.roomMsgs.code, code), gt(schema.roomMsgs.id, after))).orderBy(schema.roomMsgs.id).limit(limit)
    : (await db.select().from(schema.roomMsgs).where(eq(schema.roomMsgs.code, code)).orderBy(desc(schema.roomMsgs.id)).limit(limit)).reverse();
  return rows.map((m) => ({ id: m.id, readerId: m.readerId, kind: m.kind, text: m.text, at: m.at.toISOString() }));
}

export async function progressVersion(progressId: string, caseId: number) {
  const [row] = await db.select({ at: schema.progress.updatedAt }).from(schema.progress).where(and(eq(schema.progress.readerId, progressId), eq(schema.progress.caseId, caseId)));
  return row ? row.at.getTime() : 0;
}

export async function setShared(code: string, docCode: string) {
  await db.update(schema.rooms).set({ shared: sql`(select jsonb_agg(distinct x) from jsonb_array_elements(${schema.rooms.shared} || ${JSON.stringify([docCode])}::jsonb) x)` }).where(eq(schema.rooms.code, code));
}

export async function setMode(code: string, mode: 'together' | 'split') {
  await db.update(schema.rooms).set({ mode }).where(eq(schema.rooms.code, code));
}

/* ------------------------------------------------------------------ */
/* Split mode: documents are dealt between seats. Talk to each other.  */
/* ------------------------------------------------------------------ */
/** Seat holding a document, or null when everyone may read it. */
export function holderOf(room: RoomInfo | null, c: CaseBundle, code: string): Member | null {
  if (!room || room.mode !== 'split' || room.members.length < 2) return null;
  if (room.shared.includes(code)) return null;
  const doc = c.docs.find((d) => d.code === code);
  if (!doc || doc.berkasCode === c.config.finale?.berkas) return null;
  if (doc.berkasCode === '0') return null; // the introduction is for everyone
  const siblings = c.docs.filter((d) => d.berkasCode === doc.berkasCode);
  const i = siblings.findIndex((d) => d.code === code);
  // offset by berkas so seat 0 doesn't always get every berkas' first document
  const bi = c.berkas.findIndex((b) => b.code === doc.berkasCode);
  return room.members[(i + bi) % room.members.length];
}
export const canRead = (room: RoomInfo | null, c: CaseBundle, code: string) => {
  const h = holderOf(room, c, code);
  return !h || h.readerId === room!.me.readerId;
};

/* ------------------------------------------------------------------ */
/* Concurrency: three-way merge of the shared progress row.            */
/* ------------------------------------------------------------------ */
const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Apply the change base→mine onto cur (the row as it is now), field by field. */
export function merge3(base: ProgressData, mine: ProgressData, cur: ProgressData): ProgressData {
  const out = { ...emptyProgress(), ...cur } as Record<string, unknown>;
  const b = base as unknown as Record<string, unknown>, m = mine as unknown as Record<string, unknown>;
  for (const k of Object.keys(m)) {
    if (same(b[k], m[k])) continue;
    const bv = b[k], mv = m[k], cv = out[k];
    if (isRec(mv)) {
      const r: Record<string, unknown> = { ...(isRec(cv) ? cv : {}) };
      const bb = isRec(bv) ? bv : {};
      for (const kk of Object.keys(mv)) if (!same(bb[kk], mv[kk])) r[kk] = mv[kk];
      for (const kk of Object.keys(bb)) if (!(kk in mv)) delete r[kk];
      out[k] = r;
    } else if (Array.isArray(mv)) {
      const bb = Array.isArray(bv) ? bv : [];
      const removed = bb.filter((x) => !mv.some((y) => same(x, y)));
      const res = (Array.isArray(cv) ? cv : []).filter((x) => !removed.some((y) => same(x, y)));
      for (const x of mv) if (!bb.some((y) => same(x, y)) && !res.some((y) => same(x, y))) res.push(x);
      out[k] = res;
    } else if (k === 'tembangLine') out[k] = Math.max(Number(cv) || 0, Number(mv) || 0);
    else if (k === 'tokensSpent') out[k] = (Number(cv) || 0) + (Number(mv) || 0) - (Number(bv) || 0);
    else out[k] = mv;
  }
  return out as unknown as ProgressData;
}

export async function mergeSave(progressId: string, caseId: number, base: ProgressData, patch: { data?: ProgressData; acceptedAt?: Date; sentAt?: Date }) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.progress)
      .where(and(eq(schema.progress.readerId, progressId), eq(schema.progress.caseId, caseId))).for('update');
    const cur = row ? { ...emptyProgress(), ...row.data } : emptyProgress();
    const data = patch.data ? merge3(base, patch.data, cur) : cur;
    const now = new Date();
    await tx.insert(schema.progress).values({ readerId: progressId, caseId, data, acceptedAt: patch.acceptedAt, sentAt: patch.sentAt, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.progress.readerId, schema.progress.caseId],
        set: { data, ...(patch.acceptedAt ? { acceptedAt: patch.acceptedAt } : {}), ...(patch.sentAt && !row?.sentAt ? { sentAt: patch.sentAt } : {}), updatedAt: now },
      });
  });
}

/** Feed line for an engine event, written in the room's voice. */
export function feedLine(c: CaseBundle, who: string, kind: string, data: Record<string, unknown>): string | null {
  const doc = typeof data.code === 'string' ? c.docs.find((d) => d.code === data.code) : null;
  const pz = typeof data.key === 'string' ? c.puzzles.find((z) => z.key === data.key) : null;
  switch (kind) {
    case 'read': return doc ? `${who} membaca ${doc.code} · ${doc.title.replace(/\*/g, '')}` : null;
    case 'stamp': return `${who} mendapat cap ${String(data.title ?? '')}`;
    case 'name_ok': return `${who} menempelkan nama ${String(data.name ?? '')} di amplop`;
    case 'name_wrong': return `${who} mencoba “${String(data.input ?? '')}”. Bukan.`;
    case 'puzzle_solve': return `${who} membuka gembok “${pz?.title ?? data.key}”`;
    case 'puzzle_wrong': return `${who} salah di gembok “${pz?.title ?? data.key}”`;
    case 'puzzle_hint': return `${who} membuka clue gembok “${pz?.title ?? data.key}”`;
    case 'hint': return `${who} membuka clue ${String(data.n ?? '')}`;
    case 'sent': return `${who} mengirim kabar. Perkara ditutup bersama.`;
    default: return null;
  }
}

export async function memberships(readerId: string) {
  return db.select({ code: schema.rooms.code, caseId: schema.rooms.caseId, progressId: schema.rooms.progressId }).from(schema.roomMembers)
    .innerJoin(schema.rooms, eq(schema.rooms.code, schema.roomMembers.code)).where(eq(schema.roomMembers.readerId, readerId));
}

