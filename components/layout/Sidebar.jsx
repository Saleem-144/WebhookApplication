'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  MessageSquare,
  Inbox,
  Phone,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useAuthStore from '@/store/authStore';

const mainNavItems = [
  { icon: Home, label: 'Home', href: '/home' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: Inbox, label: 'Inbox', href: '/inbox' },
  { icon: Phone, label: 'Phone', href: '/calls' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[80px] hover:w-[240px] bg-sidebar-bg border-r border-gray-100 flex flex-col z-50 transition-all duration-300 overflow-hidden group">
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
        <div className="ml-4 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          <p className="text-[#3b5998] text-[15px] font-bold leading-tight">
            360 Digital US
          </p>
          <p className="text-[10px] text-gray-400 font-semibold tracking-wider leading-tight">
            SUPERADMIN PORTAL
          </p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 mt-2 space-y-1">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href
            || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'w-full flex items-center px-3 py-3 rounded-xl transition-all',
                isActive
                  ? 'bg-[#eff6ff] text-[#2563eb]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-[#2563eb]" : "text-gray-400")} />
              <span className="ml-4 text-[15px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-6 space-y-1">
        <button
          onClick={() => router.push('/settings')}
          className={cn(
            'w-full flex items-center px-3 py-3 rounded-xl transition-all',
            pathname === '/settings'
              ? 'bg-[#eff6ff] text-[#2563eb]'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          )}
        >
          <Settings className="w-5 h-5 shrink-0 text-gray-400" />
          <span className="ml-4 text-[15px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Settings
          </span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-3 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all font-semibold"
        >
          <LogOut className="w-5 h-5 shrink-0 text-gray-400" />
          <span className="ml-4 text-[15px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
