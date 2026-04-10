import { NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/server/backendBase';

export const dynamic = 'force-dynamic';

const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

async function proxy(req: NextRequest, pathSegments: string[]) {
  const backendBase = getBackendBase();
  const sub = pathSegments.join('/');
  const url = `${backendBase}/api/${sub}${req.nextUrl.search}`;

  const h = new Headers(req.headers);
  h.delete('host');

  const init: RequestInit = {
    method: req.method,
    headers: h,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    h.delete('content-length');
    const buf = await req.arrayBuffer();
    if (buf.byteLength) {
      init.body = buf;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      // @ts-ignore
      duplex: 'half',
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          `Cannot reach API at ${backendBase}. Run npm run dev:all, or npm run dev:backend in a second terminal. Set BACKEND_URL in .env.local if needed.`,
        code: 'BACKEND_CONNECTION_FAILED',
      },
      { status: 502 },
    );
  }

  const out = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
  });

  /**
   * Node/undici fetch does not expose Set-Cookie via headers.forEach() — the
   * browser would never receive the auth cookie. Must copy via getSetCookie().
   */
  const setCookieList =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [];
  for (const cookie of setCookieList) {
    out.headers.append('Set-Cookie', cookie);
  }
  if (setCookieList.length === 0) {
    const fallback = res.headers.get('set-cookie');
    if (fallback) {
      out.headers.append('Set-Cookie', fallback);
    }
  }

  res.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (hopByHop.has(lk) || lk === 'set-cookie') return;
    out.headers.append(key, value);
  });

  return out;
}

type RouteCtx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
