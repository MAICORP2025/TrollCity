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
  frameMode?: 'none' | 'rgb';
  onFrameModeChange?: (mode: 'none' | 'rgb') => void;
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
  isCameraOn,
  frameMode = 'none',
  onFrameModeChange
}: ResponsiveVideoGridProps) {
  const broadcaster =
    (broadcasterId && participants.find((p) => p.identity === broadcasterId)) ||
    participants[0] ||
    null;

  const isLocalBroadcaster =
    !!(localParticipant && broadcaster && broadcaster.identity === localParticipant.identity);

  // Fixed 8 guest slots max for 3x3 grid
  const maxGuestSeats = 8;
  const activeGuestCount = Math.max(0, Math.min(maxGuestSeats, boxCount || 0));
  
  // Create fixed guest slots
  const guestSlots = Array.from({ length: maxGuestSeats }, (_, index) => {
    const seatIndex = index;
    const isActive = index < activeGuestCount;
    const seat = Array.isArray(seats) && seats.length > seatIndex ? seats[seatIndex] : null;
    let participant: Participant | undefined;

    if (isActive && seat && (seat as any).user_id) {
      participant = participants.find((p) => p.identity === (seat as any).user_id);
    }

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

  const totalTiles = 1 + activeGuestCount; // Broadcaster + Guests

  // Generate Grid Classes based on count
  const getGridClass = (count: number) => {
    // Default (Mobile/Portrait)
    let mobile = 'grid-cols-1 grid-rows-1';
    if (count === 2) mobile = 'grid-cols-1 grid-rows-2';
    if (count === 3) mobile = 'grid-cols-2 grid-rows-2';
    if (count === 4) mobile = 'grid-cols-2 grid-rows-2';
    if (count >= 5 && count <= 6) mobile = 'grid-cols-2 grid-rows-3';
    if (count >= 7) mobile = 'grid-cols-3 grid-rows-3';

    // Landscape / Tablet / Desktop (md breakpoint)
    // We assume 'md' is roughly where we can switch to a wider layout
    let landscape = 'md:grid-cols-1 md:grid-rows-1';
    if (count === 2) landscape = 'md:grid-cols-2 md:grid-rows-1';
    if (count === 3) landscape = 'md:grid-cols-3 md:grid-rows-1';
    if (count === 4) landscape = 'md:grid-cols-2 md:grid-rows-2';
    if (count >= 5 && count <= 6) landscape = 'md:grid-cols-3 md:grid-rows-2';
    if (count >= 7 && count <= 8) landscape = 'md:grid-cols-4 md:grid-rows-2';
    if (count >= 9) landscape = 'md:grid-cols-3 md:grid-rows-3';

    return `grid ${mobile} ${landscape} gap-2 w-full h-full transition-all duration-500 ease-in-out`;
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col p-2 md:p-4 absolute inset-0">
      {canControlFrames && onFrameModeChange && (
        <div className="absolute top-2 right-2 z-50 flex items-center gap-2 mb-1 text-[11px] sm:text-xs bg-black/40 p-1 rounded-full backdrop-blur-sm">
          <button
            type="button"
            onClick={() => onFrameModeChange('none')}
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
            onClick={() => onFrameModeChange('rgb')}
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
      
      {/* Dynamic Responsive Grid */}
      <div className={getGridClass(totalTiles)}>
        
        {/* Broadcaster Tile */}
        <div className="relative w-full h-full overflow-hidden rounded-2xl">
          <VideoTile
            participant={broadcaster}
            isBroadcaster
            isLocal={!!isLocalBroadcaster}
            isHost={isHost}
            onLeave={isLocalBroadcaster && !isHost ? onLeaveSession : undefined}
            onDisableGuestMedia={onDisableGuestMedia}
            price={joinPrice}
            coinBalance={broadcaster?.identity ? coinBalances?.[broadcaster.identity] : undefined}
            compact={totalTiles > 1}
            className="w-full h-full object-cover"
            style={{ width: '100%', height: '100%' }}
            onClick={() => onUserClick?.(broadcaster)}
            frameMode={frameMode}
          />
          
          {/* Broadcaster Controls Overlay (Start Camera) - Only show for the actual broadcaster when their camera is off */}
          {isLocalBroadcaster && !isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 rounded-2xl">
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

        {/* Guest Slots */}
        {guestSlots.map((slot) => {
           if (!slot.isActive) return null;
 
           return (
            <div 
              key={slot.key}
              className="relative w-full h-full rounded-2xl overflow-hidden"
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
                  frameMode={frameMode}
                />
              ) : slot.isActive ? (
                <div className={`w-full h-full flex items-center justify-center cursor-pointer transition-colors border-2 border-dashed ${'border-white/10 hover:border-white/30 bg-white/5'}`}>
                  <div className={`text-4xl font-bold transition-colors ${'text-white/20 group-hover:text-white/40'}`}>
                    +
                  </div>
                </div>
              ) : null}
            </div>
           );
        })}
      </div>

    </div>
  );
}
