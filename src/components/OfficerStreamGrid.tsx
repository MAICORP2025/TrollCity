import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Eye, Mic, Video, Gift, MessageCircle, Zap } from 'lucide-react'
import { useSeatRoster, type SeatAssignment } from '../hooks/useSeatRoster'
import { useLiveKitRoom, type LiveKitParticipantState } from '../hooks/useLiveKitRoom'
import { useAuthStore } from '../lib/store'

interface OfficerStreamGridProps {
  showViewerCounts?: boolean
  onSeatClick?: (seatIndex: number, seat: SeatAssignment) => void
}

const OfficerStreamGrid: React.FC<OfficerStreamGridProps> = ({
  showViewerCounts = true,
  onSeatClick,
}) => {
  const { seats, claimSeat, releaseSeat, isClaimingSeat } = useSeatRoster()
  const { user, profile } = useAuthStore()

  const liveKitUser = useMemo(() => {
    if (!user) return null
    return {
      id: user.id,
      username: profile?.username || user.email?.split('@')[0] || 'Officer',
      role: profile?.role || 'viewer',
      level: profile?.level ?? 1,
    }
  }, [user, profile])

  const { participantsList } = useLiveKitRoom({
    roomName: 'officer-stream',
    user: liveKitUser,
    allowPublish: false,
    autoPublish: false,
  })

  return (
    <div className="space-y-4">
      {/* Outer container with thick neon border */}
      <div className="rounded-3xl border-4 border-purple-500 p-6 shadow-2xl"
        style={{
          boxShadow: '0 0 30px rgba(168, 85, 247, 0.6), 0 0 60px rgba(236, 72, 153, 0.4), inset 0 0 30px rgba(236, 72, 153, 0.1)'
        }}
      >
        {/* 6-Box Grid - 2x3 layout */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {seats.map((seat, index) => {
            const participant = participantsList?.find(
              (p) => p.identity === seat?.user_id
            )
            return (
              <OfficerStreamBox
                key={index}
                seatIndex={index}
                seat={seat}
                participant={participant}
                isClaimingSeat={isClaimingSeat === index}
                onClaimClick={() => {
                  if (seat) {
                    onSeatClick?.(index, seat)
                  }
                }}
                onSeatAction={async (action) => {
                  if (action === 'claim' && profile) {
                    await claimSeat(index, {
                      username: profile.username || 'Officer',
                      avatarUrl: profile.avatar_url,
                      role: 'officer',
                    })
                  } else if (action === 'release' && seat) {
                    await releaseSeat(index, seat.user_id)
                  }
                }}
              />
            )
          })}
        </div>

        {/* Bottom Send Gift Button */}
        <button className="w-full mt-6 py-4 rounded-2xl border-2 border-purple-400 bg-transparent hover:bg-purple-900/30 transition text-white font-bold text-lg flex items-center justify-center gap-2"
          style={{
            boxShadow: '0 0 15px rgba(236, 72, 153, 0.4)'
          }}
        >
          <Gift className="w-6 h-6" />
          Send Gift
        </button>

        {/* Bottom Control Bar */}
        <div className="flex justify-center gap-4 mt-6">
          <button className="p-4 rounded-full bg-green-500 hover:bg-green-600 transition shadow-lg"
            title="Microphone"
          >
            <Mic className="w-6 h-6 text-white" />
          </button>
          <button className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition shadow-lg"
            title="Moderation"
          >
            <Zap className="w-6 h-6 text-white" />
          </button>
          <button className="p-4 rounded-full bg-blue-600 hover:bg-blue-700 transition shadow-lg"
            title="Video/Stream"
          >
            <Video className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface OfficerStreamBoxProps {
  seatIndex: number
  seat: SeatAssignment
  participant?: LiveKitParticipantState
  isClaimingSeat: boolean
  onClaimClick: () => void
  onSeatAction: (action: 'claim' | 'release') => Promise<void>
}

const WELCOME_MESSAGES = [
  { user: 'User123', message: 'Welcome!' },
  { user: 'Streamer1', message: 'Welcome veeuers!', icon: '👑' },
  { user: 'User456', message: 'How welcome! Wooou' },
]

const EMOJIS = ['😂', '😍', '🤔', '😎', '🔥']

const OfficerStreamBox: React.FC<OfficerStreamBoxProps> = ({
  seatIndex,
  seat,
  participant,
  isClaimingSeat,
  onClaimClick,
  onSeatAction,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [duration, setDuration] = useState('00:00')
  const [viewerCount] = useState(() => Math.floor(Math.random() * 5000) + 100)
  const [messageIndex] = useState(() => seatIndex % WELCOME_MESSAGES.length)
  const [emojiIndex] = useState(() => seatIndex % EMOJIS.length)

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(prev => {
        const [mm, ss] = prev.split(':').map(Number)
        const totalSeconds = mm * 60 + ss + 1
        const newMm = Math.floor(totalSeconds / 60)
        const newSs = totalSeconds % 60
        return `${String(newMm).padStart(2, '0')}:${String(newSs).padStart(2, '0')}`
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!participant) return

    const videoTrack = participant.videoTrack
    const audioTrack = participant.audioTrack

    if (videoTrack && videoRef.current) {
      try {
        videoTrack.attach(videoRef.current)
      } catch (e) {
        console.warn('Video attach failed:', e)
      }
    }

    if (audioTrack && audioRef.current) {
      try {
        audioTrack.attach(audioRef.current)
      } catch (e) {
        console.warn('Audio attach failed:', e)
      }
    }

    return () => {
      try {
        if (videoTrack && videoRef.current) {
          videoTrack.detach(videoRef.current)
        }
      } catch (e) {
        console.warn('Video detach failed:', e)
      }

      try {
        if (audioTrack && audioRef.current) {
          audioTrack.detach(audioRef.current)
        }
      } catch (e) {
        console.warn('Audio detach failed:', e)
      }
    }
  }, [participant?.videoTrack, participant?.audioTrack])

  const gradientBg = [
    'from-blue-900 via-blue-700',
    'from-purple-900 via-purple-700',
    'from-indigo-900 via-indigo-700',
    'from-blue-900 via-purple-800',
    'from-teal-900 via-purple-800',
    'from-slate-900 via-purple-900',
  ][seatIndex % 6]

  return (
    <button
      onClick={onClaimClick}
      className="relative w-full aspect-square rounded-2xl overflow-hidden group transition-all duration-300 cursor-pointer"
      style={{
        border: '2px solid rgba(236, 72, 153, 0.6)',
        boxShadow: '0 0 20px rgba(236, 72, 153, 0.5), inset 0 0 20px rgba(168, 85, 247, 0.2)',
        background: `linear-gradient(135deg, rgb(var(--color-start)) 0%, rgb(var(--color-end)) 100%)`,
      }}
    >
      {/* Background Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientBg} to-transparent`} />

      {/* Video Feed or Empty State */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        {participant && seat && participant.videoTrack ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <audio ref={audioRef} autoPlay />
          </>
        ) : seat ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-white">
              {seat.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="text-white text-sm font-semibold">{seat.username || 'Officer'}</div>
            <div className="text-gray-300 text-xs mt-1">Connecting...</div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-purple-900/60 border-2 border-purple-400 mx-auto mb-3 flex items-center justify-center text-2xl">
              +
            </div>
            <div className="text-white text-sm font-semibold">Empty Seat</div>
            <div className="text-purple-300 text-xs mt-1">Click to claim</div>
          </div>
        )}
      </div>

      {/* Top Left: LIVE Badge + Duration */}
      {seat && (
        <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
          <div className="flex items-center gap-1.5 bg-red-600 px-3 py-1.5 rounded-lg font-bold text-white text-sm shadow-lg">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
          <div className="text-white font-bold text-lg">{duration}</div>
        </div>
      )}

      {/* Top Right: Viewer Count */}
      {seat && (
        <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/50 px-4 py-2 rounded-full border border-purple-400/60 z-20 backdrop-blur-sm">
          <Eye className="w-4 h-4 text-purple-300" />
          <span className="text-white font-bold">{viewerCount.toLocaleString()}</span>
        </div>
      )}

      {/* Chat Messages Overlay - Left Side */}
      {seat && (
        <div className="absolute left-3 bottom-16 space-y-2 z-10 max-w-[85%]">
          {WELCOME_MESSAGES.map((msg, i) => (
            <div
              key={i}
              className="bg-orange-800/80 px-3 py-2 rounded-lg text-white text-xs font-medium backdrop-blur-sm border border-orange-600/40 max-w-[200px]"
            >
              {msg.icon && <span className="font-bold text-purple-200">{msg.icon} </span>}
              <span className="font-bold text-orange-200">{msg.user}</span>
              <span className="text-gray-100"> {msg.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Right: Send Gift or Emoji */}
      {seat && (
        <div className="absolute bottom-4 right-4 z-20">
          {seatIndex % 2 === 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-700 to-purple-900 px-4 py-2 rounded-xl border border-purple-400/60 text-white font-bold text-sm hover:shadow-lg transition shadow-md"
            >
              <Gift className="w-4 h-4" />
              Send Gift
            </button>
          ) : (
            <div className="w-14 h-14 rounded-xl border-2 border-purple-400/60 bg-purple-900/60 flex items-center justify-center text-3xl font-bold hover:scale-110 transition shadow-lg backdrop-blur-sm">
              {EMOJIS[emojiIndex]}
            </div>
          )}
        </div>
      )}

      {/* Claim Button for Empty Seats */}
      {!seat && (
        <div className="absolute bottom-4 right-4 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSeatAction('claim')
            }}
            disabled={isClaimingSeat}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm transition"
          >
            {isClaimingSeat ? 'Claiming...' : 'Claim'}
          </button>
        </div>
      )}

      {/* Release Button (visible on hover) */}
      {seat && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSeatAction('release')
          }}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs z-30"
        >
          Release
        </button>
      )}

      {/* Username at bottom left (if occupied) */}
      {seat && (
        <div className="absolute bottom-3 left-3 text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm z-10">
          {seat.username || 'Officer'}
        </div>
      )}
    </button>
  )
}

export { OfficerStreamGrid }
