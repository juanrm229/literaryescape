import { notFound } from 'next/navigation';
import { getViewer, listCases } from '@/lib/game';
import { normCode, roomByCode } from '@/lib/coop';
import { Back } from '@/components/ui';
import { JoinView } from '@/components/Room';

export const dynamic = 'force-dynamic';

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await roomByCode(normCode(code));
  if (!room) notFound();
  const v = await getViewer();
  const c = (await listCases()).find((x) => x.id === room.caseId);
  if (!c) notFound();
  const seated = room.members.some((m) => m.readerId === v.readerId);
  const name = v.user?.name && v.user.name !== v.user.email ? v.user.name : v.user?.email?.split('@')[0] ?? '';
  return (
    <div className="page">
      <header className="hcard">
        <div className="hc-row"><Back href="/" /></div>
        <span className="chip-g">Case {c.no} · main bareng</span><h1>{seated ? 'Kamu sudah duduk di sini.' : 'Kamu diundang ke meja.'}</h1>
        <p className="hc-sub">{c.tagline}</p>
      </header>
      <JoinView code={room.code} defaultName={name} caseTitle={c.title} members={room.members.filter((m) => m.readerId !== v.readerId).map((m) => m.name)} />
    </div>
  );
}
