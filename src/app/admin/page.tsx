import Link from 'next/link';
import { asc, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Back } from '@/components/ui';
import { AdminGate } from '@/components/AdminGate';
import { AdminForm } from '@/components/AdminForms';
import { createCase } from './actions';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const rows = await db.select({
    slug: schema.cases.slug, no: schema.cases.no, title: schema.cases.title, status: schema.cases.status,
    docs: sql<number>`(select count(*)::int from "document" d where d.case_id = "case"."id")`,
    readers: sql<number>`(select count(*)::int from "progress" p where p.case_id = "case"."id" and p.accepted_at is not null)`,
    sent: sql<number>`(select count(*)::int from "progress" p where p.case_id = "case"."id" and p.sent_at is not null)`,
  }).from(schema.cases).orderBy(asc(schema.cases.sort));
  const [{ users }] = await db.select({ users: sql<number>`count(*)::int` }).from(schema.user);

  return (
    <AdminGate>
      <div className="page">
        <header className="hcard"><div className="hc-row"><Back href="/" /><span className="chip-g">CMS</span></div>
          <h1>Admin</h1><p className="hc-sub">{rows.length} cases · {users} accounts</p></header>
        <div className="body grow">
          <h3 className="sub-h">Cases</h3>
          <ul className="rows">{rows.map((r) => (
            <li key={r.slug}><Link className="row" href={`/admin/${r.slug}`}>
              <span className="box" style={{ background: r.status === 'live' ? '#3fbf6f' : r.status === 'sealed' ? '#f6d33c' : 'transparent', borderColor: 'transparent' }} />
              <span className="row-t"><b>{r.no}</b>{r.title} <span style={{ color: '#6f6f6b' }}>/{r.slug}</span></span>
              <span className="row-why">{r.status} · {r.docs} dok · {r.readers} readers · {r.sent} kabar sent</span>
            </Link></li>))}
          </ul>
          <h3 className="sub-h">New case</h3>
          <AdminForm action={createCase} submit="Create draft">
            <label className="adm-l">Slug<input name="slug" placeholder="kotak-hitam" required /></label>
            <label className="adm-l">No.<input name="no" placeholder="02" required /></label>
            <label className="adm-l">Title<input name="title" placeholder="Kotak Hitam" required /></label>
          </AdminForm>
          <p className="desk-note">Alur: buat draft → upload file berkas .md → isi config &amp; jawaban → set status ke <b>live</b>. Status <b>sealed</b> tampil di beranda sebagai amplop tertutup.</p>
        </div>
      </div>
    </AdminGate>
  );
}
