import { query } from '../db/index.js';
import {
  dialpadLineIsSpokenTranscript,
  dialpadTranscriptContentLooksLikeMomentToken,
  filterFormattedDialpadTranscriptPlaintext,
} from '../utils/dialpadTranscriptLineFilter.js';
import { normalizeToE164 } from '../utils/phoneNormalize.js';
import { isDialpadTranscriptPlaceholderText } from '../utils/transcriptPlaceholder.js';
import { dialpadFetch, dialpadTranscriptApiPath } from './dialpadApiFetch.js';
import { getDialpadOfficeUserE164Set } from './dialpadOfficeUserPhones.js';
import {
  getDialpadCallById,
  updateDialpadCallTranscription,
} from './dialpadCallUpsert.js';

/** Time window for finding another DB row that is the same Dialpad call (different leg). */
const INTERNAL_PEER_TIME_WINDOW_MS = 10_000;

/**
 * Co–office extension calls: two rows (one per agent) share the same party pair; start times
 * should be within this window. Real legs of the same call have near-identical date_started
 * values (1-2 seconds). Wider values caused separate calls between the same users to be
 * falsely matched as peers, copying transcripts across calls.
 */
const CO_OFFICE_PEER_WINDOW_MS = 15_000;

/** HH:mm (24h) from Dialpad line.time ISO fragment. */
const shortTimeFromTranscriptIso = (isoFragment) => {
  const raw = String(isoFragment || '').trim();
  if (!raw) return '';
  const normalized = /Z|[+-]\d{2}:?\d{2}$/i.test(raw) ? raw : `${raw}Z`;
  const ms = Date.parse(normalized);
  if (Number.isFinite(ms)) {
    try {
      return new Date(ms).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      /* fall through */
    }
  }
  const m = raw.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : raw.slice(11, 16);
};

/**
 * Dialpad may wrap the proto (e.g. `{ data: { lines } }`) or add new line `type` values.
 */
const normalizeTranscriptApiPayload = (data) => {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.lines)) return data;
  const nested = data.data ?? data.result ?? data.payload;
  if (nested && typeof nested === 'object' && Array.isArray(nested.lines)) {
    return nested;
  }
  if (
    nested?.transcript &&
    typeof nested.transcript === 'object' &&
    Array.isArray(nested.transcript.lines)
  ) {
    return nested.transcript;
  }
  if (
    data.transcript &&
    typeof data.transcript === 'object' &&
    Array.isArray(data.transcript.lines)
  ) {
    return data.transcript;
  }
  return data;
};

/** Spoken / display text on a transcript line (Dialpad uses `content`; some payloads use `text`). */
const transcriptLineContent = (line) => {
  if (!line || typeof line !== 'object') return '';
  const v =
    line.content ??
    line.text ??
    line.body ??
    line.message ??
    line.transcript ??
    line.value;
  if (v == null) return '';
  return String(v).trim();
};

/**
 * Collect `lines` arrays from Dialpad or wrapper shapes (`items`, `utterances`, nested `data`).
 */
const transcriptLinesArrayFromPayload = (data) => {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const tryArr = (v) =>
    Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' ? v : null;

  const root = normalizeTranscriptApiPayload(data);
  const fromRoot = tryArr(root?.lines);
  if (fromRoot) return fromRoot;

  const top = tryArr(data.lines);
  if (top) return top;

  for (const key of ['items', 'utterances', 'results', 'segments']) {
    const a = tryArr(data[key]);
    if (a) return a;
  }

  const inner = data.data;
  if (inner && typeof inner === 'object') {
    const dLines = tryArr(inner.lines);
    if (dLines) return dLines;
    for (const key of ['items', 'utterances', 'results']) {
      const a = tryArr(inner[key]);
      if (a) return a;
    }
  }
  return null;
};

const polishTranscriptPlaintext = (s) =>
  filterFormattedDialpadTranscriptPlaintext(String(s ?? '').trim());

