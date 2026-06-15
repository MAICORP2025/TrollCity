import React, { useEffect, useState, useCallback } from 'react'
import { Heart, MessageSquare, Gift, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WallPost } from '@/types/trollWall'

interface TrollWallGridRowProps {
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

export default function TrollWallGridRow({
  onPostClick,
}: TrollWallGridRowProps) {
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('wall_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(24)

      if (error) throw error

      setPosts(data || [])
    } catch (err) {
      console.error('[TrollWallGridRow] Failed to fetch posts:', err)
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
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">
            Troll Wall
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[260px] animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
            />
          ))}
        </div>
      </section>
    )
  }

  if (posts.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">
            Troll Wall
          </h2>
          <span className="text-sm text-white/40">
            {posts.length} posts
          </span>
        </div>

        <button className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
          See All →
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {posts.map((post) => {
          const avatarUrl =
            post.avatar_url ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
              post.username || 'TC'
            )}`

          const hasImage = !!post.metadata?.image_url

          const thumbnailUrl =
            post.metadata?.thumbnail_url ||
            post.metadata?.image_url

          const commentCount = post.replies?.length || 0

          const giftCount = post.gifts
            ? Object.values(
                post.gifts as Record<string, { count?: number }>
              ).reduce(
                (sum, g) => sum + (g?.count || 0),
                0
              )
            : 0

          return (
            <button
              key={post.id}
              onClick={() => onPostClick?.(post)}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-[#08101f] text-left transition-all duration-200 hover:border-cyan-400/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.12)]"
            >
              {hasImage && thumbnailUrl && (
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#08101f] via-transparent to-transparent" />
                </div>
              )}

              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/10">
                    {post.is_system_generated ? (
                      <div className="flex h-full w-full items-center justify-center bg-cyan-500/20 text-cyan-400">
                        ⚡
                      </div>
                    ) : (
                      <img
                        src={avatarUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">
                      {post.is_system_generated
                        ? 'Troll City System'
                        : post.username || 'Unknown'}
                    </div>

                    <div className="text-xs text-white/40">
                      {timeAgo(post.created_at)}
                    </div>
                  </div>
                </div>

                <p className="line-clamp-4 min-h-[72px] text-sm text-white/70">
                  {post.is_system_generated && (
                    <span className="text-cyan-400">⚡ </span>
                  )}
                  {post.content}
                </p>

                <div className="flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {post.likes || 0}
                  </span>

                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {commentCount}
                  </span>

                  {giftCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Gift className="h-4 w-4" />
                      {giftCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}