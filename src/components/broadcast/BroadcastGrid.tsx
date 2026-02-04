import { useState } from 'react';
import { useParticipants, useTracks, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Stream } from '../../types/broadcast';
import { User } from 'lucide-react';
import { cn } from '../../lib/utils';
import UserActionModal from './UserActionModal';
import { SeatSession } from '../../hooks/useStreamSeats';

interface BroadcastGridProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  maxItems?: number; 
  onGift: (userId: string) => void;
  onGiftAll: (ids: string[]) => void;
  mode?: 'viewer' | 'stage';
  seats?: Record<number, SeatSession>;
  onJoinSeat?: (index: number) => void;
  onKick?: (userId: string) => void;
}

export default function BroadcastGrid({ 
    stream, 
    isHost, 
    isModerator, 
    maxItems, 
    onGift, 
    onGiftAll: _onGiftAll,
    mode: _mode = 'stage', // Default to stage (legacy behavior)
    seats = {},
    onJoinSeat: _onJoinSeat,
    onKick
}: BroadcastGridProps) {
  // Only use LiveKit hooks if in Stage Mode (or if we are blindly rendering)
  // But hooks must be top-level.
  // Ideally BroadcastGrid is ONLY used inside LiveKitRoom.
  // But for Viewer Mode, we are NOT in LiveKitRoom.
  // This causes a crash if we call useParticipants() outside.
  
  // SOLUTION: Split into two components? Or conditional hooks?
  // We can't do conditional hooks.
  // We should create `BroadcastGridStage` and `BroadcastGridViewer`.
  // And `BroadcastGrid` is a wrapper?
  // Or simply: `BroadcastGrid` assumes it is inside LiveKitRoom.
  // And we create `BroadcastGridOverlay` for Viewer Mode.
  
  // Refactoring Plan:
  // 1. Rename this file to BroadcastGridStage.tsx
  // 2. Create BroadcastGridViewer.tsx
  // 3. Create index.tsx that exports BroadcastGrid which switches?
  
  // Actually, I'll just create `BroadcastGridViewer.tsx` and use it in BroadcastPage when mode is 'viewer'.
  // And keep this one for 'stage'.
  
  // BUT, to avoid code duplication, I'll modify THIS file to be Stage Only.
  // And creating a new one for Viewer.
  
  // Wait, I can't rename easily without breaking imports.
  // I will check if I am inside LiveKit context? No easy way.
  // I will assume `BroadcastGrid` is for STAGE.
  // I will create `BroadcastOverlay` for Viewer.
  
  // Let's stick to the current file for Stage.
  // I will revert to just "Stage" logic here, but with "Seat" awareness.
  
  const allParticipants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const [selectedUserForAction, setSelectedUserForAction] = useState<string | null>(null);
  
  // Map Seats to Participants
  // seats: { 0: {user_id: 'A'}, 1: {user_id: 'B'} }
  // We want to render 6 boxes fixed.
  
  const effectiveBoxCount = Math.min(maxItems || stream.box_count, 6);
  const boxes = Array.from({ length: effectiveBoxCount }, (_, i) => i);
  
  return (
    <div className={cn(
      "grid gap-4 w-full h-full max-h-[calc(100vh-2rem)] transition-all duration-500 ease-in-out p-4",
      stream.box_count === 1 && "grid-cols-1",
      stream.box_count === 2 && "grid-cols-2",
      stream.box_count >= 3 && "grid-cols-2 md:grid-cols-3"
    )}>
      {boxes.map(seatIndex => {
          const seat = seats[seatIndex];
          let userId = seat?.user_id;

          // FORCE HOST INTO BOX 0
          // The broadcaster (Host) always occupies the first box.
          if (seatIndex === 0) {
             userId = stream.user_id;
          }
          
          // Find participant
          const participant = allParticipants.find(p => p.identity === userId);
          const track = cameraTracks.find(t => t.participant.identity === userId);
          
          const isStreamHost = userId === stream.user_id;
          
          return (
            <div key={seatIndex} className="relative bg-black/50 rounded-xl overflow-hidden border border-white/10 aspect-video">
                {/* Render Video if Participant Exists */}
                {track && (
                    <VideoTrack trackRef={track} className="w-full h-full object-cover" />
                )}
                
                {/* Fallback / Loading */}
                {userId && !track && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-pulse bg-zinc-800 w-full h-full" />
                        <span className="absolute text-xs text-white/50">
                            {isStreamHost ? 'Host Connecting...' : 'Connecting...'}
                        </span>
                    </div>
                )}
                
                {/* Empty Seat */}
                {!userId && (
                    <div className="absolute inset-0 flex items-center justify-center">
                         <div className="text-zinc-600 flex flex-col items-center">
                            <User size={24} className="opacity-20" />
                            <span className="text-xs mt-2">Empty</span>
                         </div>
                    </div>
                )}
                
                {/* Metadata Overlay */}
                {userId && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                        <div className="text-white text-sm font-bold truncate">
                            {isStreamHost ? (
                                <span className="text-yellow-500 flex items-center gap-1">
                                    Host
                                </span>
                            ) : (
                                participant?.name || seat?.user_profile?.username || 'User'
                            )}
                        </div>
                    </div>
                )}
                
                 {/* Action Modal */}
                 {selectedUserForAction && selectedUserForAction === userId && (
                    <UserActionModal
                        isOpen={true}
                        onClose={() => setSelectedUserForAction(null)}
                        targetUserId={userId}
                        isHost={isHost}
                        isModerator={isModerator}
                        onGift={() => onGift(userId)}
                        onKickStage={onKick ? () => onKick(userId) : undefined}
                    />
                 )}
            </div>
          );
      })}
    </div>
  );
}
