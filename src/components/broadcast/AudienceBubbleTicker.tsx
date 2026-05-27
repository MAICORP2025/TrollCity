import React, { useEffect, useMemo, useRef, useState } from 'react'
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

const LEAVE_ANIMATION_DURATION = 5000

export function AudienceBubbleTicker({
  streamId,
  audience,
  currentUserId,
  maxVisible = 10,
  className = '',
}: AudienceBubbleTickerProps) {
  const [leavingAudience, setLeavingAudience] = useState<
    Record<string, StreamAudienceMember & { expireAt: number }>
  >({})

  const previousActiveIdsRef = useRef<string[]>([])

  const activeAudience = useMemo(() => {
    return audience.filter((member) => member.is_active && !member.left_at)
  }, [audience])

  const sortedAudience = useMemo(() => {
    return [...activeAudience].sort((a, b) => {
      if (b.gift_total !== a.gift_total) {
        return b.gift_total - a.gift_total
      }

      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })
  }, [activeAudience])

  useEffect(() => {
    const activeIds = activeAudience.map((member) => member.id)
    const previousIds = previousActiveIdsRef.current
    const removedIds = previousIds.filter((id) => !activeIds.includes(id))

    if (removedIds.length > 0) {
      const now = Date.now()

      setLeavingAudience((prev) => {
        const next = { ...prev }

        removedIds.forEach((id) => {
          if (next[id]) return

          const leftMember = audience.find((member) => member.id === id)

          if (leftMember) {
            next[id] = {
              ...leftMember,
              expireAt: now + LEAVE_ANIMATION_DURATION,
            }
          }
        })

        return next
      })
    }

    previousActiveIdsRef.current = activeIds
  }, [activeAudience, audience])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()

      setLeavingAudience((prev) => {
        let updated = false
        const next = { ...prev }

        Object.keys(next).forEach((id) => {
          if (next[id].expireAt <= now) {
            delete next[id]
            updated = true
          }
        })

        return updated ? next : prev
      })
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const leavingAudienceArray = useMemo(() => {
    return Object.values(leavingAudience).sort((a, b) => {
      const bTime = new Date(b.left_at || b.last_seen_at).getTime()
      const aTime = new Date(a.left_at || a.last_seen_at).getTime()
      return bTime - aTime
    })
  }, [leavingAudience])

  const displayAudience = useMemo(() => {
    const visible = sortedAudience.slice(0, maxVisible)
    const leavingExtras = leavingAudienceArray.slice(0, 2)

    return [...visible, ...leavingExtras]
  }, [sortedAudience, leavingAudienceArray, maxVisible])

  const overflowCount = Math.max(0, activeAudience.length - maxVisible)

  if (!streamId) {
    return null
  }

  if (displayAudience.length === 0 && overflowCount === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent',
        className
      )}
    >
      {displayAudience.map((member) => {
        const isLeaving = !!leavingAudience[member.id]
        const isCurrentUser = member.user_id === currentUserId
        const firstLetter = member.username?.charAt(0)?.toUpperCase() || '?'

        return (
          <div
            key={`${member.id}-${isLeaving ? 'leaving' : 'active'}`}
            className={cn(
              'flex-shrink-0 flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-white shadow-lg backdrop-blur transition-all duration-300',
              isCurrentUser && 'ring-2 ring-cyan-400/50 animate-pulse',
              isLeaving && 'scale-95 opacity-60'
            )}
            title={isLeaving ? `${member.username} left the stream` : member.username}
          >
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={`${member.username}'s avatar`}
                className="h-8 w-8 rounded-full border-2 border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/20 text-sm font-black text-cyan-200">
                {firstLetter}
              </div>
            )}

            <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-cyan-100">
              <span className="max-w-[90px] truncate">
                {member.username}
              </span>

              {member.gift_total > 0 && (
                <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-black text-cyan-100">
                  {member.gift_total}💎
                </span>
              )}

              {member.role === 'seat' && (
                <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-purple-100">
                  Seat
                </span>
              )}

              {member.role === 'broadcaster' && (
                <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-yellow-100">
                  Host
                </span>
              )}

              {isLeaving && (
                <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-100">
                  Left
                </span>
              )}
            </div>
          </div>
        )
      })}

      {overflowCount > 0 && (
        <div className="flex-shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
          +{overflowCount} more
        </div>
      )}
    </div>
  )
}

export default AudienceBubbleTicker