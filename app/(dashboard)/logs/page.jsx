'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  History, 
  Search, 
  Filter, 
  Calendar, 
  MessageSquare, 
  LogIn, 
  Eye, 
  ChevronRight,
  Clock,
  User as UserIcon,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAgentSummaries, fetchAgentLogs } from '@/lib/api';

export default function LogsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSummaries();
  }, []);

  async function loadSummaries() {
    setLoading(true);
    try {
      const res = await fetchAgentSummaries();
      if (res?.success) setAgents(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectAgent(agent) {
    setSelectedAgent(agent);
    setLogsLoading(true);
    try {
      const res = await fetchAgentLogs(agent.id);
      if (res?.success) setAgentLogs(res.data);
    } finally {
      setLogsLoading(false);
    }
  }

  const filteredAgents = agents.filter(a => 
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionIcon = (type) => {
    switch (type) {
      case 'login': return <LogIn className="w-4 h-4 text-green-500" />;
      case 'message_sent': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'message_seen': return <Eye className="w-4 h-4 text-purple-500" />;
      case 'change_password': return <Clock className="w-4 h-4 text-orange-500" />;
      default: return <History className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionLabel = (type) => {
    switch (type) {
      case 'login': return 'Logged In';
      case 'message_sent': return 'Sent Message';
      case 'message_seen': return 'Viewed Message';
      case 'change_password': return 'Changed Password';
      default: return type.replace('_', ' ');
    }
  };

  return (
    <div className="flex bg-[#fbfbfd] h-[calc(100vh-80px)] overflow-hidden">
      {/* Sidebar: Agents List */}
      <div className="w-[320px] border-r border-gray-100 bg-white flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-[24px] font-bold text-[#1e293b] flex items-center gap-3">
            <Users className="w-6 h-6 text-[#2563eb]" />
            Agent Logs
          </h1>
          <p className="text-[13px] text-gray-400 mt-1 font-medium">Monitor agent activity and history</p>
          
          <div className="mt-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-[13.5px] focus:ring-2 focus:ring-[#2563eb]/10 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-[#2563eb] animate-spin" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="w-12 h-12 text-gray-100 mx-auto mb-3" />
              <p className="text-[13px] text-gray-400 font-medium">No agents found</p>
            </div>
          ) : (
            filteredAgents.map(agent => (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left",
                  selectedAgent?.id === agent.id 
                    ? "bg-[#2563eb] text-white shadow-lg shadow-[#2563eb]/20" 
                    : "hover:bg-gray-50 text-gray-700"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/20",
                  selectedAgent?.id === agent.id ? "bg-white/20" : "bg-gray-100"
                )}>
                  {agent.avatar_url ? (
                    <img src={agent.avatar_url} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <UserIcon className={cn("w-5 h-5", selectedAgent?.id === agent.id ? "text-white" : "text-gray-400")} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold truncate">{agent.name}</p>
                  <p className={cn("text-[11px] font-medium truncate", selectedAgent?.id === agent.id ? "text-white/70" : "text-gray-400")}>
                    {agent.last_activity ? `Last active: ${new Date(agent.last_activity).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Never active'}
                  </p>
                </div>
                <ChevronRight className={cn("w-4 h-4 opacity-50", selectedAgent?.id === agent.id ? "text-white" : "text-gray-300")} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Activity Timeline */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#fcfcfd]">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
              <History className="w-10 h-10 text-gray-200" />
            </div>
            <h2 className="text-[20px] font-bold text-gray-900 mb-2">Select an agent</h2>
            <p className="text-[14px] text-gray-500 max-w-xs leading-relaxed">Choose an agent from the list to view their detailed activity history and message tracking logs.</p>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-50">
                    {selectedAgent.avatar_url ? (
                      <img src={selectedAgent.avatar_url} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-[20px] font-bold text-gray-900">{selectedAgent.name}</h2>
                    <p className="text-[13px] text-gray-400 font-medium">{selectedAgent.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Messages</p>
                    <p className="text-[18px] font-bold text-[#2563eb]">{selectedAgent.messages_sent || 0}</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-[14px] font-bold text-green-500 flex items-center justify-end gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Online
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="w-full mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#64748b]" />
                    Activity History
                  </h3>
                  <button onClick={() => handleSelectAgent(selectedAgent)} className="text-[12px] font-bold text-[#2563eb] hover:underline">
                    Refresh Timeline
                  </button>
                </div>

                {logsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
                    <p className="text-[13px] text-gray-400 font-medium">Fetching history...</p>
                  </div>
                ) : agentLogs.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <Calendar className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                    <p className="text-[14px] text-gray-400 font-medium">No activity recorded in the last 60 days</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agentLogs.map((log, idx) => (
                      <div key={log.id} className="group relative flex items-start gap-5 p-5 bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-all">
                        {/* Timeline Connector */}
                        {idx !== agentLogs.length - 1 && (
                          <div className="absolute left-[34px] top-[74px] bottom-[-20px] w-0.5 bg-gray-50 group-hover:bg-gray-100 transition-colors" />
                        )}
                        
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-white group-hover:scale-110 transition-transform">
                          {getActionIcon(log.action_type)}
                        </div>
                        
                        <div className="flex-1 pt-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[14.5px] font-bold text-gray-900">
                              {getActionLabel(log.action_type)}
                            </span>
                            <span className="text-[12px] font-medium text-gray-400 tabular-nums">
                              {new Date(log.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          
                          <div className="text-[13.5px] text-gray-500 font-medium leading-relaxed bg-gray-50/50 rounded-lg p-3">
                            {log.action_type === 'message_sent' && (
                              <div className="space-y-1">
                                <p className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-gray-400">To:</span> {Array.isArray(log.details?.to) ? log.details.to.join(', ') : log.details?.to}
                                </p>
                              </div>
                            )}
                            {log.action_type === 'login' && (
                              <p className="flex items-center gap-1.5">
                                <Filter className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-gray-400">IP:</span> {log.details?.ip || 'Unknown'}
                              </p>
                            )}
                            {log.action_type === 'message_seen' && (
                              <p className="text-purple-600/70">
                                Opened a conversation thread in the Inbox Hub.
                              </p>
                            )}
                            {!['message_sent', 'login', 'message_seen'].includes(log.action_type) && (
                              <p>{JSON.stringify(log.details)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
