import { normalizeToE164 } from '@/lib/dialpadSmsRecipient';
import { isDialpadTranscriptPlaceholderText } from '@/lib/transcriptDisplay';

/** Match backend `DIALPAD_DECLINE_MAX_RING_MS` (default 12s). */
export const DEFAULT_DECLINE_MAX_RING_MS = 12_000;

export const declineMaxRingMsClient = () => {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DIALPAD_DECLINE_MAX_RING_MS) {
    const n = Number(process.env.NEXT_PUBLIC_DIALPAD_DECLINE_MAX_RING_MS);
    if (Number.isFinite(n) && n >= 1000 && n <= 180_000) return n;
  }
  return DEFAULT_DECLINE_MAX_RING_MS;
};

export const ringDurationMsFromRow = (row) => {
  const end = Number(row?.date_ended ?? 0);
  const rang = Number(row?.date_rang ?? 0);
  if (!Number.isFinite(end) || !Number.isFinite(rang) || end <= 0 || rang <= 0) {
    return null;
  }
  const ms = end - rang;
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms;
};

export const msToDate = (ms) => {
  if (ms == null || ms === '') return null;
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return new Date(n);
};

export const formatCallWhen = (ms, timeZone) => {
  const d = msToDate(ms);
  if (!d) return { date: '—', time: '' };
  const opts = { dateStyle: 'short', timeStyle: 'short' };
  if (timeZone && typeof timeZone === 'string') {
    opts.timeZone = timeZone;
  }
  try {
    const s = d.toLocaleString(undefined, opts);
    const parts = s.split(',');
    return {
      date: parts[0]?.trim() || s,
      time: parts.slice(1).join(',').trim() || '',
    };
  } catch {
    return { date: '—', time: '' };
  }
};

/** One short line for call cards / transcript UI (e.g. Mar 30, 2:45 PM). */
export const formatCallWhenCompact = (ms, timeZone) => {
  const d = msToDate(ms);
  if (!d) return '—';
  const tz = timeZone && typeof timeZone === 'string' ? timeZone : undefined;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  try {
    const opts = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...(sameYear ? {} : { year: 'numeric' }),
    };
    if (tz) opts.timeZone = tz;
    return d.toLocaleString(undefined, opts);
  } catch {
    return '—';
  }
};

/** Transcript panel header: full locale date and time (e.g. Mar 30, 2026, 2:45 PM). */
export const formatCallWhenPanelHeader = (ms, timeZone) => {
  const d = msToDate(ms);
  if (!d) return '—';
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  if (timeZone && typeof timeZone === 'string') {
    opts.timeZone = timeZone;
  }
  try {
    return d.toLocaleString(undefined, opts);
  } catch {
    return '—';
  }
};

