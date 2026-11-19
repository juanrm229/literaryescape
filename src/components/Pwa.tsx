'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useUI } from './Shell';
import { Ic } from './ui';
import { haptic } from '@/lib/haptics';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

// the browser's install event arrives once, early — keep it outside React
let deferred: BIP | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

/** Mounted once in the Shell: registers the service worker and catches the install prompt. */
export function PwaBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
    const onBip = (e: Event) => { e.preventDefault(); deferred = e as BIP; emit(); };
    const onInstalled = () => { deferred = null; emit(); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  return null;
}

const standalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** A settings row: one-tap install where the browser allows it, instructions where it doesn't (iOS). */
export function InstallRow() {
  const { sheet, closeSheet, toast } = useUI();
  const ev = useSyncExternalStore(subscribe, () => deferred, () => null);
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios' | 'hint'>('hidden');
  useEffect(() => {
    if (standalone()) setMode('hidden');
    else if (ev) setMode('prompt');
    else if (isIOS()) setMode('ios');
    else setMode('hint');
  }, [ev]);
  if (mode === 'hidden') return null;

  const go = async () => {
    haptic.tap();
    if (mode === 'prompt' && deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') toast('<b>Terpasang.</b> Buka postmortem dari home screen.');
      deferred = null; emit();
      return;
    }
    sheet(
      <>
        <h2 className="sh-title">Pasang di home screen</h2>
        <p className="sh-sub">Layar penuh, tanpa address bar, dan arsip yang sudah dibuka tetap bisa dibaca saat offline.</p>
        <ol className="inst">
          {mode === 'ios'
            ? <><li>Tap <b>Share</b> <span className="inst-ic">⬆︎</span> di bar Safari.</li><li>Pilih <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></>
            : <><li>Buka menu browser <span className="inst-ic">⋮</span>.</li><li>Pilih <b>Install app</b> / <b>Add to Home screen</b>.</li></>}
        </ol>
        <button className="cta" onClick={closeSheet}>Oke</button>
      </>,
    );
  };
  return (
    <button className="toggle" style={{ width: '100%', textAlign: 'left' }} onClick={go}>
      <span>Install app<small>{mode === 'prompt' ? 'Satu tap. Bisa dibaca offline.' : 'Tambahkan ke home screen.'}</small></span><Ic name="install" />
    </button>
  );
}
