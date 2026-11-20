'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PuzzleCard } from './Puzzle';
import { PinSelection } from './PinSelection';
import { Loupe } from './Loupe';
import type { PuzzleView } from '@/lib/puzzles';
import { useUI } from './Shell';
import { useTape } from './useTape';
import { audio } from '@/lib/audio';
import { haptic } from '@/lib/haptics';
import { esc } from '@/lib/esc';
import { markRead, setOpened } from '@/app/actions';

/** The paper itself: server-rendered HTML + the bits you can touch (envelope, photo, map, tapes). */
const NO_PUZZLES: PuzzleView[] = [];

export type LoupeData = { marks: { id: string; note: string }[]; found: string[] };

export function DocReader({ slug, code, skin, html, fresh, onTapeEnd, puzzles = NO_PUZZLES, loupe }: { slug: string; code: string; skin: string; html: string; fresh?: boolean; onTapeEnd?: (code: string) => void; puzzles?: PuzzleView[]; loupe?: LoupeData }) {
  const ref = useRef<HTMLElement>(null);
  const { scroller, toast, sheet } = useUI();
  // tapes that end on the station jingle play it when the transcript runs out
  const onEnd = useCallback((c: string) => {
    if (ref.current?.querySelector<HTMLElement>(`.tape[data-tape="${CSS.escape(c)}"]`)?.dataset.jingle) setTimeout(() => audio.jingle(), 600);
    onTapeEnd?.(c);
  }, [onTapeEnd]);
  const tape = useTape(ref, scroller, onEnd);
  const [fin, setFin] = useState<'off' | 'on' | 'done'>('off');
  // ::fin — when the final line scrolls into view: five piano notes, then black
  useEffect(() => {
    const el = ref.current?.querySelector('[data-fin]');
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      audio.jingle(); haptic.unlock();
      setTimeout(() => setFin('on'), 1900);
    }, { threshold: 1 });
    io.observe(el);
    return () => io.disconnect();
  }, [html]);
  // locks embedded in the paper with ::puzzle[key] — mounted into their slots after render
  const [slots, setSlots] = useState<{ el: Element; view: PuzzleView }[]>([]);
  useEffect(() => {
    if (!ref.current || !puzzles.length) { setSlots((s) => (s.length ? [] : s)); return; }
    setSlots(Array.from(ref.current.querySelectorAll('.pz-slot')).map((el) => ({ el, view: puzzles.find((p) => p.key === (el as HTMLElement).dataset.pz)! })).filter((x) => x.view));
  }, [html, puzzles]);

  // reading counts when the page is actually shown (never on link prefetch)
  useEffect(() => {
    if (!fresh) return;
    let alive = true;
    setTimeout(() => audio.thud(), 380);
    markRead(slug, code).then(({ awards }) => {
      if (!alive) return;
      awards.forEach((a, i) => setTimeout(() => {
        if (a.kind === 'berkas') audio.thud();
        haptic.stamp();
        toast(a.kind === 'berkas' ? `<small>New stamp</small><b>${esc(a.title)}</b>` : `<small>Kartu kenal</small><b>${esc(a.title)}</b> masuk ke Stamps.`, { stamp: a.svg, ms: a.kind === 'berkas' ? 4400 : 2800 });
      }, 800 + i * 900));
    });
    return () => { alive = false; };
  }, [slug, code, fresh, toast]);

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'open-env') { act.closest('.envelope')?.classList.add('open'); audio.thud(); setOpened(slug, code); }
      if (a === 'flip') act.classList.toggle('flipped');
      if (a === 'tape-play') { const root = act.closest<HTMLElement>('.tape'); if (root) tape.toggle(root); }
      if (a === 'vm-play') {
        // voicemail: read the transcript aloud with the device voice
        const synth = window.speechSynthesis; if (!synth) return;
        if (synth.speaking) { synth.cancel(); act.classList.remove('on'); return; }
        const u = new SpeechSynthesisUtterance(act.dataset.text || '');
        u.lang = 'id-ID'; u.rate = 0.92; u.pitch = 0.9;
        u.onend = () => act.classList.remove('on');
        act.classList.add('on'); synth.speak(u);
      }
      if (a === 'gal-open') act.classList.toggle('zoom');
      if (a === 'photo-open') {
        haptic.tap();
        sheet(<figure className="photo-full"><img src={act.dataset.src} alt={act.dataset.cap} /><figcaption>{act.dataset.cap}</figcaption></figure>, 'photo-sheet');
      }
      if (a === 'app-open' || a === 'app-back') {
        const ph = act.closest<HTMLElement>('[data-phone]'); if (!ph) return;
        const home = ph.querySelector<HTMLElement>('[data-app-home]');
        ph.querySelectorAll<HTMLElement>('.fp-panel').forEach((x) => { x.hidden = a === 'app-back' || x.dataset.panel !== act.dataset.app; });
        if (home) home.hidden = a === 'app-open';
        audio.tone(a === 'app-open' ? 880 : 660, 0.03, 0.04);
      }
      return;
    }
    const cue = t.closest<HTMLElement>('.cue');
    if (cue) { tape.jump(cue); return; }
    const pin = t.closest<HTMLElement>('.map-pin, .map-list li');
    if (pin && ref.current) {
      ref.current.querySelectorAll<HTMLElement>('.map-pin, .map-list li').forEach((x) => x.classList.toggle('on', x.dataset.pin === pin.dataset.pin));
      ref.current.querySelector(`.map-list li[data-pin="${pin.dataset.pin}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('[data-act="flip"], [data-act="photo-open"], .map-pin')) { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  };

  return (
    <>
      <div className="doc-wrap">
      <article ref={ref} className={`doc skin-${skin}`} data-doc={code} onClick={onClick} onKeyDown={onKey} dangerouslySetInnerHTML={{ __html: html }} />
      {slots.map((s) => createPortal(<PuzzleCard slug={slug} view={s.view} />, s.el, s.view.key))}
      <PinSelection slug={slug} code={code} article={ref} />
      {loupe && <Loupe article={ref} slug={slug} code={code} data={loupe} />}
      </div>
      {fin === 'on' && typeof document !== 'undefined' && document.getElementById('screen') && createPortal(
        <button className="blackout" onClick={() => setFin('done')} aria-label="Tutup"><span>Sampun, sampun, cekap.</span></button>, document.getElementById('screen')!)}
    </>
  );
}