/**
 * Turn Dialpad GET /api/v2/transcripts/{call_id} JSON into plain text for storage.
 */
export const formatDialpadTranscriptPayload = (data) => {
  if (data == null) return '';
  if (typeof data === 'string') {
    const t = data.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const o = JSON.parse(t);
        return formatDialpadTranscriptPayload(o);
      } catch {
        return polishTranscriptPlaintext(t);
      }
    }
    return polishTranscriptPlaintext(t);
  }
  if (typeof data !== 'object') return polishTranscriptPlaintext(String(data));

  const linesArr = transcriptLinesArrayFromPayload(data);
  if (linesArr) {
    const parts = [];
    for (const line of linesArr) {
      if (!line || typeof line !== 'object') continue;
      if (!dialpadLineIsSpokenTranscript(line)) continue;
      const content = transcriptLineContent(line);
      if (!content || dialpadTranscriptContentLooksLikeMomentToken(content)) continue;
      const who = line.name != null ? String(line.name).trim() : '';
      const timeRaw = line.time != null ? String(line.time).trim() : '';
      const time = timeRaw ? shortTimeFromTranscriptIso(timeRaw) : '';
      const head = [time, who].filter(Boolean).join(' · ');
      parts.push(head ? `${head}: ${content}` : content);
    }
    if (parts.length) return polishTranscriptPlaintext(parts.join('\n'));
  }

  const flat = normalizeTranscriptApiPayload(data);
  if (typeof flat?.text === 'string' && flat.text.trim()) {
    return polishTranscriptPlaintext(flat.text.trim());
  }
  if (typeof flat?.transcript === 'string' && flat.transcript.trim()) {
    return polishTranscriptPlaintext(flat.transcript.trim());
  }
  if (typeof data.text === 'string' && data.text.trim()) {
    return polishTranscriptPlaintext(data.text.trim());
  }
  if (typeof data.transcript === 'string' && data.transcript.trim()) {
    return polishTranscriptPlaintext(data.transcript.trim());
  }

  /** Never return raw JSON (e.g. `{ call_id }` only) — that is not user-facing transcript text. */
  return '';
};

/**
 * Dialpad transcripts may be keyed to a different leg than the webhook row
 * (entry point vs operator, transfers / master_call_id). Build an ordered list
 * of numeric call ids to try GET /api/v2/transcripts/{id}.
 */
export const buildTranscriptCandidateCallIds = (primaryId, rawPayload) => {
  const primary = String(primaryId || '').trim();
  const ordered = [];

  const add = (v) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!/^\d+$/.test(s)) return;
    if (ordered.includes(s)) return;
    ordered.push(s);
  };

  add(primary);

  const scan = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    add(obj.entry_point_call_id);
    add(obj.master_call_id);
    add(obj.operator_call_id);
    if (String(obj.call_id || '') !== primary) add(obj.call_id);
  };

  if (rawPayload && typeof rawPayload === 'object') {
    scan(rawPayload.latest);
    if (rawPayload.states && typeof rawPayload.states === 'object') {
      for (const st of Object.values(rawPayload.states)) {
        scan(st);
      }
    }
  }

  return ordered;
};

const parseRawPayload = (raw) => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : null;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Append every related call id found in a single raw_payload (no primary prefix).
 */
const appendRelatedCallIdsFromRaw = (rawPayload, ordered, seen) => {
  const add = (v) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!/^\d+$/.test(s) || seen.has(s)) return;
    seen.add(s);
    ordered.push(s);
  };

  const scan = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    add(obj.entry_point_call_id);
    add(obj.master_call_id);
    add(obj.operator_call_id);
    add(obj.call_id);
  };

  const raw = parseRawPayload(rawPayload);
  if (!raw) return;
  scan(raw.latest);
  if (raw.states && typeof raw.states === 'object') {
    for (const st of Object.values(raw.states)) scan(st);
  }
};

