import Link from 'next/link';
import { getViewer } from '@/lib/game';
import { Back } from './ui';

/** Server-side gate: only emails in ADMIN_EMAILS get through. */
export async function AdminGate({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (v.admin) return <>{children}</>;
  return (
    <div className="page">
      <header className="hcard"><div className="hc-row"><Back href="/" /></div><h1>Admin</h1><p className="hc-sub">Khusus penyusun arsip.</p></header>
      <div className="body"><div className="lockcard"><h2>{v.user ? 'Not allowed.' : 'Sign in first.'}</h2>
        <p>{v.user ? `${v.user.email} tidak ada di ADMIN_EMAILS.` : 'Masuk dengan email yang terdaftar di ADMIN_EMAILS.'}</p>
        {!v.user && <Link className="cta" href="/login?next=/admin">Sign in</Link>}</div></div>
    </div>
  );
}
