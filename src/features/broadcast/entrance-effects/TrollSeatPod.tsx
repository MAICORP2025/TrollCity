import React, { useEffect, useRef } from 'react'
import type {
  TrollSeat,
  TrollSeatTrackBundle,
  TrollSeatUserProfile,
} from './trollSeatsTypes'
import {
  getTrollSeatAvatar,
  getTrollSeatName,
} from './trollSeatsUtils'

interface TrollSeatPodProps {
  seat: TrollSeat
  profile?: TrollSeatUserProfile
  tracks?: TrollSeatTrackBundle
  hasGoldenRing?: boolean
  onOpenUserStats?: (userId: string) => void
}

export function TrollSeatPod({
  seat,
  profile,
  tracks,
  hasGoldenRing = false,
  onOpenUserStats,
}: TrollSeatPodProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isOccupied = seat.status === 'occupied' && !!seat.user_id
  const avatarUrl = getTrollSeatAvatar(profile)
  const displayName = getTrollSeatName(profile)

  useEffect(() => {
    const videoEl = videoRef.current

    if (!videoEl || !tracks?.videoTrack) return

    try {
      tracks.videoTrack.attach(videoEl)
    } catch (error) {
      console.warn('[TrollSeatPod] video attach failed:', error)
    }

    return () => {
      try {
        tracks.videoTrack.detach(videoEl)
      } catch {
        // no-op
      }
    }
  }, [tracks?.videoTrack])

  useEffect(() => {
    const audioEl = audioRef.current

    if (!audioEl || !tracks?.audioTrack) return

    try {
      tracks.audioTrack.attach(audioEl)
    } catch (error) {
      console.warn('[TrollSeatPod] audio attach failed:', error)
    }

    return () => {
      try {
        tracks.audioTrack.detach(audioEl)
      } catch {
        // no-op
      }
    }
  }, [tracks?.audioTrack])

  const handleClick = () => {
    if (seat.user_id && onOpenUserStats) {
      onOpenUserStats(seat.user_id)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isOccupied}
      className={[
        'relative h-24 w-24 md:h-28 md:w-28 rounded-full',
        'border border-cyan-300/70 bg-slate-950/80',
        'shadow-[0_0_24px_rgba(34,211,238,0.45)]',
        'backdrop-blur-md overflow-visible',
        'flex items-center justify-center',
        isOccupied ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
      title={isOccupied ? displayName : 'Empty TrollSeat'}
    >
      {hasGoldenRing && isOccupied ? (
        <span
          className={[
            'absolute -inset-2 rounded-full',
            'border-4 border-yellow-300',
            'shadow-[0_0_30px_rgba(250,204,21,0.9)]',
            'animate-pulse pointer-events-none',
          ].join(' ')}
        />
      ) : null}

      <span
        className={[
          'absolute inset-0 rounded-full',
          'bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22),rgba(15,23,42,0.85))]',
          'pointer-events-none',
        ].join(' ')}
      />

      {isOccupied && tracks?.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] rounded-full object-cover"
        />
      ) : isOccupied && avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] rounded-full object-cover"
        />
      ) : (
        <div className="absolute inset-3 rounded-full border border-cyan-300/30 bg-slate-900/70 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-200">
            Empty
          </span>
        </div>
      )}

      {tracks?.audioTrack ? (
        <audio ref={audioRef} autoPlay playsInline />
      ) : null}

      <div className="absolute -bottom-6 left-1/2 w-28 -translate-x-1/2 rounded-full border border-cyan-300/40 bg-slate-950/90 px-2 py-1 text-center shadow-[0_0_14px_rgba(34,211,238,0.35)]">
        <div className="truncate text-[10px] font-semibold text-cyan-100">
          {isOccupied ? displayName : `TrollSeat ${seat.seat_index + 1}`}
        </div>

        {isOccupied ? (
          <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] text-cyan-200/80">
            <span>{tracks?.isMicMuted ? 'Mic Off' : 'Mic On'}</span>
            <span>•</span>
            <span>{tracks?.isCameraOff ? 'Cam Off' : 'Live'}</span>
          </div>
        ) : null}
      </div>
    </button>
  )
}