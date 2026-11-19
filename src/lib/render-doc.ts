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
  return `<div class="tape tape-${t.style}" data-tape="${esc(code)}">${deck}
    <div class="tape-ctl"><button class="play" data-act="tape-play" aria-label="Play">${icon('play')}</button>
      <div class="tape-meta"><span class="counter">00:00</span><div class="prog"><i></i></div></div><span class="tape-hint">Tap a line to jump</span></div>
  </div><div class="transcript" data-for="${esc(code)}">${render(md, { tape: true })}</div>`;
}

/** Document body HTML for a skin. Pure string output; the client wires up the interactions. */
export function renderDocBody(cfg: CaseConfig, doc: { code: string; title: string; md: string }, skinName: string, opened: boolean) {
  const md = doc.md;
  if (LIBRARY_SKINS.includes(skinName)) return renderSkin(skinName, md, cfg.skinOptions?.[doc.code] ?? {});
  if (skinName === 'letter') {
    const d = parseLetterDate(doc.title) || new Date(1979, 8, 6);
    return `<div class="envelope${opened ? ' open' : ''}" data-doc="${esc(doc.code)}">
      <button class="env-front" data-act="open-env" aria-label="Buka amplop">
        <span class="env-stamp">${stamp({ title: 'Republik', sub: 'Pos', motif: 'wave', palette: 'rust', value: stampValue(d.getFullYear()), year: String(d.getFullYear()) })}</span>
        <span class="env-pm"><b>PAKABARAN</b><i>${postmark(d)}</i></span>
        <span class="env-to">Kang Kasan<br><span>${esc(cfg.finale?.address || 'Laut')}</span></span>
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