const callStartMsForPeerMatch = (dbRow) => {
  const a = Number(dbRow?.date_started);
  const b = Number(dbRow?.event_timestamp);
  if (Number.isFinite(a) && a > 0) return Math.round(a);
  if (Number.isFinite(b) && b > 0) return Math.round(b);
  return 0;
};

const pickMasterOrGroupCallId = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  const m = obj.master_call_id ?? obj.group_call_id;
  if (m == null) return '';
  const s = String(m).trim();
  return /^\d+$/.test(s) ? s : '';
};

const masterCallIdFromRow = (dbRow) => {
  const raw = parseRawPayload(dbRow?.raw_payload);
  if (!raw || typeof raw !== 'object') return '';
  const fromLatest = pickMasterOrGroupCallId(raw.latest);
  if (fromLatest) return fromLatest;
  if (raw.states && typeof raw.states === 'object') {
    for (const st of Object.values(raw.states)) {
      const x = pickMasterOrGroupCallId(st);
      if (x) return x;
    }
  }
  return pickMasterOrGroupCallId(raw);
};

/** True if merged webhook JSON names this numeric Dialpad call id on another leg. */
const rawPayloadReferencesDialpadCallId = (rawPayload, dialpadCallId) => {
  const id = String(dialpadCallId || '').trim();
  if (!/^\d+$/.test(id)) return false;
  let s = '';
  if (rawPayload && typeof rawPayload === 'object') {
    try {
      s = JSON.stringify(rawPayload);
    } catch {
      return false;
    }
  } else if (typeof rawPayload === 'string') {
    s = rawPayload;
  } else {
    return false;
  }
  if (!s.includes(id)) return false;
  const re = new RegExp(
    `"(?:entry_point_call_id|operator_call_id|master_call_id|group_call_id|call_id)"\\s*:\\s*"?${id}"?`,
    'i',
  );
  return re.test(s);
};

/**
 * Same Dialpad call graph (master / entry / operator legs) — never use phone+thread alone.
 */
const rowsAreDialpadCallGraphPeers = (anchor, other) => {
  const ma = masterCallIdFromRow(anchor);
  const mo = masterCallIdFromRow(other);
  if (ma && mo && ma === mo) return true;

  const oid = String(other?.dialpad_call_id || '').trim();
  const aid = String(anchor?.dialpad_call_id || '').trim();
  if (oid && rawPayloadReferencesDialpadCallId(anchor.raw_payload, oid)) {
    return true;
  }
  if (aid && rawPayloadReferencesDialpadCallId(other.raw_payload, aid)) {
    return true;
  }

  return false;
};

/**
 * Both parties are office lines (from GET /api/v2/users) and this row is one leg of that pair.
 */
const coOfficeEndpointPairKey = (dbRow, officeE164Set) => {
  if (!officeE164Set || officeE164Set.size < 2) return '';
  const int = normalizeToE164(dbRow?.internal_number);
  const ext = normalizeToE164(dbRow?.external_e164 || dbRow?.external_number);
  if (!int || !ext) return '';
  if (!officeE164Set.has(int) || !officeE164Set.has(ext)) return '';
  return [int, ext].sort().join('|');
};

const rowsAreCoOfficeExtensionPeers = (anchor, other, officeE164Set) => {
  const pa = coOfficeEndpointPairKey(anchor, officeE164Set);
  const pb = coOfficeEndpointPairKey(other, officeE164Set);
  if (!pa || !pb || pa !== pb) return false;
  const ta = callStartMsForPeerMatch(anchor);
  const tb = callStartMsForPeerMatch(other);
  if (!ta || !tb) return false;
  return Math.abs(ta - tb) <= CO_OFFICE_PEER_WINDOW_MS;
};

const rowsAreTranscriptPeers = (anchor, other, officeE164Set) => {
  if (rowsAreDialpadCallGraphPeers(anchor, other)) return true;
  if (officeE164Set && rowsAreCoOfficeExtensionPeers(anchor, other, officeE164Set)) {
    return true;
  }
  return false;
};

