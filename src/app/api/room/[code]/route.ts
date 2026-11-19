import { getViewer } from '@/lib/game';
import { messagesAfter, normCode, progressVersion, roomByCode, touch } from '@/lib/coop';

export const runtime = 'nodejs';

/** Polled by the room dock: presence heartbeat + new table talk + a version stamp of the shared progress. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const v = await getViewer();
  const room = await roomByCode(normCode(code));
  if (!room || !v.readerId || !room.members.some((m) => m.readerId === v.readerId)) return Response.json({ gone: true }, { status: 404 });
  const after = Number(new URL(req.url).searchParams.get('after') ?? 0) || 0;
  const [, msgs, ver] = await Promise.all([touch(room.code, v.readerId), messagesAfter(room.code, after), progressVersion(room.progressId, room.caseId)]);
  return Response.json({
    code: room.code, mode: room.mode, shared: room.shared, host: room.hostId === v.readerId, me: v.readerId, v: ver,
    members: room.members.map((m) => ({ id: m.readerId, name: m.name, seat: m.seat, online: m.readerId === v.readerId || m.online, color: m.color })),
    msgs,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
