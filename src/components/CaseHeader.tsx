import Link from 'next/link';
import { Back, ClueButton } from './ui';
import type { CaseBundle, Progress } from '@/lib/game';

export function CaseHeader({ c, p, tab }: { c: CaseBundle; p: Progress; tab: 'archive' | 'desk' | 'stamps' }) {
  const tabs: [typeof tab, string, string][] = [['archive', 'Archive', `/c/${c.slug}`], ['desk', 'Desk', `/c/${c.slug}/desk`], ['stamps', 'Stamps', `/c/${c.slug}/stamps`]];
  return (
    <>
      <header className="hcard">
        <div className="hc-row"><Back href={`/?case=${c.slug}`} /><ClueButton slug={c.slug} hints={c.config.hints} shown={p.data.hintsShown} /></div>
        <h1>{c.title}</h1>
        <p className="hc-sub">{c.tagline}.</p>
      </header>
      <nav className="tabs2">{tabs.map(([k, t, h]) => <Link key={k} href={h} className={k === tab ? 'on' : ''}>{t}</Link>)}</nav>
    </>
  );
}
