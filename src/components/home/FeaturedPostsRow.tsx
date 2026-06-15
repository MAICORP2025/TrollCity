import React, { useEffect, useState, useCallback } from 'react'
import { Star, Play, Heart, MessageSquare, Gift } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WallPost } from '@/types/trollWall'
import HorizontalScrollRow from './HorizontalScrollRow'

interface FeaturedPostsRowProps {
  onPostClick?: (post: WallPost) => void
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

export default function FeaturedPostsRow({ onPostClick }: FeaturedPostsRowProps) {
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('wall_posts')
        .select('*')
        .order('likes', { ascending: false })
        .limit(10)

      if (error) throw error
      setPosts(data || [])
    } catch (err) {
      console.error('[FeaturedPostsRow] Failed to fetch:', err)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  if (loading) {
    return (
      <HorizontalScrollRow
        title="Featured Posts"
        subtitle="Top posts from the city"
        icon={<Star className="h-3.5 w-3.5 text-yellow-400" />}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[260px] w-[200px] shrink-0 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]"
          />
        ))}
      </HorizontalScrollRow>
    )
  }

  if (posts.length === 0) return null

  return (
    <HorizontalScrollRow
      title="Featured Posts"
      subtitle="Top posts from the city"
      icon={<Star className="h-3.5 w-3.5 text-yellow-400" />}
    >
      {posts.map((post) => {
        const avatarUrl =
          post.avatar_url ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(post.username || 'TC')}`
        const hasImage = !!post.metadata?.image_url
        const thumbnailUrl = post.metadata?.thumbnail_url || post.metadata?.image_url
        const commentCount = post.replies?.length || 0
        const giftCount = post.gifts
          ? Object.values(post.gifts).reduce((sum, g) => sum + (g.count || 0), 0)
          : 0

        return (
          <button
            key={post.id}
            onClick={() => onPostClick?.(post)}
            className="group relative flex h-[260px] w-[200px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c1a]/95 text-left transition-all duration-200 hover:border-yellow-400/30 hover:shadow-[0_0_24px_rgba(250,204,21,0.12)]"
          >
            {/* Featured badge */}
            <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-yellow-500/90 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-black">
              <Star className="h-2 w-2" />
              Featured
            </div>

            {/* Image area */}
            {hasImage && thumbnailUrl ? (
              <div className="relative h-[150px] w-full shrink-0 overflow-hidden">
                <img
                  src={thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#080c1a]/95" />
                {post.metadata?.video_url && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                      <Play className="h-4 w-4 text-white" fill="white" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative h-[120px] w-full shrink-0 bg-gradient-to-br from-purple-900/40 via-[#080c1a] to-cyan-900/30 p-3">
                <p className="line-clamp-4 text-xs leading-relaxed text-white/60">{post.content}</p>
              </div>
            )}

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                  <img src={avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
                <span className="truncate text-[10px] font-bold text-white/70">
                  {post.is_system_generated ? 'Troll City' : post.username || 'Unknown'}
                </span>
                <span className="ml-auto text-[9px] text-white/25">{timeAgo(post.created_at)}</span>
              </div>
              {!hasImage && (
                <p className="line-clamp-2 flex-1 text-[10px] leading-relaxed text-white/40">{post.content}</p>
              )}
              <div className="mt-auto flex items-center gap-2 text-[9px] text-white/30">
                <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" />{post.likes || 0}</span>
                <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{commentCount}</span>
                {giftCount > 0 && <span className="flex items-center gap-0.5"><Gift className="h-2.5 w-2.5" />{giftCount}</span>}
              </div>
            </div>
          </button>
        )
      })}
    </HorizontalScrollRow>
  )
}
