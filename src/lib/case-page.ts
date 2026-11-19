import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getViewer, loadCase, loadProgress, rules } from '@/lib/game';

/** Shared guard for every /c/[slug] page: case must exist and be taken. */
export async function casePage(slug: string) {
  const [viewer, c] = await Promise.all([getViewer(), loadCase(slug)]);
  if (!c) notFound();
  const p = await loadProgress(viewer.readerId, c.id);
  if (!p.acceptedAt) redirect(`/?case=${encodeURIComponent(slug)}`);
  return { viewer, c, p, r: rules(c, p) };
}
