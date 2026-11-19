import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { memberships } from '@/lib/coop';
import { sendSerialFor } from '@/lib/serial';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Vercel Cron, daily 06.00 WIB. Sends each active serial reader their next document. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Preferred: CRON_SECRET (Vercel sends it as a bearer token). Without it, accept Vercel Cron's user agent:
  // the worst a spoofed call can do is send a subscriber the letter they'd get anyway (duplicates are suppressed).
  const ok = secret
    ? req.headers.get('authorization') === `Bearer ${secret}`
    : process.env.NODE_ENV !== 'production' || (req.headers.get('user-agent') ?? '').startsWith('vercel-cron/');
  if (!ok) return new Response('unauthorized', { status: 401 });
  const subs = await db.select().from(schema.serials).where(eq(schema.serials.active, true)).limit(300);
  const tally: Record<string, number> = {};
  for (const s of subs) {
    const seat = (await memberships(s.readerId)).find((m) => m.caseId === s.caseId);
    const r = await sendSerialFor(s.readerId, s.caseId, seat?.progressId ?? s.readerId).catch(() => 'error' as const);
    tally[r] = (tally[r] ?? 0) + 1;
  }
  return Response.json({ subs: subs.length, ...tally });
}
