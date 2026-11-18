import { googleEnabled } from '@/lib/auth';
import { getViewer } from '@/lib/game';
import { LoginView } from '@/components/LoginView';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const v = await getViewer();
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return <LoginView next={safeNext} google={googleEnabled} email={v.user?.email ?? null} devMail={!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'production'} />;
}
