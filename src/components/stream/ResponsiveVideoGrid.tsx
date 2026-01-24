import React from 'react';
import { Participant, LocalParticipant } from 'livekit-client';
import VideoTile from '../broadcast/VideoTile';
import { Camera } from 'lucide-react';

interface ResponsiveVideoGridProps {
  participants: Participant[];
  localParticipant?: LocalParticipant;
  broadcasterId?: string;
  seats?: any[];
  isHost?: boolean;
  hostSeatIndex?: number;
  onLeaveSession?: () => void;
  joinPrice?: number;
  onJoinRequest?: (seatIndex: number) => void;
  onDisableGuestMedia?: (participantId: string, disableVideo: boolean, disableAudio: boolean) => void;
  coinBalances?: Record<string, number>;
  onHostSeatChange?: (seatIndex: number) => void;
  onSeatAction?: (params: { seatIndex: number; seat: any; participant?: Participant }) => void;
  boxCount?: number;
  onUserClick?: (participant: Participant) => void;
  onToggleCamera?: () => void;
  isCameraOn?: boolean;
}

export default function ResponsiveVideoGrid({
  participants,
  localParticipant,
  broadcasterId,
  seats,
  isHost,
  hostSeatIndex: _hostSeatIndex,
  onLeaveSession,
  joinPrice = 0,
  onJoinRequest,
  onDisableGuestMedia,
  coinBalances,
  onHostSeatChange: _onHostSeatChange,
  onSeatAction: _onSeatAction,
  boxCount = 0,
  onUserClick,
  onToggleCamera,
  isCameraOn
}: ResponsiveVideoGridProps) {
  const broadcaster =
    (broadcasterId && participants.find((p) => p.identity === broadcasterId)) ||
    participants[0] ||
    null;

  const [frameMode, setFrameMode] = React.useState<'none' | 'neon' | 'rgb'>(() => {
    if (typeof window === 'undefined') return 'neon';
    const stored = window.localStorage.getItem('troll_frame_mode');
    if (stored === 'none' || stored === 'neon' || stored === 'rgb') return stored;
    return 'neon';
  });

  const [neonColor, setNeonColor] = React.useState<string>(() => {
    if (typeof window === 'undefined') return 'purple';
    return window.localStorage.getItem('troll_neon_color') || 'purple';
  });
  const neonColors = ['purple', 'blue', 'green', 'red', 'pink', 'yellow', 'cyan', 'orange'];

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('troll_neon_color', neonColor);
  }, [neonColor]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('troll_frame_mode', frameMode);
  }, [frameMode]);

  const isLocalBroadcaster =
    !!(localParticipant && broadcaster && broadcaster.identity === localParticipant.identity);

  // Fixed 6 guest slots - always show all positions
  const maxGuestSeats = 6;
  const activeGuestCount = Math.max(0, Math.min(maxGuestSeats, boxCount || 0));
  
  // Create fixed 6 guest slots (L1, L2, L3, R1, R2, R3)
  const guestSlots = Array.from({ length: maxGuestSeats }, (_, index) => {
    const seatIndex = index;
    const isActive = index < activeGuestCount;
    const seat = Array.isArray(seats) && seats.length > seatIndex ? seats[seatIndex] : null;
    let participant: Participant | undefined;

    if (isActive && seat && (seat as any).user_id) {
      participant = participants.find((p) => p.identity === (seat as any).user_id);
    }

    // Removed fallback logic that auto-filled slots with random participants.
    // Slots should only be filled if there is an explicit seat assignment.

    return {
      key: `slot-${index}`,
      seatIndex: index,
      position: ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'][index],
      participant: participant || null,
      seat,
      isActive
    };
  });

  const canControlFrames = !!isLocalBroadcaster || !!isHost;

  if (!broadcaster) {
    return null;
  }

  const getNeonStyle = (color: string) => {
    const colorMap: Record<string, string> = {
      purple: 'border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.7)]',
      blue: 'border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.7)]',
      green: 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.7)]',
      red: 'border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.7)]',
      pink: 'border-pink-400 shadow-[0_0_20px_rgba(244,114,182,0.7)]',
      yellow: 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.7)]',
      cyan: 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.7)]',
      orange: 'border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.7)]'
    };
    return `border-2 ${colorMap[color] || colorMap['purple']} animate-neon-pulse`;
  };

  const hostFrameClass =
    frameMode === 'neon'
      ? getNeonStyle(neonColor)
      : frameMode === 'rgb'
        ? 'border-2 border-transparent rgb-frame'
        : 'border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)]';

  const guestFrameClass = (position: string) => {
    const baseClass =
      frameMode === 'neon'
        ? getNeonStyle(neonColor)
        : frameMode === 'rgb'
          ? 'border border-transparent rgb-frame-small'
          : 'border border-purple-500/20 hover:border-purple-500/40';

    // Keep positional class for testing/debugging and potential layout tweaks
    const safePosition = position?.toString().replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'slot';
    return `${baseClass} guest-${safePosition}`.trim();
  };

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-3 p-2 md:p-4">
      {canControlFrames && (
        <div className="flex items-center justify-end gap-2 mb-1 text-[11px] sm:text-xs">
          {frameMode === 'neon' && (
            <div className="flex items-center gap-1 pr-1">
              <select
                value={neonColor}
                onChange={(e) => setNeonColor(e.target.value)}
                className="bg-zinc-800 text-white text-xs border border-zinc-600 rounded px-2 py-1 outline-none focus:border-purple-500"
                aria-label="Select neon color"
              >
                {neonColors.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <span className="text-gray-400">Frames</span>
          <button
            type="button"
            onClick={() => setFrameMode('none')}
            className={`px-2 py-1 rounded-full border text-xs ${
              frameMode === 'none'
                ? 'bg-zinc-800 border-zinc-500 text-white'
                : 'bg-transparent border-zinc-700 text-gray-400'
            }`}
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => setFrameMode('neon')}
            className={`px-2 py-1 rounded-full border text-xs ${
              frameMode === 'neon'
                ? 'bg-purple-700 border-purple-400 text-white shadow-[0_0_16px_rgba(168,85,247,0.8)]'
                : 'bg-transparent border-purple-700 text-purple-300'
            }`}
          >
            Neon
          </button>
          <button
            type="button"
            onClick={() => setFrameMode('rgb')}
            className={`px-2 py-1 rounded-full border text-xs ${
              frameMode === 'rgb'
                ? 'bg-pink-700 border-pink-400 text-white shadow-[0_0_16px_rgba(244,114,182,0.8)]'
                : 'bg-transparent border-pink-700 text-pink-300'
            }`}
          >
            RGB
          </button>
        </div>
      )}
      
      {/* Fixed Grid Layout: Left Column | Center Broadcaster | Right Column */}
      <div className="broadcast-fixed-grid">
        {/* Left Column - 3 Guest Slots (L1, L2, L3) */}
        <div className="broadcast-left-column">
          {guestSlots.slice(0, 3).map((slot) => (
            <div 
              key={slot.key}
              className={`broadcast-guest-slot ${guestFrameClass(slot.position)}`}
              onClick={() => !slot.participant && slot.isActive && onJoinRequest?.(slot.seatIndex)}
            >
              {slot.participant && slot.isActive ? (
                <VideoTile
                  participant={slot.participant}
                  isLocal={!!(localParticipant && slot.participant.identity === localParticipant.identity)}
                  isHost={isHost}
                  onDisableGuestMedia={onDisableGuestMedia}
                  price={joinPrice}
                  coinBalance={slot.participant.identity ? coinBalances?.[slot.participant.identity] : undefined}
                  compact
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                  onClick={
                    !isHost &&
                    !(localParticipant && slot.participant.identity === localParticipant.identity) &&
                    onUserClick
                      ? () => onUserClick(slot.participant!)
                      : undefined
                  }
                />
              ) : slot.isActive ? (
                <div className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="text-4xl font-bold text-purple-300/30 group-hover:text-purple-300/50 transition-colors">
                    +
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/20">
                  <div className="text-2xl font-bold text-purple-300/10">
                    +
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Center - Broadcaster (Large, spans 3 rows) */}
        <div className={`broadcast-center-slot ${hostFrameClass}`}>
          <VideoTile
            participant={broadcaster}
            isBroadcaster
            isLocal={!!isLocalBroadcaster}
            isHost={isHost}
            onLeave={isLocalBroadcaster && !isHost ? onLeaveSession : undefined}
            onDisableGuestMedia={onDisableGuestMedia}
            price={joinPrice}
            coinBalance={broadcaster.identity ? coinBalances?.[broadcaster.identity] : undefined}
            compact={false}
            className="w-full h-full object-cover"
            style={{ width: '100%', height: '100%' }}
            onClick={() => onUserClick?.(broadcaster)}
          />
          
          {/* Broadcaster Controls Overlay (Start Camera) */}
          {isLocalBroadcaster && !isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                <button 
                  onClick={onToggleCamera}
                  className="group flex flex-col items-center gap-3 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 hover:border-purple-400 hover:scale-105 transition-all duration-300"
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.5)] group-hover:shadow-[0_0_30px_rgba(147,51,234,0.7)]">
                    <Camera size={24} className="sm:w-8 sm:h-8 text-white" />
                  </div>
                  <span className="text-base sm:text-lg font-bold text-white tracking-wide">Start Camera</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - 3 Guest Slots (R1, R2, R3) */}
        <div className="broadcast-right-column">
          {guestSlots.slice(3, 6).map((slot) => (
            <div 
              key={slot.key}
              className={`broadcast-guest-slot ${guestFrameClass(slot.position)}`}
              onClick={() => !slot.participant && slot.isActive && onJoinRequest?.(slot.seatIndex)}
            >
              {slot.participant && slot.isActive ? (
                <VideoTile
                  participant={slot.participant}
                  isLocal={!!(localParticipant && slot.participant.identity === localParticipant.identity)}
                  isHost={isHost}
                  onDisableGuestMedia={onDisableGuestMedia}
                  price={joinPrice}
                  coinBalance={slot.participant.identity ? coinBalances?.[slot.participant.identity] : undefined}
                  compact
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                  onClick={
                    !isHost &&
                    !(localParticipant && slot.participant.identity === localParticipant.identity) &&
                    onUserClick
                      ? () => onUserClick(slot.participant!)
                      : undefined
                  }
                />
              ) : slot.isActive ? (
                <div className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="text-4xl font-bold text-purple-300/30 group-hover:text-purple-300/50 transition-colors">
                    +
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/20">
                  <div className="text-2xl font-bold text-purple-300/10">
                    +
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
