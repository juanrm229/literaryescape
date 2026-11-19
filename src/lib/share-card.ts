import 'server-only';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

/**
 * Story-sized share cards (1080×1920), drawn as plain SVG and rasterised with resvg + the app's own fonts,
 * so the stamps look exactly like they do in the album (next/og's renderer has no fonts for nested SVG text).
 */
const W = 1080, H = 1920;
const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');
const FONTS = ['Caveat-Regular', 'IBMPlexMono-Regular', 'IBMPlexMono-Medium', 'InterTight-Bold', 'InterTight-ExtraBold', 'Newsreader-Italic', 'Newsreader-SemiBold']
  .map((f) => path.join(FONT_DIR, `${f}.ttf`));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SANS = `font-family="Inter Tight"`, SERIF = `font-family="Newsreader"`, MONO = `font-family="IBM Plex Mono"`;

/** Greedy word wrap by character budget (cards only carry short lines). */
function wrap(s: string, max: number, lines = 2) {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}
const tspans = (lines: string[], x: number, lh: number) => lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('');

/** Strip the outer <svg …> of a stamp and re-wrap it at a position/size. */
function placeSvg(svg: string, x: number, y: number, w: number, h: number) {
  const inner = svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 120 150';
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function frame(body: string, o: { caseLine: string; foot: string; host: string; accent?: string }) {
  const accent = o.accent ?? '#ff5a1f';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="vg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#1d1b17"/><stop offset="1" stop-color="#070707"/></radialGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="26" stdDeviation="28" flood-color="#000" flood-opacity=".6"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vg)"/>
  <text x="84" y="170" ${SANS} font-weight="800" font-size="58" letter-spacing="-2" fill="#fff">postmortem</text>
  <circle cx="436" cy="152" r="11" fill="${accent}"/>
  <text x="${W - 84}" y="166" text-anchor="end" ${MONO} font-size="26" letter-spacing="3" fill="#8d8a83">${esc(o.caseLine.toUpperCase())}</text>
  <line x1="84" y1="214" x2="${W - 84}" y2="214" stroke="#2c2a26" stroke-width="2"/>
  ${body}
  <line x1="84" y1="1706" x2="${W - 84}" y2="1706" stroke="#2c2a26" stroke-width="2"/>
  <text x="84" y="1780" ${SERIF} font-style="italic" font-size="44" fill="#d8d3c8">${esc(o.foot)}</text>
  <text x="84" y="1840" ${MONO} font-size="26" letter-spacing="1" fill="#6f6c66">${esc(o.host)}</text>
</svg>`;
}

export type StampCard = { kind: string; title: string; sub: string; stampSvg: string; caseNo: string; caseTitle: string; host: string; slug: string };

export function stampCardSvg(c: StampCard) {
  const title = wrap(c.title, 17, 2);
  const titleY = 1392;
  const body = `
  <g transform="rotate(-4 540 790)" filter="url(#sh)">${placeSvg(c.stampSvg, 230, 380, 620, 775)}</g>
  <text x="84" y="1290" ${MONO} font-weight="500" font-size="28" letter-spacing="5" fill="#ff5a1f">${esc(c.kind.toUpperCase())}</text>
  <text x="84" y="${titleY}" ${SERIF} font-weight="600" font-size="92" letter-spacing="-2" fill="#fff">${tspans(title, 84, 98)}</text>
  <text x="84" y="${titleY + (title.length - 1) * 98 + 78}" ${MONO} font-size="30" fill="#9b978f">${tspans(wrap(c.sub, 46, 2), 84, 42)}</text>`;
  return frame(body, { caseLine: `Case ${c.caseNo} · ${c.caseTitle}`, foot: 'Satu perkara, satu arsip, satu pintu.', host: `${c.host}/?case=${c.slug}` });
}

export type RankCard = { rank: string; line: string; points: number; next?: string; toNext: number; stats: [string, string][]; stamps: string[]; host: string };

export function rankCardSvg(c: RankCard) {
  const fan = c.stamps.slice(-3);
  const n = fan.length;
  // outer stamps first, the newest one in the middle on top
  const order = n === 3 ? [0, 2, 1] : n === 2 ? [0, 1] : [0];
  const fanSvg = order.map((i) => {
    const off = i - (n - 1) / 2;
    return `<g transform="rotate(${off * 10} 540 640)" filter="url(#sh)">${placeSvg(fan[i], 540 - 170 + off * 250, 370 + Math.abs(off) * 50, 340, 425)}</g>`;
  }).join('');
  const empty = n ? '' : `<circle cx="540" cy="600" r="170" fill="none" stroke="#3a3833" stroke-width="3" stroke-dasharray="10 12"/><text x="540" y="625" text-anchor="middle" ${SERIF} font-style="italic" font-size="64" fill="#57544e">?</text>`;
  const bar = Math.max(0.02, Math.min(1, c.toNext));
  const stats = c.stats.map(([v, l], i) => {
    const x = 84 + i * 228;
    return `<text x="${x}" y="1540" ${SANS} font-weight="800" font-size="64" fill="#fff">${esc(v)}</text><text x="${x}" y="1586" ${MONO} font-size="24" fill="#8d8a83">${esc(l)}</text>`;
  }).join('');
  const body = `${fanSvg}${empty}
  <text x="84" y="1010" ${MONO} font-weight="500" font-size="28" letter-spacing="5" fill="#ff5a1f">PERINGKAT</text>
  <text x="84" y="1124" ${SERIF} font-weight="600" font-size="128" letter-spacing="-3" fill="#fff">${esc(c.rank)}</text>
  <text x="84" y="1196" ${SERIF} font-style="italic" font-size="44" fill="#cfcabf">${tspans(wrap(c.line, 40, 2), 84, 54)}</text>
  <rect x="84" y="1300" width="${W - 168}" height="14" rx="7" fill="#26241f"/>
  <rect x="84" y="1300" width="${(W - 168) * bar}" height="14" rx="7" fill="#f4d23c"/>
  <text x="84" y="1372" ${MONO} font-size="28" fill="#cfcabf">${c.points.toLocaleString('id-ID')} poin</text>
  <text x="${W - 84}" y="1372" text-anchor="end" ${MONO} font-size="28" fill="#6f6c66">${esc(c.next ? `menuju ${c.next}` : 'peringkat tertinggi')}</text>
  ${stats}`;
  return frame(body, { caseLine: 'Buku perangko', foot: 'Case files you solve by reading.', host: c.host });
}

export type SentCard = { caseNo: string; caseTitle: string; address: string; names: number; nth: number; date: string; host: string; slug: string };

export function sentCardSvg(c: SentCard) {
  // a big postmark — no names, never a spoiler
  const ring = (r: number) => `<circle cx="540" cy="640" r="${r}" fill="none" stroke="#c4392f" stroke-width="7"/>`;
  const body = `
  <g transform="rotate(-12 540 640)" opacity=".92">
    ${ring(250)}${ring(206)}
    <path d="M150 560 Q215 535 280 560 T410 560 M150 640 Q215 615 280 640 T410 640 M150 720 Q215 695 280 720 T410 720" fill="none" stroke="#c4392f" stroke-width="6" transform="translate(-60 0)"/>
    <text x="540" y="610" text-anchor="middle" ${MONO} font-weight="500" font-size="54" letter-spacing="8" fill="#c4392f">WIS YA</text>
    <text x="540" y="684" text-anchor="middle" ${MONO} font-size="34" letter-spacing="6" fill="#c4392f">${esc(c.address.toUpperCase())}</text>
    <text x="540" y="740" text-anchor="middle" ${MONO} font-size="26" letter-spacing="3" fill="#c4392f">${esc(c.date.toUpperCase())}</text>
  </g>
  <text x="84" y="1108" ${MONO} font-weight="500" font-size="28" letter-spacing="5" fill="#ff5a1f">PERKARA DITUTUP</text>
  <text x="84" y="1222" ${SERIF} font-weight="600" font-size="112" letter-spacing="-3" fill="#fff">Kabar sudah</text>
  <text x="84" y="1338" ${SERIF} font-weight="600" font-size="112" letter-spacing="-3" fill="#fff">sampai.</text>
  <text x="84" y="1440" ${SERIF} font-style="italic" font-size="46" fill="#cfcabf">${c.names} nama dikembalikan ke ${esc(c.address)}.</text>
  <text x="84" y="1580" ${SANS} font-weight="800" font-size="72" fill="#fff">ke-${c.nth.toLocaleString('id-ID')}</text>
  <text x="84" y="1628" ${MONO} font-size="26" fill="#8d8a83">pembaca yang mengirim kabar</text>`;
  return frame(body, { caseLine: `Case ${c.caseNo} · ${c.caseTitle}`, foot: 'Tanpa spoiler. Baca sendiri.', host: `${c.host}/?case=${c.slug}`, accent: '#c4392f' });
}

export function toPng(svg: string) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Inter Tight' },
  });
  return r.render().asPng();
}
