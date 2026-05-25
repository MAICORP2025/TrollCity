import React, { useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  Shield,
  LogOut,
  Gift,
  Share2,
  ShieldAlert,
  Ban,
  UserMinus,
  UserCheck,
  Radio,
  Crown,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface MoreControlsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onSettings?: () => void;
  onLeave?: () => void;
  isHost?: boolean;
  /* ── stream-control callbacks ─────────────────── */
  onGift?: () => void;
  onShare?: () => void;
  onEndStream?: () => void;
  onToggleSeatsLock?: () => void;
  areSeatsLocked?: boolean;
  onManageStagePass?: () => void;
  openStagePassCount?: number;
  /* Assign broadofficer (host only) */
  onAssignBroadofficer?: () => void;
  /* ── RGB effect ───────────────────────────────── */
  onToggleRGB?: () => void;
  hasRgbEffect?: boolean;
  /* ── mod-action callbacks (officers only) ─────── */
  isOfficer?: boolean;
  onMuteUser?: (userId: string) => void;
  onBanUser?: (userId: string) => void;
  onRemoveFromStage?: (userId: string) => void;
  onModGift?: (userId: string) => void;
}

export default function MoreControlsDrawer({
  isOpen,
  onClose,
  isMuted,
  isCameraOff,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onSettings,
  onLeave,
  onGift,
  onShare,
  onEndStream,
  onToggleSeatsLock,
  areSeatsLocked = false,
  onManageStagePass,
  openStagePassCount = 0,
  onToggleRGB,
  hasRgbEffect = false,
  onAssignBroadofficer,
  isHost = false,
  isOfficer = false,
  onMuteUser,
  onBanUser,
  onRemoveFromStage,
  onModGift,
}: MoreControlsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Swipe down to close
  useEffect(() => {
    if (!isOpen) return;

    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 120) {
        onClose();
      }
    };

    const node = drawerRef.current;
    node?.addEventListener("touchstart", handleTouchStart);
    node?.addEventListener("touchmove", handleTouchMove);

    return () => {
      node?.removeEventListener("touchstart", handleTouchStart);
      node?.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed bottom-0 left-0 right-0 z-[90]
                   bg-zinc-900 rounded-t-3xl
                   border-t border-white/10
                   max-h-[95vh] overflow-y-auto
                   p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]
                   animate-slide-up"
      >
        {/* Grab bar */}
        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />

        {/* ── Mic / Cam / Flip ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <ControlButton
            icon={isMuted ? MicOff : Mic}
            label={isMuted ? "Unmute" : "Mute"}
            active={!isMuted}
            onClick={onToggleMic}
          />

          <ControlButton
            icon={isCameraOff ? VideoOff : Video}
            label={isCameraOff ? "Start Video" : "Stop Video"}
            active={!isCameraOff}
            onClick={onToggleCamera}
          />

          <ControlButton icon={Camera} label="Flip" onClick={onFlipCamera} />
        </div>

        {/* ── Stream Controls (host / officer) ── */}
        {(isHost || isOfficer) && (
          <div className="mb-6">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.18em] mb-3">Stream Controls</p>
            <div className="grid grid-cols-4 gap-3">
              {onGift && <ControlButton icon={Gift} label="Gift" onClick={onGift} />}
              {onShare && <ControlButton icon={Share2} label="Share" onClick={onShare} />}
              {isHost && onEndStream && (
                <ControlButton icon={Radio} label="End Stream" onClick={onEndStream} active={false} danger />
              )}
              {isHost && onToggleSeatsLock && (
                <ControlButton
                  icon={ShieldAlert}
                  label={areSeatsLocked ? "Unlock Seats" : "Lock Seats"}
                  onClick={onToggleSeatsLock}
                  active={areSeatsLocked}
                />
              )}
              {isHost && onManageStagePass && (
                <ControlButton
                  icon={UserCheck}
                  label={`Seats${openStagePassCount ? ` (${openStagePassCount})` : ''}`}
                  onClick={onManageStagePass}
                />
              )}
              {isHost && onAssignBroadofficer && (
                <ControlButton
                  icon={Shield}
                  label="Assign Officer"
                  onClick={onAssignBroadofficer}
                />
              )}
              {isHost && onToggleRGB && (
                <ControlButton
                  icon={Sparkles}
                  label={hasRgbEffect ? "RGB On" : "RGB Off"}
                  onClick={onToggleRGB}
                  active={hasRgbEffect}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Mod Actions (officers only) ── */}
        {isOfficer && (
          <div className="mb-6">
            <p className="text-[10px] font-black text-red-400/70 uppercase tracking-[0.18em] mb-3">Mod Actions</p>
            <div className="grid grid-cols-4 gap-3">
              {onMuteUser && <ControlButton icon={MicOff} label="Mute User" onClick={() => {}} />}
              {onBanUser && <ControlButton icon={Ban} label="Ban User" onClick={() => {}} />}
              {onRemoveFromStage && <ControlButton icon={UserMinus} label="Remove Stage" onClick={() => {}} />}
              {onModGift && <ControlButton icon={Gift} label="Mod Gift" onClick={() => {}} />}
            </div>
          </div>
        )}

        {/* ── Leave / End ── */}
        <button
          onClick={onLeave}
          className="w-full bg-zinc-800 text-red-400 font-bold py-3.5 rounded-xl
                     flex items-center justify-center gap-2
                     active:scale-[0.97] transition-transform"
        >
          <LogOut size={20} />
          {isHost ? "End Broadcast" : "Leave Broadcast"}
        </button>
      </div>
    </>
  );
}

function ControlButton({ icon: Icon, label, active, onClick, danger }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200",
          danger
            ? "bg-red-500/15 text-red-400 border border-red-500/25"
            : active
              ? "bg-zinc-800 text-white border border-white/10"
              : "bg-zinc-800/50 text-zinc-400 border border-transparent"
        )}
      >
        <Icon size={24} />
      </div>

      <span className={cn("text-xs font-medium", danger ? "text-red-300" : "text-zinc-400")}>{label}</span>
    </button>
  );
}