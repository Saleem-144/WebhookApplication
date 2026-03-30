'use client';

import { useState } from 'react';
import {
  User,
  ArrowDownLeft,
  ArrowUpRight,
  PhoneMissed,
  Download,
  Ban
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CallsPage() {
  const [activeTab, setActiveTab] = useState('agents'); // 'agents' or 'customers'
  const [selectedAgentId, setSelectedAgentId] = useState('agent-0'); 
  const [selectedChatId, setSelectedChatId] = useState('chat-0');

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
                  {agent.id === 'agent-2' ? (
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
                  'w-full text-left px-4 py-4 rounded-xl transition-all border outline-none',
                  selectedChatId === conv.id
                    ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100'
                    : 'bg-transparent border-transparent hover:border-gray-100 hover:shadow-sm'
                )}
              >
                <p className={cn("text-[14px] font-bold", selectedChatId === conv.id ? "text-[#1e40af]" : "text-[#1e293b]")}>
                  {conv.name}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* COLUMN 2: Call Logs Entity List */}
      <div className="w-[340px] border-r border-gray-200 bg-white flex flex-col shrink-0 h-full">
        <div className="p-6 pb-4 flex items-center justify-between border-b border-gray-100 shrink-0">
          <h2 className="text-[18px] font-bold text-[#1e40af]">Call logs</h2>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'agents' ? (
             <div className="flex flex-col h-full">
               {/* Customer List for Agent */}
               <div className="flex-1 overflow-y-auto p-3 space-y-1">
                 {mockCustomerConversations.map((conv) => (
                   <button
                     key={conv.id}
                     onClick={() => setSelectedChatId(conv.id)}
                     className={cn(
                       'w-full text-left p-4 rounded-xl transition-all outline-none',
                       selectedChatId === conv.id
                         ? 'bg-[#f4f7fa] text-[#1e40af]'
                         : 'bg-white text-[#1e293b] hover:bg-gray-50'
                     )}
                   >
                     <p className="text-[14px] font-bold">
                       {conv.name}
                     </p>
                   </button>
                 ))}
               </div>
               
               {/* Internals Section */}
               <div className="shrink-0 flex flex-col mt-2">
                 <div className="border-t border-gray-400 mx-8 inline-block" />
                 <h3 className="text-center text-[15px] font-bold text-[#1e40af] mt-4 mb-2">Internals</h3>
               </div>
               <div className="h-[200px] shrink-0 overflow-y-auto p-3 space-y-2">
                 {mockInternalConversations.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3 w-full p-2 cursor-pointer rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="relative shrink-0 w-10 h-10 rounded-xl bg-[#111115] flex items-center justify-center overflow-hidden">
                        {agent.id === 'internal-2' ? (
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
               {/* Agent List for Customer */}
               <div className="flex-1 overflow-y-auto p-3 space-y-2">
                 {mockDirectoryAgents.map((agent) => (
                    <div key={agent.id} 
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={cn(
                        "flex items-center gap-3 w-full border border-transparent rounded-xl p-3 shadow-sm cursor-pointer transition-colors",
                        selectedAgentId === agent.id 
                          ? "bg-white border-gray-200" 
                          : "hover:bg-gray-50 bg-transparent"
                      )}
                    >
                      <div className="relative shrink-0 w-10 h-10 rounded-xl bg-[#111115] flex items-center justify-center overflow-hidden">
                        {agent.id === 'agent-2' ? (
                          <span className="text-[#3b5998] font-bold text-sm bg-[#e8edff] w-full h-full flex items-center justify-center">EL</span>
                        ) : (
                          <User className="w-6 h-6 text-gray-400 mt-2" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[14px] font-bold group-hover:text-[#2563eb] transition-colors", selectedAgentId === agent.id ? "text-[#1e40af]" : "text-[#1e293b]")}>
                          {agent.name}
                        </p>
                        {selectedAgentId === agent.id ? (
                           <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <p className="text-[12px] font-medium text-gray-500 truncate mt-0.5">
                                Online
                              </p>
                           </div>
                        ) : (
                           <p className="text-[12px] font-medium text-gray-500 truncate mt-0.5">
                             {agent.statusText}
                           </p>
                        )}
                      </div>
                    </div>
                 ))}
               </div>
               
               <div className="border-t border-gray-400 mt-auto mx-8 mb-4 shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 3: Data Table */}
      <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden relative">
        <div className="flex-1 overflow-y-auto px-8 py-6 z-10 w-full">
           <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider w-[25%]">Date & Time</th>
                  <th className="py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider w-[20%]">Duration</th>
                  <th className="py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider w-[25%]">Status</th>
                  <th className="py-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-right w-[30%]">Action</th>
                </tr>
              </thead>
              <tbody>
                {mockCallsData.map((call) => (
                  <tr key={call.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-6">
                      <p className="text-[14px] font-bold text-[#1e293b]">{call.date}</p>
                      <p className="text-[12px] text-gray-400 mt-1 font-medium">{call.time}</p>
                    </td>
                    <td className="py-6">
                      <span className="text-[14px] text-[#64748b] font-medium">{call.duration}</span>
                    </td>
                    <td className="py-6">
                      <div className="flex items-center gap-2">
                        {call.status === 'INCOMING' && (
                          <>
                            <ArrowDownLeft className="w-4 h-4 text-green-500" strokeWidth={2.5} />
                            <span className="text-[12px] font-bold text-green-500 tracking-wider">INCOMING</span>
                          </>
                        )}
                        {call.status === 'OUTGOING' && (
                          <>
                            <ArrowUpRight className="w-4 h-4 text-[#2563eb]" strokeWidth={2.5} />
                            <span className="text-[12px] font-bold text-[#2563eb] tracking-wider">OUTGOING</span>
                          </>
                        )}
                        {call.status === 'MISSED' && (
                          <>
                            <ArrowDownLeft className="w-4 h-4 text-red-500" strokeWidth={2.5} />
                            <span className="text-[12px] font-bold text-red-500 tracking-wider">MISSED</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-6">
                      <div className="flex justify-end">
                        {call.hasRecording ? (
                          <button className="flex items-center gap-2 px-4 py-2 bg-[#f4f7fa] hover:bg-[#e2e8f0] text-[#1e40af] text-[12px] font-bold rounded-lg transition-colors border border-[#e2e8f0]/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <Download className="w-4 h-4" />
                            Download Transcript
                          </button>
                        ) : (
                          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 text-[12px] font-bold rounded-lg cursor-not-allowed border border-transparent">
                            <Ban className="w-4 h-4" />
                            No Recording
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      </div>
      
    </div>
  );
}

// Mock Data
const mockDirectoryAgents = [
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `agent-${i}`,
    name: ['Agent Sarah K.', 'Agent Marcus V.', 'Elena Lopez', 'David Chen'][i],
    statusColor: i % 2 === 0 ? 'bg-green-500' : 'bg-yellow-500',
    statusText: i === 0 ? 'Online' : i === 1 ? 'Last active 5m ago' : i === 2 ? 'Offline' : 'Away'
  })),
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `agent-ext-${i}`,
    name: `Agent ${i + 5}`,
    statusColor: 'bg-green-500',
    statusText: 'Online'
  }))
];

const mockCustomerConversations = [
  { id: 'chat-0', name: '+1(234)567' },
  { id: 'chat-1', name: 'Client 2 (Aria)' },
  { id: 'chat-2', name: 'Corporate Hub' },
  { id: 'chat-3', name: 'Client 3 (Sasha)' },
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `chat-ext-${i}`,
    name: `Client ${i + 4}`
  }))
];

const mockInternalConversations = [
  { id: 'internal-0', name: 'Agent Marcus V.', statusColor: 'bg-yellow-500', statusText: 'Last active 5m ago' },
  { id: 'internal-1', name: 'Elena Lopez', statusColor: 'bg-gray-300', statusText: 'Offline' },
  { id: 'internal-2', name: 'David Chen', statusColor: 'bg-yellow-500', statusText: 'Away' },
  ...Array.from({ length: 17 }, (_, i) => ({
    id: `internal-ext-${i}`,
    name: `Internal Agent ${i + 4}`,
    statusColor: 'bg-gray-300',
    statusText: 'Offline'
  }))
];

// Combine multiple instances of the pattern shown in the mock image to test scroll constraints
const baseCalls = [
  { id: 'call-1', date: '25/03/2026', time: '14:06 PM', duration: '05:24', status: 'INCOMING', hasRecording: true },
  { id: 'call-2', date: '25/03/2026', time: '11:15 AM', duration: '00:00', status: 'MISSED', hasRecording: false },
  { id: 'call-3', date: '24/03/2026', time: '17:45 PM', duration: '12:18', status: 'OUTGOING', hasRecording: true },
  { id: 'call-4', date: '24/03/2026', time: '09:30 AM', duration: '03:45', status: 'INCOMING', hasRecording: true },
];

const mockCallsData = [
  ...baseCalls,
  ...baseCalls.map(c => ({...c, id: c.id + '-2'})),
  ...baseCalls.map(c => ({...c, id: c.id + '-3'})),
  ...baseCalls.map(c => ({...c, id: c.id + '-4'})),
];
