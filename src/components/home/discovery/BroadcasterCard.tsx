import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Eye, Radio, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BroadcasterCardProps {
  stream: {
    id: string
    title: string
    streamerName: string
    streamerAvatar?: string | null
    viewerCount?: number
    isFeatured?: boolean
    category?: string | null
    thumbnailUrl?: string | null
  }
  className?: string
}

export default function BroadcasterCard({ stream, className }: BroadcasterCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (stream.category === 'gaming') {
      navigate(`/gaming/watch/${stream.id}`)
    } else {
      navigate(`/watch/${stream.id}`)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'snap-start flex-shrink-0 w-[220px] rounded-2xl overflow-hidden cursor-pointer group/card',
        'border border-white/10 bg-white/[0.04] transition-all hover:border-yellow-400/30 hover:bg-white/[0.07]',
        stream.isFeatured && 'border-yellow-500/30 bg-gradient-to-b from-yellow-500/[0.08] to-transparent',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {stream.thumbnailUrl ? (
          <img
            src={stream.thumbnailUrl}
            alt={stream.title}
            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/60 via-slate-900 to-cyan-900/40 flex items-center justify-center">
            <Play className="w-8 h-8 text-white/30" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* LIVE badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">
            <Radio className="w-2.5 h-2.5" />
            LIVE
          </span>
          {stream.isFeatured && (
            <span className="flex items-center gap-1 rounded-md bg-gradient-to-r from-yellow-600 to-amber-600 px-1.5 py-0.5 text-[9px] font-black text-white">
              <Crown className="w-2.5 h-2.5" />
              FEATURED
            </span>
          )}
        </div>

        {/* Viewer count */}
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
          <Eye className="w-2.5 h-2.5" />
          {stream.viewerCount || 0}
        </div>

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center">
            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div className="flex items-center gap-2">
          {/* Avatar with golden crown frame for featured */}
          <div className={cn(
            'w-7 h-7 rounded-full flex-shrink-0 overflow-hidden',
            stream.isFeatured && 'ring-2 ring-yellow-400/60'
          )}>
            {stream.streamerAvatar ? (
              <img src={stream.streamerAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-cyan-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-white truncate leading-tight">{stream.title}</p>
            <p className="text-[9px] text-slate-400 truncate">{stream.streamerName}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
