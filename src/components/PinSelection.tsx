'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from './Shell';
import { haptic } from '@/lib/haptics';
import { pinQuote } from '@/app/actions';

/** Select text on the paper → a small "Pin" chip appears under it → the quote goes to the evidence board. */
export function PinSelection({ slug, code, article }: { slug: string; code: string; article: React.RefObject<HTMLElement | null> }) {
  const { toast } = useUI();
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onChange = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const s = document.getSelection();
        const screen = document.getElementById('screen');
        const text = s?.toString().replace(/\s+/g, ' ').trim() ?? '';
        if (!s || s.rangeCount === 0 || text.length < 8 || !screen || !article.current || !article.current.contains(s.anchorNode)) { setSel(null); return; }
        const r = s.getRangeAt(0).getBoundingClientRect(), box = screen.getBoundingClientRect();
        setSel({ text: text.slice(0, 280), x: Math.min(box.width - 150, Math.max(12, r.left - box.left + r.width / 2 - 70)), y: Math.min(box.height - 120, r.bottom - box.top + 12) });
      }, 180);
    };
    document.addEventListener('selectionchange', onChange);
    return () => { clearTimeout(t); document.removeEventListener('selectionchange', onChange); };
  }, [article]);

  if (!sel) return null;
  const screen = document.getElementById('screen');
  if (!screen) return null;
  const pin = async (e: React.PointerEvent) => {
    e.preventDefault(); // keep the selection alive on touch
    if (busy) return;
    setBusy(true); haptic.stamp();
    const r = await pinQuote(slug, code, sel.text);
    setBusy(false);
    if (r.ok) { document.getSelection()?.removeAllRanges(); setSel(null); toast(`<small>Papan bukti</small><b>Tersemat.</b> Ada di Desk ▸ Papan.`, { ms: 3000 }); }
    else toast(r.full ? '<b>Papan penuh.</b> Lepas beberapa kutipan dulu.' : '<b>Tidak bisa disematkan.</b>');
  };
  return createPortal(
    <button className="pin-chip" style={{ left: sel.x, top: sel.y }} onPointerDown={pin} aria-label="Sematkan ke papan bukti">
      <i /> {busy ? 'Menyematkan…' : 'Sematkan ke papan'}
    </button>,
    screen,
  );
}
