'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useUI } from './Shell';
import { Ic } from './ui';
import { haptic } from '@/lib/haptics';
import { esc } from '@/lib/esc';
import { askDoc, createRoomAction, joinRoomAction, leaveRoomAction, sendChat, setRoomMode, shareDoc } from '@/app/coop-actions';

type Mem = { id: string; name: string; seat: number; online: boolean; color: string };
type Msg = { id: number; readerId: string; kind: string; text: string; at: string };
type State = { code: string; mode: 'together' | 'split'; shared: string[]; host: boolean; me: string; v: number; members: Mem[]; msgs: Msg[]; unread: number };

/* A tiny external store so the dock and the (separately mounted) sheet see the same live room. */
let state: State | null = null;
const subs = new Set<() => void>();
const set = (s: State | null) => { state = s; subs.forEach((f) => f()); };
const useRoom = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => null);
let sheetOpen = false;

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const time = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`; };
const inviteUrl = (code: string) => `${location.origin}/join/${code}`;

function Avatar({ m, size = 30 }: { m: Mem; size?: number }) {
  return <span className={`rm-av${m.online ? ' on' : ''}`} style={{ width: size, height: size, background: m.color, fontSize: size * 0.38 }} title={m.name}>{initials(m.name)}</span>;
}

/** Floating table dock, mounted by the case layout while the reader sits in a room. Polls; refreshes on shared changes. */
export function RoomDock({ slug, code }: { slug: string; code: string }) {
  const router = useRouter();
  const { toast, sheet } = useUI();
  const room = useRoom();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById('screen')); }, []);

  useEffect(() => {
    let alive = true, after = 0, ver = 0, first = true, timer: ReturnType<typeof setTimeout> | undefined, refresh: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch(`/api/room/${code}?after=${after}`, { cache: 'no-store' });
        if (res.status === 404) { set(null); router.refresh(); return; }
        const d = await res.json();
        if (!alive) return;
        const fresh: Msg[] = d.msgs;
        if (fresh.length) after = fresh[fresh.length - 1].id;
        const others = first ? [] : fresh.filter((m) => m.readerId !== d.me);
        if (others.length && !sheetOpen) {
          const last = others[others.length - 1];
          const who = (d.members as Mem[]).find((m) => m.id === last.readerId);
          toast(last.kind === 'chat' ? `<small>${esc(who?.name ?? 'Meja')}</small>${esc(last.text)}` : `<small>Meja ${esc(code)}</small>${esc(last.text)}`, { ms: 3000 });
          haptic.tap();
        }
        const prev = state;
        set({ code: d.code, mode: d.mode, shared: d.shared, host: d.host, me: d.me, v: d.v, members: d.members,
          msgs: [...(prev && prev.code === d.code ? prev.msgs : []), ...fresh].slice(-120),
          unread: (prev?.unread ?? 0) + (sheetOpen ? 0 : others.filter((m) => m.kind === 'chat' || m.kind === 'ask').length) });
        // someone else changed the shared row (or the table rules): re-render server pages
        if (!first && (d.v !== ver || prev?.mode !== d.mode || prev?.shared.length !== d.shared.length || prev?.members.length !== d.members.length)) {
          clearTimeout(refresh); refresh = setTimeout(() => router.refresh(), 250);
        }
        ver = d.v; first = false;
      } catch { /* offline: try again later */ }
      if (alive) timer = setTimeout(tick, document.visibilityState === 'visible' ? 2500 : 12000);
    };
    tick();
    const onVis = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); tick(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearTimeout(timer); clearTimeout(refresh); document.removeEventListener('visibilitychange', onVis); set(null); };
  }, [code, router, toast]);

  if (!host || !room) return null;
  const open = () => { haptic.tap(); sheetOpen = true; set({ ...room, unread: 0 }); sheet(<RoomSheet slug={slug} />, 'rm-sheet'); };
  return createPortal(
    <button className="rm-dock" onClick={open} aria-label={`Meja ${room.code}, ${room.members.length} pembaca`}>
      <span className="rm-stack">{room.members.map((m) => <Avatar key={m.id} m={m} size={28} />)}</span>
      <span className="rm-code">{room.code}</span>
      {room.unread > 0 && <span className="rm-badge">{room.unread}</span>}
    </button>,
    host,
  );
}

function RoomSheet({ slug }: { slug: string }) {
  const room = useRoom();
  const router = useRouter();
  const { closeSheet, toast } = useUI();
  const [text, setText] = useState('');
  const [, start] = useTransition();
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => () => { sheetOpen = false; }, []);
  useEffect(() => { feed.current?.scrollTo({ top: feed.current.scrollHeight }); }, [room?.msgs.length]);
  if (!room) return <p className="sh-sub">Meja sudah ditutup.</p>;
  const byId = (id: string) => room.members.find((m) => m.id === id);
  const invite = async () => {
    const url = inviteUrl(room.code);
    try {
      if (navigator.share) await navigator.share({ title: 'postmortem — main bareng', text: `Duduk di mejaku. Kode ${room.code}.`, url });
      else { await navigator.clipboard.writeText(url); toast('<b>Link undangan tersalin.</b>'); }
    } catch { /* cancelled */ }
  };
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    setText(''); haptic.tap();
    start(async () => { await sendChat(slug, t); });
  };
  return (
    <div className="rm">
      <div className="rm-head">
        <div><small>Meja</small><b className="rm-big">{room.code}</b></div>
        <button className="pillbtn" onClick={invite}><Ic name="share" /> Undang</button>
      </div>
      <div className="rm-members">{room.members.map((m) => (
        <span key={m.id} className="rm-mem"><Avatar m={m} size={34} /><span>{m.name}{m.id === room.me ? ' (kamu)' : ''}<small>{m.online ? 'online' : 'jauh'}</small></span></span>
      ))}{Array.from({ length: Math.max(0, 4 - room.members.length) }, (_, i) => <span key={i} className="rm-mem empty"><span className="rm-av">+</span><span>Kursi kosong</span></span>)}</div>
      <div className="rm-mode">
        <span>{room.mode === 'split' ? <><b>Terbagi.</b> Tiap orang memegang sebagian dokumen. Ceritakan isinya.</> : <><b>Bareng.</b> Semua dokumen di meja untuk semua.</>}</span>
        {room.host && <button className="ghostbtn" onClick={() => start(async () => { await setRoomMode(slug, room.mode === 'split' ? 'together' : 'split'); router.refresh(); })}>{room.mode === 'split' ? 'Satukan' : 'Bagi dokumen'}</button>}
      </div>
      <div className="rm-feed" ref={feed}>
        {room.msgs.map((m) => {
          const who = byId(m.readerId);
          return m.kind === 'chat'
            ? <div key={m.id} className={`rm-chat${m.readerId === room.me ? ' me' : ''}`}><i style={{ background: who?.color ?? '#777' }} /><div><small>{who?.name ?? 'Pembaca'} · {time(m.at)}</small>{m.text}</div></div>
            : <div key={m.id} className={`rm-log k-${m.kind}`}><span>{time(m.at)}</span>{m.text}</div>;
        })}
        {!room.msgs.length && <p className="rm-empty">Belum ada yang bicara.</p>}
      </div>
      <form className="field rm-say" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis ke meja…" maxLength={300} aria-label="Pesan" /><button className="go">Kirim</button>
      </form>
      <button className="rm-leave" onClick={() => start(async () => { await leaveRoomAction(slug); closeSheet(); router.refresh(); })}>Tinggalkan meja</button>
    </div>
  );
}

/** Desk ▸ Prep: open a table or sit at one. */
export function CoopPanel({ slug, room, defaultName }: { slug: string; room: { code: string; members: number } | null; defaultName: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [pending, start] = useTransition();
  const [name, setName] = useState(defaultName);
  const [mode, setMode] = useState<'together' | 'split'>('together');
  const [fromMine, setFromMine] = useState(true);
  const [code, setCode] = useState('');
  if (room) {
    return (
      <div className="acct"><span>Meja {room.code}<small>{room.members} dari 4 kursi terisi. Progress dibagi bersama.</small></span>
        <button onClick={async () => { const url = inviteUrl(room.code); try { if (navigator.share) await navigator.share({ title: 'postmortem', url }); else { await navigator.clipboard.writeText(url); toast('<b>Link undangan tersalin.</b>'); } } catch { /* */ } }}>Undang</button></div>
    );
  }
  const create = () => start(async () => {
    const r = await createRoomAction(slug, { name, mode, fromMine });
    if (r.ok) { haptic.unlock(); toast(`<small>Meja dibuka</small><b>${r.code}</b> Kirim kodenya ke temanmu.`, { ms: 4200 }); router.refresh(); }
  });
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await joinRoomAction(code, name);
      if (!r.ok) { haptic.wrong(); toast(r.reason === 'full' ? '<b>Meja penuh.</b> Empat kursi sudah terisi.' : '<b>Kode tidak ditemukan.</b>'); return; }
      haptic.stamp();
      if (r.slug && r.slug !== slug) router.push(`/c/${r.slug}`); else router.refresh();
    });
  };
  return (
    <div className="coop">
      <p className="desk-note">Sampai empat orang, satu arsip. Gembok, stamp, dan amplop dibagi bersama. Mode <b>Terbagi</b>: tiap orang memegang dokumen berbeda dan harus saling bercerita.</p>
      <label className="cf"><span>Namamu di meja</span><input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /></label>
      <div className="seg4 coop-mode" role="radiogroup" aria-label="Mode">
        <button type="button" role="radio" aria-checked={mode === 'together'} className={mode === 'together' ? 'on' : ''} onClick={() => setMode('together')}>Bareng</button>
        <button type="button" role="radio" aria-checked={mode === 'split'} className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')}>Terbagi</button>
      </div>
      <label className="toggle"><span>Bawa progress-ku<small>Meja mulai dari yang sudah kamu baca.</small></span><input type="checkbox" checked={fromMine} onChange={(e) => setFromMine(e.target.checked)} /><span className="sw" /></label>
      <button className="cta yellow coop-go" disabled={pending} onClick={create}>{pending ? 'Membuka…' : 'Buka meja'}</button>
      <form className="field" onSubmit={join}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Kode meja · 6 huruf" maxLength={7} autoCapitalize="characters" autoComplete="off" aria-label="Kode meja" />
        <button className="go" disabled={pending || code.replace(/\W/g, '').length < 6}>Duduk</button>
      </form>
    </div>
  );
}

/** /join/[code]: an invite landing. */
export function JoinView({ code, defaultName, caseTitle, members }: { code: string; defaultName: string; caseTitle: string; members: string[] }) {
  const router = useRouter();
  const { toast } = useUI();
  const [name, setName] = useState(defaultName);
  const [pending, start] = useTransition();
  return (
    <div className="body grow">
      <div className="join-card">
        <small>Meja</small><b className="rm-big">{code}</b>
        <p>{members.length ? <>{members.join(', ')} sedang membaca <b>{caseTitle}</b>.</> : <>Meja untuk <b>{caseTitle}</b>.</>} {4 - members.length} kursi tersisa.</p>
      </div>
      <label className="cf"><span>Namamu di meja</span><input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /></label>
      <button className="cta yellow" disabled={pending || members.length >= 4} onClick={() => start(async () => {
        const r = await joinRoomAction(code, name);
        if (!r.ok) { toast(r.reason === 'full' ? '<b>Meja penuh.</b>' : '<b>Meja sudah tidak ada.</b>'); return; }
        haptic.stamp(); router.push(`/c/${r.slug}`);
      })}>{members.length >= 4 ? 'Meja penuh' : pending ? 'Duduk…' : 'Duduk di meja'}</button>
      <Link className="ghostlink" href="/">Nanti saja</Link>
    </div>
  );
}

/** Split mode, someone else holds this document. */
export function HeldDoc({ slug, code, holder }: { slug: string; code: string; holder: { name: string; color: string } }) {
  const { toast } = useUI();
  const [pending, start] = useTransition();
  return (
    <div className="lockcard held">
      <span className="rm-av on" style={{ width: 64, height: 64, fontSize: 24, background: holder.color }}>{initials(holder.name)}</span>
      <h2>Di tangan {holder.name}</h2>
      <p>Mode terbagi: dokumen ini dipegang {holder.name}. Minta dia membacakannya, atau menaruhnya di meja.</p>
      <button className="cta" disabled={pending} onClick={() => start(async () => { await askDoc(slug, code); haptic.tap(); toast(`<b>Permintaan terkirim.</b> ${esc(holder.name)} akan melihatnya di meja.`); })}>Minta dibacakan</button>
    </div>
  );
}

export function ShareToTable({ slug, code }: { slug: string; code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="sq dark rm-table" disabled={pending} aria-label="Taruh di meja" title="Taruh di meja"
      onClick={() => start(async () => { await shareDoc(slug, code); haptic.stamp(); router.refresh(); })}><Ic name="share" /></button>
  );
}
