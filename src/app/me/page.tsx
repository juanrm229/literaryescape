import Link from 'next/link';
import { getViewer } from '@/lib/game';
import { buildProfile } from '@/lib/profile';
import { Back, Ic } from '@/components/ui';
import { StampsView, type Collection } from '@/components/StampsView';

export const dynamic = 'force-dynamic';

export default async function Me() {
  const v = await getViewer();
  const pr = await buildProfile(v.readerId);
  const name = v.user?.name && v.user.name !== v.user.email ? v.user.name : v.user?.email?.split('@')[0] ?? 'Pembaca tanpa nama';
  const colls: Collection[] = pr.cases.filter((c) => c.stamps.length).map((c) => ({
    key: c.slug, name: c.title, desc: `${c.stamps.length} stamp dari ${c.title}`,
    items: c.stamps.map((s) => ({ key: s.key, got: true, html: s.html, name: s.name, desc: s.desc })),
  }));
  return (
    <div className="page">
      <header className="hcard me-head">
        <div className="hc-row"><Back href="/" />{v.user ? <span className="chip-g">synced</span> : <Link className="pillbtn" href="/login?next=/me">Sign in</Link>}</div>
        <div className="me-id">
          <span className="me-av">{name[0]?.toUpperCase()}</span>
          <div><h1>{name}</h1><p className="hc-sub">{v.user ? v.user.email : 'Progress terikat ke browser ini.'}</p></div>
        </div>
        <div className="me-rank">
          <div className="me-rank-top"><b>{pr.rank.name}</b><span>{pr.points.toLocaleString('id-ID')} poin</span></div>
          <p>{pr.rank.line}</p>
          <div className="me-bar"><i style={{ width: `${Math.round(pr.progressToNext * 100)}%` }} /></div>
          <small>{pr.next ? `${(pr.next.min - pr.points).toLocaleString('id-ID')} poin lagi menuju ${pr.next.name}` : 'Peringkat tertinggi.'}</small>
        </div>
      </header>
      <div className="body grow">
        <div className="meta-strip">
          <span>{pr.stats.docsRead} dokumen</span><span>{pr.stats.stamps} stamps</span><span>{pr.stats.solved} gembok</span><span>{pr.stats.closed} perkara selesai</span>
        </div>

        <h3 className="sub-h">Achievements</h3>
        <div className="ach">{pr.achievements.map((a) => (
          <div key={a.key} className={`ach-i${a.got ? ' got' : ''}`}>
            <span className="ach-ic">{a.got ? <Ic name="check" /> : <Ic name="lock" />}</span>
            <b>{a.title}</b><small>{a.line}</small>
          </div>))}
        </div>

        <h3 className="sub-h">Perkara</h3>
        <ul className="rows">{pr.cases.map((c) => (
          <li key={c.slug}><Link className={`row${c.sent ? ' read' : ''}`} href={c.accepted ? `/c/${c.slug}` : `/?case=${c.slug}`}>
            <span className="box">{c.sent && <Ic name="check" />}</span>
            <span className="row-t"><b>{c.no}</b>{c.title}</span>
            <span className="row-why">{c.accepted ? `${c.read}/${c.total} dibaca · ${c.stamps.length} stamps${c.sent ? ' · kabar terkirim' : ''}` : 'Belum diambil'}</span>
          </Link></li>))}
        </ul>

        <h3 className="sub-h">Buku Perangko</h3>
        {!colls.length && <p className="desk-note">Belum ada stamp. Selesaikan satu berkas untuk cap pertama.</p>}
      </div>
      {colls.length > 0 && <StampsView colls={colls} startColl={colls[0].key} />}
    </div>
  );
}
