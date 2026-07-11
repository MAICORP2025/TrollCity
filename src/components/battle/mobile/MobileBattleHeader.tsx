import React, { useState } from "react";
import { Swords, Eye, MoreVertical, Users, Coins } from "lucide-react";

interface BattleViewerItem {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  coins: number;
}

/**
 * Mobile battle header: back, crossed-swords, BATTLE title, a Viewers pill
 * (top gifter avatar + live count, expands to a ranked gift list), and More.
 */
export default function MobileBattleHeader({
  viewerCount,
  viewers,
  onBack,
  onOverflow,
}: {
  viewerCount: number;
  viewers?: BattleViewerItem[];
  onBack: () => void;
  onOverflow?: () => void;
}) {
  const [viewersOpen, setViewersOpen] = useState(false);
  const topViewer = viewers && viewers.length > 0 ? viewers[0] : null;

  return (
    <div className="relative flex items-center gap-2 border-b border-white/10 bg-[#0B1020] px-3 py-2">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white active:scale-95"
      >
        ←
      </button>

      <div className="flex items-center gap-1.5">
        <Swords size={18} className="text-purple-400" />
        <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Battle</span>
      </div>

      {/* Viewers pill — top gifter avatar + live count, expands to gift list */}
      <div className="relative">
        <button
          onClick={() => setViewersOpen((v) => !v)}
          className="ml-1 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2 py-1 active:scale-95"
        >
          {topViewer?.avatarUrl ? (
            <img
              src={topViewer.avatarUrl}
              alt={topViewer.username}
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <Users size={14} className="text-white/80" />
          )}
          <span className="text-[11px] font-bold text-white">Battles</span>
          <span className="text-[11px] font-bold text-white">
            {(viewerCount || 0).toLocaleString()}
          </span>
          <Eye size={12} className="text-white/60" />
        </button>

        {viewersOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 flex max-h-[60vh] w-60 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl">
            <div className="border-b border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/50">
              Top Gifters
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
            {viewers && viewers.length > 0 ? (
              viewers.map((v, i) => (
                <div
                  key={v.userId}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  {v.avatarUrl ? (
                    <img
                      src={v.avatarUrl}
                      alt={v.username}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-zinc-700" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">
                    {i === 0 ? `${v.username} 👑` : v.username}
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] font-black text-yellow-400">
                    <Coins size={11} />
                    {v.coins.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-white/40">No gifters yet</div>
            )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onOverflow}
        aria-label="More"
        className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white active:scale-95"
      >
        <MoreVertical size={16} />
      </button>
    </div>
  );
}
