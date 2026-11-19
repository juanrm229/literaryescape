/**
 * Skin library — reusable "objects" a case can be made of.
 * Each skin reads a small markdown convention (documented in content/lab/README.md) and returns HTML.
 */
import { render, inline, unesc } from '@/lib/md';
import { esc } from '@/lib/esc';
import { icon } from '@/lib/svg';

type Opts = Record<string, unknown>;
const lines = (md: string) => md.replace(/\r/g, '').split('\n');
const items = (md: string) => lines(md).filter((l) => /^\s*[-*] /.test(l)).map((l) => l.replace(/^\s*[-*] /, '').trim());
const initials = (s: string) => (unesc(s) as string).replace(/[^A-Za-z@ ]/g, '').replace('@', '').trim().split(/\s+/).map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';
const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
/** text before the first "### " section, rendered as normal markdown (archive notes etc.) */
function splitSections(md: string) {
  const parts = md.split(/^### /m);
  const head = parts.shift() ?? '';
  return { head, sections: parts.map((p) => { const nl = p.indexOf('\n'); return { title: (nl < 0 ? p : p.slice(0, nl)).trim(), body: nl < 0 ? '' : p.slice(nl + 1) }; }) };
}

/* ---------------- email inbox ---------------- */
function email(md: string) {
  const { head, sections } = splitSections(md);
  const mails = sections.map((s, i) => {
    const meta: Record<string, string> = {};
    const body: string[] = [];
    let inHead = true;
    for (const l of lines(s.body)) {
      const m = inHead && l.match(/^(From|To|Date|Cc|Dari|Kepada|Tanggal):\s*(.+)$/i);
      if (m) { meta[m[1].toLowerCase()] = m[2]; continue; }
      if (inHead && !l.trim()) { if (Object.keys(meta).length) inHead = false; continue; }
      inHead = false; body.push(l);
    }
    const from = meta.from || meta.dari || '—';
    const date = meta.date || meta.tanggal || '';
    const text = body.join('\n').trim();
    const snippet = unesc(text).replace(/[*_>#]/g, '').replace(/\s+/g, ' ').slice(0, 90);
    return `<details class="mail-item"${i === 0 ? '' : ''}><summary>
        <span class="mail-av" style="--h:${hue(from)}">${esc(initials(from.replace(/<.*>/, '')))}</span>
        <span class="mail-main"><span class="mail-from">${inline(from.replace(/\s*<.*>/, ''))}</span><span class="mail-subj">${inline(s.title)}</span><span class="mail-snip">${esc(snippet)}…</span></span>
        <span class="mail-date">${esc((date.match(/\d{1,2} \p{L}{3}/u) || [date.split(/\s+/).pop() || ''])[0])}</span></summary>
      <div class="mail-open"><h4>${inline(s.title)}</h4><p class="mail-meta"><b>${inline(from)}</b><br>Kepada: ${inline(meta.to || meta.kepada || 'saya')}<br>${esc(date)}</p>${render(text)}</div></details>`;
  }).join('');
  return `${render(head)}<div class="mail"><div class="mail-bar">${icon('letter')}<b>Inbox</b><span>${sections.length}</span></div>${mails}</div>`;
}

/* ---------------- old phone SMS ---------------- */
function sms(md: string, o: Opts) {
  return `<div class="nokia"><div class="nk-screen"><div class="nk-top"><span>▮▮▮▯</span><b>${esc(String(o.title || 'Pesan'))}</b><span>▰▰▱</span></div>${render(md, { me: o.me || 'Saya' })}</div><div class="nk-keys"><i></i><i></i><i></i></div></div>`;
}

/* ---------------- voicemail ---------------- */
function voicemail(md: string) {
  const { head } = splitSections(md);
  const list = items(md).map((it, i) => {
    const m = it.match(/^\*\*(.+?)\*\*\s*·\s*([^·]+?)\s*·\s*(\d+:\d{2})\s*[—-]\s*(.+)$/);
    if (!m) return '';
    const [, who, when, dur, text] = m;
    return `<div class="vm"><button class="vm-play" data-act="vm-play" data-text="${esc(unesc(text).replace(/[*_]/g, ''))}" aria-label="Putar pesan ${i + 1}">${icon('play')}</button>
      <div class="vm-main"><b>${inline(who)}</b><span>${esc(when)}</span><div class="vm-wave">${Array.from({ length: 28 }, (_, k) => `<i style="--h:${(25 + Math.abs(Math.sin(k * 1.3 + i)) * 75).toFixed(0)}%"></i>`).join('')}</div><p class="vm-tr">${inline(text)}</p></div><span class="vm-dur">${esc(dur)}</span></div>`;
  }).join('');
  return `${render(head.split('\n').filter((l) => !/^\s*[-*] /.test(l)).join('\n'))}<div class="vms"><div class="vm-head">${icon('voice')}<b>Pesan suara</b></div>${list}</div>`;
}

/* ---------------- social feed ---------------- */
function feed(md: string) {
  const { head, sections } = splitSections(md);
  const posts = sections.map((s) => {
    const [handle, when] = s.title.split('·').map((x) => x.trim());
    const ls = lines(s.body);
    const img = ls.map((l) => l.match(/^!\[(.*?)\]\((.*?)\)/)).find(Boolean);
    const meta = ls.map((l) => l.match(/^♥\s*(\d+)(?:\s*·\s*(\d+)\s*komentar)?/)).find(Boolean);
    const text = ls.filter((l) => !/^!\[/.test(l) && !/^♥/.test(l)).join('\n').trim();
    return `<article class="post"><header><span class="post-av" style="--h:${hue(handle)}">${esc(initials(handle))}</span><b>${inline(handle)}</b><time>${esc(when || '')}</time></header>
      ${render(text)}${img ? `<figure class="post-img">${img[2] ? `<img src="${esc(img[2])}" alt="${esc(img[1])}" loading="lazy">` : `<div class="ph" style="--h:${hue(img[1])}">${esc(img[1])}</div>`}</figure>` : ''}
      <footer><span>♥ ${meta ? esc(meta[1]) : '0'}</span><span>💬 ${meta?.[2] ? esc(meta[2]) : '0'}</span><span>↗</span></footer></article>`;
  }).join('');
  return `${render(head)}<div class="feed">${posts}</div>`;
}

/* ---------------- photo gallery ---------------- */
function gallery(md: string) {
  const { head } = splitSections(md);
  const pics = items(md).map((it) => {
    const m = it.match(/^!?\[(.*?)\](?:\((.*?)\))?(?:\s*[—-]\s*(.+))?$/);
    if (!m) return '';
    const [, cap, url, note] = m;
    return `<button class="gal-item" data-act="gal-open">${url ? `<img src="${esc(url)}" alt="${esc(cap)}" loading="lazy">` : `<span class="ph" style="--h:${hue(cap)}">${esc(cap)}</span>`}<span class="gal-cap"><b>${inline(cap)}</b>${note ? `<i>${inline(note)}</i>` : ''}</span></button>`;
  }).join('');
  return `${render(head.split('\n').filter((l) => !/^\s*[-*] /.test(l)).join('\n'))}<div class="gallery">${pics}</div>`;
}

/* ---------------- browser history ---------------- */
function browser(md: string) {
  const out: string[] = [];
  for (const l of lines(md)) {
    const h = l.match(/^### (.+)$/);
    if (h) { out.push(`<h5 class="bh-day">${inline(h[1])}</h5>`); continue; }
    const m = l.match(/^\s*[-*] (\d{1,2}[:.]\d{2})\s*·\s*(.+)$/);
    if (m) {
      const q = unesc(m[2]);
      const isUrl = /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(q);
      out.push(`<div class="bh-row"><span class="bh-ic">${isUrl ? esc(q[0].toUpperCase()) : '🔍'}</span><span class="bh-q">${isUrl ? `<u>${esc(q)}</u>` : esc(q)}</span><time>${esc(m[1])}</time></div>`);
    } else if (l.trim() && !out.length) out.push(render(l));
  }
  return `<div class="browser"><div class="bh-bar"><span>●●●</span><b>Riwayat</b></div>${out.join('')}</div>`;
}

/* ---------------- CCTV log ---------------- */
function cctv(md: string) {
  const rows = lines(md).map((l) => {
    const m = l.match(/^\*\*(CAM[^*]*?)\s*·\s*([\d:]+)\*\*\s*(.*)$/i);
    if (m) return `<div class="cc-row"><span class="cc-cam">${esc(m[1])}</span><span class="cc-t">${esc(m[2])}</span><span class="cc-x">${inline(m[3])}</span></div>`;
    return l.trim() ? `<p class="cc-note">${inline(l)}</p>` : '';
  }).join('');
  return `<div class="cctv"><div class="cc-head"><span class="cc-rec">● REC</span><span>SISTEM PEREKAM · LOG</span></div>${rows}</div>`;
}

/* ---------------- ID card ---------------- */
function idcard(md: string, o: Opts) {
  const fields = items(md).map((it) => it.match(/^([^:]+):\s*(.*)$/)).filter(Boolean) as RegExpMatchArray[];
  const name = fields.find((f) => /nama|name/i.test(f[1]))?.[2] ?? '';
  const rest = lines(md).filter((l) => !/^\s*[-*] /.test(l)).join('\n');
  return `${render(rest)}<div class="idcard"><div class="id-head">${esc(String(o.title || 'KARTU TANDA PENDUDUK'))}</div><div class="id-body"><div class="id-photo" style="--h:${hue(name)}">${esc(initials(name))}</div>
    <dl>${fields.map((f) => `<dt>${esc(f[1].trim())}</dt><dd>${inline(f[2])}</dd>`).join('')}</dl></div><div class="id-foot">${esc(String(o.place || ''))}</div></div>`;
}

/* ---------------- route / itinerary ---------------- */
function route(md: string) {
  const stops = items(md).map((it) => it.match(/^(\d{1,2}[:.]\d{2})\s*·\s*([^—-]+?)\s*(?:[—-]\s*(.+))?$/)).filter(Boolean) as RegExpMatchArray[];
  const rest = lines(md).filter((l) => !/^\s*[-*] /.test(l)).join('\n');
  return `${render(rest)}<ol class="route">${stops.map((s, i) => `<li class="${i === stops.length - 1 ? 'last' : ''}"><time>${esc(s[1])}</time><b>${inline(s[2])}</b>${s[3] ? `<span>${inline(s[3])}</span>` : ''}</li>`).join('')}</ol>`;
}

/* ---------------- found phone ---------------- */
const APPS: Record<string, { ic: string; color: string; sub: string }> = {
  pesan: { ic: '💬', color: '#3fbf6f', sub: 'chat' }, messages: { ic: '💬', color: '#3fbf6f', sub: 'chat' },
  galeri: { ic: '🖼', color: '#f29a3c', sub: 'gallery' }, photos: { ic: '🖼', color: '#f29a3c', sub: 'gallery' },
  catatan: { ic: '📝', color: '#f6d33c', sub: 'note' }, notes: { ic: '📝', color: '#f6d33c', sub: 'note' },
  riwayat: { ic: '🧭', color: '#4f8bf5', sub: 'browser' }, browser: { ic: '🧭', color: '#4f8bf5', sub: 'browser' },
  email: { ic: '✉️', color: '#e5554b', sub: 'email' }, 'pesan suara': { ic: '☎️', color: '#28a07a', sub: 'voicemail' },
  telepon: { ic: '☎️', color: '#28a07a', sub: 'voicemail' }, kalender: { ic: '📅', color: '#d9534f', sub: 'note' },
  lokasi: { ic: '📍', color: '#8a6cf0', sub: 'route' }, peta: { ic: '📍', color: '#8a6cf0', sub: 'route' },
};
function phone(md: string, o: Opts) {
  const { head, sections } = splitSections(md);
  const apps = sections.map((s, i) => {
    const a = APPS[s.title.toLowerCase()] ?? { ic: '▣', color: '#666', sub: 'note' };
    const body = a.sub === 'chat' ? render(s.body, { me: o.me || 'Saya' }) : a.sub === 'note' ? `<div class="ph-note">${render(s.body)}</div>` : renderSkin(a.sub, s.body, o);
    return { i, title: s.title, a, body };
  });
  return `${render(head)}<div class="fphone" data-phone>
    <div class="fp-screen">
      <div class="fp-home" data-app-home><div class="fp-clock"><b>${esc(String(o.time || '01:12'))}</b><span>${esc(String(o.date || ''))}</span></div>
        <div class="fp-grid">${apps.map((x) => `<button class="fp-app" data-act="app-open" data-app="${x.i}"><span style="background:${x.a.color}">${x.a.ic}</span><small>${esc(x.title)}</small></button>`).join('')}</div>
        <div class="fp-dock">${apps.slice(0, 4).map((x) => `<span style="background:${x.a.color}">${x.a.ic}</span>`).join('')}</div></div>
      ${apps.map((x) => `<section class="fp-panel" data-panel="${x.i}" hidden><header><button data-act="app-back" aria-label="Kembali">‹</button><b>${esc(x.title)}</b><span></span></header><div class="fp-body">${x.body}</div></section>`).join('')}
    </div><div class="fp-bar"></div></div>`;
}

/* ---------------- dispatcher ---------------- */
export function renderSkin(skin: string, md: string, o: Opts = {}): string {
  switch (skin) {
    case 'email': return email(md);
    case 'sms': return sms(md, o);
    case 'voicemail': return voicemail(md);
    case 'feed': return feed(md);
    case 'gallery': return gallery(md);
    case 'browser': return browser(md);
    case 'cctv': return cctv(md);
    case 'idcard': return idcard(md, o);
    case 'route': return route(md);
    case 'phone': return phone(md, o);
    case 'chat': return render(md, { me: o.me || 'Saya' });
    default: return render(md);
  }
}
export const LIBRARY_SKINS = ['email', 'sms', 'voicemail', 'feed', 'gallery', 'browser', 'cctv', 'idcard', 'route', 'phone', 'chat'];
