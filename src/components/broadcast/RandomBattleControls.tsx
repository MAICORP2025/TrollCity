import React, { useState } from 'react';
import { Loader2, Swords, Move, Globe, Flag, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BattleModeType } from '@/types/stateBattle';

interface RandomBattleControlsProps {
  phase: 'regular' | 'queue' | 'starting' | 'active' | 'ended';
  isQueueEnabled: boolean;
  isBusy: boolean;
  delayUntil: number | null;
  battleStartsAt?: number | null;
  onStart: () => void;
  onStop: () => void;
  // State battle additions
  battleMode: BattleModeType;
  onBattleModeChange: (mode: BattleModeType) => void;
  userState: string | null;
  userStateName: string | null;
  onRequestStateSelect: () => void;
  isStateMatching?: boolean;
}

export default function RandomBattleControls({
  phase,
  isQueueEnabled,
  isBusy,
  delayUntil,
  battleStartsAt,
  onStart,
  onStop,
  battleMode,
  onBattleModeChange,
  userState,
  userStateName,
  onRequestStateSelect,
  isStateMatching = false,
}: RandomBattleControlsProps) {
  const [now, setNow] = useState(Date.now());
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  React.useEffect(() => {
    if (!delayUntil && !battleStartsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [battleStartsAt, delayUntil]);

  const secondsRemaining = delayUntil ? Math.max(0, Math.ceil((delayUntil - now) / 1000)) : 0;
  const battleCountdown = battleStartsAt ? Math.max(0, Math.ceil((battleStartsAt - now) / 1000)) : 0;

  const isStateMode = battleMode === 'state';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-fuchsia-400/30 bg-black/80 p-3 text-white shadow-xl backdrop-blur">
      {/* Drag handle */}
      <div className="flex justify-center py-1 cursor-grab">
        <Move size={14} className="text-white/50" />
      </div>

      {/* Battle Mode Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowModeDropdown(!showModeDropdown)}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full flex items-center justify-between gap-2 rounded-lg bg-slate-800/80 border border-slate-600/50 px-3 py-2 text-xs font-semibold transition hover:bg-slate-700/80"
        >
          <div className="flex items-center gap-2">
            {isStateMode ? (
              <Flag size={13} className="text-emerald-400" />
            ) : (
              <Globe size={13} className="text-blue-400" />
            )}
            <span>{isStateMode ? '🏛️ State Battle' : '🌎 World Battle'}</span>
          </div>
          <ChevronDown size={12} className={cn('text-slate-400 transition', showModeDropdown && 'rotate-180')} />
        </button>

        {showModeDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-slate-600/50 bg-slate-900 shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => {
                onBattleModeChange('world');
                setShowModeDropdown(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition text-left',
                !isStateMode ? 'bg-blue-500/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800',
              )}
            >
              <Globe size={13} className="text-blue-400" />
              <div>
                <div>🌎 World Battle</div>
                <div className="text-[10px] text-slate-500 font-normal">Battle against any creator worldwide</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                onBattleModeChange('state');
                setShowModeDropdown(false);
                if (!userState) {
                  onRequestStateSelect();
                }
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition text-left border-t border-slate-700/50',
                isStateMode ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-300 hover:bg-slate-800',
              )}
            >
              <Flag size={13} className="text-emerald-400" />
              <div>
                <div>🏛️ State Battle</div>
                <div className="text-[10px] text-slate-500 font-normal">
                  {userStateName
                    ? `Representing ${userStateName}`
                    : 'Represent your state — select your state first'}
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* State indicator when in state mode */}
      {isStateMode && userStateName && (
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5">
          <Flag size={11} className="text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-300">
            Representing: {userStateName}
          </span>
        </div>
      )}

      {/* State missing warning */}
      {isStateMode && !userState && (
        <button
          type="button"
          onClick={onRequestStateSelect}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20 transition"
        >
          <Flag size={11} />
          Select your state to enable State Battles
        </button>
      )}

      {phase === 'starting' && (
        <div className="rounded-md border border-amber-300/30 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100">
          Battle starts soon{battleCountdown > 0 ? ` in ${battleCountdown}s` : '...'}
        </div>
      )}

      {isQueueEnabled && secondsRemaining > 0 && (
        <div className="text-[11px] font-semibold text-fuchsia-100">
          Matchmaking opens in {secondsRemaining}s
        </div>
      )}

      {/* Main action button */}
      <button
        type="button"
        onClick={isQueueEnabled ? onStop : onStart}
        disabled={isBusy || (isStateMode && !userState)}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition disabled:opacity-60',
          isStateMode
            ? 'bg-emerald-600 hover:bg-emerald-500'
            : 'bg-fuchsia-600 hover:bg-fuchsia-500',
        )}
      >
        {isBusy || isStateMatching ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Swords size={14} />
        )}
        {isQueueEnabled
          ? 'Stop Random Battles'
          : isStateMode
          ? 'Start State Battle'
          : 'Start Random Battles'}
      </button>
    </div>
  );
}