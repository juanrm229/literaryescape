import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { progressIdFor } from '@/lib/coop';
import { getViewer, listCases, loadCase, loadProgress, rules, sentCount } from '@/lib/game';
import { stamp } from '@/lib/stamps';
import { chipDate, daysUntil, parseYMD } from '@/lib/jw';
import type { CaseConfig } from '@/lib/case-config';
import { HomeCarousel, type Slide } from '@/components/HomeCarousel';

export const dynamic = 'force-dynamic';

async function waitState(caseId: number, readerId: string | null, email: string | null) {
  const rows = await db.select({ email: schema.waitlist.email, readerId: schema.waitlist.readerId }).from(schema.waitlist).where(eq(schema.waitlist.caseId, caseId));
  return { waiting: rows.length, onList: rows.some((w) => (readerId && w.readerId === readerId) || (email && w.email === email.toLowerCase())), email };
}

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
      const p = await loadProgress(await progressIdFor(viewer.readerId, c.id), c.id);
      const rl = rules(c, p);
      const cfg = c.config;
      slides.push({
        kind: 'live', slug: c.slug, no: c.no, title: c.title, hook: c.hook, tagline: c.tagline,
        today: chipDate(now, false), goal: cfg.card?.goal ?? '', audioHint: cfg.card?.audioHint ?? '',
        countdown: cfg.card?.countdown ?? '', pill: cfg.card?.pill ?? '', wind: cfg.finale?.windu ? chipDate(parseYMD(cfg.finale.windu)) : '',
        days: cfg.finale?.windu ? daysUntil(parseYMD(cfg.finale.windu), now) : 0,
        docs: c.docs.length, berkas: c.berkas.length,
        pct: Math.round((rl.readCount / Math.max(1, rl.readable.length)) * 100), stamps: rl.stampCount,
        accepted: !!p.acceptedAt, sent: !!p.sentAt, voices: await sentCount(c.id), brief: cfg.card?.brief ?? [], when: cfg.card?.when ?? 'THU 8 FEB 1979', voice: cfg.card?.voice ?? 'K', sound: cfg.card?.sound ?? 'oars', chip: cfg.card?.chip ?? '', pillLine: cfg.card?.pillLine ?? '', doneLabel: cfg.card?.doneLabel ?? '',
      });
    } else {
      const cfg = r.config as Partial<CaseConfig>;
      slides.push({
        kind: 'sealed', slug: r.slug, no: r.no, title: r.title, tagline: r.tagline,
        seal: stamp({ title: 'Sealed', sub: `Case ${r.no} · belum dikirim`, motif: 'envelope', palette: 'bone', year: '20—', postmark: ['SEALED', 'POSTMORTEM'] }) as string,
        lines: (cfg as { teaserLines?: number[][] }).teaserLines ?? [[38, 70, 52], [62, 44], [80, 30, 56]],
        opensAt: (cfg as { opensAt?: string }).opensAt ?? null, teaser: (cfg as { teaser?: string }).teaser ?? null,
        ...(await waitState(r.id, viewer.readerId, viewer.user?.email ?? null)),
      });
    }
  }
  const start = Math.max(0, slides.findIndex((s) => s.slug === sp.case));
  return <HomeCarousel slides={slides} start={start} signedIn={!!viewer.user} meInitial={(viewer.user?.email?.[0] ?? "?").toUpperCase()} />;
}
