import { NextResponse, type NextRequest } from 'next/server';

/** Every visitor gets an anonymous reader id; progress is stored against it until they sign in. */
export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  if (!request.cookies.get('pm_reader')) {
    const id = crypto.randomUUID();
    // make it visible to this same request's server components too
    request.cookies.set('pm_reader', id);
    const forwarded = NextResponse.next({ request: { headers: request.headers } });
    forwarded.cookies.set('pm_reader', id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 400 });
    return forwarded;
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|api/auth).*)'],
};