export const formatDurationMs = (ms) => {
  if (ms == null || ms === '') return '—';
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const sec = Math.round(n / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m ${s}s`;
  }
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

/** Talk time (merged duration fields). */
export const talkDurationMsForRow = (row) => {
  const d = Number(row?.duration_ms ?? 0);
  const t = Number(row?.total_duration_ms ?? 0);
  const a = Number.isFinite(d) ? d : 0;
  const b = Number.isFinite(t) ? t : 0;
  return Math.max(a, b, 0);
};

/**
 * Transcript applies to answered calls: `duration_ms` &gt; 0, or connected with `total_duration_ms` &gt; 0
 * when talk duration is missing (some Dialpad payloads).
 */
export const hasAnsweredTalkDuration = (row) => {
  const d = Number(row?.duration_ms ?? 0);
  if (Number.isFinite(d) && d > 0) return true;
  const t = Number(row?.total_duration_ms ?? 0);
  if (wasCallConnected(row) && Number.isFinite(t) && t > 0) return true;
  return false;
};

/**
 * Table duration: talk time if any, else ring window (date_ended − date_rang), else em dash.
 */
export const formatCallTableDuration = (row) => {
  const talk = talkDurationMsForRow(row);
  if (talk > 0) return formatDurationMs(talk);
  const ring = ringDurationMsFromRow(row);
  if (ring != null && ring > 0) return formatDurationMs(ring);
  return '—';
};

/**
 * Short “what was this call about” for tables — transcript snippet only; no raw JSON blobs.
 */
export const callAboutPlainText = (row) => {
  const tx = row?.transcription_text != null ? String(row.transcription_text).trim() : '';
  if (tx && !isDialpadTranscriptPlaceholderText(tx)) {
    const oneLine = tx.replace(/\s+/g, ' ').trim();
    return oneLine.slice(0, 240);
  }
  return '';
};

/** Moment / summary tokens Dialpad puts in `lines` — hide from chat timeline preview. */
const DIALPAD_TRANSCRIPT_TIMELINE_SKIP = new RegExp(
  '^(ai_csat|call_purpose_category|whole_call_summary|not_white_listed_moment|price_inquiry)\\b',
  'i',
);

/**
 * Transcript preview for the chat timeline: drops AI summary/moment lines, keeps real speech.
 */
export const callAboutPlainTextForTimeline = (row) => {
  const tx = row?.transcription_text != null ? String(row.transcription_text).trim() : '';
  if (!tx || isDialpadTranscriptPlaceholderText(tx)) return '';
  const parts = [];
  for (const line of tx.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const afterColon = t.includes(':') ? t.slice(t.lastIndexOf(':') + 1).trim() : t;
    if (DIALPAD_TRANSCRIPT_TIMELINE_SKIP.test(afterColon)) continue;
    parts.push(t);
  }
  if (!parts.length) return '';
  const oneLine = parts.join(' ').replace(/\s+/g, ' ').trim();
  return oneLine.slice(0, 240);
};

export const wasCallConnected = (row) => {
  const dc = Number(row?.date_connected ?? 0);
  if (Number.isFinite(dc) && dc > 0) return true;
  const raw = row?.raw_payload;
  if (!raw || typeof raw !== 'object') return false;
  const states = raw.states && typeof raw.states === 'object' ? raw.states : {};
  return Object.keys(states).some((k) => String(k).toLowerCase() === 'connected');
};

/** True when `date_connected` is stored (ms) — used for transcript UI gating. */
export const callHasDateConnected = (row) => {
  const dc = Number(row?.date_connected ?? 0);
  return Number.isFinite(dc) && dc > 0;
};

export const hadMissedCallEvent = (row) => {
  const raw = row?.raw_payload;
  if (!raw || typeof raw !== 'object') return false;
  const states = raw.states && typeof raw.states === 'object' ? raw.states : {};
  return Object.keys(states).some((k) => String(k).toLowerCase() === 'missed');
};

/**
 * Legacy `hangup` rows (no talk, no connect): same ring-threshold rule as backend.
 * @returns {'declined'|'missed'|null}
 */
export const inferUnansweredHangupOutcome = (row) => {
  const st = String(row?.state || '').toLowerCase();
  if (st === 'declined') return 'declined';
  if (st === 'missed') return 'missed';
  if (st !== 'hangup') return null;
  if (wasCallConnected(row)) return null;
  const talk = Math.max(
    Number(row?.duration_ms ?? 0) || 0,
    Number(row?.total_duration_ms ?? 0) || 0,
  );
  if (talk > 0) return null;
  const dc = Number(row?.date_connected ?? 0);
  if (Number.isFinite(dc) && dc > 0) return null;
  const ring = ringDurationMsFromRow(row);
  if (ring == null) return 'missed';
  return ring < declineMaxRingMsClient() ? 'declined' : 'missed';
};

/**
 * In-app status chip: `declined` vs `missed` from stored state or inferred ring time.
 */
export const callUiStatusFromRow = (row) => {
  const st = String(row?.state || '').toLowerCase();
  const d = Number(row?.duration_ms ?? 0);
  const hadConn = wasCallConnected(row);
  const missedHistory = hadMissedCallEvent(row);

  if (hadConn) {
    if (st === 'hangup' || st === 'connected') {
      if (Number.isFinite(d) && d > 0) return 'CONNECTED';
      if (st === 'hangup') return 'CONNECTED';
    }
    return st ? st.toUpperCase() : 'CALL';
  }

  if (st === 'declined') return 'DECLINED';
  if (st === 'missed' || missedHistory) return 'MISSED';

  if (st === 'hangup') {
    const inferred = inferUnansweredHangupOutcome(row);
    return inferred === 'declined' ? 'DECLINED' : 'MISSED';
  }

  return st ? st.toUpperCase() : 'CALL';
};

/** @deprecated Prefer callUiStatusFromRow(row) for correct missed vs declined. */
export const callUiStatus = (state, durationMs) => {
  const st = String(state || '').toLowerCase();
  if (st === 'declined') return 'DECLINED';
  if (st === 'missed') return 'MISSED';
  if (st === 'hangup' || st === 'connected') {
    const d = Number(durationMs);
    if (Number.isFinite(d) && d > 0) return 'CONNECTED';
    if (st === 'hangup' && (!Number.isFinite(d) || d <= 0)) return 'MISSED';
  }
  return st ? st.toUpperCase() : 'CALL';
};

/**
 * Live status while an outbound call is in progress (Dialpad call subscription states).
 * @param {{ sawConnected?: boolean }} [opts] — after `connected`, terminal `hangup` = normal end.
 */
export const liveOutboundCallPhaseLabel = (state, opts = {}) => {
  const st = String(state || '').toLowerCase();
  const sawConnected = Boolean(opts.sawConnected);
  if (st === 'calling') return 'Calling…';
  if (st === 'ringing') return 'Ringing…';
  if (st === 'connected') return 'Picked up';
  if (st === 'hold') return 'On hold';
  if (st === 'hangup') return sawConnected ? 'Call ended' : 'No answer';
  if (st === 'declined') return 'Declined';
  if (st === 'missed') return 'No answer';
  if (st === 'takeover') return 'Transferred';
  if (st === 'call_transcription' || st === 'transcription') return 'Wrapping up…';
  if (st === 'recap_summary' || st === 'csat' || st === 'disposition') return 'Call ended';
  if (!st) return 'Calling…';
  return st.replace(/_/g, ' ');
};

/** Live status for inbound calls (ringing toward the agent’s line). */
export const liveInboundCallPhaseLabel = (state, opts = {}) => {
  const st = String(state || '').toLowerCase();
  const sawConnected = Boolean(opts.sawConnected);
  if (st === 'calling') return 'Incoming call…';
  if (st === 'ringing') return 'Incoming call — ringing…';
  if (st === 'connected') return 'Call connected';
  if (st === 'hold') return 'On hold';
  if (st === 'hangup') return sawConnected ? 'Call ended' : 'Call ended';
  if (st === 'declined') return 'Declined';
  if (st === 'missed') return 'Missed call';
  if (st === 'takeover') return 'Transferred';
  if (st === 'call_transcription' || st === 'transcription') return 'Wrapping up…';
  if (st === 'recap_summary' || st === 'csat' || st === 'disposition') return 'Call ended';
  if (!st) return 'Incoming call…';
  return st.replace(/_/g, ' ');
};

/** Human-readable outcome using full ingested row (declined / missed / hang up after answer). */
export const formatCallStateLabelFromRow = (row) => {
  const st = String(row?.state || '').toLowerCase();
  const d = Number(row?.duration_ms ?? 0);
  const hadConn = wasCallConnected(row);
  const missedHistory = hadMissedCallEvent(row);

  if (hadConn) {
    if (st === 'hangup') {
      if (Number.isFinite(d) && d > 0) return 'Hang up';
      return 'Hang up';
    }
    if (st === 'connected') return 'Connected';
    if (st === 'recap_summary') return 'Hang up';
    return formatCallStateLabel(row?.state, row?.duration_ms);
  }

  if (st === 'declined') return 'Declined';
  if (st === 'missed' || missedHistory) return 'Missed';

  if (st === 'hangup') {
    const inferred = inferUnansweredHangupOutcome(row);
    return inferred === 'declined' ? 'Declined' : 'Missed';
  }

  return formatCallStateLabel(row?.state, row?.duration_ms);
};

/** Human-readable state from Dialpad webhook (connected, hangup, missed, call_transcription, …). */
export const formatCallStateLabel = (state, durationMs) => {
  const st = String(state || '').toLowerCase();
  if (st === 'missed') return 'Missed';
  if (st === 'declined') return 'Declined';
  if (st === 'connected') return 'Connected';
  if (st === 'hangup') {
    const d = Number(durationMs);
    if (Number.isFinite(d) && d > 0) return 'Hang up';
    return 'Missed';
  }
  if (st === 'call_transcription') return 'Transcript ready';
  if (st === 'recap_summary') return 'Hang up';
  if (st === 'ringing') return 'Ringing';
  if (st === 'calling') return 'Calling';
  if (st === 'hold') return 'On hold';
  if (st === 'takeover') return 'Takeover';
  if (st === 'voicemail') return 'Voicemail';
  if (st === 'recording') return 'Recording';
  if (st === 'transcription') return 'Voicemail transcript';
  return st ? st.replace(/_/g, ' ') : '—';
};

export const transcriptPreview = (text, maxLen = 120) => {
  if (text == null || !String(text).trim()) return '';
  const s = String(text).trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
};

/**
 * Call log row matches selected Dialpad company user (line).
 */
/**
 * Match Socket.IO `dialpad_call_delta` detail (after worker enrich) to the selected line.
 */
export const dialpadCallDeltaDetailMatchesLineUser = (detail, lineUser) => {
  if (!lineUser || !detail || typeof detail !== 'object') return false;
  const row = {
    target:
      detail.target && typeof detail.target === 'object' ? detail.target : {},
    internal_number:
      detail.internal_number != null ? String(detail.internal_number) : '',
  };
  return dialpadCallMatchesLineUser(row, lineUser);
};

export const dialpadCallMatchesLineUser = (row, lineUser) => {
  if (!lineUser) return true;
  const agentId = String(lineUser.id || '');
  const t = row.target && typeof row.target === 'object' ? row.target : {};
  if (t.id != null && String(t.id) === agentId) return true;
  const agentPhones = new Set(
    (lineUser.phone_numbers || [])
      .map((p) => normalizeToE164(p))
      .filter(Boolean),
  );
  if (agentPhones.size === 0) return true;
  const targetPhone = normalizeToE164(t.phone);
  if (targetPhone && agentPhones.has(targetPhone)) return true;
  const internalPhone = normalizeToE164(row.internal_number);
  if (internalPhone && agentPhones.has(internalPhone)) return true;
  return false;
};

export const callDisplayName = (row) => {
  const c = row.contact && typeof row.contact === 'object' ? row.contact : {};
  const n = c.name != null ? String(c.name).trim() : '';
  if (n) return n;
  if (row.external_number) return String(row.external_number);
  return 'Unknown';
};

export const callMatchesThread = (row, selectedChatId, peerE164) => {
  if (!selectedChatId && !peerE164) return false;
  if (selectedChatId && row.thread_key === selectedChatId) return true;
  const peer = normalizeToE164(peerE164);
  const ext = normalizeToE164(row.external_e164 || row.external_number);
  if (peer && ext && peer === ext) return true;
  const c = row.contact && typeof row.contact === 'object' ? row.contact : {};
  const cid = c.id != null ? String(c.id) : '';
  if (selectedChatId && cid && selectedChatId === `c:${cid}`) return true;
  return false;
};
