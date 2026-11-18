/* postmortem● — app: routing, screens, puzzle */
(function (LE) {
  const { $, $$, esc, svg, jw } = LE;
  const C = LE.cases.nyewu;
  const D = window.CASE_DATA.nyewu;
  const KEY = 'le.nyewu.v1';
  const DEFAULTS = {
    accepted: false, read: {}, opened: {}, berkasStamp: {}, kenal: {}, board: {}, extra: [], notes: '', bekal: {},
    placed: [], recited: {}, tembang: false, tembangLine: 0, sent: false, believe: false, hintsShown: 1, featured: null, coll: 'berkas',
  };
  if (LE.params.get('reset') === '1') LE.store.del(KEY);
  let S = Object.assign({}, DEFAULTS, LE.store.get(KEY, {}));
  const save = () => LE.store.set(KEY, S);
  const UNLOCK_ALL = LE.params.get('unlock') === 'all';

  const screen = $('#screen'), scroller = $('#scroller'), appEl = $('#app'), barEl = $('#bar');

  const CASES = [
    { no: '01', live: true },
    { no: '02', sealed: true, title: 'Case 02', lines: [[38, 70, 52], [62, 44], [80, 30, 56]] },
    { no: '03', sealed: true, title: 'Case 03', lines: [[54, 40], [70, 64, 28], [46, 58]] },
  ];
  let homeIdx = 0;

  // ---------- index ----------
  const DOCS = [];
  D.berkas.forEach((b, bi) => b.docs.forEach((d) => DOCS.push({ ...d, berkas: b, bi })));
  const docById = (id) => DOCS.find((d) => d.id === id);
  const readable = DOCS.filter((d) => !d.locked && d.berkas.id !== 'IX');
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
  const minutes = (md) => Math.max(1, Math.round((md || '').split(/\s+/).length / 200));
  const readCount = () => readable.filter((d) => S.read[d.id]).length;
  const stampCount = () => Object.keys(S.berkasStamp).length + (S.sent ? 1 : 0);
  const nextUnread = () => readable.find((d) => !S.read[d.id] && berkasUnlocked(d.bi));

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

  // ---------- stamps ----------
  const berkasStamp = (b) => svg.stamp({
    title: b.id === '0' ? 'Pengantar' : b.title, sub: `Berkas ${b.id} · ${C.BERKAS[b.id].years}`,
    motif: C.BERKAS[b.id].motif, palette: C.BERKAS[b.id].palette, value: 'Rp 50', year: (C.BERKAS[b.id].years.match(/\d{4}/) || [''])[0],
  });
  const kenalStamp = (id) => {
    const [name, habit, boat] = C.KENAL[id];
    const i = Object.keys(C.KENAL).indexOf(id);
    return svg.stamp({ title: name, sub: boat, initial: name[0], habit, palette: svg.ORDER[i % svg.ORDER.length], year: '1979' });
  };
  const kabarStamp = (p, postmarked) => svg.stamp({
    title: p.name, sub: p.year === 1979 ? 'Laut · 1979' : `Windu · ${p.year}`, initial: p.name[0], habit: p.habit,
    palette: p.year === 1979 ? svg.ORDER[p.i % svg.ORDER.length] : ['red', 'sand', 'ink', 'green', 'olive', 'slate', 'green'][p.i - 19],
    year: String(p.year), postmark: postmarked ? ['WIS YA', 'LAUT'] : null,
  });

  // ---------- overlays ----------
  function toast(html, opts = {}) {
    const t = document.createElement('div');
    t.className = 'toast';
    const lead = opts.stamp ? `<div class="toast-stamp">${opts.stamp}</div>` : `<div class="toast-ic">p</div>`;
    t.innerHTML = `${lead}<div>${html}</div>`;
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, opts.ms || 3400);
  }
  function sheet(html, cls = '') {
    closeSheet(true);
    const w = document.createElement('div');
    w.className = 'sheet-wrap';
    w.innerHTML = `<div class="sheet-bg" data-act="close-sheet"></div><div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
    screen.appendChild(w);
    requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('in')));
  }
  function closeSheet(now) {
    $$('.sheet-wrap').forEach((w) => { if (now) { w.remove(); return; } w.classList.remove('in'); setTimeout(() => w.remove(), 320); });
  }
  function hintsSheet() {
    const n = Math.max(1, Math.min(S.hintsShown, C.HINTS.length));
    sheet(`<h2 class="sh-title">Clues</h2><p class="sh-sub">One at a time, ya. Jangan buka semua kalau belum perlu.</p>
      <ul class="clues">${C.HINTS.slice(0, n).map((h, i) => `<li><span>${i + 1}</span>${esc(h)}</li>`).join('')}</ul>
      ${n < C.HINTS.length ? `<button class="cta" data-act="more-hint">Next clue · ${n}/${C.HINTS.length}</button>` : '<p class="sh-sub">That’s all. Sisanya ada di arsip.</p>'}`);
  }
  function briefSheet() {
    sheet(`<h2 class="sh-title">The brief</h2>
      <p class="sh-sub">Case 01 · Nyewu — arsip kabar duka yang belum sampai.</p>
      <ul class="brief-list">
        <li>${DOCS.length} dokumen, 10 berkas. Kliping, notulen, surat, kaset, chat, skripsi.</li>
        <li>Baca berurutan. Berkas berikutnya kebuka setelah dokumen terakhir berkas sebelumnya.</li>
        <li>Setiap berkas selesai = satu stamp. Setiap kartu kenal = satu stamp.</li>
        <li>Desk nyimpen catatan, board 41 nama, dan kalender pasaran.</li>
        <li>Berkas IX terkunci. The key is a list of names.</li>
      </ul>
      <p class="sh-sub">Progress tersimpan di browser ini. Satu syarat: read it like a fairytale.</p>
      <button class="cta yellow" data-act="accept">${S.accepted ? 'Open the case' : 'Take the case'}</button>`);
  }

  function setBelieve(on) {
    S.believe = on; save();
    document.body.classList.toggle('believe', on);
    renderFootprints();
    toast(on ? '<b>Sekarang kamu bisa melihat mereka.</b><br>Mereka juga bisa melihatmu.' : '<b>Ini cuma cerita.</b> Good.', { ms: on ? 5200 : 2400 });
    route(true);
  }
  function renderFootprints() {
    const box = $('#footprints');
    if (!S.believe) { box.innerHTML = ''; return; }
    let s = '';
    for (let i = 0; i < 14; i++) {
      const x = 50 + (i % 2 ? 4 : -4) + Math.sin(i / 2) * 6, y = 98 - i * 7.2;
      s += `<span class="fp" style="left:${x}%;top:${y}%;animation-delay:${i * 0.35}s;transform:rotate(${i % 2 ? 6 : -6}deg)"></span>`;
    }
    box.innerHTML = s;
  }

  function markRead(doc) {
    if (S.read[doc.id]) return false;
    S.read[doc.id] = new Date().toISOString();
    const b = doc.berkas;
    if (!S.berkasStamp[b.id] && b.id !== 'IX' && berkasDone(b)) {
      S.berkasStamp[b.id] = S.read[doc.id];
      S.featured = 'b:' + b.id; S.coll = 'berkas';
      setTimeout(() => { LE.audio.thud(); toast(`<small>New stamp</small><b>Berkas ${esc(b.id)} · ${esc(b.title)}</b>`, { stamp: berkasStamp(b), ms: 4400 }); }, 900);
    }
    if (C.KENAL[doc.id] && !S.kenal[doc.id]) {
      S.kenal[doc.id] = S.read[doc.id];
      S.featured = 'k:' + doc.id; S.coll = 'kenal';
      setTimeout(() => toast(`<small>Kartu kenal</small><b>${esc(C.KENAL[doc.id][0])}</b> masuk ke Stamps.`, { stamp: kenalStamp(doc.id), ms: 2800 }), 700);
    }
    save();
    return true;
  }

  // ---------- small parts ----------
  const back = (href, extra = '') => `<a class="sq" href="${href}" ${extra} aria-label="Back">${svg.icon('back')}</a>`;
  const clue = () => '<button class="pillbtn" data-act="hints">Clue <span class="q">?</span></button>';
  const soundSq = () => `<button class="sq" data-act="sound" aria-label="Sound">${svg.icon(LE.audio.muted ? 'mute' : 'sound')}</button>`;
  const dowShort = (d) => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  const chipDate = (d, y = true) => `${dowShort(d)} ${d.getDate()} ${jw.BULAN[d.getMonth()].slice(0, 3).toUpperCase()}${y ? ' ' + d.getFullYear() : ''}`;

  // =====================================================================
  // HOME — one viewport, swipe between cases
  // =====================================================================
  function slideLive(i) {
    const days = jw.daysUntil(C.windu, LE.now());
    const today = LE.now();
    return `<section class="slide" data-i="${i}"><div class="case-sheet">
      <div class="cs-top"><span class="wm">postmortem<i></i></span><span class="cs-count">${String(i + 1).padStart(2, '0')} / ${String(CASES.length).padStart(2, '0')}</span></div>
      <div class="cs-title"><h1>Nyewu</h1><span class="cs-no">01</span></div>
      <span class="chip-g">${chipDate(today, false)}</span>
      <div class="tl-it"><p>Today’s goal: kenali empat puluh satu nelayan, lalu hitung siapa yang belum pulang.</p></div>
      <span class="chip-g">THU 8 FEB 1979</span>
      <div class="tl-it"><p>“${esc(C.hook)}”</p>
        <div class="aud"><span class="av">K</span><span class="aud-pill"><button class="play-s" data-act="demo" data-demo="song" aria-label="Play">${svg.icon('play')}</button><span class="wv"></span><svg class="spk" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h4l5-4v14l-5-4H4z"/></svg></span><span class="t">00:34</span></div>
        <div class="aud"><span class="av alt">?</span><span class="aud-pill"><button class="play-s" data-act="demo" data-demo="oars" aria-label="Play">${svg.icon('play')}</button><span class="wv short"></span><svg class="spk" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h4l5-4v14l-5-4H4z"/></svg></span><span class="t">00:04</span></div>
      </div>
      <span class="chip-g">THU 11 FEB 2027</span>
      <div class="tl-it"><p>Windu keenam</p><span class="sub"><span class="spin"></span>${days > 0 ? `${days} days remaining` : days === 0 ? 'tonight' : 'already passed'}</span>
        <div class="pcard"><span class="pill">Read the archive · ±4 hrs</span><p>${DOCS.length} dokumen, 10 berkas, satu amplop kosong.</p></div>
      </div>
      <div class="fade"></div><div class="grabber"></div>
    </div></section>`;
  }
  function slideSealed(c, i) {
    const bar = (ws) => ws.map((w) => `<span class="redact" style="width:${w}%"></span>`).join('');
    return `<section class="slide sealed" data-i="${i}"><div class="case-sheet">
      <div class="cs-top"><span class="wm">postmortem<i></i></span><span class="cs-count">${String(i + 1).padStart(2, '0')} / ${String(CASES.length).padStart(2, '0')}</span></div>
      <div class="cs-title"><h1>${esc(c.title)}</h1><span class="cs-no">${c.no}</span></div>
      <div class="stamp-seal">${svg.stamp({ title: 'Sealed', sub: `Case ${c.no} · belum dikirim`, motif: 'envelope', palette: 'bone', year: '20—', postmark: ['SEALED', 'POSTMORTEM'] })}</div>
      ${c.lines.map((ws) => `<span class="chip-g">??? ?? ???</span><div class="tl-it"><p>${bar(ws)}</p></div>`).join('')}
      <div class="tl-it"><div class="pcard"><span class="pill" style="background:#e9e8e3;color:#888">Coming soon</span><p>Arsipnya masih disusun. Amplopnya belum dicap.</p></div></div>
      <div class="fade"></div><div class="grabber"></div>
    </div></section>`;
  }
  function decideHTML(i) {
    const c = CASES[i];
    const dots = `<div class="dots">${CASES.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>`;
    let h, p, ok = true;
    if (c.sealed) { h = 'Still sealed.'; p = 'Amplopnya belum sampai. Coming soon.'; ok = false; }
    else if (S.sent) { h = 'Case closed?'; p = 'Kabar sudah terkirim. Pintu belakang…'; }
    else if (S.accepted) { const pct = Math.round(readCount() / readable.length * 100); h = 'Back to the case?'; p = `${pct}% dibaca · ${stampCount()} stamps. Progress-mu aman.`; }
    else { h = 'Take the case?'; p = 'This action cannot be undone. Serius.'; }
    return `${dots}<h2>${h}</h2><p>${p}</p>
      <div class="dec"><button class="db" data-act="next-slide" aria-label="Skip">${svg.icon('x')}</button><i></i><i></i>
      <button class="db q" data-act="brief" aria-label="Brief">?</button><i></i><i></i>
      <button class="db" data-act="accept" aria-label="Take the case" ${ok ? '' : 'aria-disabled="true"'}>${svg.icon('check')}</button></div>`;
  }
  function viewHome() {
    const slides = CASES.map((c, i) => (c.live ? slideLive(i) : slideSealed(c, i))).join('');
    return { body: `<div class="home"><div class="carousel" id="carousel">${slides}</div><div class="decide" id="decide">${decideHTML(homeIdx)}</div></div>`, lock: true, mount: mountHome };
  }
  function mountHome() {
    const car = $('#carousel');
    const step = () => car.clientWidth + 10;
    car.scrollLeft = homeIdx * step();
    $$('.slide', car).forEach((s, j) => s.classList.toggle('active', j === homeIdx));
    let t;
    car.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const i = Math.round(car.scrollLeft / step());
        if (i !== homeIdx) {
          homeIdx = i; $('#decide').innerHTML = decideHTML(i);
          $$('.slide', car).forEach((s, j) => s.classList.toggle('active', j === i));
        }
      }, 60);
    }, { passive: true });
  }
  function goSlide(i) {
    const car = $('#carousel'); if (!car) return;
    car.scrollTo({ left: i * (car.clientWidth + 10), behavior: 'smooth' });
  }

  // =====================================================================
  // CASE SHELL — Archive / Desk / Stamps
  // =====================================================================
  function caseHeader(tab) {
    const tabs = [['archive', 'Archive', '#/nyewu'], ['desk', 'Desk', '#/nyewu/desk'], ['stamps', 'Stamps', '#/nyewu/stamps']];
    return `<header class="hcard"><div class="hc-row">${back('#/')}${clue()}</div>
      <h1>Nyewu</h1><p class="hc-sub">Arsip kabar duka yang belum sampai.</p></header>
      <nav class="tabs2">${tabs.map(([k, t, h]) => `<a href="${h}" class="${k === tab ? 'on' : ''}">${t}</a>`).join('')}</nav>`;
  }

  function viewArchive() {
    const now = LE.now();
    const days = jw.daysUntil(C.windu, now);
    const nextK = jw.nextMalamKliwon(now);
    const kliwon = document.body.classList.contains('kliwon');
    let secs = '';
    D.berkas.forEach((b, bi) => {
      const open = berkasUnlocked(bi);
      const meta = C.BERKAS[b.id];
      const done = b.id === 'IX' ? S.sent : berkasDone(b);
      const head = `<div class="sec-h"><h3>Berkas ${esc(b.id)} — ${esc(b.title)}</h3>${done ? `<span class="sec-stamp">${berkasStamp(b)}</span>` : `<span>${esc(meta.years)}</span>`}</div>`;
      if (!open) {
        secs += `<section class="sec locked">${head}<p class="lockrow">${svg.icon('lock')}${b.id === 'IX' ? 'Locked. Kebuka setelah VIII-20.' : `Locked. Selesaikan Berkas ${esc(D.berkas[bi - 1].id)} dulu.`}</p></section>`;
        return;
      }
      if (b.id === 'IX') {
        secs += `<section class="sec">${head}<a class="kabar-card" href="#/nyewu/kabar"><span class="pill">Kirim kabar · ${decodePlaced().length}/${D.total}</span><p>${S.sent ? 'Kabar sudah dikirim. Dengarkan rekaman terakhir.' : 'Satu amplop beralamat Laut. Tempel satu stamp untuk setiap yang masih menunggu.'}</p></a></section>`;
        return;
      }
      const intro = b.intro && b.id !== '0' ? `<p class="sec-intro">${LE.md.inline(b.intro.replace(/^\*|\*$/g, ''))}</p>` : '';
      const rows = b.docs.map((d) => {
        const [, label] = C.skin(d.id);
        const r = S.read[d.id];
        return `<li><a class="row${r ? ' read' : ''}" href="#/nyewu/d/${d.id}" id="row-${d.id}"><span class="box">${r ? svg.icon('check') : ''}</span><span class="row-t"><b>${esc(d.id)}</b>${LE.md.inline(d.title)}</span><span class="row-why">${esc(label)} · ${minutes(d.md)} min</span></a></li>`;
      }).join('');
      secs += `<section class="sec">${head}${intro}<ul class="rows">${rows}</ul></section>`;
    });
    const nx = nextUnread();
    const bar = `<div class="bar2">${nx ? `<a class="cta" href="#/nyewu/d/${nx.id}">${S.read['0-01'] ? 'Continue' : 'Start reading'} <small>${esc(nx.id)}</small></a>`
      : kabarUnlocked() ? `<a class="cta yellow" href="#/nyewu/kabar">Kirim kabar</a>` : '<span class="cta dim">Archive complete</span>'}</div>`;
    return {
      body: `${caseHeader('archive')}<div class="body">
        <div class="meta-strip"><span>${readCount()}/${readable.length} read</span><span>${stampCount()}/10 stamps</span><span class="${days <= 14 ? 'hot' : ''}">windu · ${days > 0 ? days + 'd' : days === 0 ? 'tonight' : 'passed'}</span></div>
        <p class="kliwon-note">${kliwon ? 'Malam ini malam Jumat Kliwon. Kalau dengar dayung, itu cuma suara dari app ini.' : `Next malam Jumat Kliwon: ${nextK ? esc(jw.fmt(nextK)) : '—'}`}</p>
        ${secs}</div>`,
      bar,
    };
  }

  function viewDesk(sub = 'prep') {
    const segs = [['prep', 'Prep'], ['tasks', 'Tasks'], ['board', 'Board 41'], ['pasaran', 'Pasaran'], ['notes', 'Notes']];
    let body = '';
    if (sub === 'prep') {
      body = `<h3 class="sub-h">Reading kit</h3><ul class="checks">${C.BEKAL.map(([k, t, why]) => `
        <li><label><input type="checkbox" data-act="bekal" data-k="${k}" ${S.bekal[k] ? 'checked' : ''}><span class="box"></span><span>${esc(t)}</span></label>
        <details><summary>Why this?</summary><p>${esc(why)}</p></details></li>`).join('')}</ul>
        <h3 class="sub-h">Settings</h3>
        <label class="toggle"><span>Sound<small>Desis kaset, dayung, statis.</small></span><input type="checkbox" data-act="sound-t" ${LE.audio.muted ? '' : 'checked'}><span class="sw"></span></label>
        <label class="toggle"><span>Aku percaya ini nyata<small>${S.believe ? 'Kamu bisa lihat mereka. Mereka juga.' : 'Biarkan off.'}</small></span><input type="checkbox" data-act="believe" ${S.believe ? 'checked' : ''}><span class="sw"></span></label>
        <label class="toggle" data-act="reset-ask"><span>Reset progress<small>Mulai dari nol.</small></span>${svg.icon('x')}</label>`;
    } else if (sub === 'tasks') {
      body = `<h3 class="sub-h">Tasks</h3><ul class="checks auto">${C.TUGAS.map(([id, t]) => {
        const ok = id === '@sent' ? S.sent : !!S.read[id];
        return `<li class="${ok ? 'ok' : ''}"><span class="box">${ok ? svg.icon('check') : ''}</span><span>${esc(t)}${id[0] !== '@' ? `<a href="#/nyewu/d/${id}" class="ref">${esc(id)}</a>` : ''}</span></li>`;
      }).join('')}</ul>`;
    } else if (sub === 'board') {
      if (!S.read['I-02'] && !UNLOCK_ALL) body = `<div class="lockcard" style="margin-top:18px">${svg.icon('lock')}<h2>Board masih kosong</h2><p>Nama-namanya ada di laporan syahbandar. Baca I-02 dulu.</p><a class="cta" href="#/nyewu/d/I-02">Open I-02</a></div>`;
      else {
        const rows = LE.md.parse(docById('I-02').md).find((x) => x.t === 'table').rows.slice(1);
        const cnt = { menunggu: 0, sampai: 0 };
        rows.forEach((r) => { const s = S.board[r[0]]; if (s) cnt[s]++; });
        body = `<p class="desk-note">Tap status: ? → menunggu → sampai. Private, nggak dicek siapa-siapa.</p>
          <div class="board-sum"><span>menunggu ${cnt.menunggu}</span><span>sampai ${cnt.sampai}</span><span>? ${rows.length - cnt.menunggu - cnt.sampai}</span></div>
          <div class="board">${rows.map((r) => { const s = S.board[r[0]] || ''; return `<button class="brow ${s}" data-act="board" data-n="${esc(r[0])}"><span class="bn">${esc(r[0])}</span><span class="bname">${esc(r[1])}<small>${esc(r[2])} th · ${esc(r[4])}</small></span><span class="bs">${s || '?'}</span></button>`; }).join('')}</div>
          <h3 class="sub-h">Yang ikut mendayung</h3><p class="desk-note">Nemu nama di luar daftar syahbandar? Catat di sini.</p>
          <form class="field" data-act="extra"><input name="x" placeholder="Nama…" autocomplete="off"><button class="go">Add</button></form>
          <div class="xlist">${S.extra.map((x, i) => `<span class="xchip">${esc(x)}<button data-act="extra-del" data-i="${i}" aria-label="Hapus">×</button></span>`).join('')}</div>`;
      }
    } else if (sub === 'pasaran') {
      const today = LE.now();
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      body = `<p class="desk-note">Kalender Jawa: 7 hari × 5 pasaran. Malam Jumat Kliwon datang tiap 35 hari.</p>
        <div class="cal"><label>Date<input type="date" data-act="cal" value="${iso(today)}" min="1880-01-01" max="2100-12-31"></label><div class="cal-out" id="cal-out">${esc(jw.label(today))}</div></div>
        <div class="cal"><label>Malam Jumat Kliwon pertama setelah 8 Feb, tahun<input type="number" data-act="cal-year" value="1987" min="1880" max="2100" inputmode="numeric"></label><div class="cal-out" id="cal-year-out"></div></div>
        <div class="cal"><span class="lbl">Today</span><div class="cal-out">${esc(jw.fmt(today))} · ${esc(jw.pasaran(today))}</div></div>`;
    } else {
      body = `<p class="desk-note">Saved di browser ini aja.</p><textarea class="notes" data-act="notes" placeholder="Nama, umur, tanggal lahir anak-anak…">${esc(S.notes)}</textarea>`;
    }
    return {
      body: `${caseHeader('desk')}<div class="body"><div class="segs">${segs.map(([k, t]) => `<a href="#/nyewu/desk/${k}" class="${k === sub ? 'on' : ''}">${t}</a>`).join('')}</div>${body}</div>`,
      mount: () => { const cy = $('[data-act="cal-year"]'); if (cy) updateYear(cy.value); },
    };
  }

  function albumItems() {
    const placed = decodePlaced();
    const out = { berkas: [], kenal: [], kabar: [] };
    D.berkas.forEach((b) => {
      const got = b.id === 'IX' ? S.sent : !!S.berkasStamp[b.id];
      out.berkas.push({ key: 'b:' + b.id, got, html: got ? berkasStamp(b) : svg.blankStamp(b.id), name: `Berkas ${b.id} · ${b.title}`, desc: got ? `Dicap ${b.id === 'IX' ? 'waktu kabar dikirim' : esc(jw.fmt(new Date(S.berkasStamp[b.id])))}.` : 'Belum dicap.' });
    });
    Object.keys(C.KENAL).forEach((id, i) => {
      const got = !!S.kenal[id];
      out.kenal.push({ key: 'k:' + id, got, html: got ? kenalStamp(id) : svg.blankStamp(String(i + 1)), name: got ? C.KENAL[id][0] : '—', desc: got ? `${esc(C.KENAL[id][1])} · ${esc(C.KENAL[id][2])}. <a href="#/nyewu/d/${id}">Read ${id}</a>` : 'Kartu kenal belum dibaca.' });
    });
    for (let i = 0; i < D.total; i++) {
      const p = placed.find((x) => x.i === i);
      out.kabar.push({ key: 'x:' + i, got: !!p, html: p ? kabarStamp(p, S.recited[i]) : svg.blankStamp(''), name: p ? p.name : '—', desc: p ? `“${esc(p.q)}”` : '' });
    }
    return out;
  }
  const COLLS = [['berkas', 'Berkas', 'Dicap setiap kali satu berkas selesai dibaca.'], ['kenal', 'Kartu Kenal', 'Nama, wajah atau suara, satu kebiasaan. Tiga syarat untuk mengenal seseorang.'], ['kabar', 'Kabar', 'Untuk amplop beralamat Laut. Kamu yang nulis namanya.']];
  function viewStamps() {
    const items = albumItems();
    const colls = COLLS.filter(([k]) => k !== 'kabar' || kabarUnlocked());
    if (!colls.find(([k]) => k === S.coll)) S.coll = 'berkas';
    const ci = colls.findIndex(([k]) => k === S.coll);
    const [ck, cname, cdesc] = colls[ci];
    const list = items[ck];
    const got = list.filter((x) => x.got);
    const feat = list.find((x) => x.key === S.featured && x.got) || got[got.length - 1];
    const thumb = ([k, name]) => { const g = items[k].filter((x) => x.got); return `<button class="sel${k === ck ? ' on' : ''}" data-act="coll" data-k="${k}" aria-label="${name}">${g.length ? g[g.length - 1].html : svg.blankStamp('')}<small>${name}</small></button>`; };
    const order = colls.length === 3 ? [colls[(ci + 2) % 3], colls[ci], colls[(ci + 1) % 3]] : colls.length === 2 ? (ci === 0 ? [colls[1], colls[0]] : [colls[0], colls[1]]) : colls;
    return {
      body: `${caseHeader('stamps')}<div class="album">
        <div class="al-top"><div class="al-big">${feat ? feat.html : svg.blankStamp('?')}</div>
          <div class="al-cap"><h2>${esc(cname)}</h2><p>${got.length} stamp${got.length === 1 ? '' : 's'} · of ${list.length}</p></div></div>
        <p class="al-desc">${feat ? `<b style="color:#fff">${esc(feat.name)}</b> — ${feat.desc}` : esc(cdesc)}</p>
        <div class="al-grid">${list.map((x) => `<button class="al-item${feat && feat.key === x.key ? ' on' : ''}" data-act="feature" data-k="${x.key}" ${x.got ? '' : 'disabled'} aria-label="${esc(x.name)}">${x.html}</button>`).join('')}</div>
        <div class="al-why"><b>Kenapa stamp?</b>Di Pakabaran, perangko pernah jadi jangkar: Sumi menempelkannya tiap Kamis, 29 tahun, di amplop beralamat Laut, dan suratnya menahan Kasan di perahu. Di sini perangko bekerja ke arah sebaliknya. Stamp berkas = bukti kamu sudah membaca. Kartu kenal = bukti kamu sudah mengenal. Dan di Berkas IX, stamp yang kamu tulis sendiri adalah kabar: surat terakhir ke alamat yang sama, kali ini untuk melepaskan.</div>
      </div>`,
      bar: `<div class="selector">${order.map(thumb).join('')}</div>`,
    };
  }

  // =====================================================================
  // DOCUMENT
  // =====================================================================
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
      return `<div class="envelope${S.opened[doc.id] ? ' open' : ''}" data-doc="${doc.id}">
        <button class="env-front" data-act="open-env" aria-label="Buka amplop">
          <span class="env-stamp">${svg.stamp({ title: 'Republik', sub: 'Pos', motif: 'wave', palette: 'rust', value: stampValue(d.getFullYear()), year: String(d.getFullYear()) })}</span>
          <span class="env-pm"><b>PAKABARAN</b><i>${jw.postmark(d)}</i></span>
          <span class="env-to">Kang Kasan<br><span>Laut</span></span>
          <span class="env-cta">Tap to open</span>
        </button>
        <div class="letter">${LE.md.render(md)}</div>
      </div>`;
    }
    if (skinName === 'tape' || skinName === 'tape-phone') return tapeHTML(doc.id, md);
    if (skinName === 'photo') {
      const blocks = LE.md.parse(md);
      const backInk = blocks.filter((b) => b.t === 'quote').map((b) => LE.md.render(b.lines.join('\n'))).join('');
      const rest = blocks.filter((b) => b.t !== 'quote');
      const first = rest.shift();
      return `${LE.md.blocks(first ? [first] : [])}
        <div class="flip" data-act="flip" role="button" tabindex="0" aria-label="Balik foto">
          <div class="flip-in"><div class="face front">${svg.photo()}<span class="flip-hint">Tap to flip</span></div>
          <div class="face back"><div class="back-ink">${backInk}</div><span class="flip-hint">Flip back</span></div></div>
        </div>${LE.md.blocks(rest)}`;
    }
    if (skinName === 'map') {
      return `${LE.md.render(md.split('\n').filter((l) => !l.startsWith('- ')).join('\n'))}
        <div class="map-wrap">${svg.map()}</div>
        <ol class="map-list">${md.split('\n').filter((l) => l.startsWith('- ')).map((l, i) => `<li data-pin="${i}">${LE.md.inline(l.slice(2))}</li>`).join('')}</ol>`;
    }
    if (skinName === 'sketch') return `<div class="sketch-wrap">${svg.sketch()}</div>${LE.md.render(md)}`;
    if (skinName === 'stampcard') return `<div class="kenal-stamp">${kenalStamp(doc.id)}</div>${LE.md.render(md)}`;
    if (skinName === 'cover') {
      const blocks = LE.md.parse(md);
      const hr = blocks.findIndex((b) => b.t === 'hr');
      const head = blocks.slice(0, hr), tail = blocks.slice(hr + 1);
      const isNote = (b) => b.t === 'p' && /^&#91;/.test(b.raw);
      return LE.md.blocks(head.filter(isNote)) + `<div class="hardcover">${head.filter((b) => !isNote(b)).map((b) => `<p>${LE.md.inline(b.raw)}</p>`).join('')}</div><div class="abstract">${LE.md.blocks(tail)}</div>`;
    }
    return LE.md.render(md);
  }

  function tapeHTML(id, md) {
    const t = C.TAPE[id] || { style: 'phone', label: id };
    const deck = t.style === 'cassette'
      ? `<div class="cassette"><div class="cs-label"><b>${esc(t.label)}</b><span>${esc(t.brand || '')}</span></div><div class="cs-win"><span class="reel l"></span><span class="reel r"></span></div></div>`
      : `<div class="phone-rec"><div class="pr-label">${svg.icon('voice')}<b>${esc(t.label)}</b><span>${esc(t.length || '')}</span></div><div class="pr-wave">${Array.from({ length: 44 }, (_, i) => `<i style="--h:${(20 + Math.abs(Math.sin(i * 1.7 + id.length)) * 80).toFixed(0)}%"></i>`).join('')}</div></div>`;
    return `<div class="tape tape-${t.style}" data-tape="${id}">${deck}
      <div class="tape-ctl"><button class="play" data-act="tape-play" aria-label="Play">${svg.icon('play')}</button>
        <div class="tape-meta"><span class="counter">00:00</span><div class="prog"><i></i></div></div><span class="tape-hint">Tap a line to jump</span></div>
    </div><div class="transcript" data-for="${id}">${LE.md.render(md, { tape: true })}</div>`;
  }

  function viewDoc(id) {
    const doc = docById(id);
    if (!doc || doc.locked) return viewMissing();
    if (doc.berkas.id === 'IX') { location.replace('#/nyewu/kabar'); return null; }
    if (!berkasUnlocked(doc.bi)) {
      return {
        body: `<header class="hcard"><div class="hc-row">${back('#/nyewu')}${clue()}</div><span class="chip-g">${esc(id)}</span><h1>Still locked</h1><p class="hc-sub">Arsip ini dibaca berurutan.</p></header>
        <div class="body"><div class="lockcard">${berkasStamp(doc.berkas)}<h2>Berkas ${esc(doc.berkas.id)} — ${esc(doc.berkas.title)}</h2><p>Selesaikan berkas sebelumnya sampai dokumen terakhirnya.</p><a class="cta" href="#/nyewu">Back to archive</a></div></div>`,
      };
    }
    const fresh = markRead(doc);
    const [skinName, label] = C.skin(id);
    const at = new Date(S.read[id]);
    const idx = readable.indexOf(doc);
    const prev = readable[idx - 1], next = readable[idx + 1];
    let nextBtn;
    if (next) nextBtn = `<a class="cta" href="#/nyewu/d/${next.id}">Next <small>${esc(next.id)} · ${esc(LE.md.unesc(next.title).replace(/\*/g, ''))}</small></a>`;
    else nextBtn = kabarUnlocked() ? '<a class="cta yellow" href="#/nyewu/kabar">Berkas IX · Kabar</a>' : '<a class="cta" href="#/nyewu">Back to archive</a>';
    return {
      body: `<header class="hcard doc-h"><div class="hc-row">${back('#/nyewu', `data-back="${id}"`)}<div class="hc-right">${soundSq()}${clue()}</div></div>
          <span class="chip-g">Berkas ${esc(doc.berkas.id)} · ${esc(id)}</span>
          <h1>${LE.md.inline(doc.title)}</h1><p class="hc-sub">${esc(label)} · ${minutes(doc.md)} min read</p>
          <div class="read-pm${fresh ? ' fresh' : ''}"><b>TERBACA</b><span>${esc(jw.labelJw(at))}</span><i>${jw.postmark(at)}</i></div></header>
        <div class="doc-body"><article class="doc skin-${skinName}" data-doc="${id}">${renderBody(doc, skinName)}</article></div>`,
      bar: `<div class="bar2">${prev ? `<a class="sq dark" href="#/nyewu/d/${prev.id}" aria-label="Previous">${svg.icon('back')}</a>` : ''}${nextBtn}</div>`,
      mount: () => { if (fresh) setTimeout(() => LE.audio.thud(), 380); },
    };
  }

  // =====================================================================
  // KABAR — Berkas IX
  // =====================================================================
  const REPLY = {
    sampai: 'Dia sudah sampai.', tidur: 'Dia sudah tidur.', tahu: 'Dia sudah tahu.', sini: 'Dia masih di sini.',
    darat: 'Dia masih di darat.', jo: 'Ada empat Jo di arsip ini. Yang mana?', dup: 'Udah ditempel.',
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
  const kabarHeader = () => `<header class="hcard"><div class="hc-row">${back('#/nyewu')}${clue()}</div><span class="chip-g">Berkas IX</span><h1>Kabar</h1><p class="hc-sub">Satu amplop. Alamatnya: Laut.</p></header>`;

  function viewKabar() {
    if (!kabarUnlocked()) {
      return { body: `${kabarHeader()}<div class="body"><div class="lockcard">${svg.stamp({ title: 'Kabar', sub: 'Berkas IX · locked', motif: 'key', palette: 'night', year: '2027' })}<h2>Locked.</h2><p>Kebuka setelah kamu membaca VIII-20.<br>Ini cuma cerita.</p><a class="cta" href="#/nyewu">Back to archive</a></div></div>` };
    }
    ['IX-01', 'IX-02'].forEach((id) => { if (!S.read[id]) S.read[id] = new Date().toISOString(); });
    save();
    const placed = decodePlaced();
    const full = placed.length === D.total;
    const said = placed.filter((p) => S.recited[p.i]).length;
    const step = !full ? 1 : said < D.total ? 2 : !S.tembang ? 3 : 4;
    const slots = Array.from({ length: D.total }, (_, i) => {
      const p = placed[i];
      return p ? `<button class="slot filled${S.recited[p.i] ? ' said' : ''}" data-act="slot" data-i="${p.i}" aria-label="${esc(p.name)}">${kabarStamp(p, S.recited[p.i])}</button>` : `<span class="slot">${svg.blankStamp(String(i + 1))}</span>`;
    }).join('');
    const stanzas = tembangLines();
    const total = stanzas.reduce((n, s) => n + s.lines.length, 0);
    const shown = Math.min(S.tembangLine || 0, total);
    let li = 0;
    const tembang = stanzas.map((s) => `<div class="stanza">${s.lines.map((l) => `<p class="tl-line${li++ < shown ? ' on' : ''}">${esc(l)}</p>`).join('')}${li <= shown ? `<p class="tl-tr">${esc(s.tr)}</p>` : ''}</div>`).join('');
    const ready = step === 4 && !S.sent;
    return {
      body: `${kabarHeader()}<div class="body">
        <ol class="steps">${['Write', 'Say', 'Sing', 'Send'].map((t, i) => `<li class="${step > i + 1 || S.sent ? 'done' : step === i + 1 ? 'on' : ''}"><span>${i + 1}</span>${t}</li>`).join('')}</ol>
        <section class="env-form${S.believe ? ' blocked' : ''}">
          <div class="big-env${S.sent ? ' sent' : ''}">
            <div class="be-head"><div class="be-to"><small>Kepada</small><b>Laut</b><span>Pakabaran, Nusa Sewu · yang masih mendayung</span></div><div class="be-pm"><b>PAKABARAN</b><i>${jw.postmark(LE.now())}</i></div></div>
            <div class="slots">${slots}</div>
            <div class="be-from">Pengirim: seorang pembaca yang tidak percaya</div>
            ${S.sent ? '<div class="be-cancel">WIS YA</div>' : ''}
          </div>
          ${step === 1 ? `<form class="field" data-act="name"><input name="n" placeholder="Tulis satu nama…" autocomplete="off" autocapitalize="words" ${S.believe ? 'disabled' : ''}><button class="go">Tempel</button></form>
            <div class="reply" id="reply" aria-live="polite"></div><p class="count"><b>${placed.length}</b>/${D.total} stamped · tap a stamp to peel it off</p>` : ''}
          ${step === 2 ? `<p class="instr">Tap setiap stamp. Ucapkan namanya pakai suara biasa, kayak anak kecil manggil teman main. <b>${said}/${D.total}</b></p>` : ''}
          ${step >= 3 ? `<div class="tembang"><h3>Tembang Bocah Pesisir</h3>${tembang}${step === 3 ? `<button class="cta" data-act="tembang-next">${shown === 0 ? 'Start reading' : 'Next line'}</button>` : ''}</div>` : ''}
          ${S.believe ? `<div class="block-msg">${svg.icon('eye')}<b>${REPLY.believe}</b><button data-act="unbelieve">Ini cuma cerita.</button></div>` : ''}
        </section>
        <details class="ritual-toggle"${placed.length === 0 ? ' open' : ''}><summary>IX-01 · Tata Cara <small>read first</small></summary><article class="doc skin-ritual">${LE.md.render(docById('IX-01').md)}</article></details>
      </div>`,
      bar: `<div class="bar2"><button class="cta${ready || S.sent ? ' yellow' : ' dim'}" data-act="kabari">${S.sent ? 'Play the last tape' : 'Kabari'}</button></div>`,
    };
  }
  function reciteSheet(i) {
    const p = decodePlaced().find((x) => x.i === i);
    if (!p) return;
    const writing = decodePlaced().length < D.total;
    sheet(`<div class="recite"><div class="rc-stamp" id="rc-stamp">${kabarStamp(p, S.recited[i])}</div>
      <h2>${esc(p.name)}</h2><p class="rc-q">“${esc(p.q)}”</p>
      ${writing ? `<button class="ghostbtn" data-act="unplace" data-i="${i}">Peel off this stamp</button>`
        : S.recited[i] ? '<p class="muted">Sudah diucapkan.</p>' : `<button class="say" data-act="say" data-i="${i}"><span>Segara wis nyimpen jenengmu. Wis ya.</span><small>Laut sudah menyimpan namamu. Sudah ya.</small></button>`}</div>`);
  }
  function viewRekaman() {
    const placed = decodePlaced();
    if (placed.length !== D.total || !S.sent) { location.replace('#/nyewu/kabar'); return null; }
    const key = masterKey(placed);
    const ix03 = LE.crypt.open(D.locked['IX-03'], key) || '';
    const now = LE.now();
    let last;
    if (now >= new Date(2027, 1, 12)) {
      last = `<article class="doc skin-journal" style="margin-top:12px"><p class="p-strong"><strong>IX-04 · ${esc(docById('IX-04').title)}</strong></p>${LE.md.render(LE.crypt.open(D.locked['IX-04'], key) || '')}</article>`;
    } else {
      const days = Math.max(0, jw.daysUntil(C.windu, now));
      last = `<article class="doc skin-blank" style="margin-top:12px"><p class="p-strong"><strong>IX-05 · Halaman yang Belum Ditulis</strong></p>${LE.md.render(D.ix05.before.replace('\\[X\\]', String(days)))}</article>`;
    }
    return {
      body: `<header class="hcard"><div class="hc-row">${back('#/nyewu/kabar')}${soundSq()}</div><span class="chip-g">Berkas IX · IX-03</span><h1>${esc(docById('IX-03').title)}</h1><p class="hc-sub">Rekaman ponsel · 11 Februari 2027</p></header>
        <div class="doc-body"><article class="doc skin-tape-phone">${tapeHTML('IX-03', ix03)}</article>${last}</div>`,
      bar: '<div class="bar2"><a class="cta" href="#/nyewu">Back to archive</a></div>',
    };
  }
  function viewMissing() {
    return { body: `<header class="hcard"><div class="hc-row">${back('#/nyewu')}</div><h1>Not found</h1><p class="hc-sub">Mungkin laut menyimpannya.</p></header>` };
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
    const cues = $$(`.transcript[data-for="${root.dataset.tape}"] .cue`);
    if (!cues.length) return;
    tape = { root, cues, i: from ?? Math.max(0, cues.findIndex((c) => !c.classList.contains('done'))), timer: null };
    root.classList.add('playing');
    $('[data-act="tape-play"]', root).innerHTML = svg.icon('pause');
    LE.audio.boot();
    LE.audio.startHiss(root.classList.contains('tape-cassette') ? 0.04 : 0.015);
    stepTape();
  }
  function stepTape() {
    if (!tape) return;
    const { cues, root } = tape;
    if (tape.i >= cues.length) {
      const id = root.dataset.tape; stopTape();
      if (id === 'IX-03') toast('Untuk pertama kalinya sejak 8 Februari 1979, tidak ada bunyi dayung.', { ms: 6000 });
      return;
    }
    cues.forEach((c, j) => { c.classList.toggle('on', j === tape.i); c.classList.toggle('done', j < tape.i); });
    const c = cues[tape.i];
    const r = c.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
    if (r.top < sr.top + 230 || r.bottom > sr.bottom - 110) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = (c.dataset.text || '').toLowerCase();
    let dur = Math.min(7200, Math.max(1700, (+c.dataset.len || 40) * 42));
    if (c.classList.contains('sfx')) dur = Math.max(dur, 2400);
    if (/sembilan detik/.test(t)) { LE.audio.burstStatic(9); dur = 9000; }
    if (/dayung berhenti|menjauh|statis normal|rekaman berakhir|mesin menyala|tidak ada bunyi dayung|\[hening/.test(t)) LE.audio.stopOars();
    else if (/dayung/.test(t) && /\[/.test(t)) LE.audio.startOars(0.28);
    const tc = $('.cue-t', c).textContent.trim();
    if (tc) $('.counter', root).textContent = tc;
    $('.prog i', root).style.width = ((tape.i + 1) / cues.length * 100) + '%';
    tape.timer = setTimeout(() => { if (tape) { tape.i++; stepTape(); } }, dur);
  }

  // =====================================================================
  // ROUTER
  // =====================================================================
  let lastRoute = null;
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* */ } } };
  function route(keepScroll) {
    stopTape(); closeSheet(true);
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);
    let v;
    if (parts[0] !== 'nyewu') v = viewHome();
    else if (!S.accepted) { homeIdx = 0; location.replace('#/'); return; }
    else {
      const p1 = parts[1];
      if (!p1) v = viewArchive();
      else if (p1 === 'd') v = viewDoc(decodeURIComponent(parts[2] || ''));
      else if (p1 === 'desk' || p1 === 'meja') v = viewDesk(parts[2]);
      else if (p1 === 'stamps' || p1 === 'perangko') v = viewStamps();
      else if (p1 === 'kabar') v = viewKabar();
      else if (p1 === 'rekaman') v = viewRekaman();
      else v = viewMissing();
    }
    if (!v) return;
    const y = scroller.scrollTop;
    appEl.innerHTML = v.body;
    barEl.innerHTML = v.bar || '';
    scroller.classList.toggle('locked', !!v.lock);
    scroller.style.setProperty('--bar-h', (barEl.offsetHeight || 0) + 'px');
    document.body.dataset.view = parts[1] || parts[0] || 'home';
    if (keepScroll === true || lastRoute === h) scroller.scrollTop = y;
    else if (!parts[1] && parts[0] === 'nyewu' && ss.get('pm.back')) {
      const el = document.getElementById('row-' + ss.get('pm.back'));
      scroller.scrollTop = 0;
      if (el) el.scrollIntoView({ block: 'center' });
      ss.set('pm.back', '');
    } else scroller.scrollTop = 0;
    lastRoute = h;
    if (v.mount) v.mount();
  }
  function updateYear(y) {
    const out = $('#cal-year-out'); if (!out) return;
    y = +y;
    if (!(y >= 1880 && y <= 2100)) { out.textContent = '—'; return; }
    const d = jw.firstAfterStorm(y);
    out.textContent = d ? `${jw.fmt(d)} · malamnya malam ${jw.label(jw.addDays(d, 1))}` : '—';
  }
  function highlightPin(i) {
    $$('.map-pin, .map-list li').forEach((x) => x.classList.toggle('on', x.dataset.pin === String(i)));
    const li = $(`.map-list li[data-pin="${i}"]`); if (li) li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // =====================================================================
  // EVENTS
  // =====================================================================
  screen.addEventListener('click', (e) => {
    const backEl = e.target.closest('[data-back]');
    if (backEl) ss.set('pm.back', backEl.dataset.back);
    const el = e.target.closest('[data-act]');
    if (!el) {
      const cue = e.target.closest('.cue');
      if (cue) { const tr = cue.closest('.transcript'); playTape($(`.tape[data-tape="${tr.dataset.for}"]`), $$('.cue', tr).indexOf(cue)); }
      const pin = e.target.closest('.map-pin, .map-list li');
      if (pin) highlightPin(pin.dataset.pin);
      return;
    }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'FORM') return;
    e.preventDefault();
    const act = el.dataset.act;
    switch (act) {
      case 'sound': LE.audio.setMuted(!LE.audio.muted); el.innerHTML = svg.icon(LE.audio.muted ? 'mute' : 'sound'); break;
      case 'hints': hintsSheet(); break;
      case 'more-hint': S.hintsShown = Math.min(C.HINTS.length, (S.hintsShown || 1) + 1); save(); hintsSheet(); break;
      case 'close-sheet': closeSheet(); break;
      case 'next-slide': goSlide((homeIdx + 1) % CASES.length); break;
      case 'brief': if (CASES[homeIdx] && CASES[homeIdx].sealed) toast('<b>Still sealed.</b> Case berikutnya lagi disusun.'); else briefSheet(); break;
      case 'accept': {
        if (CASES[homeIdx] && CASES[homeIdx].sealed && location.hash.replace(/^#\/?/, '') === '') { toast('<b>Belum bisa dibuka.</b> Amplopnya belum sampai.'); break; }
        closeSheet();
        if (S.accepted) { location.hash = '#/nyewu'; break; }
        S.accepted = true; save(); LE.audio.thud();
        document.body.classList.add('accepting');
        setTimeout(() => { document.body.classList.remove('accepting'); location.hash = '#/nyewu'; toast('<small>Case taken</small><b>Mulai dari 0-01.</b> Read it like a fairytale.'); }, 620);
        break;
      }
      case 'demo': {
        LE.audio.boot();
        const row = el.closest('.aud');
        row.classList.add('playing');
        if (el.dataset.demo === 'oars') { LE.audio.startOars(0.3); setTimeout(() => { LE.audio.stopOars(); row.classList.remove('playing'); }, 8200); }
        else { LE.audio.startHiss(0.05); setTimeout(() => { LE.audio.stopHiss(); row.classList.remove('playing'); }, 4000); toast('<small>Kaset · Okt 1978</small><b>Kasan menyanyi.</b> Full tape ada di III-02.'); }
        break;
      }
      case 'open-env': { const env = el.closest('.envelope'); env.classList.add('open'); S.opened[env.dataset.doc] = true; save(); LE.audio.thud(); break; }
      case 'flip': el.classList.toggle('flipped'); break;
      case 'tape-play': { const root = el.closest('.tape'); if (tape && tape.root === root) stopTape(); else playTape(root); break; }
      case 'unbelieve': setBelieve(false); break;
      case 'reset-ask':
        sheet(`<h2 class="sh-title">Reset progress?</h2><p class="sh-sub">Semua stamp, catatan, dan nama di amplop akan hilang. This one beneran nggak bisa di-undo.</p><button class="cta" data-act="reset" style="background:#111;color:#fff">Reset</button>`);
        break;
      case 'reset': LE.store.del(KEY); S = Object.assign({}, DEFAULTS); closeSheet(); homeIdx = 0; location.hash = '#/'; route(); break;
      case 'board': { const n = el.dataset.n; const cur = S.board[n] || ''; S.board[n] = cur === '' ? 'menunggu' : cur === 'menunggu' ? 'sampai' : ''; save(); route(true); break; }
      case 'extra-del': S.extra.splice(+el.dataset.i, 1); save(); route(true); break;
      case 'feature': S.featured = el.dataset.k; save(); route(true); scroller.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'coll': S.coll = el.dataset.k; S.featured = null; save(); route(true); break;
      case 'slot': reciteSheet(+el.dataset.i); break;
      case 'unplace': S.placed = S.placed.filter((p) => p.i !== +el.dataset.i); delete S.recited[el.dataset.i]; save(); closeSheet(); route(true); break;
      case 'say': {
        const i = +el.dataset.i;
        S.recited[i] = true; save(); LE.audio.thud();
        const p = decodePlaced().find((x) => x.i === i);
        const box = $('#rc-stamp'); box.innerHTML = kabarStamp(p, true); box.classList.add('stamped');
        el.outerHTML = '<p class="said-line">Wis ya.</p>';
        setTimeout(() => { closeSheet(); route(true); }, 1300);
        break;
      }
      case 'tembang-next': {
        S.tembangLine = (S.tembangLine || 0) + 1;
        if (S.tembangLine >= tembangLines().reduce((n, s) => n + s.lines.length, 0)) S.tembang = true;
        save(); route(true);
        break;
      }
      case 'kabari': {
        if (S.sent) { location.hash = '#/nyewu/rekaman'; break; }
        if (S.believe) { toast(`<b>${REPLY.believe}</b>`); break; }
        const placed = decodePlaced();
        if (placed.length < D.total) { sheet(`<div class="ix05">${LE.md.render(D.ix05.incomplete)}</div>`, 'sheet-dark'); break; }
        if (placed.some((p) => !S.recited[p.i])) { toast('<b>Ucapkan dulu setiap nama.</b> Tap stamp-nya satu per satu.'); break; }
        if (!S.tembang) { toast('<b>Baca tembangnya sampai selesai.</b>'); break; }
        S.sent = true; S.featured = 'b:IX'; S.coll = 'berkas'; save(); LE.audio.thud();
        $('.big-env').classList.add('sending');
        setTimeout(() => { location.hash = '#/nyewu/rekaman'; }, 1300);
        break;
      }
      default: break;
    }
  });
  screen.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'believe') setBelieve(el.checked);
    else if (el.dataset.act === 'sound-t') LE.audio.setMuted(!el.checked);
    else if (el.dataset.act === 'bekal') { S.bekal[el.dataset.k] = el.checked; save(); }
    else if (el.dataset.act === 'cal') {
      const d = new Date(el.value + 'T12:00:00');
      $('#cal-out').textContent = isNaN(d) ? '—' : `${jw.label(d)}${d.getDay() === 4 && jw.pasaran(jw.addDays(d, 1)) === 'Kliwon' ? ' · malamnya malam Jumat Kliwon' : ''}`;
    }
  });
  screen.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.act === 'notes') { S.notes = el.value; save(); }
    if (el.dataset.act === 'cal-year') updateYear(el.value);
  });
  screen.addEventListener('submit', (e) => {
    const f = e.target;
    e.preventDefault();
    if (f.dataset.act === 'extra') {
      const v = f.x.value.trim(); if (!v) return;
      S.extra.push(v); save(); route(true);
      const i = $('[data-act="extra"] input'); if (i) i.focus();
    }
    if (f.dataset.act === 'name') {
      const v = f.n.value.trim(); if (!v) return;
      const r = tryName(v);
      if (r.ok) {
        LE.audio.thud(); route(true);
        const rep = $('#reply'); if (rep) { rep.className = 'reply ok'; rep.textContent = `${r.p.name} — stamped.`; }
        const input = $('[data-act="name"] input'); if (input) input.focus();
        const filled = $$('.slot.filled'); if (filled.length) filled[filled.length - 1].classList.add('just');
      } else {
        const rep = $('#reply'); rep.className = 'reply no'; rep.innerHTML = `<span class="rubber">${esc(REPLY[r.code])}</span>`;
        f.n.select();
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act="flip"], .map-pin')) { e.preventDefault(); e.target.click(); }
    if (document.body.dataset.view === 'home' && !e.target.matches('input, textarea')) {
      if (e.key === 'ArrowRight') goSlide(Math.min(CASES.length - 1, homeIdx + 1));
      if (e.key === 'ArrowLeft') goSlide(Math.max(0, homeIdx - 1));
    }
  });
  window.addEventListener('resize', () => { scroller.style.setProperty('--bar-h', (barEl.offsetHeight || 0) + 'px'); const car = $('#carousel'); if (car) car.scrollLeft = homeIdx * (car.clientWidth + 10); });

  // ---------- boot ----------
  function tickClock() { const d = new Date(); $('#clock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
  tickClock(); setInterval(tickClock, 20000);
  const kliwon = LE.params.get('kliwon') === '1' || jw.isMalamJumatKliwon(LE.now());
  document.body.classList.toggle('kliwon', kliwon);
  document.body.classList.toggle('believe', !!S.believe);
  renderFootprints();
  if (kliwon) {
    const once = () => { if (!LE.audio.muted) { LE.audio.startSea(0.04); LE.audio.startOars(0.06); } document.removeEventListener('pointerdown', once); };
    document.addEventListener('pointerdown', once);
  }
  window.addEventListener('hashchange', () => route());
  route();
})(window.LE);
