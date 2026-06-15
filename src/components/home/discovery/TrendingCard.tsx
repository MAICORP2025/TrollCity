import React from 'react'
import { Link } from 'react-router-dom'
import { Flame, Heart, MessageSquare, Share2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrendingCardProps {
  post: {
    id: string
    username?: string
    avatar_url?: string | null
    content: string
    likes?: number
    commentCount?: number
    shareCount?: number
    created_at: string
    thumbnail?: string | null
  }
  className?: string
}

export default function TrendingCard({ post, className }: TrendingCardProps) {
  const preview = post.content
    ? post.content.split(/\s+/).slice(0, 8).join(' ') + (post.content.split(/\s+/).length > 8 ? '…' : '')
    : ''

  return (
    <div
      className={cn(
        'snap-start flex-shrink-0 w-[190px] rounded-2xl border border-orange-500/15 bg-gradient-to-b from-orange-500/[0.06] to-white/[0.02] p-3 transition-all hover:border-orange-400/30 hover:bg-orange-500/[0.08] group/card',
        className
      )}
    >
      {/* Trending badge */}
      <div className="flex items-center gap-1 mb-2">
        <TrendingUp className="w-3 h-3 text-orange-400" />
        <span className="text-[9px] font-black text-orange-300 uppercase tracking-wider">Trending</span>
        <Flame className="w-3 h-3 text-orange-400 ml-auto" />
      </div>

      {/* User */}
      <div className="flex items-center gap-1.5 mb-2">
        <Link
          to={`/profile/${post.id}`}
          className="w-5 h-5 rounded-full flex-shrink-0 overflow-hidden ring-1 ring-white/10"
        >
          {post.avatar_url ? (
            <img src={post.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-500 to-red-500" />
          )}
        </Link>
        <span className="text-[9px] font-bold text-white truncate">{post.username}</span>
      </div>

      {/* Content preview */}
      <p className="text-[10px] text-slate-300 line-clamp-3 leading-tight mb-2">{preview}</p>

      {/* Stats */}
      <div className="flex items-center gap-2.5 text-[9px] text-slate-500">
        <span className="flex items-center gap-0.5">
          <Heart className="w-2.5 h-2.5 text-pink-400" />
          {post.likes || 0}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageSquare className="w-2.5 h-2.5 text-blue-400" />
          {post.commentCount || 0}
        </span>
        <span className="flex items-center gap-0.5">
          <Share2 className="w-2.5 h-2.5 text-green-400" />
          {post.shareCount || 0}
        </span>
      </div>
    </div>
  )
}
