import { ImageResponse } from 'next/og';

/** App icon: the "p" + the lighthouse dot, generated so it stays crisp at any size. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = Math.min(1024, Math.max(32, Number(raw) || 512));
  const maskable = new URL(req.url).searchParams.get('maskable') === '1';
  const pad = maskable ? size * 0.12 : 0;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', borderRadius: maskable ? 0 : size * 0.22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', padding: pad }}>
          <span style={{ color: '#ffffff', fontSize: size * 0.62, fontWeight: 800, lineHeight: 1, letterSpacing: -size * 0.03 }}>p</span>
          <span style={{ width: size * 0.15, height: size * 0.15, borderRadius: '50%', background: '#ff5a1f', marginLeft: size * 0.02, marginBottom: size * 0.09 }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=604800, immutable' } },
  );
}
