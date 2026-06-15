import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Gavel, Clock, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuctionCardProps {
  auction: {
    id: string
    title: string
    thumbnail_url?: string | null
    current_bid?: number
    ends_at?: string | null
  }
  className?: string
}

function timeRemaining(endsAt: string | null): string {
  if (!endsAt) return 'Ended'
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const hrs = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

export default function AuctionCard({ auction, className }: AuctionCardProps) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/auctions/${auction.id}`)}
      className={cn(
        'snap-start flex-shrink-0 w-[190px] rounded-2xl overflow-hidden cursor-pointer group/card',
        'border border-white/10 bg-white/[0.04] transition-all hover:border-amber-400/30 hover:bg-white/[0.07]',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {auction.thumbnail_url ? (
          <img
            src={auction.thumbnail_url}
            alt={auction.title}
            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-900/40 via-slate-900 to-orange-900/30 flex items-center justify-center">
            <Gavel className="w-8 h-8 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Time remaining */}
        {auction.ends_at && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
            <Clock className="w-2.5 h-2.5 text-amber-400" />
            {timeRemaining(auction.ends_at)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-[11px] font-black text-white truncate leading-tight mb-1">{auction.title}</p>
        {auction.current_bid !== undefined && (
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-300">{auction.current_bid.toLocaleString()}</span>
            <span className="text-[9px] text-slate-500">current bid</span>
          </div>
        )}
      </div>
    </div>
  )
}
