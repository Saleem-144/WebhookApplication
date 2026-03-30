'use client';

import { useState } from 'react';
import {
  Building2,
  Layers,
  Users,
  TrendingUp,
  ChevronDown,
  MapPin,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  mockStats,
  mockOffices,
  mockDepartments,
  mockAgents,
} from '@/lib/mockData';

const statusColors = {
  available: 'bg-green-500 border-white',
  busy: 'bg-yellow-500 border-white',
  dnd: 'bg-red-500 border-white',
  offline: 'bg-gray-400 border-transparent',
};

const statusLabels = {
  available: 'Available',
  busy: 'Busy',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

export default function HomePage() {
  const [selectedOffice, setSelectedOffice] = useState(mockOffices[0]);
  const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);

  // Filter departments by selected office
  const departments = mockDepartments.filter(
    (d) => d.office_id === selectedOffice.id
  );

  // Filter agents by selected office
  const agents = mockAgents.filter(
    (a) => a.office_id === selectedOffice.id
  );

  // Group agents by department
  const agentsByDepartment = departments.map((dept) => ({
    ...dept,
    agents: agents.filter((a) => a.department_id === dept.id),
  }));

  return (
    <div className="max-w-[1200px] w-full mx-auto p-6 pb-12">
      {/* Page header */}
      <div className="mb-8 pt-2">
        <h1 className="text-[32px] font-bold text-[#334155] leading-tight">
          Operations Hub
        </h1>
        <p className="text-[15px] font-medium text-[#64748b] mt-1">
          Real-time organizational performance metrics.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 mt-4">
        <StatCard
          icon={<Building2 className="w-[18px] h-[18px] text-[#2563eb]" />}
          value={mockStats.totalOffices}
          label="OFFICES"
          color="bg-[#eff6ff]"
        />
        <StatCard
          icon={<Layers className="w-[18px] h-[18px] text-[#3b82f6]" />}
          value={mockStats.totalDepartments}
          label="DEPARTMENTS"
          color="bg-[#eff6ff]"
        />
        <StatCard
          icon={<Users className="w-[18px] h-[18px] text-[#8b5cf6]" />}
          value={mockStats.totalAgents}
          label="AGENTS"
          color="bg-[#f3e8ff]"
        />
      </div>

      {/* Location Filter */}
      <div className="mb-6 mt-10">
        <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
          LOCATION FILTER
        </label>
        <div className="relative inline-block">
          <button
            id="office-filter"
            onClick={() => setOfficeDropdownOpen(!officeDropdownOpen)}
            className="flex items-center gap-2 pl-3 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[14px] font-medium text-[#334155] hover:border-[#2563eb]/50 transition-colors min-w-[200px]"
          >
            <MapPin className="w-[15px] h-[15px] text-[#3b5998]" />
            <span className="flex-1 text-left">{selectedOffice.name}</span>
            <ChevronDown
              className={cn(
                'w-[15px] h-[15px] text-gray-400 transition-transform',
                officeDropdownOpen && 'rotate-180'
              )}
            />
          </button>
          {officeDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden z-10 py-1">
              {mockOffices.map((office) => (
                <button
                  key={office.id}
                  onClick={() => {
                    setSelectedOffice(office);
                    setOfficeDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm hover:bg-[#eff6ff] transition-colors',
                    office.id === selectedOffice.id
                      ? 'text-[#2563eb] font-semibold bg-[#eff6ff]'
                      : 'text-[#334155] font-medium'
                  )}
                >
                  {office.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Department Sections */}
      {agentsByDepartment.map((dept) => (
        <div key={dept.id} className="mb-6 bg-white rounded-[20px] p-8 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-gray-100/50">
          <h2 className="text-[22px] font-bold text-[#2563eb] mb-8 uppercase tracking-wide">
            {selectedOffice.name} - {dept.name}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {dept.agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-gray-50 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            color
          )}
        >
          {icon}
        </div>
        <TrendingUp className="w-[18px] h-[18px] text-gray-400 group-hover:text-[#2563eb] transition-colors" />
      </div>
      <div className="text-[56px] leading-none font-bold text-[#1e293b] mb-2 tracking-tight">
        {value}
      </div>
      <div className="text-[13px] font-semibold text-[#64748b] uppercase tracking-widest mt-2">
        {label}
      </div>
    </div>
  );
}

function AgentCard({ agent }) {
  // Mock image look-alikes based on user prompt not wanting actual images
  const isAgent5 = agent.id === '5';
  
  return (
    <div className="flex items-center gap-4 py-1 group cursor-pointer w-full">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={cn(
          "w-16 h-16 rounded-[14px] flex items-center justify-center overflow-hidden border",
          isAgent5 ? "bg-[#eef2f6] border-gray-200" : "bg-[#111115] border-transparent"
        )}>
           {!isAgent5 ? (
              // Silhouette for agents with black background
              <User className="w-10 h-10 text-gray-500 mt-3" />
           ) : (
              // Gray outline icon for agent 5
              <Users className="w-6 h-6 text-gray-500" />
           )}
        </div>
        
        {/* Status dot */}
        {agent.status !== 'offline' && (
          <div
            className={cn(
              'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2',
              statusColors[agent.status]
            )}
            title={statusLabels[agent.status]}
          />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold text-[#1e293b] group-hover:text-[#2563eb] transition-colors">
          {agent.name}
        </p>
        <p className="text-[13px] font-medium text-[#64748b] truncate mt-0.5">
          {agent.title}
        </p>
      </div>
    </div>
  );
}
