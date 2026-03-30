'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Phone,
  Paperclip,
  Send,
  MoreVertical,
  Plus,
  Bot,
  User,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState('agents'); // 'agents' or 'customers'
  const [selectedAgentId, setSelectedAgentId] = useState('1'); 
  const [selectedChatId, setSelectedChatId] = useState('chat1');
  const [internalsHeight, setInternalsHeight] = useState(250);

  useEffect(() => {
    // Read query parameters for auto-selection (deep linking from Inbox)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const agentId = params.get('agentId');
      const chatId = params.get('chatId');

      if (tab) setActiveTab(tab);
      if (agentId) setSelectedAgentId(agentId);
      if (chatId) setSelectedChatId(chatId);
    }
  }, []);

  return (
    <div className="h-[calc(100vh-80px)] flex bg-[#fbfbfd] overflow-hidden">
      
      {/* COLUMN 1: Directory (Agents/Customers) */}
      <div className="w-[280px] border-r border-gray-200 bg-[#f8f9fc] flex flex-col shrink-0">
        <div className="p-5 pb-3">
          <div className="flex bg-gray-100/80 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setActiveTab('agents')}
              className={cn(
                'flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-all',
                activeTab === 'agents'
                  ? 'bg-white text-[#2563eb] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Agents
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={cn(
                'flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-all',
                activeTab === 'customers'
                  ? 'bg-white text-[#2563eb] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Customers
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {activeTab === 'agents' ? (
            // Agents List in Col 1
            mockDirectoryAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                  selectedAgentId === agent.id
                    ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100'
                    : 'hover:bg-gray-100/50 border border-transparent'
                )}
              >
                <div className="relative shrink-0 w-10 h-10 rounded-xl bg-[#111115] flex items-center justify-center overflow-hidden">
                  {agent.id === '3' ? (
                    <span className="text-[#3b5998] font-bold text-sm bg-[#e8edff] w-full h-full flex items-center justify-center">EL</span>
                  ) : (
                    <User className="w-6 h-6 text-gray-400 mt-2" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[14px] font-bold", selectedAgentId === agent.id ? "text-[#1e40af]" : "text-[#1e293b]")}>
                    {agent.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={cn("w-2 h-2 rounded-full", agent.statusColor)} />
                    <p className="text-[12px] font-medium text-gray-500 truncate">
                      {agent.statusText}
                    </p>
                  </div>
                </div>
              </button>
            ))
          ) : (
             // Customers List in Col 1
             mockCustomerConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedChatId(conv.id)}
                className={cn(
                  'w-full text-left p-4 rounded-xl transition-all border outline-none',
                  selectedChatId === conv.id
                    ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100'
                    : 'bg-transparent border-transparent hover:border-gray-100 hover:shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className={cn("text-[14px] font-bold", selectedChatId === conv.id ? "text-[#1e40af]" : "text-[#1e293b]")}>
                    {conv.name}
                  </p>
                  <span className="text-[11px] font-medium text-gray-400">
                    {conv.time}
                  </span>
                </div>
                <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed font-medium">
                  {conv.preview}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* COLUMN 2: Active Conversations */}
      <div className="w-[340px] border-r border-gray-200 bg-white flex flex-col shrink-0 h-full">
        <div className="p-6 pb-4 flex items-center justify-between border-b border-gray-100 shrink-0">
          <h2 className="text-[18px] font-bold text-[#1e40af]">Active Conversations</h2>
          {activeTab === 'agents' && (
             <span className="bg-[#eff6ff] text-[#2563eb] text-[11px] font-bold px-2 py-0.5 rounded-full">
               12 New
             </span>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'agents' ? (
             <div className="flex flex-col h-full">
               {/* Customer Conversations for Agent (2nd Scroller) */}
               <div className="flex-1 overflow-y-auto p-3 space-y-2">
                 {mockCustomerConversations.map((conv) => (
                   <button
                     key={conv.id}
                     onClick={() => setSelectedChatId(conv.id)}
                     className={cn(
                       'w-full text-left p-4 rounded-xl transition-all border outline-none',
                       selectedChatId === conv.id
                         ? 'bg-[#f4f7fa] border-[#e2e8f0]'
                         : 'bg-white border-transparent hover:border-gray-100 hover:shadow-sm'
                     )}
                   >
                     <div className="flex items-center justify-between mb-1">
                       <p className={cn("text-[15px] font-bold", selectedChatId === conv.id ? "text-[#1e40af]" : "text-[#1e293b]")}>
                         {conv.name}
                       </p>
                       <span className="text-[11px] font-medium text-gray-400">
                         {conv.time}
                       </span>
                     </div>
                     <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed font-medium">
                       {conv.preview}
                     </p>
                   </button>
                 ))}
               </div>
               
               {/* Resizer Handle */}
               <div 
                 className="shrink-0 flex items-center justify-center h-4 cursor-ns-resize group relative mt-2 z-10"
                 onMouseDown={(e) => {
                   e.preventDefault();
                   const startY = e.clientY;
                   const startHeight = internalsHeight;
                   
                   const onMouseMove = (moveEvent) => {
                     // Dragging UP decreases clientY (negative delta), which INCREASES height
                     const delta = startY - moveEvent.clientY;
                     setInternalsHeight(Math.max(100, Math.min(600, startHeight + delta)));
                   };
                   
                   const onMouseUp = () => {
                     document.removeEventListener('mousemove', onMouseMove);
                     document.removeEventListener('mouseup', onMouseUp);
                   };
                   
                   document.addEventListener('mousemove', onMouseMove);
                   document.addEventListener('mouseup', onMouseUp);
                 }}
               >
                 <div className="absolute inset-x-0 top-1/2 -mt-[1px] border-t border-gray-200 border-dashed group-hover:border-[#2563eb] transition-colors" />
                 <div className="w-8 h-1.5 bg-gray-200 group-hover:bg-[#2563eb] rounded-full relative shadow-sm transition-colors" />
               </div>

               {/* Internals Section (3rd Scroller) */}
               <div className="shrink-0 flex flex-col pt-3 mb-2">
                 <h3 className="text-center text-[15px] font-bold text-[#1e40af]">Internals</h3>
               </div>
               <div 
                 className="shrink-0 overflow-y-auto w-full px-3 pb-3 space-y-4"
                 style={{ height: `${internalsHeight}px` }}
               >
                 {mockInternalConversations.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3 w-full">
                      <div className="relative shrink-0 w-10 h-10 rounded-xl bg-[#111115] flex items-center justify-center overflow-hidden">
                        {agent.id === '3' ? (
                          <span className="text-[#3b5998] font-bold text-sm bg-[#e8edff] w-full h-full flex items-center justify-center">EL</span>
                        ) : (
                          <User className="w-6 h-6 text-gray-400 mt-2" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-[#1e293b]">
                          {agent.name}
                        </p>
                        <p className="text-[12px] font-medium text-gray-500 truncate mt-0.5">
                          {agent.statusText}
                        </p>
                      </div>
                    </div>
                 ))}
               </div>
             </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
               {/* Agent Conversations for Customer */}
               <div className="flex-1 overflow-y-auto p-3 space-y-4">
                 {/* Manually injecting Sarah as she shows up at top of list in mock */}
                 <div className="flex items-center gap-3 w-full border border-gray-200 rounded-xl p-3 bg-white shadow-sm cursor-pointer hover:border-[#2563eb]/50 transition-colors">
                    <div className="relative shrink-0 w-10 h-10 rounded-xl bg-[#111115] flex items-center justify-center overflow-hidden">
                      <User className="w-6 h-6 text-gray-400 mt-2" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-[#1e40af]">
                        Agent Sarah K.
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <p className="text-[12px] font-medium text-gray-500 truncate mt-0.5">
                          Online
                        </p>
                      </div>
                    </div>
                  </div>

                 {mockInternalConversations.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3 w-full px-1 cursor-pointer group">
                      <div className="relative shrink-0 w-10 h-10 rounded-xl bg-[#111115] flex items-center justify-center overflow-hidden">
                        {agent.id === '3' ? (
                          <span className="text-[#3b5998] font-bold text-sm bg-[#e8edff] w-full h-full flex items-center justify-center">EL</span>
                        ) : (
                          <User className="w-6 h-6 text-gray-400 mt-2" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-[#1e293b] group-hover:text-[#2563eb] transition-colors">
                          {agent.name}
                        </p>
                        <p className="text-[12px] font-medium text-gray-500 truncate mt-0.5">
                          {agent.statusText}
                        </p>
                      </div>
                    </div>
                 ))}
               </div>
               
               <div className="border-t border-gray-400 mt-auto mx-8 mb-4 shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 3: Chat Interface */}
      <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden relative">
        {/* Subtle hex background pattern */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'repeating-linear-gradient(30deg, #000 0, #000 1px, transparent 1px, transparent 40px), repeating-linear-gradient(150deg, #000 0, #000 1px, transparent 1px, transparent 40px)' }} />
        
        {/* Chat Header */}
        <div className="h-[76px] px-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#2563eb]">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-[18px] font-bold text-[#1e293b]">
              {mockCustomerConversations.find(c => c.id === selectedChatId)?.name || '+1(234)567'}
            </h2>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
            <Phone className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10">
          <div className="flex justify-center">
            <span className="bg-[#e2e8f0] text-gray-600 text-[11px] font-bold px-3 py-1 rounded-full tracking-wider">
              TODAY
            </span>
          </div>

          {mockChatMessages.map((msg) => (
             msg.isAgent ? (
                <div key={msg.id} className="flex items-end justify-end gap-3 w-full">
                  <div className="max-w-[85%] flex items-end justify-end gap-3 pointer-events-auto">
                    <div className="bg-[#3b5998] text-white rounded-2xl p-4 rounded-br-sm relative">
                      <p className="text-[14px] leading-relaxed">
                        {msg.text}
                      </p>
                      <div className="text-[11px] text-white/70 mt-2 text-right">
                        {msg.time}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#1e40af] shrink-0 flex items-center justify-center text-white text-[11px] font-bold">
                      A
                    </div>
                  </div>
                </div>
             ) : (
                <div key={msg.id} className="flex items-end gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-xl bg-[#e2e8f0] shrink-0" />
                  <div className="bg-[#e2e8f0] rounded-2xl p-4 rounded-bl-sm relative group">
                    <p className="text-[14px] text-[#334155] leading-relaxed">
                      {msg.text}
                    </p>
                    <div className="text-[11px] text-gray-500 mt-2 text-right">
                      {msg.time}
                    </div>
                  </div>
                </div>
             )
          ))}
        </div>
      </div>

      {/* COLUMN 4: AI Side Panel */}
      <div className="w-[320px] bg-white border-l border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 bg-white">
            <div className="w-8 h-8 rounded-lg bg-[#6366f1] text-white flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-[15px] font-bold text-[#1e293b] flex-1">Ai Chat Bot</h3>
            <div className="w-2 h-2 rounded-full bg-[#2563eb]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI Suggestion Bubbles (repeated for scroll test) */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`ai-sug-${i}`}>
              <div className="border border-gray-200 rounded-xl p-4 text-[13px] text-gray-600 leading-relaxed shadow-sm">
                Based on Jordan's history, they often ask about deployment cycles on Fridays. Should I draft a status report?
              </div>
              <div className="mt-4 bg-[#2563eb] text-white rounded-xl p-4 text-[13px] leading-relaxed shadow-md cursor-pointer hover:bg-[#1d4ed8] transition-colors">
                Yes, please check the current sprint status for project Alpha.
              </div>
            </div>
          ))}

          <div className="h-px bg-gray-100 my-4" />

          {/* Premade Messages (repeated for scroll test) */}
          <h3 className="text-[14px] font-bold text-[#1e293b] mb-4">Premade Messages</h3>
          <div className="space-y-3">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={`premade-${i}`} className="border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-[#2563eb] hover:bg-[#eff6ff] transition-all">
                <p className="text-[13px] font-bold text-[#334155]">{i + 1}. Client Status Update</p>
                <p className="text-[12px] text-gray-500 truncate mt-1">Hi [Name], we are currently reviewing...</p>
              </div>
            ))}
            
            <button className="w-full py-3 mt-4 border border-dashed border-gray-300 rounded-xl text-[12px] font-bold text-gray-500 hover:text-[#2563eb] hover:border-[#2563eb] transition-colors bg-gray-50">
              + Create New Template
            </button>
          </div>
        </div>
        
        {/* AI Chat Input - Moved to Rightmost Panel */}
        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <div className="relative flex items-center bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-[#2563eb] transition-colors overflow-hidden pl-4 pr-2 py-2">
            <input 
              type="text" 
              placeholder="Ask AI Assistant..." 
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-gray-400"
            />
            <button className="p-2 text-[#2563eb] hover:bg-[#eff6ff] rounded-lg transition-colors ml-2">
              <Wand2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}

const mockDirectoryAgents = Array.from({ length: 20 }, (_, i) => ({
  id: `agent-${i}`,
  name: `Agent ${i + 1}`,
  statusColor: i % 2 === 0 ? 'bg-green-500' : 'bg-yellow-500',
  statusText: i % 2 === 0 ? 'Online' : 'Last active 5m ago'
}));

const mockCustomerConversations = Array.from({ length: 20 }, (_, i) => ({
  id: `chat-${i}`,
  name: `Client ${i + 1}`,
  preview: 'This is a longer message preview to test the layout and make sure text truncates correctly...',
  time: '12:05'
}));

const mockInternalConversations = Array.from({ length: 20 }, (_, i) => ({
  id: `internal-${i}`,
  name: `Internal Agent ${i + 1}`,
  statusColor: 'bg-gray-300',
  statusText: 'Offline'
}));

const mockChatMessages = Array.from({ length: 20 }, (_, i) => ({
  id: `msg-${i}`,
  isAgent: i % 2 !== 0,
  text: i % 2 === 0 
    ? `Customer message ${i + 1}: Hello! I'm checking in on the status of my recent ticket. Is there any update?`
    : `Agent reply ${i + 1}: Hi there! I've just escalated this to our technical team for review.`,
  time: `14:${(10 + i).toString().padStart(2, '0')}`
}));
