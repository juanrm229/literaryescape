'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ic } from './ui';
import { useUI } from './Shell';
import { audio } from '@/lib/audio';
import { esc } from '@/lib/esc';
import { placeName, unplace, recite, tembangNext, sendKabar } from '@/app/actions';

export type PlacedStamp = { idx: number; name: string; question: string; html: string; htmlSaid: string; said: boolean };
type Props = {
  slug: string; total: number; placed: PlacedStamp[]; blanks: string[];
  stanzas: { lines: string[]; tr: string }[]; tembangLine: number;
  sent: boolean; believe: boolean; address: string; postmark: string; sayLine: string; sayTranslation: string;
  ritualHtml: string; incompleteHtml: string; believeMsg: string;
};

export function KabarView(props: Props) {
  const { slug, total, placed, stanzas } = props;
  const router = useRouter();
  const { sheet, closeSheet, toast } = useUI();
  const [pending, start] = useTransition();
  const [reply, setReply] = useState<{ ok: boolean; text: string } | null>(null);
  const [justIdx, setJustIdx] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const full = placed.length === total;
  const said = placed.filter((x) => x.said).length;
  const lineCount = stanzas.reduce((n, s) => n + s.lines.length, 0);
  const tembangDone = props.tembangLine >= lineCount;
  const step = !full ? 1 : said < total ? 2 : !tembangDone ? 3 : 4;
  const ready = step === 4 && !props.sent;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.current?.value.trim(); if (!v) return;
    start(async () => {
      const r = await placeName(slug, v);
      if (r.ok) {
        audio.thud(); setReply({ ok: true, text: `${r.name} — stamped.` });
        if (input.current) input.current.value = '';
        router.refresh();
        setJustIdx(placed.length);
      } else {
        setReply({ ok: false, text: r.message });
        input.current?.select();
      }
    });
  };

  const openStamp = (s: PlacedStamp) => {
    sheet(
      <div className="recite">
        <div className="rc-stamp" dangerouslySetInnerHTML={{ __html: s.said ? s.htmlSaid : s.html }} />
        <h2>{s.name}</h2>
        <p className="rc-q">“{s.question}”</p>
        {!full
          ? <button className="ghostbtn" onClick={() => start(async () => { await unplace(slug, s.idx); closeSheet(); router.refresh(); })}>Peel off this stamp</button>
          : s.said ? <p className="muted">Sudah diucapkan.</p>
            : <SayButton line={props.sayLine} tr={props.sayTranslation} onSay={async () => {
              audio.thud();
              await recite(slug, s.idx);
              setTimeout(() => { closeSheet(); router.refresh(); }, 1300);
            }} stampSaid={s.htmlSaid} />}
      </div>,
    );
  };

  const kabari = () => {
    if (props.sent) { router.push(`/c/${slug}/rekaman`); return; }
    if (props.believe) { toast(`<b>${esc(props.believeMsg)}</b>`); return; }
    if (!full) { sheet(<div className="ix05" dangerouslySetInnerHTML={{ __html: props.incompleteHtml }} />, 'sheet-dark'); return; }
    if (said < total) { toast('<b>Ucapkan dulu setiap nama.</b> Tap stamp-nya satu per satu.'); return; }
    if (!tembangDone) { toast('<b>Baca tembangnya sampai selesai.</b>'); return; }
    start(async () => {
      const r = await sendKabar(slug);
      if (!r.ok) { toast('<b>Belum bisa dikirim.</b>'); return; }
      audio.thud(); setSending(true);
      setTimeout(() => router.push(`/c/${slug}/rekaman`), 1300);
    });
  };

  let li = 0;
  return (
    <>
      <div className="body grow">
        <ol className="steps">{['Write', 'Say', 'Sing', 'Send'].map((t, i) => (
          <li key={t} className={step > i + 1 || props.sent ? 'done' : step === i + 1 ? 'on' : ''}><span>{i + 1}</span>{t}</li>))}</ol>
        <section className={`env-form${props.believe ? ' blocked' : ''}`}>
          <div className={`big-env${props.sent ? ' sent' : ''}${sending ? ' sending' : ''}`}>
            <div className="be-head"><div className="be-to"><small>Kepada</small><b>{props.address}</b><span>Pakabaran, Nusa Sewu · yang masih mendayung</span></div>
              <div className="be-pm"><b>PAKABARAN</b><i>{props.postmark}</i></div></div>
            <div className="slots">
              {Array.from({ length: total }, (_, i) => {
                const s = placed[i];
                return s
                  ? <button key={s.idx} className={`slot filled${i === justIdx ? ' just' : ''}`} aria-label={s.name} onClick={() => openStamp(s)} dangerouslySetInnerHTML={{ __html: s.said ? s.htmlSaid : s.html }} />
                  : <span key={'b' + i} className="slot" dangerouslySetInnerHTML={{ __html: props.blanks[i] }} />;
              })}
            </div>
            <div className="be-from">Pengirim: seorang pembaca yang tidak percaya</div>
            {props.sent && <div className="be-cancel">WIS YA</div>}
          </div>
          {step === 1 && !props.sent && (
            <>
              <form className="field" onSubmit={submit}>
                <input ref={input} name="n" placeholder="Tulis satu nama…" autoComplete="off" autoCapitalize="words" disabled={props.believe} />
                <button className="go" disabled={pending}>Tempel</button>
              </form>
              <div className={`reply${reply?.ok ? ' ok' : ''}`} aria-live="polite">{reply && (reply.ok ? reply.text : <span className="rubber" key={reply.text + Math.random()}>{reply.text}</span>)}</div>
              <p className="count"><b>{placed.length}</b>/{total} stamped · tap a stamp to peel it off</p>
            </>
          )}
          {step === 2 && <p className="instr">Tap setiap stamp. Ucapkan namanya pakai suara biasa, kayak anak kecil manggil teman main. <b>{said}/{total}</b></p>}
          {step >= 3 && (
            <div className="tembang"><h3>Tembang Bocah Pesisir</h3>
              {stanzas.map((s, si) => (
                <div className="stanza" key={si}>
                  {s.lines.map((l, k) => { const on = li++ < props.tembangLine; return <p key={k} className={`tl-line${on ? ' on' : ''}`}>{l}</p>; })}
                  {li <= props.tembangLine && <p className="tl-tr">{s.tr}</p>}
                </div>
              ))}
              {step === 3 && <button className="cta" disabled={pending} onClick={() => start(async () => { await tembangNext(slug); router.refresh(); })}>{props.tembangLine === 0 ? 'Start reading' : 'Next line'}</button>}
            </div>
          )}
          {props.believe && <div className="block-msg"><Ic name="eye" /><b>{props.believeMsg}</b></div>}
        </section>
        <details className="ritual-toggle" open={placed.length === 0}>
          <summary>Tata Cara <small>read first</small></summary>
          <article className="doc skin-ritual" dangerouslySetInnerHTML={{ __html: props.ritualHtml }} />
        </details>
      </div>
      <div className="bar2"><button className={`cta${ready || props.sent ? ' yellow' : ' dim'}`} onClick={kabari}>{props.sent ? 'Play the last tape' : 'Kabari'}</button></div>
    </>
  );
}

function SayButton({ line, tr, onSay, stampSaid }: { line: string; tr: string; onSay: () => void; stampSaid: string }) {
  const [done, setDone] = useState(false);
  if (done) return <><p className="said-line">Wis ya.</p><StampSwap html={stampSaid} /></>;
  return <button className="say" onClick={() => { setDone(true); onSay(); }}><span>{line}</span><small>{tr}</small></button>;
}
/** swaps the big stamp in the sheet to its postmarked version */
function StampSwap({ html }: { html: string }) {
  return <span ref={(el) => { const box = el?.closest('.recite')?.querySelector('.rc-stamp'); if (box && box.innerHTML !== html) { box.innerHTML = html; box.classList.add('stamped'); } }} />;
}
