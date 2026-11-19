'use server';

import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getViewer, listCases, loadCase } from '@/lib/game';
import { progressIdFor } from '@/lib/coop';
import { validEmail } from '@/lib/mail';
import { sendSerialFor } from '@/lib/serial';

/** "Kabari aku" on a sealed case. */
export async function joinWaitlist(slug: string, rawEmail: string) {
  const v = await getViewer();
  const email = String(rawEmail ?? v.user?.email ?? '').trim().toLowerCase();
  if (!validEmail(email)) return { ok: false as const, reason: 'email' };
  const c = (await listCases()).find((x) => x.slug === slug && x.status === 'sealed');
  if (!c) return { ok: false as const, reason: 'case' };
  await db.insert(schema.waitlist).values({ caseId: c.id, email, readerId: v.readerId }).onConflictDoNothing();
  return { ok: true as const };
}

/** Serial mode: one document every morning (06.00 WIB) until the archive is done. */
export async function setSerial(slug: string, on: boolean, rawEmail?: string) {
  const v = await getViewer();
  if (!v.readerId) return { ok: false as const, reason: 'reader' };
  const c = await loadCase(slug, v.admin);
  if (!c) return { ok: false as const, reason: 'case' };
  if (!on) {
    await db.update(schema.serials).set({ active: false }).where(and(eq(schema.serials.readerId, v.readerId), eq(schema.serials.caseId, c.id)));
    return { ok: true as const, on: false };
  }
  const email = String(rawEmail || v.user?.email || '').trim().toLowerCase();
  if (!validEmail(email)) return { ok: false as const, reason: 'email' };
  await db.insert(schema.serials).values({ readerId: v.readerId, caseId: c.id, email })
    .onConflictDoUpdate({ target: [schema.serials.readerId, schema.serials.caseId], set: { email, active: true } });
  // the first letter goes out right away, so the reader sees what they signed up for
  const first = await sendSerialFor(v.readerId, c.id, await progressIdFor(v.readerId, c.id));
  if (first === 'done') return { ok: false as const, reason: 'done' };
  return { ok: true as const, on: true, sent: first };
}
