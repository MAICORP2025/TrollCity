import React from 'react'
import { Check, Sparkles, Car } from 'lucide-react'
import type { MergedBadge } from '@/lib/badges/mergeBadges'

interface BadgeCardProps {
  badge: MergedBadge
}

const rarityColors: Record<string, string> = {
  common: 'from-slate-800/80 via-slate-900 to-slate-950 border-slate-800',
  rare: 'from-indigo-800/80 via-indigo-900 to-slate-950 border-indigo-800',
  epic: 'from-purple-800/80 via-purple-900 to-slate-950 border-purple-800',
  legendary: 'from-amber-800/80 via-amber-900 to-slate-950 border-amber-700',
}

function formatDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString()
}

export function BadgeCard({ badge }: BadgeCardProps) {
  const earned = badge.earned
  const earnedDate = formatDate(badge.earned_at)
  const rarityClass = rarityColors[badge.rarity?.toLowerCase()] || rarityColors.common
  const displayName = badge.name || badge.slug || 'Unknown Badge'

  return (
    <div
      className={`relative rounded-2xl border p-4 bg-gradient-to-br shadow-lg transition ${rarityClass} ${
        earned ? 'opacity-100' : 'opacity-40 grayscale'
      }`}
    >
      {!earned && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-emerald-300">
          <Check className="w-4 h-4" />
          <span>To Earn</span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
          {badge.icon_url ? (
            <img src={badge.icon_url} alt={displayName} className="w-full h-full object-cover" />
          ) : badge.slug === 'driver-license' ? (
            <Car className="w-6 h-6 text-blue-400" />
          ) : (
            <Sparkles className="w-6 h-6 text-white/80" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-white">{displayName}</h4>
            <span className="text-[10px] uppercase tracking-wide text-white/70">{badge.category}</span>
          </div>
          <p className="text-sm text-white/70 leading-snug">{badge.description}</p>
          {earned ? (
            <p className="text-xs text-emerald-200">Earned {earnedDate ?? 'recently'}</p>
          ) : (
            <p className="text-xs text-white/60">Not yet earned</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default BadgeCard
