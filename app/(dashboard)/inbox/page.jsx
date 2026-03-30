'use client';

import { useRouter } from 'next/navigation';
import { BellRing, Check, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InboxPage() {
  const router = useRouter();

  // Mock data representing all inbox items (messages, missed calls)
  const inboxItems = [
    {
      id: 'n1',
      name: '+1 (555) 012-9843',
      time: '2m ago',
      type: 'CUSTOMER',
      text: "Hello! I'm having trouble accessing my dashboard from the mobile app. Could you pull up my latest bill?",
      is_read: false,
      targetTab: 'customers',
      targetChatId: 'chat-0',
      targetAgentId: 'agent-0' // Usually customers map to agent/self in mock
    },
    {
      id: 'n2',
      name: 'Agent Marcus V.',
      time: '15m ago',
      type: 'AGENT',
      text: "Internal: Just finished the node deployment for the West Region. System load looks stable. Can you verify on your end?",
      is_read: true,
      targetTab: 'agents',
      targetChatId: 'chat-0',
      targetAgentId: 'agent-1'
    },
    {
      id: 'n3',
      name: 'Client 2 (Aria)',
      time: '1h ago',
      type: 'MISSED CALL',
      text: "No voicemail left from this caller. They tried reaching the support line directly.",
      is_read: true,
      targetTab: 'customers',
      targetChatId: 'chat-1',
      targetAgentId: 'agent-0'
    },
    {
      id: 'n4',
      name: 'Corporate Hub',
      time: '3h ago',
      type: 'CUSTOMER',
      text: "Sent a new document for verification regarding the upcoming software renewal.",
      is_read: true,
      targetTab: 'customers',
      targetChatId: 'chat-2',
      targetAgentId: 'agent-0'
    },
    {
      id: 'n5',
      name: 'Elena Lopez',
      time: '1d ago',
      type: 'AGENT',
      text: "Hey, are we still on for the 2 PM sync up regarding the Dialpad integration?",
      is_read: true,
      targetTab: 'agents',
      targetChatId: 'chat-0',
      targetAgentId: 'agent-2'
    }
  ];

  const handleNotificationClick = (item) => {
    // Navigate to messages tab and pass query params to auto-select the conversation!
    const query = new URLSearchParams({
      tab: item.targetTab,
      agentId: item.targetAgentId,
      chatId: item.targetChatId
    }).toString();
    
    router.push(`/messages?${query}`);
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto bg-[#fbfbfd]">
      <div className="w-full px-8 lg:px-12 py-12">
        
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold text-[#1e293b] flex items-center gap-3">
              <BellRing className="w-7 h-7 text-[#2563eb]" />
              Inbox & Notifications
            </h1>
            <p className="text-[#64748b] mt-2 font-medium">Manage all your missed interactions and messages here.</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-white border border-gray-200 text-[#64748b] px-4 py-2.5 rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-colors shadow-sm">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex items-center gap-2 bg-[#2563eb] border border-blue-600 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold hover:bg-[#1d4ed8] transition-colors shadow-sm">
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100/60 mb-8 flex items-center">
           <Search className="w-5 h-5 text-gray-400 ml-3" />
           <input 
             type="text" 
             placeholder="Search your inbox..."
             className="w-full bg-transparent px-4 py-2.5 text-[15px] font-medium outline-none text-[#1e293b] placeholder:text-gray-400"
           />
        </div>

        {/* Inbox List */}
        <div className="bg-white rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {inboxItems.map((item) => (
              <div 
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className="relative p-6 hover:bg-[#f8f9fc] transition-all cursor-pointer group flex items-start gap-4"
              >
                {/* Unread Left Border */}
                {!item.is_read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2563eb]" />
                )}

                {/* Status Dot */}
                <div className="shrink-0 mt-1">
                  {item.is_read ? (
                     <div className="w-3 h-3 rounded-full border-2 border-gray-300" />
                  ) : (
                     <div className="w-3 h-3 rounded-full bg-[#2563eb] shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className={cn("text-[16px] font-bold", !item.is_read ? "text-[#1e293b]" : "text-[#334155]")}>
                        {item.name}
                      </h3>
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider',
                          item.type === 'CUSTOMER' && 'bg-[#eef2f6] text-[#3b5998]',
                          item.type === 'AGENT' && 'bg-[#f3e8ff] text-[#9333ea]',
                          item.type === 'MISSED CALL' && 'bg-[#fee2e2] text-[#ef4444]'
                        )}
                      >
                        {item.type}
                      </span>
                    </div>
                    <span className={cn("text-[13px] font-medium shrink-0", !item.is_read ? "text-[#2563eb]" : "text-gray-400")}>
                      {item.time}
                    </span>
                  </div>
                  
                  <p className={cn("text-[14px] leading-relaxed pr-8", !item.is_read ? "text-[#334155] font-medium" : "text-[#64748b]")}>
                    {item.text}
                  </p>
                </div>

                {/* Hover Action Indicator */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-[#2563eb]">
                    <Search className="w-4 h-4" />
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
