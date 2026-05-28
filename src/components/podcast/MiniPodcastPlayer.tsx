import React from 'react'
import { Volume2, VolumeX, Play, Pause, X, Maximize2, Mic, Users } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Podcast {
  id: string
  title: string
  description: string | null
  status: 'scheduled' | 'live' | 'active' | 'ended' | 'archived'
  agora_channel_name: string
  started_at: string | null
  listener_count: number
  host_user_id: string
  host_username?: string
}

interface MiniPodcastPlayerProps {
  podcast: Podcast
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

// Simple waveform animation component
function WaveformAnimation({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full bg-cyan-400 transition-all ${
            isPlaying ? 'animate-pulse' : ''
          }`}
          style={{
            height: isPlaying ? `${12 + Math.random() * 8}px` : '4px',
            animationDelay: `${i * 100}ms`,
            animationDuration: '800ms'
          }}
        />
      ))}
    </div>
  )
}

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
  onExpand
}: MiniPodcastPlayerProps) {
  const { isMobileWidth } = useIsMobile()

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Mobile: pinned above bottom nav
  if (isMobileWidth) {
    return (
      <div className="fixed bottom-[60px] left-0 right-0 z-[60] mx-auto max-w-md px-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-2xl shadow-lg">
          <div className="flex items-center gap-3 p-3">
            {/* Album art / icon */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600/30 to-cyan-500/30 flex-shrink-0 flex items-center justify-center">
              <Mic className="w-5 h-5 text-cyan-300" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">{podcast.title}</p>
              <p className="text-xs text-slate-400 truncate">
                @{podcast.host_username || 'Unknown'} • {['live', 'active'].includes(podcast.status) ? 'LIVE' : formatTime(elapsedTime)}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={onMuteToggle}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-white" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>

              <button
                onClick={onPlayPause}
                className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-white" />
                ) : (
                  <Play className="w-4 h-4 text-white" />
                )}
              </button>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-red-500/20"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              <button
                onClick={onExpand}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Waveform */}
          <div className="px-3 pb-2">
            <WaveformAnimation isPlaying={isPlaying} />
          </div>

          {/* Volume slider */}
          <div className="px-3 pb-3">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/20 rounded-full appearance-none slider-thumb"
            />
          </div>
        </div>
      </div>
    )
  }

  // Desktop: docked near bottom
  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[380px]">
      <div className="rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-2xl shadow-[0_0_28px_rgba(45,212,191,0.15)]">
        <div className="flex items-center gap-3 p-3">
          {/* Album art / icon */}
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600/30 to-cyan-500/30 flex-shrink-0 flex items-center justify-center">
            <Mic className="w-6 h-6 text-cyan-300" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{podcast.title}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>@{podcast.host_username || 'Unknown'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {podcast.listener_count || 0}
              </span>
              <span>•</span>
              <span>{podcast.status === 'live' ? 'LIVE' : formatTime(elapsedTime)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onMuteToggle}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>

            <button
              onClick={onPlayPause}
              className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 flex items-center justify-center hover:from-purple-500 hover:to-cyan-400 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-white" />
              ) : (
                <Play className="w-4 h-4 text-white" />
              )}
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-red-500/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            <button
              onClick={onExpand}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Waveform */}
        <div className="px-3 pb-2">
          <WaveformAnimation isPlaying={isPlaying} />
        </div>

        {/* Volume slider */}
        <div className="px-3 pb-3">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/20 rounded-full appearance-none slider-thumb"
          />
        </div>
      </div>
    </div>
  )
}