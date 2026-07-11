import React from "react";
import { Coins } from "lucide-react";

/**
 * Blue-vs-Red score panel. Team score wording is POINTS (gift coin value),
 * never crowns. The winner is derived from these authoritative point totals.
 */
export default function MobileBattleScore({
  bluePoints,
  redPoints,
  timeLeft,
  isSuddenDeath,
  battleStatus,
}: {
  bluePoints: number;
  redPoints: number;
  timeLeft: number;
  isSuddenDeath: boolean;
  battleStatus?: string | null;
}) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const timerLabel = battleStatus === "ended" ? "ENDED" : fmt(timeLeft);

  return (
    <div className="relative flex items-stretch gap-2 rounded-xl border border-white/10 bg-[#0B1020] px-2 py-1.5">
      {/* Blue side */}
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-gradient-to-b from-blue-600/20 to-blue-900/10 py-1 shadow-[inset_0_0_14px_rgba(59,130,246,0.35)]">
        <span className="text-[9px] font-black uppercase tracking-wider text-blue-300">Blue</span>
        <span className="flex items-center gap-1 text-xl font-black text-blue-200">
          <Coins size={14} className="text-yellow-400" />
          {bluePoints.toLocaleString()}
        </span>
      </div>

      {/* Center timer + VS */}
      <div className="flex w-16 flex-col items-center justify-center">
        <span className="font-mono text-base font-black text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">
          {timerLabel}
        </span>
        <span
          className={[
            "mt-0.5 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
            isSuddenDeath ? "text-red-400 animate-pulse" : "text-white/80",
          ].join(" ")}
        >
          VS
        </span>
      </div>

      {/* Red side */}
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-gradient-to-b from-red-600/20 to-red-900/10 py-1 shadow-[inset_0_0_14px_rgba(239,68,68,0.35)]">
        <span className="text-[9px] font-black uppercase tracking-wider text-red-300">Red</span>
        <span className="flex items-center gap-1 text-xl font-black text-red-200">
          <Coins size={14} className="text-yellow-400" />
          {redPoints.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
