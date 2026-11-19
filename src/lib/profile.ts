import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { listCases, loadCase, rules, kliwonNightWIB, emptyProgress, placedPeople, type Progress } from '@/lib/game';
import { berkasStamp, kenalStamp, kabarStamp, stamp } from '@/lib/stamps';

export const RANKS = [
  { min: 0, name: 'Pembaca', line: 'Baru membuka amplop pertama.' },
  { min: 40, name: 'Pencatat', line: 'Mulai menulis nama, umur, tanggal lahir.' },
  { min: 150, name: 'Penyidik', line: 'Membaca catatan pinggir, bukan cuma isinya.' },
  { min: 400, name: 'Korektor', line: 'Mencari kalimat yang salah. Menemukannya.' },
  { min: 900, name: 'Arsiparis', line: 'Tahu letak setiap berkas tanpa melihat.' },
  { min: 1600, name: 'Pembawa Kabar', line: 'Laut sudah menyimpan nama yang kamu tulis.' },
];

export type Achievement = { key: string; title: string; line: string; got: boolean };
export type CaseProfile = {
  slug: string; no: string; title: string; accepted: boolean; sent: boolean;
  read: number; total: number; stamps: { key: string; name: string; html: string; desc: string }[];
};

const WIB = 7 * 3600e3;
const wibHour = (iso: string) => new Date(new Date(iso).getTime() + WIB).getUTCHours();

/** Everything the profile page shows, across every live case. */
export async function buildProfile(readerId: string | null) {
  const rows = readerId ? await db.select().from(schema.progress).where(eq(schema.progress.readerId, readerId)) : [];
  const cases = (await listCases()).filter((c) => c.status === 'live');
  const out: CaseProfile[] = [];
  let points = 0, docsRead = 0, solved = 0, closed = 0, stampsTotal = 0;
  const flags = { firstStamp: false, locksmith: 0, noClue: false, night: false, kliwon: false, allKenal: false, sent: false, fullArchive: false, radio: false };

  for (const meta of cases) {
    const c = await loadCase(meta.slug);
    if (!c) continue;
    const row = rows.find((r) => r.caseId === c.id);
    const p: Progress = row ? { acceptedAt: row.acceptedAt, sentAt: row.sentAt, data: { ...emptyProgress(), ...row.data } } : { acceptedAt: null, sentAt: null, data: emptyProgress() };
    const r = rules(c, p);
    const stamps: CaseProfile['stamps'] = [];
    for (const b of c.berkas) if (p.data.stamps[b.code]) stamps.push({ key: `${c.slug}:b:${b.code}`, name: `Berkas ${b.code} · ${b.title}`, html: berkasStamp(c.config, b), desc: `${c.title} · berkas selesai` });
    for (const code of Object.keys(c.config.kenal ?? {})) if (p.data.kenal[code]) stamps.push({ key: `${c.slug}:k:${code}`, name: c.config.kenal[code][0], html: kenalStamp(c.config, code), desc: `${c.title} · kartu kenal` });
    for (const z of c.puzzles) {
      const rs = (z.reward as { stamp?: { title: string; sub?: string; motif?: string; palette?: string; year?: string } }).stamp;
      if (p.data.solved?.[z.key] && rs) stamps.push({ key: `${c.slug}:p:${z.key}`, name: rs.title, html: stamp({ title: rs.title, sub: rs.sub || z.title, motif: rs.motif || 'key', palette: rs.palette || 'night', year: rs.year || '' }) as string, desc: `${c.title} · gembok terbuka` });
    }
    if (p.sentAt) for (const person of await placedPeople(c.id, p.data.placed)) stamps.push({ key: `${c.slug}:x:${person.idx}`, name: person.name, html: kabarStamp(person, true), desc: `${c.title} · kabar terkirim` });

    const solvedHere = Object.keys(p.data.solved ?? {}).length;
    docsRead += r.readCount; solved += solvedHere; stampsTotal += stamps.length;
    if (p.sentAt) closed++;
    points += r.readCount + Object.keys(p.data.stamps).length * 10 + Object.keys(p.data.kenal).length * 3 + solvedHere * 15 + (p.sentAt ? 300 : 0);
    if (Object.keys(p.data.stamps).length) flags.firstStamp = true;
    flags.locksmith += solvedHere;
    if (Object.keys(p.data.solved ?? {}).some((k) => !p.data.pzHints?.[k])) flags.noClue = true;
    const reads = Object.values(p.data.read);
    if (reads.some((iso) => { const h = wibHour(iso); return h >= 1 && h < 3; })) flags.night = true;
    if (reads.some((iso) => kliwonNightWIB(new Date(iso)))) flags.kliwon = true;
    const kenalAll = Object.keys(c.config.kenal ?? {});
    if (kenalAll.length && kenalAll.every((k) => p.data.kenal[k])) flags.allKenal = true;
    if (p.sentAt) flags.sent = true;
    if (r.readable.length && r.readCount === r.readable.length) flags.fullArchive = true;
    if (c.puzzles.some((z) => z.kind === 'frequency' && p.data.solved?.[z.key])) flags.radio = true;
    out.push({ slug: c.slug, no: c.no, title: c.title, accepted: !!p.acceptedAt, sent: !!p.sentAt, read: r.readCount, total: r.readable.length, stamps });
  }

  const rankIdx = RANKS.reduce((acc, rk, i) => (points >= rk.min ? i : acc), 0);
  const next = RANKS[rankIdx + 1];
  const achievements: Achievement[] = [
    { key: 'first', title: 'Cap pertama', line: 'Selesaikan satu berkas.', got: flags.firstStamp },
    { key: 'kenal', title: 'Mengenal mereka', line: 'Kumpulkan semua kartu kenal dalam satu perkara.', got: flags.allKenal },
    { key: 'lock', title: 'Tukang kunci', line: 'Buka tiga gembok.', got: flags.locksmith >= 3 },
    { key: 'clue', title: 'Tanpa clue', line: 'Buka gembok tanpa membuka clue-nya.', got: flags.noClue },
    { key: 'radio', title: 'Telinga radio', line: 'Temukan frekuensi yang benar.', got: flags.radio },
    { key: 'night', title: 'Lewat tengah malam', line: 'Membaca antara pukul 01.00 dan 03.00 WIB.', got: flags.night },
    { key: 'kliwon', title: 'Malam Jumat Kliwon', line: 'Membaca pada malam Jumat Kliwon.', got: flags.kliwon },
    { key: 'full', title: 'Arsip lengkap', line: 'Baca setiap dokumen dalam satu perkara.', got: flags.fullArchive },
    { key: 'sent', title: 'Pembawa kabar', line: 'Kirim kabar sampai selesai.', got: flags.sent },
  ];
  return {
    points, rank: RANKS[rankIdx], next, progressToNext: next ? (points - RANKS[rankIdx].min) / (next.min - RANKS[rankIdx].min) : 1,
    stats: { docsRead, solved, closed, stamps: stampsTotal, cases: out.filter((x) => x.accepted).length },
    cases: out, achievements, since: rows.length ? rows.reduce((m, r) => (r.acceptedAt && (!m || r.acceptedAt < m) ? r.acceptedAt : m), null as Date | null) : null,
  };
}
