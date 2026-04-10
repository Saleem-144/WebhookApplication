import { NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/server/backendBase';

export const dynamic = 'force-dynamic';

const cookieMaxAgeSeconds = () => {
  const raw = process.env.JWT_EXPIRES_IN || '8';
  const hours = parseInt(raw, 10) || 8;
  return hours * 60 * 60;
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry limit exceeded');
}

/**
 * Proxies login to Express but sets `token` on this origin via Next cookies.
 * Forwarding Set-Cookie from the backend through fetch() is unreliable; the JWT
 * in the JSON body is the source of truth.
 */
export async function POST(req: NextRequest) {
  const backendBase = getBackendBase();
  const body = await req.text();

  let res: Response;
  try {
    res = await fetchWithRetry(`${backendBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    const cause = err instanceof Error && 'cause' in err ? (err as Error & { cause?: { code?: string } }).cause : undefined;
    const code = cause?.code === 'ECONNREFUSED' ? 'ECONNREFUSED' : 'BACKEND_CONNECTION_FAILED';
    console.error(`Login proxy: cannot reach ${backendBase}`, err);
    return NextResponse.json(
      {
        success: false,
        error:
          `Backend is not reachable at ${backendBase}. From the project root run: npm run dev:all (Next + API together), ` +
          'or open two terminals: npm run dev:backend then npm run dev. If the API uses another host/port, set BACKEND_URL in .env.local.',
        code,
      },
      { status: 502 },
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Bad gateway', code: 'BAD_GATEWAY' },
      { status: 502 },
    );
  }

  if (!res.ok || !data?.success || typeof data.token !== 'string') {
    return NextResponse.json(data, { status: res.status });
  }

  const { token, ...safe } = data;
  const out = NextResponse.json(safe, { status: res.status });

  out.cookies.set('token', token as string, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: cookieMaxAgeSeconds(),
    secure: process.env.NODE_ENV === 'production',
  });

  return out;
}
