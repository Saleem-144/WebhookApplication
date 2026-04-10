'use client';

import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  BellRing,
  Check,
  Search,
  Filter,
  MessageSquare,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  FileText,
  PhoneOff,
  X,
  Send,
  Sparkles,
  Loader2,
  ChevronDown,
  CheckCheck,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useNotificationStore from '@/store/notificationStore';
import useAuthStore from '@/store/authStore';
import {
  markAllNotificationsReadApi,
  markNotificationReadApi,
  fetchIngestedDialpadCalls,
  fetchDialpadCallTranscript,
  fetchIngestedDialpadMessages,
} from '@/lib/api';
import {
  notificationMatchesSelectedDialpadLine,
  resolveDialpadUserIdFromRecipientLines,
  peerE164FromRow,
} from '@/lib/dialpadDirectory';
import { useSelectedDialpadLineUser } from '@/lib/useDialpadLineSelection';
import useDialpadLineStore from '@/store/dialpadLineStore';
import {
  dialpadCallMatchesLineUser,
  formatCallWhenCompact,
  formatDurationMs,
  callUiStatusFromRow,
  callDisplayName,
  formatCallStateLabelFromRow,
  callHasDateConnected,
  formatCallTableDuration,
  wasCallConnected,
  callAboutPlainTextForTimeline,
} from '@/lib/dialpadCallUi';
import {
  formatTranscriptBodyForDisplay,
  isDialpadTranscriptPlaceholderText,
} from '@/lib/transcriptDisplay';
import {
  chatDaySeparatorLabel,
  chatDayKey,
} from '@/lib/chatDateLabels';
import {
  formatDialpadWhen,
  getThreadMessages,
} from '@/lib/dialpadIngestedThreads';
import { useMarkThreadNotificationsRead } from '@/lib/useMarkThreadNotificationsRead';

