/**
 * Seed / re-seed a case from content/<slug>/ (markdown berkas files + case.json).
 * Usage: npm run db:seed            (seeds every folder in content/)
 *        npm run db:seed -- nyewu   (one case)
 *        tsx scripts/seed.ts --if-empty   (only cases not yet in the DB — used on every deploy,
 *                                          so edits made in /admin are never overwritten — unless
 *                                          case.json bumps config.contentVersion)
 * Progress of readers is kept; content, config and answers are replaced.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db';
import { importBerkasMarkdown, replaceAnswers, replacePuzzles } from '../src/lib/content/import';

const ROOT = path.resolve(import.meta.dirname, '..', 'content');

async function seedCase(slug: string) {
  const dir = path.join(ROOT, slug);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'case.json'), 'utf8'));
  const values = { ...meta.case, config: meta.config, updatedAt: new Date() };
  const [row] = await db.insert(schema.cases).values(values)
    .onConflictDoUpdate({ target: schema.cases.slug, set: values }).returning();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  for (const f of files) {
    const r = await importBerkasMarkdown(row.id, fs.readFileSync(path.join(dir, f), 'utf8'));
    console.log(`  ${slug} · Berkas ${r.berkas} — ${r.title}: ${r.docs} docs`);
  }
  if (meta.answers) await replaceAnswers(row.id, meta.answers, meta.wrong || {});
  await replacePuzzles(row.id, meta.puzzles || []);
  console.log(`✓ ${slug}: ${files.length} berkas, ${meta.answers?.length ?? 0} answers`);
}

async function seedPlaceholders() {
  for (const [slug, no] of [['case-02', '02'], ['case-03', '03']]) {
    const exists = await db.select().from(schema.cases).where(eq(schema.cases.slug, slug));
    if (!exists.length) await db.insert(schema.cases).values({ slug, no, title: `Case ${no}`, status: 'sealed', sort: Number(no), tagline: 'Sealed', config: {} });
  }
}

const args = process.argv.slice(2);
const ifEmpty = args.includes('--if-empty');
const only = args.find((a) => !a.startsWith('--'));
const slugs = only ? [only] : fs.readdirSync(ROOT).filter((d) => fs.existsSync(path.join(ROOT, d, 'case.json')));
for (const s of slugs) {
  if (ifEmpty) {
    const [row] = await db.select({ config: schema.cases.config }).from(schema.cases).where(eq(schema.cases.slug, s));
    // a bumped `config.contentVersion` in the repo means "ship this content on the next deploy"
    const want = Number(JSON.parse(fs.readFileSync(path.join(ROOT, s, 'case.json'), 'utf8')).config?.contentVersion ?? 0);
    const have = Number((row?.config as { contentVersion?: number } | undefined)?.contentVersion ?? 0);
    if (row && want <= have) { console.log(`· ${s}: already in the database (v${have}), skipped`); continue; }
    if (row) console.log(`↻ ${s}: content v${have} → v${want}`);
  }
  await seedCase(s);
}
if (!only) await seedPlaceholders();
process.exit(0);
