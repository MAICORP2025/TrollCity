import React, { useEffect, useRef, useMemo } from 'react'
import { RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack, LocalVideoTrack, LocalAudioTrack } from 'livekit-client'
import { Mic, MicOff, Users, User } from 'lucide-react'

const COLORS = {
  purple: '#9333ea',
  gold: '#FFD54A',
  black: '#0A0814',
  green: '#10b981',
  red: '#ef4444',
}

interface LiveKitVideoGridProps {
  participants: RemoteParticipant[]
  currentUserId?: string
}

export default function LiveKitVideoGrid({ participants, currentUserId }: LiveKitVideoGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-4 h-full auto-rows-fr">
      {participants.map(participant => {
        const isLocal = currentUserId && participant.identity.includes(currentUserId)
        const videoTrack = useMemo(() => {
          if (participant.videoTracks.size === 0) return undefined
          return Array.from(participant.videoTracks.values())[0] as RemoteVideoTrack
        }, [participant.videoTracks])

        const audioTrack = participant.audioTrack
        const isVideoOn = !!videoTrack && !videoTrack.isMuted && videoTrack.mediaStreamTrack?.readyState === 'live'
        const isAudioOn = !!audioTrack && !audioTrack.isMuted

        return (
          <div
            key={participant.identity}
            className={`relative aspect-video rounded-lg overflow-hidden border-2 ${isLocal ? 'ring-2 ring-purple-500' : ''}`}
            style={{ borderColor: COLORS.purple, backgroundColor: COLORS.black }}
          >
            {/* Video element container - LiveKit attaches to this */}
            <div
              className="w-full h-full absolute inset-0 flex items-center justify-center"
              data-participant-id={participant.identity}
            >
              {isVideoOn ? (
                <video
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted={isLocal}
                  ref={el => {
                    if (el && videoTrack) {
                      try {
                        videoTrack.attach(el)
                      } catch (e) {
                        console.warn('[VideoGrid] attach error:', e)
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <User size={40} />
                  <span className="text-xs mt-1">{participant.name || participant.identity?.slice(0, 8)}</span>
                </div>
              )}
            </div>

            {/* Username label */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 text-xs font-semibold truncate text-white">
              {participant.name || participant.identity?.slice(0, 12) || 'Unknown'}
              {isLocal && ' (You)'}
            </div>

            {/* Mic status indicator */}
            <div className="absolute top-1 left-1">
              {isAudioOn ? (
                <Mic size={12} className="text-green-500" />
              ) : (
                <MicOff size={12} className="text-red-500" />
              )}
            </div>

            {/* Speaking indicator (optional) */}
            {isAudioOn && (
              <div className="absolute top-1 right-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              </div>
            )}
          </div>
        )
      })}

      {/* Empty state */}
      {participants.length === 0 && (
        <div className="col-span-full flex items-center justify-center h-64" style={{ backgroundColor: COLORS.black }}>
          <div className="text-center">
            <Users size={48} className="mx-auto mb-2 opacity-50" style={{ color: COLORS.purple }} />
            <p style={{ color: '#9ca3af' }}>No participants yet. Be the first to join!</p>
          </div>
        </div>
      )}
    </div>
  )
}
