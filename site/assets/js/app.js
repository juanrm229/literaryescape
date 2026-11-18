/* Literary Escape — app: routing, views, puzzle */
(function (LE) {
  const { $, $$, esc, svg, jw } = LE;
  const C = LE.cases.nyewu;
  const D = window.CASE_DATA.nyewu;
  const KEY = 'le.nyewu.v1';
  const DEFAULTS = {
    accepted: false, read: {}, opened: {}, berkasStamp: {}, kenal: {}, board: {}, extra: [], notes: '', bekal: {},
    placed: [], recited: {}, tembang: false, sent: false, believe: false, hintsShown: 1, featured: null,
  };
  let S = Object.assign({}, DEFAULTS, LE.store.get(KEY, {}));
  const save = () => LE.store.set(KEY, S);
  const UNLOCK_ALL = LE.params.get('unlock') === 'all';

  // ---------- index ----------
  const DOCS = [];
  D.berkas.forEach((b, bi) => b.docs.forEach((d) => DOCS.push({ ...d, berkas: b, bi })));
  const docById = (id) => DOCS.find((d) => d.id === id);
  const readableDocs = DOCS.filter((d) => !d.locked);
  const answerMap = {};
  D.answers.forEach((a) => (answerMap[a.h] = answerMap[a.h] || []).push(a.p));

  function berkasUnlocked(bi) {
    if (UNLOCK_ALL || bi === 0) return true;
    const b = D.berkas[bi];
    if (b.id === 'IX') return !!S.read['VIII-20'];
    const prev = D.berkas[bi - 1];
    return !!S.read[prev.docs[prev.docs.length - 1].id];
  }
  const berkasDone = (b) => b.docs.filter((d) => !d.locked).every((d) => S.read[d.id]);
  const kabarUnlocked = () => berkasUnlocked(D.berkas.length - 1);

  // ---------- placed stamps (decoded) ----------
  function decodePlaced() {
    return S.placed.map((p) => {
      for (const blob of answerMap[LE.crypt.hash('nyewu:', p.k)] || []) {
        const t = LE.crypt.open(blob, p.k);
        if (t) return JSON.parse(t);
      }
      return null;
    }).filter(Boolean);
  }
  const masterKey = (placed) => placed.slice().sort((a, b) => a.i - b.i).map((p) => p.k).join('|');
  const solved = () => decodePlaced().length === D.total;

  // ---------- chrome ----------
  const app = $('#app');
  function topbar(left, center, right) {
    return `<header class="topbar"><div class="tb-l">${left || ''}</div><div class="tb-c">${center || ''}</div><div class="tb-r">${right || ''}</div></header>`;
  }
  const iconBtn = (name, attrs = '', label = '') => `<button class="ibtn" ${attrs} aria-label="${esc(label || name)}">${svg.icon(name)}</button>`;
  const soundBtn = () => iconBtn(LE.audio.muted ? 'mute' : 'sound', 'data-act="sound"', LE.audio.muted ? 'Nyalakan suara' : 'Matikan suara');

  function dock(active) {
    const item = (href, ic, label, key, extra = '') => `<a class="dk${active === key ? ' on' : ''}" href="${href}" ${extra}>${svg.icon(ic)}<span>${label}</span></a>`;
    const locked = !kabarUnlocked();
    return `<nav class="dock" aria-label="Navigasi perkara">
      ${item('#/nyewu', 'archive', 'Arsip', 'arsip')}<i class="dk-dot"></i>
      ${item('#/nyewu/meja', 'desk', 'Meja', 'meja')}<i class="dk-dot"></i>
      <button class="dk-q" data-act="hints" aria-label="Petunjuk">?</button><i class="dk-dot"></i>
      ${item('#/nyewu/perangko', 'stamp', 'Perangko', 'perangko')}<i class="dk-dot"></i>
      ${item('#/nyewu/kabar', locked ? 'lock' : 'send', 'Kabar', 'kabar', locked ? 'data-locked="1"' : '')}
    </nav>`;
  }
  function believeSwitch() {
    return `<div class="believe">
      <label class="switch"><input type="checkbox" data-act="believe" ${S.believe ? 'checked' : ''}><span class="sw"></span><span>Aku percaya ini nyata</span></label>
      ${S.believe ? '<button class="linkbtn" data-act="unbelieve">Ini cuma cerita.</button>' : '<small>Biarkan mati.</small>'}
    </div>`;
  }

  // ---------- overlays ----------
  function toast(html, opts = {}) {
    const t = document.createElement('div');
    t.className = 'toast' + (opts.stamp ? ' with-stamp' : '');
    t.innerHTML = (opts.stamp ? `<div class="toast-stamp">${opts.stamp}</div>` : '') + `<div>${html}</div>`;
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, opts.ms || 3600);
  }
  function sheet(html, cls = '') {
    closeSheet();
    const w = document.createElement('div');
    w.className = 'sheet-wrap';
    w.innerHTML = `<div class="sheet-bg" data-act="close-sheet"></div><div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
    document.body.appendChild(w);
    requestAnimationFrame(() => w.classList.add('in'));
    return w;
  }
  function closeSheet() { $$('.sheet-wrap').forEach((w) => { w.classList.remove('in'); setTimeout(() => w.remove(), 300); }); }

  function hintsSheet() {
    const n = Math.max(1, Math.min(S.hintsShown, C.HINTS.length));
    sheet(`<h2 class="sh-title">Petunjuk korektor</h2>
      <p class="sh-sub">Satu per satu. Jangan buka semuanya kalau belum perlu.</p>
      <ol class="hints">${C.HINTS.slice(0, n).map((h) => `<li>${esc(h)}</li>`).join('')}</ol>
      ${n < C.HINTS.length ? '<button class="btn ghost" data-act="more-hint">Petunjuk berikutnya</button>' : '<p class="sh-sub">Itu semua petunjuk yang ada. Sisanya ada di arsip.</p>'}`);
  }

  function setBelieve(on) {
    S.believe = on; save();
    document.body.classList.toggle('believe', on);
    renderFootprints();
    if (on) toast('<b>Sekarang kamu bisa melihat mereka.</b><br>Mereka juga bisa melihatmu.', { ms: 5200 });
    else toast('Ini cuma cerita. Bagus.');
    route();
  }
  function renderFootprints() {
    const box = $('#footprints');
    if (!S.believe) { box.innerHTML = ''; return; }
    let s = '';
    for (let i = 0; i < 14; i++) {
      const x = 50 + (i % 2 ? 4 : -4) + Math.sin(i / 2) * 6, y = 100 - i * 7.4;
      s += `<span class="fp" style="left:${x}%;top:${y}%;animation-delay:${i * 0.35}s;transform:rotate(${i % 2 ? 6 : -6}deg)"></span>`;
    }
    box.innerHTML = s;
  }

  // ---------- read state ----------
  function markRead(doc) {
    if (S.read[doc.id]) return false;
    S.read[doc.id] = new Date().toISOString();
    const b = doc.berkas;
    if (!S.berkasStamp[b.id] && b.id !== 'IX' && berkasDone(b)) {
      S.berkasStamp[b.id] = S.read[doc.id];
      S.featured = 'b:' + b.id;
      setTimeout(() => { LE.audio.thud(); toast(`<small>Perangko baru</small><b>Berkas ${esc(b.id)} · ${esc(b.title)}</b>`, { stamp: berkasStamp(b), ms: 4600 }); }, 900);
    }
    if (C.KENAL[doc.id] && !S.kenal[doc.id]) {
      S.kenal[doc.id] = S.read[doc.id];
      S.featured = 'k:' + doc.id;
      setTimeout(() => toast(`<small>Kartu kenal</small><b>${esc(C.KENAL[doc.id][0])}</b>`, { stamp: kenalStamp(doc.id), ms: 3000 }), 700);
    }
    save();
    return true;
  }

  // ---------- stamps ----------
  const berkasStamp = (b, postmark) => svg.stamp({
    title: b.id === '0' ? 'Pengantar' : b.title, sub: `Berkas ${b.id} · ${C.BERKAS[b.id].years}`,
    motif: C.BERKAS[b.id].motif, palette: C.BERKAS[b.id].palette, value: 'Rp 50', year: (C.BERKAS[b.id].years.match(/\d{4}/) || [''])[0], postmark,
  });
  const kenalStamp = (id) => {
    const [name, habit, boat] = C.KENAL[id];
    const i = Object.keys(C.KENAL).indexOf(id);
    return svg.stamp({ title: name, sub: boat, initial: name[0], habit, palette: svg.ORDER[i % svg.ORDER.length], value: 'Rp 50', year: '1979' });
  };
  const kabarStamp = (p, postmarked) => svg.stamp({
    title: p.name, sub: p.year === 1979 ? 'Laut · 1979' : `Windu · ${p.year}`, initial: p.name[0], habit: p.habit,
    palette: p.year === 1979 ? svg.ORDER[p.i % svg.ORDER.length] : ['red', 'sand', 'ink', 'green', 'olive', 'slate', 'green'][p.i - 19],
    value: 'Rp 50', year: String(p.year), postmark: postmarked ? ['WIS YA', 'LAUT'] : null,
  });

  // =====================================================================
  // VIEWS
  // =====================================================================
  function viewHome() {
    const read = readableDocs.filter((d) => S.read[d.id]).length;
    const pct = Math.round((read / readableDocs.length) * 100);
    const status = S.sent ? 'Kabar terkirim' : S.accepted ? `Sedang dibaca · ${pct}%` : 'Belum diambil';
    return `<div class="home">
      <header class="brandbar"><a class="wordmark" href="#/">literary escape<i></i></a><span class="brand-note">perkara sastra interaktif</span></header>
      <section class="hero">
        <p class="kicker">Ruang baca untuk teka-teki</p>
        <h1>Setiap perkara adalah arsip.<br>Setiap arsip menyembunyikan satu pintu.</h1>
        <p class="lede">Koran, notulen, surat, kaset, catatan pinggir. Bacalah semuanya, kumpulkan perangkonya, lalu temukan kunci yang hanya bisa dipecahkan oleh orang yang benar-benar membaca.</p>
      </section>
      <section class="cases">
        <a class="case-card" href="#/nyewu">
          <div class="cc-paper">
            <div class="cc-top"><span class="chip">Perkara ${C.no}</span><span class="chip ghost">${esc(status)}</span></div>
            <h2>${esc(C.title)}</h2>
            <p class="cc-tag">${esc(C.tagline)}</p>
            <div class="tl mini">
              <span class="tl-chip">KAM 8 FEB 1979</span>
              <p class="tl-p">Sembilan perahu berangkat pukul tiga sore. Langit bersih. Tidak ada tanda-tanda.</p>
              <span class="tl-chip">KAM 19 NOV 2026</span>
              <p class="tl-p">“${esc(C.hook)}”</p>
            </div>
          </div>
          <div class="cc-dark">
            <div class="cc-stamp">${svg.stamp({ title: 'Nyewu', sub: 'Nusa Sewu · 1979', motif: 'lighthouse', palette: 'night', year: '1979' })}</div>
            <div class="cc-meta">
              <span>10 berkas</span><span>${readableDocs.length} dokumen</span><span>±40.000 kata</span><span>1 kunci</span>
              <div class="bar"><i style="width:${pct}%"></i></div>
              <b class="cc-cta">${S.accepted ? 'Lanjutkan' : 'Buka perkara'} ${svg.icon('next')}</b>
            </div>
          </div>
        </a>
        <div class="case-card soon" aria-disabled="true">
          <div class="cc-soon">${svg.blankStamp('02')}<div><span class="chip ghost">Perkara 02</span><h2>Belum tiba</h2><p>Arsip berikutnya sedang disusun. Amplopnya belum dicap.</p></div></div>
        </div>
      </section>
      <section class="how">
        <div><span class="how-n">01</span><h3>Baca arsipnya</h3><p>Setiap dokumen dirancang seperti benda aslinya: kliping, amplop, kaset, layar ponsel.</p></div>
        <div><span class="how-n">02</span><h3>Kumpulkan perangko</h3><p>Perangko adalah bukti bahwa Anda sudah membaca, dan bahwa Anda sudah mengenal.</p></div>
        <div><span class="how-n">03</span><h3>Kirim kabar</h3><p>Di akhir ada amplop kosong dan satu alamat. Hanya pembaca yang teliti yang tahu nama siapa yang harus ditempel.</p></div>
      </section>
      <footer class="foot">Semua nama, desa, dan pulau dalam perkara ini fiktif. Ini cuma cerita.</footer>
    </div>`;
  }

  function viewCover() {
    const days = jw.daysUntil(C.windu, LE.now());
    return `<div class="cover">
      <div class="paper-sheet">
        <div class="ps-head"><h1>Perkara Nyewu</h1><a class="ibtn light" href="#/" aria-label="Tutup">${svg.icon('x')}</a></div>
        <div class="tl">
          <span class="tl-chip">KAM 19 NOV 2026</span>
          <div class="tl-item"><p>“${esc(C.hook)}”</p><small class="muted">Catatan penyusun · Suwarta</small></div>
          <span class="tl-chip">KAM 8 FEB 1979</span>
          <div class="tl-item"><p>Empat puluh satu nelayan. Sembilan perahu. Malam Jumat Kliwon. Tidak ada satu jasad pun yang kembali.</p>
            <div class="mini-audio" data-demo="song"><span class="av">K</span>${iconBtn('play', 'data-act="demo" data-demo="hiss"', 'Putar')}<span class="wave w1"></span><span class="mt">00:34</span></div>
            <div class="mini-audio"><span class="av ghost">?</span>${iconBtn('play', 'data-act="demo" data-demo="oars"', 'Putar')}<span class="wave w2"></span><span class="mt">00:04</span></div>
          </div>
          <span class="tl-chip">KAM 11 FEB 2027</span>
          <div class="tl-item"><p>Windu keenam</p><small class="muted"><span class="spin"></span>${days > 0 ? `${days} hari lagi` : days === 0 ? 'malam ini' : 'sudah lewat'}</small>
            <div class="pill-card"><span class="pill">Kirim kabar · 1 amplop</span><p>Satu-satunya cara menutup pintu belakang.</p></div>
          </div>
        </div>
        <div class="ps-fade"></div>
      </div>
      <div class="decision">
        <h2>Ambil perkara ini?</h2>
        <p>Tindakan ini tidak bisa dibatalkan.</p>
        <div class="dec-row">
          <a class="dec-btn" href="#/" aria-label="Tidak">${svg.icon('x')}</a><i></i><i></i>
          <button class="dec-btn q" data-act="cover-help" aria-label="Apa artinya?">?</button><i></i><i></i>
          <button class="dec-btn" data-act="accept" aria-label="Ambil perkara">${svg.icon('check')}</button>
        </div>
      </div>
    </div>`;
  }

  function viewDashboard() {
    const now = LE.now();
    const read = readableDocs.filter((d) => S.read[d.id]).length;
    const stamps = Object.keys(S.berkasStamp).length + (S.sent ? 1 : 0);
    const days = jw.daysUntil(C.windu, now);
    const nextK = jw.nextMalamKliwon(now);
    const kliwon = document.body.classList.contains('kliwon');
    let tl = '';
    D.berkas.forEach((b, bi) => {
      const open = berkasUnlocked(bi);
      const meta = C.BERKAS[b.id];
      const done = b.id === 'IX' ? S.sent : berkasDone(b);
      tl += `<span class="tl-chip${open ? '' : ' dim'}">BERKAS ${esc(b.id)} · ${esc(meta.years)}</span>`;
      if (!open) {
        const prev = D.berkas[bi - 1];
        tl += `<div class="tl-group locked"><h3>${esc(b.title)}</h3><p class="lockline">${svg.icon('lock')} ${b.id === 'IX' ? 'Terbuka setelah VIII-20.' : `Selesaikan Berkas ${esc(prev.id)} sampai dokumen terakhirnya.`}</p></div>`;
        return;
      }
      if (b.id === 'IX') {
        tl += `<div class="tl-group"><h3>${esc(b.title)}</h3>
          <a class="pill-card big" href="#/nyewu/kabar"><span class="pill">Kirim kabar · ${decodePlaced().length}/${D.total}</span><p>${S.sent ? 'Kabar sudah dikirim.' : 'Satu amplop beralamat Laut. Tempelkan perangko untuk setiap yang masih menunggu.'}</p></a>
        </div>`;
        return;
      }
      const rows = b.docs.map((d) => {
        const [, label, ic] = C.skin(d.id);
        const r = S.read[d.id];
        return `<li><a class="doc-row${r ? ' read' : ''}" href="#/nyewu/d/${d.id}" id="row-${d.id}">
          <span class="dr-ic">${svg.icon(ic)}</span>
          <span class="dr-main"><span class="dr-code">${esc(d.id)}</span><span class="dr-title">${LE.md.inline(d.title)}</span><span class="dr-label">${esc(label)}</span></span>
          <span class="dr-state">${r ? '<span class="pm">TERBACA</span>' : svg.icon('next')}</span></a></li>`;
      }).join('');
      const intro = b.intro && b.id !== '0' ? `<p class="g-intro">${LE.md.inline(b.intro.replace(/^\*|\*$/g, ''))}</p>` : '';
      tl += `<div class="tl-group${done ? ' done' : ''}"><div class="g-head"><h3>${esc(b.title)}</h3>${done ? `<span class="g-stamp">${berkasStamp(b)}</span>` : ''}</div>${intro}<ul class="doclist">${rows}</ul></div>`;
    });
    return `${topbar(`<a class="ibtn" href="#/" aria-label="Tutup">${svg.icon('x')}</a>`, `<span class="tb-code">Perkara ${C.no}</span>`, soundBtn())}
      <main class="dash">
        <header class="case-head">
          <h1>Perkara Nyewu</h1>
          <p>${esc(C.tagline)}. ${esc(C.author)}.</p>
          <div class="stats">
            <span class="stat">${read}/${readableDocs.length} dokumen</span>
            <a class="stat" href="#/nyewu/perangko">${stamps}/10 perangko</a>
            <span class="stat ${days <= 14 ? 'warn' : ''}"><span class="spin"></span>Windu keenam · ${days > 0 ? days + ' hari' : days === 0 ? 'malam ini' : 'lewat'}</span>
          </div>
          ${kliwon ? '<div class="kliwon-banner">Malam ini malam Jumat Kliwon. Kalau mendengar dayung, itu cuma suara dari situs ini.</div>'
            : `<p class="next-k">Malam Jumat Kliwon berikutnya: ${nextK ? esc(jw.fmt(nextK)) : '—'}</p>`}
        </header>
        <div class="tl">${tl}</div>
        ${believeSwitch()}
      </main>${dock('arsip')}`;
  }

  // ---------- document ----------
  function parseLetterDate(title) {
    const m = title.match(/(\d{1,2}) (\w+) (\d{4})/);
    if (!m) return null;
    const mi = jw.BULAN.findIndex((b) => b.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)));
    return mi < 0 ? null : new Date(+m[3], mi, +m[1]);
  }
  const stampValue = (y) => (y < 1985 ? 'Rp 50' : y < 1995 ? 'Rp 350' : y < 2002 ? 'Rp 700' : 'Rp 1500');

  function renderBody(doc, skinName) {
    const md = doc.md;
    if (skinName === 'letter') {
      const d = parseLetterDate(doc.title) || new Date(1979, 8, 6);
      const opened = S.opened[doc.id];
      return `<div class="envelope${opened ? ' open' : ''}" data-doc="${doc.id}">
        <button class="env-front" data-act="open-env" aria-label="Buka amplop">
          <span class="env-stamp">${svg.stamp({ title: 'Republik', sub: 'Pos', motif: 'wave', palette: 'rust', value: stampValue(d.getFullYear()), year: String(d.getFullYear()) })}</span>
          <span class="env-pm"><b>PAKABARAN</b><i>${jw.postmark(d)}</i></span>
          <span class="env-to">Kang Kasan<br><span>Laut</span></span>
          <span class="env-cta">Ketuk untuk membuka amplop</span>
        </button>
        <div class="letter">${LE.md.render(md)}</div>
      </div>`;
    }
    if (skinName === 'tape' || skinName === 'tape-phone') return tapeHTML(doc.id, md);
    if (skinName === 'photo') {
      const blocks = LE.md.parse(md);
      const back = blocks.filter((b) => b.t === 'quote').map((b) => LE.md.render(b.lines.join('\n'))).join('');
      const rest = blocks.filter((b) => b.t !== 'quote');
      const first = rest.shift();
      return `${LE.md.blocks(first ? [first] : [])}
        <div class="flip" data-act="flip" role="button" tabindex="0" aria-label="Balik foto">
          <div class="flip-in"><div class="face front">${svg.photo()}<span class="flip-hint">Ketuk untuk membalik foto</span></div>
          <div class="face back"><div class="back-ink">${back}</div><span class="flip-hint">Balik lagi</span></div></div>
        </div>${LE.md.blocks(rest)}`;
    }
    if (skinName === 'map') {
      return `${LE.md.render(md.split('\n').filter((l) => !l.startsWith('- ')).join('\n'))}
        <div class="map-wrap">${svg.map()}</div>
        <ol class="map-list">${md.split('\n').filter((l) => l.startsWith('- ')).map((l, i) => `<li data-pin="${i}">${LE.md.inline(l.slice(2))}</li>`).join('')}</ol>`;
    }
    if (skinName === 'sketch') return `<div class="sketch-wrap">${svg.sketch()}</div>${LE.md.render(md)}`;
    if (skinName === 'stampcard') {
      return `<div class="kenal-stamp">${kenalStamp(doc.id)}</div>${LE.md.render(md)}`;
    }
    if (skinName === 'cover') {
      const blocks = LE.md.parse(md);
      const hr = blocks.findIndex((b) => b.t === 'hr');
      const head = blocks.slice(0, hr), tail = blocks.slice(hr + 1);
      const note = head.filter((b) => b.t === 'p' && /^&#91;/.test(b.raw));
      const title = head.filter((b) => !(b.t === 'p' && /^&#91;/.test(b.raw)));
      return LE.md.blocks(note) + `<div class="hardcover">${title.map((b) => `<p>${LE.md.inline(b.raw)}</p>`).join('')}</div><div class="abstract">${LE.md.blocks(tail)}</div>`;
    }
    return LE.md.render(md);
  }

  function tapeHTML(id, md) {
    const t = C.TAPE[id] || { style: 'phone', label: id };
    const deck = t.style === 'cassette'
      ? `<div class="cassette"><div class="cs-label"><b>${esc(t.label)}</b><span>${esc(t.brand || '')}</span></div><div class="cs-win"><span class="reel l"></span><span class="reel r"></span></div></div>`
      : `<div class="phone-rec"><div class="pr-label">${svg.icon('voice')}<b>${esc(t.label)}</b><span>${esc(t.length || '')}</span></div><div class="pr-wave">${Array.from({ length: 48 }, (_, i) => `<i style="--h:${(20 + Math.abs(Math.sin(i * 1.7 + id.length)) * 80).toFixed(0)}%"></i>`).join('')}</div></div>`;
    return `<div class="tape tape-${t.style}" data-tape="${id}">
      ${deck}
      <div class="tape-ctl"><button class="play" data-act="tape-play" aria-label="Putar">${svg.icon('play')}</button>
        <div class="tape-meta"><span class="counter">00:00</span><div class="prog"><i></i></div></div>
        <span class="tape-hint">Ketuk baris untuk melompat</span></div>
    </div>
    <div class="transcript" data-for="${id}">${LE.md.render(md, { tape: true })}</div>`;
  }

  function viewDoc(id) {
    const doc = docById(id);
    if (!doc || doc.locked) return viewNotFound();
    if (doc.berkas.id === 'IX') { location.hash = '#/nyewu/kabar'; return ''; }
    if (!berkasUnlocked(doc.bi)) {
      return `${topbar(`<a class="ibtn" href="#/nyewu" aria-label="Kembali">${svg.icon('back')}</a>`, `<span class="tb-code">${esc(id)}</span>`, soundBtn())}
        <main class="dash"><div class="locked-card">${svg.icon('lock')}<h2>Berkas ${esc(doc.berkas.id)} masih terkunci</h2><p>Arsip ini dibaca berurutan. Selesaikan berkas sebelumnya sampai dokumen terakhirnya.</p><a class="btn" href="#/nyewu">Kembali ke arsip</a></div></main>${dock('arsip')}`;
    }
    const first = markRead(doc);
    const [skinName, label, ic] = C.skin(id);
    const at = new Date(S.read[id]);
    const words = (doc.md || '').split(/\s+/).length;
    const idx = readableDocs.indexOf(doc);
    const prev = readableDocs[idx - 1], next = readableDocs[idx + 1];
    const nextOk = next && (berkasUnlocked(next.bi) || next.berkas.id === doc.berkas.id || next.bi === doc.bi + 1);
    return `${topbar(`<a class="ibtn" href="#/nyewu" data-back="${id}" aria-label="Kembali">${svg.icon('back')}</a>`, `<span class="tb-code">${esc(id)}</span>`, soundBtn())}
      <main class="doc-page">
        <header class="doc-head">
          <span class="tl-chip">BERKAS ${esc(doc.berkas.id)} · ${esc(doc.berkas.title.toUpperCase())}</span>
          <h1>${LE.md.inline(doc.title)}</h1>
          <div class="doc-meta">${svg.icon(ic)}<span>${esc(label)}</span><span>·</span><span>${Math.max(1, Math.round(words / 200))} menit baca</span></div>
          <div class="read-pm${first ? ' fresh' : ''}" aria-label="Terbaca"><b>TERBACA</b><span>${esc(jw.labelJw(at))}</span><i>${jw.postmark(at)}</i></div>
        </header>
        <article class="doc skin-${skinName}" data-doc="${id}">${renderBody(doc, skinName)}</article>
        <nav class="doc-nav">
          ${prev ? `<a href="#/nyewu/d/${prev.id}" class="dn prev">${svg.icon('back')}<span><small>${esc(prev.id)}</small>${LE.md.inline(prev.title)}</span></a>` : '<span></span>'}
          ${next && next.berkas.id !== 'IX' && nextOk ? `<a href="#/nyewu/d/${next.id}" class="dn next"><span><small>${esc(next.id)}</small>${LE.md.inline(next.title)}</span>${svg.icon('next')}</a>`
            : next && next.berkas.id === 'IX' && kabarUnlocked() ? `<a href="#/nyewu/kabar" class="dn next"><span><small>Berkas IX</small>Kabar</span>${svg.icon('next')}</a>` : '<span></span>'}
        </nav>
        ${believeSwitch()}
      </main>${dock('arsip')}`;
  }

  // ---------- desk ----------
  function viewDesk(tab = 'kerja') {
    const tabs = [['kerja', 'Daftar kerja'], ['papan', 'Papan 41'], ['kalender', 'Kalender'], ['catatan', 'Catatan']];
    let body = '';
    if (tab === 'kerja') {
      body = `<h3 class="mono-h">Bekal</h3><ul class="checks">${C.BEKAL.map(([k, t, why]) => `
        <li><label><input type="checkbox" data-act="bekal" data-k="${k}" ${S.bekal[k] ? 'checked' : ''}><span class="cb"></span><span>${esc(t)}</span></label>
        <details><summary>Kenapa ini?</summary><p>${esc(why)}</p></details></li>`).join('')}</ul>
        <h3 class="mono-h">Tugas</h3><ul class="checks auto">${C.TUGAS.map(([id, t]) => {
          const ok = id === '@sent' ? S.sent : !!S.read[id];
          return `<li class="${ok ? 'ok' : ''}"><span class="cb">${ok ? svg.icon('check') : ''}</span><span>${esc(t)}${id[0] !== '@' ? ` <a href="#/nyewu/d/${id}" class="ref">${esc(id)}</a>` : ''}</span></li>`;
        }).join('')}</ul>`;
    } else if (tab === 'papan') {
      if (!S.read['I-02'] && !UNLOCK_ALL) body = `<div class="locked-card">${svg.icon('lock')}<h2>Papan masih kosong</h2><p>Nama-namanya ada di laporan syahbandar. Baca I-02 dulu.</p><a class="btn" href="#/nyewu/d/I-02">Buka I-02</a></div>`;
      else {
        const table = LE.md.parse(docById('I-02').md).find((b) => b.t === 'table');
        const rows = table.rows.slice(1);
        const cnt = { menunggu: 0, sampai: 0 };
        rows.forEach((r) => { const s = S.board[r[0]]; if (s) cnt[s]++; });
        body = `<p class="desk-note">Ketuk status untuk berganti: <b>?</b> → <b>menunggu</b> → <b>sampai</b>. Papan ini hanya untuk Anda; tidak diperiksa siapa pun.</p>
          <div class="board-sum"><span>Menunggu <b>${cnt.menunggu}</b></span><span>Sampai <b>${cnt.sampai}</b></span><span>Belum <b>${rows.length - cnt.menunggu - cnt.sampai}</b></span></div>
          <div class="board">${rows.map((r) => {
            const s = S.board[r[0]] || '';
            return `<button class="brow ${s}" data-act="board" data-n="${esc(r[0])}"><span class="bn">${esc(r[0])}</span><span class="bname">${esc(r[1])}</span><span class="bmeta">${esc(r[2])} · ${esc(r[4])}</span><span class="bs">${s || '?'}</span></button>`;
          }).join('')}</div>
          <h3 class="mono-h">Yang ikut mendayung</h3>
          <p class="desk-note">Kalau Anda menemukan nama di luar daftar syahbandar, catat di sini.</p>
          <form class="extra" data-act="extra"><input name="x" placeholder="Nama…" autocomplete="off"><button class="btn sm">Tambah</button></form>
          <div class="extra-list">${S.extra.map((x, i) => `<span class="xchip">${esc(x)}<button data-act="extra-del" data-i="${i}" aria-label="Hapus">×</button></span>`).join('')}</div>`;
      }
    } else if (tab === 'kalender') {
      const today = LE.now();
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      body = `<p class="desk-note">Penanggalan Jawa: tujuh hari dan lima pasaran. Malam Jumat Kliwon datang setiap 35 hari.</p>
        <div class="cal-card"><label>Tanggal<input type="date" data-act="cal" value="${iso(today)}" min="1880-01-01" max="2100-12-31"></label><div class="cal-out" id="cal-out">${esc(jw.label(today))}</div></div>
        <div class="cal-card"><label>Malam Jumat Kliwon pertama sesudah 8 Februari, tahun<input type="number" data-act="cal-year" value="1987" min="1880" max="2100"></label><div class="cal-out" id="cal-year-out"></div></div>
        <div class="cal-card"><span class="lbl">Hari ini</span><div class="cal-out">${esc(jw.fmt(today))} · ${esc(jw.pasaran(today))}</div></div>`;
    } else {
      body = `<p class="desk-note">Tersimpan di peramban ini saja.</p><textarea class="notes" data-act="notes" placeholder="Nama, umur, tanggal lahir anak-anak…">${esc(S.notes)}</textarea>`;
    }
    return `${topbar(`<a class="ibtn" href="#/nyewu" aria-label="Kembali">${svg.icon('back')}</a>`, '<span class="tb-code">Meja Penyidik</span>', soundBtn())}
      <main class="desk">
        <header class="desk-head"><h1>Meja Penyidik</h1><p>Clear the noise. Count the children.</p></header>
        <div class="tabs">${tabs.map(([k, t]) => `<a href="#/nyewu/meja/${k}" class="${k === tab ? 'on' : ''}">${t}</a>`).join('')}</div>
        <div class="desk-body">${body}</div>
      </main>${dock('meja')}`;
  }

  // ---------- album ----------
  function viewAlbum() {
    const placed = decodePlaced();
    const items = [];
    D.berkas.forEach((b) => {
      const got = b.id === 'IX' ? S.sent : !!S.berkasStamp[b.id];
      items.push({ key: 'b:' + b.id, got, group: 'berkas', html: got ? berkasStamp(b) : svg.blankStamp(b.id), name: `Berkas ${b.id} · ${b.title}`, desc: got ? `Dicap ${b.id === 'IX' ? 'saat kabar dikirim' : jw.fmt(new Date(S.berkasStamp[b.id]))}.` : 'Belum dicap. Baca seluruh dokumen berkas ini.' });
    });
    Object.keys(C.KENAL).forEach((id, i) => {
      const got = !!S.kenal[id];
      items.push({ key: 'k:' + id, got, group: 'kenal', html: got ? kenalStamp(id) : svg.blankStamp(String(i + 1)), name: got ? C.KENAL[id][0] : '—', desc: got ? `${C.KENAL[id][1]} · ${C.KENAL[id][2]}. <a href="#/nyewu/d/${id}">Baca kartu ${id}</a>` : 'Kartu kenal belum dibaca.' });
    });
    if (kabarUnlocked()) {
      for (let i = 0; i < D.total; i++) {
        const p = placed.find((x) => x.i === i);
        items.push({ key: 'x:' + i, got: !!p, group: 'kabar', html: p ? kabarStamp(p, S.recited[i]) : svg.blankStamp(''), name: p ? p.name : 'Belum ditempel', desc: p ? `“${esc(p.q)}”` : 'Slot kosong di amplop beralamat Laut.' });
      }
    }
    const feat = items.find((x) => x.key === S.featured && x.got) || items.filter((x) => x.got).pop();
    const group = (g, title, sub) => {
      const list = items.filter((x) => x.group === g);
      return `<h3 class="al-h">${title} <span>${list.filter((x) => x.got).length}/${list.length}</span></h3><p class="al-sub">${sub}</p>
        <div class="al-grid">${list.map((x) => `<button class="al-item${x.got ? '' : ' empty'}${feat && feat.key === x.key ? ' on' : ''}" data-act="feature" data-k="${x.key}" ${x.got ? '' : 'disabled'} aria-label="${esc(x.name)}">${x.html}</button>`).join('')}</div>`;
    };
    return `${topbar(`<a class="ibtn" href="#/nyewu" aria-label="Kembali">${svg.icon('back')}</a>`, '<span class="tb-code">Buku Perangko</span>', soundBtn())}
      <main class="album">
        <section class="al-feature">${feat ? `<div class="al-big">${feat.html}</div><div class="al-cap"><h2>${esc(feat.name)}</h2><p>${feat.desc}</p></div>`
          : `<div class="al-big">${svg.blankStamp('?')}</div><div class="al-cap"><h2>Belum ada perangko</h2><p>Perangko pertama didapat setelah satu berkas selesai dibaca.</p></div>`}</section>
        ${group('berkas', 'Perangko Berkas', 'Dicap setiap kali satu berkas selesai dibaca.')}
        ${group('kenal', 'Kartu Kenal', 'Nama, wajah atau suara, dan satu kebiasaan. Tiga syarat untuk mengenal seseorang.')}
        ${kabarUnlocked() ? group('kabar', 'Perangko Kabar', 'Untuk amplop beralamat Laut. Ditulis tangan oleh Anda.') : ''}
        <section class="why"><h3>Kenapa perangko?</h3>
          <p>Di Pakabaran, perangko pernah menjadi jangkar. Sumi menempelkannya setiap Kamis selama dua puluh sembilan tahun, pada amplop beralamat <i>Laut</i>, dan suratnya menahan Kasan di perahu.</p>
          <p>Di sini perangko bekerja ke arah sebaliknya. Setiap perangko berkas adalah cap bahwa Anda sudah membaca. Setiap kartu kenal adalah tanda bahwa Anda sudah mengenal. Dan di Berkas IX, perangko yang Anda tulis sendiri adalah kabar: surat terakhir ke alamat yang sama, kali ini untuk melepaskan.</p></section>
      </main>${dock('perangko')}`;
  }

  // ---------- kabar ----------
  const REPLY = {
    sampai: 'Dia sudah sampai.', tidur: 'Dia sudah tidur.', tahu: 'Dia sudah tahu.', sini: 'Dia masih di sini.',
    darat: 'Dia masih di darat.', jo: 'Ada empat Jo di arsip ini. Yang mana?', dup: 'Nama ini sudah ditempel.',
    none: 'Laut tidak menyimpan nama itu.', believe: 'Kamu tidak bisa lagi mengabari.',
  };
  function tryName(raw) {
    if (S.believe) return { code: 'believe' };
    const cands = LE.crypt.candidates(raw);
    for (const k of cands) {
      for (const blob of answerMap[LE.crypt.hash('nyewu:', k)] || []) {
        const t = LE.crypt.open(blob, k);
        if (!t) continue;
        const p = JSON.parse(t);
        if (decodePlaced().some((x) => x.i === p.i)) return { code: 'dup' };
        S.placed.push({ k, i: p.i }); save();
        return { ok: true, p };
      }
    }
    for (const k of cands) { const w = D.wrong[LE.crypt.hash('nyewu:', k)]; if (w) return { code: w }; }
    return { code: 'none' };
  }

  function tembangLines() {
    const blocks = LE.md.parse(docById('IX-02').md).filter((b) => b.t === 'quote');
    const jv = LE.md.parse(blocks[0].lines.join('\n')).filter((b) => b.t === 'p').map((b) => (b.raw.match(/\*[^*]+\*/g) || []).map((x) => x.slice(1, -1).trim()));
    const tr = blocks[1] ? LE.md.parse(blocks[1].lines.join('\n')).filter((b) => b.t === 'p').map((b) => b.raw) : [];
    return jv.map((lines, i) => ({ lines, tr: tr[i] || '' }));
  }

  function viewKabar() {
    const back = `<a class="ibtn" href="#/nyewu" aria-label="Kembali">${svg.icon('back')}</a>`;
    if (!kabarUnlocked()) {
      return `${topbar(back, '<span class="tb-code">Berkas IX</span>', soundBtn())}
        <main class="dash"><div class="locked-card big">${svg.stamp({ title: 'Kabar', sub: 'Berkas IX · terkunci', motif: 'key', palette: 'night', year: '2027' })}
        <h2>Berkas IX terkunci</h2><p>Berkas ini terbuka setelah Anda membaca VIII-20.</p><p class="muted">Bacalah berurutan. Ini cuma cerita.</p><a class="btn" href="#/nyewu">Kembali ke arsip</a></div></main>${dock('kabar')}`;
    }
    ['IX-01', 'IX-02'].forEach((id) => { if (!S.read[id]) { S.read[id] = new Date().toISOString(); } });
    save();
    const placed = decodePlaced();
    const full = placed.length === D.total;
    const recitedN = placed.filter((p) => S.recited[p.i]).length;
    const allRecited = full && recitedN === D.total;
    const slots = Array.from({ length: D.total }, (_, i) => {
      const p = placed[i];
      return p ? `<button class="slot filled${S.recited[p.i] ? ' said' : ''}" data-act="slot" data-i="${p.i}" aria-label="${esc(p.name)}">${kabarStamp(p, S.recited[p.i])}</button>`
        : `<span class="slot">${svg.blankStamp(String(i + 1))}</span>`;
    }).join('');
    const stanzas = tembangLines();
    const lineCount = stanzas.reduce((n, s) => n + s.lines.length, 0);
    const shown = Math.min(S.tembangLine || 0, lineCount);
    let li = 0;
    const tembang = stanzas.map((s) => `<div class="stanza">${s.lines.map((l) => { const on = li++ < shown; return `<p class="tl-line${on ? ' on' : ''}">${esc(l)}</p>`; }).join('')}${li <= shown ? `<p class="tl-tr">${esc(s.tr)}</p>` : ''}</div>`).join('');

    let step;
    if (!full) step = 1; else if (!allRecited) step = 2; else if (!S.tembang) step = 3; else step = 4;
    return `${topbar(back, '<span class="tb-code">Berkas IX · Kabar</span>', soundBtn())}
      <main class="kabar">
        <article class="doc skin-ritual">
          <header class="doc-head"><span class="tl-chip">IX-01</span><h1>Tata Cara</h1></header>
          ${LE.md.render(docById('IX-01').md)}
        </article>
        <section class="env-form${S.believe ? ' blocked' : ''}" id="envform">
          <ol class="steps">${['Tulis nama', 'Ucapkan', 'Tembang', 'Kabari'].map((t, i) => `<li class="${step > i + 1 ? 'done' : step === i + 1 ? 'on' : ''}"><span>${i + 1}</span>${t}</li>`).join('')}</ol>
          <div class="big-env${S.sent ? ' sent' : ''}">
            <div class="be-head"><div class="be-to"><small>Kepada</small><b>Laut</b><span>Pakabaran, Nusa Sewu · yang masih mendayung</span></div>
              <div class="be-pm"><b>PAKABARAN</b><i>${jw.postmark(LE.now())}</i></div></div>
            <div class="slots">${slots}</div>
            <div class="be-from">Pengirim: seorang pembaca yang tidak percaya</div>
            ${S.sent ? '<div class="be-cancel">WIS YA</div>' : ''}
          </div>
          ${step === 1 ? `<form class="namebar" data-act="name"><input name="n" placeholder="Tulis satu nama, lalu tempel…" autocomplete="off" autocapitalize="words" ${S.believe ? 'disabled' : ''}><button class="btn">Tempel</button></form>
            <div class="reply" id="reply" aria-live="polite"></div>
            <p class="count"><b>${placed.length}</b> dari ${D.total} perangko · ketuk perangko untuk melepasnya</p>` : ''}
          ${step === 2 ? `<p class="instr">Ketuk setiap perangko. Ucapkan namanya dengan suara biasa, seperti anak kecil memanggil teman bermain. <b>${recitedN}/${D.total}</b></p>` : ''}
          ${step >= 3 ? `<div class="tembang"><h3>Tembang Bocah Pesisir</h3>${tembang}
            ${step === 3 ? `<button class="btn ghost" data-act="tembang-next">${shown === 0 ? 'Mulai membaca' : 'Baris berikutnya'}</button>` : ''}</div>` : ''}
          <button class="kabari${step === 4 && !S.sent ? ' ready' : ''}" data-act="kabari">${S.sent ? 'Dengarkan rekaman terakhir' : 'Kabari'}</button>
          ${S.believe ? `<div class="block-msg">${svg.icon('eye')}<b>${REPLY.believe}</b><button class="linkbtn" data-act="unbelieve">Ini cuma cerita.</button></div>` : ''}
        </section>
        ${believeSwitch()}
      </main>${dock('kabar')}`;
  }

  function reciteSheet(i) {
    const p = decodePlaced().find((x) => x.i === i);
    if (!p) return;
    const step1 = decodePlaced().length < D.total;
    sheet(`<div class="recite">
      <div class="rc-stamp" id="rc-stamp">${kabarStamp(p, S.recited[i])}</div>
      <h2>${esc(p.name)}</h2>
      <p class="rc-q">“${esc(p.q)}”</p>
      ${step1 ? `<button class="btn ghost" data-act="unplace" data-i="${i}">Lepas perangko ini</button>`
        : S.recited[i] ? '<p class="muted">Sudah diucapkan.</p>' : `<button class="btn say" data-act="say" data-i="${i}"><span>Segara wis nyimpen jenengmu. Wis ya.</span><small>Laut sudah menyimpan namamu. Sudah ya.</small></button>`}
    </div>`, 'sheet-recite');
  }

  function viewRekaman() {
    const placed = decodePlaced();
    if (placed.length !== D.total || !S.sent) { location.hash = '#/nyewu/kabar'; return ''; }
    const key = masterKey(placed);
    const ix03 = LE.crypt.open(D.locked['IX-03'], key);
    const now = LE.now();
    const after = now >= new Date(2027, 1, 12);
    let last;
    if (after) {
      const ix04 = LE.crypt.open(D.locked['IX-04'], key);
      last = `<article class="doc skin-journal"><header class="doc-head"><span class="tl-chip">IX-04</span><h1>${esc(docById('IX-04').title)}</h1></header>${LE.md.render(ix04 || '')}</article>`;
      if (!S.door) { S.door = true; save(); }
    } else {
      const days = Math.max(0, jw.daysUntil(C.windu, now));
      last = `<article class="doc skin-blank"><header class="doc-head"><span class="tl-chip">IX-05</span><h1>Halaman yang Belum Ditulis</h1></header>${LE.md.render(D.ix05.before.replace('\\[X\\]', String(days)))}</article>`;
    }
    return `${topbar(`<a class="ibtn" href="#/nyewu/kabar" aria-label="Kembali">${svg.icon('back')}</a>`, '<span class="tb-code">IX-03</span>', soundBtn())}
      <main class="doc-page">
        <header class="doc-head"><span class="tl-chip">BERKAS IX · KABAR</span><h1>${esc(docById('IX-03').title)}</h1>
          <div class="doc-meta">${svg.icon('voice')}<span>Rekaman terakhir</span></div></header>
        <article class="doc skin-tape-phone">${tapeHTML('IX-03', ix03 || '')}</article>
        ${last}
      </main>${dock('kabar')}`;
  }

  function viewNotFound() {
    return `${topbar(`<a class="ibtn" href="#/nyewu" aria-label="Kembali">${svg.icon('back')}</a>`, '', '')}<main class="dash"><div class="locked-card"><h2>Dokumen tidak ditemukan</h2><p>Mungkin laut menyimpannya.</p><a class="btn" href="#/nyewu">Kembali ke arsip</a></div></main>`;
  }

  // =====================================================================
  // TAPE PLAYER
  // =====================================================================
  let tape = null;
  function stopTape() {
    if (!tape) return;
    clearTimeout(tape.timer); LE.audio.stopHiss(); LE.audio.stopOars();
    tape.root.classList.remove('playing');
    const b = $('[data-act="tape-play"]', tape.root); if (b) b.innerHTML = svg.icon('play');
    tape = null;
  }
  function playTape(root, from) {
    stopTape();
    const id = root.dataset.tape;
    const cues = $$(`.transcript[data-for="${id}"] .cue`);
    if (!cues.length) return;
    tape = { root, cues, i: from ?? cues.findIndex((c) => !c.classList.contains('done')), timer: null };
    if (tape.i < 0) tape.i = 0;
    root.classList.add('playing');
    $('[data-act="tape-play"]', root).innerHTML = svg.icon('pause');
    LE.audio.boot();
    LE.audio.startHiss(root.classList.contains('tape-cassette') ? 0.04 : 0.015);
    step();
  }
  function step() {
    if (!tape) return;
    const { cues, root } = tape;
    if (tape.i >= cues.length) {
      const id = root.dataset.tape;
      stopTape();
      if (id === 'IX-03') toast('Untuk pertama kalinya sejak 8 Februari 1979, tidak ada bunyi dayung.', { ms: 6000 });
      return;
    }
    cues.forEach((c, j) => { c.classList.toggle('on', j === tape.i); c.classList.toggle('done', j < tape.i); });
    const c = cues[tape.i];
    const r = c.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 120) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = (c.dataset.text || '').toLowerCase();
    let dur = Math.min(7200, Math.max(1700, (+c.dataset.len || 40) * 42));
    if (c.classList.contains('sfx')) dur = Math.max(dur, 2400);
    if (/sembilan detik/.test(t)) { LE.audio.burstStatic(9); dur = 9000; }
    if (/dayung berhenti|menjauh|statis normal|rekaman berakhir|mesin menyala|tidak ada bunyi dayung|\[hening/.test(t)) LE.audio.stopOars();
    else if (/dayung/.test(t) && /\[/.test(t)) LE.audio.startOars(0.28);
    const tc = $('.cue-t', c).textContent.trim();
    $('.counter', root).textContent = tc || $('.counter', root).textContent;
    $('.prog i', root).style.width = ((tape.i + 1) / cues.length * 100) + '%';
    tape.timer = setTimeout(() => { if (tape) { tape.i++; step(); } }, dur);
  }

  // =====================================================================
  // ROUTER
  // =====================================================================
  let lastRoute = '';
  function route() {
    stopTape();
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);
    let html = '';
    let view = 'home';
    if (!parts.length) html = viewHome();
    else if (parts[0] === 'nyewu') {
      if (!S.accepted) { html = viewCover(); view = 'cover'; } else if (!parts[1]) { html = viewDashboard(); view = 'dash'; } else if (parts[1] === 'd') { html = viewDoc(decodeURIComponent(parts[2] || '')); view = 'doc'; } else if (parts[1] === 'meja') { html = viewDesk(parts[2]); view = 'desk'; } else if (parts[1] === 'perangko') { html = viewAlbum(); view = 'album'; } else if (parts[1] === 'kabar') { html = viewKabar(); view = 'kabar'; } else if (parts[1] === 'rekaman') { html = viewRekaman(); view = 'rekaman'; } else html = viewNotFound();
    } else html = viewHome();
    if (!html) return;
    const same = lastRoute === h;
    const y = scrollY;
    app.innerHTML = html;
    document.body.dataset.view = view;
    if (same) scrollTo(0, y);
    else if (view === 'dash' && sessionStorageGet('le.back')) {
      const el = document.getElementById('row-' + sessionStorageGet('le.back'));
      if (el) el.scrollIntoView({ block: 'center' });
      sessionStorageSet('le.back', '');
    } else scrollTo(0, 0);
    lastRoute = h;
    afterMount(view);
  }
  const sessionStorageGet = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const sessionStorageSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* */ } };

  function afterMount(view) {
    if (view === 'desk') {
      const cy = $('[data-act="cal-year"]');
      if (cy) updateYear(cy.value);
    }
    if (view === 'doc') {
      const pm = $('.read-pm.fresh');
      if (pm) setTimeout(() => LE.audio.thud(), 380);
    }
  }
  function updateYear(y) {
    const out = $('#cal-year-out');
    if (!out) return;
    y = +y;
    if (!(y >= 1880 && y <= 2100)) { out.textContent = '—'; return; }
    const d = jw.firstAfterStorm(y);
    out.textContent = d ? `${jw.fmt(d)} (malamnya: malam ${jw.label(jw.addDays(d, 1))})` : '—';
  }

  // =====================================================================
  // EVENTS
  // =====================================================================
  document.addEventListener('click', (e) => {
    const back = e.target.closest('[data-back]');
    if (back) sessionStorageSet('le.back', back.dataset.back);
    const lockedDock = e.target.closest('.dk[data-locked]');
    if (lockedDock) { e.preventDefault(); toast('Berkas IX terbuka setelah VIII-20.'); return; }
    const el = e.target.closest('[data-act]');
    if (!el) {
      const cue = e.target.closest('.cue');
      if (cue) {
        const tr = cue.closest('.transcript');
        const root = $(`.tape[data-tape="${tr.dataset.for}"]`);
        const cues = $$('.cue', tr);
        playTape(root, cues.indexOf(cue));
      }
      const pin = e.target.closest('.map-pin, .map-list li');
      if (pin) highlightPin(pin.dataset.pin);
      return;
    }
    const act = el.dataset.act;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'FORM') return;
    e.preventDefault();
    switch (act) {
      case 'sound': LE.audio.setMuted(!LE.audio.muted); el.outerHTML = soundBtn(); break;
      case 'hints': hintsSheet(); break;
      case 'more-hint': S.hintsShown = Math.min(C.HINTS.length, (S.hintsShown || 1) + 1); save(); hintsSheet(); break;
      case 'close-sheet': closeSheet(); break;
      case 'demo': {
        LE.audio.boot();
        const kind = el.dataset.demo;
        el.closest('.mini-audio').classList.add('playing');
        if (kind === 'oars') { LE.audio.startOars(0.3); setTimeout(() => { LE.audio.stopOars(); el.closest('.mini-audio').classList.remove('playing'); }, 8200); }
        else { LE.audio.startHiss(0.05); setTimeout(() => { LE.audio.stopHiss(); el.closest('.mini-audio').classList.remove('playing'); }, 4000); toast('Kaset pernikahan, Oktober 1978. Suaranya ada di III-02.'); }
        break;
      }
      case 'cover-help':
        sheet(`<h2 class="sh-title">Apa yang Anda ambil?</h2>
          <p>Sebuah arsip: ${readableDocs.length} dokumen dalam sepuluh berkas, disusun oleh seorang korektor naskah tentang empat puluh satu nelayan yang tidak pulang.</p>
          <ul class="dash-list"><li>Bacalah berurutan. Berkas berikutnya terbuka setelah dokumen terakhir berkas sebelumnya.</li><li>Perangko dicap setiap kali satu berkas selesai.</li><li>Meja Penyidik menyimpan catatan, papan nama, dan kalender pasaran.</li><li>Berkas IX terkunci. Kuncinya adalah daftar nama.</li></ul>
          <p class="muted">Kemajuan Anda tersimpan di peramban ini. Satu syarat: bacalah seperti membaca dongeng.</p>`);
        break;
      case 'accept':
        S.accepted = true; save(); LE.audio.thud();
        document.body.classList.add('accepting');
        setTimeout(() => { document.body.classList.remove('accepting'); route(); toast('Perkara diterima. Mulailah dari 0-01.'); }, 650);
        break;
      case 'open-env': {
        const env = el.closest('.envelope');
        env.classList.add('open'); S.opened[env.dataset.doc] = true; save(); LE.audio.thud();
        break;
      }
      case 'flip': el.classList.toggle('flipped'); break;
      case 'tape-play': {
        const root = el.closest('.tape');
        if (tape && tape.root === root) stopTape(); else playTape(root);
        break;
      }
      case 'believe': break;
      case 'unbelieve': setBelieve(false); break;
      case 'board': {
        const n = el.dataset.n; const cur = S.board[n] || '';
        S.board[n] = cur === '' ? 'menunggu' : cur === 'menunggu' ? 'sampai' : '';
        save(); route();
        break;
      }
      case 'extra-del': S.extra.splice(+el.dataset.i, 1); save(); route(); break;
      case 'feature': S.featured = el.dataset.k; save(); route(); scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'slot': reciteSheet(+el.dataset.i); break;
      case 'unplace': S.placed = S.placed.filter((p) => p.i !== +el.dataset.i); delete S.recited[el.dataset.i]; save(); closeSheet(); route(); break;
      case 'say': {
        const i = +el.dataset.i;
        S.recited[i] = true; save(); LE.audio.thud();
        const p = decodePlaced().find((x) => x.i === i);
        $('#rc-stamp').innerHTML = kabarStamp(p, true);
        $('#rc-stamp').classList.add('stamped');
        el.outerHTML = '<p class="said-line">Wis ya.</p>';
        setTimeout(() => { closeSheet(); route(); }, 1300);
        break;
      }
      case 'tembang-next': {
        S.tembangLine = (S.tembangLine || 0) + 1;
        const total = tembangLines().reduce((n, s) => n + s.lines.length, 0);
        if (S.tembangLine >= total) { S.tembang = true; }
        save(); route();
        break;
      }
      case 'kabari': {
        if (S.sent) { location.hash = '#/nyewu/rekaman'; break; }
        if (S.believe) { toast(REPLY.believe); break; }
        const placed = decodePlaced();
        if (placed.length < D.total) {
          sheet(`<div class="ix05">${LE.md.render(D.ix05.incomplete)}</div>`, 'sheet-dark');
          break;
        }
        if (placed.some((p) => !S.recited[p.i])) { toast('Ucapkan dulu setiap nama. Ketuk perangkonya satu per satu.'); break; }
        if (!S.tembang) { toast('Bacalah tembangnya sampai selesai.'); break; }
        S.sent = true; S.featured = 'b:IX'; save();
        LE.audio.thud();
        $('.big-env').classList.add('sending');
        setTimeout(() => { location.hash = '#/nyewu/rekaman'; }, 1400);
        break;
      }
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'believe') { setBelieve(el.checked); return; }
    if (el.dataset.act === 'bekal') { S.bekal[el.dataset.k] = el.checked; save(); return; }
    if (el.dataset.act === 'cal') {
      const d = new Date(el.value + 'T12:00:00');
      $('#cal-out').textContent = isNaN(d) ? '—' : `${jw.label(d)}${d.getDay() === 4 && jw.pasaran(jw.addDays(d, 1)) === 'Kliwon' ? ' · malamnya malam Jumat Kliwon' : ''}`;
    }
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.act === 'notes') { S.notes = el.value; save(); }
    if (el.dataset.act === 'cal-year') updateYear(el.value);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (f.dataset.act === 'extra') {
      e.preventDefault();
      const v = f.x.value.trim(); if (!v) return;
      S.extra.push(v); save(); route();
      setTimeout(() => { const i = $('.extra input'); if (i) i.focus(); }, 0);
    }
    if (f.dataset.act === 'name') {
      e.preventDefault();
      const v = f.n.value.trim(); if (!v) return;
      const r = tryName(v);
      if (r.ok) {
        LE.audio.thud();
        route();
        const input = $('.namebar input');
        const rep = $('#reply');
        if (rep) { rep.className = 'reply ok'; rep.textContent = `${r.p.name} — ditempel.`; }
        if (input) input.focus();
        const slots = $$('.slot.filled');
        const last = slots[slots.length - 1];
        if (last) last.classList.add('just');
      } else {
        const rep = $('#reply');
        rep.className = 'reply no';
        rep.innerHTML = `<span class="rubber">${esc(REPLY[r.code])}</span>`;
        f.n.select();
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act="flip"], .map-pin')) { e.preventDefault(); e.target.click(); }
  });

  function highlightPin(i) {
    $$('.map-pin, .map-list li').forEach((x) => x.classList.toggle('on', x.dataset.pin === String(i)));
    const li = $(`.map-list li[data-pin="${i}"]`);
    if (li) li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- boot ----------
  function boot() {
    const kliwon = LE.params.get('kliwon') === '1' || jw.isMalamJumatKliwon(LE.now());
    document.body.classList.toggle('kliwon', kliwon);
    document.body.classList.toggle('believe', !!S.believe);
    renderFootprints();
    if (kliwon) {
      const once = () => { if (!LE.audio.muted) { LE.audio.startSea(0.04); LE.audio.startOars(0.06); } document.removeEventListener('pointerdown', once); };
      document.addEventListener('pointerdown', once);
    }
    window.addEventListener('hashchange', route);
    route();
  }
  if (LE.params.get('reset') === '1') { LE.store.del(KEY); S = Object.assign({}, DEFAULTS); }
  boot();
})(window.LE);
