/**
 * URLs and media hints from ingested Dialpad SMS rows (body + raw_payload).
 */

const HTTP_URL_RE = /https?:\/\/[^\s<>\][)"']+/gi;

const stripTrailingPunct = (u) => u.replace(/[.,;:!?)]+$/u, '');

/**
 * @param {string | null | undefined} s
 * @returns {string[]}
 */
export const extractUrlsFromText = (s) => {
  if (s == null || typeof s !== 'string') return [];
  const raw = s.match(HTTP_URL_RE) || [];
  return raw.map((u) => stripTrailingPunct(u.trim())).filter(Boolean);
};

/**
 * Pull URL-like strings from nested JSON (shallow walk, cap depth).
 * @param {unknown} v
 * @param {number} depth
 * @returns {string[]}
 */
const collectUrlsFromValue = (v, depth = 0) => {
  if (depth > 4 || v == null) return [];
  if (typeof v === 'string') return extractUrlsFromText(v);
  if (Array.isArray(v)) {
    return v.flatMap((x) => collectUrlsFromValue(x, depth + 1));
  }
  if (typeof v === 'object') {
    const out = [];
    for (const [k, val] of Object.entries(v)) {
      const key = String(k);
      if (
        /url|href|media|image|attachment|thumbnail|src|link/i.test(key) &&
        typeof val === 'string'
      ) {
        out.push(...extractUrlsFromText(val));
      } else {
        out.push(...collectUrlsFromValue(val, depth + 1));
      }
    }
    return out;
  }
  return [];
};

/**
 * @param {Record<string, unknown>} row dialpad_messages row
 * @returns {string[]}
 */
export const extractUrlsFromMessageRow = (row) => {
  const fromBody = extractUrlsFromText(row?.body);
  let raw = row?.raw_payload;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const fromRaw =
    raw && typeof raw === 'object' ? collectUrlsFromValue(raw) : [];
  return [...fromBody, ...fromRaw];
};

/**
 * @param {string} url
 * @returns {boolean}
 */
export const isLikelyMediaUrl = (url) => {
  const u = String(url || '').toLowerCase();
  if (/^data:image\//u.test(u)) return true;
  return /\.(jpe?g|png|gif|webp|bmp|svg|mp4|webm|mov|m4v)(\?|#|$)/u.test(u);
};

/**
 * Unique URLs from thread messages; stable order (first seen).
 * @param {Array<Record<string, unknown>>} threadMessages
 * @returns {{ mediaUrls: string[], linkUrls: string[] }}
 */
export const partitionThreadUrls = (threadMessages) => {
  if (!Array.isArray(threadMessages) || threadMessages.length === 0) {
    return { mediaUrls: [], linkUrls: [] };
  }
  const seen = new Set();
  const ordered = [];
  for (const row of threadMessages) {
    for (const u of extractUrlsFromMessageRow(row)) {
      const n = String(u).trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      ordered.push(n);
    }
  }
  const mediaUrls = [];
  const linkUrls = [];
  for (const u of ordered) {
    if (isLikelyMediaUrl(u)) mediaUrls.push(u);
    else linkUrls.push(u);
  }
  return { mediaUrls, linkUrls };
};
