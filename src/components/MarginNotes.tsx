'use client';

import { useState, useTransition } from 'react';
import { useUI } from './Shell';
import { haptic } from '@/lib/haptics';
import { addNote, deleteNote, docNotesAction, type NoteView } from '@/app/actions';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam`;
  return `${Math.round(h / 24)} hr`;
};

/**
 * Margin notes from other readers. Folded by default (some people want silence), unlocked only once you've
 * read the page, and scrubbed of answers on the server — so it's safe to open.
 */
export function MarginNotes({ slug, code, count, admin }: { slug: string; code: string; count: number; admin: boolean }) {
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NoteView[] | null>(null);
  const [text, setText] = useState('');
  const [pending, start] = useTransition();

  const reveal = () => start(async () => {
    haptic.tap();
    const r = await docNotesAction(slug, code);
    if (!r.ok) { toast('<b>Selesaikan halaman ini dulu.</b> Catatan pinggir terbuka setelah kamu membacanya.'); return; }
    setNotes(r.notes); setOpen(true);
  });
  const post = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    start(async () => {
      const r = await addNote(slug, code, t);
      if (!r.ok) { toast(r.reason === 'limit' ? '<b>Tiga catatan per halaman.</b> Biar pinggirnya tetap lega.' : '<b>Belum bisa menulis di sini.</b>'); return; }
      haptic.stamp(); setText(''); setNotes((n) => [r.note!, ...(n ?? [])]);
    });
  };
  const remove = (id: number) => start(async () => { await deleteNote(slug, id); setNotes((n) => (n ?? []).filter((x) => x.id !== id)); });

  if (!open) {
    return (
      <button className="mn-fold" onClick={reveal} disabled={pending}>
        <span className="mn-ink" aria-hidden="true">✎</span>
        <span><b>Catatan pinggir</b><small>{count ? `${count} pembaca menulis di halaman ini` : 'Belum ada yang menulis di sini'} · aman spoiler</small></span>
        <span className="mn-open">{pending ? '…' : 'Buka'}</span>
      </button>
    );
  }
  return (
    <section className="mn" aria-label="Catatan pinggir">
      <header><b>Catatan pinggir</b><button onClick={() => setOpen(false)}>Lipat</button></header>
      <p className="mn-rule">Nama-nama jawaban dan kunci gembok disensor otomatis: <span className="mn-x">▮▮▮▮</span>. Tulis kesanmu, bukan jawabannya.</p>
      <form className="field" onSubmit={post}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Tulis di pinggir halaman…" aria-label="Catatan" />
        <button className="go" disabled={pending || !text.trim()}>Tulis</button>
      </form>
      <ul className="mn-list">
        {notes?.map((n) => (
          <li key={n.id} className={n.mine ? 'mine' : ''}>
            <p>{n.text}</p>
            <small>{n.mine ? 'kamu' : n.name} · {ago(n.at)}{(n.mine || admin) && <button onClick={() => remove(n.id)}>{n.mine ? 'hapus' : 'sembunyikan'}</button>}</small>
          </li>
        ))}
        {notes && !notes.length && <li className="mn-none">Pinggir halaman ini masih bersih. Jadi yang pertama.</li>}
      </ul>
    </section>
  );
}
