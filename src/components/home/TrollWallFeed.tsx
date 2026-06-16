import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Heart,
  MessageSquare,
  MessageCircle,
  Sparkles,
  Radio,
  Flame,
  Gift,
  Clock,
  Users,
  Zap,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase, getBlockedUserIds } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { WallPost } from '@/types/trollWall'
import CreatePostComposer from './CreatePostComposer'
import TrollWallGridCard from './TrollWallGridCard'
import TrollWallPostModal from './TrollWallPostModal'
import HorizontalScrollRow from './HorizontalScrollRow'
import { cn } from '@/lib/utils'

import '@/styles/rainbow-scroller.css'

const UserProfilePopup = lazy(() => import('@/components/UserProfilePopup'))

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrollWallFeedProps {
  onRequireAuth: (intent?: string) => boolean
  feedClassName?: string
}

type GridFilter = 'all' | 'trending' | 'most_trolled' | 'most_gifted' | 'newest' | 'following' | 'system'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50
const POST_BUFFER_FLUSH_MS = 150

const FILTER_TABS: { id: GridFilter; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All Posts', icon: MessageSquare },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'most_trolled', label: 'Most Trolled', icon: Flame },
  { id: 'most_gifted', label: 'Most Gifted', icon: Gift },
  { id: 'newest', label: 'Newest', icon: Clock },
  { id: 'following', label: 'Following', icon: Users },
  { id: 'system', label: 'Troll City System', icon: Zap },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrollWallFeed({ onRequireAuth, feedClassName }: TrollWallFeedProps) {
  const { user } = useAuthStore()
  const isMountedRef = useRef(true)
  const latestRequestId = useRef(0)
  const postBufferRef = useRef<WallPost[]>([])

  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const blockedIdsRef = useRef(blockedIds)

  const [activeFilter, setActiveFilter] = useState<GridFilter>('all')
  const [selectedPost, setSelectedPost] = useState<WallPost | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)

  // -----------------------------------------------------------------------
  // Blocked users
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!user?.id) {
      setBlockedIds(new Set())
      blockedIdsRef.current = new Set()
      return
    }
    getBlockedUserIds()
      .then((ids) => {
        if (isMountedRef.current) {
          const newSet = new Set(ids)
          setBlockedIds(newSet)
          blockedIdsRef.current = newSet
        }
      })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    blockedIdsRef.current = blockedIds
  }, [blockedIds])

  // -----------------------------------------------------------------------
  // Build the Supabase query for the active filter
  // -----------------------------------------------------------------------

  const buildQuery = useCallback(
    (pageIndex: number, append: boolean) => {
      const start = pageIndex * PAGE_SIZE
      const end = start + PAGE_SIZE - 1

      let query = supabase
        .from('troll_wall_posts')
        .select(
          '*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, role, is_verified, is_gold, username_style, badge, empire_role, officer_level, troller_level, is_troller, rgb_username_expires_at, glowing_username_color)'
        )

      switch (activeFilter) {
        case 'trending':
          query = query.order('likes', { ascending: false })
          break
        case 'most_trolled':
          query = query.order('likes', { ascending: false })
          break
        case 'most_gifted':
          query = query.order('created_at', { ascending: false })
          break
        case 'newest':
          query = query.order('created_at', { ascending: false })
          break
        case 'following':
          query = query.order('created_at', { ascending: false })
          break
        case 'system':
          query = query
            .eq('is_system_generated', true)
            .order('created_at', { ascending: false })
          break
        case 'all':
        default:
          query = query
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
          break
      }

      if (append && oldestCreatedAt) {
        query = query.lt('created_at', oldestCreatedAt)
      }

      return query.range(start, end)
    },
    [activeFilter, oldestCreatedAt]
  )

  // -----------------------------------------------------------------------
  // Load posts
  // -----------------------------------------------------------------------

  const loadPosts = useCallback(
    async (pageIndex: number, append: boolean) => {
      const requestId = ++latestRequestId.current
      const isActiveRequest = () =>
        isMountedRef.current && requestId === latestRequestId.current

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setPage(0)
      }

      try {
        const { data, error } = await buildQuery(pageIndex, append)
        if (error) throw error
        if (!isActiveRequest()) return

        const currentBlockedIds = blockedIdsRef.current
        const rows = ((data as any[]) || []).filter(
          (row) => !currentBlockedIds.has(row.user_id)
        )
        const postIds = rows.map((row) => row.id)

        let likedPostIds = new Set<string>()
        if (user?.id && postIds.length > 0) {
          const { data: likedData } = await supabase
            .from('troll_wall_likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', postIds)
          likedPostIds = new Set(likedData?.map((like) => like.post_id) || [])
        }

        const normalized = rows.map((post: any) => {
          const author = post.user_profiles || {}
          return {
            ...post,
            username: author.username,
            avatar_url: author.avatar_url,
            is_admin: author.is_admin,
            is_troll_officer: author.is_troll_officer,
            is_og_user: author.is_og_user,
            user_created_at: author.created_at,
            user_liked: likedPostIds.has(post.id),
            reactions: post.reactions || {},
            gifts: post.gifts || {},
            is_verified: author.is_verified,
            is_gold: author.is_gold,
            username_style: author.username_style,
            badge: author.badge,
            officer_level: author.officer_level,
            troller_level: author.troller_level,
            is_troller: author.is_troller,
            rgb_username_expires_at: author.rgb_username_expires_at,
            glowing_username_color: author.glowing_username_color,
          } as WallPost
        })

        // Client-side sort for most_gifted
        if (activeFilter === 'most_gifted') {
          normalized.sort((a, b) => {
            const aGifts = a.gifts
              ? Object.values(a.gifts).reduce(
                  (s, g: any) => s + (g.count || 0),
                  0
                )
              : 0
            const bGifts = b.gifts
              ? Object.values(b.gifts).reduce(
                  (s, g: any) => s + (g.count || 0),
                  0
                )
              : 0
            return bGifts - aGifts
          })
        }

        if (!isActiveRequest()) return

        const newPosts = normalized.filter(
          (post: WallPost) => !post.reply_to_post_id
        )

        setPosts((prev) => {
          if (!append) return newPosts
          const existingIds = new Set(prev.map((p) => p.id))
          const toAdd = newPosts.filter((p) => !existingIds.has(p.id))
          return [...prev, ...toAdd]
        })

        const allLoaded = [...(append ? posts : []), ...newPosts]
        const oldestPost = allLoaded[allLoaded.length - 1]
        setOldestCreatedAt(oldestPost?.created_at || null)
        setHasMore(((data as any[]) || []).length === PAGE_SIZE)
      } catch (err: any) {
        if (!isActiveRequest()) return
        console.error('[TrollWallFeed] Error loading wall posts:', err)
        if (user) toast.error('Failed to load Wall posts')
      } finally {
        if (!isActiveRequest()) return
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, oldestCreatedAt, activeFilter, buildQuery, posts]
  )

  // Initial load & real-time subscription
  useEffect(() => {
    isMountedRef.current = true
    loadPosts(0, false)

    const channel = supabase
      .channel('public:troll_wall_posts_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'troll_wall_posts' },
        (payload) => {
          const incoming = payload.new as any
          if (!incoming || !incoming.id) return
          postBufferRef.current.push({ ...incoming, _event: 'INSERT' } as any)
        }
      )
      .subscribe()

    const flushInterval = setInterval(() => {
      if (postBufferRef.current.length === 0) return
      const updates = [...postBufferRef.current]
      postBufferRef.current = []

      const userIds = [
        ...new Set(updates.map((p) => p.user_id).filter(Boolean)),
      ]
      if (userIds.length > 0) {
        supabase
          .from('user_profiles')
          .select(
            'id, username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, is_verified, is_gold, username_style, badge, officer_level, troller_level, is_troller, rgb_username_expires_at, glowing_username_color'
          )
          .in('id', userIds)
          .then(({ data: profiles }) => {
            const profileMap: Record<string, any> = {}
            ;(profiles || []).forEach(
              (p: any) => {
                profileMap[p.id] = p
              }
            )
            setPosts((prev) => {
              let next = [...prev]
              updates.forEach((newPost) => {
                if (!newPost || !newPost.id) return
                if (next.findIndex((p) => p.id === newPost.id) !== -1) return
                if (newPost.reply_to_post_id) return

                const author = profileMap[newPost.user_id] || {}
                const enriched = {
                  ...newPost,
                  username: newPost.is_system_generated
                    ? 'Troll City System'
                    : author.username || newPost.username,
                  avatar_url: author.avatar_url,
                  is_admin: author.is_admin,
                  is_troll_officer: author.is_troll_officer,
                  is_og_user: author.is_og_user,
                  user_created_at: author.created_at,
                  is_verified: author.is_verified,
                  is_gold: author.is_gold,
                  username_style: author.username_style,
                  badge: author.badge,
                  officer_level: author.officer_level,
                  troller_level: author.troller_level,
                  is_troller: author.is_troller,
                  rgb_username_expires_at: author.rgb_username_expires_at,
                  glowing_username_color: author.glowing_username_color,
                  replies: [],
                } as WallPost

                if (activeFilter === 'system' && !enriched.is_system_generated) return
                if (activeFilter === 'following') return

                next = [enriched, ...next]
              })
              return next.slice(0, 200)
            })
          })
      }
    }, POST_BUFFER_FLUSH_MS)

    return () => {
      isMountedRef.current = false
      clearInterval(flushInterval)
      supabase.removeChannel(channel)
    }
  }, [loadPosts])

  // Reload when filter changes
  useEffect(() => {
    setPosts([])
    setOldestCreatedAt(null)
    setHasMore(true)
    loadPosts(0, false)
  }, [activeFilter])

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handlePostCreated = useCallback(
    (post: WallPost) => {
      if (blockedIds.has(post.user_id)) return
      setPosts((prev) => [post, ...prev])
    },
    [blockedIds]
  )

  const handleCardClick = useCallback((post: WallPost) => {
    setSelectedPost(post)
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedPost(null)
  }, [])

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      const nextPage = page + 1
      setPage(nextPage)
      loadPosts(nextPage, true)
    }
  }, [hasMore, loadingMore, page, loadPosts])

  // -----------------------------------------------------------------------
  // Infinite scroll via IntersectionObserver
  // -----------------------------------------------------------------------

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          handleLoadMore()
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, handleLoadMore])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex w-full flex-col">
      {/* Rainbow ticker marquee */}
      <div className="rainbow-ticker mb-3 rounded-2xl border border-white/10 bg-[#050816]/80 py-2">
        <div className="rainbow-ticker__track">
          {Array.from({ length: 2 }).map((_, setIdx) => (
            <React.Fragment key={setIdx}>
              <span className="rainbow-ticker__item" style={{ color: '#ff2a6d' }}>
                <Sparkles className="h-3 w-3" /> Pride Month
              </span>
              <span className="rainbow-ticker__item" style={{ color: '#ffb703' }}>
                🏳️‍🌈 Celebrate Love
              </span>
              <span className="rainbow-ticker__item" style={{ color: '#38ff7d' }}>
                <Heart className="h-3 w-3" /> Spread Kindness
              </span>
              <span className="rainbow-ticker__item" style={{ color: '#00d4ff' }}>
                ✨ Live With Pride
              </span>
              <span className="rainbow-ticker__item" style={{ color: '#a855f7' }}>
                <Sparkles className="h-3 w-3" /> Troll With Love
              </span>
              <span className="rainbow-ticker__item" style={{ color: '#ff2a6d' }}>
                🏳️‍⚧️ All Are Welcome
              </span>
              <span className="rainbow-ticker__item" style={{ color: '#ffb703' }}>
                💜 Support Creators
              </span>
              <span className="rainbow-ticker__item" style={{ color: '#38ff7d' }}>
                <Heart className="h-3 w-3" /> Pride Challenges Live
              </span>

            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div
        className={cn(
          'mb-3 rounded-3xl border border-cyan-400/10 bg-[#050816]/95 p-2 sm:p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]',
          feedClassName
        )}
      >
        <CreatePostComposer
          onPostCreated={handlePostCreated}
          onRequireAuth={onRequireAuth}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeFilter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-all duration-200',
                isActive
                  ? 'border border-cyan-400/25 bg-cyan-400/10 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.15)]'
                  : 'border border-white/[0.07] bg-white/[0.03] text-white/50 hover:border-white/15 hover:text-white/80'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Single row — scroll left/right with button nav */}
      {loading && posts.length === 0 ? (
        <HorizontalScrollRow
          title="Troll Wall"
          subtitle="Loading posts…"
          icon={<MessageCircle className="h-3.5 w-3.5 text-cyan-400" />}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[230px] w-[180px] shrink-0 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]"
            />
          ))}
        </HorizontalScrollRow>
      ) : posts.length > 0 ? (
        <HorizontalScrollRow
          title="Troll Wall"
          subtitle={`${posts.length} posts`}
          icon={<MessageCircle className="h-3.5 w-3.5 text-cyan-400" />}
        >
          {posts.map((post) => (
            <div key={post.id} className="shrink-0">
              <TrollWallGridCard
                post={post}
                onClick={handleCardClick}
              />
            </div>
          ))}
        </HorizontalScrollRow>
      ) : null}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="rounded-3xl border border-cyan-400/10 bg-[#050816]/80 py-16 text-center text-white/50">
          <MessageSquare className="mx-auto mb-3 h-8 w-8" />
          <p className="text-sm">No posts yet. Start the conversation.</p>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4 w-full" />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="py-6 text-center text-xs text-white/40">
          <span className="rainbow-text-shimmer font-bold">
            Loading more city posts...
          </span>
        </div>
      )}

      {/* Post detail modal */}
      <TrollWallPostModal
        post={selectedPost}
        onClose={handleCloseModal}
        onRequireAuth={onRequireAuth}
      />

      {/* User profile popup */}
      {selectedUserId && selectedUsername && (
        <Suspense fallback={null}>
          <UserProfilePopup
            userId={selectedUserId}
            username={selectedUsername}
            onClose={() => {
              setSelectedUserId(null)
              setSelectedUsername(null)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
