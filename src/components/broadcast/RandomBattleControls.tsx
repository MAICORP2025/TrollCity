import React from 'react';
import { Loader2, Swords, Move } from 'lucide-react';

interface RandomBattleControlsProps {
  phase: 'regular' | 'queue' | 'starting' | 'active' | 'ended';
  isQueueEnabled: boolean;
  isBusy: boolean;
  delayUntil: number | null;
  battleStartsAt?: number | null;
  onStart: () => void;
  onStop: () => void;
}

export default function RandomBattleControls({
  phase,
  isQueueEnabled,
  isBusy,
  delayUntil,
  battleStartsAt,
  onStart,
  onStop,
}: RandomBattleControlsProps) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!delayUntil && !battleStartsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [battleStartsAt, delayUntil]);

  const secondsRemaining = delayUntil ? Math.max(0, Math.ceil((delayUntil - now) / 1000)) : 0;
  const battleCountdown = battleStartsAt ? Math.max(0, Math.ceil((battleStartsAt - now) / 1000)) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-fuchsia-400/30 bg-black/80 p-3 text-white shadow-xl backdrop-blur">
      {/* Drag handle - grab to reposition */}
      <div className="flex justify-center py-1 cursor-grab">
        <Move size={14} className="text-white/50" />
      </div>

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

      <button
        type="button"
        onClick={isQueueEnabled ? onStop : onStart}
        disabled={isBusy}
        onMouseDown={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-fuchsia-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-fuchsia-500 disabled:opacity-60"
      >
        {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />}
        {isQueueEnabled ? 'Stop Random Battles' : 'Start Random Battles'}
      </button>
    </div>
  );
}