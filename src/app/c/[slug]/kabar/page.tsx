import Link from 'next/link';
import { casePage } from '@/lib/case-page';
import { answerCount, loadDocMd, placedPeople, serverNow } from '@/lib/game';
import { kabarStamp, blankStamp, stamp } from '@/lib/stamps';
import { render } from '@/lib/md';
import { postmark } from '@/lib/jw';
import { tembangStanzas } from '@/lib/text';
import { Back, ClueButton, Html } from '@/components/ui';
import { KabarView } from '@/components/KabarView';
import { ShellSync } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function Kabar({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { c, p, r } = await casePage(slug);
  const f = c.config.finale;
  const header = (
    <header className="hcard">
      <div className="hc-row"><Back href={`/c/${slug}`} /><ClueButton slug={slug} hints={c.config.hints} shown={p.data.hintsShown} /></div>
      <span className="chip-g">Berkas {f.berkas}</span><h1>Kabar</h1><p className="hc-sub">Satu amplop. Alamatnya: {f.address}.</p>
    </header>
  );
  if (!r.kabarUnlocked) {
    return (
      <div className="page">{header}
        <div className="body"><div className="lockcard"><Html html={stamp({ title: 'Kabar', sub: `Berkas ${f.berkas} · locked`, motif: 'key', palette: 'night', year: f.windu.slice(0, 4) }) as string} />
          <h2>Locked.</h2><p>Kebuka setelah kamu membaca {f.unlockAfter}.<br />Ini cuma cerita.</p><Link className="cta" href={`/c/${slug}`}>Back to archive</Link></div></div>
      </div>
    );
  }
  const total = await answerCount(c.id);
  const people = await placedPeople(c.id, p.data.placed);
  const songMd = (await loadDocMd(c.id, f.song)) ?? '';
  const ritualMd = (await loadDocMd(c.id, f.ritual)) ?? '';
  return (
    <div className="page">
      <ShellSync believe={p.data.believe} />
      {header}
      <KabarView
        slug={slug} total={total}
        placed={people.map((x) => ({ idx: x.idx, name: x.name, question: x.question, html: kabarStamp(x, false), htmlSaid: kabarStamp(x, true), said: p.data.recited.includes(x.idx) }))}
        blanks={Array.from({ length: total }, (_, i) => blankStamp(String(i + 1)) as string)}
        stanzas={tembangStanzas(songMd)} tembangLine={p.data.tembangLine}
        sent={!!p.sentAt} believe={p.data.believe} address={f.address} postmark={postmark(serverNow())}
        sayLine={f.sayLine} sayTranslation={f.sayTranslation}
        ritualHtml={render(ritualMd)} incompleteHtml={render(c.config.endings.incomplete)} believeMsg={c.config.replies.believe}
      />
    </div>
  );
}
