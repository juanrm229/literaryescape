import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Transactional mail through Resend. Without a key (dev) the message is logged instead. */
export async function sendMail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(`\n[postmortem] mail to ${to}: ${subject}\n`); return { ok: true, dev: true }; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'postmortem <onboarding@resend.dev>', to, subject, html }),
  });
  return { ok: res.ok, error: res.ok ? undefined : (await res.text()).slice(0, 200) };
}

export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The house letterhead: dark ink on paper, one yellow button. */
export function letter(o: { kicker: string; title: string; body: string; cta?: { href: string; label: string }; foot?: string }) {
  return `<div style="background:#0a0a0a;padding:28px 12px;font-family:-apple-system,system-ui,sans-serif">
  <div style="max-width:440px;margin:auto">
    <p style="color:#fff;font-weight:800;font-size:20px;letter-spacing:-.04em;margin:0 0 18px">postmortem<span style="color:#ff5a1f">●</span></p>
    <div style="background:#f7f2e6;color:#2b2a27;border-radius:18px;padding:24px">
      <p style="font:600 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#b5342b;margin:0 0 10px">${escHtml(o.kicker)}</p>
      <h1 style="font:700 24px/1.15 Georgia,serif;margin:0 0 12px">${escHtml(o.title)}</h1>
      <div style="font:400 16px/1.6 Georgia,serif">${o.body}</div>
      ${o.cta ? `<p style="margin:20px 0 0"><a href="${o.cta.href}" style="display:inline-block;background:#f6d33c;color:#221d02;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">${escHtml(o.cta.label)}</a></p>` : ''}
    </div>
    ${o.foot ? `<p style="color:#777;font-size:12px;line-height:1.5;margin:14px 4px">${o.foot}</p>` : ''}
  </div></div>`;
}

const secret = () => process.env.BETTER_AUTH_SECRET || 'dev';
/** Signed, stateless tokens for one-click unsubscribe links. */
export const signToken = (payload: string) => `${Buffer.from(payload).toString('base64url')}.${createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 22)}`;
export function readToken(token: string) {
  const [b, sig] = token.split('.');
  if (!b || !sig) return null;
  const payload = Buffer.from(b, 'base64url').toString();
  const want = createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 22);
  return sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want)) ? payload : null;
}

export const appUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000';
export const validEmail = (s: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(s);
