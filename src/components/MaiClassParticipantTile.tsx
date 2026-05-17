import React, { useEffect, useRef, useMemo } from 'react'
import { RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client'
import { Mic, MicOff, User, Volume2, VolumeX } from 'lucide-react'

const COLORS = {
  purple: '#9333ea',
  black: '#0A0814',
  green: '#10b981',
  red: '#ef4444',
}

interface ParticipantTileProps {
  participant: RemoteParticipant
  isLocal?: boolean
}

export default function ParticipantTile({ participant, isLocal }: ParticipantTileProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  const videoTrack = useMemo(() => {
    if (participant.videoTracks.size === 0) return undefined
    return Array.from(participant.videoTracks.values())[0] as RemoteVideoTrack
  }, [participant.videoTracks])

  const audioTrack = participant.audioTrack as RemoteAudioTrack | undefined
  const isVideoOn = !!videoTrack && !videoTrack.isMuted && videoTrack.mediaStreamTrack?.readyState === 'live'
  const isAudioOn = !!audioTrack && !audioTrack.isMuted

  // Attach video when track or container changes
  useEffect(() => {
    if (!videoContainerRef.current) return

    const container = videoContainerRef.current

    // Cleanup previous attachment
    if (videoElementRef.current) {
      try {
        videoTrack?.detach()
      } catch (e) {}
      container.innerHTML = ''
      videoElementRef.current = null
    }

    if (videoTrack && isVideoOn) {
      try {
        const videoElement = videoTrack.attach()
        videoElement.autoplay = true
        videoElement.playsInline = true
        if (isLocal) {
          videoElement.muted = true
        }
        videoElement.style.width = '100%'
        videoElement.style.height = '100%'
        videoElement.style.objectFit = 'cover'
        videoElement.style.position = 'absolute'
        videoElement.style.top = '0'
        videoElement.style.left = '0'
        container.appendChild(videoElement)
        videoElementRef.current = videoElement
      } catch (err) {
        console.warn('[ParticipantTile] video attach error:', err)
      }
    }

    return () => {
      try {
        videoTrack?.detach()
      } catch (e) {}
    }
  }, [videoTrack, isVideoOn, isLocal])

  // Attach audio when track changes (create hidden audio element)
  useEffect(() => {
    if (!audioTrack) return

    const audioElement = document.createElement('audio')
    audioElement.autoplay = true
    audioTrack.attach(audioElement)
    audioElementRef.current = audioElement

    return () => {
      try {
        audioTrack.detach()
      } catch (e) {}
      if (audioElementRef.current && audioElementRef.current.parentNode) {
        audioElementRef.current.parentNode.removeChild(audioElementRef.current)
      }
    }
  }, [audioTrack])

  return (
    <div
      className={`relative aspect-video rounded-lg overflow-hidden border-2 ${isLocal ? 'ring-2 ring-purple-500' : ''}`}
      style={{ borderColor: COLORS.purple, backgroundColor: COLORS.black }}
    >
      {/* Video container */}
      <div ref={videoContainerRef} className="w-full h-full absolute inset-0">
        {!isVideoOn && (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <User size={40} />
            <span className="text-xs mt-1 truncate w-full text-center px-1">
              {participant.name || participant.identity?.slice(0, 12)}
            </span>
          </div>
        )}
      </div>

      {/* Identity label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 text-xs font-semibold truncate text-white">
        {participant.name || participant.identity?.slice(0, 12) || 'Unknown'}
        {isLocal && ' (You)'}
      </div>

      {/* Mic status */}
      <div className="absolute top-1 left-1">
        {isAudioOn ? (
          <Mic size={12} className="text-green-500" />
        ) : (
          <MicOff size={12} className="text-red-500" />
        )}
      </div>
    </div>
  )
}
