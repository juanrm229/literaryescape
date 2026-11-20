'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from './Shell';
import { haptic } from '@/lib/haptics';
import { audio } from '@/lib/audio';
import { esc } from '@/lib/esc';
import { loupeFind } from '@/app/actions';
import type { LoupeData } from './DocReader';

const SIZE = 156;  // lens diameter (px)
const ZOOM = 3.4;

/**
 * A jeweller's loupe — an investigation tool, not decoration. Only documents that hide something get it.
 * Rest the lens on a marked spot (a lifted "g", micro-writing in pencil…) and it registers: a forensic caption,
 * a red ring on the paper, a count, and a note pinned to the evidence board. Finds are saved on the server.
 */
export function Loupe({ article, slug, code, data }: { article: React.RefObject<HTMLElement | null>; slug: string; code: string; data: LoupeData }) {
  const router = useRouter();
  const { toast } = useUI();
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState({ x: 140, y: 120 });
  const [found, setFound] = useState<string[]>(data.found);
  const [cap, setCap] = useState<{ id: string; text: string; fresh: boolean } | null>(null);
  const inner = useRef<HTMLDivElement>(null);
  const rects = useRef<{ id: string; x0: number; y0: number; x1: number; y1: number }[]>([]);
  const pending = useRef(new Set<string>());
  const total = data.marks.length;

  // paint what this reader already found
  useEffect(() => {
    article.current?.querySelectorAll<HTMLElement>('.lm').forEach((el) => el.classList.toggle('found', found.includes(el.dataset.lm || '')));
  }, [found, article]);

  const measure = useCallback(() => {
    const a = article.current; if (!a) return;
    const ar = a.getBoundingClientRect();
    rects.current = Array.from(a.querySelectorAll<HTMLElement>('.lm')).map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.lm || '', x0: r.left - ar.left - 6, y0: r.top - ar.top - 6, x1: r.right - ar.left + 6, y1: r.bottom - ar.top + 6 };
    });
  }, [article]);

  // snapshot the paper into the lens when it opens
  useEffect(() => {
    const a = article.current, box = inner.current;
    if (!on || !a || !box) return;
    const clone = a.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.loupe, .loupe-btn, .pz, .pin-chip').forEach((n) => n.remove());
    clone.style.width = `${a.clientWidth}px`;
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    clone.removeAttribute('data-doc');
    box.replaceChildren(clone);
    measure();
    // start near the first thing worth seeing that hasn't been found yet
    const target = rects.current.find((r) => !found.includes(r.id)) ?? rects.current[0];
    if (target) {
      const w = a.clientWidth;
      const cx = (target.x0 + target.x1) / 2, cy = (target.y0 + target.y1) / 2;
      setPos({ x: Math.min(w - SIZE / 2 - 4, Math.max(SIZE / 2 + 4, cx + (cx < w / 2 ? 90 : -90))), y: Math.max(SIZE / 2, cy - 70) });
    }
    // photos load late and fonts settle: keep the targets in step with the paper
    const ro = new ResizeObserver(() => measure());
    ro.observe(a);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, article, measure]);

  // discovery: the lens centre rests on a mark
  useEffect(() => {
    if (!on) return;
    const hit = rects.current.find((r) => pos.x >= r.x0 && pos.x <= r.x1 && pos.y >= r.y0 && pos.y <= r.y1);
    if (!hit) { setCap((c) => (c ? null : c)); return; }
    const mark = data.marks.find((m) => m.id === hit.id);
    if (!mark) return;
    const already = found.includes(hit.id);
    setCap({ id: hit.id, text: mark.note, fresh: !already });
    if (already || pending.current.has(hit.id)) return;
    pending.current.add(hit.id);
    haptic.unlock(); audio.tone(1320, 0.05, 0.05);
    setFound((f) => [...f, hit.id]);
    loupeFind(slug, code, hit.id).then((r) => {
      if (r.ok && r.first) {
        toast(`<small>Temuan ${r.found}/${r.total}</small><b>${esc(mark.note)}</b> Tersemat di papan bukti.`, { ms: 3600 });
        if (r.found === r.total) setTimeout(() => toast('<small>Kaca pembesar</small><b>Semua temuan di dokumen ini sudah tercatat.</b>', { ms: 3000 }), 3800);
        router.refresh();
      }
    });
  }, [pos, on, data.marks, found, slug, code, toast, router]);

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
      dragging = true; offsetY = e.pointerType === 'touch' ? SIZE * 0.6 : 0;
      measure();
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
  }, [on, article, measure]);

  const done = found.length >= total;
  return (
    <>
      <button type="button" className={`loupe-btn${on ? ' on' : ''}${done ? ' done' : ''}`} onClick={() => { setOn((v) => !v); setCap(null); haptic.tap(); }} aria-pressed={on}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" strokeLinecap="round" /></svg>
        {on ? 'Selesai' : 'Kaca pembesar'}<b className="loupe-count">{found.length}/{total}</b>
      </button>
      {on && !found.length && <p className="loupe-hint">Geser lensa pelan-pelan di atas kertas. Ada {total} hal yang tidak terlihat dengan mata biasa.</p>}
      {on && (
        <>
          <div className="loupe" style={{ left: pos.x - SIZE / 2, top: pos.y - SIZE / 2, width: SIZE, height: SIZE }} aria-hidden="true">
            <div ref={inner} className="loupe-in" style={{ transform: `translate(${-pos.x * ZOOM + SIZE / 2}px, ${-pos.y * ZOOM + SIZE / 2}px) scale(${ZOOM})` }} />
            <span className={`loupe-ring${cap ? ' hit' : ''}`} />
          </div>
          {cap && <div className={`loupe-cap${cap.fresh ? ' fresh' : ''}`} style={{ left: Math.max(8, pos.x - 120), top: pos.y + SIZE / 2 + 10 }} role="status">{cap.text}</div>}
        </>
      )}
    </>
  );
}
