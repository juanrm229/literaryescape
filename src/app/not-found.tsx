import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <header className="hcard"><h1>Not found</h1><p className="hc-sub">Mungkin laut menyimpannya.</p></header>
      <div className="body"><Link className="cta" href="/">Back home</Link></div>
    </div>
  );
}
