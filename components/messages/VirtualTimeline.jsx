'use client';

import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useState,
  memo,
} from 'react';
import { List, useListRef } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import {
  Phone,
  User,
  Check,
  CheckCheck,
  Star,
  Loader2,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDialpadWhen } from '@/lib/dialpadIngestedThreads';
import {
  formatCallWhenCompact,
  formatCallTableDuration,
  formatCallStateLabelFromRow,
} from '@/lib/dialpadCallUi';
import { chatDaySeparatorLabel, chatDayKey } from '@/lib/chatDateLabels';

const DAY_SEP_HEIGHT = 48;
const CALL_BUBBLE_HEIGHT = 96;
const MSG_BASE_HEIGHT = 110;
const MSG_LINE_HEIGHT = 24;
const MSG_CHARS_PER_LINE = 50;

const estimateHeight = (item) => {
  if (!item) return 80;
  if (item.kind === 'day-sep') return DAY_SEP_HEIGHT;
  if (item.kind === 'call') return CALL_BUBBLE_HEIGHT;
  if (item.kind === 'optimistic' || item.kind === 'sms') {
    const body =
      item.kind === 'sms'
        ? item.msg?.body || ''
        : item.optimistic?.body || '';
    const lines = Math.max(1, Math.ceil(body.length / MSG_CHARS_PER_LINE));
    return MSG_BASE_HEIGHT + (lines - 1) * MSG_LINE_HEIGHT;
  }
  return 80;
};

const buildFlatTimeline = (timeline, displayTz) => {
  const flat = [];
  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const prev = timeline[i - 1];
    const dayK = chatDayKey(item.sort, displayTz);
    const prevDayK = prev ? chatDayKey(prev.sort, displayTz) : null;
    if (prevDayK !== dayK) {
      flat.push({
        kind: 'day-sep',
        sort: item.sort,
        label: chatDaySeparatorLabel(new Date(item.sort), displayTz),
        id: `day-${item.sort}-${i}`,
      });
    }
    flat.push(item);
  }
  return flat;
};

const DaySeparator = memo(({ label }) => (
  <div className="flex justify-center py-1">
    <span className="rounded-full bg-gray-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
      {label}
    </span>
  </div>
));
DaySeparator.displayName = 'DaySeparator';

const CallBubble = memo(({ call, displayTz, pulseCallId }) => {
  const cid = String(call.dialpad_call_id ?? '');
  const whenStr = formatCallWhenCompact(
    call.date_ended || call.date_started || call.event_timestamp,
    displayTz,
  );
  const dir = String(call.direction || '').toLowerCase();
  const outcome = formatCallStateLabelFromRow(call);
  const duration = formatCallTableDuration(call);
  return (
    <div data-call-id={cid} className="flex w-full min-w-0 justify-center px-2">
      <div
        className={cn(
          'max-w-[min(92%,400px)] rounded-2xl border border-violet-100 bg-violet-50/90 px-4 py-3 text-center shadow-sm',
          pulseCallId === cid && 'animate-msg-highlight',
        )}
      >
        <div className="flex items-center justify-center gap-2 text-violet-700">
          <Phone className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="text-[13px] font-bold">
            {dir === 'outbound' ? 'Outbound call' : 'Inbound call'}
          </span>
        </div>
        <p className="mt-1.5 text-[12px] font-semibold text-[#334155]">{outcome}</p>
        <p className="mt-1 text-[10px] text-[#64748b]">
          {whenStr}
          {duration !== '—' ? ` · ${duration}` : ''}
        </p>
      </div>
    </div>
  );
});
CallBubble.displayName = 'CallBubble';

const SmsBubble = memo(({ msg, displayTz, pulseDialpadId, starred }) => {
  const p = typeof msg.raw_payload === 'string' ? JSON.parse(msg.raw_payload || '{}') : (msg.raw_payload || {});
  const dir = String(msg.direction || p.direction || '').toLowerCase();
  const outbound = dir === 'outbound';
  const text = msg.body?.trim() || '(no text content)';
  const did = String(msg.dialpad_id ?? '');
  return (
    <div
      data-dialpad-msg={did}
      className={cn(
        'flex w-full min-w-0 items-end gap-3 group relative',
        outbound ? 'justify-end' : '',
      )}
    >
      {!outbound && (
        <div className="w-8 h-8 rounded-full bg-[#f1f5f9] flex items-center justify-center shrink-0 border border-gray-100">
          <User className="w-4 h-4 text-gray-400" />
        </div>
      )}
      <div
        className={cn(
          'min-w-0 max-w-[min(85%,100%)] rounded-2xl p-4 shadow-sm relative pt-9',
          outbound
            ? 'bg-[#3b5998] text-white rounded-br-sm'
            : 'bg-[#f1f5f9] text-[#334155] rounded-bl-sm border border-gray-100',
          pulseDialpadId === did && 'animate-msg-highlight',
        )}
      >
        {starred && (
          <Star
            className={cn(
              'absolute left-3 top-3 h-3.5 w-3.5',
              outbound
                ? 'fill-amber-300 text-amber-200'
                : 'fill-amber-400 text-amber-500',
            )}
          />
        )}
        <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">
          {text}
        </p>
        <div
          className={cn(
            'mt-2 text-[10px] font-medium text-right',
            outbound ? 'text-white/75' : 'text-gray-400',
          )}
        >
          {formatDialpadWhen(msg.updated_at, displayTz)}
          {outbound && (
            <CheckCheck className="inline h-3.5 w-3.5 ml-1 text-emerald-200" />
          )}
        </div>
      </div>
    </div>
  );
});
SmsBubble.displayName = 'SmsBubble';

