import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { nextCookies } from 'better-auth/next-js';
import { headers } from 'next/headers';
import { db, schema } from '@/db';

/** Dev helper: when no email provider is configured, the last magic link per email lives here. */
const g = globalThis as unknown as { pmMagic?: Map<string, string> };
export const devMagicLinks = (g.pmMagic ??= new Map<string, string>());

async function sendEmail(to: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    devMagicLinks.set(to.toLowerCase(), url);
    console.log(`\n[postmortem] magic link for ${to}:\n${url}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'postmortem <onboarding@resend.dev>',
      to,
      subject: 'Your link to the archive',
      html: `<div style="font-family:system-ui;max-width:420px;margin:auto;padding:24px">
        <p style="font-weight:800;font-size:20px;letter-spacing:-.04em">postmortem<span style="color:#ff5a1f">●</span></p>
        <p>Tap to open the archive. The link expires in 10 minutes.</p>
        <p><a href="${url}" style="display:inline-block;background:#f6d33c;color:#221d02;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Open the archive</a></p>
        <p style="color:#888;font-size:12px">Kalau kamu tidak minta link ini, abaikan saja. Ini cuma cerita.</p></div>`,
    }),
  });
  if (!res.ok) throw new Error('Email failed: ' + (await res.text()));
}

const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
  : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: google,
  plugins: [
    magicLink({ expiresIn: 600, sendMagicLink: async ({ email, url }) => sendEmail(email, url) }),
    nextCookies(),
  ],
});

export const googleEnabled = !!google;

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}
