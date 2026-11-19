import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { Back } from '@/components/ui';
import { AdminGate } from '@/components/AdminGate';
import { AdminForm } from '@/components/AdminForms';
import { purgeReaders } from '../actions';

export const dynamic = 'force-dynamic';

type Row = { id: string; created: string; cases: number; docs: number; sent: number; seat: string | null; events: number };

/**
 * Housekeeping: anonymous readers (no account) and empty co-op tables. Likely test data is pre-ticked
 * (no account, nothing sent, ≤ 3 documents read, not seated); everything is reviewable before deleting.
 */
export default async function Cleanup() {
  const { rows } = await db.execute(sql`
    select r.id, to_char(r.created_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') as created,
      (select count(*)::int from progress p where p.reader_id = r.id and p.accepted_at is not null) as cases,
      (select coalesce(sum((select count(*) from jsonb_object_keys(p.data->'read'))),0)::int from progress p where p.reader_id = r.id) as docs,
      (select count(*)::int from progress p where p.reader_id = r.id and p.sent_at is not null) as sent,
      (select m.code from room_member m where m.reader_id = r.id limit 1) as seat,
      (select count(*)::int from event e where e.reader_id = r.id) as events
    from reader r where r.user_id is null and r.id not like 'room:%'
    order by r.created_at desc limit 300`);
  const readers = rows as unknown as Row[];
  const { rows: roomRows } = await db.execute(sql`
    select r.code, to_char(r.created_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI') as created,
      (select count(*)::int from room_member m where m.code = r.code) as members
    from room r order by r.created_at desc limit 200`);
  const rooms = roomRows as unknown as { code: string; created: string; members: number }[];
  const likely = (r: Row) => !r.sent && r.docs <= 3 && !r.seat;

  return (
    <AdminGate>
      <div className="page">
        <header className="hcard"><div className="hc-row"><Back href="/admin" /><span className="chip-g">CMS</span></div>
          <h1>Data uji</h1><p className="hc-sub">{readers.length} pembaca anonim · {rooms.length} meja co-op</p></header>
        <div className="body grow">
          <p className="desk-note">Akun tidak pernah dihapus dari sini. Yang dicentang otomatis: tanpa akun, belum menutup perkara, ≤ 3 dokumen dibaca, tidak duduk di meja. Periksa dulu, lalu hapus.</p>
          <AdminForm action={purgeReaders} submit="Hapus yang dicentang" danger>
            <h3 className="sub-h">Pembaca anonim</h3>
            <div className="adm-list">{readers.map((r) => (
              <label key={r.id} className="adm-check"><input type="checkbox" name="reader" value={r.id} defaultChecked={likely(r)} />
                <span><b>{r.id.slice(0, 13)}</b> · {r.created} WIB<small>{r.cases} perkara · {r.docs} dokumen · {r.events} aktivitas{r.sent ? ' · selesai' : ''}{r.seat ? ` · meja ${r.seat}` : ''}</small></span></label>
            ))}{!readers.length && <p className="desk-note">Tidak ada.</p>}</div>
            <h3 className="sub-h">Meja co-op</h3>
            <div className="adm-list">{rooms.map((r) => (
              <label key={r.code} className="adm-check"><input type="checkbox" name="room" value={r.code} defaultChecked={r.members === 0} />
                <span><b>{r.code}</b> · {r.created} WIB<small>{r.members ? `${r.members} orang duduk` : 'kosong'}</small></span></label>
            ))}{!rooms.length && <p className="desk-note">Tidak ada.</p>}</div>
            <label className="adm-check"><input type="checkbox" name="waitlistTest" defaultChecked /><span>Email daftar tunggu @example.com<small>Alamat uji.</small></span></label>
          </AdminForm>
        </div>
      </div>
    </AdminGate>
  );
}
