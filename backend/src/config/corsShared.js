/**
 * Shared CORS for Express + Socket.IO.
 * Connection targets should use 127.0.0.1; browser Origin may still be localhost:3000 or ngrok.
 */
const isNgrokHost = (hostname) =>
  hostname.endsWith('.ngrok-free.dev') ||
  hostname.endsWith('.ngrok.app') ||
  hostname.endsWith('.ngrok.io');

export const corsOriginCallback = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  const raw = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) {
    callback(null, true);
    return;
  }

  const ngrokPublic = (process.env.NGROK_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (ngrokPublic && origin === ngrokPublic) {
    callback(null, true);
    return;
  }

  const extraHosts =
    process.env.ALLOWED_DEV_ORIGINS?.split(',').map((h) => h.trim()).filter(Boolean) ?? [];

  if (process.env.NODE_ENV !== 'production') {
    try {
      const u = new URL(origin);
      const { hostname, protocol } = u;

      if (protocol === 'http:' && hostname === '127.0.0.1') {
        callback(null, true);
        return;
      }
      if (protocol === 'http:' && hostname === 'localhost') {
        callback(null, true);
        return;
      }
      if (
        (protocol === 'https:' || protocol === 'http:') &&
        isNgrokHost(hostname)
      ) {
        callback(null, true);
        return;
      }
      if (extraHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
        callback(null, true);
        return;
      }
    } catch {
      /* ignore */
    }
  }

  callback(null, false);
};
