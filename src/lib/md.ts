// @ts-nocheck — ported string renderer; output is HTML for dangerouslySetInnerHTML
import { esc } from './esc';
import { icon } from './svg';

  const unesc = (s) => s.replace(/&#91;/g, '[').replace(/\\\[/g, '[').replace(/\\\]/g, ']').replace(/\\_/g, '_').replace(/\\\*/g, '∗');

  function inline(s) {
    let h = esc(unesc(s));
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
    return h.replace(/∗/g, '*');
  }

  // ---------- block parser ----------
  function parse(md) {
    const lines = (md || '').replace(/\r/g, '').split('\n');
    const blocks = [];
    let para = [];
    const flush = () => { if (para.length) { blocks.push({ t: 'p', raw: para.join(' ').trim() }); para = []; } };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const tr = line.trim();
      if (!tr) { flush(); continue; }
      if (/^#{3,4} /.test(tr)) { flush(); blocks.push({ t: 'h', level: tr.startsWith('####') ? 4 : 3, raw: tr.replace(/^#+ /, '') }); continue; }
      if (/^-{3,}$/.test(tr)) { flush(); blocks.push({ t: 'hr' }); continue; }
      if (tr.startsWith('>')) {
        flush();
        const inner = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) { inner.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
        i--;
        blocks.push({ t: 'quote', lines: inner });
        continue;
      }
      if (tr.startsWith('|') && i + 1 < lines.length && /^\|\s*:?-{2,}/.test(lines[i + 1].trim())) {
        flush();
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const r = lines[i].trim();
          if (!/^\|\s*:?-{2,}/.test(r)) rows.push(r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim()));
          i++;
        }
        i--;
        blocks.push({ t: 'table', rows });
        continue;
      }
      const lm = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (lm && !/^\*\*/.test(tr) && !(lm[2] === '*' && /\*\s*$/.test(tr))) {
        flush();
        const items = [];
        const ordered = /\d/.test(lm[2]);
        while (i < lines.length) {
          const l = lines[i];
          const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
          if (m) {
            const depth = m[1].length >= 2 ? 1 : 0;
            if (depth === 0 || !items.length) items.push({ raw: m[3], kids: [], kidsOrdered: false });
            else { items[items.length - 1].kids.push(m[3]); items[items.length - 1].kidsOrdered = /\d/.test(m[2]); }
          } else if (l.trim() && /^\s{2,}/.test(l) && items.length) {
            items[items.length - 1].raw += ' ' + l.trim();
          } else break;
          i++;
        }
        i--;
        blocks.push({ t: 'list', ordered, items });
        continue;
      }
      para.push(tr);
    }
    flush();
    return blocks;
  }

  // ---------- note classification ----------
  function noteKind(text) {
    const head = text.slice(0, 120);
    if (/^\[Catatan Pak Wiryo/.test(head)) return ['wiryo', 'Ditempel di amplop'];
    if (/^\[Catatan Gita/.test(head) || /pulpen hijau/.test(head) && !/^\[Catatan saya/.test(head)) return ['gita', 'Pulpen hijau · G.'];
    if (/^\[Catatan Joko/.test(head)) return ['joko', 'Sampul kaset'];
    if (/^\[(Catatan saya|Tambahan|Sisa komentar)/.test(head)) return ['warta', 'Catatan W.'];
    return ['archive', 'Keterangan penyusun'];
  }
  const isNote = (t) => /^\[[^\]]/.test(t) && /\]$/.test(t) && !/^\[\d{1,2}:\d{2}/.test(t);
  const isStage = (t) => /^\*\[/.test(t) && /\]\*$/.test(t);

  function renderNote(text) {
    const [kind, tag] = noteKind(text);
    let body = text.replace(/^\[/, '').replace(/\]$/, '');
    if (kind === 'warta') body = body.replace(/^Catatan saya:\s*/, '');
    if (kind === 'gita') body = body.replace(/^Catatan Gita[^:]*:\s*/, '');
    if (kind === 'wiryo') body = body.replace(/^Catatan Pak Wiryo[^:]*:\s*/, '');
    if (kind === 'joko') body = body.replace(/^Catatan Joko[^:]*:\s*/, '');
    return `<aside class="note note-${kind}"><span class="note-tag">${tag}</span><div>${inline(body)}</div></aside>`;
  }

  // ---------- special quotes ----------
  function chatHTML(lines, meName = 'Ibu') {
    const rows = lines.filter((l) => l.trim());
    const re = /^\*\*(\S+)\*\* (\d{1,2}:\d{2}) (.+)$/;
    if (!rows.length || !rows.every((l) => re.test(l))) return null;
    let out = '<div class="chat">';
    let last = '';
    for (const l of rows) {
      const [, who, time, text] = l.match(re);
      const me = who === meName;
      const t = unesc(text);
      let body = inline(text);
      const vn = t.match(/^\[Pesan suara, (\d+:\d+)\]$/);
      if (vn) body = `<a class="vn" href="VI-07">${icon('play')}<span class="vn-wave"></span><span>${vn[1]}</span></a>`;
      out += `<div class="bubble ${me ? 'me' : 'them'}${who === last ? ' cont' : ''}">${who !== last && !me ? `<b>${esc(who)}</b>` : ''}<span>${body}</span><time>${time}</time></div>`;
      last = who;
    }
    return out + '<div class="chat-end">Tidak ada pesan lagi sesudahnya.</div></div>';
  }

  function commentsHTML(lines) {
    const rows = lines.filter((l) => l.trim());
    if (!rows.length || !/^\*\*[^*]+\*\* · \d/.test(rows[0])) return null;
    let out = '<div class="comments">';
    for (const l of rows) {
      const rep = l.match(/^\*\*> balasan dari (.+?):\*\* (.+)$/);
      if (rep) { out += `<div class="cmt reply"><div class="cmt-head"><span class="cmt-to">↳ balasan untuk ${esc(unesc(rep[1]))}</span></div><p>${inline(rep[2])}</p></div>`; continue; }
      const m = l.match(/^\*\*(.+?)\*\* · (.+?, \d{1,2}:\d{2}) (.+)$/);
      if (!m) { out += `<p>${inline(l)}</p>`; continue; }
      const user = unesc(m[1]);
      const anon = user === 'anonim';
      out += `<div class="cmt${anon ? ' anon' : ''}"><div class="cmt-head"><span class="avatar">${esc(user[0].toUpperCase())}</span><b>${esc(user)}</b><time>${esc(m[2])}</time></div><p>${inline(m[3])}</p></div>`;
    }
    return out + '</div>';
  }

  // ---------- render ----------
  function renderBlocks(blocks, o = {}) {
    let out = '';
    let pendingTime = null;
    for (const b of blocks) {
      if (b.t === 'h') { out += `<h${b.level}>${inline(b.raw)}</h${b.level}>`; continue; }
      if (b.t === 'hr') { out += '<hr>'; continue; }
      if (b.t === 'table') {
        const [head, ...rows] = b.rows;
        out += `<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        continue;
      }
      if (b.t === 'list') {
        const tag = b.ordered ? 'ol' : 'ul';
        out += `<${tag}>${b.items.map((it) => `<li>${inline(it.raw)}${it.kids.length ? `<${it.kidsOrdered ? 'ol' : 'ul'}>${it.kids.map((k) => `<li>${inline(k)}</li>`).join('')}</${it.kidsOrdered ? 'ol' : 'ul'}>` : ''}</li>`).join('')}</${tag}>`;
        continue;
      }
      if (b.t === 'quote') {
        const special = chatHTML(b.lines, o.me) || commentsHTML(b.lines);
        if (special) { out += special; continue; }
        const inner = parse(b.lines.join('\n'));
        if (inner.length && inner.every((x) => x.t === 'p' && isNote(unesc(x.raw)))) { out += renderBlocks(inner, o); continue; }
        out += `<blockquote>${renderBlocks(inner, { ...o, tape: false })}</blockquote>`;
        continue;
      }
      // paragraph
      const pzm = b.raw.trim().match(/^::puzzle\[([\w-]+)\]$/);
      if (pzm) { out += `<div class="pz-slot" data-pz="${esc(pzm[1])}"></div>`; continue; }
      // the last line of an archive: the station jingle, then the screen goes dark
      if (b.raw.trim() === '::fin') { out += `<div class="fin" data-fin="1" aria-hidden="true"></div>`; continue; }
      const text = unesc(b.raw);
      if (isNote(text)) { out += renderNote(text); continue; }
      if (o.tape) {
        const tm = text.match(/^\**\[(\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?)\]\**\s*/);
        let rest = b.raw, time = pendingTime;
        if (tm) {
          time = tm[1];
          // drop the timecode from the raw text (which may be escaped/bolded)
          rest = b.raw.replace(/^\**(?:&#91;|\\\[|\[)\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\\?\]\**\s*/, '');
          if (!rest.trim()) { pendingTime = time; continue; }
        }
        pendingTime = null;
        const restText = unesc(rest);
        const sfx = isStage(restText);
        const sp = rest.match(/^\*\*([^*]+?)(?::)?\*\*/);
        out += `<div class="cue${sfx ? ' sfx' : ''}" data-len="${restText.length}" data-text="${esc(restText.slice(0, 160))}">
          <span class="cue-t">${time ? esc(time) : ''}</span><div class="cue-b${sp ? ' spk' : ''}">${inline(rest)}</div></div>`;
        continue;
      }
      if (isStage(text)) { out += `<p class="stage">${inline(b.raw)}</p>`; continue; }
      const whole = b.raw.trim();
      const cls = /^\*\*[^*]+\*\*$/.test(whole) ? ' class="p-strong"' : /^\*[^*]+\*$/.test(whole) ? ' class="p-em"' : '';
      out += `<p${cls}>${inline(b.raw)}</p>`;
    }
    return out;
  }

  export { inline, unesc };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const parseMd = (md: string): any[] => parse(md);
  export const blocks = (b: any[], o?: any): string => renderBlocks(b, o || {});
  export const render = (md: string, o?: any): string => renderBlocks(parse(md), o || {});
