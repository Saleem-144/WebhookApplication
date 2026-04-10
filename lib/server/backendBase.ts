/**
 * Express origin for Next server-side proxy (Route Handlers, rewrites, public env).
 * Set BACKEND_URL in root .env.local (and in production). Fallback is dev-only (IPv4 on Windows).
 */
export function getBackendBase(): string {
  const fromEnv = (process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return 'http://127.0.0.1:4000';
}
