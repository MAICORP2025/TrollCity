import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import HorizontalScrollRow from './HorizontalScrollRow'

interface PodcastRowProps {
  onItemClick?: (id: string) => void
}

export default function PodcastRow({ onItemClick }: PodcastRowProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const handleClick = () => {
    navigate('/podcast')
  }

  return (
    <HorizontalScrollRow
      title="Podcasts"
      subtitle="Listen or start your own"
      icon={<Mic className="h-3.5 w-3.5 text-purple-400" />}
    >
      <button
        onClick={handleClick}
        className="flex h-[220px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/[0.04] p-4 text-center transition hover:border-purple-400/50 hover:bg-purple-500/[0.08] cursor-pointer"
      >
        <Mic className="h-8 w-8 text-purple-400/60" />
        <p className="text-xs font-bold text-purple-300/70">Start a Podcast</p>
        <p className="text-[10px] text-purple-400/50">Click to go live with audio!</p>
      </button>
    </HorizontalScrollRow>
  )
}
