'use client';

import { useState } from 'react';
import { useUI } from './Shell';
import { Ic } from './ui';
import { haptic } from '@/lib/haptics';

/**
 * Shares a server-rendered story card (PNG). Native share sheet with the image where supported
 * (Instagram/WA stories on mobile), otherwise downloads the file.
 */
export function ShareButton({ src, label = 'Share', text, className = 'pillbtn' }: { src: string; label?: string; text?: string; className?: string }) {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    haptic.tap();
    setBusy(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'postmortem.png';
      const file = new File([blob], name, { type: 'image/png' });
      const data: ShareData = { files: [file], title: 'postmortem', text: text ?? 'Case files you solve by reading.' };
      if (navigator.canShare?.(data)) {
        await navigator.share(data).catch((e: Error) => { if (e.name !== 'AbortError') throw e; });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('<b>Kartu tersimpan.</b> Pasang di story kamu.');
      }
    } catch {
      toast('<b>Kartu belum bisa dibuat.</b> Coba lagi sebentar.');
    } finally { setBusy(false); }
  };
  return (
    <button type="button" className={className} onClick={go} disabled={busy} aria-busy={busy}>
      <Ic name="share" /> {busy ? 'Membuat kartu…' : label}
    </button>
  );
}
