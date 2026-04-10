'use client';

import { useEffect, useRef, useCallback } from 'react';
import { markNotificationsReadByThreadKeyApi } from '@/lib/api';
import useNotificationStore from '@/store/notificationStore';

/**
 * When the user scrolls the chat pane so the bottom sentinel is visible,
 * mark in-app notifications for that thread as read (bell + inbox).
 */
export function useMarkThreadNotificationsRead({
  scrollContainerRef,
  bottomSentinelRef,
  threadKey,
  /** Require at least one message so we do not clear notifs for an empty thread */
  hasMessages,
}) {
  const debounceRef = useRef(null);
  const runMark = useCallback(async (key) => {
    if (!key) return;
    try {
      const res = await markNotificationsReadByThreadKeyApi(key);
      if (res?.success) {
        useNotificationStore.getState().markThreadReadLocal(key);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const root = scrollContainerRef?.current;
    const target = bottomSentinelRef?.current;
    if (!root || !target || !threadKey || !hasMessages) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
          debounceRef.current = null;
          runMark(threadKey);
        }, 400);
      },
      { root, threshold: 0.05, rootMargin: '0px 0px 64px 0px' },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [
    scrollContainerRef,
    bottomSentinelRef,
    threadKey,
    hasMessages,
    runMark,
  ]);
}
