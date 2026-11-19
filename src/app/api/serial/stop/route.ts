import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { readToken } from '@/lib/mail';

/** One-click unsubscribe from the morning letters (signed link, no login needed). */
export async function GET(req: Request) {
  const payload = readToken(new URL(req.url).searchParams.get('t') ?? '');
  const [readerId, caseId] = payload?.split(':') ?? [];
  if (readerId && Number(caseId)) await db.update(schema.serials).set({ active: false }).where(and(eq(schema.serials.readerId, readerId), eq(schema.serials.caseId, Number(caseId))));
  const html = `<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#0a0a0a;color:#eee;font-family:system-ui;display:grid;place-items:center;min-height:90vh;text-align:center"><div><p style="font-weight:800;font-size:22px">postmortem<span style="color:#ff5a1f">●</span></p><p>${payload ? 'Surat pagi dihentikan. Arsipnya tetap menunggu.' : 'Link tidak valid.'}</p><p><a href="/" style="color:#f6d33c">Kembali ke arsip</a></p></div>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
