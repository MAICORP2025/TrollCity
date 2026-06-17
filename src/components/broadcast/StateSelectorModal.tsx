// ============================================================
// StateSelectorModal Component
// ============================================================
// Modal for users to select their state when enabling State Battle.
// ============================================================

import React, { useState } from 'react';
import { MapPin, Search, Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/config/usStates';

interface StateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stateCode: string) => void;
  isAssigning: boolean;
  currentState: string | null;
}

export default function StateSelectorModal({
  isOpen,
  onClose,
  onSelect,
  isAssigning,
  currentState,
}: StateSelectorModalProps) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = US_STATES.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[80vh] bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-black text-white">Select Your State</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Choose the state you represent in State Battles. Only your state will be shown — never your city.
          </p>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search states..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* State list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No states found.
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {filtered.map((state) => {
              const isSelected = currentState === state.code;
              return (
                <button
                  key={state.code}
                  onClick={() => onSelect(state.code)}
                  disabled={isAssigning}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all',
                    'hover:bg-emerald-500/10 active:scale-[0.97]',
                    isSelected
                      ? 'bg-emerald-500/20 border border-emerald-500/40'
                      : 'bg-slate-800/50 border border-transparent',
                    isAssigning && 'opacity-50 pointer-events-none',
                  )}
                >
                  <span className="text-xs font-bold text-slate-500 w-5 shrink-0">
                    {state.code}
                  </span>
                  <span className="text-xs font-semibold text-white truncate flex-1">
                    {state.name}
                  </span>
                  {isSelected && (
                    <Check size={14} className="text-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              🔒 Only your state is visible to others
            </span>
            {isAssigning && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
