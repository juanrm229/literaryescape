import { getViewer, listCases, loadCase, loadProgress, rules, sentCount } from '@/lib/game';
import { stamp } from '@/lib/stamps';
import { chipDate, daysUntil, parseYMD } from '@/lib/jw';
import type { CaseConfig } from '@/lib/case-config';
import { HomeCarousel, type Slide } from '@/components/HomeCarousel';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ case?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const rows = await listCases();
  const now = new Date();
  const slides: Slide[] = [];
  for (const r of rows) {
    if (r.status === 'live') {
      const c = await loadCase(r.slug);
      if (!c) continue;
      const p = await loadProgress(viewer.readerId, c.id);
      const rl = rules(c, p);
      const cfg = c.config;
      slides.push({
        kind: 'live', slug: c.slug, no: c.no, title: c.title, hook: c.hook, tagline: c.tagline,
        today: chipDate(now, false), goal: cfg.card?.goal ?? '', audioHint: cfg.card?.audioHint ?? '',
        countdown: cfg.card?.countdown ?? '', pill: cfg.card?.pill ?? '', wind: cfg.finale?.windu ? chipDate(parseYMD(cfg.finale.windu)) : '',
        days: cfg.finale?.windu ? daysUntil(parseYMD(cfg.finale.windu), now) : 0,
        docs: c.docs.length, berkas: c.berkas.length,
        pct: Math.round((rl.readCount / Math.max(1, rl.readable.length)) * 100), stamps: rl.stampCount,
        accepted: !!p.acceptedAt, sent: !!p.sentAt, voices: await sentCount(c.id),
      });
    } else {
      const cfg = r.config as Partial<CaseConfig>;
      slides.push({
        kind: 'sealed', slug: r.slug, no: r.no, title: r.title, tagline: r.tagline,
        seal: stamp({ title: 'Sealed', sub: `Case ${r.no} · belum dikirim`, motif: 'envelope', palette: 'bone', year: '20—', postmark: ['SEALED', 'POSTMORTEM'] }) as string,
        lines: (cfg as { teaserLines?: number[][] }).teaserLines ?? [[38, 70, 52], [62, 44], [80, 30, 56]],
      });
    }
  }
  const start = Math.max(0, slides.findIndex((s) => s.slug === sp.case));
  return <HomeCarousel slides={slides} start={start} signedIn={!!viewer.user} />;
}
