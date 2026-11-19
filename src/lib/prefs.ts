/** Per-device reading preferences. Stored locally, applied as data-attributes on <html> before first paint. */
export type Prefs = { size: 's' | 'm' | 'l' | 'xl'; font: 'default' | 'legible'; motion: 'system' | 'reduce'; haptics: boolean };
export const DEFAULT_PREFS: Prefs = { size: 'm', font: 'default', motion: 'system', haptics: true };
const KEY = 'pm.prefs';

export function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_PREFS, ...raw, haptics: localStorage.getItem('pm.haptics') !== 'off' };
  } catch { return DEFAULT_PREFS; }
}

export function applyPrefs(p: Prefs) {
  const h = document.documentElement;
  h.dataset.ts = p.size;
  h.dataset.font = p.font;
  h.dataset.motion = p.motion;
}

export function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ size: p.size, font: p.font, motion: p.motion }));
    localStorage.setItem('pm.haptics', p.haptics ? 'on' : 'off');
  } catch { /* private mode */ }
  applyPrefs(p);
}

/** Inlined in <head> so text size / font never flash. Keep in sync with applyPrefs. */
export const PREFS_BOOT = `try{var p=JSON.parse(localStorage.getItem('${KEY}')||'{}'),h=document.documentElement;h.dataset.ts=p.size||'m';h.dataset.font=p.font||'default';h.dataset.motion=p.motion||'system'}catch(e){}`;
