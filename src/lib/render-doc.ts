import { render, parseMd as parse, blocks, inline } from '@/lib/md';
import { stamp, photo, map, sketch, icon } from '@/lib/svg';
import { esc } from '@/lib/esc';
import { BULAN, postmark } from '@/lib/jw';
import type { CaseConfig } from '@/lib/case-config';
import { kenalStamp } from '@/lib/stamps';
import { renderSkin, LIBRARY_SKINS } from '@/lib/skins';

type Block = { t: string; raw: string; lines: string[] };

function parseLetterDate(title: string) {
  const m = title.match(/(\d{1,2}) (\w+) (\d{4})/);
  if (!m) return null;
  const mi = BULAN.findIndex((b) => b.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)));
  return mi < 0 ? null : new Date(+m[3], mi, +m[1]);
}
const stampValue = (y: number) => (y < 1985 ? 'Rp 50' : y < 1995 ? 'Rp 350' : y < 2002 ? 'Rp 700' : 'Rp 1500');

export function tapeHTML(cfg: CaseConfig, code: string, md: string) {
  const t = cfg.tapes[code] || { style: 'phone', label: code };
  const deck = t.style === 'cassette'
    ? `<div class="cassette"><div class="cs-label"><b>${esc(t.label)}</b><span>${esc(t.brand || '')}</span></div><div class="cs-win"><span class="reel l"></span><span class="reel r"></span></div></div>`
    : `<div class="phone-rec"><div class="pr-label">${icon('voice')}<b>${esc(t.label)}</b><span>${esc(t.length || '')}</span></div><div class="pr-wave">${Array.from({ length: 44 }, (_, i) => `<i style="--h:${(20 + Math.abs(Math.sin(i * 1.7 + code.length)) * 80).toFixed(0)}%"></i>`).join('')}</div></div>`;
  return `<div class="tape tape-${t.style}" data-tape="${esc(code)}"${t.jingle ? ' data-jingle="1"' : ''}>${deck}
    <div class="tape-ctl"><button class="play" data-act="tape-play" aria-label="Play">${icon('play')}</button>
      <div class="tape-meta"><span class="counter">00:00</span><div class="prog"><i></i></div></div><span class="tape-hint">Tap a line to jump</span></div>
  </div><div class="transcript" data-for="${esc(code)}">${render(md, { tape: true })}</div>`;
}

/**
 * Typewriter fingerprint. The radio's Olympia SM9 lifts every lowercase g a hair above the line and
 * clogs the bowl of the e with ink — invisible at reading size, obvious under the loupe.
 */
