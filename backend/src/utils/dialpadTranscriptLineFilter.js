/**
 * Dialpad transcript `lines` mix spoken `type: "transcript"` with `moment` / AI labels
 * (e.g. whole_call_summary, ai_csat_*) that must not appear as conversation text.
 */

/** Only these line types are shown as spoken transcript (Dialpad API v2). */
const SPOKEN_LINE_TYPES = new Set(['transcript']);

/**
 * @param {object} line TranscriptLineProto
 * @returns {boolean}
 */
export const dialpadLineIsSpokenTranscript = (line) => {
  if (!line || typeof line !== 'object') return false;
  const raw = line.type;
  if (raw == null || raw === '') return true;
  const t = String(raw).trim().toLowerCase();
  return SPOKEN_LINE_TYPES.has(t);
};

/**
 * Content Dialpad puts on moment lines or mis-tagged rows — drop from display/storage.
 */
export const dialpadTranscriptContentLooksLikeMomentToken = (content) => {
  const s = String(content ?? '').trim();
  if (!s) return true;
  if (/^(ai_csat|call_purpose_category|whole_call_summary|not_white_listed_moment|price_inquiry)\b/i.test(s)) {
    return true;
  }
  if (/^ai_[a-z0-9_]+$/i.test(s)) return true;
  if (/^[a-z][a-z0-9_]{8,}$/i.test(s) && s.includes('_')) return true;
  if (/^ner$/i.test(s)) return true;
  return false;
};

/**
 * Remove moment-style lines from already-formatted plaintext ("HH:mm · Name: text" per line).
 */
export const filterFormattedDialpadTranscriptPlaintext = (text) => {
  const raw = String(text ?? '');
  if (!raw.trim()) return '';
  const out = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const colon = t.lastIndexOf(': ');
    const spoken = colon >= 0 ? t.slice(colon + 2).trim() : t;
    if (dialpadTranscriptContentLooksLikeMomentToken(spoken)) continue;
    out.push(line);
  }
  return out.join('\n').trim();
};
