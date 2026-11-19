import Link from 'next/link';
import { redirect } from 'next/navigation';
import { casePage } from '@/lib/case-page';
import { loadDocMd, minutes } from '@/lib/game';
import { skinOf } from '@/lib/case-config';
import { renderDocBody } from '@/lib/render-doc';
import { berkasStamp } from '@/lib/stamps';
import { inline, unesc } from '@/lib/md';
import { labelJw, postmark } from '@/lib/jw';
import { DocReader } from '@/components/DocReader';
import { PuzzleCard } from '@/components/Puzzle';
import { puzzleKeysIn, puzzleViews } from '@/lib/puzzles';
import { Back, ClueButton, Html, Ic, SoundButton } from '@/components/ui';
import { ShellSync } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function DocPage({ params }: { params: Promise<{ slug: string; code: string }> }) {
  const { slug, code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const { c, p, r } = await casePage(slug);
  const doc = c.docs.find((d) => d.code === code);
  const finale = c.config.finale;
  if (!doc || doc.lock) redirect(`/c/${slug}`);
  if (finale && doc.berkasCode === finale.berkas) redirect(`/c/${slug}/kabar`);
  const b = c.berkas.find((x) => x.code === doc.berkasCode)!;
  const lock = r.docLock(code);

  if (!lock.open) {
    const gatePuzzles = await puzzleViews(c, p, r, lock.puzzleKeys);
    return (
      <div className="page">
        <header className="hcard"><div className="hc-row"><Back href={`/c/${slug}`} /><ClueButton slug={slug} hints={c.config.hints} shown={p.data.hintsShown} /></div>
          <span className="chip-g">{code}</span><h1>Still locked</h1><p className="hc-sub">Arsip ini dibaca berurutan.</p></header>
        <div className="body"><div className="lockcard"><Html html={berkasStamp(c.config, b)} /><h2>{r.berkasUnlocked(b.code) ? code : `Berkas ${b.code} — ${b.title}`}</h2>{lock.reasons.map((x, i) => <p key={i}>{x}</p>)}<Link className="cta" href={`/c/${slug}`}>Back to archive</Link></div>
          {gatePuzzles.map((v) => <PuzzleCard key={v.key} slug={slug} view={v} />)}</div>
      </div>
    );
  }

  const md = (await loadDocMd(c.id, code)) ?? '';
  const [skin, label] = skinOf(c.config, code);
  const fresh = !p.data.read[code];
  const at = fresh ? new Date() : new Date(p.data.read[code]);
  const idx = r.readable.findIndex((d) => d.code === code);
  const prev = r.readable[idx - 1], next = r.readable[idx + 1];
  const html = renderDocBody(c.config, { code, title: doc.title, md }, skin, !!p.data.opened[code]);
  const puzzles = await puzzleViews(c, p, r, puzzleKeysIn(md));
  const plain = (s: string) => unesc(s).replace(/\*/g, '');

  return (
    <div className="page">
      <ShellSync believe={p.data.believe} />
      <header className="hcard doc-h">
        <div className="hc-row"><Back href={`/c/${slug}?from=${code}`} /><div className="hc-right"><SoundButton /><ClueButton slug={slug} hints={c.config.hints} shown={p.data.hintsShown} /></div></div>
        <span className="chip-g">Berkas {b.code} · {code}</span>
        <h1 dangerouslySetInnerHTML={{ __html: inline(doc.title) }} />
        <p className="hc-sub">{label} · {minutes(doc.words)} min read</p>
        <div className={`read-pm${fresh ? ' fresh' : ''}`}><b>TERBACA</b><span>{labelJw(at)}</span><i>{postmark(at)}</i></div>
      </header>
      <div className="doc-body grow">
        <DocReader key={code} slug={slug} code={code} skin={skin} html={html} fresh={fresh} puzzles={puzzles} />
      </div>
      <div className="bar2">
        {prev && <Link className="sq dark" href={`/c/${slug}/d/${prev.code}`} aria-label="Previous"><Ic name="back" /></Link>}
        {next
          ? <Link className="cta" href={`/c/${slug}/d/${next.code}`}>Next <small>{next.code} · {plain(next.title)}</small></Link>
          : finale && (r.kabarUnlocked || read8(p, finale.unlockAfter, code))
            ? <Link className="cta yellow" href={`/c/${slug}/kabar`}>Berkas {finale.berkas} · Kabar</Link>
            : <Link className="cta" href={`/c/${slug}`}>Back to archive</Link>}
      </div>
    </div>
  );
}

const read8 = (p: { data: { read: Record<string, string> } }, unlockAfter: string, code: string) => code === unlockAfter || !!p.data.read[unlockAfter];
