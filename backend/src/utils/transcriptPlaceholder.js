/**
 * Dialpad sometimes stores or returns JSON like `{ "call_id": "..." }` with no `lines`.
 * That must not count as a real transcript (it wrongly satisfied MIN length checks).
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
