import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { gateEnv, listCases, loadCase, loadDocMd, loadProgress, rules } from '@/lib/game';
import { appUrl, escHtml, letter, sendMail, signToken } from '@/lib/mail';

/** First ~70 words of a document as plain prose: enough to pull you in, never the ending. */
function excerpt(md: string, words = 70) {
  const text = md
    .replace(/^::.*$/gm, '').replace(/^#+\s.*$/gm, '').replace(/^\|.*$/gm, '').replace(/^>\s?/gm, '')
    .replace(/[*_`~]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\\/g, '').replace(/\s+/g, ' ').trim();
  const w = text.split(' ');
  return w.slice(0, words).join(' ') + (w.length > words ? '…' : '');
}

/**
 * Sends today's letter for one subscription. Returns what happened so the cron can report.
 * Same document again only after three quiet days (a nudge, not spam).
 */
export async function sendSerialFor(readerId: string, caseId: number, progressId: string | null): Promise<'sent' | 'waiting' | 'done' | 'locked' | 'error'> {
  const [sub] = await db.select().from(schema.serials).where(and(eq(schema.serials.readerId, readerId), eq(schema.serials.caseId, caseId)));
  if (!sub || !sub.active) return 'done';
  const meta = (await listCases()).find((x) => x.id === caseId);
  const c = meta ? await loadCase(meta.slug) : null;
  if (!c) return 'error';
  const p = await loadProgress(progressId ?? readerId, caseId);
  const r = rules(c, p, await gateEnv(c));
  const next = r.nextUnread;
  const stopUrl = `${appUrl()}/api/serial/stop?t=${signToken(`${readerId}:${caseId}`)}`;
  const foot = `Mode serial postmortem: satu dokumen tiap pagi. <a href="${stopUrl}" style="color:#999">Berhenti</a>.`;

  if (!next) {
    if (p.sentAt || r.readCount >= r.readable.length) {
      await db.update(schema.serials).set({ active: false }).where(and(eq(schema.serials.readerId, readerId), eq(schema.serials.caseId, caseId)));
      return 'done';
    }
    // everything open is read; the next berkas is behind a lock — say which, once
    if (sub.lastCode === '@locked') return 'locked';
    const lockedB = c.berkas.find((b) => !r.berkasUnlocked(b.code));
    const reason = lockedB ? r.berkasLock(lockedB.code).reasons[0] : '';
    const res = await sendMail(sub.email, `${c.title}: ada gembok di depan`, letter({
      kicker: `Case ${c.no} · ${c.title}`, title: 'Arsip berikutnya terkunci.',
      body: `<p>${escHtml(reason || 'Buka gembok berikutnya untuk melanjutkan.')}</p><p>Begitu terbuka, surat pagi akan datang lagi.</p>`,
      cta: { href: `${appUrl()}/c/${c.slug}`, label: 'Buka arsip' }, foot,
    }));
    if (res.ok) await db.update(schema.serials).set({ lastSentAt: new Date(), lastCode: '@locked' }).where(and(eq(schema.serials.readerId, readerId), eq(schema.serials.caseId, caseId)));
    return res.ok ? 'locked' : 'error';
  }

  const again = sub.lastCode === next.code;
  if (again && sub.lastSentAt && Date.now() - sub.lastSentAt.getTime() < 3 * 86400e3 - 3600e3) return 'waiting';
  const md = (await loadDocMd(c.id, next.code)) ?? '';
  const b = c.berkas.find((x) => x.code === next.berkasCode);
  const title = next.title.replace(/\*/g, '');
  const res = await sendMail(sub.email, again ? `Masih menunggu: ${next.code} · ${title}` : `${next.code} · ${title}`, letter({
    kicker: `${again ? 'Masih menunggu · ' : ''}Berkas ${b?.code ?? ''} · ${next.code}`,
    title,
    body: `<p style="color:#57524a">${escHtml(excerpt(md))}</p><p style="font:400 13px/1.5 ui-monospace,monospace;color:#8a8478">${r.readCount} dari ${r.readable.length} dokumen sudah dibaca.</p>`,
    cta: { href: `${appUrl()}/c/${c.slug}/d/${encodeURIComponent(next.code)}`, label: 'Baca selengkapnya' }, foot,
  }));
  if (res.ok) await db.update(schema.serials).set({ lastSentAt: new Date(), lastCode: next.code }).where(and(eq(schema.serials.readerId, readerId), eq(schema.serials.caseId, caseId)));
  return res.ok ? 'sent' : 'error';
}
