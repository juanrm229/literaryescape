import { and, count, eq, isNotNull, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getViewer, loadCase, loadProgress } from '@/lib/game';
import { buildProfile } from '@/lib/profile';
import { rankCardSvg, sentCardSvg, stampCardSvg, toPng } from '@/lib/share-card';

export const runtime = 'nodejs';

/** Postmark date, WIB: 18 · XI · 2026 */
const postDate = (d: Date) => { const w = new Date(d.getTime() + 7 * 3600e3); return `${w.getUTCDate()} · ${['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][w.getUTCMonth()]} · ${w.getUTCFullYear()}`; };

const KINDS: Record<string, string> = { b: 'Berkas selesai', k: 'Kartu kenal', p: 'Gembok terbuka' };

/**
 * GET /api/share/<slug>?k=b:I | k:I-03 | p:lab-radio | sent      (case items)
 * GET /api/share/me?k=rank                                         (profile)
 * Only renders what this reader has actually earned. Kabar names are never drawn.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const k = url.searchParams.get('k') ?? '';
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'postmortem').replace(/:\d+$/, '');
  const v = await getViewer();
  const no = (msg: string, status = 404) => new Response(msg, { status });
  let svg: string;

  if (slug === 'me' && k === 'rank') {
    const pr = await buildProfile(v.readerId);
    svg = rankCardSvg({
      rank: pr.rank.name, line: pr.rank.line, points: pr.points, next: pr.next?.name, toNext: pr.progressToNext, host,
      stats: [[String(pr.stats.docsRead), 'dokumen'], [String(pr.stats.stamps), 'stamps'], [String(pr.stats.solved), 'gembok'], [String(pr.stats.closed), 'ditutup']],
      stamps: pr.cases.flatMap((c) => c.stamps.filter((s) => !s.key.includes(':x:')).map((s) => s.html)),
    });
  } else if (k === 'sent') {
    const c = await loadCase(slug);
    if (!c || !v.readerId) return no('not found');
    const p = await loadProgress(v.readerId, c.id);
    if (!p.sentAt) return no('belum dikirim', 403);
    const [{ n }] = await db.select({ n: count() }).from(schema.progress)
      .where(and(eq(schema.progress.caseId, c.id), isNotNull(schema.progress.sentAt), lte(schema.progress.sentAt, p.sentAt)));
    svg = sentCardSvg({ caseNo: c.no, caseTitle: c.title, address: c.config.finale.address || 'Laut', names: Object.keys(p.data.placed).length, nth: Number(n), date: postDate(new Date(p.sentAt)), host, slug });
  } else {
    const [kind, ...rest] = k.split(':');
    if (!KINDS[kind] || !rest.length) return no('bad key', 400);
    const pr = await buildProfile(v.readerId);
    const cp = pr.cases.find((c) => c.slug === slug);
    const s = cp?.stamps.find((x) => x.key === `${slug}:${k}`);
    if (!cp || !s) return no('stamp belum didapat', 403);
    const sub = kind === 'k' ? `Kartu kenal · ${cp.title}` : kind === 'p' ? `${s.desc}` : `Berkas ${rest.join(':')} · dicap`;
    svg = stampCardSvg({ kind: KINDS[kind], title: s.name.replace(/^Berkas \S+ · /, ''), sub, stampSvg: s.html, caseNo: cp.no, caseTitle: cp.title, host, slug });
  }

  const png = toPng(svg);
  const name = `postmortem-${slug}-${k.replace(/[^\w-]+/g, '-')}.png`;
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': `${url.searchParams.get('dl') ? 'attachment' : 'inline'}; filename="${name}"`,
    },
  });
}