const fetchNearbyDialpadCallRows = async (excludeDialpadCallId, centerMs, windowMs) => {
  const ex = String(excludeDialpadCallId || '').trim();
  const c = Math.round(Number(centerMs));
  if (!ex || !Number.isFinite(c) || c <= 0) return [];

  const { rows } = await query(
    `
    SELECT
      dialpad_call_id,
      raw_payload,
      thread_key,
      external_e164,
      external_number,
      internal_number,
      contact,
      target,
      date_started,
      event_timestamp,
      transcription_text
    FROM dialpad_calls
    WHERE dialpad_call_id <> $1
      AND COALESCE(date_started, event_timestamp, 0) > 0
      AND ABS(COALESCE(date_started, event_timestamp, 0) - $2::bigint) <= $3
    ORDER BY updated_at DESC
    LIMIT 80
    `,
    [ex, c, windowMs],
  );
  return rows;
};

const appendInternalPeerCandidates = async (dbRow, ordered, seen) => {
  const primaryId = String(dbRow?.dialpad_call_id || '').trim();
  const ds = callStartMsForPeerMatch(dbRow);
  if (!primaryId || ds <= 0) return;

  const windowMs = Math.max(INTERNAL_PEER_TIME_WINDOW_MS, CO_OFFICE_PEER_WINDOW_MS);
  const near = await fetchNearbyDialpadCallRows(primaryId, ds, windowMs);
  let officeE164Set = null;
  try {
    officeE164Set = await getDialpadOfficeUserE164Set();
  } catch {
    officeE164Set = new Set();
  }
  for (const r of near) {
    if (!rowsAreTranscriptPeers(dbRow, r, officeE164Set)) continue;
    appendRelatedCallIdsFromRaw(r.raw_payload, ordered, seen);
    const cid = String(r.dialpad_call_id || '').trim();
    if (/^\d+$/.test(cid) && !seen.has(cid)) {
      seen.add(cid);
      ordered.push(cid);
    }
  }
};

/**
 * Candidate call ids for GET /transcripts: this row’s payload graph only, plus true
 * multi-leg peers (same master_call_id or cross-referenced in raw_payload), plus
 * co–office extension calls where both `internal_number` and the other party are
 * Dialpad user lines from GET /api/v2/users (same party-pair + start time).
 * We do NOT merge by thread_key alone — that matched unrelated customer calls.
 */
export const buildTranscriptCandidateCallIdsForRow = async (dbRow) => {
  if (!dbRow?.dialpad_call_id) return [];
  const primaryId = String(dbRow.dialpad_call_id).trim();
  const rawMain = parseRawPayload(dbRow.raw_payload);
  const ordered = buildTranscriptCandidateCallIds(primaryId, rawMain);
  const seen = new Set(ordered);

  await appendInternalPeerCandidates(dbRow, ordered, seen);

  return ordered;
};

const MIN_TRANSCRIPT_CHARS = 30;

/**
 * If another leg row (same Dialpad call graph) already stored the transcript, reuse it.
 * No thread_key / phone+time SQL — those matched unrelated calls to the same customer.
 */
const borrowTranscriptFromPeerRows = async (dbRow, excludeDialpadCallId) => {
  const exclude = String(excludeDialpadCallId || '').trim();
  const dsRounded = callStartMsForPeerMatch(dbRow);

  if (dsRounded <= 0) return null;

  const windowMs = Math.max(INTERNAL_PEER_TIME_WINDOW_MS, CO_OFFICE_PEER_WINDOW_MS);
  const nearInternal = await fetchNearbyDialpadCallRows(
    exclude,
    dsRounded,
    windowMs,
  );
  let officeE164Set = null;
  try {
    officeE164Set = await getDialpadOfficeUserE164Set();
  } catch {
    officeE164Set = new Set();
  }
  let best = '';
  for (const r of nearInternal) {
    if (!rowsAreTranscriptPeers(dbRow, r, officeE164Set)) continue;
    const tx = filterFormattedDialpadTranscriptPlaintext(
      String(r.transcription_text ?? '').trim(),
    );
    if (
      tx.length > best.length &&
      tx.length > MIN_TRANSCRIPT_CHARS &&
      !isDialpadTranscriptPlaceholderText(tx)
    ) {
      best = tx;
    }
  }
  return best || null;
};

