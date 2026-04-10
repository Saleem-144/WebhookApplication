'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Check, ChevronDown, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarSrc } from '@/lib/avatarUrl';
import useAuthStore from '@/store/authStore';
import useNotificationStore from '@/store/notificationStore';
import useDialpadLineStore from '@/store/dialpadLineStore';
import {
  notificationMatchesSelectedDialpadLine,
  resolveDialpadUserIdFromRecipientLines,
} from '@/lib/dialpadDirectory';
import { getRelativeTimeShort } from '@/lib/chatDateLabels';
import DialpadAgentSelector from '@/components/messages/DialpadAgentSelector';
import useContactStore from '@/store/contactStore';
import {
  useEffectiveDialpadLineUserId,
  useSelectedDialpadLineUser,
} from '@/lib/useDialpadLineSelection';
import {
  dismissAllNotificationsFromPopupApi,
  dismissNotificationFromPopupApi,
  logoutRequest,
  markAllNotificationsReadApi,
  markNotificationReadApi,
} from '@/lib/api';
import { NEW_NOTIFICATION_ALERT_EVENT } from '@/lib/dialpadSocket';

const roleLabel = (role) => {
  if (role === 'superadmin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  if (role === 'agent') return 'Agent';
  return role || 'User';
};

export default function Navbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logoutStore = useAuthStore((s) => s.logout);
  const notifications = useNotificationStore((s) => s.items);
  const dialpadUsers = useDialpadLineStore((s) => s.users);
  const dialpadOffices = useDialpadLineStore((s) => s.offices);
  const dialpadUsersLoading = useDialpadLineStore((s) => s.usersLoading);
  const dialpadUsersError = useDialpadLineStore((s) => s.usersError);
  const setDialpadLineUserId = useDialpadLineStore((s) => s.setSelectedUserId);
  const selectedDialpadUser = useSelectedDialpadLineUser();
  const effectiveDialpadLineValue = useEffectiveDialpadLineUserId();

  const combinedLines = useMemo(() => {
    const lines = [];
    // Add offices first
    for (const off of dialpadOffices) {
      lines.push({
        ...off,
        is_office: true,
        display_name: off.name || 'Office',
        // Ensure phone_numbers is always present for filtering
        phone_numbers: Array.isArray(off.phone_numbers) && off.phone_numbers.length
          ? off.phone_numbers
          : off.number ? [off.number] : [],
      });
    }
    // Add users
    for (const u of dialpadUsers) {
      lines.push({
        ...u,
        is_user: true,
      });
    }
    return lines;
  }, [dialpadUsers, dialpadOffices]);

  const handleLineChange = (id) => {
    console.log(`[Navbar] handleLineChange: ${id}`);
    setDialpadLineUserId(id);
  };

  const lineScopedNotifications = useMemo(
    () =>
      notifications.filter((n) =>
        notificationMatchesSelectedDialpadLine(n, selectedDialpadUser),
      ),
    [notifications, selectedDialpadUser],
  );
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [bellAnimating, setBellAnimating] = useState(false);
  const [badgePop, setBadgePop] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const bellAnimTimeoutRef = useRef(null);
  const badgePopTimeoutRef = useRef(null);

  const unreadCount = lineScopedNotifications.filter(
    (n) => !n.is_read && !n.dismissedFromPopup,
  ).length;
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const bellNotifications = lineScopedNotifications.filter(
    (n) => !n.dismissedFromPopup,
  );
  const getContactName = useContactStore((s) => s.getContactName);
  const dropdownList = useMemo(
    () =>
      bellNotifications
        .map((n) => {
          // n might be a row from store which already has 'eventType', 'name', etc.
          // We enrichment it with the centralized name
          const betterName = getContactName(n.peerE164 || n.chatId || '');
          if (betterName) return { ...n, name: betterName };
          return n;
        })
        .reverse()
        .slice(0, 15),
    [bellNotifications, getContactName],
  );

  const openNotification = async (notif) => {
    try {
      if (!notif.is_read) {
        await markNotificationReadApi(notif.id);
        useNotificationStore.getState().markRead(notif.id);
      }
    } catch {
      /* still navigate */
    }
    setShowNotifications(false);
    const isAgent = user?.role === 'agent';
    const base = isAgent ? '/agent-dashboard/messages' : '/messages';
    const q = new URLSearchParams();
    const resolvedAgentId =
      resolveDialpadUserIdFromRecipientLines(
        notif.recipientLineE164s,
        dialpadUsers,
      ) || effectiveDialpadLineValue;
    if (resolvedAgentId) {
      q.set('agentId', resolvedAgentId);
    }
    if (notif.chatId) {
      q.set('chatId', notif.chatId);
    } else if (notif.peerE164) {
      q.set('peerE164', notif.peerE164);
    } else if (notif.dialpadId && notif.eventType === 'sms_inbound') {
      // For SMS, if no threadKey is in meta, we use d:dialpadId
      q.set('chatId', `d:${notif.dialpadId}`);
    } else if (notif.dialpadCallId && notif.eventType === 'missed_call') {
      // For missed calls, if no threadKey is in meta, we use the call ID
      q.set('focusCallId', notif.dialpadCallId);
    }
    if (notif.dialpadId) {
      q.set('dialpadId', notif.dialpadId);
    }
    if (notif.dialpadCallId) {
      q.set('focusCallId', notif.dialpadCallId);
    }
    const hasDeepLink =
      Boolean(notif.chatId) ||
      Boolean(notif.peerE164) ||
      Boolean(notif.dialpadCallId) ||
      Boolean(notif.dialpadId);
    if (hasDeepLink) {
      q.set('scroll', 'latest');
      router.push(`${base}?${q.toString()}`);
    } else {
      router.push(isAgent ? '/agent-dashboard/inbox' : '/inbox');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      useNotificationStore.getState().markAllReadLocal();
      setShowNotifications(false);
    } catch {
      /* ignore */
    }
  };

  const handleMarkOneReadOnly = async (e, notif) => {
    e.stopPropagation();
    if (notif.is_read) return;
    try {
      await markNotificationReadApi(notif.id);
      useNotificationStore.getState().markRead(notif.id);
    } catch {
      /* ignore */
    }
  };

  const handleClearFromBell = async (e, notif) => {
    e.stopPropagation();
    // Optimistic update for instant UI response
    useNotificationStore.getState().dismissFromPopupLocal(notif.id);
    try {
      await dismissNotificationFromPopupApi(notif.id);
    } catch {
      /* ignore */
    }
  };

  const handleClearAllFromBell = async () => {
    try {
      await dismissAllNotificationsFromPopupApi();
      useNotificationStore.getState().dismissAllFromPopupLocal();
    } catch {
      /* ignore */
    }
  };

  const handleLogout = async () => {
    setShowProfile(false);
    try {
      await logoutRequest();
    } catch {
      /* cookie may already be invalid */
    }
    logoutStore();
    router.push('/login');
  };

  const playSoftNotificationPing = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close().catch(() => { });
    } catch {
      /* autoplay / unsupported */
    }
  };

  useEffect(() => {
    const onNew = () => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setBadgePop(true);
        if (badgePopTimeoutRef.current) window.clearTimeout(badgePopTimeoutRef.current);
        badgePopTimeoutRef.current = window.setTimeout(() => setBadgePop(false), 200);
        playSoftNotificationPing();
        return;
      }
      setBellAnimating(true);
      if (bellAnimTimeoutRef.current) window.clearTimeout(bellAnimTimeoutRef.current);
      bellAnimTimeoutRef.current = window.setTimeout(() => setBellAnimating(false), 700);
      setBadgePop(true);
      if (badgePopTimeoutRef.current) window.clearTimeout(badgePopTimeoutRef.current);
      badgePopTimeoutRef.current = window.setTimeout(() => setBadgePop(false), 400);
      playSoftNotificationPing();
    };
    window.addEventListener(NEW_NOTIFICATION_ALERT_EVENT, onNew);
    return () => {
      window.removeEventListener(NEW_NOTIFICATION_ALERT_EVENT, onNew);
      if (bellAnimTimeoutRef.current) window.clearTimeout(bellAnimTimeoutRef.current);
      if (badgePopTimeoutRef.current) window.clearTimeout(badgePopTimeoutRef.current);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-[80px] bg-white border-b border-gray-100 flex items-center px-8 gap-6 sticky top-0 z-40 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">

      {/* Dialpad line: filters recents, inbox, notifications, message threads */}
      <div className="w-[min(280px,32vw)] shrink-0">
        <DialpadAgentSelector
          compact
          users={combinedLines}
          value={effectiveDialpadLineValue}
          onChange={handleLineChange}
          disabled={dialpadUsersLoading}
          error={dialpadUsersError}
          id="navbar-dialpad-line"
        />
      </div>

      {/* Flexible spacer to push items to the right */}
      <div className="flex-1" />

      {/* Notification bell */}
      <div className="relative shrink-0" ref={notifRef}>
        <button
          type="button"
          id="notification-bell"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
          onClick={() => {
            setShowNotifications(!showNotifications);
            setShowProfile(false);
          }}
          className="relative p-2 rounded-full hover:bg-gray-50 transition-colors"
        >
          <span
            className={cn(
              'inline-flex origin-top',
              bellAnimating && 'animate-bell-alert',
            )}
          >
            <Bell
              className={cn(
                'w-6 h-6',
                unreadCount > 0 ? 'text-[#2563eb]' : 'text-gray-500',
              )}
              strokeWidth={1.5}
            />
          </span>
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 min-h-[1.125rem] min-w-[1.125rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none border-2 border-white shadow-sm tabular-nums',
                unreadCount > 9 && 'min-w-5 px-1',
                badgePop && 'animate-bell-badge-pop',
              )}
            >
              {badgeLabel}
            </span>
          )}
        </button>

        {/* Notification dropdown */}
        {showNotifications && (
          <div className="absolute right-0 top-full mt-3 w-[420px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 overflow-x-hidden">
            {/* Header */}
            <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <h3 className="text-[18px] font-bold text-[#1e293b]">
                Notifications
              </h3>
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() => handleClearAllFromBell()}
                  className="text-[13px] font-bold text-[#64748b] hover:text-[#1e293b] hover:underline"
                  title="Remove all from this list (still in Inbox)"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
              {dropdownList.length === 0 ? (
                <p className="px-6 py-10 text-center text-[14px] text-[#64748b]">
                  {bellNotifications.length === 0 &&
                    lineScopedNotifications.length > 0
                    ? 'Nothing in the bell list. Open Inbox to see all notifications.'
                    : 'No notifications yet. They will appear here from Dialpad webhooks and the API.'}
                </p>
              ) : (
                dropdownList.map((notif) => (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNotification(notif)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openNotification(notif);
                    }}
                    className="relative px-6 py-4 hover:bg-[#f8f9fc] transition-colors cursor-pointer text-left w-full border-b border-gray-50 last:border-0"
                  >
                    {notif.is_read === false && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2563eb]" />
                    )}

                    <div className="flex items-start gap-3 w-full min-w-0">
                      {/* Left: Name, Badge, Message */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex flex-col items-start gap-1">
                          <p className="text-[14px] font-bold text-[#1e293b] truncate w-full">
                            {notif.name}
                          </p>
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider shrink-0',
                              notif.type === 'CUSTOMER' && 'bg-[#eef2f6] text-[#3b5998]',
                              notif.type === 'AGENT' && 'bg-[#f3e8ff] text-[#9333ea]',
                              notif.type === 'MISSED CALL' && 'bg-[#fee2e2] text-[#ef4444]',
                            )}
                          >
                            {notif.type}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#64748b] leading-snug truncate w-full">
                          {notif.text}
                        </p>
                      </div>

                      {/* Middle: Timing */}
                      <div className="shrink-0 text-center min-w-[32px]">
                        <p className="text-[11px] font-bold text-gray-400">
                          {getRelativeTimeShort(notif.created_at)}
                        </p>
                      </div>

                      {/* Right: Dismiss (X) */}
                      <div className="shrink-0 relative group">
                        <button
                          type="button"
                          onClick={(e) => handleClearFromBell(e, notif)}
                          className="p-2 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Clear notification"
                          aria-label="Clear notification"
                        >
                          <X className="w-4 h-4" strokeWidth={2.5} />
                        </button>

                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-center">
              <button
                onClick={() => {
                  setShowNotifications(false);
                  const isAgent = user?.role === 'agent';
                  router.push(isAgent ? '/agent-dashboard/inbox' : '/inbox');
                }}
                className="text-[13px] font-bold text-[#334155] hover:text-[#2563eb] transition-colors flex items-center gap-1"
              >
                View all notifications <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-8 bg-gray-200 shrink-0" />

      {/* Profile */}
      <div className="relative" ref={profileRef}>
        <button
          id="profile-menu"
          onClick={() => {
            setShowProfile(!showProfile);
            setShowNotifications(false);
          }}
          className="flex items-center gap-3 hover:bg-gray-50 rounded-lg py-1 transition-colors"
        >
          <div className="text-right hidden sm:block">
            <p className="text-[14px] font-bold text-[#1e40af] leading-tight">
              {user?.name || user?.email || 'User'}
            </p>
            <p className="text-[12px] text-gray-500 font-medium leading-tight mt-0.5">
              {roleLabel(user?.role)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
            {getAvatarSrc(user) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getAvatarSrc(user)}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </div>
        </button>

        {showProfile && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1 z-50">
            <Link
              href="/settings"
              onClick={() => setShowProfile(false)}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[#334155] hover:bg-gray-50 transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/settings?mode=change-password"
              onClick={() => setShowProfile(false)}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[#334155] hover:bg-gray-50 transition-colors"
            >
              Change password
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
