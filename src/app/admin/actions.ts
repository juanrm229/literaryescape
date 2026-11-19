'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { clearContentCache, getViewer } from '@/lib/game';
import { importBerkasMarkdown, replaceAnswers, type AnswerInput } from '@/lib/content/import';
import type { CaseStatus } from '@/db/schema';

export type FormState = { ok?: boolean; msg?: string } | null;

async function requireAdmin() {
  const v = await getViewer();
  if (!v.admin) throw new Error('Admin only');
}
async function caseId(slug: string) {
  const [c] = await db.select({ id: schema.cases.id }).from(schema.cases).where(eq(schema.cases.slug, slug));
  if (!c) throw new Error('Case not found');
  return c.id;
}
const done = (msg: string, ...paths: string[]): FormState => { clearContentCache(); paths.forEach((p) => revalidatePath(p)); revalidatePath('/'); return { ok: true, msg }; };
const fail = (e: unknown): FormState => ({ ok: false, msg: e instanceof Error ? e.message : String(e) });

export async function createCase(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const slug = String(fd.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const no = String(fd.get('no') || '').trim();
    const title = String(fd.get('title') || '').trim();
    if (!slug || !no || !title) throw new Error('slug, no, dan title wajib diisi');
    await db.insert(schema.cases).values({ slug, no, title, status: 'draft', sort: Number(no) || 99, config: {} });
    return done(`Case ${slug} dibuat (draft).`, '/admin');
  } catch (e) { return fail(e); }
}

export async function updateMeta(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const status = String(fd.get('status')) as CaseStatus;
    if (!['draft', 'sealed', 'live'].includes(status)) throw new Error('status tidak valid');
    await db.update(schema.cases).set({
      no: String(fd.get('no') || ''), title: String(fd.get('title') || ''), tagline: String(fd.get('tagline') || ''),
      hook: String(fd.get('hook') || ''), author: String(fd.get('author') || ''), status, sort: Number(fd.get('sort')) || 0, updatedAt: new Date(),
    }).where(eq(schema.cases.slug, slug));
    return done('Metadata tersimpan.', `/admin/${slug}`, '/admin');
  } catch (e) { return fail(e); }
}

export async function uploadBerkas(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const id = await caseId(slug);
    const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new Error('Pilih minimal satu file .md');
    const out: string[] = [];
    for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
      const r = await importBerkasMarkdown(id, await f.text());
      out.push(`Berkas ${r.berkas} (${r.docs} dok)`);
    }
    return done('Diimpor: ' + out.join(', '), `/admin/${slug}`, `/c/${slug}`);
  } catch (e) { return fail(e); }
}

export async function saveConfig(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const cfg = JSON.parse(String(fd.get('config') || '{}'));
    if (typeof cfg !== 'object' || Array.isArray(cfg)) throw new Error('Config harus object JSON');
    for (const k of ['skins', 'berkas', 'finale', 'replies', 'hints']) if (!(k in cfg)) throw new Error(`Config butuh key "${k}" untuk case live`);
    await db.update(schema.cases).set({ config: cfg, updatedAt: new Date() }).where(eq(schema.cases.slug, slug));
    return done('Config tersimpan.', `/admin/${slug}`);
  } catch (e) { return fail(e); }
}

export async function saveAnswers(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    const id = await caseId(slug);
    const json = JSON.parse(String(fd.get('answers') || '{}')) as { answers: AnswerInput[]; wrong: Record<string, string[]> };
    if (!Array.isArray(json.answers)) throw new Error('Butuh { "answers": [...], "wrong": {...} }');
    for (const a of json.answers) if (!a.name || !Array.isArray(a.aliases) || typeof a.year !== 'number') throw new Error(`Jawaban tidak lengkap: ${JSON.stringify(a).slice(0, 80)}`);
    const r = await replaceAnswers(id, json.answers, json.wrong || {});
    return done(`${r.answers} jawaban tersimpan.`, `/admin/${slug}`);
  } catch (e) { return fail(e); }
}

export async function deleteCase(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await requireAdmin();
    if (String(fd.get('confirm')) !== slug) throw new Error(`Ketik "${slug}" untuk konfirmasi`);
    await db.delete(schema.cases).where(eq(schema.cases.slug, slug));
    return done('Case dihapus.', '/admin');
  } catch (e) { return fail(e); }
}