/**
 * Copy transcript onto every known leg row (same ids we would hit via API).
 * Bug 4 fix: only write to rows where transcription_text is currently NULL/empty.
 * Never overwrite a row that already has a valid transcript — this prevents
 * cross-call contamination.
 */
const propagateTranscriptToLegRows = async (candidateCallIds, text, sourceCallId) => {
  const body = String(text || '').trim();
  if (
    body.length < MIN_TRANSCRIPT_CHARS ||
    !candidateCallIds?.length ||
    isDialpadTranscriptPlaceholderText(body)
  ) {
    return;
  }
  const srcId = String(sourceCallId || '').trim();
  const uniq = [
    ...new Set(
      candidateCallIds
        .map((c) => String(c || '').trim())
        .filter((c) => /^\d+$/.test(c)),
    ),
  ];
  for (const cid of uniq) {
    // Never re-write the source row (it was just written)
    if (cid === srcId) continue;
    const row = await getDialpadCallById(cid);
    if (!row) continue;
    const cur = String(row.transcription_text || '').trim();
    // Bug 4: only fill empty slots — never overwrite existing valid text
    if (cur.length > 0 && !isDialpadTranscriptPlaceholderText(cur)) continue;
    await updateDialpadCallTranscription(cid, body);
  }
};

const dialpadTranscriptErrorMessage = (r) => {
  const errMsg =
    (r.data &&
      (r.data.error || r.data.message || r.data.detail || r.data.title)) ||
    `Dialpad returned ${r.status}`;
  return typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
};

/**
 * GET transcript from Dialpad and persist on dialpad_calls when row exists.
 * Tries related call legs (entry_point / operator / master) when the primary id returns empty.
 * @param {{ forceRefresh?: boolean }} [options] If true, skip DB cache and re-hit Dialpad (e.g. ?refresh=1).
 */
export const fetchDialpadTranscriptAndStore = async (callId, options = {}) => {
  const forceRefresh = Boolean(options.forceRefresh);
  const id = String(callId || '').trim();
  if (!id) {
    return { ok: false, status: 400, error: 'callId is required' };
  }

  const existing = await getDialpadCallById(id);
  const cached = String(existing?.transcription_text || '').trim();
  const filteredCached = filterFormattedDialpadTranscriptPlaintext(cached);
  const cacheOk =
    filteredCached.length >= MIN_TRANSCRIPT_CHARS &&
    !isDialpadTranscriptPlaceholderText(filteredCached);
  if (
    existing &&
    filteredCached !== cached &&
    cacheOk
  ) {
    await updateDialpadCallTranscription(id, filteredCached);
  }
  if (!forceRefresh && cacheOk) {
    return {
      ok: true,
      data: null,
      transcription_text: filteredCached,
    };
  }

  const candidates = existing
    ? await buildTranscriptCandidateCallIdsForRow(existing)
    : buildTranscriptCandidateCallIds(id, null);

  // Try the Dialpad API FIRST (do NOT borrow before trying the real source)
  let lastHttpError = null;
  let anyOk = false;

  for (const cand of candidates) {
    let r;
    try {
      r = await dialpadFetch(dialpadTranscriptApiPath(cand));
    } catch (err) {
      const code =
        err && typeof err === 'object' && err.statusCode != null
          ? Number(err.statusCode)
          : 502;
      const status = code >= 400 && code < 600 ? code : 502;
      lastHttpError = {
        ok: false,
        status,
        error: err instanceof Error ? err.message : String(err),
        data: null,
      };
      continue;
    }

    if (!r.ok) {
      const status =
        r.status >= 400 && r.status < 600 ? r.status : 502;
      lastHttpError = {
        ok: false,
        status,
        error: dialpadTranscriptErrorMessage(r),
        data: r.data,
      };
      continue;
    }

    anyOk = true;
    const transcriptionText = formatDialpadTranscriptPayload(r.data);
    if (transcriptionText) {
      if (existing) {
        await updateDialpadCallTranscription(id, transcriptionText);
        await propagateTranscriptToLegRows(candidates, transcriptionText, id);
      }
      return {
        ok: true,
        data: r.data,
        transcription_text: transcriptionText,
        resolved_from_call_id: cand !== id ? cand : undefined,
      };
    }
  }

  // API returned nothing — fallback: try to borrow from a true peer row (same call graph)
  if (existing) {
    const borrowed = await borrowTranscriptFromPeerRows(existing, id);
    if (borrowed) {
      await updateDialpadCallTranscription(id, borrowed);
      await propagateTranscriptToLegRows(candidates, borrowed, id);
      return {
        ok: true,
        data: null,
        transcription_text: borrowed,
        from_peer_row: true,
      };
    }
  }

  if (anyOk) {
    return {
      ok: true,
      data: null,
      transcription_text: '',
    };
  }

  return (
    lastHttpError || {
      ok: false,
      status: 502,
      error: 'Could not reach Dialpad transcript API.',
    }
  );
};

