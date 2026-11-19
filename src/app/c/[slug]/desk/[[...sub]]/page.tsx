import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { casePage } from '@/lib/case-page';
import { glowing } from '@/lib/board';
import { puzzleViews } from '@/lib/puzzles';
import { loadDocMd } from '@/lib/game';
import { parseMd as parse } from '@/lib/md';
import { CaseHeader } from '@/components/CaseHeader';
import { DeskView } from '@/components/DeskView';
import { ShellSync } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function Desk({ params }: { params: Promise<{ slug: string; sub?: string[] }> }) {
  const { slug, sub } = await params;
  const { viewer, room, c, p, r } = await casePage(slug);
  const tabs = c.config.desk ?? ['prep', 'tasks', 'papan', 'board', 'pasaran', 'notes'];
  const tab = tabs.includes(sub?.[0] ?? '') ? sub![0] : 'prep';
  const questions = tab === 'tanya' && c.config.questions?.length ? await puzzleViews(c, p, r, c.config.questions) : [];

  // the 41-name board comes from the harbourmaster's report, once the reader has opened it
  let roster: string[][] | null = null;
  if (tab === 'board' && p.data.read['I-02']) {
    const md = (await loadDocMd(c.id, 'I-02')) ?? '';
    const table = (parse(md) as { t: string; rows?: string[][] }[]).find((b) => b.t === 'table');
    roster = table?.rows?.slice(1) ?? null;
  }
  const [serial] = viewer.readerId ? await db.select({ active: schema.serials.active, email: schema.serials.email }).from(schema.serials).where(and(eq(schema.serials.readerId, viewer.readerId), eq(schema.serials.caseId, c.id))) : [];
  const tugas = c.config.tugas.map(([code, text]) => ({ code, text, link: !code.startsWith('@'), ok: code === '@sent' ? !!p.sentAt : !!p.data.read[code] }));

  return (
    <div className="page">
      <ShellSync believe={p.data.believe} />
      <CaseHeader c={c} p={p} tab="desk" />
      <DeskView
        key={tab}
        slug={slug} sub={tab} bekalList={c.config.bekal} tugas={tugas}
        bekal={p.data.bekal} board={p.data.board} extra={p.data.extra} notes={p.data.notes} believe={p.data.believe}
        roster={roster} user={viewer.user} admin={viewer.admin} tabs={tabs} questions={questions}
        serial={{ active: !!serial?.active, email: serial?.email ?? viewer.user?.email ?? null }}
        pins={p.data.pins ?? []} strings={p.data.strings ?? []} glow={(p.data.strings ?? []).filter((k) => glowing(c.config.boardLinks, p.data.pins ?? [], k))} titles={Object.fromEntries(c.docs.map((d) => [d.code, d.title.replace(/\*/g, '')]))}
        room={room ? { code: room.code, members: room.members.length } : null}
        defaultName={room?.me.name ?? (viewer.user?.name && viewer.user.name !== viewer.user.email ? viewer.user.name : viewer.user?.email?.split('@')[0] ?? '')}
      />
    </div>
  );
}
