import Link from 'next/link';
import { redirect } from 'next/navigation';
import { casePage } from '@/lib/case-page';
import { loadDocMd, sentCount, serverNow } from '@/lib/game';
import { tapeHTML } from '@/lib/render-doc';
import { render } from '@/lib/md';
import { daysUntil } from '@/lib/jw';
import { Back, SoundButton } from '@/components/ui';
import { RekamanTape } from '@/components/RekamanTape';
import { ShellSync } from '@/components/Shell';
import { ShareButton } from '@/components/ShareButton';

export const dynamic = 'force-dynamic';

/** The locked pages. Content leaves the database only when the server agrees. */
export default async function Rekaman({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { c, p, r } = await casePage(slug);
  const f = c.config.finale;
  if (!p.sentAt) redirect(`/c/${slug}/kabar`);
  const tape = c.docs.find((d) => d.code === f.tape)!;
  const epi = c.docs.find((d) => d.code === f.epilogue)!;
  const tapeMd = (await loadDocMd(c.id, f.tape)) ?? '';
  const voices = await sentCount(c.id);
  let last: string;
  if (r.epilogueOpen) {
    last = `<p class="p-strong"><strong>${f.epilogue} · ${epi.title}</strong></p>` + render((await loadDocMd(c.id, f.epilogue)) ?? '');
  } else {
    const days = Math.max(0, daysUntil(r.windu, serverNow()));
    last = `<p class="p-strong"><strong>Halaman yang Belum Ditulis</strong></p>` + render(c.config.endings.before.replace('\\[X\\]', String(days)).replace('[X]', String(days)));
  }
  return (
    <div className="page">
      <ShellSync believe={p.data.believe} />
      <header className="hcard">
        <div className="hc-row"><Back href={`/c/${slug}/kabar`} /><SoundButton /></div>
        <span className="chip-g">Berkas {f.berkas} · {f.tape}</span><h1>{tape.title}</h1><p className="hc-sub">Rekaman ponsel · {f.windu}</p>
      </header>
      <div className="doc-body grow">
        <RekamanTape slug={slug} code={f.tape} html={tapeHTML(c.config, f.tape, tapeMd)} />
        <div className="voices-big"><b>{voices.toLocaleString('id-ID')}</b> pembaca sudah mengirim kabar. Kasan bilang: “saben bengi tambah akeh. Kaya banyu pasang.”</div>
        <div className="voices-share"><ShareButton src={`/api/share/${slug}?k=sent`} label="Share tanpa spoiler" text={`Kabar sudah sampai. ${c.title} — postmortem`} /></div>
        <article className={`doc ${r.epilogueOpen ? 'skin-journal' : 'skin-blank'}`} style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: last }} />
      </div>
      <div className="bar2"><Link className="cta" href={`/c/${slug}`}>Back to archive</Link></div>
    </div>
  );
}
