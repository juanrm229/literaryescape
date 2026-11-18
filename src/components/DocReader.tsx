'use client';

import { useEffect, useRef } from 'react';
import { useUI } from './Shell';
import { useTape } from './useTape';
import { audio } from '@/lib/audio';
import { esc } from '@/lib/esc';
import { markRead, setOpened } from '@/app/actions';

/** The paper itself: server-rendered HTML + the bits you can touch (envelope, photo, map, tapes). */
export function DocReader({ slug, code, skin, html, fresh, onTapeEnd }: { slug: string; code: string; skin: string; html: string; fresh?: boolean; onTapeEnd?: (code: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scroller, toast } = useUI();
  const tape = useTape(ref, scroller, onTapeEnd);

  // reading counts when the page is actually shown (never on link prefetch)
  useEffect(() => {
    if (!fresh) return;
    let alive = true;
    setTimeout(() => audio.thud(), 380);
    markRead(slug, code).then(({ awards }) => {
      if (!alive) return;
      awards.forEach((a, i) => setTimeout(() => {
        if (a.kind === 'berkas') audio.thud();
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
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('[data-act="flip"], .map-pin')) { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  };

  return <article ref={ref} className={`doc skin-${skin}`} data-doc={code} onClick={onClick} onKeyDown={onKey} dangerouslySetInnerHTML={{ __html: html }} />;
}