const OptimisticBubble = memo(({ opt }) => {
  const text = String(opt.body || '').trim() || '(empty)';
  return (
    <div className="flex w-full min-w-0 items-end justify-end gap-3">
      <div className="min-w-0 max-w-[min(85%,100%)] bg-[#3b5998] text-white rounded-2xl p-4 rounded-br-sm shadow-sm relative pt-9">
        <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">
          {text}
        </p>
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-medium text-white/80">
          {opt.failed ? (
            <span className="text-red-200">Failed</span>
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </div>
      </div>
    </div>
  );
});
OptimisticBubble.displayName = 'OptimisticBubble';

/** react-window v2 row — props include List-injected fields + rowProps. */
const TimelineRow = memo(function TimelineRow({
  ariaAttributes,
  index,
  style,
  flatItems,
  displayTz,
  pulseDialpadId,
  pulseCallId,
  starredIds,
}) {
  const item = flatItems[index];
  if (!item) return null;

  return (
    <div
      {...ariaAttributes}
      style={{
        ...style,
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 6,
        paddingBottom: 6,
      }}
    >
      {item.kind === 'day-sep' && <DaySeparator label={item.label} />}
      {item.kind === 'call' && (
        <CallBubble
          call={item.call}
          displayTz={displayTz}
          pulseCallId={pulseCallId}
        />
      )}
      {item.kind === 'sms' && (
        <SmsBubble
          msg={item.msg}
          displayTz={displayTz}
          pulseDialpadId={pulseDialpadId}
          starred={starredIds.has(String(item.msg?.dialpad_id ?? ''))}
        />
      )}
      {item.kind === 'optimistic' && (
        <OptimisticBubble opt={item.optimistic} />
      )}
    </div>
  );
});
TimelineRow.displayName = 'TimelineRow';

/**
 * Virtualized timeline (react-window v2 List API).
 */
export default function VirtualTimeline({
  timeline,
  displayTz,
  pulseDialpadId = '',
  pulseCallId = '',
  starredIds = new Set(),
  onLoadMoreHistory,
  hasMoreHistory = false,
  loadingMoreHistory = false,
  scrollRef,
  bottomSentinelRef: _bottomSentinelRef,
  onScrollBottomChange,
  targetDialpadId = '',
  focusCallId = '',
}) {
  const listRef = useListRef();
  const [listSize, setListSize] = useState({ height: 0, width: 0 });
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const prevLenRef = useRef(0);

  const handleListResize = useCallback((size) => {
    setListSize((prev) =>
      prev.height === size.height && prev.width === size.width
        ? prev
        : { height: size.height, width: size.width },
    );
  }, []);

  const flatItems = useMemo(
    () => buildFlatTimeline(timeline, displayTz),
    [timeline, displayTz],
  );

  const rowHeightFn = useCallback(
    (index, rowProps) => {
      const item = rowProps.flatItems[index];
      return estimateHeight(item);
    },
    [],
  );

  const rowProps = useMemo(
    () => ({
      flatItems,
      displayTz,
      pulseDialpadId,
      pulseCallId,
      starredIds,
    }),
    [flatItems, displayTz, pulseDialpadId, pulseCallId, starredIds],
  );

  useLayoutEffect(() => {
    if (!scrollRef) return;
    scrollRef.current = listRef.current?.element ?? null;
  });

  useLayoutEffect(() => {
    const el = listRef.current?.element;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;
      setShowScrollBtn(!isNearBottom);
      onScrollBottomChange?.(!isNearBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [flatItems.length, listSize.height, listSize.width, onScrollBottomChange]);

  const hasInitialScrolledRef = useRef(false);
  useLayoutEffect(() => {
    const len = flatItems.length;
    if (len > 0 && !hasInitialScrolledRef.current && listRef.current?.scrollToRow) {
      const idx = len - 1;
      if (idx >= 0) {
        listRef.current.scrollToRow({
          index: idx,
          align: 'end',
          behavior: 'auto',
        });
        hasInitialScrolledRef.current = true;
      }
    }
    prevLenRef.current = len;
  });

  useEffect(() => {
    if (!targetDialpadId || flatItems.length === 0) return;
    const idx = flatItems.findIndex(
      (item) =>
        item.kind === 'sms' &&
        String(item.msg?.dialpad_id) === targetDialpadId,
    );
    if (idx !== -1) {
      // Progressive multi-jump to stabilize react-window offset as unmeasured dynamic items above push down the layout
      let jumps = 0;
      let t = null;
      const stabilize = () => {
        if (idx >= flatItems.length) return;
        listRef.current?.scrollToRow({
          index: idx,
          align: 'center',
          behavior: 'auto',
        });
        jumps += 1;
        if (jumps < 4) t = window.setTimeout(stabilize, 50);
      };
      t = window.setTimeout(stabilize, 50);
      return () => { if (t) clearTimeout(t); };
    }
    return undefined;
  }, [targetDialpadId, flatItems, listRef]);

  useEffect(() => {
    if (!focusCallId || flatItems.length === 0) return;
    const idx = flatItems.findIndex(
      (item) =>
        item.kind === 'call' &&
        String(item.call?.dialpad_call_id) === focusCallId,
    );
    if (idx !== -1) {
      let jumps = 0;
      let t = null;
      const stabilize = () => {
        if (idx >= flatItems.length) return;
        listRef.current?.scrollToRow({
          index: idx,
          align: 'center',
          behavior: 'auto',
        });
        jumps += 1;
        if (jumps < 4) t = window.setTimeout(stabilize, 50);
      };
      t = window.setTimeout(stabilize, 50);
      return () => { if (t) clearTimeout(t); };
    }
    return undefined;
  }, [focusCallId, flatItems, listRef]);

  const readyToLoadRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { readyToLoadRef.current = true; }, 1500);
    return () => clearTimeout(t);
  }, []);

  const prevFirstItemId = useRef(null);
  useLayoutEffect(() => {
    if (flatItems.length === 0) return;
    const currentFirstItemId = flatItems[0].id;
    if (prevFirstItemId.current && currentFirstItemId !== prevFirstItemId.current) {
      const idx = flatItems.findIndex((i) => i.id === prevFirstItemId.current);
      if (idx > 0 && listRef.current?.element) {
        let addedHeight = 0;
        for (let i = 0; i < idx; i++) {
          addedHeight += rowHeightFn(i, rowProps);
        }
        listRef.current.element.scrollTop += addedHeight;
      }
    }
    prevFirstItemId.current = currentFirstItemId;
  }, [flatItems, rowHeightFn, rowProps]);

  const handleRowsRendered = useCallback(
    (visible) => {
      if (!readyToLoadRef.current) return;
      if (
        visible.startIndex < 5 &&
        hasMoreHistory &&
        !loadingMoreHistory
      ) {
        onLoadMoreHistory?.();
      }
    },
    [hasMoreHistory, loadingMoreHistory, onLoadMoreHistory],
  );

  const scrollToBottom = useCallback(() => {
    const len = flatItems.length;
    if (len > 0) {
      listRef.current?.scrollToRow({
        index: len - 1,
        align: 'end',
        behavior: 'smooth',
      });
    }
  }, [flatItems.length, listRef]);

  if (flatItems.length === 0) return null;

  return (
    <div className="flex-1 relative min-h-0">
      {loadingMoreHistory && (
        <div className="absolute top-2 left-0 right-0 z-20 flex items-center justify-center gap-2 text-[12px] text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading history…</span>
        </div>
      )}
      <AutoSizer
        renderProp={({ height, width }) => {
          if (height == null || width == null || height <= 0 || width <= 0) {
            return null;
          }
          return (
            <List
              listRef={listRef}
              rowCount={flatItems.length}
              rowHeight={rowHeightFn}
              rowComponent={TimelineRow}
              rowProps={rowProps}
              overscanCount={8}
              onRowsRendered={handleRowsRendered}
              onResize={handleListResize}
              style={{ height, width }}
              defaultHeight={height}
            />
          );
        }}
      />
      {showScrollBtn && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 z-[40] flex h-10 w-10 items-center justify-center rounded-full bg-white border border-gray-200 text-[#2563eb] shadow-lg hover:bg-gray-50 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
          title="Jump to latest"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
