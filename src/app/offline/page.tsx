import Link from 'next/link';

export const dynamic = 'force-static';

export default function Offline() {
  return (
    <div className="page">
      <header className="hcard"><span className="chip-g">offline</span><h1>Tidak ada sinyal.</h1><p className="hc-sub">Seperti di tengah laut. Dokumen yang sudah pernah dibuka tetap bisa dibaca.</p></header>
      <div className="body"><Link className="cta" href="/">Coba lagi</Link></div>
    </div>
  );
}
