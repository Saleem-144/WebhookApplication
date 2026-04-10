import { NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/server/backendBase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const backendBase = getBackendBase();
  const cookie = req.headers.get('cookie');

  let res: Response;
  try {
    res = await fetch(`${backendBase}/api/auth/logout`, {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
  } catch {
    res = new Response(JSON.stringify({ success: true, message: 'Logged out (API offline)' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    data = { success: true, message: 'Logged out' };
  }

  const out = NextResponse.json(data, {
    status: res.ok ? 200 : res.status,
  });

  out.cookies.set('token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });

  return out;
}
