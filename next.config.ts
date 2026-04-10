import type { NextConfig } from 'next';
import { getBackendBase } from './lib/server/backendBase';

const backendBase = getBackendBase();

/** Browser-visible API origin (Socket.IO, SSR fallbacks). Never hardcode :4000 in app code. */
const nextPublicBackend =
  (process.env.NEXT_PUBLIC_BACKEND_URL || '').trim().replace(/\/$/, '') || backendBase;
const nextPublicSocket =
  (process.env.NEXT_PUBLIC_SOCKET_URL || '').trim().replace(/\/$/, '') || nextPublicBackend;

/**
 * Dev-only: allow tunnel hostnames for HMR, fonts, __nextjs_* from a public URL.
 * Next matches wildcards like *.ngrok-free.dev (see isCsrfOriginAllowed).
 */
const envExtraOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(',')
    .map((h) => h.trim())
    .filter(Boolean) ?? [];

const tunnelPatternsWhenDev =
  process.env.NODE_ENV !== 'production'
    ? (['*.ngrok-free.dev', '*.ngrok.app'] as const)
    : [];

const allowedDevOrigins = [...tunnelPatternsWhenDev, ...envExtraOrigins];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BACKEND_URL: nextPublicBackend,
    NEXT_PUBLIC_SOCKET_URL: nextPublicSocket,
  },
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async rewrites() {
    return [
      { source: '/uploads/:path*', destination: `${backendBase}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
