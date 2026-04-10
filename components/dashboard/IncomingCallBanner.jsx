'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIALPAD_CALL_DELTA_EVENT } from '@/lib/dialpadSocket';
import { useSelectedDialpadLineUser } from '@/lib/useDialpadLineSelection';
import {
  dialpadCallDeltaDetailMatchesLineUser,
  callDisplayName,
  liveInboundCallPhaseLabel,
  wasCallConnected,
} from '@/lib/dialpadCallUi';
import { fetchDialpadIngestedCallById } from '@/lib/api';

/**
 * Floating bottom-right card: inbound call progress for the selected Dialpad line.
 * Relies on `dialpad_call_delta` payload including `direction` and `target`.
 */
export default function IncomingCallBanner() {
  const lineUser = useSelectedDialpadLineUser();
  const [incoming, setIncoming] = useState(null);
  const trackCallIdRef = useRef(null);
  const dismissedIdsRef = useRef(new Set());

  const dismiss = useCallback(() => {
    if (incoming?.callId) dismissedIdsRef.current.add(String(incoming.callId));
    trackCallIdRef.current = null;
    setIncoming(null);
  }, [incoming?.callId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !lineUser) return undefined;

    const onCall = (e) => {
      const d = e?.detail || {};
      const dir = String(d.direction || '').toLowerCase();
      if (dir !== 'inbound') return;
      if (!dialpadCallDeltaDetailMatchesLineUser(d, lineUser)) return;

      const cid = d.dialpad_call_id != null ? String(d.dialpad_call_id) : '';
      if (!cid || dismissedIdsRef.current.has(cid)) return;

      const st = String(d.state || '').toLowerCase();
      const rowLike = {
        contact: d.contact && typeof d.contact === 'object' ? d.contact : {},
        external_number: d.external_number || d.external_e164,
      };
      const peerLabel = callDisplayName(rowLike);

      const isTerminal =
        st === 'hangup' || st === 'missed' || st === 'declined' ||
        st === 'recap_summary' || st === 'csat' || st === 'disposition';

      if (isTerminal) {
        setIncoming((prev) => {
          if (!prev || prev.callId !== cid) return prev;
          return {
            ...prev,
            state: d.state,
            sawConnected: Boolean(prev.sawConnected),
          };
        });
        trackCallIdRef.current = null;
        return;
      }

      const isLive =
        st === 'ringing' ||
        st === 'calling' ||
        st === 'connected' ||
        st === 'hold' ||
        st === 'call_transcription' ||
        st === 'transcription';

      if (!isLive) return;

      trackCallIdRef.current = cid;
      setIncoming((prev) => {
        const sawConnected =
          (prev?.callId === cid && Boolean(prev?.sawConnected)) ||
          st === 'connected';
        return {
          callId: cid,
          state: d.state,
          peerLabel,
          sawConnected,
        };
      });
    };

    window.addEventListener(DIALPAD_CALL_DELTA_EVENT, onCall);
    return () => window.removeEventListener(DIALPAD_CALL_DELTA_EVENT, onCall);
  }, [lineUser]);

  useEffect(() => {
    if (!incoming?.callId) return undefined;
    const st = String(incoming.state || '').toLowerCase();
    if (!['hangup', 'missed', 'declined', 'recap_summary', 'csat', 'disposition'].includes(st)) return undefined;
    const t = window.setTimeout(() => {
      trackCallIdRef.current = null;
      setIncoming(null);
    }, 4200);
    return () => clearTimeout(t);
  }, [incoming?.callId, incoming?.state]);

  useEffect(() => {
    if (!incoming?.callId) return undefined;
    const st = String(incoming.state || '').toLowerCase();
    if (['hangup', 'missed', 'declined', 'recap_summary', 'csat', 'disposition'].includes(st)) return undefined;

    const id = incoming.callId;
    const poll = async () => {
      if (trackCallIdRef.current !== id) return;
      try {
        const res = await fetchDialpadIngestedCallById(id);
        if (!res?.success || !res.data) return;
        const row = res.data;
        const lower = String(row.state || '').toLowerCase();
        setIncoming((prev) => {
          if (!prev || prev.callId !== id) return prev;
          return {
            ...prev,
            state: String(row.state),
            sawConnected:
              Boolean(prev.sawConnected) ||
              wasCallConnected(row) ||
              lower === 'connected',
            peerLabel:
              callDisplayName({
                contact:
                  row.contact && typeof row.contact === 'object' ? row.contact : {},
                external_number: row.external_number || row.external_e164,
              }) || prev.peerLabel,
          };
        });
      } catch {
        /* ignore */
      }
    };

    const iv = window.setInterval(poll, 2000);
    poll();
    return () => clearInterval(iv);
  }, [incoming?.callId, incoming?.state]);

  if (!incoming) return null;

  const stLower = String(incoming.state || '').toLowerCase();
  const isTerminal = ['hangup', 'missed', 'declined', 'recap_summary', 'csat', 'disposition'].includes(stLower);
  const isMissed = stLower === 'missed' || stLower === 'declined';

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[100]',
        'w-[min(calc(100vw-3rem),20rem)] rounded-2xl border shadow-lg',
        'border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/90 px-4 py-3',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            isMissed ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700',
          )}
        >
          <Phone
            className={cn('h-5 w-5', !isTerminal && 'animate-pulse')}
            strokeWidth={2}
          />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80">
            Inbound call
          </p>
          <p className="truncate text-[15px] font-bold text-gray-900">
            {incoming.peerLabel || 'Unknown caller'}
          </p>
          <p
            className={cn(
              'mt-0.5 text-[13px] font-semibold',
              isMissed ? 'text-red-700' : 'text-amber-800',
            )}
          >
            {liveInboundCallPhaseLabel(incoming.state, {
              sawConnected: Boolean(incoming.sawConnected),
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-amber-900/50 hover:bg-black/5 hover:text-amber-900"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
