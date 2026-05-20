import React, { useMemo, useCallback, useEffect } from 'react';
import {
  Coins,
  Crown,
  Gift,
  Plus,
  BadgeCheck,
  Radio,
  Video,
  Mic,
  MicOff,
  Share2,
  MoreHorizontal,
  Ticket,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { getCategoryConfig } from '../../config/broadcastCategories';
import { Stream } from '../../types/broadcast';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

/**
 * BroadcastNeonHeader
 *
 * Full-width top header bar. Three sections:
 *   left   — broadcaster identity (avatar, name, subtitle, category pill)
 *   center — status pills (LIVE, viewer count, timer)
 *   right  — coin balance, + coins button, large Gift button
 */
const LIVE_DOT_CLASS = 'h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse';

export interface BroadcastNeonHeaderProps {
  stream: Stream;
  broadcasterProfile: {
    username?: string;
    avatar_url?: string | null;
    display_name?: string;
  } | null;
  isHost: boolean;
  liveViewerCount: number;
  handleLike: () => void;
  onGift: () => void;
  onShare?: () => void;
  onEndStream?: () => void;
  onClose?: () => void;
  coinBalance?: number;
  onAddCoins?: () => void;
  isLive: boolean;
  streamStartedAt?: string | null;
  /** Called when the plus-coin button is clicked */
  onOpenCoinStore?: () => void;
}

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function BroadcastNeonHeader({
  stream,
  broadcasterProfile,
  isHost,
  liveViewerCount,
  handleLike,
  onGift,
  onShare,
  onEndStream,
  onClose,
  coinBalance,
  onOpenCoinStore,
  isLive,
  streamStartedAt,
}: BroadcastNeonHeaderProps) {
  const { profile } = useAuthStore();
  const coinDisplay = coinBalance ?? profile?.troll_coins ?? 0;
  const streamTitle = stream.title || stream.category || 'Live';

  // Poll coin balance so it stays fresh on the header (same hook as old BroadcastHeader)
  React.useEffect(() => {
    if (!profile?.id) return;
    const refresh = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', profile.id)
        .maybeSingle();
      if (!data) return;
    };
    const t = window.setInterval(refresh, 15000);
    return () => { window.clearInterval(t); };
  }, [profile?.id]);


  const timerMs = useMemo(() => {
    if (!streamStartedAt) return 0;
    const start = new Date(streamStartedAt).getTime();
    return Math.max(0, Date.now() - start);
  }, [streamStartedAt]);
  const timerStr = useMemo(() => formatTimer(timerMs), [timerMs]);

  const handleLikeLocal = useCallback(() => {
    handleLike();
  }, [handleLike]);

  const categoryConfig = getCategoryConfig(stream.category || 'general');
  const isLikingRef = React.useRef(false);

  return (
    <header className="flex h-[104px] shrink-0 items-center justify-between px-5 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      {/* ── LEFT: Broadcaster Identity ─────────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative h-20 w-20 rounded-full p-[2px] bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_35px_rgba(168,85,247,0.45)]">
          {broadcasterProfile?.avatar_url ? (
            <img
              src={broadcasterProfile.avatar_url}
              alt={broadcasterProfile.username || 'Broadcaster'}
              className="h-full w-full rounded-full object-cover bg-black"
            />
          ) : (
            <div className="h-full w-full rounded-full bg-[#111] flex items-center justify-center">
              <Crown className="h-8 w-8 text-purple-400" />
            </div>
          )}
        </div>

        {/* Name block */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] font-black tracking-tight text-white leading-none">
              {broadcasterProfile?.display_name || broadcasterProfile?.username || streamTitle}
            </h1>
            <BadgeCheck className="h-7 w-7 text-purple-400 -ml-1 mt-[-10px]" />
          </div>

          <p className="mt-1.5 text-[15px] font-semibold text-slate-300 truncate max-w-[300px]">
            {streamTitle}
          </p>

          <span className="mt-2 inline-flex rounded-md bg-purple-600/60 px-3 py-1 text-[11px] font-black text-white shadow-[0_0_14px_rgba(168,85,247,0.4)]">
            {categoryConfig.name || 'Just Chatting'}
          </span>
        </div>
      </div>

      {/* ── CENTER: Status pills ──────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/60 px-5 py-3 shadow-[0_0_22px_rgba(0,0,0,0.45)]">
        {/* LIVE pill */}
        {isLive && (
          <>
            <span className="flex items-center gap-2 text-sm font-black text-red-400">
              <span className={LIVE_DOT_CLASS} />
              LIVE
            </span>
            <span className="h-6 w-px bg-white/10" />
          </>
        )}

        {/* Viewer count */}
        <span className="flex items-center gap-2 text-sm font-bold text-white/80">
          <Crown className="h-4 w-4 text-purple-300" />
          {liveViewerCount >= 1000
            ? `${(liveViewerCount / 1000).toFixed(1)}K`
            : liveViewerCount}
        </span>

        <span className="h-6 w-px bg-white/10" />

        {/* Timer */}
        <span className="text-sm font-bold text-white/70 tabular-nums">
          ⏱ {timerStr}
        </span>
      </div>

      {/* ── RIGHT: Coins + Gift button ────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Coin pill */}
        <div className="flex items-center gap-3 rounded-[18px] border border-yellow-400/25 bg-yellow-500/10 px-5 py-3 shadow-[0_0_25px_rgba(234,179,8,0.16)]">
          <Coins className="h-6 w-6 text-yellow-300" />
          <span className="text-xl font-black text-yellow-300 tabular-nums">{coinDisplay >= 1_000_000 ? `${(coinDisplay / 1_000_000).toFixed(1)}M` : coinDisplay >= 1_000 ? `${(coinDisplay / 1_000).toFixed(1)}K` : coinDisplay.toLocaleString()}</span>
          {onOpenCoinStore && (
            <button
              onClick={onOpenCoinStore}
              className="ml-1.5 grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Open coin store"
            >
              <Plus className="h-4 w-4 text-white" />
            </button>
          )}
        </div>

        {/* Gift button */}
        <button
          onClick={onGift}
          className="flex h-[66px] items-center gap-3 rounded-2xl border border-fuchsia-400/60 bg-gradient-to-r from-purple-700/80 to-fuchsia-600/80 px-9 text-xl font-black uppercase text-white shadow-[0_0_35px_rgba(217,70,239,0.55)] hover:scale-[1.02] transition-transform"
        >
          <Gift className="h-7 w-7 text-yellow-300" />
          Gift
        </button>
      </div>
    </header>
  );
}
