/**
 * Build E.164 `to_numbers` for Dialpad SMS from ingested thread rows.
 */

export const normalizeToE164 = (input) => {
  if (input == null || input === '') return null;
  const s = String(input).trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
};

/** US national format for sidebar/profile; falls back to E.164. */
export const formatE164USNational = (input) => {
  const e = normalizeToE164(input);
  if (!e) return '';
  const digits = e.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const a = digits.slice(1, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7, 11);
    return `(${a}) ${b}-${c}`;
  }
  if (digits.length === 10) {
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 6);
    const c = digits.slice(6, 10);
    return `(${a}) ${b}-${c}`;
  }
  return e;
};

/** Match Dialpad webhook nesting (same idea as dialpadDirectory.parseRowRawPayload). */
const unwrapDialpadPayload = (obj) => {
  if (!obj || typeof obj !== 'object') return {};
  if (obj.data && typeof obj.data === 'object' && obj.data.id != null) return obj.data;
  if (obj.sms && typeof obj.sms === 'object' && obj.sms.id != null) return obj.sms;
  return obj;
};

const rawPayloadObj = (row) => {
  const raw = row?.raw_payload;
  let obj = null;
  if (raw && typeof raw === 'object') obj = raw;
  else if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj) return {};
  return unwrapDialpadPayload(obj);
};

/**
 * @param {Array<Record<string, unknown>>} threadRows rows for one thread (from getThreadMessages)
 * @param {Set<string>} [agentPhones] Optional set of office numbers to avoid picking as recipient.
 * @returns {string[]|null}
 */
export const recipientNumbersFromThreadRows = (threadRows, agentPhones = new Set()) => {
  if (!Array.isArray(threadRows) || threadRows.length === 0) return null;

  const tryRow = (r) => {
    const p = rawPayloadObj(r);
    const dir = String(r.direction || p.direction || '').toLowerCase();

    if (dir === 'inbound') {
      const candidates = [
        r.from_number,
        p.from_number,
        p.sender?.phone,
        p.contact?.phone,
      ];
      for (const c of candidates) {
        const e = normalizeToE164(c);
        if (e && !agentPhones.has(e)) return e;
      }
      // If sender is an agent, try recipient if it's not an agent
      const toList = Array.isArray(p.to_numbers) ? p.to_numbers : [p.to_number];
      for (const t of toList) {
        const e = normalizeToE164(t);
        if (e && !agentPhones.has(e)) return e;
      }
    } else if (dir === 'outbound') {
      // Slim API rows expose sms_to_first from SQL (raw to_numbers not in row)
      const candidates = [
        r.sms_to_first,
        Array.isArray(p.to_numbers) ? p.to_numbers[0] : null,
        p.to_number,
        p.recipient_phone,
        p.target?.phone,
        p.target?.phone_number,
        p.contact?.phone,
      ];
      for (const c of candidates) {
        const e = normalizeToE164(c);
        if (e && !agentPhones.has(e)) return e;
      }
      // If recipient is an agent, try sender if it's not an agent
      const eFrom = normalizeToE164(r.from_number || p.from_number);
      if (eFrom && !agentPhones.has(eFrom)) return eFrom;
    }

    // Fallback: any number that is not the selected Dialpad line (From)
    const fallback = [
      r.sms_to_first,
      r.from_number,
      p.from_number,
      p.to_number,
      Array.isArray(p.to_numbers) ? p.to_numbers[0] : null,
      p.contact?.phone,
    ];
    for (const c of fallback) {
      const e = normalizeToE164(c);
      if (e && !agentPhones.has(e)) return e;
    }

    // If both are agents, pick the one that ISN'T the current agent line
    const fromVal = normalizeToE164(r.from_number || p.from_number);
    const toVal =
      normalizeToE164(r.sms_to_first) ||
      normalizeToE164(Array.isArray(p.to_numbers) ? p.to_numbers[0] : p.to_number);
    if (fromVal && toVal) {
      const isFromCurrent = agentPhones.has(fromVal);
      const isToCurrent = agentPhones.has(toVal);
      if (isFromCurrent && !isToCurrent) return toVal;
      if (!isFromCurrent && isToCurrent) return fromVal;
    }

    // Internal chat: two company numbers — pick the one that is not the current line
    for (const c of fallback) {
      const e = normalizeToE164(c);
      if (e && agentPhones.size > 0 && !agentPhones.has(e)) return e;
    }
    for (const c of fallback) {
      const e = normalizeToE164(c);
      if (e) return e;
    }

    return null;
  };

  const inbound = threadRows.filter(
    (r) => String(r.direction || '').toLowerCase() === 'inbound',
  );
  const scan = inbound.length ? inbound : threadRows;
  for (let i = scan.length - 1; i >= 0; i--) {
    const e = tryRow(scan[i]);
    if (e) return [e];
  }

  const outbound = threadRows.filter(
    (r) => String(r.direction || '').toLowerCase() === 'outbound',
  );
  for (let i = outbound.length - 1; i >= 0; i--) {
    const row = outbound[i];
    const p = rawPayloadObj(row);
    const to =
      row.sms_to_first ||
      (Array.isArray(p.to_numbers) ? p.to_numbers[0] : null) ||
      p.to_number;
    const e = normalizeToE164(to);
    if (e && !agentPhones.has(e)) return [e];
  }

  return null;
};
