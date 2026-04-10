/**
 * Same logic as backend `transcriptPlaceholder.js` — JSON `{ call_id }` without lines is not a transcript.
 */
export const isDialpadTranscriptPlaceholderText = (raw) => {
  const s = String(raw ?? '').trim();
  if (s.length < 2 || !s.startsWith('{')) return false;
  let o;
  try {
    o = JSON.parse(s);
  } catch {
    return false;
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const hasLines = Array.isArray(o.lines) && o.lines.length > 0;
  if (hasLines) return false;
  const texty =
    (typeof o.text === 'string' && o.text.trim().length > 0) ||
    (typeof o.transcript === 'string' && o.transcript.trim().length > 0);
  if (texty) return false;
  return o.call_id != null || o.callId != null;
};

/**
 * Short time for transcript lines (optional; not used when showing full timestamps).
 */
export const formatIsoFragmentToShortTime = (isoFragment) => {
  const raw = String(isoFragment || '').trim();
  if (!raw) return '';
  const normalized = /Z|[+-]\d{2}:?\d{2}$/i.test(raw) ? raw : `${raw}Z`;
  const ms = Date.parse(normalized);
  if (Number.isFinite(ms)) {
    try {
      return new Date(ms).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      /* fall through */
    }
  }
  const m = raw.match(/T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  return raw.length > 8 ? raw.slice(11, 16) : raw;
};

/** Show transcript body as stored (full date/time prefixes preserved). */
export const formatTranscriptBodyForDisplay = (text) => {
  if (text == null || text === '') return '';
  return String(text);
};
