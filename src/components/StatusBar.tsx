'use client';
import { useEffect, useState } from 'react';

export function StatusBar() {
  const [t, setT] = useState('9:41');
  useEffect(() => {
    const tick = () => { const d = new Date(); setT(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`); };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="statusbar" aria-hidden="true">
      <span>{t}</span>
      <span className="sb-icons">
        <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" /><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
        <svg viewBox="0 0 16 12"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4C5.2.4 2.7 1.5.8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4zm0 3.6c1.4 0 2.6.5 3.5 1.4l1.3-1.3A6.7 6.7 0 0 0 8 4c-1.9 0-3.6.7-4.8 1.9l1.3 1.3A5 5 0 0 1 8 5.8zM8 9.4c-.6 0-1.1.2-1.5.6L8 11.6 9.5 10c-.4-.4-.9-.6-1.5-.6z" fill="currentColor" /></svg>
        <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="20" height="8" rx="2" fill="currentColor" /><path d="M25 4v4a2 2 0 0 0 0-4z" fill="currentColor" opacity=".45" /></svg>
      </span>
    </div>
  );
}
