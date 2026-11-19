'use server';

import { getViewer, listCases, loadCase } from '@/lib/game';
import { createRoom, joinRoom, leaveRoom, roomByCode, roomFor, say, setMode, setShared, holderOf, normCode, type JoinResult } from '@/lib/coop';

const cleanName = (s: unknown, fallback: string) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 24) || fallback;
async function viewerName() {
  const v = await getViewer();
  if (!v.readerId) throw new Error('No reader cookie');
  const base = v.user?.name && v.user.name !== v.user.email ? v.user.name : v.user?.email?.split('@')[0];
  return { v, fallback: base || `Pembaca ${v.readerId.slice(0, 3).toUpperCase()}` };
}

export async function createRoomAction(slug: string, opts: { name?: string; mode?: string; fromMine?: boolean }) {
  const { v, fallback } = await viewerName();
  const c = await loadCase(slug, v.admin);
  if (!c) return { ok: false as const };
  const code = await createRoom(c, { readerId: v.readerId!, name: cleanName(opts.name, fallback) }, { mode: opts.mode === 'split' ? 'split' : 'together', fromMine: opts.fromMine !== false });
  return { ok: true as const, code };
}

export async function joinRoomAction(rawCode: string, name?: string): Promise<JoinResult & { slug?: string }> {
  const { v, fallback } = await viewerName();
  const room = await roomByCode(rawCode);
  if (!room) return { ok: false, reason: 'missing' };
  const res = await joinRoom(room.code, { readerId: v.readerId!, name: cleanName(name, fallback) });
  if (!res.ok) return res;
  const cases = await listCases();
  return { ...res, slug: cases.find((x) => x.id === room.caseId)?.slug };
}

async function seated(slug: string) {
  const v = await getViewer();
  const c = await loadCase(slug, v.admin);
  if (!c || !v.readerId) return null;
  const room = await roomFor(v.readerId, c.id);
  return room ? { v, c, room } : null;
}

export async function leaveRoomAction(slug: string) {
  const s = await seated(slug);
  if (s) await leaveRoom(s.room.code, s.v.readerId!);
  return { ok: true };
}

export async function sendChat(slug: string, text: string) {
  const s = await seated(slug);
  const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!s || !t) return { ok: false };
  await say(s.room.code, s.v.readerId!, 'chat', t);
  return { ok: true };
}

/** Split mode: the holder lays a document on the table for everyone. */
export async function shareDoc(slug: string, code: string) {
  const s = await seated(slug);
  if (!s) return { ok: false };
  const h = holderOf(s.room, s.c, code);
  if (!h || h.readerId !== s.v.readerId) return { ok: false };
  await setShared(s.room.code, code);
  await say(s.room.code, s.v.readerId!, 'share', `${s.room.me.name} menaruh ${code} di meja. Semua bisa membacanya.`);
  return { ok: true };
}

/** Split mode: ask the holder to read it out (or lay it on the table). */
export async function askDoc(slug: string, code: string) {
  const s = await seated(slug);
  if (!s) return { ok: false };
  const h = holderOf(s.room, s.c, code);
  if (!h) return { ok: false };
  await say(s.room.code, s.v.readerId!, 'ask', `${s.room.me.name} minta ${h.name} membacakan ${code}.`);
  return { ok: true };
}

export async function setRoomMode(slug: string, mode: 'together' | 'split') {
  const s = await seated(slug);
  if (!s || s.room.hostId !== s.v.readerId) return { ok: false };
  await setMode(s.room.code, mode === 'split' ? 'split' : 'together');
  await say(s.room.code, s.v.readerId!, 'mode', mode === 'split' ? `${s.room.me.name} membagi dokumen. Tiap orang memegang bagiannya; ceritakan isinya.` : `${s.room.me.name} menaruh semua dokumen di meja.`);
  return { ok: true };
}

export async function peekRoom(rawCode: string) {
  const room = await roomByCode(normCode(rawCode));
  return room ? { code: room.code, members: room.members.length } : null;
}
