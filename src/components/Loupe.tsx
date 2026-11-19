'use client';

import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';

const SIZE = 156;  // lens diameter (px)
const ZOOM = 3.2;

/**
 * A jeweller's loupe for typed documents. Drag it over the paper: the lens shows a live, 3× clone of the page,
 * which is how you see the Olympia's raised "g" and clogged "e". Pointer-driven, works with a finger
 * (the lens floats above the fingertip so it isn't hidden by it).
 */
export function Loupe({ article }: { article: React.RefObject<HTMLElement | null> }) {
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState({ x: 140, y: 120 });
  const inner = useRef<HTMLDivElement>(null);

  // snapshot the paper into the lens when it opens (the paper doesn't change while you look)
  useEffect(() => {
    const a = article.current, box = inner.current;
    if (!on || !a || !box) return;
    const clone = a.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.loupe, .loupe-btn').forEach((n) => n.remove());
    clone.style.width = `${a.clientWidth}px`;
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    clone.removeAttribute('data-doc');
    box.replaceChildren(clone);
    // start on the first typed word so the reader sees something at once
    const first = a.querySelector('.tw .tg');
    if (first) {
      const r = first.getBoundingClientRect(), ar = a.getBoundingClientRect();
      setPos({ x: r.left - ar.left + r.width / 2, y: r.top - ar.top + r.height / 2 });
    }
  }, [on, article]);

  useEffect(() => {
    const a = article.current;
    if (!on || !a) return;
    a.classList.add('loupe-on');
    let dragging = false, offsetY = 0;
    const at = (e: PointerEvent) => {
      const r = a.getBoundingClientRect();
      setPos({ x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: Math.max(0, Math.min(r.height, e.clientY - r.top - offsetY)) });
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.loupe-btn, button, a, input')) return;
      dragging = true; offsetY = e.pointerType === 'touch' ? SIZE * 0.55 : 0;
      a.setPointerCapture(e.pointerId); at(e); haptic.tap();
    };
    const move = (e: PointerEvent) => { if (dragging) at(e); };
    const up = () => { dragging = false; };
    a.addEventListener('pointerdown', down);
    a.addEventListener('pointermove', move);
    a.addEventListener('pointerup', up);
    a.addEventListener('pointercancel', up);
    return () => {
      a.classList.remove('loupe-on');
      a.removeEventListener('pointerdown', down); a.removeEventListener('pointermove', move);
      a.removeEventListener('pointerup', up); a.removeEventListener('pointercancel', up);
    };
  }, [on, article]);

  return (
    <>
      <button type="button" className={`loupe-btn${on ? ' on' : ''}`} onClick={() => { setOn((v) => !v); haptic.tap(); }} aria-pressed={on}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" strokeLinecap="round" /></svg>
        {on ? 'Selesai' : 'Kaca pembesar'}
      </button>
      {on && (
        <div className="loupe" style={{ left: pos.x - SIZE / 2, top: pos.y - SIZE / 2, width: SIZE, height: SIZE }} aria-hidden="true">
          <div ref={inner} className="loupe-in" style={{ transform: `translate(${-pos.x * ZOOM + SIZE / 2}px, ${-pos.y * ZOOM + SIZE / 2}px) scale(${ZOOM})` }} />
        </div>
      )}
    </>
  );
}
