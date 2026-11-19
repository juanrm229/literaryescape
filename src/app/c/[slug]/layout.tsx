import { getViewer, loadCase } from '@/lib/game';
import { roomFor } from '@/lib/coop';
import { RoomDock } from '@/components/Room';

/** Every page of a case shares one layout so the co-op dock (and its polling) survives navigation. */
export default async function CaseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await getViewer();
  const c = await loadCase(slug, v.admin);
  const room = c ? await roomFor(v.readerId, c.id) : null;
  return <>{children}{room && <RoomDock key={room.code} slug={slug} code={room.code} />}</>;
}