function olympia(html: string) {
  return html.split(/(<[^>]+>|&[#a-z0-9]+;)/i).map((seg, i) => (i % 2 ? seg : seg.replace(/[ge]/g, (ch) => `<span class="t${ch}">${ch}</span>`))).join('');
}

/** Wrap the first text occurrence of each mark's word (never inside a tag); append micro-writing marks. */
function loupeMarks(html: string, marks: { id: string; find?: string; micro?: string; note: string }[]) {
  for (const m of marks) {
    if (m.micro) { html += `<p class="micro"><span class="lm" data-lm="${esc(m.id)}">${esc(m.micro)}</span></p>`; continue; }
    if (!m.find) continue;
    const parts = html.split(/(<[^>]+>)/);
    const re = new RegExp(`(^|[^\\p{L}])(${m.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^\\p{L}])`, 'u');
    for (let i = 0; i < parts.length; i += 2) {
      if (re.test(parts[i])) { parts[i] = parts[i].replace(re, (_, pre, w) => `${pre}<span class="lm" data-lm="${esc(m.id)}">${w}</span>`); break; }
    }
    html = parts.join('');
  }
  return html;
}

function photosHTML(list: { src: string; caption: string; tall?: boolean }[]) {
  return list.map((ph, i) => `<figure class="arch-photo${i % 2 ? ' r' : ''}${ph.tall ? ' tall' : ''}" data-act="photo-open" data-src="${esc(ph.src)}" data-cap="${esc(ph.caption)}" role="button" tabindex="0" aria-label="Perbesar foto: ${esc(ph.caption)}">
    <img src="${esc(ph.src)}" alt="${esc(ph.caption)}" loading="lazy" decoding="async"><figcaption>${inline(ph.caption)}</figcaption></figure>`).join('');
}

/** Document body HTML for a skin. Pure string output; the client wires up the interactions. */
export function renderDocBody(cfg: CaseConfig, doc: { code: string; title: string; md: string }, skinName: string, opened: boolean) {
  let html = renderInner(cfg, doc, skinName, opened);
  const marks = cfg.loupe?.[doc.code];
  if (marks?.length) html = loupeMarks(html, marks);
  const tw = cfg.typewriter?.[doc.code];
  if (tw) html = `<div class="tw tw-${tw}">${tw === 'olympia' ? olympia(html) : html}</div>`;
  const ph = cfg.photos?.[doc.code];
  if (ph?.length) html = photosHTML(ph) + html;
  return html;
}

function renderInner(cfg: CaseConfig, doc: { code: string; title: string; md: string }, skinName: string, opened: boolean) {
  const md = doc.md;
  if (skinName === 'script') return scriptHTML(md);
  if (skinName === 'thread') return threadHTML(md);
  if (skinName === 'brochure') return `<div class="brochure">${render(md)}</div>`;
  if (LIBRARY_SKINS.includes(skinName)) return renderSkin(skinName, md, cfg.skinOptions?.[doc.code] ?? {});
  if (skinName === 'letter') {
    const opt = (cfg.skinOptions?.[doc.code] ?? {}) as { to?: string; address?: string; postmark?: string };
    const d = parseLetterDate(doc.title) || new Date(1979, 8, 6);
    return `<div class="envelope${opened ? ' open' : ''}" data-doc="${esc(doc.code)}">
      <button class="env-front" data-act="open-env" aria-label="Buka amplop">
        <span class="env-stamp">${stamp({ title: 'Republik', sub: 'Pos', motif: 'wave', palette: 'rust', value: stampValue(d.getFullYear()), year: String(d.getFullYear()) })}</span>
        <span class="env-pm"><b>${esc(String(opt.postmark ?? cfg.letter?.postmark ?? 'PAKABARAN'))}</b><i>${postmark(d)}</i></span>
        <span class="env-to">${esc(String(opt.to ?? cfg.letter?.to ?? 'Kang Kasan'))}<br><span>${esc(String(opt.address ?? cfg.letter?.address ?? cfg.finale?.address ?? 'Laut'))}</span></span>
        <span class="env-cta">Tap to open</span>
      </button>
      <div class="letter">${render(md)}</div>
    </div>`;
  }
  if (skinName === 'tape' || skinName === 'tape-phone') return tapeHTML(cfg, doc.code, md);
  if (skinName === 'photo') {
    const bl = parse(md);
    const backInk = bl.filter((b) => b.t === 'quote').map((b) => render(b.lines.join('\n'))).join('');
    const rest = bl.filter((b) => b.t !== 'quote');
    const first = rest.shift();
    return `${blocks(first ? [first] : [])}
      <div class="flip" data-act="flip" role="button" tabindex="0" aria-label="Balik foto">
        <div class="flip-in"><div class="face front">${photo()}<span class="flip-hint">Tap to flip</span></div>
        <div class="face back"><div class="back-ink">${backInk}</div><span class="flip-hint">Flip back</span></div></div>
      </div>${blocks(rest)}`;
  }
  if (skinName === 'map') {
    return `${render(md.split('\n').filter((l) => !l.startsWith('- ')).join('\n'))}
      <div class="map-wrap">${map()}</div>
      <ol class="map-list">${md.split('\n').filter((l) => l.startsWith('- ')).map((l, i) => `<li data-pin="${i}">${inline(l.slice(2))}</li>`).join('')}</ol>`;
  }
  if (skinName === 'sketch') return `<div class="sketch-wrap">${sketch()}</div>${render(md)}`;
  if (skinName === 'stampcard') return `<div class="kenal-stamp">${kenalStamp(cfg, doc.code)}</div>${render(md)}`;
  if (skinName === 'cover') {
    const bl = parse(md);
    const hr = bl.findIndex((b) => b.t === 'hr');
    const head = bl.slice(0, hr), tail = bl.slice(hr + 1);
    const isNote = (b: Block) => b.t === 'p' && /^&#91;/.test(b.raw);
    return blocks(head.filter(isNote)) + `<div class="hardcover">${head.filter((b) => !isNote(b)).map((b) => `<p>${inline(b.raw)}</p>`).join('')}</div><div class="abstract">${blocks(tail)}</div>`;
  }
  return render(md);
}

/**
 * Radio script page: SUARA cues become sound-effect lines, CHARACTER: lines get a speaker column,
 * pencil/ink margin notes (II-05) sit in the margin as handwriting.
 */
function scriptHTML(md: string) {
  const bl = parse(md);
  let out = '';
  let margin: 'pensil' | 'tinta' | null = null;
  for (const b of bl) {
    if (b.t === 'p') {
      const raw = b.raw.trim();
      const mm = raw.match(/^Catatan pinggir,\s*\*\*(pensil|tinta)\*\*/i);
      if (mm) { margin = mm[1].toLowerCase() as 'pensil' | 'tinta'; out += `<p class="mg-label">${inline(raw)}</p>`; continue; }
    }
    if (b.t === 'quote') {
      if (margin) { out += `<div class="mg mg-${margin}">${render(b.lines.join('\n'))}</div>`; margin = null; continue; }
      out += `<div class="script-page">${b.lines.join('\n').split(/\n\s*\n/).map((para: string) => {
        const t = para.trim();
        if (!t) return '';
        const sfx = t.match(/^\*\*SUARA:?\*\*:?\s*(.*)$/s);
        if (sfx) return `<p class="sc-sfx"><b>SUARA</b> ${inline(sfx[1])}</p>`;
        const sp = t.match(/^(?:\*\*)?([A-Z][A-Z .'()]{1,40}?)(?:\*\*)?:\s*(?:\*\*)?\s*(.*)$/s);
        if (sp && sp[1] === sp[1].toUpperCase()) return `<p class="sc-line"><b>${inline(sp[1])}</b><span>${inline(sp[2])}</span></p>`;
        if (/^[A-Z0-9 .,:;'"“”—–-]{12,}$/.test(t.replace(/\*/g, ''))) return `<p class="sc-head">${inline(t)}</p>`;
        return `<p>${inline(t)}</p>`;
      }).join('')}</div>`;
      continue;
    }
    out += blocks([b]);
  }
  return out;
}

/** A social thread: author header, numbered posts, and @replies, all from one blockquote. */
function threadHTML(md: string) {
  const bl = parse(md);
  let out = '';
  for (const b of bl) {
    if (b.t !== 'quote') { out += blocks([b]); continue; }
    const paras = b.lines.join('\n').split(/\n\s*\n/).map((x: string) => x.trim()).filter(Boolean);
    let author = '';
    let handle = '';
    const cards: string[] = [];
    for (const t of paras) {
      const head = t.match(/^\*\*(.+?)\*\*\s*(@[\w\\]+)?\s*·\s*(.+)$/);
      if (head && !/^\d+\//.test(head[1])) {
        if (head[1].startsWith('@')) { // a reply: **@handle** · text
          const h = head[1].replace(/\\_/g, '_');
          cards.push(`<article class="tw-post reply"><header><span class="tw-av" style="--h:${hue(h)}">${esc(h.slice(1, 3).toUpperCase())}</span><b>${esc(h)}</b></header><p>${inline(head[3])}</p></article>`);
          continue;
        }
        author = head[1]; handle = (head[2] || '').replace(/\\_/g, '_');
        cards.push(`<header class="tw-author"><span class="tw-av big" style="--h:${hue(author)}">${esc(author.split(/\s+/).map((w) => w[0]).join('').slice(0, 2))}</span><span><b>${inline(author)}</b><small>${esc(handle)} · ${inline(head[3])}</small></span></header>`);
        continue;
      }
      const n = t.match(/^\*\*(\d+)\/\*\*\s*(.*)$/s);
      if (n) { cards.push(`<article class="tw-post"><span class="tw-n">${n[1]}/</span><p>${inline(n[2])}</p></article>`); continue; }
      cards.push(`<p class="tw-meta">${inline(t)}</p>`);
    }
    out += `<div class="thread">${cards.join('')}</div>`;
  }
  return out;
}

const hue = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
