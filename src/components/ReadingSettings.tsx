'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_PREFS, readPrefs, writePrefs, type Prefs } from '@/lib/prefs';
import { haptic } from '@/lib/haptics';

const SIZES: [Prefs['size'], string][] = [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']];

/** Text size, dyslexia-friendly typeface, motion and haptics. Device-local, applied instantly. */
export function ReadingSettings() {
  const [p, setP] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [canBuzz, setCanBuzz] = useState(false);
  useEffect(() => { setP(readPrefs()); setReady(true); setCanBuzz('vibrate' in navigator); }, []);
  const set = (patch: Partial<Prefs>) => { const n = { ...p, ...patch }; setP(n); writePrefs(n); if (n.haptics) haptic.tap(); };

  return (
    <div className={`rs${ready ? '' : ' rs-wait'}`}>
      <div className="toggle rs-size">
        <span>Text size<small>Untuk semua dokumen.</small></span>
        <div className="seg4" role="radiogroup" aria-label="Text size">
          {SIZES.map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={p.size === k} className={p.size === k ? 'on' : ''} onClick={() => set({ size: k })} style={{ fontSize: { s: 12, m: 14, l: 16, xl: 18 }[k] }}>{l}</button>
          ))}
        </div>
      </div>
      <p className="rs-preview doc-sample">“Kalau ada yang belum pulang, tulis namanya. Laut tahu alamatnya.”</p>
      <label className="toggle"><span>Huruf mudah dibaca<small>Atkinson Hyperlegible, spasi lebih lega. Ramah disleksia.</small></span>
        <input type="checkbox" checked={p.font === 'legible'} onChange={(e) => set({ font: e.target.checked ? 'legible' : 'default' })} /><span className="sw" /></label>
      <label className="toggle"><span>Kurangi gerakan<small>Matikan animasi, guncangan, dan jejak kaki.</small></span>
        <input type="checkbox" checked={p.motion === 'reduce'} onChange={(e) => set({ motion: e.target.checked ? 'reduce' : 'system' })} /><span className="sw" /></label>
      <label className="toggle"><span>Getar<small>{canBuzz ? 'Cap stamp, gembok, dan dayung terasa di tangan.' : 'Perangkat ini tidak mendukung getar.'}</small></span>
        <input type="checkbox" checked={p.haptics} disabled={!canBuzz} onChange={(e) => set({ haptics: e.target.checked })} /><span className="sw" /></label>
    </div>
  );
}