/** Dialpad AI transcript is often ready only seconds after hangup — retry a few times. */
const TRANSCRIPT_HYDRATE_RETRY_DELAYS_MS = [
  800, 5000, 20000, 60000, 120_000, 240_000,
];

/**
 * Bug 3 fix (corrected): dateConnected guard applies ONLY to 'hangup' state.
 * Dialpad post-call states (call_transcription, transcription, recap_summary)
 * are only ever sent for answered calls, so they should always trigger transcript fetch.
 * Requiring dateConnected for those states was causing missed fetches when the
 * merged row didn't yet have dateConnected populated.
 */
const shouldScheduleTranscriptHydration = (callRow) => {
  if (!callRow?.dialpadCallId) return false;
  const st = String(callRow.state || '').toLowerCase();
  // These post-call states always mean the call was answered — fetch unconditionally
  if (st === 'call_transcription' || st === 'transcription' || st === 'recap_summary') {
    return true;
  }
  // For hangup, only fetch if the call was actually connected
  if (st === 'hangup') {
    const dc = Number(callRow?.dateConnected ?? 0);
    return Number.isFinite(dc) && dc > 0;
  }
  return false;
};

/**
 * Bug 1 fix: Directly fetch transcript for the given call_id.
 * No re-reading the DB row to check if transcript exists — just fetch.
 * The cache check inside fetchDialpadTranscriptAndStore handles the early-return.
 */
const hydrateOnceIfNeeded = async (dialpadCallId) => {
  const id = String(dialpadCallId || '').trim();
  if (!id) return;
  await fetchDialpadTranscriptAndStore(id);
};

/**
 * After call webhooks, best-effort transcript pull (non-blocking) with retries.
 * Bug 1 fix: passes the exact call_id from the webhook directly through.
 * Bug 3 fix: only runs when dateConnected is set (call was answered).
 */
export const maybeScheduleTranscriptHydration = (callRow) => {
  if (!shouldScheduleTranscriptHydration(callRow)) return;

  // Bug 1: use the exact call_id from the webhook payload
  const id = String(callRow.dialpadCallId || '').trim();
  if (!id) return;

  const run = () => {
    hydrateOnceIfNeeded(id).catch((err) => {
      console.error(
        '[Dialpad transcript hydrate]',
        id,
        err instanceof Error ? err.message : err,
      );
    });
  };

  setImmediate(run);
  for (const ms of TRANSCRIPT_HYDRATE_RETRY_DELAYS_MS) {
    setTimeout(run, ms);
  }
};
