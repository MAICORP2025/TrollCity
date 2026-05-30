import { type ChangeEvent, useCallback } from 'react'
import { ArrowUpRight, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { usePodcastAgora } from '@/hooks/usePodcastAgora'

interface ActivePodcast {
  id: string
  host_user_id: string
  title: string
  description: string
  status: 'live' | 'active' | 'ended' | 'scheduled' | 'archived'
  started_at: string
  listener_count: number
  agora_channel_name: string
  host_username?: string
}

interface MiniPodcastPlayerProps {
  podcast: ActivePodcast
  isPlaying: boolean
  isMuted: boolean
  volume: number
  elapsedTime: number
  onPlayPause: () => void
  onMuteToggle: () => void
  onVolumeChange: (volume: number) => void
  onClose: () => void
  onExpand: () => void
}

const containerStyles =
  'fixed bottom-4 left-1/2 z-50 w-[min(96vw,460px)] -translate-x-1/2 rounded-[2rem] border border-white/10 bg-slate-950/95 p-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:left-auto sm:right-4 sm:-translate-x-0'

const cardStyles =
  'rounded-3xl border border-white/10 bg-slate-900/90 p-4'

export default function MiniPodcastPlayer({
  podcast,
  isPlaying,
  isMuted,
  volume,
  elapsedTime,
  onPlayPause,
  onMuteToggle,
  onVolumeChange,
  onClose,
  onExpand,
}: MiniPodcastPlayerProps) {
  const {
    isConnected,
    isJoining,
    error,
    isPlaying: hookIsPlaying,
    togglePlay: hookTogglePlay,
    toggleMute: hookToggleMute,
    setVolume: hookSetVolume,
  } = usePodcastAgora({
    channelName: podcast.agora_channel_name,
    enabled: Boolean(podcast.agora_channel_name),
    podcastId: podcast.id,
    isHost: false,
  })

  // Use hook's internal play state for accurate audio status
  const effectiveIsPlaying = hookIsPlaying && isConnected

  const statusText = error
    ? 'Connection error'
    : isJoining
    ? 'Joining...'
    : isConnected
    ? 'Live'
    : 'Connecting...'

  const handleVolumeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const newVol = parseFloat(event.target.value)
      hookSetVolume(newVol)
      onVolumeChange(newVol)
    },
    [onVolumeChange, hookSetVolume]
  )

  return (
    <div className={containerStyles}>
      <div className={cardStyles}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-400">Podcast Mini Player</p>
            <p className="mt-1 text-base font-semibold text-white line-clamp-1">
              {podcast.title}
            </p>
            <p className="text-xs text-slate-500">{podcast.host_username || 'Unknown host'}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label="Expand podcast room"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label="Close podcast player"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-3">
          <div>
            <p className="text-sm font-semibold text-slate-200">{statusText}</p>
            <p className="text-xs text-slate-500">Channel: {podcast.agora_channel_name}</p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-300">
            {elapsedTime}s
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={() => {
              hookTogglePlay()
              onPlayPause()
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-cyan-500 to-sky-500 px-4 py-3 text-sm font-black text-white transition hover:opacity-95"
          >
            {effectiveIsPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {effectiveIsPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            type="button"
            onClick={() => {
              hookToggleMute()
              onMuteToggle()
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-slate-500">
            <span>Volume</span>
            <span>{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}