function MessageItem({ msg, outbound, displayTz, starred }) {
  const msgRef = useRef(null);

  return (
    <div 
      ref={msgRef}
      className={cn("flex flex-col group", outbound ? "items-end" : "items-start")}
      data-dialpad-msg={String(msg.dialpad_id ?? '')}
    >
      <div className={cn("flex items-end gap-2 max-w-[85%]", outbound ? "flex-row-reverse" : "flex-row")}>
        {!outbound && <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 border border-gray-50 text-gray-400 font-bold text-[10px] uppercase shadow-sm">IN</div>}
        
        <div className="relative">
          <div className={cn(
            "rounded-2xl p-4 shadow-sm transition-all relative pt-9",
            outbound 
              ? "bg-[#3b5998] text-white rounded-br-sm" 
              : "bg-[#f1f5f9] text-[#1e293b] border border-gray-100 rounded-bl-sm"
          )}>
            {starred && (
              <Star className={cn(
                "absolute left-3 top-3 h-3.5 w-3.5",
                outbound ? "fill-amber-300 text-amber-200" : "fill-amber-400 text-amber-500"
              )} />
            )}
            <p className="text-[14.5px] leading-relaxed font-medium break-words whitespace-pre-wrap">
              {msg.body?.trim() ? msg.body : '(no text content)'}
            </p>
            <div className={cn(
              "text-[10.5px] mt-2 flex items-center gap-1.5",
              outbound ? "text-white/60 justify-end" : "text-gray-400 justify-end"
            )}>
              {formatDialpadWhen(msg.updated_at, displayTz)}
              {outbound && <CheckCheck className="h-3.5 w-3.5 text-emerald-200" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useIngestedSmsThreads } from '@/lib/useIngestedSmsThreads';

/**
 * Shared Inbox Hub component for Admins and Agents.
 * Supports navigation aware of the current dashboard context.
 */
export default function InboxHub({ defaultCategory = 'messages' }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const allNotifs = useNotificationStore((s) => s.items);
  const dialpadUsers = useDialpadLineStore((s) => s.users);
  const lineUser = useSelectedDialpadLineUser();

  const isAgentInUrl = typeof window !== 'undefined' && window.location.pathname.startsWith('/agent-dashboard');
  const dashboardPrefix = isAgentInUrl ? '/agent-dashboard' : '';

  const { threads, rows: smsRows, loading: smsLoading, reload: loadSms } = useIngestedSmsThreads(150, true, {
    lineUser,
    dialpadUsers,
  });

  const inboxItems = useMemo(() => {
    const list = allNotifs.filter(
      (i) =>
        (i.eventType === 'sms_inbound' || i.eventType === 'missed_call') &&
        notificationMatchesSelectedDialpadLine(i, lineUser),
    );
    return [...list].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
  }, [allNotifs, lineUser]);

  const [mainCategory, setMainCategory] = useState(defaultCategory);
  const [subTab, setSubTab] = useState(defaultCategory === 'messages' ? 'unread' : 'missed');

  const handleMainTabChange = (cat) => {
    setMainCategory(cat);
    setSubTab(cat === 'messages' ? 'unread' : 'missed');
  };

  const unreadMessageCount = inboxItems.filter((i) => !i.is_read).length;

  const [callRows, setCallRows] = useState([]);
  const loadCalls = useCallback(async () => {
    try {
      const res = await fetchIngestedDialpadCalls({ limit: 100 });
      if (res?.success && Array.isArray(res.data)) {
        setCallRows(res.data);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onDelta = () => loadCalls();
    window.addEventListener('dialpad:call-delta', onDelta);
    return () => window.removeEventListener('dialpad:call-delta', onDelta);
  }, [loadCalls]);

  const [transcriptPanel, setTranscriptPanel] = useState(null);
  const [chatPanel, setChatPanel] = useState(null);
  const [aiComposerText, setAiComposerText] = useState('');

  useEffect(() => {
    if (!transcriptPanel && !chatPanel) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setTranscriptPanel(null);
        setChatPanel(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [transcriptPanel, chatPanel]);

  useEffect(() => {
    if (!transcriptPanel) setAiComposerText('');
  }, [transcriptPanel]);

  const [panelTranscriptText, setPanelTranscriptText] = useState('');
  const [panelTranscriptLoading, setPanelTranscriptLoading] = useState(false);
  const [panelTranscriptError, setPanelTranscriptError] = useState('');

  useEffect(() => {
    if (!transcriptPanel?.call) {
      setPanelTranscriptText('');
      setPanelTranscriptLoading(false);
      setPanelTranscriptError('');
      return undefined;
    }
    const call = transcriptPanel.call;
    const id = String(call.dialpad_call_id || '').trim();
    const fromRowRaw = String(call.transcription_text || '').trim();
    const fromRow = isDialpadTranscriptPlaceholderText(fromRowRaw)
      ? ''
      : fromRowRaw;
    setPanelTranscriptText(fromRow);
    setPanelTranscriptError('');
    if (!id) {
      setPanelTranscriptLoading(false);
      return undefined;
    }

    let cancelled = false;
    setPanelTranscriptLoading(true);
    const hadConnected = wasCallConnected(call);

    (async () => {
      try {
        const res = await fetchDialpadCallTranscript(id, {
          refresh: hadConnected || !fromRow,
        });
        if (cancelled) return;
        if (res?.success) {
          const t = String(res.transcription_text || '').trim();
          if (t && !isDialpadTranscriptPlaceholderText(t)) {
            setPanelTranscriptText(t);
          }
          setPanelTranscriptError('');
          loadCalls();
        } else {
          const err = typeof res?.error === 'string' ? res.error : 'Could not load transcript from Dialpad.';
          if (!fromRow && !cancelled) setPanelTranscriptError(err);
        }
      } catch (e) {
        if (!cancelled && !fromRow) {
          setPanelTranscriptError(e?.message || 'Could not load transcript from Dialpad.');
        }
      } finally {
        if (!cancelled) setPanelTranscriptLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [transcriptPanel, loadCalls]);

  const lineCalls = useMemo(
    () => callRows.filter((r) => dialpadCallMatchesLineUser(r, lineUser)),
    [callRows, lineUser],
  );

  const missedCallCount = lineCalls.filter(
    (c) => String(c.state || '').toLowerCase() === 'missed',
  ).length;

  const navigateToChat = (itemOrCall) => {
    console.log('[Inbox] navigateToChat called with:', itemOrCall);
    const q = new URLSearchParams();
    
    if (itemOrCall.eventType === 'sms_inbound' || itemOrCall.eventType === 'missed_call') {
      const item = itemOrCall;
      const agentFromMeta = resolveDialpadUserIdFromRecipientLines(item.recipientLineE164s, dialpadUsers);
      const agentId = agentFromMeta || (lineUser?.id != null ? String(lineUser.id) : '');
      if (agentId) q.set('agentId', agentId);
      
      if (item.chatId) {
        q.set('chatId', item.chatId);
      } else if (item.peerE164) {
        q.set('peerE164', item.peerE164);
      } else if (item.dialpadId && item.eventType === 'sms_inbound') {
        // Fallback for SMS if chatId is missing
        q.set('chatId', `d:${item.dialpadId}`);
      }

      if (item.dialpadId) q.set('dialpadId', item.dialpadId);
      if (item.dialpadCallId) q.set('focusCallId', item.dialpadCallId);
      // Removed q.set('scroll', 'latest') to prevent auto-scrolling to bottom when deep-linking to a message
    } else {
      // It's a call record
      const call = itemOrCall;
      if (lineUser?.id != null) q.set('agentId', String(lineUser.id));
      const peer = call.external_e164 || call.external_number;
      if (peer) q.set('peerE164', String(peer).trim());
      if (call.thread_key) q.set('chatId', String(call.thread_key));
      if (call.dialpad_call_id) q.set('focusCallId', String(call.dialpad_call_id));
      // Removed q.set('scroll', 'latest') to prevent auto-scrolling to bottom when deep-linking to a call
    }

    const targetUrl = `${dashboardPrefix}/messages?${q.toString()}`;
    console.log('[Inbox] router.push ->', targetUrl);
    router.push(targetUrl);
  };

  const handleNotificationClick = (item) => {
    console.log(`[Inbox] handleNotificationClick: notificationId=${item.id}, chatId=${item.chatId}, dialpadId=${item.dialpadId}`);
    if (!item.is_read) {
      console.log(`[Inbox] Marking notification ${item.id} as read`);
      useNotificationStore.getState().markRead(item.id);
      markNotificationReadApi(item.id).catch((err) => {
        console.error('[Inbox] markNotificationReadApi error:', err);
      });
    }
    // Small delay to let the browser process the state update before navigation
    setTimeout(() => {
      // Check if we're already on the messages page with the same params to avoid redundant navigation
      const currentUrl = new URL(window.location.href);
      if (currentUrl.pathname.endsWith('/messages')) {
        const q = new URLSearchParams(currentUrl.search);
        if (q.get('chatId') === item.chatId && q.get('dialpadId') === item.dialpadId) {
          console.log('[Inbox] Already on target message, skipping navigation');
          return;
        }
      }
      console.log(`[Inbox] Proceeding to navigateToChat for notification ${item.id}`);
      navigateToChat(item);
    }, 10);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      useNotificationStore.getState().markAllReadLocal();
    } catch { /* ignore */ }
  };

  const filteredItems = useMemo(() => {
    if (mainCategory === 'phone') return [];
    if (subTab === 'unread') return inboxItems.filter((i) => !i.is_read);
    return inboxItems;
  }, [mainCategory, subTab, inboxItems]);

  const filteredCalls = useMemo(() => {
    if (mainCategory === 'messages') return [];
    if (subTab === 'missed') return lineCalls.filter((c) => String(c.state || '').toLowerCase() === 'missed');
    return lineCalls;
  }, [mainCategory, subTab, lineCalls]);

  const [aiComposerLoading, setAiComposerLoading] = useState(false);
  const handleGenerateAiResponse = async () => {
    if (!panelTranscriptText || aiComposerLoading) return;
    setAiComposerLoading(true);
    try {
      // Mock AI call
      await new Promise(r => setTimeout(r, 1500));
      setAiComposerText("Based on the transcript, the client is inquiring about the project status. You should reassure them that the milestone is on track for Friday.");
    } finally {
      setAiComposerLoading(false);
    }
  };

  const chatScrollRef = useRef(null);
  const chatBottomSentinelRef = useRef(null);
  const displayTz = lineUser?.timezone;

  const threadMessages = useMemo(() => {
    if (!chatPanel?.chatId) return [];
    return getThreadMessages(smsRows, chatPanel.chatId);
  }, [smsRows, chatPanel?.chatId]);

  const timeline = useMemo(() => {
    if (!chatPanel?.chatId) return [];
    const peerE164 = chatPanel.chatId.startsWith('phone:') ? chatPanel.chatId.slice(6) : '';
    
    const smsItems = threadMessages.map((m) => ({
      kind: 'sms',
      sort: new Date(m.updated_at).getTime(),
      msg: m,
    }));
    
    const callItems = callRows
      .filter(c => dialpadCallMatchesLineUser(c, lineUser))
      .filter(c => {
        const ext = c.external_e164 || c.external_number;
        return c.thread_key === chatPanel.chatId || (peerE164 && ext && peerE164 === ext);
      })
      .map((c) => ({
        kind: 'call',
        sort: Number(c.date_ended || c.date_started || c.event_timestamp || new Date(c.updated_at).getTime()),
        call: c,
      }));

    return [...smsItems, ...callItems].sort((a, b) => a.sort - b.sort);
  }, [threadMessages, callRows, chatPanel?.chatId, lineUser]);

  useMarkThreadNotificationsRead({
    scrollContainerRef: chatScrollRef,
    bottomSentinelRef: chatBottomSentinelRef,
    threadKey: chatPanel?.chatId || '',
    hasMessages: Boolean(chatPanel?.chatId && timeline.length > 0),
  });

  useEffect(() => {
    if (chatPanel && timeline.length > 0) {
      const run = () => {
        const el = chatScrollRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
      };
      run();
      const t = setTimeout(run, 100);
      return () => clearTimeout(t);
    }
  }, [chatPanel, timeline.length]);

  return (
    <div className="relative flex h-[calc(100vh-80px)] w-full overflow-hidden">
      {(transcriptPanel || chatPanel) ? (
        <>
          <div className="absolute inset-0 z-[45] bg-black/5 backdrop-blur-sm" onClick={() => { setTranscriptPanel(null); setChatPanel(null); }} />
          <aside className="absolute right-0 top-0 bottom-0 z-[50] w-[450px] bg-white border-l border-gray-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
             {transcriptPanel && (
               <>
                 <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                   <div>
                     <h3 className="text-[18px] font-bold text-[#1e293b]">Call Transcript</h3>
                     <p className="text-[12px] text-gray-400 mt-1 font-medium">{transcriptPanel.label}</p>
                   </div>
                   <button onClick={() => setTranscriptPanel(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                     <X className="w-5 h-5 text-gray-400" />
                   </button>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#f8fafc]">
                   {panelTranscriptLoading && !panelTranscriptText && (
                     <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                       <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
                       <p className="text-[13px] text-gray-500 font-medium">Fetching transcript from Dialpad...</p>
                     </div>
                   )}
                   {panelTranscriptError && !panelTranscriptText && (
                     <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-2xl border border-red-50">
                       <PhoneOff className="w-10 h-10 text-red-100 mb-4" />
                       <p className="text-[14px] text-red-600 font-bold mb-2">Transcript Unavailable</p>
                       <p className="text-[12px] text-red-400 leading-relaxed font-medium">{panelTranscriptError}</p>
                     </div>
                   )}
                   {panelTranscriptText && (
                     <div className="space-y-4">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                          <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-4 h-4 text-[#2563eb]" />
                            <span className="text-[12px] font-bold text-[#2563eb] uppercase tracking-wider">Conversation Log</span>
                          </div>
                          <div className="text-[14px] text-gray-800 leading-[1.8] font-medium [overflow-wrap:anywhere] whitespace-pre-line">
                            {formatTranscriptBodyForDisplay(panelTranscriptText)}
                          </div>
                        </div>
                     </div>
                   )}
                   {!panelTranscriptLoading && !panelTranscriptText && !panelTranscriptError && (
                     <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-2xl border border-gray-50">
                        <MessageSquare className="w-10 h-10 text-gray-100 mb-4" />
                        <p className="text-[14px] text-gray-500 font-bold">No transcription available</p>
                        <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">Wait for the call to finish or verify transcription is enabled in Dialpad.</p>
                     </div>
                   )}
                 </div>

                 <div className="p-6 bg-white border-t border-gray-100 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-[12px] font-bold text-gray-900">AI Suggested Response</span>
                      </div>
                      <button 
                        onClick={handleGenerateAiResponse}
                        disabled={!panelTranscriptText || aiComposerLoading}
                        className="text-[11px] font-bold text-purple-600 hover:text-purple-700 disabled:opacity-40 flex items-center gap-1.5 transition-all"
                      >
                        {aiComposerLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                        {aiComposerText ? 'Regenerate' : 'Analyze Transcript'}
                      </button>
                    </div>
                    <div className="relative group">
                      <textarea
                        value={aiComposerText}
                        onChange={(e) => setAiComposerText(e.target.value)}
                        placeholder="AI suggestions will appear here..."
                        className="w-full h-32 bg-purple-50/30 border border-purple-100 rounded-xl p-4 text-[13px] text-gray-700 font-medium placeholder:text-purple-200 focus:ring-2 focus:ring-purple-200/50 focus:border-purple-200 outline-none transition-all resize-none overflow-y-auto"
                      />
                      {aiComposerText && (
                        <button className="absolute bottom-3 right-3 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-purple-700 transition-all opacity-0 group-hover:opacity-100 shadow-lg">
                          <Send className="w-3 h-3" />
                          Use as draft
                        </button>
                      )}
                    </div>
                 </div>
               </>
             )}

             {chatPanel && (
               <>
                 <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100 shadow-sm">
                       {chatPanel.label.charAt(0)}
                     </div>
                     <div>
                       <h3 className="text-[16px] font-bold text-[#1e293b] truncate max-w-[240px]">{chatPanel.label}</h3>
                       <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Conversation Timeline</p>
                     </div>
                   </div>
                   <button onClick={() => setChatPanel(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                     <X className="w-5 h-5 text-gray-400" />
                   </button>
                 </div>

                 <div 
                   ref={chatScrollRef}
                   className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#f8fafc]"
                 >
                   {timeline.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-full text-center p-8">
                       <MessageSquare className="w-12 h-12 text-gray-200 mb-4" />
                       <p className="text-[14px] text-gray-400 font-bold">No history found</p>
                       <p className="text-[11px] text-gray-300 mt-1">This contact has no recorded interactions on this line.</p>
                     </div>
                   )}
                   
                   {timeline.map((item, idx) => {
                     const prev = timeline[idx - 1];
                     const dayKey = chatDayKey(item.sort, displayTz);
                     const prevDay = prev ? chatDayKey(prev.sort, displayTz) : null;
                     const showDaySep = prevDay !== dayKey;
                     const sepLabel = chatDaySeparatorLabel(new Date(item.sort), displayTz);
                     
                     const dayPill = showDaySep ? (
                       <div key={`day-${item.sort}-${idx}`} className="flex justify-center py-4">
                         <span className="rounded-full bg-gray-200/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-sm">
                           {sepLabel}
                         </span>
                       </div>
                     ) : null;

                     if (item.kind === 'call') {
                       const call = item.call;
                       const outcome = formatCallStateLabelFromRow(call);
                       const duration = formatCallTableDuration(call);
                       const dir = String(call.direction || '').toLowerCase();
                       const isMissed = String(call.state || '').toLowerCase() === 'missed';
                       
                       return (
                         <Fragment key={`call-${call.dialpad_call_id || idx}`}>
                           {dayPill}
                           <div className="flex justify-center">
                             <div className="max-w-[85%] rounded-2xl border border-violet-100 bg-white p-4 shadow-sm text-center">
                               <div className="flex items-center justify-center gap-2 text-violet-600 mb-2">
                                 <Phone className="w-3.5 h-3.5" />
                                 <span className="text-[11px] font-bold uppercase tracking-wider">
                                   {dir === 'outbound' ? 'Outbound Call' : 'Inbound Call'}
                                 </span>
                               </div>
                               <p className={cn("text-[13px] font-bold", isMissed ? "text-red-500" : "text-gray-700")}>{outcome}</p>
                               <p className="text-[10px] text-gray-400 mt-1 font-medium">
                                 {new Date(item.sort).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 {duration !== '—' ? ` · ${duration}` : ''}
                               </p>
                             </div>
                           </div>
                         </Fragment>
                       );
                     }

                     const msg = item.msg;
                     const outbound = String(msg.direction || '').toLowerCase() === 'outbound';
                     const did = String(msg.dialpad_id ?? '');
                     
                     // Check if message is starred in localStorage
                     let starred = false;
                     if (typeof window !== 'undefined' && chatPanel?.chatId) {
                       try {
                         const rawS = localStorage.getItem(`chat_msg_stars_${chatPanel.chatId}`);
                         const s = rawS ? JSON.parse(rawS) : [];
                         starred = Array.isArray(s) && s.map(String).includes(did);
                       } catch { /* ignore */ }
                     }
                     
                     return (
                       <Fragment key={`sms-${did}`}>
                         {dayPill}
                         <MessageItem 
                           msg={msg} 
                           outbound={outbound} 
                           displayTz={displayTz}
                           starred={starred}
                         />
                       </Fragment>
                     );
                   })}
                   <div ref={chatBottomSentinelRef} className="h-px w-full shrink-0" />
                 </div>

                 <div className="p-6 bg-white border-t border-gray-100 shrink-0">
                    <button 
                      onClick={() => navigateToChat({ chatId: chatPanel.chatId })}
                      className="w-full py-3 bg-[#2563eb] text-white rounded-xl text-[13px] font-bold hover:bg-[#1d4ed8] transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Open Full Conversation
                    </button>
                 </div>
               </>
             )}
          </aside>
        </>
      ) : null}

      <div className="flex-1 overflow-y-auto bg-[#fbfbfd] custom-scrollbar">
        <div className="w-full px-8 lg:px-12 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-[28px] font-bold text-[#1e293b] flex items-center gap-3">
              <BellRing className="w-7 h-7 text-[#2563eb]" />
              Inbox hub
            </h1>
            <button
              type="button"
              onClick={() => handleMarkAllRead()}
              className="flex items-center gap-2 bg-[#2563eb] text-white px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-[#1d4ed8] transition-all shadow-sm"
            >
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl w-fit mb-8">
            <button
              type="button"
              onClick={() => handleMainTabChange('messages')}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-[14px] font-bold transition-all',
                mainCategory === 'messages'
                  ? 'bg-white text-[#2563eb] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Messages
            </button>
            <button
              type="button"
              onClick={() => handleMainTabChange('phone')}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-[14px] font-bold transition-all',
                mainCategory === 'phone'
                  ? 'bg-white text-[#2563eb] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Phone className="w-4 h-4" />
              Phone
            </button>
          </div>

          <div className="flex items-center gap-8 border-b border-gray-200 mb-8">
            {mainCategory === 'messages' ? (
              <>
                <button
                  type="button"
                  onClick={() => setSubTab('unread')}
                  className={cn(
                    'pb-4 text-[14px] font-bold transition-all relative px-1',
                    subTab === 'unread'
                      ? 'text-[#2563eb]'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  Unread
                  <span className="ml-1.5 bg-[#eff6ff] text-[#2563eb] px-1.5 py-0.5 rounded-full text-[11px]">
                    {unreadMessageCount}
                  </span>
                  {subTab === 'unread' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb] rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('all')}
                  className={cn(
                    'pb-4 text-[14px] font-bold transition-all relative px-1',
                    subTab === 'all'
                      ? 'text-[#2563eb]'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  All messages
                  {subTab === 'all' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb] rounded-full" />
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSubTab('missed')}
                  className={cn(
                    'pb-4 text-[14px] font-bold transition-all relative px-1',
                    subTab === 'missed'
                      ? 'text-[#2563eb]'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  Missed
                  <span className="ml-1.5 bg-[#eff6ff] text-[#2563eb] px-1.5 py-0.5 rounded-full text-[11px]">
                    {missedCallCount}
                  </span>
                  {subTab === 'missed' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb] rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('all')}
                  className={cn(
                    'pb-4 text-[14px] font-bold transition-all relative px-1',
                    subTab === 'all'
                      ? 'text-[#2563eb]'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  All calls
                  {subTab === 'all' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb] rounded-full" />
                  )}
                </button>
              </>
            )}
          </div>

          <div className="space-y-4">
            {mainCategory === 'messages' && (
              <>
                {filteredItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-[15px] font-bold text-gray-900">All caught up!</p>
                    <p className="text-[13px] text-gray-400 mt-2">No {subTab === 'unread' ? 'unread' : ''} messages for the selected line.</p>
                  </div>
                )}
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                      'group flex items-center justify-between p-5 rounded-2xl bg-white border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5',
                      !item.is_read ? 'border-[#2563eb]/20 bg-blue-50/5' : 'border-gray-100',
                    )}
                  >
                    <div className="flex items-center gap-5 min-w-0">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
                        !item.is_read ? 'bg-[#2563eb] text-white' : 'bg-gray-50 text-gray-400'
                      )}>
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-[15px] font-bold text-gray-900 truncate">{item.name || item.peerE164 || 'Unidentified Contact'}</p>
                          {!item.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />}
                        </div>
                        <p className="text-[13px] text-gray-500 font-medium truncate max-w-full leading-relaxed">
                          {item.text || 'No message content available.'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[12px] font-bold text-gray-900 mb-1">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-400">
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {mainCategory === 'phone' && (
              <>
                {filteredCalls.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Phone className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-[15px] font-bold text-gray-900">No {subTab === 'missed' ? 'missed' : ''} calls</p>
                    <p className="text-[13px] text-gray-400 mt-2">Interaction logs for the selected line will appear here.</p>
                  </div>
                )}
                {filteredCalls.length > 0 && (
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-6 py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider">Line/Peer</th>
                          <th className="px-6 py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-center">Status</th>
                          <th className="px-6 py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider">Duration</th>
                          <th className="px-6 py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider">Date & Time</th>
                          <th className="px-6 py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-center w-10">Transcript</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredCalls.map((call) => {
                          const ui = callUiStatusFromRow(call);
                          const isMissed = String(call.state || '').toLowerCase() === 'missed';
                          const hasTranscript = call.transcription_text && !isDialpadTranscriptPlaceholderText(call.transcription_text);
                          return (
                            <tr 
                              key={call.dialpad_call_id} 
                              onClick={() => navigateToChat(call)}
                              className="group border-b border-gray-50 hover:bg-blue-50/10 transition-all cursor-pointer"
                            >
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm",
                                    isMissed ? "bg-red-50 text-red-600" : "bg-[#eff6ff] text-[#2563eb]"
                                  )}>
                                    <Phone className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[14px] font-bold text-gray-900 truncate">
                                      {callDisplayName(call, dialpadUsers)}
                                    </p>
                                    <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                                      {call.direction?.toUpperCase() || 'EXTERNAL'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    {call.direction === 'inbound' ? <ArrowDownLeft className={cn("w-3.5 h-3.5", isMissed ? "text-red-500" : "text-green-500")} /> : <ArrowUpRight className="w-3.5 h-3.5 text-[#2563eb]" />}
                                    <span className={cn(
                                      "text-[11px] font-bold uppercase tracking-wider",
                                      isMissed ? "text-red-500" : (call.direction === 'inbound' ? "text-green-500" : "text-[#2563eb]")
                                    )}>
                                      {formatCallStateLabelFromRow(call)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] text-gray-600 font-bold tabular-nums">
                                    {formatCallTableDuration(call)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <p className="text-[13px] text-gray-900 font-bold">
                                  {formatCallWhenCompact(call.updated_at)}
                                </p>
                                <p className="text-[11px] text-gray-400 font-semibold mt-0.5 uppercase">
                                  {new Date(call.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex justify-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTranscriptPanel({
                                        call,
                                        label: callDisplayName(call, dialpadUsers),
                                      });
                                    }}
                                    className={cn(
                                      "p-2 rounded-lg transition-all border",
                                      hasTranscript 
                                        ? "bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100" 
                                        : "bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100"
                                    )}
                                    title={hasTranscript ? "View Transcript" : "Request Transcript"}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
