'use client';

import { useState, useTransition } from 'react';
import { useUI } from './Shell';
import { haptic } from '@/lib/haptics';
import { setSerial } from '@/app/extra-actions';

/** Serial mode: the archive comes to you, one document every morning at 06.00 WIB. */
export function SerialRow({ slug, active, email }: { slug: string; active: boolean; email: string | null }) {
  const { sheet, closeSheet, toast } = useUI();
  const [on, setOn] = useState(active);
  const [, start] = useTransition();
  const enable = (addr?: string) => start(async () => {
    const r = await setSerial(slug, true, addr);
    if (!r.ok) { closeSheet(); toast(r.reason === 'email' ? '<b>Email-nya belum benar.</b>' : r.reason === 'done' ? '<b>Arsip ini sudah selesai kamu baca.</b> Tidak ada surat yang tersisa.' : '<b>Belum bisa diaktifkan.</b>'); return; }
    setOn(true); closeSheet(); haptic.stamp();
    toast(r.sent === 'sent' ? '<small>Surat pagi</small><b>Surat pertama sudah dikirim.</b> Berikutnya besok 06.00 WIB.' : '<small>Surat pagi</small><b>Aktif.</b> Mulai besok 06.00 WIB.', { ms: 4200 });
  });
  const toggle = (want: boolean) => {
    if (!want) { setOn(false); start(async () => { await setSerial(slug, false); }); return; }
    if (email) { enable(); return; }
    sheet(<EmailAsk onSubmit={enable} />);
  };
  return (
    <label className="toggle"><span>Surat pagi<small>{on ? `Satu dokumen tiap pagi ke ${email ?? 'email-mu'}.` : 'Arsip datang sendiri: satu dokumen tiap pagi, 06.00 WIB.'}</small></span>
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} /><span className="sw" /></label>
  );
}

function EmailAsk({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <h2 className="sh-title">Surat pagi</h2>
      <p className="sh-sub">Setiap pagi, kutipan pembuka dokumen berikutnya + tautan untuk membacanya. Berhenti kapan saja dari tautan di bawah surat.</p>
      <input className="wl-input" type="email" inputMode="email" autoComplete="email" value={v} onChange={(e) => setV(e.target.value)} placeholder="nama@email.com" required aria-label="Email" />
      <button className="cta yellow">Kirim tiap pagi</button>
    </form>
  );
}
