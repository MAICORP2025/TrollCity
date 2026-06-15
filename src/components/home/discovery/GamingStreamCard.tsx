import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Eye, Gamepad2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GamingStreamCardProps {
  stream: {
    id: string
    title: string
    streamerName: string
    streamerAvatar?: string | null
    gameTitle?: string | null
    viewerCount?: number
    thumbnailUrl?: string | null
    isFeatured?: boolean
  }
  className?: string
}

export default function GamingStreamCard({ stream, className }: GamingStreamCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/gaming/watch/${stream.id}`)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'snap-start flex-shrink-0 w-[200px] rounded-2xl overflow-hidden cursor-pointer group/card',
        'border border-white/10 bg-white/[0.04] transition-all hover:border-green-400/30 hover:bg-white/[0.07]',
        stream.isFeatured && 'border-green-500/30 bg-gradient-to-b from-green-500/[0.08] to-transparent',
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
          <div className="w-full h-full bg-gradient-to-br from-green-900/60 via-slate-900 to-emerald-900/40 flex items-center justify-center">
            <Gamepad2 className="w-8 h-8 text-white/30" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

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
        <p className="text-[11px] font-black text-white truncate leading-tight mb-0.5">{stream.title}</p>
        <p className="text-[9px] text-slate-400 truncate">{stream.streamerName}</p>
        {stream.gameTitle && (
          <div className="flex items-center gap-1 mt-1">
            <Gamepad2 className="w-2.5 h-2.5 text-green-400" />
            <span className="text-[9px] text-green-300 truncate">{stream.gameTitle}</span>
          </div>
        )}
      </div>
    </div>
  )
}
