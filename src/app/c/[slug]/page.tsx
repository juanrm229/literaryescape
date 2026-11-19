import Link from 'next/link';
import { casePage } from '@/lib/case-page';
import { answerCount, minutes } from '@/lib/game';
import { skinOf } from '@/lib/case-config';
import { berkasStamp } from '@/lib/stamps';
import { inline } from '@/lib/md';
import { daysUntil, fmt, nextMalamKliwon } from '@/lib/jw';
import { CaseHeader } from '@/components/CaseHeader';
import { ScrollTo } from '@/components/ScrollTo';
import { Ic, Html } from '@/components/ui';
import { ShellSync } from '@/components/Shell';
import { PuzzleCard } from '@/components/Puzzle';
import { puzzleViews, type PuzzleView } from '@/lib/puzzles';
import { holderOf } from '@/lib/coop';

export const dynamic = 'force-dynamic';

export default async function Archive({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }) {
  const { slug } = await params;
  const { from } = await searchParams;
  const { c, p, r, preview, room, env } = await casePage(slug);
  // collective gates: a shared meter, the whole readership pushing one door
  const meter = (key: string) => { const g = c.config.gates?.[key]?.find((x) => x.type === 'collective'); return g && g.type === 'collective' ? <Collective sent={env.sent} threshold={g.threshold} /> : null; };
  const now = new Date();
  const days = daysUntil(r.windu, now);
  const nextK = nextMalamKliwon(now);
  const finale = c.config.finale;

  const placedN = p.data.placed.length;
  // padlocked berkas show their lock right in the archive
  const gateViews: Record<string, PuzzleView[]> = {};
  for (const b of c.berkas) { const l = r.berkasLock(b.code); if (!l.open && l.puzzleKeys.length) gateViews[b.code] = await puzzleViews(c, p, r, l.puzzleKeys); }
  const total = await answerCount(c.id);

  return (
    <div className="page">
      <ShellSync believe={p.data.believe} />
      <ScrollTo id={from ? `row-${from}` : undefined} />
      <CaseHeader c={c} p={p} tab="archive" />
      <div className="body grow">
        <div className="meta-strip">
          <span>{r.readCount}/{r.readable.length} read</span>
          <span>{r.stampCount}/{c.berkas.length} stamps</span>
          {finale ? <span className={days <= 14 ? 'hot' : ''}>windu · {days > 0 ? `${days}d` : days === 0 ? 'tonight' : 'passed'}</span>
            : <span>{c.puzzles.filter((z) => p.data.solved?.[z.key]).length}/{c.puzzles.length} terjawab</span>}
        </div>
        {(preview || finale) && <p className="kliwon-note">{preview ? 'Admin preview — this case is not live yet.' : `Next malam Jumat Kliwon: ${nextK ? fmt(nextK) : '—'}`}</p>}

        {c.berkas.map((b, bi) => {
          const open = r.berkasUnlocked(b.code);
          const done = r.berkasDone(b.code);
          const meta = c.config.berkas[b.code];
          const head = (
            <div className="sec-h"><h3>Berkas {b.code} — {b.title}</h3>
              {done ? <Html as="span" className="sec-stamp" html={berkasStamp(c.config, b)} /> : <span>{meta?.years}</span>}</div>
          );
          if (!open) {
            const l = r.berkasLock(b.code);
            return (
              <section className="sec locked" key={b.code}>{head}
                {l.reasons.map((x, i) => <p className="lockrow" key={i}><Ic name="lock" />{x}</p>)}
                {meter(b.code)}
                {(gateViews[b.code] ?? []).map((v) => <PuzzleCard key={v.key} slug={c.slug} view={v} />)}
              </section>
            );
          }
          if (finale && b.code === finale.berkas) {
            return (
              <section className="sec" key={b.code}>{head}
                <Link className="kabar-card" href={`/c/${c.slug}/kabar`}>
                  <span className="pill">Kirim kabar · {placedN}/{total}</span>
                  <p>{p.sentAt ? 'Kabar sudah dikirim. Dengarkan rekaman terakhir.' : `Satu amplop beralamat ${finale.address}. Tempel satu stamp untuk setiap yang masih menunggu.`}</p>
                </Link>
              </section>
            );
          }
          return (
            <section className="sec" key={b.code}>{head}
              {b.intro && b.code !== '0' && <Html as="div" className="sec-intro" html={inline(b.intro.replace(/^\*|\*$/g, ''))} />}
              <ul className="rows">
                {r.docsOf(b.code).filter((d) => !d.lock).map((d) => {
                  const read = !!p.data.read[d.code];
                  const dl = r.docLock(d.code);
                  if (!dl.open) {
                    return (
                      <li key={d.code}>
                        <Link className="row lockd" href={`/c/${c.slug}/d/${d.code}`} id={`row-${d.code}`}>
                          <span className="box"><Ic name="lock" /></span>
                          <Html as="span" className="row-t" html={`<b>${d.code}</b>${inline(d.title)}`} />
                          <span className="row-why">{dl.reasons[0]}</span>
                        {meter(d.code)}
                        </Link>
                      </li>
                    );
                  }
                  const holder = holderOf(room, c, d.code);
                  const mine = holder?.readerId === room?.me.readerId;
                  return (
                    <li key={d.code}>
                      <Link className={`row${read ? ' read' : ''}${holder && !mine ? ' held' : ''}`} href={`/c/${c.slug}/d/${d.code}`} id={`row-${d.code}`}>
                        <span className="box">{read && <Ic name="check" />}</span>
                        <Html as="span" className="row-t" html={`<b>${d.code}</b>${inline(d.title)}`} />
                        <span className="row-why">{holder && <i className="row-seat" style={{ background: holder.color }}>{mine ? 'kamu' : holder.name}</i>}{skinOf(c.config, d.code)[1]} · {minutes(d.words)} min</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="bar2">
        {r.nextUnread
          ? <Link className="cta" href={`/c/${c.slug}/d/${r.nextUnread.code}`}>{p.data.read['0-01'] ? 'Continue' : 'Start reading'} <small>{r.nextUnread.code}</small></Link>
          : r.kabarUnlocked ? <Link className="cta yellow" href={`/c/${c.slug}/kabar`}>Kirim kabar</Link>
            : p.sentAt ? <span className="cta dim">Perkara ditutup</span>
            : !finale && c.config.questions?.length ? <Link className="cta" href={`/c/${c.slug}/desk/tanya`}>Archive complete <small>Pertanyaan</small></Link>
            : <span className="cta dim">Archive complete</span>}
      </div>
    </div>
  );
}

function Collective({ sent, threshold }: { sent: number; threshold: number }) {
  const pct = Math.min(100, Math.round((sent / Math.max(1, threshold)) * 100));
  const left = Math.max(0, threshold - sent);
  return (
    <span className="coll" role="meter" aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={sent} aria-label="Kabar terkumpul">
      <span className="coll-bar"><i style={{ width: `${pct}%` }} /></span>
      <span className="coll-t">{left ? `${left.toLocaleString('id-ID')} kabar lagi dari pembaca mana pun` : 'Cukup. Pintunya terbuka.'}</span>
    </span>
  );
}
