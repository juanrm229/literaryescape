'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Ic, Html } from './ui';
import { ShellSync, useUI } from './Shell';
import { audio } from '@/lib/audio';
import { esc } from '@/lib/esc';
import { acceptCase } from '@/app/actions';
import { joinWaitlist } from '@/app/extra-actions';
import { haptic } from '@/lib/haptics';

export type Slide =
  | { kind: 'live'; slug: string; no: string; title: string; hook: string; tagline: string; today: string; goal: string; audioHint: string; countdown: string; pill: string; wind: string; days: number; docs: number; berkas: number; pct: number; stamps: number; accepted: boolean; sent: boolean; voices: number }
  | { kind: 'sealed'; slug: string; no: string; title: string; tagline: string; seal: string; lines: number[][]; opensAt: string | null; teaser: string | null; waiting: number; onList: boolean; email: string | null };

const pad = (n: number) => String(n).padStart(2, '0');

export function HomeCarousel({ slides, start, signedIn, meInitial = "?" }: { slides: Slide[]; start: number; signedIn: boolean; meInitial?: string }) {
  const car = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(start);
  const [leaving, setLeaving] = useState(false);
  const [, startT] = useTransition();
  const router = useRouter();
  const { sheet, closeSheet, toast } = useUI();
  const cur = slides[idx];

  useEffect(() => {
    const el = car.current; if (!el) return;
    const step = () => el.clientWidth + 10;
    el.scrollLeft = start * step();
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => { clearTimeout(t); t = setTimeout(() => setIdx(Math.round(el.scrollLeft / step())), 60); };
    el.addEventListener('scroll', onScroll, { passive: true });
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea')) return;
      if (e.key === 'ArrowRight') el.scrollTo({ left: Math.min(slides.length - 1, Math.round(el.scrollLeft / step()) + 1) * step(), behavior: 'smooth' });
      if (e.key === 'ArrowLeft') el.scrollTo({ left: Math.max(0, Math.round(el.scrollLeft / step()) - 1) * step(), behavior: 'smooth' });
    };
    document.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('scroll', onScroll); document.removeEventListener('keydown', onKey); };
  }, [start, slides.length]);

  const go = (i: number) => { const el = car.current; if (el) el.scrollTo({ left: i * (el.clientWidth + 10), behavior: 'smooth' }); };

  const take = (slug: string, accepted: boolean) => {
    closeSheet();
    if (accepted) { router.push(`/c/${slug}`); return; }
    audio.thud();
    setLeaving(true);
    startT(async () => {
      await acceptCase(slug);
      setTimeout(() => { router.push(`/c/${slug}`); toast('<small>Case taken</small><b>Mulai dari 0-01.</b> Read it like a fairytale.'); }, 450);
    });
  };

  const waitFor = (s: Extract<Slide, { kind: 'sealed' }>) => {
    haptic.tap();
    sheet(<WaitSheet slug={s.slug} title={s.title} email={s.email} onDone={() => { closeSheet(); haptic.stamp(); toast('<small>Daftar tunggu</small><b>Tercatat.</b> Kami kabari lewat email.'); router.refresh(); }} />);
  };

  const brief = () => {
    if (cur.kind !== 'live') { toast('<b>Still sealed.</b> Case berikutnya lagi disusun.'); return; }
    sheet(
      <>
        <h2 className="sh-title">The brief</h2>
        <p className="sh-sub">Case {cur.no} · {cur.title} — {cur.tagline}</p>
        <ul className="brief-list">
          <li>{cur.docs} dokumen, {cur.berkas} berkas. Kliping, notulen, surat, kaset, chat, skripsi.</li>
          <li>Baca berurutan. Berkas berikutnya kebuka setelah dokumen terakhir berkas sebelumnya.</li>
          <li>Setiap berkas selesai = satu stamp. Setiap kartu kenal = satu stamp.</li>
          <li>Desk nyimpen catatan, board 41 nama, dan kalender pasaran.</li>
          <li>Berkas IX terkunci. The key is a list of names.</li>
        </ul>
        <p className="sh-sub">{signedIn ? 'Progress kamu tersinkron ke akunmu.' : <>Progress tersimpan di server, terikat ke browser ini. <Link href="/login" onClick={closeSheet} style={{ textDecoration: 'underline' }}>Sign in</Link> buat sync ke device lain.</>}</p>
        <button className="cta yellow" onClick={() => take(cur.slug, cur.accepted)}>{cur.accepted ? 'Open the case' : 'Take the case'}</button>
      </>,
    );
  };

  let h = 'Take the case?', p = 'This action cannot be undone. Serius.', ok = true;
  if (cur.kind === 'sealed') { h = cur.onList ? 'Kami kabari.' : 'Still sealed.'; p = cur.onList ? 'Begitu amplopnya dicap, kamu yang pertama tahu.' : 'Tap ✓ untuk masuk daftar tunggu.'; ok = !cur.onList; }
  else if (cur.sent) { h = 'Case closed?'; p = 'Kabar sudah terkirim. Pintu belakang…'; }
  else if (cur.accepted) { h = 'Back to the case?'; p = `${cur.pct}% dibaca · ${cur.stamps} stamps. Progress-mu aman.`; }

  return (
    <div className="home">
      <ShellSync locked />
      <div className="carousel" ref={car}>
        {slides.map((s, i) => (
          <section key={s.slug} className={`slide${s.kind === 'sealed' ? ' sealed' : ''}${i === idx ? ' active' : ''}`}>
            <div className="case-sheet" style={leaving && i === idx ? { animation: 'lift .6s cubic-bezier(.4,0,.2,1) forwards' } : undefined}>
              <div className="cs-top"><span className="wm">postmortem<i /></span><span className="cs-top-r"><span className="cs-count">{pad(i + 1)} / {pad(slides.length)}</span><Link className="cs-me" href="/me" aria-label="Profil">{meInitial}</Link></span></div>
              <div className="cs-title"><h1>{s.title}</h1><span className="cs-no">{s.no}</span></div>
              {s.kind === 'live' ? <LiveTimeline s={s} /> : (
                <>
                  <Html className="stamp-seal" html={s.seal} />
                  {s.lines.map((ws, j) => (
                    <div key={j}><span className="chip-g">??? ?? ???</span><div className="tl-it"><p>{ws.map((w, k) => <span key={k} className="redact" style={{ width: `${w}%` }} />)}</p></div></div>
                  ))}
                  <div className="tl-it"><div className="pcard">
                    <span className="pill" style={{ background: '#e9e8e3', color: '#888' }}>{s.opensAt ? 'Dibuka dalam' : 'Coming soon'}</span>
                    {s.opensAt ? <Countdown at={s.opensAt} /> : null}
                    <p>{s.teaser ?? 'Arsipnya masih disusun. Amplopnya belum dicap.'}</p>
                    <p className="wl-count">{s.onList ? 'Kamu ada di daftar tunggu.' : s.waiting ? `${s.waiting.toLocaleString('id-ID')} orang menunggu amplop ini.` : 'Jadi yang pertama menunggu.'}</p>
                  </div></div>
                </>
              )}
              <div className="fade" /><div className="grabber" />
            </div>
          </section>
        ))}
      </div>
      <div className="decide">
        <div className="dots">{slides.map((_, j) => <i key={j} className={j === idx ? 'on' : ''} />)}</div>
        <h2>{h}</h2><p>{p}</p>
        <div className="dec">
          <button className="db" aria-label="Skip" onClick={() => go((idx + 1) % slides.length)}><Ic name="x" /></button><i /><i />
          <button className="db q" aria-label="Brief" onClick={brief}>?</button><i /><i />
          <button className="db" aria-label="Take the case" aria-disabled={!ok} onClick={() => (cur.kind === 'live' ? take(cur.slug, cur.accepted) : ok ? waitFor(cur) : toast('<b>Sudah di daftar tunggu.</b> Sabar, ya.'))}><Ic name="check" /></button>
        </div>
      </div>
    </div>
  );
}

