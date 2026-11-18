/* postmortem — SVG: postage stamps, icons, and drawn exhibits (photo, map, sketch) */
(function (LE) {
  let uid = 0;
  const esc = (s) => LE.esc(s);

  const PALETTES = {
    ochre: ['#d6a243', '#2a1d0b'], sea: ['#2f5d62', '#f1e8d0'], rust: ['#b0532c', '#f7ecd9'],
    slate: ['#3c4a5d', '#ebe4d2'], olive: ['#6d6b3b', '#f1ebd6'], bone: ['#e9e1cd', '#2b2a27'],
    plum: ['#5b3b4c', '#f2e6dc'], red: ['#b5342b', '#f6eadb'], green: ['#2f6a4f', '#eef0e0'],
    night: ['#1c2227', '#f4d23c'], sand: ['#cdb68e', '#2e2416'], ink: ['#26303a', '#d9e3e6'],
  };
  const ORDER = ['sea', 'ochre', 'rust', 'slate', 'olive', 'plum', 'green', 'sand', 'ink', 'red', 'bone'];

  // ----- motifs: drawn in a 60×60 box -----
  const M = {
    lighthouse: (f, a) => `
      <path d="M26 52 L34 52 L32.5 22 L27.5 22 Z" fill="${f}"/>
      <rect x="26.5" y="15" width="7" height="7" fill="${a}" stroke="${f}" stroke-width="1"/>
      <path d="M25.5 15 L30 10 L34.5 15 Z" fill="${f}"/>
      <path d="M33.5 18 L56 11 M33.5 19 L56 25 M26.5 18 L4 11 M26.5 19 L4 25" stroke="${a}" stroke-width="1" opacity=".85"/>
      <path d="M2 56 Q9 52 16 56 T30 56 T44 56 T58 56" fill="none" stroke="${f}" stroke-width="1.4"/>`,
    envelope: (f, a) => `
      <rect x="8" y="17" width="44" height="28" fill="none" stroke="${f}" stroke-width="1.6"/>
      <path d="M8 17 L30 34 L52 17" fill="none" stroke="${f}" stroke-width="1.6"/>
      <rect x="41" y="20" width="8" height="9" fill="${a}"/>
      <text x="30" y="54" text-anchor="middle" font-size="5.5" font-family="Caveat, cursive" fill="${f}">Kang Kasan, Laut</text>`,
    door: (f, a) => `
      <rect x="18" y="6" width="24" height="46" fill="none" stroke="${f}" stroke-width="1.6"/>
      <path d="M18 6 L31 10 L31 50 L18 52 Z" fill="${f}" opacity=".9"/>
      <rect x="31" y="10" width="11" height="40" fill="${a}" opacity=".85"/>
      <circle cx="44" cy="12" r="0" />
      <g fill="${f}"><ellipse cx="24" cy="57" rx="1.6" ry="2.6"/><ellipse cx="34" cy="58" rx="1.6" ry="2.6"/></g>`,
    footprints: (f) => {
      let s = '';
      for (let i = 0; i < 5; i++) {
        const y = 52 - i * 10, x = i % 2 ? 34 : 24;
        s += `<ellipse cx="${x}" cy="${y}" rx="3" ry="5.2" fill="${f}" transform="rotate(${i % 2 ? 8 : -8} ${x} ${y})"/>`;
      }
      return s;
    },
    stone: (f, a) => {
      let s = `<path d="M8 52 Q6 30 18 16 Q30 6 42 14 Q54 24 52 52 Z" fill="${f}"/>`;
      for (let i = 0; i < 9; i++) s += `<path d="M${16 + i * 3.6} 26 L${16 + i * 3.6} 33" stroke="${a}" stroke-width="1"/>`;
      for (let i = 0; i < 7; i++) s += `<path d="M${18 + i * 3.6} 38 L${18 + i * 3.6} 44" stroke="${a}" stroke-width="1" opacity=".45"/>`;
      return s;
    },
    book: (f, a) => `
      <path d="M6 18 Q18 14 30 20 L30 50 Q18 44 6 48 Z" fill="none" stroke="${f}" stroke-width="1.6"/>
      <path d="M54 18 Q42 14 30 20 L30 50 Q42 44 54 48 Z" fill="none" stroke="${f}" stroke-width="1.6"/>
      <path d="M10 25 L25 27 M10 31 L25 33 M10 37 L22 38" stroke="${f}" stroke-width=".8"/>
      <path d="M40 10 L50 40" stroke="${a}" stroke-width="2.4" stroke-linecap="round"/>`,
    tape: (f, a) => `
      <rect x="5" y="15" width="50" height="32" rx="3" fill="none" stroke="${f}" stroke-width="1.6"/>
      <rect x="14" y="22" width="32" height="12" rx="6" fill="${a}" opacity=".9"/>
      <circle cx="21" cy="28" r="4" fill="none" stroke="${f}" stroke-width="1.4"/>
      <circle cx="39" cy="28" r="4" fill="none" stroke="${f}" stroke-width="1.4"/>
      <path d="M15 47 L19 40 L41 40 L45 47" fill="none" stroke="${f}" stroke-width="1.2"/>`,
    boat: (f, a) => `
      <path d="M4 34 Q30 52 56 34 Z" fill="${f}"/>
      <path d="M12 36 L12 31 M20 39 L20 31 M30 40 L30 31 M40 39 L40 31 M48 36 L48 31" stroke="${f}" stroke-width="1.4"/>
      <path d="M18 30 L6 14 M42 30 L54 14" stroke="${a}" stroke-width="1.6"/>
      <path d="M2 54 Q9 50 16 54 T30 54 T44 54 T58 54" fill="none" stroke="${f}" stroke-width="1.2"/>`,
    key: (f, a) => `
      <circle cx="18" cy="30" r="9" fill="none" stroke="${f}" stroke-width="2.2"/>
      <path d="M27 30 L54 30 M46 30 L46 37 M52 30 L52 36" stroke="${f}" stroke-width="2.2"/>
      <circle cx="18" cy="30" r="3" fill="${a}"/>`,
    wave: (f, a) => `
      <circle cx="44" cy="16" r="6" fill="${a}"/>
      <path d="M2 34 Q9 28 16 34 T30 34 T44 34 T58 34 M2 44 Q9 38 16 44 T30 44 T44 44 T58 44" fill="none" stroke="${f}" stroke-width="1.6"/>`,
  };

  /**
   * stamp({title, sub, value, palette, motif, initial, year, postmark, w})
   */
  function stamp(o = {}) {
    const id = 'st' + (++uid);
    const [bg, fg] = PALETTES[o.palette] || PALETTES.sea;
    const accent = o.accent || (o.palette === 'night' ? '#f4d23c' : (o.palette === 'bone' || o.palette === 'sand' ? '#b5342b' : '#f4d23c'));
    const W = 120, H = 150;
    let holes = '';
    for (let x = 6; x <= W - 6; x += 9) holes += `<circle cx="${x}" cy="0" r="3.6"/><circle cx="${x}" cy="${H}" r="3.6"/>`;
    for (let y = 6; y <= H - 6; y += 9) holes += `<circle cx="0" cy="${y}" r="3.6"/><circle cx="${W}" cy="${y}" r="3.6"/>`;
    const centre = o.initial
      ? `<text x="60" y="${o.habit ? 86 : 92}" text-anchor="middle" font-family="'Newsreader', Georgia, serif" font-size="${o.initial.length > 1 ? 40 : 66}" font-style="italic" fill="${fg}">${esc(o.initial)}</text>
         ${o.habit ? `<text x="60" y="104" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="6.4" letter-spacing=".6" fill="${fg}" opacity=".85">${esc(o.habit.toUpperCase())}</text>` : ''}`
      : `<g transform="translate(30 30)">${(M[o.motif] || M.wave)(fg, accent)}</g>`;
    const postmark = o.postmark ? `
      <g transform="rotate(-14 84 104)" opacity=".78" fill="none" stroke="#7a1b16" stroke-width="1.3">
        <circle cx="84" cy="104" r="22"/><circle cx="84" cy="104" r="17"/>
        <path d="M44 96 Q54 92 64 96 T84 96 M44 112 Q54 108 64 112 T84 112" />
        <text x="84" y="102" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="6" fill="#7a1b16" stroke="none">${esc(o.postmark[0] || '')}</text>
        <text x="84" y="110" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="5" fill="#7a1b16" stroke="none">${esc(o.postmark[1] || '')}</text>
      </g>` : '';
    return `<svg class="stamp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'perangko')}" xmlns="http://www.w3.org/2000/svg">
      <defs><mask id="${id}"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${holes}</g></mask>
      <filter id="${id}g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${uid}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .08 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
      <g mask="url(#${id})">
        <rect width="${W}" height="${H}" fill="#f7f2e6"/>
        <rect x="9" y="9" width="${W - 18}" height="${H - 18}" fill="${bg}"/>
        <rect x="13" y="13" width="${W - 26}" height="${H - 26}" fill="none" stroke="${fg}" stroke-width=".7" opacity=".55"/>
        <text x="19" y="27" font-family="'IBM Plex Mono', monospace" font-size="8" fill="${fg}">${esc(o.value || 'Rp 50')}</text>
        <text x="${W - 19}" y="27" text-anchor="end" font-family="'IBM Plex Mono', monospace" font-size="7" fill="${fg}" opacity=".8">${esc(o.year || '1979')}</text>
        <g transform="translate(0 4)">${centre}</g>
        <text x="60" y="${H - 30}" text-anchor="middle" font-family="'Inter Tight', sans-serif" font-weight="700" font-size="${(o.title || '').length > 14 ? 8.6 : 10.5}" fill="${fg}">${esc(o.title || '')}</text>
        <text x="60" y="${H - 19}" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="5.6" letter-spacing="1" fill="${fg}" opacity=".75">${esc((o.sub || 'NUSA SEWU · LAUT').toUpperCase())}</text>
        <rect width="${W}" height="${H}" filter="url(#${id}g)"/>
        ${postmark}
      </g>
    </svg>`;
  }

  function blankStamp(label = '') {
    const W = 120, H = 150;
    let d = '';
    return `<svg class="stamp-svg blank" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="2" fill="none" stroke="currentColor" stroke-dasharray="4 5" stroke-width="1.4" opacity=".55"/>
      <text x="60" y="84" text-anchor="middle" font-family="'Newsreader', serif" font-style="italic" font-size="30" fill="currentColor" opacity=".35">${esc(label || '?')}</text>${d}
    </svg>`;
  }

  // ----- UI icons (24×24, stroke) -----
  const I = {
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12h7M7 15h5"/>',
    report: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 15h7M9 18h4"/>',
    notebook: '<path d="M6 3h12v18H6zM9 3v18M12 8h4M12 11h4"/>',
    table: '<path d="M4 5h16v14H4zM4 10h16M4 14h16M10 5v14"/>',
    photo: '<path d="M4 6h16v13H4zM4 15l5-4 4 3 3-2 4 3"/><circle cx="15" cy="9.5" r="1.5"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
    letter: '<path d="M3 6h18v12H3zM3 6l9 7 9-7"/>',
    tape: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="11" r="2"/><circle cx="15.5" cy="11" r="2"/><path d="M7 18l1.5-3h7L17 18"/>',
    voice: '<path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 11v2"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    web: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    thesis: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>',
    card: '<path d="M6 3h12v18H6z" stroke-dasharray="2 2"/><path d="M9 14c1-3 5-3 6 0M12 10.5a1.8 1.8 0 1 0 0-.1"/>',
    quote: '<path d="M5 7h5v5H7c0 2 1 3 3 4M14 7h5v5h-3c0 2 1 3 3 4"/>',
    foot: '<ellipse cx="9" cy="15" rx="2.5" ry="4"/><ellipse cx="15" cy="8" rx="2.5" ry="4"/>',
    flame: '<path d="M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6"/>',
    archive: '<path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4"/>',
    desk: '<path d="M4 7h16v4H4zM6 11v8M18 11v8M8 4h8v3H8z"/>',
    stamp: '<path d="M6 4h12v16H6z" stroke-dasharray="2.2 1.8"/><path d="M9 14l2-3 2 2 2-3"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
    pause: '<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>',
    question: '<path d="M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.3-1.5 2.4M12 17.5v.5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || I.report}</svg>`;

  // ----- seeded random -----
  const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // ----- I-07: photograph of the nine boats, January 1979 -----
  function photo() {
    const r = rng(1979);
    let boats = '', men = '';
    for (let i = 0; i < 9; i++) {
      const x = 14 + i * 37, y = 168 + (i % 2) * 4;
      boats += `<path d="M${x} ${y} q16 -10 32 0 l-3 12 q-13 6 -26 0 z" fill="#3b2c1c" opacity=".85"/>
        <path d="M${x + 16} ${y - 4} l0 -${18 + (i % 3) * 4}" stroke="#3b2c1c" stroke-width="1.2" opacity=".6"/>`;
    }
    for (let i = 0; i < 30; i++) {
      const x = 12 + i * 11 + r() * 6, sit = r() < 0.3, y = sit ? 176 + r() * 6 : 198 + r() * 22;
      const h = sit ? 14 : 26 + r() * 6;
      const blur = i === 2 ? ' filter="url(#blurKasan)"' : '';
      men += `<g${blur} fill="#2a1f14" opacity="${0.75 + r() * 0.2}"><circle cx="${x}" cy="${y - h - 4}" r="3.6"/><rect x="${x - 4}" y="${y - h}" width="8" height="${h}" rx="3"/></g>`;
    }
    // tall thin man with child on his shoulders, far right
    men += `<g fill="#2a1f14"><circle cx="364" cy="160" r="3.6"/><rect x="360.5" y="165" width="7" height="44" rx="3"/>
      <circle cx="364" cy="146" r="3"/><rect x="361" y="149" width="6" height="9" rx="2.5"/></g>`;
    return `<svg class="art-photo" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Foto sembilan perahu di Pantai Wetan, Januari 1979">
      <defs>
        <linearGradient id="skyP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9dcc0"/><stop offset="1" stop-color="#cdb791"/></linearGradient>
        <filter id="grainP"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .15  0 0 0 0 .1  0 0 0 .35 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
        <filter id="blurKasan"><feGaussianBlur stdDeviation="1.6 0.6"/></filter>
        <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2b1d0d" stop-opacity=".55"/></radialGradient>
      </defs>
      <rect width="400" height="260" fill="url(#skyP)"/>
      <path d="M0 142 L400 138 L400 162 L0 166 Z" fill="#a89270"/>
      <path d="M0 160 Q200 150 400 156 L400 260 L0 260 Z" fill="#d8c7a3"/>
      <path d="M330 140 Q352 118 380 122 L400 140 Z" fill="#9c8562"/>
      <path d="M352 122 L356 92 L360 92 L364 122 Z" fill="#f2ead8" stroke="#6b5638" stroke-width=".6"/>
      <rect x="354" y="86" width="8" height="6" fill="#6b5638"/>
      ${boats}${men}
      <rect width="400" height="260" fill="url(#vig)"/>
      <rect width="400" height="260" filter="url(#grainP)"/>
      <path d="M0 0 L46 0 L0 40 Z" fill="#f4eee0"/><path d="M46 0 L0 40" stroke="#b9a785" stroke-width="1"/>
    </svg>`;
  }

  // ----- I-08: hand-drawn map of Pakabaran -----
  const MAP_PINS = [
    [272, 172, 'Pantai Wetan'], [184, 44, 'Tanjung Lor'], [66, 160, 'Dermaga'], [196, 82, 'Pakabaran Lor'],
    [158, 236, 'Pakabaran Kidul'], [178, 152, 'Balai Desa · SD'], [205, 168, 'Kantor Pos'], [128, 128, 'Makam'],
  ];
  function map() {
    let pins = '';
    MAP_PINS.forEach(([x, y, label], i) => {
      pins += `<g class="map-pin" data-pin="${i}" tabindex="0" role="button" aria-label="${esc(label)}">
        <circle cx="${x}" cy="${y}" r="11" class="pin-hit"/><circle cx="${x}" cy="${y}" r="7.5" class="pin-dot"/>
        <text x="${x}" y="${y + 3.2}" text-anchor="middle" class="pin-num">${i + 1}</text></g>`;
    });
    let notches = '';
    for (let i = 0; i < 6; i++) notches += `<path d="M${258 + i * 2.4} 222 l0 5" stroke="#2b2a27" stroke-width=".8"/>`;
    let houses = '';
    const hs = [[170, 70], [182, 64], [208, 74], [218, 90], [244, 96], [160, 82], [146, 226], [170, 222], [184, 236], [134, 244], [160, 250], [196, 222], [110, 238]];
    hs.forEach(([x, y], i) => { houses += `<rect x="${x - 4}" y="${y - 4}" width="8" height="7" fill="${i === 12 ? '#b5342b' : 'none'}" stroke="#2b2a27" stroke-width=".9"/><path d="M${x - 5} ${y - 4} L${x} ${y - 8} L${x + 5} ${y - 4}" fill="none" stroke="#2b2a27" stroke-width=".9"/>`; });
    let graves = '';
    for (let i = 0; i < 9; i++) graves += `<path d="M${104 + (i % 3) * 5} ${120 + Math.floor(i / 3) * 6} l0 -3" stroke="#2b2a27" stroke-width="1.2"/>`;
    return `<svg class="art-map" viewBox="0 0 360 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Peta tangan Pakabaran">
      <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0 L0 6" stroke="#9fb3b6" stroke-width=".8"/></pattern></defs>
      <rect width="360" height="300" fill="url(#hatch)" opacity=".55"/>
      <path d="M182 26 C232 38 272 80 282 130 C292 182 272 240 222 266 C182 286 128 280 98 250 C68 220 58 170 74 120 C90 74 140 30 182 26 Z" fill="#f3ecdc" stroke="#2b2a27" stroke-width="1.6" stroke-dasharray="1 0"/>
      <path d="M287 112 C292 150 290 190 278 222" fill="none" stroke="#c9b48a" stroke-width="6" stroke-linecap="round" opacity=".7"/>
      <path d="M262 214 q8 -6 14 2 q2 10 -8 12 q-9 0 -6 -14z" fill="#2b2a27"/>${notches}
      <path d="M176 38 L180 22 L186 22 L190 38 Z" fill="#fff" stroke="#2b2a27" stroke-width="1"/><circle cx="183" cy="20" r="3" fill="#f4d23c" stroke="#2b2a27" stroke-width=".8"/>
      <path d="M183 20 L120 2 M183 20 L246 2" stroke="#f4d23c" stroke-width="1.2" opacity=".9"/>
      <path d="M74 160 L36 160 M36 156 L36 164" stroke="#2b2a27" stroke-width="2"/>
      <ellipse cx="120" cy="124" rx="24" ry="14" fill="none" stroke="#2b2a27" stroke-width=".8" stroke-dasharray="3 2"/>${graves}
      ${houses}
      <rect x="170" y="146" width="16" height="10" fill="none" stroke="#2b2a27" stroke-width=".9"/><rect x="198" y="164" width="9" height="7" fill="#e07b2c" stroke="#2b2a27" stroke-width=".8"/>
      <g font-family="Caveat, cursive" fill="#2b2a27" font-size="13">
        <text x="300" y="150" transform="rotate(80 300 150)">Pantai Wetan</text>
        <text x="236" y="248" font-size="11">Watu Tunggu</text>
        <text x="12" y="150" font-size="12">laut</text>
        <text x="10" y="290" font-size="12">Laut Jawa · angin barat →</text>
        <text x="96" y="104" font-size="11">bukit makam</text>
        <text x="100" y="264" font-size="10" fill="#b5342b">rumah kami</text>
      </g>
      <g transform="translate(326 34)" font-family="IBM Plex Mono, monospace" font-size="8" fill="#2b2a27"><path d="M0 14 L0 -12 M-4 -6 L0 -12 L4 -6" stroke="#2b2a27" fill="none"/><text x="-3" y="24">U</text></g>
      ${pins}
    </svg>`;
  }

  // ----- IV-09: pencil sketch of the footprints -----
  function sketch() {
    const r = rng(2019);
    const foot = (x, y, rot, op = 0.75) => `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.6" ry="5" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#4a4a4a" opacity="${op}"/>`;
    let s = '';
    const doors = [[60, 60], [130, 48], [200, 62], [270, 50], [320, 70]];
    doors.forEach(([x, y]) => { s += `<rect x="${x - 9}" y="${y - 22}" width="18" height="24" fill="none" stroke="#3a3a3a" stroke-width="1.1"/><path d="M${x - 14} ${y + 2} L${x + 14} ${y + 2}" stroke="#3a3a3a"/>`; });
    // many prints from the sea up to the doors
    for (let t = 0; t < 14; t++) {
      const [dx, dy] = doors[t % doors.length];
      const sx = 20 + r() * 320;
      for (let k = 0; k < 16; k++) {
        const f = k / 15, x = sx + (dx - sx) * f + (k % 2 ? 5 : -5), y = 350 - (350 - dy - 12) * f;
        s += foot(x + r() * 3, y, Math.atan2(dx - sx, -(350 - dy)) * 57 + (k % 2 ? 6 : -6), 0.25 + r() * 0.35);
      }
    }
    // one trail from a door to the sea, with the oar mark every four steps
    const [ox, oy] = doors[2];
    for (let k = 0; k < 18; k++) {
      const f = k / 17, x = ox + (176 - ox) * f + (k % 2 ? 6 : -6), y = oy + 14 + (346 - oy - 14) * f;
      s += foot(x, y, 180 + (k % 2 ? 4 : -4), 0.95);
      if (k % 4 === 3) s += `<path d="M${x + 22} ${y - 8} q3 8 0 16" stroke="#3a3a3a" stroke-width="2.2" fill="none" opacity=".55"/>`;
    }
    // escorts turning back at the waterline
    for (let k = 0; k < 6; k++) {
      s += foot(150 + k * 2, 330 + k * 6, 175, 0.6) + foot(206 - k * 2, 330 + k * 6, 185, 0.6);
    }
    return `<svg class="art-sketch" viewBox="0 0 360 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sketsa jejak kaki">
      <rect width="360" height="420" fill="#fbfaf6"/>
      ${s}
      <path d="M0 356 Q30 346 60 356 T120 356 T180 356 T240 356 T300 356 T360 356" fill="none" stroke="#3a3a3a" stroke-width="1.2"/>
      <path d="M0 372 Q30 362 60 372 T120 372 T180 372 T240 372 T300 372 T360 372" fill="none" stroke="#3a3a3a" stroke-width=".7" opacity=".6"/>
      <g font-family="Caveat, cursive" font-size="13" fill="#3a3a3a"><text x="10" y="400">laut</text><text x="240" y="400">garis air · 4 langkah = 1 bekas dayung</text><text x="10" y="20">pintu-pintu, Pakabaran Kidul</text></g>
    </svg>`;
  }

  LE.svg = { stamp, blankStamp, icon, photo, map, sketch, MAP_PINS, PALETTES, ORDER };
})(window.LE);
