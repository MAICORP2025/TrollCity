import React from 'react'
import { Link } from 'react-router-dom'
import { Crown, Users, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FamilyCardProps {
  family: {
    id: string
    name: string
    logo_url?: string | null
    member_count?: number
    rank?: number
    achievement?: string | null
  }
  className?: string
}

export default function FamilyCard({ family, className }: FamilyCardProps) {
  return (
    <Link
      to={`/family/${family.id}`}
      className={cn(
        'snap-start flex-shrink-0 w-[160px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center transition-all hover:border-amber-400/30 hover:bg-white/[0.07] group/card block',
        className
      )}
    >
      {/* Family logo */}
      <div className="relative mx-auto w-14 h-14 mb-2">
        {family.logo_url ? (
          <img
            src={family.logo_url}
            alt={family.name}
            className="w-full h-full rounded-xl object-cover ring-2 ring-white/10 group-hover/card:ring-amber-400/40 transition-all"
          />
        ) : (
          <div className="w-full h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center ring-2 ring-white/10 group-hover/card:ring-amber-400/40 transition-all">
            <Crown className="w-6 h-6 text-white" />
          </div>
        )}
        {family.rank && family.rank <= 10 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 flex items-center justify-center text-[8px] font-black text-black">
            #{family.rank}
          </div>
        )}
      </div>

      <p className="text-xs font-black text-white truncate">{family.name}</p>

      <div className="flex items-center justify-center gap-3 mt-1.5 text-[9px] text-slate-400">
        <span className="flex items-center gap-0.5">
          <Users className="w-2.5 h-2.5" />
          {family.member_count || 0}
        </span>
        {family.achievement && (
          <span className="flex items-center gap-0.5">
            <Trophy className="w-2.5 h-2.5 text-amber-400" />
          </span>
        )}
      </div>
    </Link>
  )
}
