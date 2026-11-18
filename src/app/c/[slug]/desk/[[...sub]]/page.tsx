import { casePage } from '@/lib/case-page';
import { loadDocMd } from '@/lib/game';
import { parseMd as parse } from '@/lib/md';
import { CaseHeader } from '@/components/CaseHeader';
import { DeskView } from '@/components/DeskView';
import { ShellSync } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function Desk({ params }: { params: Promise<{ slug: string; sub?: string[] }> }) {
  const { slug, sub } = await params;
  const { viewer, c, p } = await casePage(slug);
  const tab = ['prep', 'tasks', 'board', 'pasaran', 'notes'].includes(sub?.[0] ?? '') ? sub![0] : 'prep';

  // the 41-name board comes from the harbourmaster's report, once the reader has opened it
  let roster: string[][] | null = null;
  if (tab === 'board' && p.data.read['I-02']) {
    const md = (await loadDocMd(c.id, 'I-02')) ?? '';
    const table = (parse(md) as { t: string; rows?: string[][] }[]).find((b) => b.t === 'table');
    roster = table?.rows?.slice(1) ?? null;
  }
  const tugas = c.config.tugas.map(([code, text]) => ({ code, text, link: !code.startsWith('@'), ok: code === '@sent' ? !!p.sentAt : !!p.data.read[code] }));

  return (
    <div className="page">
      <ShellSync believe={p.data.believe} />
      <CaseHeader c={c} p={p} tab="desk" />
      <DeskView
        key={tab}
        slug={slug} sub={tab} bekalList={c.config.bekal} tugas={tugas}
        bekal={p.data.bekal} board={p.data.board} extra={p.data.extra} notes={p.data.notes} believe={p.data.believe}
        roster={roster} user={viewer.user} admin={viewer.admin}
      />
    </div>
  );
}
