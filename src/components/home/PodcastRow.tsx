import React from 'react'
import { Mic, Play, Clock, Headphones } from 'lucide-react'
import HorizontalScrollRow from './HorizontalScrollRow'

interface PodcastRowProps {
  onItemClick?: (id: string) => void
}

export default function PodcastRow({ onItemClick }: PodcastRowProps) {
  // Placeholder podcast data — replace with real data when podcast system is wired up
  const podcasts = [
    { id: 'pod-1', title: 'Troll City Tonight', host: 'DJ Shadow', duration: '45:20', cover: null, category: 'Entertainment' },
    { id: 'pod-2', title: 'Pride & Prejudice', host: 'QueenTroll', duration: '32:15', cover: null, category: 'Culture' },
    { id: 'pod-3', title: 'Gaming After Dark', host: 'HyTroGaming', duration: '58:42', cover: null, category: 'Gaming' },
    { id: 'pod-4', title: 'City Hall Insider', host: 'OG_Jester', duration: '22:10', category: 'News' },
    { id: 'pod-5', title: 'The Troll Pod', host: 'PixlPerfect', duration: '41:33', category: 'Comedy' },
    { id: 'pod-6', title: 'Late Night Trolls', host: 'ShadowDream', duration: '37:55', category: 'Talk' },
  ]

  const hasData = podcasts.length > 0

  return (
    <HorizontalScrollRow
      title="Podcasts"
      subtitle={hasData ? 'Listen to the latest episodes' : 'Be the first podcaster!'}
      icon={<Mic className="h-3.5 w-3.5 text-purple-400" />}
    >
      {hasData ? (
        podcasts.map((pod) => (
        <button
          key={pod.id}
          onClick={() => onItemClick?.(pod.id)}
          className="group relative flex h-[220px] w-[180px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c1a]/95 text-left transition-all duration-200 hover:border-purple-400/30 hover:shadow-[0_0_24px_rgba(168,85,247,0.12)]"
        >
          {/* Cover art */}
          <div className="relative h-[130px] w-full shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-[#080c1a] to-fuchsia-900/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Headphones className="h-12 w-12 text-purple-400/30" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#080c1a]/95" />

            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-600/90 shadow-[0_0_20px_rgba(168,85,247,0.4)] backdrop-blur-sm">
                <Play className="h-5 w-5 text-white" fill="white" />
              </div>
            </div>

            {/* Category badge */}
            <div className="absolute left-2 top-2 rounded-md bg-purple-600/80 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
              {pod.category}
            </div>
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
            <p className="line-clamp-2 text-xs font-black text-white">{pod.title}</p>
            <p className="text-[10px] font-bold text-white/40">by {pod.host}</p>
            <div className="mt-auto flex items-center gap-1 text-[9px] text-white/30">
              <Clock className="h-2.5 w-2.5" />
              {pod.duration}
            </div>
          </div>
        </button>
        ))
      ) : (
        <div className="flex h-[220px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-[#080c1a]/60 p-4 text-center">
          <Mic className="h-8 w-8 text-purple-400/40" />
          <p className="text-xs font-bold text-white/30">Start a Podcast</p>
          <p className="text-[10px] text-white/15">Be the first podcaster!</p>
        </div>
      )}
    </HorizontalScrollRow>
  )
}
