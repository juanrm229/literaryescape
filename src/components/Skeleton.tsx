/** Shown the instant a link is tapped, while the server prepares the page. */
export function Skeleton({ kind = 'list' }: { kind?: 'list' | 'doc' | 'home' }) {
  if (kind === 'home') {
    return (
      <div className="home"><div className="carousel"><section className="slide"><div className="case-sheet">
        <div className="sk sk-line" style={{ width: '38%', marginBottom: 22 }} /><div className="sk sk-title" />
        {[70, 90, 60, 80].map((w, i) => <div key={i} className="sk sk-line" style={{ width: `${w}%`, margin: '18px 0 0 12px' }} />)}
      </div></section></div><div className="decide"><div className="sk sk-dark sk-title" style={{ margin: '0 auto 12px', width: '60%' }} /></div></div>
    );
  }
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <header className="hcard">
        <div className="hc-row"><span className="sq sk-sq" /><span className="sk sk-pill" /></div>
        {kind === 'doc' && <div className="sk sk-line" style={{ width: 90, marginBottom: 10 }} />}
        <div className="sk sk-title" /><div className="sk sk-line" style={{ width: '55%' }} />
      </header>
      {kind === 'doc'
        ? <div className="doc-body"><div className="sk-paper">{[96, 88, 92, 70, 94, 85, 60].map((w, i) => <div key={i} className="sk sk-line" style={{ width: `${w}%` }} />)}</div></div>
        : <div className="body">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="sk-row"><span className="sk sk-dark sk-box" /><span className="sk sk-dark sk-line" style={{ width: `${55 + (i * 7) % 35}%` }} /></div>)}</div>}
    </div>
  );
}
