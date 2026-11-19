'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from './Shell';
import { audio } from '@/lib/audio';
import { haptic } from '@/lib/haptics';
import { esc } from '@/lib/esc';
import { solvePuzzle, puzzleHint, tunePuzzle } from '@/app/actions';
import type { PuzzleView } from '@/lib/puzzles';

const KIND_LABEL: Record<string, string> = {
  text: 'Kata kunci', cipher: 'Sandi', padlock: 'Gembok', date: 'Tanggal', order: 'Urutan',
  match: 'Pasangkan', hotspot: 'Tunjuk', frequency: 'Frekuensi', memory: 'Uji ingatan',
};

type Submit = (answer: unknown) => void;

/** A lock/puzzle card. Answers go to the server; the browser never knows the solution. */
export function PuzzleCard({ slug, view }: { slug: string; view: PuzzleView }) {
  const router = useRouter();
  const { toast } = useUI();
  const [pending, start] = useTransition();
  const [solved, setSolved] = useState(view.solved);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(view.solved && view.message ? { ok: true, text: view.message } : null);
  const [stampSvg, setStampSvg] = useState(view.stamp);
  const [hints, setHints] = useState(view.hints);
  const [tokens, setTokens] = useState(view.tokens);
  const [shake, setShake] = useState(0);
  const [shaking, setShaking] = useState(false);
  useEffect(() => { if (!shake) return; setShaking(true); const t = setTimeout(() => setShaking(false), 450); return () => clearTimeout(t); }, [shake]);

  const submit: Submit = (answer) => start(async () => {
    const r = await solvePuzzle(slug, view.key, answer);
    if (r.ok) {
      audio.thud(); audio.tone(660, 0.18); haptic.unlock();
      setSolved(true); setMsg({ ok: true, text: r.message });
      if (r.stamp) { setStampSvg(r.stamp); toast(`<small>Unlocked</small><b>${esc(r.stampTitle || view.title)}</b>`, { stamp: r.stamp, ms: 4200 }); }
      router.refresh();
    } else {
      haptic.wrong(); audio.tone(150, 0.14, 0.1);
      setShake((n) => n + 1); setMsg({ ok: false, text: r.cooldown ? `${r.message} (${r.cooldown}s)` : r.message });
    }
  });
  const hint = () => start(async () => {
    const r = await puzzleHint(slug, view.key);
    setHints(r.hints); setTokens(r.tokens);
    if (!r.ok && r.message) setMsg({ ok: false, text: r.message });
  });

  return (
    <section className={`pz pz-${view.kind}${solved ? ' solved' : ''}${shaking ? ' shake' : ''}`}>
      <header className="pz-head">
        <span className="pz-chip">{KIND_LABEL[view.kind] ?? 'Teka-teki'}</span>
        <span className={`pz-state${solved ? ' ok' : ''}`}>{solved ? 'TERBUKA' : 'TERKUNCI'}</span>
      </header>
      <h4 className="pz-title">{view.title}</h4>
      {view.promptHtml && <div className="pz-prompt" dangerouslySetInnerHTML={{ __html: view.promptHtml }} />}
      {solved ? (
        <div className="pz-done">{stampSvg && <div className="pz-stamp" dangerouslySetInnerHTML={{ __html: stampSvg }} />}<div className="pz-msgs">{(msg?.text || 'Terbuka.').split(/\n\s*\n/).map((t, i) => <p key={i} dangerouslySetInnerHTML={{ __html: inlineMd(t) }} />)}</div></div>
      ) : (
        <>
          <Widget slug={slug} view={view} submit={submit} pending={pending} />
          <div className={`pz-msg${msg?.ok ? ' ok' : ''}`} aria-live="polite">{msg && !msg.ok && <span className="rubber" key={msg.text + shake}>{msg.text}</span>}</div>
          {view.hintTotal > 0 && (
            <div className="pz-hints">
              {hints.map((h, i) => <p key={i}><span>{i + 1}</span>{h}</p>)}
              {hints.length < view.hintTotal && (
                <button className="pz-hintbtn" onClick={hint} disabled={pending}>
                  Clue {hints.length + 1}/{view.hintTotal}{view.hintCost > 0 && tokens !== null ? ` · ${view.hintCost} token (sisa ${tokens})` : ''}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Widget({ slug, view, submit, pending }: { slug: string; view: PuzzleView; submit: Submit; pending: boolean }) {
  const c = view.config as Record<string, unknown>;
  switch (view.kind) {
    case 'padlock': return <Padlock length={Number(c.length) || 4} charset={(c.charset as string) || 'digits'} submit={submit} pending={pending} />;
    case 'date': return <DateDials from={Number(c.from) || 1900} to={Number(c.to) || 2030} submit={submit} pending={pending} />;
    case 'order': return <OrderList items={(c.items as { id: string; text: string }[]) || []} submit={submit} pending={pending} />;
    case 'match': return <MatchPairs left={(c.left as { id: string; text: string }[]) || []} right={(c.right as { id: string; text: string }[]) || []} submit={submit} pending={pending} />;
    case 'hotspot': return <Hotspot image={c.image as string | undefined} art={view.artSvg} alt={(c.alt as string) || ''} submit={submit} pending={pending} />;
    case 'cipher': return <Cipher text={(c.ciphertext as string) || ''} submit={submit} pending={pending} />;
    case 'memory': return <Memory statements={(c.statements as string[]) || []} submit={submit} pending={pending} />;
    case 'frequency': return <Frequency slug={slug} pkey={view.key} min={Number(c.min) || 87.5} max={Number(c.max) || 108} submit={submit} pending={pending} />;
    default: return <TextLock placeholder={(c.placeholder as string) || 'Jawaban…'} submit={submit} pending={pending} />;
  }
}

/** Tiny, safe markdown for result messages: escape, then **bold** and *italic*. */
const inlineMd = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

/**
 * Uji Ingatan: one statement at a time, no back button, three answers. The set goes to the server only
 * when the last one is answered — the key is never in the browser.
 */
function Memory({ statements, submit, pending }: { statements: string[]; submit: Submit; pending: boolean }) {
  const [answers, setAnswers] = useState<string[]>([]);
  const i = answers.length;
  const pick = (a: 'b' | 's' | 't') => {
    haptic.tap(); audio.tone(a === 'b' ? 740 : a === 's' ? 520 : 400, 0.05, 0.05);
    const next = [...answers, a];
    setAnswers(next);
    if (next.length === statements.length) submit(next);
  };
  if (i >= statements.length) return <p className="mem-wait">{pending ? 'Mencocokkan dengan arsip…' : 'Terkirim.'}</p>;
  return (
    <div className="mem">
      <div className="mem-bar"><i style={{ width: `${(i / statements.length) * 100}%` }} /></div>
      <p className="mem-n">Pernyataan {i + 1} dari {statements.length}</p>
      <p className="mem-q" key={i}>{statements[i]}</p>
      <div className="mem-a">
        <button type="button" onClick={() => pick('b')}>Benar</button>
        <button type="button" onClick={() => pick('s')}>Salah</button>
        <button type="button" className="t" onClick={() => pick('t')}>Tidak tahu</button>
      </div>
      <p className="mem-note">Tidak ada tombol kembali. Jawab dari ingatan.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function TextLock({ placeholder, submit, pending }: { placeholder: string; submit: Submit; pending: boolean }) {
  const [v, setV] = useState('');
  return (
    <form className="field" onSubmit={(e) => { e.preventDefault(); if (v.trim()) submit(v.trim()); }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} autoComplete="off" />
      <button className="go" disabled={pending}>{pending ? '…' : 'Coba'}</button>
    </form>
  );
}

/* Padlock: tap ▲▼ or swipe each dial */
function Padlock({ length, charset, submit, pending }: { length: number; charset: string; submit: Submit; pending: boolean }) {
  const chars = charset === 'letters' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '0123456789';
  const [vals, setVals] = useState<number[]>(() => Array(length).fill(0));
  const bump = (i: number, d: number) => { haptic.tap(); audio.tone(900 + i * 40, 0.025, 0.05); setVals((v) => v.map((x, j) => (j === i ? (x + d + chars.length) % chars.length : x))); };
  const startY = useRef<number | null>(null);
  return (
    <div className="padlock">
      <svg className="pl-shackle" viewBox="0 0 120 70" aria-hidden="true"><path d="M25 70 V40 a35 35 0 0 1 70 0 V70" fill="none" stroke="#b8b2a4" strokeWidth="12" strokeLinecap="round" /></svg>
      <div className="pl-body">
        <div className="pl-dials">
          {vals.map((v, i) => (
            <div key={i} className="pl-dial"
              onPointerDown={(e) => { startY.current = e.clientY; }}
              onPointerUp={(e) => { if (startY.current !== null) { const dy = e.clientY - startY.current; if (Math.abs(dy) > 18) bump(i, dy < 0 ? 1 : -1); } startY.current = null; }}>
              <button type="button" aria-label="naik" onClick={() => bump(i, 1)}>▲</button>
              <span className="pl-win"><i>{chars[(v - 1 + chars.length) % chars.length]}</i><b>{chars[v]}</b><i>{chars[(v + 1) % chars.length]}</i></span>
              <button type="button" aria-label="turun" onClick={() => bump(i, -1)}>▼</button>
            </div>
          ))}
        </div>
        <button className="cta yellow pl-open" disabled={pending} onClick={() => submit(vals.map((v) => chars[v]).join(''))}>{pending ? '…' : 'Buka gembok'}</button>
      </div>
    </div>
  );
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function Dial({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  return <div className="dd"><button type="button" onClick={() => { haptic.tap(); onUp(); }} aria-label={`${label} naik`}>▲</button><b>{value}</b><small>{label}</small><button type="button" onClick={() => { haptic.tap(); onDown(); }} aria-label={`${label} turun`}>▼</button></div>;
}
function DateDials({ from, to, submit, pending }: { from: number; to: number; submit: Submit; pending: boolean }) {
  const [d, setD] = useState(1), [m, setM] = useState(0), [y, setY] = useState(Math.round((from + to) / 2));
  return (
    <div className="datedials">
      <div className="dd-row">
        <Dial label="tgl" value={String(d)} onUp={() => setD(d % 31 + 1)} onDown={() => setD(d === 1 ? 31 : d - 1)} />
        <Dial label="bln" value={BULAN[m]} onUp={() => setM((m + 1) % 12)} onDown={() => setM((m + 11) % 12)} />
        <Dial label="thn" value={String(y)} onUp={() => setY(y >= to ? from : y + 1)} onDown={() => setY(y <= from ? to : y - 1)} />
      </div>
      <button className="cta yellow" disabled={pending} onClick={() => submit(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)}>{pending ? '…' : 'Coba tanggal ini'}</button>
    </div>
  );
}

/* Order: drag with a finger or use the arrows */
function OrderList({ items, submit, pending }: { items: { id: string; text: string }[]; submit: Submit; pending: boolean }) {
  const [list, setList] = useState(items);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (i: number, j: number) => { if (j < 0 || j >= list.length) return; haptic.tap(); setList((l) => { const n = l.slice(); const [x] = n.splice(i, 1); n.splice(j, 0, x); return n; }); };
  return (
    <div className="orderlist">
      <ol>
        {list.map((it, i) => (
          <li key={it.id} className={drag === i ? 'dragging' : ''}
            draggable onDragStart={() => setDrag(i)} onDragOver={(e) => { e.preventDefault(); if (drag !== null && drag !== i) { move(drag, i); setDrag(i); } }} onDragEnd={() => setDrag(null)}>
            <span className="ol-n">{i + 1}</span><span className="ol-t">{it.text}</span>
            <span className="ol-btns"><button type="button" onClick={() => move(i, i - 1)} aria-label="naik">▲</button><button type="button" onClick={() => move(i, i + 1)} aria-label="turun">▼</button></span>
          </li>
        ))}
      </ol>
      <button className="cta yellow" disabled={pending} onClick={() => submit(list.map((x) => x.id))}>{pending ? '…' : 'Kunci urutan'}</button>
    </div>
  );
}

/* Match: tap left, then right */
const PAIR_COLORS = ['#f6d33c', '#8fd3c7', '#f29a8e', '#b6a7f5', '#9ed38a', '#f5b56a', '#7fb3f5', '#e58fd0'];
function MatchPairs({ left, right, submit, pending }: { left: { id: string; text: string }[]; right: { id: string; text: string }[]; submit: Submit; pending: boolean }) {
  const [sel, setSel] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const color = (lid: string) => PAIR_COLORS[left.findIndex((l) => l.id === lid) % PAIR_COLORS.length];
  const rightOwner = (rid: string) => Object.entries(pairs).find(([, r]) => r === rid)?.[0];
  return (
    <div className="matchpairs">
      <div className="mp-cols">
        <ul>{left.map((l) => <li key={l.id}><button type="button" className={sel === l.id ? 'sel' : ''} style={pairs[l.id] ? { boxShadow: `inset 4px 0 0 ${color(l.id)}` } : undefined} onClick={() => { haptic.tap(); setSel(l.id); }}>{l.text}</button></li>)}</ul>
        <ul>{right.map((r) => { const o = rightOwner(r.id); return <li key={r.id}><button type="button" style={o ? { boxShadow: `inset -4px 0 0 ${color(o)}` } : undefined} onClick={() => { if (!sel) return; haptic.tap(); setPairs((p) => { const n = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== r.id)); n[sel] = r.id; return n; }); setSel(null); }}>{r.text}</button></li>; })}</ul>
      </div>
      <p className="mp-hint">{sel ? 'Sekarang ketuk pasangannya di kanan.' : 'Ketuk satu di kiri, lalu pasangannya di kanan.'}</p>
      <button className="cta yellow" disabled={pending || Object.keys(pairs).length < left.length} onClick={() => submit(pairs)}>{pending ? '…' : `Kunci pasangan (${Object.keys(pairs).length}/${left.length})`}</button>
    </div>
  );
}

/* Hotspot: tap a place in the picture */
function Hotspot({ image, art, alt, submit, pending }: { image?: string; art?: string; alt: string; submit: Submit; pending: boolean }) {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const place = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    haptic.tap();
    setPt({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 });
  };
  return (
    <div className="hotspot">
      <div className="hs-img" ref={box} onPointerDown={place} role="img" aria-label={alt}>
        {image ? <img src={image} alt={alt} draggable={false} /> : art ? <div dangerouslySetInnerHTML={{ __html: art }} /> : null}
        {pt && <span className="hs-pin" style={{ left: `${pt.x}%`, top: `${pt.y}%` }} />}
      </div>
      <button className="cta yellow" disabled={pending || !pt} onClick={() => pt && submit(pt)}>{pending ? '…' : pt ? 'Di sini' : 'Ketuk bagian gambar'}</button>
    </div>
  );
}

/* Cipher: Caesar wheel + free answer */
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function Cipher({ text, submit, pending }: { text: string; submit: Submit; pending: boolean }) {
  const [shift, setShift] = useState(0);
  const decoded = useMemo(() => text.toUpperCase().replace(/[A-Z]/g, (ch) => ALPHA[(ALPHA.indexOf(ch) - shift + 26) % 26]), [text, shift]);
  const [v, setV] = useState('');
  return (
    <div className="cipher">
      <div className="ci-text">{text}</div>
      <div className="ci-wheel">
        <button type="button" onClick={() => { haptic.tap(); setShift((s) => (s + 25) % 26); }} aria-label="geser kiri">◀</button>
        <div className="ci-ring"><span>A → {ALPHA[(26 - shift) % 26]}</span><b>geser {shift}</b></div>
        <button type="button" onClick={() => { haptic.tap(); setShift((s) => (s + 1) % 26); }} aria-label="geser kanan">▶</button>
      </div>
      <div className="ci-out">{decoded}</div>
      <form className="field" onSubmit={(e) => { e.preventDefault(); if (v.trim()) submit(v.trim()); }}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Tulis pesan yang terbaca…" autoComplete="off" />
        <button className="go" disabled={pending}>{pending ? '…' : 'Coba'}</button>
      </form>
    </div>
  );
}

/* Frequency: drag the needle; the server only says how strong the signal is */
function Frequency({ slug, pkey, min, max, submit, pending }: { slug: string; pkey: string; min: number; max: number; submit: Submit; pending: boolean }) {
  const [f, setF] = useState(Math.round(((min + max) / 2) * 10) / 10);
  const [signal, setSignal] = useState(0);
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { audio.stopStatic(); }, []);
  const tune = (v: number) => {
    setF(v);
    if (!on) { setOn(true); audio.boot(); }
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const r = await tunePuzzle(slug, pkey, v);
      setSignal(r.signal);
      audio.setStatic(0.18 * (1 - r.signal) + 0.01);
      if (r.signal > 0.92) haptic.tap();
    }, 160);
  };
  const ticks = Array.from({ length: Math.round(max - min) + 1 }, (_, i) => min + i);
  return (
    <div className="freq">
      <div className="fq-display"><b>{f.toFixed(1)}</b><span>MHz</span><i className="fq-bars">{[0.2, 0.4, 0.6, 0.8, 0.95].map((x) => <em key={x} className={signal >= x ? 'on' : ''} />)}</i></div>
      <div className="fq-scale">
        {ticks.map((x) => <span key={x} style={{ left: `${((x - min) / (max - min)) * 100}%` }} className={Number.isInteger(x) && x % 2 === 0 ? 'big' : ''}>{Number.isInteger(x) && x % 4 === 0 ? x : ''}</span>)}
        <i className="fq-needle" style={{ left: `${((f - min) / (max - min)) * 100}%` }} />
      </div>
      <input className="fq-range" type="range" min={min} max={max} step={0.1} value={f} onChange={(e) => tune(Number(e.target.value))} aria-label="Frekuensi" />
      <div className="fq-fine"><button type="button" onClick={() => tune(Math.max(min, Math.round((f - 0.1) * 10) / 10))}>−0.1</button><button type="button" onClick={() => tune(Math.min(max, Math.round((f + 0.1) * 10) / 10))}>+0.1</button></div>
      <button className="cta yellow" disabled={pending} onClick={() => { audio.stopStatic(); submit(f); }}>{pending ? '…' : 'Kunci frekuensi'}</button>
    </div>
  );
}
