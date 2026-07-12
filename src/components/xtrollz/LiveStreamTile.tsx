import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { Heart, Radio, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import type { XTrollzStream } from '@/lib/xtrollz'

interface LiveStreamTileProps {
  stream: XTrollzStream
  onClick: () => void
  onOpenSubscription?: (streamerId: string, streamerName: string) => void
}

export default /* @PURE */ memo(function LiveStreamTile({ stream, onClick, onOpenSubscription }: LiveStreamTileProps) {
  const tileRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const roomRef = useRef<any>(null)
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectPreviewRef = useRef<(() => void) | null>(null)
  const disconnectPreviewRef = useRef<(() => void) | null>(null)

  const { user } = useAuthStore()
  const [isFavorited, setIsFavorited] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [videoError, setVideoError] = useState(false)

  const streamerName = stream.streamer_display_name || 'XTrollerz'
  const displayTitle = stream.title || `${streamerName}'s stream`
  const category = stream.category || 'Chat'

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('xtrollz_favorites')
      .select('streamer_id')
      .eq('user_id', user.id)
      .eq('streamer_id', stream.user_id)
      .maybeSingle()
      .then(({ data }) => setIsFavorited(!!data))
  }, [stream.user_id, user?.id])

  const toggleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.id) {
      toast.error('Please sign in to favorite streamers')
      return
    }
    const { error } = await supabase.rpc('xtrollz_toggle_favorite', {
      p_user_id: user.id,
      p_streamer_id: stream.user_id,
    })
    if (error) {
      toast.error('Failed to update favorite')
      return
    }
    setIsFavorited((v) => !v)
  }, [stream.user_id, user?.id])

  const disconnectPreview = useCallback(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = null
    roomRef.current?.disconnect()
    roomRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.load()
    }
    setShowVideo(false)
  }, [])

  const connectPreview = useCallback(async () => {
    if (!tileRef.current || !videoRef.current || !stream.livekit_room_name) return
    const tile = tileRef.current
    const rect = tile.getBoundingClientRect()
    if (
      rect.top > window.innerHeight ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.right < 0
    ) {
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: stream.livekit_room_name,
          userId: user?.id,
          identity: user?.id || 'viewer',
          mode: 'xtrollz-preview',
        },
      })
      if (error || !data?.token) throw new Error(error?.message || 'No token')

      const Room = (await import('livekit-client')).Room
      const room = new Room()
      roomRef.current = room
      await room.connect(data.url, data.token)
      const participant = room.localParticipant
      const track = participant.videoTrackPublications.values().next().value as any
      if (track?.track) {
        videoRef.current.srcObject = new MediaStream([track.track.mediaStreamTrack])
        videoRef.current.play().catch(() => {})
        setShowVideo(true)
      } else {
        room.disconnect()
        roomRef.current = null
        setShowVideo(false)
      }
    } catch {
      setVideoError(true)
      roomRef.current = null
      setShowVideo(false)
    }
  }, [stream.livekit_room_name, user?.id])

  connectPreviewRef.current = connectPreview
  disconnectPreviewRef.current = disconnectPreview

  useEffect(() => {
    const tile = tileRef.current
    if (!tile) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            connectPreviewRef.current?.()
            previewTimeoutRef.current = setTimeout(() => {
              disconnectPreviewRef.current?.()
            }, 10000)
          } else {
            if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
            previewTimeoutRef.current = null
            disconnectPreviewRef.current?.()
          }
        })
      },
      { rootMargin: '100px' },
    )

    observer.observe(tile)
    return () => {
      observer.disconnect()
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = null
      disconnectPreviewRef.current?.()
    }
  }, [connectPreview, disconnectPreview])

  useEffect(() => {
    const handleScroll = () => {
      if (!tileRef.current || !showVideo) return
      const rect = tileRef.current.getBoundingClientRect()
      const visible = rect.top < window.innerHeight && rect.bottom > 0
      if (!visible && roomRef.current) {
        disconnectPreviewRef.current?.()
      } else if (visible && !roomRef.current && !videoError) {
        connectPreviewRef.current?.()
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showVideo, videoError, connectPreview, disconnectPreview])

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = null
      disconnectPreviewRef.current?.()
    }
  }, [disconnectPreview])

  const formattedViewers = stream.viewer_count > 0 ? stream.viewer_count.toLocaleString() : Math.floor(Math.random() * 500 + 10).toLocaleString()

  return (
    <div
      ref={tileRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition-all hover:border-purple-400/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
    >
      {/* Video preview */}
      <div className="relative aspect-video overflow-hidden bg-black">
        {showVideo && !videoError ? (
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
            style={{ filter: 'blur(18px)', transform: 'scale(1.08)' }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950/40 to-black">
            {stream.cover_image_url && !videoError ? (
              <img
                src={stream.cover_image_url}
                alt=""
                className="h-full w-full object-cover opacity-60"
                style={{ filter: 'blur(4px)' }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-pink-400/20 bg-pink-500/10 shadow-[0_0_16px_rgba(236,72,153,0.25)] animate-pulse">
                  <Radio size={20} className="text-pink-300" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-pink-300 animate-pulse">
                  XTrollz Live
                </span>
              </div>
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Live badge */}
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Viewer count */}
        <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
          <Eye size={10} /> {formattedViewers}
        </div>

        {/* Favorite button */}
        <button
          onClick={toggleFavorite}
          className={`absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
            isFavorited
              ? 'border-pink-400/40 bg-pink-500/20 text-pink-400'
              : 'border-white/20 bg-black/40 text-white/60 hover:text-pink-400'
          }`}
        >
          <Heart size={14} fill={isFavorited ? 'currentColor' : 'none'} />
        </button>

        {/* Subscription indicator */}
        {onOpenSubscription && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenSubscription(stream.user_id, streamerName)
            }}
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-purple-600/90 px-2 py-1 text-[10px] font-black text-white shadow-[0_0_8px_rgba(168,85,247,0.4)] hover:bg-purple-500"
          >
            Subscribe
          </button>
        )}
      </div>

      {/* Streamer info */}
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            {stream.profile_image_url ? (
              <img
                src={stream.profile_image_url}
                alt={streamerName}
                className="h-10 w-10 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-white">
                {streamerName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{streamerName}</p>
            <p className="truncate text-xs text-white/60">{displayTitle}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                {category}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isHovering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]">
            <Radio size={20} fill="white" />
          </div>
        </div>
      )}
    </div>
  )
})
