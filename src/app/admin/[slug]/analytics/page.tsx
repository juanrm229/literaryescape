import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { caseAnalytics } from '@/lib/analytics';
import { Back } from '@/components/ui';
import { AdminGate } from '@/components/AdminGate';

export const dynamic = 'force-dynamic';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmtMin = (m: number | null) => (m == null ? '—' : m < 90 ? `${m} mnt` : m < 60 * 48 ? `${Math.round(m / 60)} jam` : `${Math.round(m / 1440)} hari`);

export default async function Analytics({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [c] = await db.select({ id: schema.cases.id, title: schema.cases.title }).from(schema.cases).where(eq(schema.cases.slug, slug));
  if (!c) notFound();
  const a = await caseAnalytics(c.id);
  const maxDoc = Math.max(1, ...a.perDoc.map((d) => d.readers));
  // the single biggest fall between two consecutive documents = where readers give up
  let dropIdx = -1, dropSize = 0;
  a.perDoc.forEach((d, i) => { if (i && a.perDoc[i - 1].readers - d.readers > dropSize) { dropSize = a.perDoc[i - 1].readers - d.readers; dropIdx = i; } });
  const maxDay = Math.max(1, ...a.daily.map((d) => d.readers));
  const maxClue = Math.max(1, ...a.clues.map((d) => d.readers));

  return (
    <AdminGate>
      <div className="page">
        <header className="hcard"><div className="hc-row"><Back href={`/admin/${slug}`} /><span className="chip-g">analytics</span></div>
          <h1>{c.title}</h1><p className="hc-sub">Di mana pembaca berhenti, gembok mana yang terlalu sulit.</p></header>
        <div className="body grow an">
          <div className="an-tiles">
            <div className="an-tile"><small>Pembaca</small><b>{a.readers.toLocaleString('id-ID')}</b><span>mengambil perkara</span></div>
            <div className="an-tile"><small>Selesai</small><b>{pct(a.finished, a.readers)}%</b><span>{a.finished.toLocaleString('id-ID')} mengirim kabar</span></div>
            <div className="an-tile"><small>Waktu selesai</small><b>{fmtMin(a.medianMinutes)}</b><span>median</span></div>
            <div className="an-tile"><small>Aktif 7 hari</small><b>{a.active7.toLocaleString('id-ID')}</b><span>pembaca</span></div>
          </div>

          <h3 className="sub-h">Pembaca aktif per hari</h3>
          <div className="an-days" role="img" aria-label="Pembaca aktif per hari, 14 hari terakhir">
            {a.daily.map((d) => (
              <div key={d.day} className={`an-day${d.today ? ' today' : ''}`} title={`${d.day}: ${d.readers} pembaca`}>
                <span className="an-tip">{d.day} · {d.readers}</span>
                <i style={{ height: `${Math.max(2, (d.readers / maxDay) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="an-days-x"><span>{a.daily[0]?.day}</span><span>hari ini</span></div>

          <h3 className="sub-h">Di mana pembaca berhenti</h3>
          <p className="desk-note">Jumlah pembaca yang membuka setiap dokumen, berurutan.{dropIdx > 0 && <> Penurunan terbesar: <b style={{ color: '#f08a7f' }}>{a.perDoc[dropIdx - 1].code} → {a.perDoc[dropIdx].code}</b> (−{dropSize}).</>}</p>
          <div className="an-docs">
            {a.perDoc.map((d, i) => (
              <div key={d.code} className={`an-doc${i === dropIdx ? ' drop' : ''}`} title={`${d.code} · ${d.title}: ${d.readers} pembaca`}>
                <span className="an-code">{d.code}</span>
                <span className="an-track"><i style={{ width: `${(d.readers / maxDoc) * 100}%` }} /></span>
                <span className="an-val">{d.readers}</span>
              </div>
            ))}
          </div>

          {a.puzzles.length > 0 && (
            <>
              <h3 className="sub-h">Gembok</h3>
              <div className="tbl an-tbl"><table>
                <thead><tr><th>Gembok</th><th>Terbuka</th><th>Salah</th><th>Rata coba</th><th>Clue</th></tr></thead>
                <tbody>{a.puzzles.map((z) => (
                  <tr key={z.key}><td><b>{z.title || z.key}</b><br /><small>{z.kind}</small></td><td>{z.solves}</td><td>{z.wrong}</td>
                    <td><span className={`an-diff ${z.avgAttempts == null ? '' : z.avgAttempts > 6 ? 'hard' : z.avgAttempts > 3 ? 'mid' : 'easy'}`}>{z.avgAttempts ?? '—'}</span></td><td>{z.hints}</td></tr>))}
                </tbody></table></div>
              {a.topPuzzleWrong.length > 0 && <>
                <p className="desk-note">Jawaban salah yang paling sering (gembok):</p>
                <ul className="an-list">{a.topPuzzleWrong.map((w, i) => <li key={i}><code>{w.input || '∅'}</code><span>{w.key}</span><b>{w.n}×</b></li>)}</ul>
              </>}
            </>
          )}

          {a.wrongNames.length > 0 && (
            <>
              <h3 className="sub-h">Nama salah di amplop</h3>
              <ul className="an-list">{a.wrongNames.map((w, i) => <li key={i}><code>{w.input}</code><span>{w.code}</span><b>{w.n}×</b></li>)}</ul>
            </>
          )}

          <h3 className="sub-h">Pemakaian clue</h3>
          {a.clues.length ? (
            <div className="an-docs">{a.clues.map((cl) => (
              <div key={cl.n} className="an-doc" title={`Clue ${cl.n}: ${cl.readers} pembaca`}><span className="an-code">Clue {cl.n}</span><span className="an-track"><i style={{ width: `${(cl.readers / maxClue) * 100}%` }} /></span><span className="an-val">{cl.readers}</span></div>
            ))}</div>
          ) : <p className="desk-note">Belum ada yang membuka clue.</p>}

          <h3 className="sub-h">Tabel mentah</h3>
          <details className="an-raw"><summary>Pembaca per dokumen</summary>
            <div className="tbl an-tbl"><table><thead><tr><th>Kode</th><th>Judul</th><th>Pembaca</th></tr></thead>
              <tbody>{a.perDoc.map((d) => <tr key={d.code}><td>{d.code}</td><td>{d.title.replace(/[*\\]/g, '')}</td><td>{d.readers}</td></tr>)}</tbody></table></div>
          </details>
        </div>
      </div>
    </AdminGate>
  );
}
