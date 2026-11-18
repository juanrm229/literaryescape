'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { icon } from '@/lib/svg';
import { audio } from '@/lib/audio';
import { esc } from '@/lib/esc';
import { useUI } from './Shell';
import { updateDesk } from '@/app/actions';

export const Ic = ({ name }: { name: string }) => <span className="icw" dangerouslySetInnerHTML={{ __html: icon(name) }} />;
export const Html = ({ html, className, as: Tag = 'div' }: { html: string; className?: string; as?: 'div' | 'span' }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;

export function Back({ href, label = 'Back' }: { href: string; label?: string }) {
  return <Link className="sq" href={href} aria-label={label}><Ic name="back" /></Link>;
}

export function SoundButton() {
  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(!!audio.muted); }, []);
  return (
    <button className="sq" aria-label="Sound" onClick={() => { audio.setMuted(!muted); setMuted(!muted); }}>
      <Ic name={muted ? 'mute' : 'sound'} />
    </button>
  );
}

export function ClueButton({ slug, hints, shown }: { slug: string; hints: string[]; shown: number }) {
  const { sheet } = useUI();
  const [seen, setSeen] = useState(shown);
  const open = (n: number) => {
    const k = Math.max(1, Math.min(n, hints.length));
    setSeen((s) => Math.max(s, k));
    sheet(
      <>
        <h2 className="sh-title">Clues</h2>
        <p className="sh-sub">One at a time, ya. Jangan buka semua kalau belum perlu.</p>
        <ul className="clues">{hints.slice(0, k).map((h, i) => <li key={i}><span>{i + 1}</span>{h}</li>)}</ul>
        {k < hints.length
          ? <button className="cta" onClick={() => { updateDesk(slug, { hintsShown: k + 1 }); open(k + 1); }}>Next clue · {k}/{hints.length}</button>
          : <p className="sh-sub">That’s all. Sisanya ada di arsip.</p>}
      </>,
    );
  };
  return <button className="pillbtn" onClick={() => open(seen)}>Clue <span className="q">?</span></button>;
}

export const toastHtml = (small: string, bold: string, rest = '') => `<small>${esc(small)}</small><b>${esc(bold)}</b>${rest ? ' ' + esc(rest) : ''}`;
