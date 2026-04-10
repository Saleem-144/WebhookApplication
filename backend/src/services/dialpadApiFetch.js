/**
 * Shared Dialpad Admin API v2 fetch (Bearer DIALPAD_API_KEY).
 *
 * Transcripts (same as Dialpad docs):
 *   GET {base}/api/v2/transcripts/{call_id}
 *   Headers: Accept: application/json, Authorization: Bearer <api_key>
 * Base: DIALPAD_API_BASE — e.g. https://dialpad.com or https://sandbox.dialpad.com
 */

export const getDialpadApiBase = () =>
  (process.env.DIALPAD_API_BASE || 'https://sandbox.dialpad.com').replace(/\/$/, '');

/** @param {string|number} callId Dialpad call id (keep large ids as string). */
export const dialpadTranscriptApiPath = (callId) => {
  const id = String(callId ?? '').trim();
  if (!id) return '/api/v2/transcripts/';
  return `/api/v2/transcripts/${encodeURIComponent(id)}`;
};

export const dialpadFetch = async (path, options = {}, retries = 2) => {
  const key = process.env.DIALPAD_API_KEY?.trim();
  if (!key) {
    const err = new Error('DIALPAD_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const url = `${getDialpadApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${key}`,
    ...options.headers,
  };
  if (options.body != null) {
    headers['content-type'] = 'application/json';
  }

  let lastError;
  for (let i = 0; i <= retries; i++) {
    if (i > 0) {
      console.log(`[Dialpad API] Retry ${i}/${retries} for ${path}...`);
      // Wait a bit before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, i * 500));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      // If Dialpad returns 5xx or 429 (rate limit), retry
      if (!res.ok && (res.status >= 500 || res.status === 429) && i < retries) {
        console.warn(`[Dialpad API] ${path} failed with ${res.status}. Retrying...`);
        continue;
      }

      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (i < retries) {
        const isTimeout = err.name === 'AbortError';
        console.error(`[Dialpad API] ${path} fetch ${isTimeout ? 'timeout' : 'error'}: ${err.message}. Retrying...`);
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${path} after ${retries} retries`);
};
