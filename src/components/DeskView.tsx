'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ic } from './ui';
import { useUI } from './Shell';
import { audio } from '@/lib/audio';
import { fmt, firstAfterStorm, label, pasaran, addDays } from '@/lib/jw';
import { updateDesk, resetProgress } from '@/app/actions';
import { authClient } from '@/lib/auth-client';
import { ReadingSettings } from './ReadingSettings';
import { InstallRow } from './Pwa';

type Props = {
  slug: string; sub: string;
  bekalList: [string, string, string][]; tugas: { code: string; text: string; ok: boolean; link: boolean }[];
  bekal: Record<string, boolean>; board: Record<string, string>; extra: string[]; notes: string; believe: boolean;
  roster: string[][] | null; user: { email: string; name: string } | null; admin: boolean;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DeskView(props: Props) {
  const { slug, sub } = props;
  const router = useRouter();
  const { toast, sheet, closeSheet } = useUI();
  const [, start] = useTransition();
  const [bekal, setBekal] = useState(props.bekal);
  const [board, setBoard] = useState(props.board);
  const [extra, setExtra] = useState(props.extra);
  const [notes, setNotes] = useState(props.notes);
  const [muted, setMuted] = useState(false);
  const [calDate, setCalDate] = useState('');
  const [year, setYear] = useState('1987');
  useEffect(() => { setMuted(!!audio.muted); setCalDate(iso(new Date())); }, []);

  // notes autosave (debounced)
  useEffect(() => {
    if (notes === props.notes) return;
    const t = setTimeout(() => updateDesk(slug, { notes }), 700);
    return () => clearTimeout(t);
  }, [notes, slug, props.notes]);

  const segs: [string, string][] = [['prep', 'Prep'], ['tasks', 'Tasks'], ['board', 'Board 41'], ['pasaran', 'Pasaran'], ['notes', 'Notes']];
  const believe = (on: boolean) => start(async () => {
    await updateDesk(slug, { believe: on });
    toast(on ? '<b>Sekarang kamu bisa melihat mereka.</b><br>Mereka juga bisa melihatmu.' : '<b>Ini cuma cerita.</b> Good.', { ms: on ? 5200 : 2400 });
    router.refresh();
  });

  let body: React.ReactNode = null;
  if (sub === 'prep') {
    body = (
      <>
        <h3 className="sub-h">Reading kit</h3>
        <ul className="checks">{props.bekalList.map(([k, t, why]) => (
          <li key={k}>
            <label><input type="checkbox" checked={!!bekal[k]} onChange={(e) => { const n = { ...bekal, [k]: e.target.checked }; setBekal(n); updateDesk(slug, { bekal: n }); }} /><span className="box" /><span>{t}</span></label>
            <details><summary>Why this?</summary><p>{why}</p></details>
          </li>))}
        </ul>
        <h3 className="sub-h">Account</h3>
        <div className="acct">
          {props.user
            ? <><span>{props.user.email}<small>Progress tersinkron ke semua device.</small></span><button onClick={async () => { await authClient.signOut(); router.refresh(); }}>Sign out</button></>
            : <><span>Belum masuk<small>Progress terikat ke browser ini.</small></span><Link href={`/login?next=/c/${slug}/desk`}>Sign in</Link></>}
        </div>
        {props.admin && <div className="acct"><span>Admin<small>Kelola case, berkas, dan jawaban.</small></span><Link href="/admin">Open CMS</Link></div>}
        <h3 className="sub-h">Reading</h3>
        <ReadingSettings />
        <InstallRow />
        <h3 className="sub-h">Settings</h3>
        <label className="toggle"><span>Sound<small>Desis kaset, dayung, statis.</small></span><input type="checkbox" checked={!muted} onChange={(e) => { audio.setMuted(!e.target.checked); setMuted(!e.target.checked); }} /><span className="sw" /></label>
        <label className="toggle"><span>Aku percaya ini nyata<small>{props.believe ? 'Kamu bisa lihat mereka. Mereka juga.' : 'Biarkan off.'}</small></span><input type="checkbox" checked={props.believe} onChange={(e) => believe(e.target.checked)} /><span className="sw" /></label>
        <button className="toggle" style={{ width: '100%', textAlign: 'left' }} onClick={() => sheet(
          <>
            <h2 className="sh-title">Reset progress?</h2>
            <p className="sh-sub">Semua stamp, catatan, dan nama di amplop akan hilang. This one beneran nggak bisa di-undo.</p>
            <button className="cta" style={{ background: '#111', color: '#fff' }} onClick={() => start(async () => { await resetProgress(slug); closeSheet(); router.push(`/?case=${slug}`); })}>Reset</button>
          </>)}>
          <span>Reset progress<small>Mulai dari nol.</small></span><Ic name="x" />
        </button>
      </>
    );
  } else if (sub === 'tasks') {
    body = (
      <>
        <h3 className="sub-h">Tasks</h3>
        <ul className="checks auto">{props.tugas.map((t) => (
          <li key={t.code} className={t.ok ? 'ok' : ''}><span className="box">{t.ok && <Ic name="check" />}</span>
            <span>{t.text}{t.link && <Link href={`/c/${slug}/d/${t.code}`} className="ref">{t.code}</Link>}</span></li>))}
        </ul>
      </>
    );
  } else if (sub === 'board') {
    if (!props.roster) {
      body = <div className="lockcard" style={{ marginTop: 18 }}><Ic name="lock" /><h2>Board masih kosong</h2><p>Nama-namanya ada di laporan syahbandar. Baca I-02 dulu.</p><Link className="cta" href={`/c/${slug}/d/I-02`}>Open I-02</Link></div>;
    } else {
      const rows = props.roster;
      const cnt = { menunggu: 0, sampai: 0 } as Record<string, number>;
      rows.forEach((r) => { const s = board[r[0]]; if (s) cnt[s]++; });
      const cycle = (n: string) => {
        const cur = board[n] || '';
        const nb = { ...board, [n]: cur === '' ? 'menunggu' : cur === 'menunggu' ? 'sampai' : '' };
        setBoard(nb); updateDesk(slug, { board: nb });
      };
      body = (
        <>
          <p className="desk-note">Tap status: ? → menunggu → sampai. Private, nggak dicek siapa-siapa.</p>
          <div className="board-sum"><span>menunggu {cnt.menunggu}</span><span>sampai {cnt.sampai}</span><span>? {rows.length - cnt.menunggu - cnt.sampai}</span></div>
          <div className="board">{rows.map((r) => {
            const s = board[r[0]] || '';
            return <button key={r[0]} className={`brow ${s}`} onClick={() => cycle(r[0])}><span className="bn">{r[0]}</span><span className="bname">{r[1]}<small>{r[2]} th · {r[4]}</small></span><span className="bs">{s || '?'}</span></button>;
          })}</div>
          <h3 className="sub-h">Yang ikut mendayung</h3>
          <p className="desk-note">Nemu nama di luar daftar syahbandar? Catat di sini.</p>
          <form className="field" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = (f.elements.namedItem('x') as HTMLInputElement).value.trim(); if (!v) return; const n = [...extra, v]; setExtra(n); updateDesk(slug, { extra: n }); f.reset(); }}>
            <input name="x" placeholder="Nama…" autoComplete="off" /><button className="go">Add</button>
          </form>
          <div className="xlist">{extra.map((x, i) => <span key={i} className="xchip">{x}<button aria-label="Hapus" onClick={() => { const n = extra.filter((_, j) => j !== i); setExtra(n); updateDesk(slug, { extra: n }); }}>×</button></span>)}</div>
        </>
      );
    }
  } else if (sub === 'pasaran') {
    const d = calDate ? new Date(calDate + 'T12:00:00') : null;
    const y = Number(year);
    const w = y >= 1880 && y <= 2100 ? firstAfterStorm(y) : null;
    body = (
      <>
        <p className="desk-note">Kalender Jawa: 7 hari × 5 pasaran. Malam Jumat Kliwon datang tiap 35 hari.</p>
        <div className="cal"><label>Date<input type="date" value={calDate} min="1880-01-01" max="2100-12-31" onChange={(e) => setCalDate(e.target.value)} /></label>
          <div className="cal-out">{d && !isNaN(+d) ? `${label(d)}${d.getDay() === 4 && pasaran(addDays(d, 1)) === 'Kliwon' ? ' · malamnya malam Jumat Kliwon' : ''}` : '—'}</div></div>
        <div className="cal"><label>Malam Jumat Kliwon pertama setelah 8 Feb, tahun<input type="number" inputMode="numeric" value={year} min="1880" max="2100" onChange={(e) => setYear(e.target.value)} /></label>
          <div className="cal-out">{w ? `${fmt(w)} · malamnya malam ${label(addDays(w, 1))}` : '—'}</div></div>
        <div className="cal"><span className="lbl">Today</span><div className="cal-out" suppressHydrationWarning>{fmt(new Date())} · {pasaran(new Date())}</div></div>
      </>
    );
  } else {
    body = (
      <>
        <p className="desk-note">Tersimpan di akun/progress kamu. Autosave.</p>
        <textarea className="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nama, umur, tanggal lahir anak-anak…" />
      </>
    );
  }

  return (
    <div className="body grow">
      <div className="segs">{segs.map(([k, t]) => <Link key={k} href={`/c/${slug}/desk/${k}`} className={k === sub ? 'on' : ''}>{t}</Link>)}</div>
      {body}
    </div>
  );
}
