'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronDown, User, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockUser, mockNotifications } from '@/lib/mockData';

export default function Navbar() {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const unreadCount = localMockNotifications.filter((n) => !n.is_read).length;

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
      
      {/* Office Selection Dropdown */}
      <div className="w-[200px] relative">
        <button className="flex items-center justify-between w-full bg-white border border-gray-200/80 hover:border-gray-300 rounded-xl px-4 py-2.5 transition-colors text-left shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-[14px] font-bold text-[#1e293b] truncate">360 Digital US</span>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      </div>

      {/* Flexible spacer to push items to the right */}
      <div className="flex-1" />

      {/* Right Search Bar */}
      <div className="w-[300px] shrink-0">
        <div className="relative flex items-center bg-[#f8f9fc] border border-gray-200/60 rounded-xl shadow-sm focus-within:border-[#2563eb] focus-within:bg-white transition-colors overflow-hidden pr-2 py-2 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-4" />
          <input 
            type="text" 
            placeholder="Search interactions..." 
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-gray-400 pl-11"
          />
        </div>
      </div>

      {/* Notification bell */}
      <div className="relative shrink-0" ref={notifRef}>
        <button
          id="notification-bell"
          onClick={() => {
            setShowNotifications(!showNotifications);
            setShowProfile(false);
          }}
          className="relative p-2 rounded-full hover:bg-gray-50 transition-colors"
        >
          <Bell className="w-6 h-6 text-gray-500" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
          )}
        </button>

        {/* Notification dropdown */}
        {showNotifications && (
          <div className="absolute right-0 top-full mt-3 w-[420px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between">
              <h3 className="text-[18px] font-bold text-[#1e293b]">
                Notifications
              </h3>
              <button className="text-[13px] font-bold text-[#2563eb] hover:underline">
                Mark all as read
              </button>
            </div>
            
            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {localMockNotifications.map((notif, index) => (
                <div
                  key={notif.id}
                  className="relative px-6 py-4 hover:bg-[#f8f9fc] transition-colors cursor-pointer"
                >
                  {/* Unread Left Border */}
                  {notif.is_read === false && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2563eb]" />
                  )}
                  
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[15px] font-bold text-[#1e293b]">
                      {notif.name}
                    </p>
                    <p className="text-[12px] font-medium text-gray-400">
                      {notif.time}
                    </p>
                  </div>
                  
                  <div className="mb-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider',
                        notif.type === 'CUSTOMER' && 'bg-[#eef2f6] text-[#3b5998]',
                        notif.type === 'AGENT' && 'bg-[#f3e8ff] text-[#9333ea]',
                        notif.type === 'MISSED CALL' && 'bg-[#fee2e2] text-[#ef4444]'
                      )}
                    >
                      {notif.type}
                    </span>
                  </div>
                  
                  <p className="text-[13px] text-[#64748b] leading-relaxed pr-4">
                    {notif.text}
                  </p>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-center">
              <button 
                onClick={() => {
                  setShowNotifications(false);
                  router.push('/inbox');
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
              {mockUser.name}
            </p>
            <p className="text-[12px] text-gray-500 font-medium leading-tight mt-0.5">
              Super Admin
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
             {/* If we had an avatar it would go here, fallback to icon */}
             <User className="w-6 h-6 text-gray-400" />
          </div>
        </button>

        {showProfile && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1">
            <button className="w-full text-left px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-gray-50 transition-colors">
              Change Password
            </button>
            <button className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function formatTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const localMockNotifications = [
  {
    id: 'n1',
    name: '+1 (555) 012-9843',
    time: '2m ago',
    type: 'CUSTOMER',
    text: "Hello! I'm having trouble accessing my dashboard from the mobile app. Could yo...",
    is_read: false,
  },
  {
    id: 'n2',
    name: 'Alex Martin',
    time: '15m ago',
    type: 'AGENT',
    text: "Internal: Just finished the node deployment for the West Region. System load looks...",
    is_read: true,
  },
  {
    id: 'n3',
    name: '+1 (555) 012-9843',
    time: '1h ago',
    type: 'MISSED CALL',
    text: "No voicemail left from this caller.",
    is_read: true,
  },
  {
    id: 'n4',
    name: '+1 (555) 012-9843',
    time: '3h ago',
    type: 'CUSTOMER',
    text: "Sent a new document for verification.",
    is_read: true,
  }
];
