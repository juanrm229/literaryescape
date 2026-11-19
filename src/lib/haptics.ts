/** Tiny haptics vocabulary. Silently does nothing where vibration isn't supported (iOS Safari). */
const can = () => typeof navigator !== 'undefined' && 'vibrate' in navigator && (() => { try { return localStorage.getItem('pm.haptics') !== 'off'; } catch { return true; } })();
const buzz = (p: number | number[]) => { if (can()) try { navigator.vibrate(p); } catch { /* */ } };

export const haptic = {
  tap: () => buzz(8),
  stamp: () => buzz([0, 28, 40, 18]),
  wrong: () => buzz([0, 40, 60, 40]),
  unlock: () => buzz([0, 20, 50, 20, 50, 60]),
  oar: () => buzz(22),
  enabled: () => { try { return localStorage.getItem('pm.haptics') !== 'off'; } catch { return true; } },
  set: (on: boolean) => { try { localStorage.setItem('pm.haptics', on ? 'on' : 'off'); } catch { /* */ } },
};
