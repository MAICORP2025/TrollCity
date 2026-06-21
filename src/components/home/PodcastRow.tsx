import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Radio, Users } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { usePodcastStore } from '@/stores/podcastStore'
import HorizontalScrollRow from './HorizontalScrollRow'
import StorageIndicator from '@/components/broadcast/StorageIndicator'

interface PodcastRowProps {
  onItemClick?: (id: string) => void
}

export default function PodcastRow({ onItemClick }: PodcastRowProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const activePodcast = usePodcastStore((state) => state.activePodcast)

  const isLive = activePodcast?.status === 'live' || activePodcast?.status === 'active'

  const handleClick = () => {
    if (isLive && activePodcast?.id) {
      navigate(`/podcast/${activePodcast.id}`)
    } else {
      navigate('/podcast')
    }
  }

  return (
    <HorizontalScrollRow
      title="Podcasts"
      subtitle={isLive ? 'Live now — tap to listen' : 'Listen or start your own'}
      icon={<Mic className="h-3.5 w-3.5 text-purple-400" />}
      right={
        isLive && user?.id ? (
          <StorageIndicator userId={user.id} storageType="broadcast" />
        ) : undefined
      }
    >
      {isLive && activePodcast ? (
        <button
          onClick={handleClick}
          className="flex h-[220px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4 text-center transition hover:border-red-400/50 hover:bg-red-500/[0.10] cursor-pointer relative overflow-hidden"
        >
          {/* Pulsing live indicator */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            <span className="text-[9px] font-black text-white">LIVE</span>
          </div>

          <div className="grid h-12 w-12 place-items-center rounded-full border border-red-400/30 bg-red-500/15">
            <Radio className="h-6 w-6 text-red-300" />
          </div>
          <p className="text-xs font-bold text-white/90 truncate max-w-[150px]">{activePodcast.title}</p>
          <p className="text-[10px] text-purple-300/70">{activePodcast.host_username || 'Host'}</p>
          {activePodcast.listener_count > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-purple-400/60">
              <Users className="h-3 w-3" />
              <span>{activePodcast.listener_count} listening</span>
            </div>
          )}
        </button>
      ) : (
        <button
          onClick={handleClick}
          className="flex h-[220px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/[0.04] p-4 text-center transition hover:border-purple-400/50 hover:bg-purple-500/[0.08] cursor-pointer"
        >
          <Mic className="h-8 w-8 text-purple-400/60" />
          <p className="text-xs font-bold text-purple-300/70">Start a Podcast</p>
          <p className="text-[10px] text-purple-400/50">Click to go live with audio!</p>
        </button>
      )}
    </HorizontalScrollRow>
  )
}
