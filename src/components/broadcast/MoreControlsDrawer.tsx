import React, { useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  Settings,
  Shield,
  LogOut,
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
  isHost,
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
                   p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]
                   animate-slide-up"
      >
        {/* Grab bar */}
        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />

        {/* Controls */}
        <div className="grid grid-cols-4 gap-4 mb-8">
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

          <ControlButton icon={Settings} label="Settings" onClick={onSettings} />

          {isHost && (
            <ControlButton icon={Shield} label="Admin" onClick={() => {}} />
          )}
        </div>

        {/* Leave */}
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

function ControlButton({ icon: Icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200",
          active
            ? "bg-zinc-800 text-white border border-white/10"
            : "bg-zinc-800/50 text-zinc-400 border border-transparent"
        )}
      >
        <Icon size={24} />
      </div>

      <span className="text-xs text-zinc-400 font-medium">{label}</span>
    </button>
  );
}