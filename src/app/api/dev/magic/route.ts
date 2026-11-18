import { NextResponse } from 'next/server';
import { devMagicLinks } from '@/lib/auth';

/** Development only: read the last magic link for an email when no email provider is configured. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production' || process.env.RESEND_API_KEY) return new NextResponse('Not found', { status: 404 });
  const email = new URL(req.url).searchParams.get('email')?.toLowerCase() ?? '';
  const url = devMagicLinks.get(email);
  return url ? NextResponse.json({ url }) : NextResponse.json({ url: null }, { status: 404 });
}
