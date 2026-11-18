'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Back } from './ui';
import { authClient } from '@/lib/auth-client';

export function LoginView({ next, google, email, devMail }: { next: string; google: boolean; email: string | null; devMail: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [addr, setAddr] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addr) return;
    setState('sending');
    const { error } = await authClient.signIn.magicLink({ email: addr, callbackURL: next });
    if (error) { setErr(error.message || 'Gagal mengirim link.'); setState('error'); } else setState('sent');
  };

  return (
    <div className="page">
      <header className="hcard">
        <div className="hc-row"><Back href={next} /></div>
        <h1>Sign in</h1><p className="hc-sub">Sync progress, stamps, dan catatan ke semua device.</p>
      </header>
      <div className="login grow" style={{ paddingTop: 22 }}>
        {email ? (
          <>
            <div className="sent-ok">Kamu sudah masuk sebagai <b>{email}</b>.</div>
            <button className="gbtn" onClick={async () => { await authClient.signOut(); router.refresh(); }}>Sign out</button>
          </>
        ) : state === 'sent' ? (
          <div className="sent-ok">Link sudah dikirim ke <b>{addr}</b>. Buka emailmu, tap linknya, dan kamu kembali ke arsip.{devMail && <><br /><br />Dev mode: belum ada RESEND_API_KEY, jadi link-nya dicetak di log server.</>}</div>
        ) : (
          <>
            <p>Masukkan email. Kami kirim magic link, tanpa password. Progress yang sudah ada di browser ini ikut pindah ke akunmu.</p>
            <form className="field" onSubmit={send}>
              <input type="email" required placeholder="email@kamu.com" value={addr} onChange={(e) => setAddr(e.target.value)} autoComplete="email" />
              <button className="go" disabled={state === 'sending'}>{state === 'sending' ? '…' : 'Send link'}</button>
            </form>
            {state === 'error' && <p style={{ color: '#f08a7f' }}>{err}</p>}
            {google && (
              <>
                <div className="or">or</div>
                <button className="gbtn" onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next })}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                  Continue with Google
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
