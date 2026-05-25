import React, { useMemo } from 'react'
import { cn } from '../../lib/utils'

export interface StreamAudienceMember {
  id: string
  stream_id: string
  user_id: string
  username: string
  avatar_url: string | null
  joined_at: string
  left_at: string | null
  is_active: boolean
  gift_total: number
  seat_id: string | null
  role: 'audience' | 'seat' | 'broadcaster'
  last_seen_at: string
}

interface AudienceBubbleTickerProps {
  streamId: string
  audience: StreamAudienceMember[]
  currentUserId?: string
  maxVisible?: number
  className?: string
}

export function AudienceBubbleTicker({
  streamId,
  audience,
  currentUserId,
  maxVisible = 10,
  className = '',
}: AudienceBubbleTickerProps) {
  // Filter to active audience (is_active and left_at null)
  const activeAudience = useMemo(() => {
    return audience.filter(
      (member) => member.is_active && !member.left_at
    )
  }, [audience])

  // Sort by gift_total descending, then by joined_at ascending (older first)
  const sortedAudience = useMemo(() => {
    return [...activeAudience].sort((a, b) => {
      if (b.gift_total !== a.gift_total) {
        return b.gift_total - a.gift_total
      }
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })
  }, [activeAudience])

  // Limit to maxVisible
  const visibleAudience = useMemo(() => {
    return sortedAudience.slice(0, maxVisible)
  }, [sortedAudience, maxVisible])

  return (
    <div className={cn('flex items-center gap-2 overflow-x-hidden', className)}>
      {visibleAudience.map((member) => (
        <div
          key={member.id}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur',
            member.user_id === currentUserId &&
              'ring-2 ring-cyan-400/50 animate-pulse'
          )}
        >
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={`${member.username}'s avatar`}
              className="h-8 w-8 rounded-full object-cover border-2 border-white/20"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 font-bold">
              {member.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs font-medium text-cyan-200">
            {member.username}
            {member.gift_total > 0 && (
              <span className="bg-cyan-500/20 px-1.5 rounded text-[10px]">
                {member.gift_total}💎
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}