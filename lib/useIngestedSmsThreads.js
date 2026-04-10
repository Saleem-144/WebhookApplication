'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchIngestedDialpadMessages } from '@/lib/api';
import { buildThreadsFromRows } from '@/lib/dialpadIngestedThreads';
import { filterRowsByDialpadAgent } from '@/lib/dialpadDirectory';
import { DIALPAD_SMS_DELTA_EVENT } from '@/lib/dialpadSocket';
import { normalizeToE164 } from '@/lib/dialpadSmsRecipient';

const DEBOUNCE_MS = 300;

/**
 * Ingested Dialpad SMS rows + thread list, kept fresh via socket-driven custom event.
 * Optimized: debounced delta reload, stable rows reference when data unchanged.
 * @param {number} limit
 * @param {boolean} enabled When false, skips fetch/listeners (e.g. non-agent sidebar).
 * @param {{ lineUser?: object|null, dialpadUsers?: unknown[], dialpadOffices?: unknown[] }} [scope]
 */
export function useIngestedSmsThreads(limit = 80, enabled = true, scope = {}) {
  const lineUser = scope?.lineUser ?? null;
  const dialpadUsers = scope?.dialpadUsers ?? [];
  const dialpadOffices = scope?.dialpadOffices ?? [];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadInflightRef = useRef(false);
  const deltaTimerRef = useRef(null);
  const rowFingerprintRef = useRef('');

  const load = useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts?.silent);
      if (loadInflightRef.current && silent) return;
      loadInflightRef.current = true;
      try {
        if (!silent) setLoading(true);
        const res = await fetchIngestedDialpadMessages({ limit });
        if (res?.success && Array.isArray(res.data)) {
          const fp = res.data.length + ':' + (res.data[0]?.updated_at ?? '');
          if (fp !== rowFingerprintRef.current) {
            rowFingerprintRef.current = fp;
            setRows(res.data);
          }
        } else if (!silent) {
          setRows([]);
        }
      } catch {
        if (!silent) setRows([]);
      } finally {
        loadInflightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    load();
  }, [load, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onDelta = () => {
      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
      deltaTimerRef.current = setTimeout(() => {
        deltaTimerRef.current = null;
        load({ silent: true });
      }, DEBOUNCE_MS);
    };
    window.addEventListener(DIALPAD_SMS_DELTA_EVENT, onDelta);
    return () => {
      window.removeEventListener(DIALPAD_SMS_DELTA_EVENT, onDelta);
      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
    };
  }, [load, enabled]);

  const scopedRows = useMemo(() => {
    if (!lineUser) return rows;
    return filterRowsByDialpadAgent(rows, lineUser);
  }, [rows, lineUser]);

  const agentPhones = useMemo(() => {
    const set = new Set();
    const nums = lineUser?.phone_numbers;
    if (Array.isArray(nums)) {
      for (const p of nums) {
        const e = normalizeToE164(p);
        if (e) set.add(e);
      }
    }
    // Offices expose their line as a single `number` field
    const single = lineUser?.number;
    if (single) {
      const e = normalizeToE164(single);
      if (e) set.add(e);
    }
    return set;
  }, [lineUser]);

  const allCompanyPhones = useMemo(() => {
    const set = new Set();
    for (const u of dialpadUsers) {
      if (Array.isArray(u.phone_numbers)) {
        for (const p of u.phone_numbers) {
          const e = normalizeToE164(p);
          if (e) set.add(e);
        }
      }
    }
    for (const off of dialpadOffices) {
      // Check phone_numbers array first, then single number field
      if (Array.isArray(off.phone_numbers)) {
        for (const p of off.phone_numbers) {
          const e = normalizeToE164(p);
          if (e) set.add(e);
        }
      } else if (off.number) {
        const e = normalizeToE164(off.number);
        if (e) set.add(e);
      }
    }
    return set;
  }, [dialpadUsers, dialpadOffices]);

  const threads = useMemo(
    () =>
      buildThreadsFromRows(scopedRows, {
        dialpadUsers,
        dialpadOffices,
        agentPhones,
        allCompanyPhones,
      }),
    [scopedRows, dialpadUsers, dialpadOffices, agentPhones, allCompanyPhones],
  );

  return { threads, rows: scopedRows, loading, reload: load };
}
