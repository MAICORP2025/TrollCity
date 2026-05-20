import React, { useState, useCallback } from 'react';
import { MoreVertical, X, PlusCircle, Hand, Coins, Circle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import HostStageCard from './HostStageCard';
import StageGuestCard from './StageGuestCard';
import type { StagePass } from '../types/broadcast';

interface GuestMicCamState {
  [userId: string]: { micOn: boolean; camOn: boolean };
}

interface BroadcastStageLayoutProps {
  // Host
  hostName: string;
  hostAvatarUrl?: string | null;
  hostIsMicOn: boolean;
  hostIsCamOn: boolean;
  hostIsScreenSharing: boolean;
  hostHasVideo: boolean;
  hostVideoNode?: React.ReactNode;

  // Stage Guests (live: approved+went_live statuses)
  livePasses: StagePass[];
  guestMicCam: GuestMicCamState;

  // Coin balance (display on host card)
  coinBalance: number;

  // Viewer pass state
  isHost: boolean;
  hasOpenPass: boolean;
  currentUserPassStatus?: string | null;
  onRequestPass: () => void;
  onOpenPassModal: () => void;

  // Host actions
  onApproveStagePass?: (id: string) => void;
  onDenyStagePass?: (id: string) => void;
  onRemoveStageGuest?: (id: string) => void;

  // Layout
  className?: string;
}

export default function BroadcastStageLayout({
  hostName,
  hostAvatarUrl,
  hostIsMicOn,
  hostIsCamOn,
  hostIsScreenSharing,
  hostHasVideo,
  hostVideoNode,
  livePasses,
  guestMicCam,
  coinBalance,
  isHost,
  hasOpenPass,
  currentUserPassStatus,
  onRequestPass,
  onOpenPassModal,
  onApproveStagePass,
  onDenyStagePass,
  onRemoveStageGuest,
  className,
}: BroadcastStageLayoutProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number } | null>(null);

  const totalOnStage = 1 + livePasses.length;
  const viewerCanRequest = !isHost && hasOpenPass && currentUserPassStatus !== 'requested' && currentUserPassStatus !== 'approved' && currentUserPassStatus !== 'live';

  const toggleGuestMenu = useCallback((passId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchorPos({ x: rect.left, y: rect.bottom + 4 });
    setActiveMenuId((prev) => (prev === passId ? null : passId));
  }, []);

  const closeMenu = useCallback(() => {
    setActiveMenuId(null);
    setAnchorPos(null);
  }, []);

  // ─── No Stage Guests ───────────────────────────────────────────────────────
  if (livePasses.length === 0) {
    return (
      <div className={cn('flex flex-col h-full min-h-0 gap-3', className)}>
        {/* Top bar: Request Stage Pass button (viewer) / Open Stage Pass (host) */}
        <div className="flex items-center justify-end flex-shrink-0 gap-2">
          {isHost ? (
            <button
              onClick={onOpenPassModal}
              className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-[11px] font-black uppercase tracking-wider
                bg-gradient-to-r from-violet-600 to-purple-600 text-white border border-violet-400/40
                shadow-[0_0_20px_rgba(124,58,237,0.35)] hover:shadow-[0_0_28px_rgba(124,58,237,0.55)] transition-all"
            >
              <PlusCircle size={13} />
              Open Stage Pass
            </button>
          ) : viewerCanRequest ? (
            <button
              onClick={onRequestPass}
              className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-[11px] font-black uppercase tracking-wider
                bg-gradient-to-r from-amber-600 to-orange-600 text-white border border-amber-400/40
                shadow-[0_0_20px_rgba(234,88,12,0.35)] hover:shadow-[0_0_28px_rgba(234,88,12,0.55)] transition-all"
            >
              <Hand size={13} />
              Request Stage Pass
            </button>
          ) : (
            currentUserPassStatus === 'requested' && (
              <span className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                <Circle size={6} className="fill-emerald-400 text-emerald-400 animate-pulse" />
                Requested
              </span>
            )
          )}
        </div>

        {/* Host card full width */}
        <div className="flex-1 min-h-0">
          <HostStageCard
            name={hostName}
            avatarUrl={hostAvatarUrl}
            isMicOn={hostIsMicOn}
            isCamOn={hostIsCamOn}
            isScreenShare={hostIsScreenSharing}
            hasVideo={hostHasVideo}
            videoElement={hostVideoNode}
          />
        </div>
      </div>
    );
  }

  // ─── Stage Guests present ───────────────────────────────────────────────────
  return (
    <div className={cn('flex flex-col h-full min-h-0 gap-3', className)}>
      {/* Top bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          On Stage ({totalOnStage}/6)
        </p>
        <div className="flex items-center gap-2">
          {isHost ? (
            <button
              onClick={onOpenPassModal}
              className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-[11px] font-black uppercase tracking-wider
                bg-gradient-to-r from-violet-600 to-purple-600 text-white border border-violet-400/40
                shadow-[0_0_20px_rgba(124,58,237,0.35)] hover:shadow-[0_0_28px_rgba(124,58,237,0.55)] transition-all"
            >
              <PlusCircle size={13} />
              Open Stage Pass
            </button>
          ) : viewerCanRequest ? (
            <button
              onClick={onRequestPass}
              className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-[11px] font-black uppercase tracking-wider
                bg-gradient-to-r from-amber-600 to-orange-600 text-white border border-amber-400/40
                shadow-[0_0_20px_rgba(234,88,12,0.35)] hover:shadow-[0_0_28px_rgba(234,88,12,0.55)] transition-all"
            >
              <Hand size={13} />
              Request Stage Pass
            </button>
          ) : null}
        </div>
      </div>

      {/* Two-column grid: host (main) + guest strip (right) */}
      <div
        className="flex-1 min-h-0 grid gap-2.5"
        style={{ gridTemplateColumns: '1fr 230px' }}
      >
        {/* Host card — left, fills full height */}
        <div className="min-h-0">
          <HostStageCard
            name={hostName}
            avatarUrl={hostAvatarUrl}
            isMicOn={hostIsMicOn}
            isCamOn={hostIsCamOn}
            isScreenShare={hostIsScreenSharing}
            hasVideo={hostHasVideo}
            videoElement={hostVideoNode}
          />
        </div>

        {/* Guest stack — fixed 230px right column */}
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto scrollbar-hide pr-0.5">
          {livePasses.map((pass, idx) => {
            const gm = guestMicCam[pass.user_id || pass.id] ?? { micOn: true, camOn: true };
            return (
              <div key={pass.id} className="relative shrink-0">
                <StageGuestCard
                  pass={pass}
                  isMicOn={gm.micOn}
                  isCamOn={gm.camOn}
                />

                {/* Three-dot dot-3 menu — host only */}
                {isHost && (
                  <>
                    <button
                      onClick={(e) => toggleGuestMenu(pass.id, e)}
                      className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-md
                        bg-black/70 backdrop-blur border border-white/10
                        flex items-center justify-center hover:bg-white/15 transition-colors"
                    >
                      <MoreVertical size={11} className="text-white/60" />
                    </button>

                    {/* Dropdown */}
                    {activeMenuId === pass.id && anchorPos && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={closeMenu} />
                        <div
                          className="fixed z-30 min-w-[150px] rounded-lg border border-white/15
                            bg-slate-950/98 backdrop-blur-lg p-1"
                          style={{ left: anchorPos.x, top: anchorPos.y }}
                        >
                          <p className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase
                            tracking-wider border-b border-white/8 mb-1">
                            {pass.user_profile?.username || 'Guest'}
                          </p>
                          <button
                            onClick={() => {
                              closeMenu();
                              onRemoveStageGuest?.(pass.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md
                              text-[11px] font-bold text-red-400 hover:bg-red-500/15 transition-colors"
                          >
                            <X size={12} />
                            Remove from Stage
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
