/* Literary Escape — core helpers: crypt, Javanese calendar, storage, small utils */
window.LE = window.LE || {};

(function (LE) {
  // ---------- crypt (mirrors scripts/build.mjs) ----------
  const fnv = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  };
  const keystream = (key, n) => {
    let s = fnv(key) || 1;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0;
      out[i] = (s ^ key.charCodeAt(i % key.length)) & 255;
    }
    return out;
  };
  const open = (b64, key) => {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const ks = keystream(key, bytes.length);
      for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i];
      const text = new TextDecoder().decode(bytes);
      return text.startsWith('LE:') ? text.slice(3) : null;
    } catch (e) { return null; }
  };
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const PREFIXES = ['almarhumah', 'almarhum', 'almh', 'alm', 'bapak', 'paklik', 'ibu', 'mbah', 'mbok', 'kang', 'mbak', 'mas', 'pak', 'bu', 'sdri', 'sdr', 'yu', 'lik', 'si', 'nduk', 'le'];
  LE.crypt = {
    fnv, open, norm,
    hash: (salt, n) => fnv(salt + n).toString(36),
    // candidate keys: as typed, then with honorifics stripped
    candidates(raw) {
      const words = (raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter(Boolean);
      const out = [];
      const push = (w) => { const k = w.join(''); if (k && !out.includes(k)) out.push(k); };
      push(words);
      let w = words.slice();
      while (w.length > 1 && PREFIXES.includes(w[0])) { w = w.slice(1); push(w); }
      return out;
    },
  };

  // ---------- Javanese weekday + pasaran ----------
  const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const HARI_JW = ['Ahad', 'Senen', 'Slasa', 'Rebo', 'Kemis', 'Jemuah', 'Setu'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const REF = Date.UTC(1979, 1, 9); // Jumat Kliwon, 9 Februari 1979 — the night of the storm ended here
  const dayNum = (d) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - REF) / 864e5);
  const pasaran = (d) => PASARAN[(((dayNum(d) % 5) + 5) % 5 + 4) % 5];
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmt = (d) => `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  LE.jw = {
    pasaran, HARI, HARI_JW, BULAN,
    label: (d) => `${HARI[d.getDay()]} ${pasaran(d)}`,
    labelJw: (d) => `${HARI_JW[d.getDay()]} ${pasaran(d)}`,
    fmt, addDays,
    postmark: (d) => `${String(d.getDate()).padStart(2, '0')} ${ROMAN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    // Thursday evening whose Friday is Kliwon (malam Jumat Kliwon), until Friday dawn
    isMalamJumatKliwon(now = new Date()) {
      const h = now.getHours();
      if (now.getDay() === 4 && h >= 18) return pasaran(addDays(now, 1)) === 'Kliwon';
      if (now.getDay() === 5 && h < 5) return pasaran(now) === 'Kliwon';
      return false;
    },
    // next Thursday whose Friday is Kliwon (on or after `from`)
    nextMalamKliwon(from = new Date()) {
      let d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      for (let i = 0; i < 40; i++) {
        if (d.getDay() === 4 && pasaran(addDays(d, 1)) === 'Kliwon') return d;
        d = addDays(d, 1);
      }
      return null;
    },
    // first malam Jumat Kliwon strictly after 8 February of `year`
    firstAfterStorm(year) {
      return this.nextMalamKliwon(new Date(year, 1, 9));
    },
    daysUntil(target, now = new Date()) {
      const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
      return Math.round((b - a) / 864e5);
    },
  };

  // ---------- storage (wrapped: may be unavailable) ----------
  LE.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ } },
    del(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };

  // ---------- utils ----------
  LE.esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  LE.$ = (sel, root = document) => root.querySelector(sel);
  LE.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  LE.params = new URLSearchParams(location.search);
  LE.now = () => {
    const forced = LE.params.get('today');
    if (forced) { const d = new Date(forced + 'T21:00:00'); if (!isNaN(d)) return d; }
    return new Date();
  };
})(window.LE);
