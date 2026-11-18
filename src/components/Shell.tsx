'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isMalamJumatKliwon } from '@/lib/jw';
import { audio } from '@/lib/audio';

type Toast = { id: number; html: string; stamp?: string; leaving?: boolean };
type SheetState = { node: React.ReactNode; cls?: string; open: boolean } | null;
type UI = {
  toast: (html: string, opts?: { stamp?: string; ms?: number }) => void;
  sheet: (node: React.ReactNode, cls?: string) => void;
  closeSheet: () => void;
  setBelieve: (on: boolean) => void;
  setLocked: (on: boolean) => void;
  scroller: React.RefObject<HTMLDivElement | null>;
};
const Ctx = createContext<UI | null>(null);
export const useUI = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI outside Shell');
  return v;
};

let tid = 0;

export function Shell({ children }: { children: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sheetState, setSheet] = useState<SheetState>(null);
  const [believe, setBelieveState] = useState(false);
  const [locked, setLocked] = useState(false);
  const pathname = usePathname();

  const toast = useCallback((html: string, opts: { stamp?: string; ms?: number } = {}) => {
    const id = ++tid;
    setToasts((t) => [...t, { id, html, stamp: opts.stamp }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), opts.ms ?? 3400);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), (opts.ms ?? 3400) + 450);
  }, []);
  const sheet = useCallback((node: React.ReactNode, cls?: string) => {
    setSheet({ node, cls, open: false });
    requestAnimationFrame(() => requestAnimationFrame(() => setSheet((s) => (s ? { ...s, open: true } : s))));
  }, []);
  const closeSheet = useCallback(() => {
    setSheet((s) => (s ? { ...s, open: false } : s));
    setTimeout(() => setSheet((s) => (s && !s.open ? null : s)), 330);
  }, []);
  const setBelieve = useCallback((on: boolean) => setBelieveState(on), []);

  // new page → top of the scroller (unless a page asks to land on a row)
  useEffect(() => {
    setSheet(null);
    if (!new URLSearchParams(location.search).get('from') && scroller.current) scroller.current.scrollTop = 0;
  }, [pathname]);

  useEffect(() => { document.body.classList.toggle('believe', believe); }, [believe]);

  useEffect(() => {
    const forced = new URLSearchParams(location.search).get('kliwon') === '1';
    const on = forced || isMalamJumatKliwon(new Date());
    document.body.classList.toggle('kliwon', on);
    if (!on) return;
    const once = () => { if (!audio.muted) { audio.startSea(0.04); audio.startOars(0.06); } document.removeEventListener('pointerdown', once); };
    document.addEventListener('pointerdown', once);
    return () => document.removeEventListener('pointerdown', once);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeSheet]);

  return (
    <Ctx.Provider value={{ toast, sheet, closeSheet, setBelieve, setLocked, scroller }}>
      <div className={`scroller${locked ? ' locked' : ''}`} ref={scroller}>{children}</div>
      <div id="footprints" aria-hidden="true">
        {believe && Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="fp" style={{ left: `${50 + (i % 2 ? 4 : -4) + Math.sin(i / 2) * 6}%`, top: `${98 - i * 7.2}%`, animationDelay: `${i * 0.35}s`, transform: `rotate(${i % 2 ? 6 : -6}deg)` }} />
        ))}
      </div>
      <div id="toasts" aria-live="polite">
        {toasts.map((t) => (
          <ToastView key={t.id} t={t} />
        ))}
      </div>
      {sheetState && (
        <div className={`sheet-wrap${sheetState.open ? ' in' : ''}`}>
          <div className="sheet-bg" onClick={closeSheet} />
          <div className={`sheet ${sheetState.cls ?? ''}`} role="dialog" aria-modal="true"><div className="sheet-grip" />{sheetState.node}</div>
        </div>
      )}
    </Ctx.Provider>
  );
}

function ToastView({ t }: { t: Toast }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(r); }, []);
  return (
    <div className={`toast${shown && !t.leaving ? ' in' : ''}`}>
      {t.stamp ? <div className="toast-stamp" dangerouslySetInnerHTML={{ __html: t.stamp }} /> : <div className="toast-ic">p</div>}
      <div dangerouslySetInnerHTML={{ __html: t.html }} />
    </div>
  );
}

/** Pages render this to sync per-reader UI state into the shell. */
export function ShellSync({ believe = false, locked = false }: { believe?: boolean; locked?: boolean }) {
  const { setBelieve, setLocked } = useUI();
  useEffect(() => { setBelieve(believe); }, [believe, setBelieve]);
  useEffect(() => { setLocked(locked); return () => setLocked(false); }, [locked, setLocked]);
  return null;
}
