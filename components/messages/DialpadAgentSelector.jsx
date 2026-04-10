'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDialpadPersonLabel,
  primarySendFromNumber,
} from '@/lib/dialpadDirectory';

/**
 * Modernized line switcher UI replacing the native select.
 */
export default function DialpadAgentSelector({
  users = [],
  value,
  onChange,
  disabled,
  id = 'dialpad-line',
  error,
  className,
  /** Navbar: smaller control, visually hidden label */
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedUser = users.find((u) => String(u.id) === String(value));
  const selectedLabel = selectedUser ? formatDialpadPersonLabel(selectedUser) : 'Select line';
  const selectedPhone = selectedUser ? primarySendFromNumber(selectedUser) : '';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (u) => {
    onChange(String(u.id));
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', compact ? 'space-y-0' : 'space-y-1.5', className)} ref={containerRef}>
      <label
        htmlFor={id}
        className={cn(
          'block truncate transition-colors duration-200',
          compact
            ? 'sr-only'
            : 'text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1',
        )}
      >
        Dialpad line
      </label>

      <button
        id={id}
        type="button"
        disabled={disabled || users.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group flex w-full items-center justify-between gap-2.5 rounded-xl border bg-white transition-all duration-200',
          'ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          compact 
            ? 'h-10 px-3.5 text-[13px] border-slate-200 hover:border-slate-300' 
            : 'h-11 px-4 text-[14px] border-slate-200 hover:border-slate-300 shadow-sm',
          isOpen && 'border-blue-500/50 ring-2 ring-blue-500/10',
          error && 'border-red-400 focus:ring-red-500/20'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden text-left">
          <div className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white',
            selectedUser ? 'bg-blue-600' : 'bg-slate-300'
          )}>
            <Phone size={12} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col items-start min-w-0">
             <div className="flex items-center gap-2 max-w-full">
                <span className="truncate font-bold text-slate-900 leading-none">
                  {selectedLabel}
                </span>
                {selectedUser && (
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    selectedUser.is_online ? 'bg-green-500' : 'bg-slate-300'
                  )} />
                )}
             </div>
            {selectedPhone && (
              <span className="truncate text-[11px] font-medium text-slate-500 mt-0.5 leading-none">
                {selectedPhone}
              </span>
            )}
          </div>
        </div>
        <ChevronDown 
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180 text-blue-500'
          )} 
        />
      </button>

      {isOpen && (
        <div className={cn(
          'absolute left-0 right-0 z-[60] mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-200 origin-top',
          compact ? 'w-[280px]' : 'w-full'
        )}>
          {users.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              No lines available
            </div>
          ) : (
            users.map((u) => {
              const label = formatDialpadPersonLabel(u);
              const phone = primarySendFromNumber(u);
              const isSelected = String(u.id) === String(value);

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelect(u)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors',
                    isSelected 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                       <span className={cn(
                        'truncate text-[13px]',
                        isSelected ? 'font-bold' : 'font-semibold'
                      )}>
                        {label}
                      </span>
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        u.is_online ? 'bg-green-500' : 'bg-slate-300'
                      )} />
                    </div>
                    {phone && (
                      <span className={cn(
                        'truncate text-[11px] mt-0.5',
                        isSelected ? 'text-blue-600/70' : 'text-slate-500'
                      )}>
                        {phone}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[11px] font-bold text-red-600 px-1 italic">
          {error}
        </p>
      )}
    </div>
  );
}
