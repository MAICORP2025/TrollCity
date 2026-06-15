import React, { useCallback } from 'react'
import { Heart, MessageSquare, Gift, Pin } from 'lucide-react'
import { WallPost } from '@/types/trollWall'
import NeonGlowUsername from '@/components/NeonGlowUsername'

interface TrollWallGridCardProps {
  post: WallPost
  onClick: (post: WallPost) => void
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '…'
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString()
}

export default function TrollWallGridCard({ post, onClick }: TrollWallGridCardProps) {
  const avatarUrl =
    post.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      post.username || 'TC'
    )}`

  const hasImage = !!post.metadata?.image_url
  const thumbnailUrl = post.metadata?.thumbnail_url || post.metadata?.image_url

  const commentCount = post.replies?.length || 0
  const giftCount = post.gifts
    ? Object.values(post.gifts).reduce((sum, g) => sum + (g.count || 0), 0)
    : 0

  const handleClick = useCallback(() => {
    onClick(post)
  }, [onClick, post])

  const handleAvatarClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick(post)
    },
    [onClick, post]
  )

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative flex h-[230px] w-[180px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0e1e]/90 text-left transition-all duration-200 hover:border-cyan-400/25 hover:shadow-[0_0_24px_rgba(34,211,238,0.14)]"
    >
      {/* Pinned indicator */}
      {post.is_pinned && (
        <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent" />
      )}

      {/* Thumbnail — larger image area (55% of card) */}
      {hasImage && thumbnailUrl ? (
        <div className="relative h-[130px] w-full shrink-0 overflow-hidden">
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0e1e]/95" />
        </div>
      ) : (
        <div className="h-[6px] w-full shrink-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20" />
      )}

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 pt-2">
        {/* Author row */}
        <div className="flex items-center gap-2" onClick={handleAvatarClick}>
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
            {post.is_system_generated ? (
              <div className="flex h-full w-full items-center justify-center bg-cyan-500/20 text-[9px] text-cyan-400">
                ⚡
              </div>
            ) : (
              <img
                src={avatarUrl}
                alt={post.username || ''}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-white/80 group-hover:text-white">
              {post.is_system_generated ? 'Troll City System' : post.username || 'Unknown'}
            </span>
            <span className="text-[10px] text-white/30">{timeAgo(post.created_at)}</span>
          </div>
        </div>

        {/* Post preview text */}
        <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-white/50 group-hover:text-white/70">
          {post.is_system_generated && <span className="text-cyan-400/80">⚡ </span>}
          {truncateWords(post.content, 12)}
        </p>

        {/* Bottom meta row */}
        <div className="mt-auto flex items-center gap-3 text-[10px] text-white/30">
          <span className="flex items-center gap-0.5">
            <Heart className="h-3 w-3" />
            {post.likes || 0}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" />
            {commentCount}
          </span>
          {giftCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Gift className="h-3 w-3" />
              {giftCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
