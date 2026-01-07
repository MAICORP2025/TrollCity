import React from 'react'
import { useRoomParticipants } from '../../hooks/useRoomParticipants'
import { Room } from 'livekit-client'
import ResponsiveVideoGrid from '../stream/ResponsiveVideoGrid'

interface BroadcastLayoutProps {
  room: Room
  broadcasterId: string
  isHost: boolean
  joinPrice?: number
  onSetPrice?: (price: number) => void
  onJoinRequest?: () => void
  onLeaveSession?: () => void
  children?: React.ReactNode
}

export default function BroadcastLayout({ 
  room, 
  broadcasterId, 
  isHost, 
  joinPrice = 0, 
  onSetPrice, 
  onLeaveSession, 
  children 
}: BroadcastLayoutProps) {
  const participants = useRoomParticipants(room);
  
  if (!room) return null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Responsive Grid System */}
      <ResponsiveVideoGrid 
        participants={participants}
        localParticipant={room.localParticipant}
        broadcasterId={broadcasterId}
        onLeaveSession={onLeaveSession}
      />

      {/* Overlays / Children (Gifts, etc) */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {children}
      </div>

      {/* Broadcaster Price Control (Preserved) */}
      {isHost && onSetPrice && (
        <div className="absolute bottom-20 left-4 md:bottom-4 md:left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2 z-30 pointer-events-auto">
          <span className="text-xs text-gray-300">Join Price:</span>
          <input 
            type="number" 
            value={joinPrice} 
            onChange={(e) => onSetPrice(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-16 bg-white/10 border border-white/20 rounded px-1 text-sm text-white"
          />
        </div>
      )}
    </div>
  );
}

