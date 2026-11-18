import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Back } from '@/components/ui';
import { AdminForm } from '@/components/AdminForms';
import { AdminGate } from '@/components/AdminGate';
import { updateMeta, uploadBerkas, saveConfig, saveAnswers, deleteCase } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminCase({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [c] = await db.select().from(schema.cases).where(eq(schema.cases.slug, slug));
  if (!c) notFound();
  const berkas = await db.select().from(schema.berkas).where(eq(schema.berkas.caseId, c.id)).orderBy(asc(schema.berkas.sort));
  const docs = await db.select({ code: schema.documents.code, title: schema.documents.title, berkasCode: schema.documents.berkasCode, lock: schema.documents.lock })
    .from(schema.documents).where(eq(schema.documents.caseId, c.id)).orderBy(asc(schema.documents.sort));
  const answers = await db.select().from(schema.answers).where(eq(schema.answers.caseId, c.id)).orderBy(asc(schema.answers.idx));
  const wrongRows = await db.select().from(schema.wrongAnswers).where(eq(schema.wrongAnswers.caseId, c.id));
  const wrong: Record<string, string[]> = {};
  wrongRows.forEach((w) => (wrong[w.code] ||= []).push(w.alias));
  const answersJson = JSON.stringify({ answers: answers.map(({ name, aliases, habit, question, year }) => ({ name, aliases, habit, question, year })), wrong }, null, 2);

  return (
    <AdminGate>
      <div className="page">
        <header className="hcard"><div className="hc-row"><Back href="/admin" />{c.status === 'live' && <Link className="pillbtn" href={`/c/${slug}`}>Open</Link>}</div>
          <span className="chip-g">{c.status} · /{slug}</span><h1>{c.title}</h1><p className="hc-sub">{berkas.length} berkas · {docs.length} dokumen · {answers.length} jawaban</p></header>
        <div className="body grow">
          <h3 className="sub-h">Metadata</h3>
          <AdminForm action={updateMeta.bind(null, slug)} submit="Save metadata">
            <label className="adm-l">Status<select name="status" defaultValue={c.status}><option value="draft">draft — hidden</option><option value="sealed">sealed — teaser on home</option><option value="live">live — playable</option></select></label>
            <label className="adm-l">No.<input name="no" defaultValue={c.no} /></label>
            <label className="adm-l">Sort<input name="sort" type="number" defaultValue={c.sort} /></label>
            <label className="adm-l">Title<input name="title" defaultValue={c.title} /></label>
            <label className="adm-l">Tagline<input name="tagline" defaultValue={c.tagline} /></label>
            <label className="adm-l">Hook<textarea name="hook" rows={2} defaultValue={c.hook} /></label>
            <label className="adm-l">Author<input name="author" defaultValue={c.author} /></label>
          </AdminForm>

          <h3 className="sub-h">Upload berkas</h3>
          <p className="desk-note">Satu file .md per berkas: <code># Berkas IV · Windu</code>, lalu <code>## IV-01 · Judul</code> per dokumen. Upload ulang mengganti berkas yang sama; progress pembaca tetap.</p>
          <AdminForm action={uploadBerkas.bind(null, slug)} submit="Import">
            <input className="adm-file" type="file" name="files" accept=".md,text/markdown" multiple />
          </AdminForm>
          <ul className="rows">{berkas.map((b) => (
            <li key={b.code}><div className="row"><span className="box" /><span className="row-t"><b>Berkas {b.code}</b>{b.title}</span>
              <span className="row-why">{docs.filter((d) => d.berkasCode === b.code).map((d) => d.code + (d.lock ? ` 🔒${d.lock}` : '')).join(' · ')}</span></div></li>))}
          </ul>

          <h3 className="sub-h">Config</h3>
          <p className="desk-note">Skin per dokumen, label kaset, meta berkas, kartu kenal, petunjuk, finale (berkas terkunci, tanggal windu), balasan jawaban salah.</p>
          <AdminForm action={saveConfig.bind(null, slug)} submit="Save config">
            <textarea className="adm-code" name="config" rows={18} defaultValue={JSON.stringify(c.config, null, 2)} spellCheck={false} />
          </AdminForm>

          <h3 className="sub-h">Answers</h3>
          <p className="desk-note">Disimpan hanya di server. Pembaca tidak pernah menerima daftar ini; nama dicek lewat server action.</p>
          <AdminForm action={saveAnswers.bind(null, slug)} submit="Save answers">
            <textarea className="adm-code" name="answers" rows={18} defaultValue={answersJson} spellCheck={false} />
          </AdminForm>

          <h3 className="sub-h">Danger zone</h3>
          <AdminForm action={deleteCase.bind(null, slug)} submit="Delete case" danger>
            <label className="adm-l">Ketik “{slug}” untuk menghapus<input name="confirm" autoComplete="off" /></label>
          </AdminForm>
        </div>
      </div>
    </AdminGate>
  );
}
