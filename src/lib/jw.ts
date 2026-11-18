/** Javanese weekday + pasaran (five-day market week). Anchor: Jumat Kliwon, 9 Feb 1979. */
export const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'] as const;
export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const HARI_JW = ['Ahad', 'Senen', 'Slasa', 'Rebo', 'Kemis', 'Jemuah', 'Setu'];
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const REF = Date.UTC(1979, 1, 9);

const dayNum = (d: Date) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - REF) / 864e5);
export const pasaran = (d: Date) => PASARAN[(((dayNum(d) % 5) + 5) % 5 + 4) % 5];
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const fmt = (d: Date) => `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
export const label = (d: Date) => `${HARI[d.getDay()]} ${pasaran(d)}`;
export const labelJw = (d: Date) => `${HARI_JW[d.getDay()]} ${pasaran(d)}`;
export const postmark = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${ROMAN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;

export function isMalamJumatKliwon(now = new Date()) {
  const h = now.getHours();
  if (now.getDay() === 4 && h >= 18) return pasaran(addDays(now, 1)) === 'Kliwon';
  if (now.getDay() === 5 && h < 5) return pasaran(now) === 'Kliwon';
  return false;
}
export function nextMalamKliwon(from = new Date()) {
  let d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 40; i++) {
    if (d.getDay() === 4 && pasaran(addDays(d, 1)) === 'Kliwon') return d;
    d = addDays(d, 1);
  }
  return null;
}
export const firstAfterStorm = (year: number) => nextMalamKliwon(new Date(year, 1, 9));
export function daysUntil(target: Date, now = new Date()) {
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 864e5);
}
export const parseYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const chipDate = (d: Date, y = true) => `${DOW[d.getDay()]} ${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3).toUpperCase()}${y ? ' ' + d.getFullYear() : ''}`;
