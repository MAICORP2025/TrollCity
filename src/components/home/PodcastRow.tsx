import React from 'react'
import { Mic } from 'lucide-react'
import HorizontalScrollRow from './HorizontalScrollRow'

interface PodcastRowProps {
  onItemClick?: (id: string) => void
}

export default function PodcastRow({ onItemClick }: PodcastRowProps) {
  return (
    <HorizontalScrollRow
      title="Podcasts"
      subtitle="Be the first podcaster!"
      icon={<Mic className="h-3.5 w-3.5 text-purple-400" />}
    >
      <div className="flex h-[220px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-[#080c1a]/60 p-4 text-center">
        <Mic className="h-8 w-8 text-purple-400/40" />
        <p className="text-xs font-bold text-white/30">Start a Podcast</p>
        <p className="text-[10px] text-white/15">Be the first podcaster!</p>
      </div>
    </HorizontalScrollRow>
  )
}
