import React from 'react';
import { Mic, MicOff, Video, VideoOff, Crown, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HostStageCardProps {
  name: string;
  avatarUrl?: string | null;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenShare: boolean;
  hasVideo: boolean;
  videoElement?: React.ReactNode;
}

export default function HostStageCard({
  name,
  avatarUrl,
  isMicOn,
  isCamOn,
  isScreenShare,
  hasVideo,
  videoElement,
}: HostStageCardProps) {
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl overflow-hidden',
        'border border-cyan-500/30',
        'shadow-[0_0_24px_rgba(34,211,238,0.15),0_0_60px_rgba(34,211,238,0.06)]',
        'bg-black/80 backdrop-blur-md'
      )}
    >
      {/* Top neon line */}
      <div className="h-[3px] bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400" />

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cyan-500/15 bg-black/30">
        <div className="flex items-center gap-2">
          <Circle size={7} className="fill-cyan-400 text-cyan-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            Host
          </span>
          {isScreenShare && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              SHARING
            </span>
          )}
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 min-h-0 relative bg-slate-950/90 flex items-center justify-center">
        {hasVideo && videoElement ? (
          videoElement
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/25 to-violet-500/25 border-2 border-cyan-400/30 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-[28px] font-black text-cyan-300/80">{initials}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 border-2 border-black flex items-center justify-center shadow-lg">
                <Crown size={12} className="text-amber-300" />
              </div>
            </div>
            <span className="text-sm font-bold text-white/40">{name}</span>
          </div>
        )}

        {/* Mic / Cam status ─ bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* Mic */}
              <span
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full',
                  isMicOn
                    ? 'bg-emerald-500/20 border border-emerald-500/40'
                    : 'bg-red-500/20 border border-red-500/40'
                )}
                title={isMicOn ? 'Microphone on' : 'Microphone off'}
              >
                {isMicOn ? (
                  <Mic size={12} className="text-emerald-400" />
                ) : (
                  <MicOff size={12} className="text-red-400" />
                )}
              </span>

              {/* Camera */}
              <span
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full',
                  isCamOn
                    ? 'bg-cyan-500/20 border border-cyan-500/40'
                    : 'bg-red-500/20 border border-red-500/40'
                )}
                title={isCamOn ? 'Camera on' : 'Camera off'}
              >
                {isCamOn ? (
                  <Video size={12} className="text-cyan-400" />
                ) : (
                  <VideoOff size={12} className="text-red-400" />
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Name bar */}
      <div className="px-3 py-2.5 border-t border-cyan-500/15 bg-black/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-[10px] font-black text-white overflow-hidden flex-shrink-0 border border-cyan-500/30">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : initials
            }
          </div>
          <span className="text-xs font-bold text-white/95 truncate">{name}</span>
        </div>
      </div>
    </div>
  );
}
