import type { Metadata, Viewport } from 'next';
import './docs.css';
import './app.css';
import { Shell } from '@/components/Shell';
import { StatusBar } from '@/components/StatusBar';

export const metadata: Metadata = {
  title: 'postmortem',
  description: 'Case files you solve by reading. Case 01: Nyewu — arsip kabar duka yang belum sampai.',
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a0a0a'/%3E%3Ctext x='7' y='22' font-family='Arial' font-weight='800' font-size='17' fill='%23fff'%3Ep%3C/text%3E%3Ccircle cx='23' cy='19' r='3.4' fill='%23ff5a1f'/%3E%3C/svg%3E" },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'postmortem' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0a0a0a' };

const FONTS = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Courier+Prime:wght@400;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600;700;800&family=Kalam:wght@400;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,600&family=Playfair+Display:wght@900&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <div className="stage">
          <p className="stage-top"><b>postmortem</b> — case files you solve by reading. Satu perkara, satu arsip, satu pintu.</p>
          <div className="device">
            <div className="screen" id="screen">
              <Shell>{children}</Shell>
              <StatusBar />
              <div className="island" aria-hidden="true" />
              <div className="homebar" aria-hidden="true" />
            </div>
          </div>
          <div className="stage-brand">postmortem<i /></div>
          <div className="stage-note"><b>01</b>Case Nyewu</div>
        </div>
      </body>
    </html>
  );
}
