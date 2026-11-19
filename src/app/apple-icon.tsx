import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <span style={{ color: '#fff', fontSize: 112, fontWeight: 800, lineHeight: 1 }}>p</span>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#ff5a1f', marginLeft: 4, marginTop: 40 }} />
      </div>
    ),
    size,
  );
}
