'use client';

import { useEffect, useState } from 'react';
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
  fetchStatsSummary,
  fetchOffices,
  fetchDepartmentsByOffice,
  fetchAgentsByOffice,
} from '@/lib/api';

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

const apiErrorMessage = (err) => {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.message) return err.message;
  return 'Failed to load data';
};

const normalizeAgent = (a) => ({
  ...a,
  title: a.title || a.email || 'Team member',
  status: a.status || 'offline',
});

export default function HomePage() {
  const [summary, setSummary] = useState(null);
  const [offices, setOffices] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [officeLoading, setOfficeLoading] = useState(false);
  const [error, setError] = useState('');
  const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setPageLoading(true);
        setError('');
        const [sumRes, offRes] = await Promise.all([
          fetchStatsSummary(),
          fetchOffices(),
        ]);
        if (cancelled) return;
        setSummary(sumRes.data);
        const list = offRes.data || [];
        setOffices(list);
        if (list.length > 0) {
          setSelectedOffice(list[0]);
        } else {
          setSelectedOffice(null);
          setDepartments([]);
          setAgents([]);
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err));
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedOffice?.id) {
      setDepartments([]);
      setAgents([]);
      return;
    }

    let cancelled = false;

    const loadOfficeData = async () => {
      try {
        setOfficeLoading(true);
        setError('');
        const [dRes, aRes] = await Promise.all([
          fetchDepartmentsByOffice(selectedOffice.id),
          fetchAgentsByOffice(selectedOffice.id),
        ]);
        if (cancelled) return;
        setDepartments(dRes.data || []);
        setAgents((aRes.data || []).map(normalizeAgent));
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err));
      } finally {
        if (!cancelled) setOfficeLoading(false);
      }
    };

    loadOfficeData();
    return () => {
      cancelled = true;
    };
  }, [selectedOffice?.id]);

  const agentsByDepartment = departments.map((dept) => ({
    ...dept,
    agents: agents.filter((a) => a.department_id === dept.id),
  }));

  if (pageLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-[#2563eb]"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (error && !summary && offices.length === 0) {
    return (
      <div className="max-w-[1200px] w-full mx-auto p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  const totalOffices = Number(summary?.total_offices ?? 0);
  const totalDepartments = Number(summary?.total_departments ?? 0);
  const totalAgents = Number(summary?.total_agents ?? 0);

  return (
    <div className="max-w-[1200px] w-full mx-auto p-6 pb-12">
      <div className="mb-8 pt-2">
        <h1 className="text-[32px] font-bold text-[#334155] leading-tight">
          Operations Hub
        </h1>
        <p className="text-[15px] font-medium text-[#64748b] mt-1">
          Real-time organizational performance metrics.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 mt-4">
        <StatCard
          icon={<Building2 className="w-[18px] h-[18px] text-[#2563eb]" />}
          value={totalOffices}
          label="OFFICES"
          color="bg-[#eff6ff]"
        />
        <StatCard
          icon={<Layers className="w-[18px] h-[18px] text-[#3b82f6]" />}
          value={totalDepartments}
          label="DEPARTMENTS"
          color="bg-[#eff6ff]"
        />
        <StatCard
          icon={<Users className="w-[18px] h-[18px] text-[#8b5cf6]" />}
          value={totalAgents}
          label="AGENTS"
          color="bg-[#f3e8ff]"
        />
      </div>

      <div className="mb-6 mt-10">
        <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
          LOCATION FILTER
        </label>
        <div className="relative inline-block">
          <button
            id="office-filter"
            type="button"
            onClick={() => setOfficeDropdownOpen(!officeDropdownOpen)}
            disabled={offices.length === 0}
            className="flex items-center gap-2 pl-3 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[14px] font-medium text-[#334155] hover:border-[#2563eb]/50 transition-colors min-w-[200px] disabled:opacity-50"
          >
            <MapPin className="w-[15px] h-[15px] text-[#3b5998]" />
            <span className="flex-1 text-left">
              {selectedOffice?.name || 'No offices'}
            </span>
            <ChevronDown
              className={cn(
                'w-[15px] h-[15px] text-gray-400 transition-transform',
                officeDropdownOpen && 'rotate-180'
              )}
            />
          </button>
          {officeDropdownOpen && offices.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden z-10 py-1">
              {offices.map((office) => (
                <button
                  key={office.id}
                  type="button"
                  onClick={() => {
                    setSelectedOffice(office);
                    setOfficeDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm hover:bg-[#eff6ff] transition-colors',
                    office.id === selectedOffice?.id
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

      {officeLoading && selectedOffice && (
        <div className="mb-4 text-sm text-[#64748b]">Loading office data…</div>
      )}

      {selectedOffice && agentsByDepartment.length === 0 && !officeLoading && (
        <p className="text-sm text-[#64748b]">
          No departments for this office yet. Add departments and agents in the database (or run{' '}
          <code className="rounded bg-gray-100 px-1">node scripts/seed-data.js</code> in{' '}
          <code className="rounded bg-gray-100 px-1">backend</code> if you use that script).
        </p>
      )}

      {agentsByDepartment.map((dept) => (
        <div
          key={dept.id}
          className="mb-6 bg-white rounded-[20px] p-8 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-gray-100/50"
        >
          <h2 className="text-[22px] font-bold text-[#2563eb] mb-8 uppercase tracking-wide">
            {selectedOffice.name} - {dept.name}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {dept.agents.length === 0 ? (
              <p className="text-sm text-[#64748b] col-span-full">No agents in this department.</p>
            ) : (
              dept.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))
            )}
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
  return (
    <div className="flex items-center gap-4 py-1 group cursor-pointer w-full">
      <div className="relative shrink-0">
        <div
          className={cn(
            'w-16 h-16 rounded-[14px] flex items-center justify-center overflow-hidden border',
            'bg-[#111115] border-transparent'
          )}
        >
          <User className="w-10 h-10 text-gray-500 mt-3" />
        </div>

        {agent.status !== 'offline' && (
          <div
            className={cn(
              'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2',
              statusColors[agent.status] || statusColors.offline
            )}
            title={statusLabels[agent.status] || statusLabels.offline}
          />
        )}
      </div>

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
