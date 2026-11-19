import { casePage } from '@/lib/case-page';
import { answerCount, placedPeople } from '@/lib/game';
import { berkasStamp, kenalStamp, kabarStamp, blankStamp } from '@/lib/stamps';
import { fmt } from '@/lib/jw';
import { CaseHeader } from '@/components/CaseHeader';
import { StampsView, type Collection } from '@/components/StampsView';
import { ShellSync } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function Stamps({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { c, p, r } = await casePage(slug);
  const cfg = c.config;
  const colls: Collection[] = [
    {
      key: 'berkas', name: 'Berkas', desc: 'Dicap setiap kali satu berkas selesai dibaca.',
      items: c.berkas.map((b) => {
        const got = r.berkasDone(b.code) && (b.code === cfg.finale.berkas || !!p.data.stamps[b.code]);
        return { key: 'b:' + b.code, got, html: (got ? berkasStamp(cfg, b) : blankStamp(b.code)) as string, name: `Berkas ${b.code} · ${b.title}`,
          desc: got ? (b.code === cfg.finale.berkas ? 'Dicap waktu kabar dikirim.' : `Dicap ${fmt(new Date(p.data.stamps[b.code]))}.`) : 'Belum dicap.',
          share: !got ? undefined : b.code === cfg.finale.berkas ? (p.sentAt ? `/api/share/${slug}?k=sent` : undefined) : p.data.stamps[b.code] ? `/api/share/${slug}?k=b:${encodeURIComponent(b.code)}` : undefined };
      }),
    },
    {
      key: 'kenal', name: 'Kartu Kenal', desc: 'Nama, wajah atau suara, satu kebiasaan. Tiga syarat untuk mengenal seseorang.',
      items: Object.keys(cfg.kenal).map((code, i) => {
        const got = !!p.data.kenal[code];
        const [name, habit, boat] = cfg.kenal[code];
        return { key: 'k:' + code, got, html: (got ? kenalStamp(cfg, code) : blankStamp(String(i + 1))) as string, name: got ? name : '—', desc: got ? `${habit} · ${boat}.` : 'Kartu kenal belum dibaca.', href: got ? `/c/${slug}/d/${code}` : undefined, share: got ? `/api/share/${slug}?k=k:${encodeURIComponent(code)}` : undefined };
      }),
    },
  ];
  if (r.kabarUnlocked) {
    const people = await placedPeople(c.id, p.data.placed);
    const total = await answerCount(c.id);
    colls.push({
      key: 'kabar', name: 'Kabar', desc: `Untuk amplop beralamat ${cfg.finale.address}. Kamu yang nulis namanya.`,
      items: Array.from({ length: total }, (_, i) => {
        const person = people[i];
        return person
          ? { key: 'x:' + person.idx, got: true, html: kabarStamp(person, p.data.recited.includes(person.idx)), name: person.name, desc: `“${person.question}”` }
          : { key: 'x?' + i, got: false, html: blankStamp('') as string, name: '—', desc: '' };
      }),
    });
  }
  const last = Object.entries(p.data.kenal).sort((a, b) => a[1].localeCompare(b[1])).pop();
  const lastB = Object.entries(p.data.stamps).sort((a, b) => a[1].localeCompare(b[1])).pop();
  const startColl = p.sentAt ? 'berkas' : last && (!lastB || last[1] > lastB[1]) ? 'kenal' : 'berkas';

  return (
    <div className="page">
      <ShellSync believe={p.data.believe} />
      <CaseHeader c={c} p={p} tab="stamps" />
      <StampsView colls={colls} startColl={startColl} />
    </div>
  );
}
