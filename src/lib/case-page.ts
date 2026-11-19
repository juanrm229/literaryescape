import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { gateEnv, getViewer, loadCase, loadProgress, rules } from '@/lib/game';
import { roomFor } from '@/lib/coop';

/** Shared guard for every /c/[slug] page: case must exist and be taken. Admins can preview drafts. */
export async function casePage(slug: string) {
  const viewer = await getViewer();
  const c = await loadCase(slug, viewer.admin);
  if (!c) notFound();
  const room = await roomFor(viewer.readerId, c.id);
  const [p, env] = await Promise.all([loadProgress(room ? room.progressId : viewer.readerId, c.id), gateEnv(c)]);
  const preview = c.status !== 'live';
  if (!p.acceptedAt && !preview) redirect(`/?case=${encodeURIComponent(slug)}`);
  return { viewer, room, c, p, env, preview, r: rules(c, p, env) };
}
