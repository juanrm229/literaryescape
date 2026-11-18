'use client';

import { useCallback, useEffect, useRef } from 'react';
import { audio } from '@/lib/audio';
import { icon } from '@/lib/svg';

type TapeState = { root: HTMLElement; cues: HTMLElement[]; i: number; timer: ReturnType<typeof setTimeout> | null };

/**
 * Drives every `.tape` + `.transcript` pair inside `container`.
 * The transcript is the clock: each cue lasts as long as it takes to read, oars start/stop on cue text.
 */
export function useTape(container: React.RefObject<HTMLElement | null>, scroller: React.RefObject<HTMLElement | null>, onEnd?: (code: string) => void) {
  const st = useRef<TapeState | null>(null);

  const stop = useCallback(() => {
    const t = st.current; if (!t) return;
    if (t.timer) clearTimeout(t.timer);
    audio.stopHiss(); audio.stopOars();
    t.root.classList.remove('playing');
    const b = t.root.querySelector('[data-act="tape-play"]'); if (b) b.innerHTML = icon('play');
    st.current = null;
  }, []);

  const step = useCallback(() => {
    const t = st.current; if (!t) return;
    if (t.i >= t.cues.length) { const code = t.root.dataset.tape || ''; stop(); onEnd?.(code); return; }
    t.cues.forEach((c, j) => { c.classList.toggle('on', j === t.i); c.classList.toggle('done', j < t.i); });
    const c = t.cues[t.i];
    const r = c.getBoundingClientRect(), sr = (scroller.current ?? document.body).getBoundingClientRect();
    if (r.top < sr.top + 230 || r.bottom > sr.bottom - 110) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const text = (c.dataset.text || '').toLowerCase();
    let dur = Math.min(7200, Math.max(1700, (Number(c.dataset.len) || 40) * 42));
    if (c.classList.contains('sfx')) dur = Math.max(dur, 2400);
    if (/sembilan detik/.test(text)) { audio.burstStatic(9); dur = 9000; }
    if (/dayung berhenti|menjauh|statis normal|rekaman berakhir|mesin menyala|tidak ada bunyi dayung|\[hening/.test(text)) audio.stopOars();
    else if (/dayung/.test(text) && /\[/.test(text)) audio.startOars(0.28);
    const tc = c.querySelector('.cue-t')?.textContent?.trim();
    const counter = t.root.querySelector('.counter'); if (tc && counter) counter.textContent = tc;
    const prog = t.root.querySelector<HTMLElement>('.prog i'); if (prog) prog.style.width = ((t.i + 1) / t.cues.length) * 100 + '%';
    t.timer = setTimeout(() => { if (st.current) { st.current.i++; step(); } }, dur);
  }, [scroller, stop, onEnd]);

  const play = useCallback((root: HTMLElement, from?: number) => {
    stop();
    const tr = container.current?.querySelector(`.transcript[data-for="${root.dataset.tape}"]`);
    const cues = Array.from(tr?.querySelectorAll<HTMLElement>('.cue') ?? []);
    if (!cues.length) return;
    st.current = { root, cues, i: from ?? Math.max(0, cues.findIndex((c) => !c.classList.contains('done'))), timer: null };
    root.classList.add('playing');
    const b = root.querySelector('[data-act="tape-play"]'); if (b) b.innerHTML = icon('pause');
    audio.boot();
    audio.startHiss(root.classList.contains('tape-cassette') ? 0.04 : 0.015);
    step();
  }, [container, step, stop]);

  const toggle = useCallback((root: HTMLElement) => { if (st.current?.root === root) stop(); else play(root); }, [play, stop]);
  const jump = useCallback((cue: HTMLElement) => {
    const tr = cue.closest<HTMLElement>('.transcript');
    const root = container.current?.querySelector<HTMLElement>(`.tape[data-tape="${tr?.dataset.for}"]`);
    if (!tr || !root) return;
    play(root, Array.from(tr.querySelectorAll('.cue')).indexOf(cue));
  }, [container, play]);

  useEffect(() => stop, [stop]);
  return { toggle, jump, stop };
}
