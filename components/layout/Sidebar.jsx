'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Home,
  MessageSquare,
  Inbox,
  Phone,
  Search,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useAuthStore from '@/store/authStore';
import useContactStore from '@/store/contactStore';
import useNotificationStore from '@/store/notificationStore';
import useDialpadLineStore from '@/store/dialpadLineStore';
import {
  notificationMatchesSelectedDialpadLine,
  peerE164FromRow,
  buildPhoneToDialpadUserMap,
  formatDialpadPersonLabel,
} from '@/lib/dialpadDirectory';
import { normalizeToE164, formatE164USNational } from '@/lib/dialpadSmsRecipient';
import { useSelectedDialpadLineUser } from '@/lib/useDialpadLineSelection';
import { useIngestedSmsThreads } from '@/lib/useIngestedSmsThreads';
import { formatDialpadWhen } from '@/lib/dialpadIngestedThreads';
import { getRelativeTimeShort } from '@/lib/chatDateLabels';

const mainNavItems = [
  { id: 'home', icon: Home, label: 'Home', href: '/home', roles: ['superadmin', 'admin'] },
  // Agents only see Inbox here; chat opens from Inbox / Recents → /agent-dashboard/messages
  {
    id: 'messages',
    icon: MessageSquare,
    label: 'Messages',
    href: '/messages',
    agentHref: '/agent-dashboard/messages',
    roles: [], // Removed from sidebar for everyone; access via Inbox/Recents
  },
  { id: 'inbox', icon: Inbox, label: 'Inbox', href: '/inbox', agentHref: '/agent-dashboard/inbox' },
  {
    id: 'phone',
    icon: Phone,
    label: 'Phone',
    href: '/calls',
    agentHref: '/agent-dashboard/phone',
    roles: [], // Removed from sidebar for everyone; access via Inbox hub
  },
  {
    id: 'logs',
    icon: FileText,
    label: 'Logs',
    href: '/logs',
    roles: ['superadmin', 'admin'],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === 'agent';
  /** Recents list + SMS prefetch only on agent workspace; admin/superadmin use Messages without sidebar recents. */
  const showSidebarRecents = isAgent;
  const notifItems = useNotificationStore((s) => s.items);
  const dialpadUsers = useDialpadLineStore((s) => s.users);
  const dialpadOffices = useDialpadLineStore((s) => s.offices);
  const lineUser = useSelectedDialpadLineUser();
  const { threads: smsThreads, loading: recentsLoading, reload: reloadRecents } =
    useIngestedSmsThreads(80, showSidebarRecents, {
      lineUser,
      dialpadUsers,
      dialpadOffices,
    });

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
      if (Array.isArray(off.phone_numbers)) {
        for (const p of off.phone_numbers) {
          const e = normalizeToE164(p);
          if (e) set.add(e);
        }
      }
      // Also check single `number` field (un-normalized offices)
      if (off.number) {
        const e = normalizeToE164(off.number);
        if (e) set.add(e);
      }
    }
    return set;
  }, [dialpadUsers, dialpadOffices]);

  const currentLinePhones = useMemo(() => {
    const set = new Set();
    const nums = lineUser?.phone_numbers;
    if (Array.isArray(nums)) {
      for (const p of nums) {
        const e = normalizeToE164(p);
        if (e) set.add(e);
      }
    }
    // Offices expose their line via a single `number` field
    const single = lineUser?.number;
    if (single) {
      const e = normalizeToE164(single);
      if (e) set.add(e);
    }
    return set;
  }, [lineUser]);

  const recents = useMemo(
    () =>
      smsThreads.map((t) => {
        // Peer logic: 
        // 1. Try to find a number that is NOT in the allCompanyPhones set (a customer)
        // 2. If both are company numbers, pick the one that is NOT the currently selected line
        const peer = peerE164FromRow(t.latest, currentLinePhones);
        const peerSubtitle =
          peer && !currentLinePhones.has(peer)
            ? formatE164USNational(peer) || peer
            : '';
        return {
          id: t.key,
          dialpadId: t.latest?.dialpad_id,
          name: t.label,
          time: getRelativeTimeShort(t.latest.updated_at),
          peerSubtitle,
          unread: notifItems.filter(
            (n) =>
              !n.is_read &&
              n.chatId === t.key &&
              n.eventType === 'sms_inbound' &&
              notificationMatchesSelectedDialpadLine(n, lineUser),
          ).length,
          type: 'sms',
          avatar: null,
          peerE164: peer,
        };
      }),
    [smsThreads, notifItems, lineUser, currentLinePhones],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const { deletedChatIds, fetchContacts, syncWithBackend, getContactName, contacts } = useContactStore();

  useEffect(() => {
    // Only fetch if not already loaded
    if (contacts.length === 0) {
      syncWithBackend();
      fetchContacts();
    }
  }, [fetchContacts, syncWithBackend, contacts.length]);

  const activeChatId = searchParams.get('chatId') || '';

  const handleContactClick = (chatId, dialpadId) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('chatId', chatId);
    if (dialpadId) {
      sp.set('dialpadId', String(dialpadId));
    } else {
      sp.delete('dialpadId');
    }
    const q = sp.toString();
    const base = isAgent ? '/agent-dashboard/messages' : '/messages';
    router.push(`${base}?${q}`);
  };

  const filteredRecents = recents
    .filter((r) => !deletedChatIds.includes(r.id))
    .map((r) => {
      const centralName = getContactName(r.id);
      if (centralName) return { ...r, name: centralName };
      // Resolve name from dialpadUsers only if the peer is NOT the currently selected line
      if (r.peerE164 && !currentLinePhones.has(r.peerE164) && dialpadUsers.length > 0) {
        const phoneMap = buildPhoneToDialpadUserMap(dialpadUsers);
        const user = phoneMap.get(r.peerE164);
        if (user) {
          const label = formatDialpadPersonLabel(user);
          if (label) return { ...r, name: label };
        }
      }
      return r;
    })
    .filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Primary Sort: Unread first
      if (a.unread > 0 && b.unread === 0) return -1;
      if (a.unread === 0 && b.unread > 0) return 1;
      return 0;
    });

  return (
    <aside className={cn(
      "fixed left-0 top-0 bottom-0 bg-white border-r border-gray-100 flex flex-col z-50 transition-all duration-300 overflow-x-hidden",
      isAgent ? "w-[240px]" : "w-[80px] hover:w-[240px] group"
    )}>
      {/* Brand */}
      <div className="h-[80px] px-5 flex items-center shrink-0">
        <div className="w-10 h-10 rounded-xl bg-[#3b5998] flex items-center justify-center shrink-0 shadow-sm">
          <div className="grid grid-cols-2 gap-1 w-5 h-5">
            <div className="bg-white/90 rounded-sm"></div>
            <div className="bg-white/90 rounded-sm"></div>
            <div className="bg-white/90 rounded-sm"></div>
            <div className="bg-white/90 rounded-sm"></div>
          </div>
        </div>
        <div className={cn(
          "ml-4 min-w-0 transition-all duration-300 whitespace-nowrap overflow-hidden",
          isAgent ? "opacity-100 w-auto" : "opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto"
        )}>
          <p className="text-[#3b5998] text-[15px] font-bold leading-tight">
            Dialpad
          </p>
          <p className="text-[10px] text-gray-400 font-semibold tracking-wider leading-tight uppercase">
            {user?.role === 'superadmin' ? 'Superadmin Portal' : user?.role === 'admin' ? 'Admin Portal' : 'Agent Workspace'}
          </p>
        </div>
      </div>

      {/* Agent Search */}
      {isAgent && (
        <div className="px-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-1 focus:ring-[#2563eb]/20 outline-none"
            />
          </div>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {mainNavItems.map((item) => {
          if (item.roles && !item.roles.includes(user?.role)) return null;

          const targetHref = isAgent && item.agentHref ? item.agentHref : item.href;
          const isActive = pathname === targetHref || (targetHref !== '/' && pathname.startsWith(targetHref + '/'));
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => router.push(targetHref)}
              title={item.label}
              className={cn(
                'w-full flex items-center px-3 py-3 rounded-xl transition-all',
                isActive
                  ? 'bg-[#eff6ff] text-[#2563eb]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-[#2563eb]" : "text-gray-400")} />
              <span className={cn(
                "ml-4 text-[15px] font-semibold transition-all duration-300 whitespace-nowrap overflow-hidden",
                isAgent ? "opacity-100 w-auto" : "opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}

        {showSidebarRecents && (
        <div className="mt-8">
          <div className="px-3 mb-2 flex items-center justify-between">
             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Recents</p>
             <button
               type="button"
               onClick={() => reloadRecents()}
               className="text-[10px] font-bold text-[#2563eb] hover:underline disabled:opacity-50 transition-opacity"
               disabled={recentsLoading}
             >
               Refresh
             </button>
          </div>
          <div className="space-y-0.5 pb-8">
            {filteredRecents.length === 0 && !recentsLoading && (
              <p className="px-3 py-6 text-center text-[12px] text-gray-400 leading-relaxed">
                No recent chats yet.
              </p>
            )}
            {recentsLoading && filteredRecents.length === 0 && (
              <p className="px-3 py-6 text-center text-[12px] text-gray-400">Loading…</p>
            )}
            {filteredRecents.map((item) => (
              <button
                key={item.id}
                onClick={() => handleContactClick(item.id, item.dialpadId)}
                title={`Chat with ${item.name}`}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left',
                  activeChatId === item.id
                    ? 'bg-white shadow-sm border border-gray-100'
                    : 'hover:bg-gray-100 border border-transparent',
                )}
              >
                <div className="relative shrink-0">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center border border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
                    item.unread > 0 ? "bg-white" : "bg-gray-50",
                    item.avatar === 'bot' ? "text-pink-600" : "text-blue-600"
                  )}>
                    {item.avatar === 'bot' ? (
                      <MessageSquare className="w-4 h-4" />
                    ) : (
                      item.type === 'phone' ? <Phone className="w-4 h-4 text-red-500" /> : <span className="text-[12px] font-bold">{item.name.charAt(0)}</span>
                    )}
                  </div>
                  {item.unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#2563eb] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white min-w-[20px] text-center shadow-sm">
                      {item.unread}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 transition-all whitespace-nowrap overflow-hidden opacity-100 w-auto">
                  <p className={cn("text-[13.5px] truncate leading-tight", item.unread > 0 ? "text-gray-900 font-bold" : "text-gray-600 font-semibold")}>
                    {item.name}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate mt-1">
                    {item.peerSubtitle
                      ? `${item.peerSubtitle} · ${item.time}`
                      : item.time}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
        )}
    </nav>

      <div className="shrink-0 pb-4" aria-hidden />
    </aside>
  );
}