function LiveTimeline({ s }: { s: Extract<Slide, { kind: 'live' }> }) {
  const { toast } = useUI();
  const [playing, setPlaying] = useState<string | null>(null);
  const demo = (kind: 'song' | 'oars') => {
    audio.boot(); setPlaying(kind);
    if (kind === 'oars') { audio.startOars(0.3); setTimeout(() => { audio.stopOars(); setPlaying(null); }, 8200); }
    else { audio.startHiss(0.05); setTimeout(() => { audio.stopHiss(); setPlaying(null); }, 4000); toast(`<b>${esc(s.audioHint)}</b>`); }
  };
  const Aud = ({ k, av, alt, short, t }: { k: 'song' | 'oars'; av: string; alt?: boolean; short?: boolean; t: string }) => (
    <div className={`aud${playing === k ? ' playing' : ''}`}>
      <span className={`av${alt ? ' alt' : ''}`}>{av}</span>
      <span className="aud-pill"><button className="play-s" aria-label="Play" onClick={() => demo(k)}><Ic name="play" /></button><span className={`wv${short ? ' short' : ''}`} /><svg className="spk" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h4l5-4v14l-5-4H4z" /></svg></span>
      <span className="t">{t}</span>
    </div>
  );
  return (
    <>
      <span className="chip-g">{s.today}</span>
      <div className="tl-it"><p>{s.goal}</p></div>
      <span className="chip-g">THU 8 FEB 1979</span>
      <div className="tl-it"><p>“{s.hook}”</p><Aud k="song" av="K" t="00:34" /><Aud k="oars" av="?" alt short t="00:04" /></div>
      <span className="chip-g">{s.wind}</span>
      <div className="tl-it"><p>{s.countdown}</p><span className="sub"><span className="spin" />{s.days > 0 ? `${s.days} days remaining` : s.days === 0 ? 'tonight' : 'already passed'}</span>
        <div className="pcard"><span className="pill">{s.pill}</span><p>{s.docs} dokumen, {s.berkas} berkas, satu amplop kosong.</p></div>
        <span className="voices"><i />{s.voices.toLocaleString('id-ID')} {s.voices === 1 ? 'reader has' : 'readers have'} sent the kabar</span>
      </div>
    </>
  );
}

