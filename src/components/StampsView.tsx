'use client';

import { useState } from 'react';

export type StampItem = { key: string; got: boolean; html: string; name: string; desc: string; href?: string };
export type Collection = { key: string; name: string; desc: string; items: StampItem[] };

export function StampsView({ colls, startColl, startKey }: { colls: Collection[]; startColl: string; startKey?: string }) {
  const [ck, setCk] = useState(colls.some((c) => c.key === startColl) ? startColl : colls[0].key);
  const [featKey, setFeatKey] = useState<string | undefined>(startKey);
  const ci = colls.findIndex((c) => c.key === ck);
  const cur = colls[ci];
  const got = cur.items.filter((x) => x.got);
  const feat = cur.items.find((x) => x.key === featKey && x.got) ?? got[got.length - 1];
  const order = colls.length === 3 ? [colls[(ci + 2) % 3], colls[ci], colls[(ci + 1) % 3]] : colls.length === 2 ? (ci === 0 ? [colls[1], colls[0]] : [colls[0], colls[1]]) : colls;

  return (
    <>
      <div className="album grow">
        <div className="al-top">
          <div className="al-big" key={feat?.key ?? 'none'} dangerouslySetInnerHTML={{ __html: feat ? feat.html : cur.items[0]?.html ?? '' }} />
          <div className="al-cap"><h2>{cur.name}</h2><p>{got.length} stamp{got.length === 1 ? '' : 's'} · of {cur.items.length}</p></div>
        </div>
        <p className="al-desc">{feat ? <><b style={{ color: '#fff' }}>{feat.name}</b> — {feat.desc} {feat.href && <a href={feat.href}>Read {feat.key.split(':')[1]}</a>}</> : cur.desc}</p>
        <div className="al-grid">
          {cur.items.map((x) => (
            <button key={x.key} className={`al-item${feat?.key === x.key ? ' on' : ''}`} disabled={!x.got} aria-label={x.name}
              onClick={() => setFeatKey(x.key)} dangerouslySetInnerHTML={{ __html: x.html }} />
          ))}
        </div>
        <div className="al-why"><b>Kenapa stamp?</b>Di Pakabaran, perangko pernah jadi jangkar: Sumi menempelkannya tiap Kamis, 29 tahun, di amplop beralamat Laut, dan suratnya menahan Kasan di perahu. Di sini perangko bekerja ke arah sebaliknya. Stamp berkas = bukti kamu sudah membaca. Kartu kenal = bukti kamu sudah mengenal. Dan di Berkas IX, stamp yang kamu tulis sendiri adalah kabar: surat terakhir ke alamat yang sama, kali ini untuk melepaskan.</div>
      </div>
      <div className="selector">
        {order.map((c) => {
          const g = c.items.filter((x) => x.got);
          return (
            <button key={c.key} className={`sel${c.key === ck ? ' on' : ''}`} aria-label={c.name} onClick={() => { setCk(c.key); setFeatKey(undefined); }}>
              <span dangerouslySetInnerHTML={{ __html: g.length ? g[g.length - 1].html : c.items[0]?.html ?? '' }} /><small>{c.name}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}
