'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { useUI } from './Shell';
import { movePin, toggleString, unpin } from '@/app/actions';
import type { Pin } from '@/db/schema';

const H = 1400; // board height in px; x/y are stored as percentages so the board scales with the phone
const PIN_COLORS = ['#c4392f', '#2c4b55', '#b58a1b', '#4a6b3a', '#6b3a5a'];
const tilt = (id: string) => ((id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % 7) - 3;

/**
 * The cork board. Drag notes around, tap one then another to tie a red string, tap a string's knot to cut it.
 * Everything is optimistic and saved in the background.
 */
export function EvidenceBoard({ slug, pins: initialPins, strings: initialStrings, glow: initialGlow = [], titles }: { slug: string; pins: Pin[]; strings: string[]; glow?: string[]; titles: Record<string, string> }) {
  const { toast } = useUI();
  const [glow, setGlow] = useState<string[]>(initialGlow);
  useEffect(() => { setGlow(initialGlow); }, [initialGlow]);
  const [pins, setPins] = useState(initialPins);
  const [strings, setStrings] = useState(initialStrings);
  const [sel, setSel] = useState<string | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean; sx: number; sy: number } | null>(null);
  // a co-op partner may change the board: take server truth whenever it changes
  useEffect(() => { setPins(initialPins); }, [initialPins]);
  useEffect(() => { setStrings(initialStrings); }, [initialStrings]);

  const W = () => board.current?.clientWidth ?? 360;
  const at = (p: Pin) => ({ left: (p.x / 100) * W(), top: (p.y / 100) * H });

  const down = (e: React.PointerEvent, p: Pin) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    drag.current = { id: p.id, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, sx: e.clientX, sy: e.clientY };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !board.current) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    const b = board.current.getBoundingClientRect();
    const x = ((e.clientX - b.left - d.dx) / b.width) * 100, y = ((e.clientY - b.top - d.dy) / H) * 100;
    setPins((ps) => ps.map((q) => (q.id === d.id ? { ...q, x: Math.max(0, Math.min(62, x)), y: Math.max(0, Math.min(94, y)) } : q)));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      const p = pins.find((q) => q.id === d.id);
      if (p) movePin(slug, p.id, p.x, p.y);
      return;
    }
    // a tap: select, or tie to the selected note
    if (!sel) { setSel(d.id); haptic.tap(); return; }
    if (sel === d.id) { setSel(null); return; }
    const key = [sel, d.id].sort().join('|');
    const on = !strings.includes(key);
    setStrings((s) => (on ? [...s, key] : s.filter((x) => x !== key)));
    setSel(null);
    haptic.stamp();
    toggleString(slug, sel, d.id).then((r) => {
      if (r.glow) { setGlow((g) => [...g, key]); haptic.unlock(); toast('<small>Papan bukti</small><b>Benang ini menyala.</b> Dua dokumen ini saling menjawab.', { ms: 3600 }); }
    });
  };
  const remove = (id: string) => {
    setPins((ps) => ps.filter((q) => q.id !== id));
    setStrings((s) => s.filter((x) => !x.split('|').includes(id)));
    haptic.wrong();
    unpin(slug, id);
  };
  const cut = (key: string) => { setStrings((s) => s.filter((x) => x !== key)); const [a, b] = key.split('|'); haptic.tap(); toggleString(slug, a, b); };

  // rendered positions need the measured width
  const [, force] = useState(0);
  useEffect(() => { const ro = new ResizeObserver(() => force((n) => n + 1)); if (board.current) ro.observe(board.current); return () => ro.disconnect(); }, []);

  if (!pins.length) {
    return (
      <div className="cork empty">
        <div className="cork-hint"><b>Papan masih kosong.</b><p>Di dokumen mana pun, sorot satu kalimat yang mengganjal, lalu tekan <i>Sematkan ke papan</i>. Hubungkan kutipan yang saling menjawab dengan benang merah.</p></div>
      </div>
    );
  }
  const byId = Object.fromEntries(pins.map((p) => [p.id, p]));
  const CARD = 150;
  return (
    <>
      <p className="desk-note">{sel ? 'Pilih kutipan kedua untuk menarik benang. Tap lagi untuk batal.' : 'Seret untuk memindah. Tap dua kutipan untuk menghubungkan. Tap simpul untuk memotong benang.'} <b>{pins.length}</b> kutipan · <b>{strings.length}</b> benang.</p>
      <div className="cork" ref={board} style={{ height: H }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <svg className="cork-strings" width="100%" height={H} aria-hidden="true">
          {strings.map((k) => {
            const [a, b] = k.split('|').map((id) => byId[id]);
            if (!a || !b) return null;
            const A = at(a), B = at(b);
            const x1 = A.left + CARD / 2, y1 = A.top + 10, x2 = B.left + CARD / 2, y2 = B.top + 10;
            const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + 28 + Math.abs(x1 - x2) * 0.08; // a little sag
            return (
              <g key={k}>
                <path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} className={`string${glow.includes(k) ? ' glow' : ''}`} />
                <circle cx={(x1 + 2 * mx + x2) / 4} cy={(y1 + 2 * my + y2) / 4} r="9" className="knot" onClick={() => cut(k)} />
              </g>
            );
          })}
        </svg>
        {pins.map((p, i) => {
          const pos = at(p);
          return (
            <div key={p.id} className={`bnote${sel === p.id ? ' sel' : ''}`} style={{ left: pos.left, top: pos.top, width: CARD, transform: `rotate(${tilt(p.id)}deg)` }}
              onPointerDown={(e) => down(e, p)}>
              <span className="tack" style={{ background: PIN_COLORS[i % PIN_COLORS.length] }} />
              <q>{p.text}</q>
              <div className="note-foot"><Link href={`/c/${slug}/d/${p.code}`} onPointerDown={(e) => e.stopPropagation()}>{p.code}</Link><button aria-label="Lepas" onClick={() => remove(p.id)}>×</button></div>
              <span className="sr-only">{titles[p.code]}</span>
            </div>
          );
        })}
      </div>
      {pins.length >= 50 && <p className="desk-note">Hampir penuh: {pins.length}/60.</p>}
    </>
  );
}
