import React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useBadges } from '@/lib/hooks/useBadges'
import BadgeCard from './BadgeCard'

interface BadgesGridProps {
  userId?: string
  limit?: number
  showViewAllLink?: boolean
  className?: string
}

export function BadgesGrid({ userId, limit, showViewAllLink, className }: BadgesGridProps) {
  const { catalog, loading, error } = useBadges(userId)
  const items = typeof limit === 'number' ? catalog.slice(0, limit) : catalog

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Badges</h3>
          <p className="text-sm text-white/60">All badges across Troll City</p>
        </div>
        {showViewAllLink && (
          <Link
            to={`/badges/${userId}`}
            className="text-sm text-purple-300 hover:text-purple-200 underline"
          >
            View All
          </Link>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-white/60 bg-black/40 border border-white/10 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading badges…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-amber-200 bg-amber-900/40 border border-amber-800 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-white/60 bg-black/40 border border-white/10 rounded-xl px-4 py-3">
          No badges found.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </div>
  )}

export default BadgesGrid
