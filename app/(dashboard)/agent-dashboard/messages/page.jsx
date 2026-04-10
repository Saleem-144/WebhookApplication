'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  Fragment,
} from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import useDialpadLineStore from '@/store/dialpadLineStore';
import useContactStore from '@/store/contactStore';
import {
  fetchIngestedDialpadMessages,
  fetchIngestedDialpadCalls,
  fetchDialpadIngestedCallById,
  initiateDialpadCall,
} from '@/lib/api';
import {
  formatDialpadWhen,
  threadKey as threadKeyFromRow,
} from '@/lib/dialpadIngestedThreads';
import {
  chatDaySeparatorLabel,
  chatDayKey,
  getRelativeTimeShort,
} from '@/lib/chatDateLabels';

const formatMsgWhen = (isoOrMs, tz) => {
  if (isoOrMs == null || isoOrMs === '') return '—';
  const iso =
    typeof isoOrMs === 'number'
      ? new Date(isoOrMs).toISOString()
      : String(isoOrMs);
  return formatDialpadWhen(iso, tz);
};
import {
  peerE164FromRow,
  threadLabelWithDirectory,
  resolveThreadPeerProfile,
  primarySendFromNumber,
  buildPhoneToDialpadUserMap,
} from '@/lib/dialpadDirectory';
import {
  wasCallConnected,
  callMatchesThread,
  dialpadCallMatchesLineUser,
  liveOutboundCallPhaseLabel,
  callAboutPlainTextForTimeline,
} from '@/lib/dialpadCallUi';
import {
  normalizeToE164,
  recipientNumbersFromThreadRows,
} from '@/lib/dialpadSmsRecipient';
import {
  DIALPAD_SMS_DELTA_EVENT,
  DIALPAD_CALL_DELTA_EVENT,
} from '@/lib/dialpadSocket';
import {
  useEffectiveDialpadLineUserId,
  useSelectedDialpadLineUser,
} from '@/lib/useDialpadLineSelection';
import { cn } from '@/lib/utils';
import {
  Search,
  MoreVertical,
  Phone,
  User,
  X,
  Check,
  CheckCheck,
  Copy,
  Star,
  Trash2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import DialpadSmsComposer from '@/components/messages/DialpadSmsComposer';
import VirtualTimeline from '@/components/messages/VirtualTimeline';
import { useIngestedSmsThreads } from '@/lib/useIngestedSmsThreads';
import { useMarkThreadNotificationsRead } from '@/lib/useMarkThreadNotificationsRead';

/** Dropdown for individual message actions. */
function MessageMenu({
  menuKey,
  isOpen,
  setOpenKey,
  outbound,
  text,
  dialpadId,
  onToggleStar,
  starred,
  variant = 'sms',
  msg = null,
  optimistic = null,
  displayTz,
}) {
  const dotBtn =
    'p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none';

  return (
    <div className="relative" data-msg-menu-root>
      <button
        type="button"
        className={cn(
          dotBtn,
          outbound
            ? 'text-white/90 hover:bg-white/15'
            : 'text-gray-500 hover:bg-gray-100',
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Message info and actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpenKey(isOpen ? null : menuKey);
        }}
      >
        <MoreVertical className="h-4 w-4" strokeWidth={2} />
      </button>
      {isOpen ? (
        <div
          className={cn(
            'absolute top-0 z-[60] w-max min-w-[220px] max-w-[min(calc(100vw-2rem),320px)] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-[#1e293b] shadow-xl',
            outbound
              ? 'right-full mr-1'
              : 'left-full ml-1',
          )}
          role="menu"
        >
          <div className="max-h-[min(50vh,280px)] overflow-y-auto border-b border-gray-100 px-3 py-2 custom-scrollbar">
            {variant === 'optimistic' && optimistic ? (
              <div className="space-y-2 text-[12px] leading-tight">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" strokeWidth={2.5} />
                  <span className="font-bold text-gray-800">Sent</span>
                  <span className="min-w-0 text-gray-600 [overflow-wrap:anywhere]">
                    {formatMsgWhen(optimistic.createdAt, displayTz)}
                  </span>
                </div>
                <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                  <CheckCheck
                    className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                    strokeWidth={2.5}
                  />
                  <span className="font-bold text-gray-800">Delivered</span>
                  <span className="text-gray-400">—</span>
                </div>
              </div>
            ) : null}
            {variant === 'sms' && msg && outbound ? (
              <div className="space-y-2 text-[12px] leading-tight">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" strokeWidth={2.5} />
                  <span className="font-bold text-gray-800">Sent</span>
                  <span className="min-w-0 text-gray-600 [overflow-wrap:anywhere]">
                    {formatMsgWhen(msg.created_at || msg.updated_at, displayTz)}
                  </span>
                </div>
                <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                  <CheckCheck
                    className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                    strokeWidth={2.5}
                  />
                  <span className="font-bold text-gray-800">Delivered</span>
                  <span className="min-w-0 text-gray-600 [overflow-wrap:anywhere]">
                    {formatMsgWhen(msg.updated_at, displayTz)}
                  </span>
                </div>
              </div>
            ) : null}
            {variant === 'sms' && msg && !outbound ? (
                <div className="flex items-center gap-2 text-[12px] leading-tight">
                <span className="font-bold text-gray-800">Received</span>
                <span className="min-w-0 text-gray-600 [overflow-wrap:anywhere]">
                  {formatMsgWhen(msg.updated_at || msg.created_at, displayTz)}
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-semibold text-[#334155] hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard?.writeText(text);
              setOpenKey(null);
            }}
          >
            <Copy className="h-4 w-4 shrink-0 text-gray-500" />
            Copy text
          </button>
          {dialpadId ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-semibold text-[#334155] hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(dialpadId);
                setOpenKey(null);
              }}
            >
              <Star
                className={cn('h-4 w-4 shrink-0', starred && 'fill-amber-400 text-amber-500')}
                strokeWidth={2}
              />
              {starred ? 'Remove star' : 'Star message'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function AgentMessagesPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const dialpadUsers = useDialpadLineStore((s) => s.users);
  const dialpadOffices = useDialpadLineStore((s) => s.offices);
  const selectedAgent = useSelectedDialpadLineUser();
  const effectiveLineUserId = useEffectiveDialpadLineUserId();
  const [selectedChatId, setSelectedChatId] = useState('');
  
  const { threads, rows, loading, reload: loadMessages } = useIngestedSmsThreads(100, true, {
    lineUser: selectedAgent,
    dialpadUsers,
    dialpadOffices,
  });

  const [loadError, setLoadError] = useState('');
  const prevLineUserIdRef = useRef(null);
  const chatScrollRef = useRef(null);
  const profileScrollRef = useRef(null);
  const chatBottomSentinelRef = useRef(null);
  const loadInflightRef = useRef(false);
  const callsInflightRef = useRef(false);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const urlCleanupTimerRef = useRef(null);

  const [showProfile, setShowProfile] = useState(true);
  const [openSections, setOpenSections] = useState({
    summary: true,
    stars: false,
    media: false,
    links: false,
    ai: false,
    notes: true,
    salesforce: false,
  });

  const { fetchContacts, getContactName, setCustomName, deleteConversation, contacts } = useContactStore();

  useEffect(() => {
    if (contacts.length === 0) {
      fetchContacts();
    }
  }, [fetchContacts, contacts.length]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [profileClock, setProfileClock] = useState(0);
  const [callRows, setCallRows] = useState([]);
  const [callActionBusy, setCallActionBusy] = useState(false);
  const [outboundLive, setOutboundLive] = useState(null);
  const outboundTrackRef = useRef(null);
  const outboundDismissTimerRef = useRef(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const [optimisticByChat, setOptimisticByChat] = useState({});
  const [starredIds, setStarredIds] = useState(() => new Set());
  const [openMessageMenuKey, setOpenMessageMenuKey] = useState(null);
  const [pulseDialpadId, setPulseDialpadId] = useState('');
  const [pulseCallId, setPulseCallId] = useState('');
  const [starredCatalogVersion, setStarredCatalogVersion] = useState(0);

  const [historyMessages, setHistoryMessages] = useState([]);
  const [historyCalls, setHistoryCalls] = useState([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);

  const clearOutboundDismissTimer = useCallback(() => {
    if (outboundDismissTimerRef.current != null) {
      clearTimeout(outboundDismissTimerRef.current);
      outboundDismissTimerRef.current = null;
    }
  }, []);

  const resetHistory = useCallback(() => {
    setHistoryMessages([]);
    setHistoryCalls([]);
    setHasMoreHistory(true);
    setLoadingMoreHistory(false);
  }, []);

  useEffect(() => {
    resetHistory();
  }, [selectedChatId, resetHistory]);

  const loadCalls = useCallback(async () => {
    if (callsInflightRef.current) return;
    callsInflightRef.current = true;
    try {
      const res = await fetchIngestedDialpadCalls({ limit: 150 });
      if (res?.success && Array.isArray(res.data)) {
        setCallRows(res.data);
      }
    } catch {
      /* ignore */
    } finally {
      callsInflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onDelta = () => loadMessages({ silent: true });
    window.addEventListener(DIALPAD_SMS_DELTA_EVENT, onDelta);
    return () => window.removeEventListener(DIALPAD_SMS_DELTA_EVENT, onDelta);
  }, [loadMessages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onCall = (e) => {
      loadCalls();
      const detail = e?.detail || {};
      const cid = detail.dialpad_call_id != null ? String(detail.dialpad_call_id) : '';
      const track = outboundTrackRef.current;
      if (!cid || !track?.callId || cid !== String(track.callId)) return;
      if (detail.state != null && String(detail.state).trim() !== '') {
        setOutboundLive((prev) => {
          if (!prev || String(prev.callId) !== cid) return prev;
          const next = String(detail.state);
          const lower = next.toLowerCase();
          return {
            ...prev,
            state: next,
            sawConnected:
              Boolean(prev.sawConnected) || lower === 'connected',
          };
        });
      }
    };
    window.addEventListener(DIALPAD_CALL_DELTA_EVENT, onCall);
    return () => window.removeEventListener(DIALPAD_CALL_DELTA_EVENT, onCall);
  }, [loadCalls]);

  useEffect(() => {
    if (!outboundLive?.callId) {
      return () => {};
    }

    const st = String(outboundLive.state || '').toLowerCase();
    const isTerminal =
      st === 'hangup' || st === 'missed' || st === 'declined';
    const skipPoll = isTerminal || st === 'error';

    let pollIv = null;
    let dismissT = null;

    if (isTerminal) {
      clearOutboundDismissTimer();
      dismissT = window.setTimeout(() => {
        outboundDismissTimerRef.current = null;
        outboundTrackRef.current = null;
        setOutboundLive(null);
      }, 4500);
      outboundDismissTimerRef.current = dismissT;
    } else if (!skipPoll) {
      const poll = async () => {
        const id = outboundTrackRef.current?.callId;
        if (!id) return;
        try {
          const res = await fetchDialpadIngestedCallById(id);
          if (!res?.success || !res.data?.state) return;
          setOutboundLive((prev) => {
            if (!prev || String(prev.callId) !== id) return prev;
            const row = res.data;
            const lower = String(row.state || '').toLowerCase();
            return {
              ...prev,
              state: String(row.state),
              sawConnected:
                Boolean(prev.sawConnected) ||
                wasCallConnected(row) ||
                lower === 'connected',
            };
          });
        } catch {
          /* ignore */
        }
      };
      pollIv = window.setInterval(poll, 2000);
      poll();
    }

    return () => {
      if (dismissT != null) {
        window.clearTimeout(dismissT);
        if (outboundDismissTimerRef.current === dismissT) {
          outboundDismissTimerRef.current = null;
        }
      }
      if (pollIv != null) window.clearInterval(pollIv);
    };
  }, [outboundLive?.callId, outboundLive?.state, clearOutboundDismissTimer]);

  useEffect(() => {
    const id = setInterval(() => setProfileClock((c) => c + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const prev = prevLineUserIdRef.current;
    if (
      prev != null &&
      effectiveLineUserId &&
      prev !== effectiveLineUserId
    ) {
      setSelectedChatId('');
    }
    if (effectiveLineUserId) {
      prevLineUserIdRef.current = effectiveLineUserId;
    }
  }, [effectiveLineUserId]);

  const displayTz =
    selectedAgent?.timezone && typeof selectedAgent.timezone === 'string'
      ? selectedAgent.timezone
      : undefined;

  useEffect(() => {
    const agentId = searchParams.get('agentId');
    const currentSelected = useDialpadLineStore.getState().selectedUserId;
    console.log(`[AgentMessages] URL agentId Sync - agentIdInUrl: ${agentId}, currentStoreSelected: ${currentSelected}`);
    if (agentId && dialpadUsers.length > 0) {
      const exists = dialpadUsers.some((u) => String(u.id) === agentId);
      if (exists && agentId !== currentSelected) {
        console.log(`[AgentMessages] Synchronizing selectedUserId to ${agentId} from URL`);
        useDialpadLineStore.getState().setSelectedUserId(agentId, { syncUrl: false });
      } else if (exists) {
        console.log(`[AgentMessages] agentId in URL matches store, skipping redundant update`);
      }
    }
  }, [searchParams, dialpadUsers]);

  useEffect(() => {
    if (threads.length === 0) return;
    const chatId = searchParams.get('chatId');
    const peerE164Param = searchParams.get('peerE164');
    const focusCallIdParam = searchParams.get('focusCallId');

    console.log(`[AgentMessages] URL Sync Effect - chatId: ${chatId}, peerE164: ${peerE164Param}, focusCallId: ${focusCallIdParam}`);

    if (chatId) {
      const valid = threads.some((t) => t.key === chatId);
      if (valid) {
        console.log(`[AgentMessages] Setting selectedChatId to ${chatId}`);
        setSelectedChatId((prev) => (prev !== chatId ? chatId : prev));
        setIsEditingName(false);
        return;
      }
    }

    if (peerE164Param) {
      const want = normalizeToE164(peerE164Param);
      if (want) {
        for (const t of threads) {
          if (normalizeToE164(peerE164FromRow(t.latest)) === want) {
            console.log(`[AgentMessages] Setting selectedChatId to ${t.key} via peerE164`);
            setSelectedChatId((prev) => (prev !== t.key ? t.key : prev));
            setIsEditingName(false);
            return;
          }
        }
      }
    }

    if (focusCallIdParam) {
      const call = callRows.find(c => String(c.dialpad_call_id) === focusCallIdParam);
      if (call) {
        const peer = call.external_e164 || call.external_number;
        if (peer) {
          const want = normalizeToE164(peer);
          for (const t of threads) {
            if (normalizeToE164(peerE164FromRow(t.latest)) === want) {
              console.log(`[AgentMessages] Setting selectedChatId to ${t.key} via focusCallId`);
              setSelectedChatId((prev) => (prev !== t.key ? t.key : prev));
              break;
            }
          }
        }
      }
    }
  }, [searchParams, threads, callRows]);

  const selectedAgentPhones = useMemo(() => {
    const set = new Set();
    const nums = selectedAgent?.phone_numbers;
    if (Array.isArray(nums)) {
      for (const p of nums) {
        const e = normalizeToE164(p);
        if (e) set.add(e);
      }
    }
    const single = selectedAgent?.number;
    if (single) {
      const e = normalizeToE164(single);
      if (e) set.add(e);
    }
    return set;
  }, [selectedAgent]);

  const allAgentPhones = useMemo(() => {
    const set = new Set();
    // All company lines from the directory
    for (const u of dialpadUsers) {
      if (Array.isArray(u.phone_numbers)) {
        for (const p of u.phone_numbers) {
          const e = normalizeToE164(p);
          if (e) set.add(e);
        }
      }
    }
    // Also include offices
    for (const off of dialpadOffices) {
      if (Array.isArray(off.phone_numbers)) {
        for (const p of off.phone_numbers) {
          const e = normalizeToE164(p);
          if (e) set.add(e);
        }
      }
    }
    return set;
  }, [dialpadUsers, dialpadOffices]);

  const threadMessages = useMemo(() => {
    if (!selectedChatId) return [];
    const fromRows = rows.filter((r) => threadKeyFromRow(r) === selectedChatId);
    const fromHistory = historyMessages.filter((r) => threadKeyFromRow(r) === selectedChatId);
    const combined = [...fromRows, ...fromHistory];
    const map = new Map();
    for (const m of combined) {
      const id = String(m.dialpad_id ?? '');
      if (!id) continue;
      const prev = map.get(id);
      const t = new Date(m.updated_at || 0).getTime();
      if (!prev || t >= new Date(prev.updated_at || 0).getTime()) {
        map.set(id, m);
      }
    }
    return [...map.values()].sort(
      (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    );
  }, [rows, historyMessages, selectedChatId]);

  const currentLinePhones = useMemo(() => {
    const set = new Set();
    const nums = selectedAgent?.phone_numbers;
    if (Array.isArray(nums)) {
      for (const p of nums) {
        const e = normalizeToE164(p);
        if (e) set.add(e);
      }
    }
    return set;
  }, [selectedAgent]);

  const peerProfile = useMemo(
    () => resolveThreadPeerProfile(threadMessages, dialpadUsers, currentLinePhones),
    [threadMessages, dialpadUsers, currentLinePhones, profileClock],
  );

  const threadCallsRaw = useMemo(() => {
    if (!selectedChatId) return [];
    return callRows
      .filter((c) => dialpadCallMatchesLineUser(c, selectedAgent))
      .filter((c) =>
        callMatchesThread(c, selectedChatId, peerProfile.peerE164),
      );
  }, [callRows, selectedChatId, selectedAgent, peerProfile.peerE164]);

  const threadCallsDeduped = useMemo(() => {
    const combined = [...threadCallsRaw, ...historyCalls];
    const map = new Map();
    for (const c of combined) {
      const id = String(c.dialpad_call_id ?? '');
      if (!id) continue;
      const prev = map.get(id);
      const t = new Date(c.updated_at || 0).getTime();
      if (!prev || t >= new Date(prev.updated_at || 0).getTime()) {
        map.set(id, c);
      }
    }
    return [...map.values()].sort(
      (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    );
  }, [threadCallsRaw, historyCalls]);

  const resolvedLabel = useMemo(() => {
    if (!selectedChatId) return 'Thread';
    const anyRow = threadMessages[0] || threadCallsDeduped[0];
    return anyRow
      ? threadLabelWithDirectory(
          anyRow,
          dialpadUsers,
          currentLinePhones,
          allAgentPhones,
          dialpadOffices,
        )
      : 'Thread';
  }, [
    selectedChatId,
    threadMessages,
    threadCallsDeduped,
    dialpadUsers,
    currentLinePhones,
    allAgentPhones,
    dialpadOffices,
  ]);

  const displayName = useMemo(() => {
    if (getContactName(selectedChatId)) return getContactName(selectedChatId);
    return resolvedLabel;
  }, [selectedChatId, getContactName, resolvedLabel]);

  const isNumber = useMemo(() => {
    return /^\+?[1-9]\d{1,14}$/.test(displayName.replace(/\s+/g, ''));
  }, [displayName]);

  const avatarLetter = useMemo(() => {
    const first = displayName.trim().charAt(0);
    return first ? first.toUpperCase() : '?';
  }, [displayName]);

  const peerPresence = useMemo(() => {
    if (!peerProfile?.peerE164 || !dialpadUsers?.length) return null;
    const e164 = normalizeToE164(peerProfile.peerE164);
    if (!e164) return null;
    // Find a Dialpad user whose phone numbers contain this E164
    return dialpadUsers.find((u) =>
      (u.phone_numbers || []).some((p) => normalizeToE164(p) === e164),
    );
  }, [peerProfile?.peerE164, dialpadUsers]);

  useEffect(() => {
    if (!selectedChatId || typeof window === 'undefined') {
      setStarredIds(new Set());
      return;
    }
    try {
      const rawS = localStorage.getItem(`chat_msg_stars_${selectedChatId}`);
      const s = rawS ? JSON.parse(rawS) : [];
      setStarredIds(new Set(Array.isArray(s) ? s.map(String) : []));
    } catch {
      setStarredIds(new Set());
    }
  }, [selectedChatId]);

  const matchOptimisticToRow = useCallback((opt, rows) => {
    const body = String(opt.body || '').trim();
    const t0 = opt.createdAt;
    return rows.find((r) => {
      if (String(r.direction || '').toLowerCase() !== 'outbound') return false;
      const b = String(r.body || '').trim();
      if (b !== body) return false;
      const t = new Date(r.updated_at).getTime();
      return Math.abs(t - t0) < 180_000;
    });
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    setOptimisticByChat((prev) => {
      const list = prev[selectedChatId];
      if (!list?.length) return prev;
      const nextList = list.filter(
        (o) => !matchOptimisticToRow(o, threadMessages),
      );
      if (nextList.length === list.length) return prev;
      return { ...prev, [selectedChatId]: nextList };
    });
  }, [threadMessages, selectedChatId, matchOptimisticToRow]);

  const callSortMs = useCallback((c) => {
    const n = (v) => {
      const x = Number(v);
      return Number.isFinite(x) && x > 0 ? x : 0;
    };
    return (
      n(c.date_ended) ||
      n(c.date_started) ||
      n(c.event_timestamp) ||
      new Date(c.updated_at || 0).getTime()
    );
  }, []);

  const loadMoreHistory = useCallback(async () => {
    if (!selectedChatId || loadingMoreHistory || !hasMoreHistory) return;

    // Only load more if we have initial data
    if (threadMessages.length === 0 && threadCallsDeduped.length === 0) return;

    setLoadingMoreHistory(true);
    try {
      const earliestMsg = threadMessages[0]?.updated_at;
      const earliestCall = threadCallsDeduped[0]?.updated_at;
      const t1 = earliestMsg ? new Date(earliestMsg).getTime() : Infinity;
      const t2 = earliestCall ? new Date(earliestCall).getTime() : Infinity;
      const beforeTs = Math.min(t1, t2);
      const beforeStr =
        beforeTs === Infinity ? null : new Date(beforeTs).toISOString();

      const [msgRes, callRes] = await Promise.all([
        fetchIngestedDialpadMessages({
          limit: 50,
          before: beforeStr || undefined,
          threadKey: selectedChatId,
        }),
        fetchIngestedDialpadCalls({
          limit: 50,
          before: beforeStr || undefined,
          threadKey: selectedChatId,
        }),
      ]);

      const newMsgs = msgRes?.data || [];
      const newCalls = callRes?.data || [];

      if (newMsgs.length === 0 && newCalls.length === 0) {
        setHasMoreHistory(false);
      } else {
        setHistoryMessages((prev) => [...prev, ...newMsgs]);
        setHistoryCalls((prev) => [...prev, ...newCalls]);
      }
    } catch (err) {
      console.error('Failed to load more history:', err);
    } finally {
      setLoadingMoreHistory(false);
    }
  }, [
    selectedChatId,
    loadingMoreHistory,
    hasMoreHistory,
    threadMessages,
    threadCallsDeduped,
  ]);

  // IntersectionObserver replaced by VirtualTimeline's onItemsRendered

  /** SMS + calls + pending outbound, chronological. */
  const timeline = useMemo(() => {
    const smsItems = threadMessages.map((m) => ({
      kind: 'sms',
      id: `sms-${m.dialpad_id}`,
      sort: new Date(m.updated_at).getTime(),
      msg: m,
    }));
    const callItems = threadCallsDeduped.map((c) => ({
      kind: 'call',
      id: `call-${c.dialpad_call_id}`,
      sort: callSortMs(c),
      call: c,
    }));
    const optList = optimisticByChat[selectedChatId] || [];
    const optimisticItems = optList
      .filter((o) => !matchOptimisticToRow(o, threadMessages))
      .map((o) => ({
        kind: 'optimistic',
        id: `opt-${o.localId}`,
        sort: o.createdAt,
        optimistic: o,
      }));
    return [...smsItems, ...callItems, ...optimisticItems].sort(
      (a, b) => a.sort - b.sort,
    );
  }, [
    threadMessages,
    threadCallsDeduped,
    optimisticByChat,
    selectedChatId,
    matchOptimisticToRow,
    callSortMs,
  ]);

  const targetDialpadId = searchParams.get('dialpadId') || '';
  const focusCallId = searchParams.get('focusCallId') || '';
  const focusCallScrolledRef = useRef('');
  const scrolledDialpadIdRef = useRef('');
  // prevThreadOpenScrollRef and prevOpenTimelineLenRef removed — VirtualTimeline auto-scrolls

  const cleanUrlParams = useCallback(
    (...keys) => {
      console.log(`[AgentMessages] cleanUrlParams requested for: ${keys.join(', ')}`);
      if (urlCleanupTimerRef.current) clearTimeout(urlCleanupTimerRef.current);
      urlCleanupTimerRef.current = setTimeout(() => {
        urlCleanupTimerRef.current = null;
        const sp = new URLSearchParams(searchParamsRef.current.toString());
        let changed = false;
        for (const k of keys) {
          if (sp.has(k)) { 
            console.log(`[AgentMessages] cleanUrlParams removing: ${k}`);
            sp.delete(k); 
            changed = true; 
          }
        }
        if (changed) {
          const q = sp.toString();
          const target = q ? `${pathname}?${q}` : pathname;
          console.log(`[AgentMessages] cleanUrlParams executing router.replace -> ${target}`);
          router.replace(target, { scroll: false });
        }
      }, 200);
    },
    [pathname, router],
  );

  useEffect(() => {
    if (!targetDialpadId) return;
    if (scrolledDialpadIdRef.current === targetDialpadId) return;
    if (!selectedChatId || threadMessages.length === 0) return;
    scrolledDialpadIdRef.current = targetDialpadId;
    setPulseDialpadId(targetDialpadId);
    const clearPulse = window.setTimeout(() => setPulseDialpadId(''), 4000);
    return () => clearTimeout(clearPulse);
  }, [targetDialpadId, selectedChatId, threadMessages]);

  useEffect(() => {
    if (!focusCallId) return;
    if (focusCallScrolledRef.current === focusCallId) return;
    if (!selectedChatId) return;
    focusCallScrolledRef.current = focusCallId;
    setPulseCallId(focusCallId);
    const clearPulse = window.setTimeout(() => setPulseCallId(''), 4000);
    return () => clearTimeout(clearPulse);
  }, [focusCallId, selectedChatId, threadCallsDeduped]);

  useMarkThreadNotificationsRead({
    scrollContainerRef: chatScrollRef,
    bottomSentinelRef: chatBottomSentinelRef,
    threadKey: selectedChatId,
    hasMessages: Boolean(
      selectedChatId && (threadMessages.length > 0 || threadCallsDeduped.length > 0),
    ),
  });

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [selectedChatId]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileMenuOpen]);

  const handleDeleteConversation = useCallback(() => {
    setProfileMenuOpen(false);
    if (!selectedChatId) return;
    const confirmLabel = getContactName(selectedChatId) || resolvedLabel;
    if (window.confirm(`Are you sure you want to delete the conversation with "${confirmLabel}"? This will hide it from your view permanently.`)) {
      deleteConversation(selectedChatId);
      setSelectedChatId('');
      setIsEditingName(false);
      // Clean up URL
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete('chatId');
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [selectedChatId, pathname, router, getContactName, resolvedLabel, deleteConversation, searchParams]);

  useEffect(() => {
    setOpenMessageMenuKey(null);
  }, [selectedChatId]);

  useEffect(() => {
    if (!openMessageMenuKey) return;
    const close = (e) => {
      if (!(e.target instanceof Element)) return;
      if (!e.target.closest('[data-msg-menu-root]')) {
        setOpenMessageMenuKey(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMessageMenuKey]);

  const persistStarred = useCallback(
    (nextSet) => {
      if (!selectedChatId || typeof window === 'undefined') return;
      localStorage.setItem(
        `chat_msg_stars_${selectedChatId}`,
        JSON.stringify([...nextSet]),
      );
    },
    [selectedChatId],
  );

  const toggleStarMsg = useCallback(
    (dialpadId) => {
      const id = String(dialpadId);
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persistStarred(next);
        return next;
      });
      setStarredCatalogVersion((v) => v + 1);
    },
    [persistStarred],
  );

  const removeStarFromCatalog = useCallback(
    (threadKeyStr, dialpadId) => {
      if (typeof window === 'undefined') return;
      const storageKey = `chat_msg_stars_${threadKeyStr}`;
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!Array.isArray(parsed)) return;
        const next = parsed.filter((x) => String(x) !== String(dialpadId));
        if (next.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        /* ignore */
      }
      if (selectedChatId === threadKeyStr) {
        setStarredIds((prev) => {
          const n = new Set(prev);
          n.delete(String(dialpadId));
          return n;
        });
      }
      setStarredCatalogVersion((v) => v + 1);
    },
    [selectedChatId],
  );

  const openStarredMessage = useCallback(
    (threadKeyStr, dialpadId) => {
      const q = new URLSearchParams();
      q.set('chatId', threadKeyStr);
      q.set('dialpadId', String(dialpadId));
      router.push(`${pathname}?${q.toString()}`);
    },
    [pathname, router],
  );

  const onOptimisticEnqueue = useCallback((payload) => {
    const { localId, body, createdAt } = payload;
    if (!selectedChatId) return;
    setOptimisticByChat((prev) => {
      const list = prev[selectedChatId] || [];
      return {
        ...prev,
        [selectedChatId]: [
          ...list,
          { localId, body, createdAt, failed: false },
        ],
      };
    });
  }, [selectedChatId]);

  const onSendFinished = useCallback(
    ({ localId, success }) => {
      if (!selectedChatId) return;
      if (success) {
        loadMessages({ silent: true });
        return;
      }
      setOptimisticByChat((prev) => {
        const list = prev[selectedChatId] || [];
        return {
          ...prev,
          [selectedChatId]: list.map((o) =>
            o.localId === localId ? { ...o, failed: true } : o,
          ),
        };
      });
    },
    [selectedChatId, loadMessages],
  );

  const saveName = () => {
    if (newName.trim() && selectedChatId) {
      setCustomName(selectedChatId, newName.trim());
    }
    setIsEditingName(false);
    setNewName('');
  };

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const canPlaceCall =
    Boolean(selectedChatId) &&
    selectedAgent?.id != null &&
    Boolean(
      peerProfile.peerE164 || normalizeToE164(peerProfile.phoneDisplay),
    );

  const dismissOutboundBanner = useCallback(() => {
    clearOutboundDismissTimer();
    outboundTrackRef.current = null;
    setOutboundLive(null);
  }, [clearOutboundDismissTimer]);

  const handleHeaderCall = async () => {
    const to =
      peerProfile.peerE164 || normalizeToE164(peerProfile.phoneDisplay);
    const fromLine = primarySendFromNumber(selectedAgent);
    if (!to || selectedAgent?.id == null) return;

    clearOutboundDismissTimer();
    outboundTrackRef.current = null;

    const peerLabel =
      displayName && String(displayName).trim()
        ? String(displayName).trim()
        : 'Contact';

    setCallActionBusy(true);
    try {
      const res = await initiateDialpadCall({
        user_id: selectedAgent.id,
        phone_number: to,
        outbound_caller_id: fromLine || undefined,
      });
      if (!res?.success) {
        setOutboundLive({
          callId: '',
          peerLabel,
          state: 'error',
          apiError: String(res?.error || 'Call failed'),
        });
        outboundDismissTimerRef.current = window.setTimeout(() => {
          outboundDismissTimerRef.current = null;
          setOutboundLive(null);
        }, 6500);
        return;
      }
      const d = res.data && typeof res.data === 'object' ? res.data : {};
      const rawId = d.call_id ?? d.id;
      const callId =
        rawId != null && String(rawId).trim() !== '' ? String(rawId) : '';
      if (!callId) {
        setOutboundLive({
          callId: '',
          peerLabel,
          state: 'error',
          apiError:
            'No call_id from Dialpad. Enable call webhooks (calling, ringing, connected, hangup, missed) for live status.',
        });
        outboundDismissTimerRef.current = window.setTimeout(() => {
          outboundDismissTimerRef.current = null;
          setOutboundLive(null);
        }, 9000);
        return;
      }
      outboundTrackRef.current = { callId };
      setOutboundLive({
        callId,
        peerLabel,
        state: 'calling',
        sawConnected: false,
      });
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Call failed';
      setOutboundLive({
        callId: '',
        peerLabel,
        state: 'error',
        apiError: String(msg),
      });
      outboundDismissTimerRef.current = window.setTimeout(() => {
        outboundDismissTimerRef.current = null;
        setOutboundLive(null);
      }, 6500);
    } finally {
      setCallActionBusy(false);
    }
  };

  const allStarredEntries = useMemo(() => {
    const list = [];
    for (const t of threads) {
      const storageKey = `chat_msg_stars_${t.key}`;
      try {
        const raw = localStorage.getItem(storageKey);
        const ids = raw ? JSON.parse(raw) : [];
        if (Array.isArray(ids) && ids.length > 0) {
          const chatLabel = getContactName(t.key) || t.label;
          for (const sid of ids) {
            const row = rows.find((r) => String(r.dialpad_id) === String(sid));
            list.push({
              threadKey: t.key,
              dialpadId: sid,
              chatLabel,
              body: row?.body || '',
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
    return list;
  }, [threads, rows, starredCatalogVersion, getContactName]);

  return (
    <>
      {outboundLive ? (
        <div
          className="fixed bottom-6 right-6 z-[200] pointer-events-none flex max-w-[min(92vw,340px)] flex-col items-end"
          aria-live="polite"
        >
          <div
            className={cn(
              'pointer-events-auto relative flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 pr-11 shadow-lg',
              String(outboundLive.state || '').toLowerCase() === 'error'
                ? 'border-red-200 bg-red-50'
                : 'border-violet-200/90 bg-white',
            )}
            role="status"
          >
            <div
              className={cn(
                'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                String(outboundLive.state || '').toLowerCase() === 'error'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-violet-100 text-violet-600',
              )}
            >
              {String(outboundLive.state || '').toLowerCase() === 'error' ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Phone
                  className={cn(
                    'h-5 w-5',
                    ['hangup', 'missed'].includes(
                      String(outboundLive.state || '').toLowerCase(),
                    )
                      ? ''
                      : 'animate-pulse',
                  )}
                  strokeWidth={1.75}
                />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Outbound call
              </p>
              <p className="mt-0.5 truncate text-[15px] font-bold leading-tight text-gray-900">
                {outboundLive.peerLabel}
              </p>
              {outboundLive.state === 'error' ? (
                <p className="mt-1 text-[13px] font-semibold text-red-800">
                  {outboundLive.apiError || 'Call failed'}
                </p>
              ) : (
                <p className="mt-1 text-[13px] font-semibold text-violet-600">
                  {liveOutboundCallPhaseLabel(outboundLive.state, {
                    sawConnected: Boolean(outboundLive.sawConnected),
                  })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={dismissOutboundBanner}
              className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-gray-600"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
      <div className="h-[calc(100vh-80px)] flex bg-[#fbfbfd] overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
        {/* Chat + profile (open a thread from Inbox or Recents in the main sidebar) */}
        <div className="relative flex-1 min-w-0 flex flex-col bg-white overflow-hidden border-r border-gray-100 min-h-0">
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
               style={{ backgroundImage: 'repeating-linear-gradient(30deg, #000 0, #000 1px, transparent 1px, transparent 40px), repeating-linear-gradient(150deg, #000 0, #000 1px, transparent 1px, transparent 40px)' }} />

          <div className="h-[76px] px-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur z-20">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#2563eb] border border-blue-100 shrink-0">
                <User className="w-5 h-5" />
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-3">
                  {isEditingName ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                      <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Name..."
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 text-[14px] font-bold outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      />
                      <button type="button" onClick={saveName} className="p-1.5 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]"><Check className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setIsEditingName(false)} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <h2 className="text-[18px] font-bold text-[#1e293b] leading-tight truncate">
                      {displayName}
                    </h2>
                  )}

                  {!isEditingName && isNumber && (
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#eff6ff] text-[#2563eb] rounded-lg text-[11px] font-bold hover:bg-[#dbeafe] transition-all shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add Name
                    </button>
                  )}
                </div>
                {!isEditingName && selectedChatId && peerPresence && (
                  <p className={cn(
                    'text-[12px] font-semibold flex items-center gap-1.5 mt-0.5',
                    peerPresence.is_online ? 'text-green-500' : 'text-gray-400'
                  )}>
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      peerPresence.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    )} />
                    {peerPresence.is_online ? 'Online' : 'Offline'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => loadMessages()}
                disabled={loading}
                className="p-2.5 rounded-full text-[#2563eb] hover:bg-[#eff6ff] disabled:opacity-50"
                title="Refresh messages"
              >
                <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
              </button>
              <button
                type="button"
                disabled={!canPlaceCall || callActionBusy}
                title={
                  canPlaceCall
                    ? 'Call customer (uses Dialpad line from navbar)'
                    : 'Open a thread with a phone number (from Inbox or Recents)'
                }
                onClick={() => handleHeaderCall()}
                className={cn(
                  'p-2.5 rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none',
                  canPlaceCall
                    ? 'text-[#2563eb] hover:bg-[#eff6ff]'
                    : 'text-gray-400 hover:bg-gray-100',
                )}
              >
                {callActionBusy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Phone className="w-5 h-5" strokeWidth={1.5} />
                )}
              </button>
               <button
                 type="button"
                 onClick={() => setShowProfile(!showProfile)}
                 className={cn(
                   'p-2.5 rounded-full transition-all',
                   showProfile ? 'bg-[#eff6ff] text-[#2563eb]' : 'hover:bg-gray-100 text-gray-400',
                 )}
               >
                  <User className="w-5 h-5" strokeWidth={1.5} />
               </button>
            </div>
          </div>

          {loadError ? (
            <div className="shrink-0 border-b border-red-100 bg-red-50 px-6 py-2 text-[12px] text-red-800">
              {loadError}
            </div>
          ) : null}
          {!loading && !selectedChatId && threads.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center text-[14px] text-[#64748b] px-4 leading-relaxed">
              No SMS threads yet for this line. Use Inbox when messages arrive, or check your
              Dialpad webhook and SMS subscription.
            </div>
          )}
          {loading && !selectedChatId && (
            <div className="flex-1 flex items-center justify-center text-[14px] text-[#64748b]">
              Loading…
            </div>
          )}
          {!selectedChatId && !loading && threads.length > 0 && (
            <div className="flex-1 flex items-center justify-center text-center text-[14px] text-[#64748b] px-4 leading-relaxed">
              Open a conversation from{' '}
              <span className="font-semibold text-[#2563eb]">Inbox</span> or{' '}
              <span className="font-semibold text-[#2563eb]">Recents</span> in the sidebar.
            </div>
          )}
          {selectedChatId && timeline.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center text-[14px] text-[#64748b] px-4 leading-relaxed">
              No messages or calls in this thread yet.
            </div>
          )}
          {selectedChatId && timeline.length > 0 && (
            <VirtualTimeline
              key={selectedChatId}
              timeline={timeline}
              displayTz={displayTz}
              pulseDialpadId={pulseDialpadId}
              pulseCallId={pulseCallId}
              starredIds={starredIds}
              onLoadMoreHistory={loadMoreHistory}
              hasMoreHistory={hasMoreHistory}
              loadingMoreHistory={loadingMoreHistory}
              scrollRef={chatScrollRef}
              bottomSentinelRef={chatBottomSentinelRef}
              targetDialpadId={targetDialpadId}
              focusCallId={focusCallId}
            />
          )}

          <DialpadSmsComposer
            threadRows={threadMessages}
            selectedChatId={selectedChatId}
            onOptimisticEnqueue={onOptimisticEnqueue}
            onSendFinished={onSendFinished}
            fromNumber={
              selectedAgent != null
                ? primarySendFromNumber(selectedAgent)
                : undefined
            }
            agentPhones={selectedAgentPhones}
          />

          {/* Jump to latest button removed from here as it is duplicated */}
        </div>

        <aside className={cn(
          'bg-[#fdfdfd] border-l border-gray-100 flex flex-col shrink-0 transition-all duration-300 overflow-hidden',
          showProfile ? 'w-[340px]' : 'w-0',
        )}>
          <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-gray-100 bg-white/50 px-5 backdrop-blur-sm">
            <h3 className="text-[16px] font-bold text-[#1e293b]">Profile</h3>
            <div className="flex items-center gap-0.5">
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((o) => !o)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Conversation actions"
                >
                  <MoreVertical className="h-5 w-5" strokeWidth={2} />
                </button>
                {profileMenuOpen ? (
                  <div className="absolute right-0 top-full z-[80] mt-1 min-w-[192px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      disabled={!selectedChatId}
                      onClick={handleDeleteConversation}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      Delete conversation
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setShowProfile(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div ref={profileScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div
                onClick={() => toggleSection('summary')}
                className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-blue-100 text-[16px] font-bold text-[#2563eb] shadow-sm ring-1 ring-blue-50">
                    {avatarLetter}
                    {peerPresence && (
                      <div className={cn(
                        'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white',
                        peerPresence.is_online ? 'bg-green-500' : 'bg-gray-400'
                      )} />
                    )}
                  </div>
                  <span className="truncate text-[14px] font-bold text-[#1e293b]">{displayName}</span>
                </div>
                {openSections.summary ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
              {openSections.summary && (
                <div className="animate-in slide-in-from-top-1 space-y-3 border-t border-gray-50 px-3 pb-4 pt-2 duration-200">
                  {selectedChatId && peerProfile.phoneDisplay && (
                    <div className="grid grid-cols-[minmax(0,72px)_1fr] items-center gap-x-2 text-[11px]">
                      <span className="text-gray-400">Dialpad</span>
                      <span className="truncate text-right font-bold text-[#2563eb]">{peerProfile.phoneDisplay}</span>
                    </div>
                  )}
                  {selectedChatId && peerProfile.emailDisplay && (
                    <div className="grid grid-cols-[minmax(0,72px)_1fr] items-center gap-x-2 text-[11px]">
                      <span className="text-gray-400">Email</span>
                      <span className="truncate text-right font-bold text-[#1e293b]">{peerProfile.emailDisplay}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div
                onClick={() => toggleSection('stars')}
                className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-2.5">
                  <Star className="h-[18px] w-[18px] text-amber-500" strokeWidth={2} />
                  <span className="text-[13px] font-bold text-[#334155]">
                    Starred <span className="text-gray-400">({allStarredEntries.length})</span>
                  </span>
                </div>
                {openSections.stars ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
              {openSections.stars && (
                <div className="max-h-[320px] space-y-2 overflow-y-auto border-t border-gray-50 px-3 py-3 custom-scrollbar">
                  {allStarredEntries.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-gray-400">No starred messages.</p>
                  ) : (
                    <ul className="space-y-2">
                      {allStarredEntries.map((entry) => (
                        <li key={`${entry.threadKey}:${entry.dialpadId}`} className="rounded-xl border border-gray-100 bg-[#f8fafc] p-2.5">
                          <button
                            type="button"
                            onClick={() => openStarredMessage(entry.threadKey, entry.dialpadId)}
                            className="w-full text-left"
                          >
                            <p className="truncate text-[11px] font-bold text-[#2563eb]">{entry.chatLabel}</p>
                            <p className="mt-1 line-clamp-3 text-[12px] text-[#334155]">
                              {entry.body || 'Message not in current load.'}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      </div>
    </>
  );
}