/** Live countdown to a sealed case's opening (WIB-agnostic: the instant comes from the server config). */
function Countdown({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(at).getTime() - (now ?? Date.now()));
  const d = Math.floor(ms / 86400e3), h = Math.floor(ms / 3600e3) % 24, m = Math.floor(ms / 60e3) % 60, s = Math.floor(ms / 1e3) % 60;
  return (
    <div className="cd" suppressHydrationWarning>
      {[[d, 'hari'], [h, 'jam'], [m, 'mnt'], [s, 'dtk']].map(([v, l]) => <span key={l as string}><b suppressHydrationWarning>{String(v).padStart(2, '0')}</b><small>{l}</small></span>)}
    </div>
  );
}

function WaitSheet({ slug, title, email, onDone }: { slug: string; title: string; email: string | null; onDone: () => void }) {
  const [val, setVal] = useState(email ?? '');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await joinWaitlist(slug, val); if (r.ok) onDone(); else setErr(r.reason === 'email' ? 'Email-nya belum benar.' : 'Case ini tidak menerima daftar tunggu.'); }); }}>
      <h2 className="sh-title">Kabari aku</h2>
      <p className="sh-sub">{title} masih disegel. Tinggalkan email; satu surat saja, saat amplopnya dicap. Tidak ada newsletter.</p>
      <input className="wl-input" type="email" inputMode="email" autoComplete="email" value={val} onChange={(e) => { setVal(e.target.value); setErr(''); }} placeholder="nama@email.com" required aria-label="Email" />
      {err && <p className="wl-err">{err}</p>}
      <button className="cta yellow" disabled={pending}>{pending ? 'Mencatat…' : 'Masukkan ke daftar tunggu'}</button>
    </form>
  );
}
