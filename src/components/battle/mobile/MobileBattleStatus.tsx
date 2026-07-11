import React from "react";

/**
 * Battle status banner. Winner is decided from authoritative final point totals,
 * never crowns.
 */
export default function MobileBattleStatus({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "sudden" | "blue" | "red" | "ended";
}) {
  const toneClass =
    tone === "sudden"
      ? "bg-red-500/20 text-red-200 border-red-500/40 animate-pulse"
      : tone === "blue"
      ? "bg-blue-500/20 text-blue-200 border-blue-500/40"
      : tone === "red"
      ? "bg-red-500/20 text-red-200 border-red-500/40"
      : tone === "ended"
      ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
      : "bg-white/5 text-white/70 border-white/10";

  return (
    <div className={`flex items-center justify-center gap-2 border-y px-3 py-1.5 text-xs font-black uppercase tracking-wider ${toneClass}`}>
      {label}
    </div>
  );
}
