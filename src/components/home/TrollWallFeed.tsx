import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Heart,
  MessageSquare,
  Pin,
  Reply,
  Trash2,
  Sparkles,
  Radio,
  Flame,
  X,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Virtuoso } from 'react-virtuoso'

import { supabase, getBlockedUserIds } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { WallPost } from '@/types/trollWall'
import UserNameWithAge from '@/components/UserNameWithAge'
import NeonGlowUsername from '@/components/NeonGlowUsername'
import CreatePostComposer from './CreatePostComposer'
import { parseTextWithLinks, cn } from '@/lib/utils'
import WallShareModal from '@/components/trollWall/WallShareModal'
import { useIsPwa } from '@/lib/hooks/useIsPwa'
import '@/styles/rainbow-scroller.css'

const UserProfilePopup = lazy(() => import('@/components/UserProfilePopup'))
const MentionTextarea = lazy(() => import('@/components/MentionTextarea'))

interface TrollWallFeedProps {
  onRequireAuth: (intent?: string) => boolean
  feedClassName?: string
}

interface LiveGamingStream {
  id: string
  user_id: string
  title: string
  game_title: string | null
  broadcaster_name: string
}

const PAGE_SIZE = 10

const POST_BUFFER_FLUSH_MS = 150

export default function TrollWallFeed({ onRequireAuth, feedClassName }: TrollWallFeedProps) {
  const { user, isAdmin } = useAuthStore()
  const isPwa = useIsPwa()
  const isMountedRef = useRef(true)
  const latestRequestId = useRef(0)
  const postBufferRef = useRef<WallPost[]>([]);

  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null)
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [lightboxTitle, setLightboxTitle] = useState<string | null>(null)
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const blockedIdsRef = useRef(blockedIds)
  const [sharingPost, setSharingPost] = useState<WallPost | null>(null)
  const [liveGamingStreams, setLiveGamingStreams] = useState<LiveGamingStream[]>([])

  const fetchLiveGamingStreams = useCallback(async () => {
    try {
      const { data: streamsData, error: streamsError } = await supabase
        .from('streams')
        .select(`
          id,
          user_id,
          title,
          game_title,
          is_live,
          category,
          broadcaster_id
        `)
        .eq('is_live', true)
        .eq('category', 'gaming')
        .limit(10)

      if (streamsError) throw streamsError

      const broadcasterIds = [...new Set(streamsData
        .map((s: any) => s.broadcaster_id || s.user_id)
        .filter(Boolean))]

      let profilesMap: Record<string, string> = {}
      if (broadcasterIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', broadcasterIds)

        profilesMap = (profilesData || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.username
          return acc
        }, {})
      }

      const streams = (streamsData || []).map((stream: any) => {
        const broadcasterId = stream.broadcaster_id || stream.user_id
        return {
          id: stream.id,
          user_id: broadcasterId,
          title: stream.title || 'Live stream',
          game_title: stream.game_title,
          broadcaster_name: profilesMap[broadcasterId] || 'Gamer',
        }
      })

      setLiveGamingStreams(streams)
    } catch (err) {
      console.warn('[TrollWallFeed] Failed to fetch live gaming streams:', err)
    }
  }, [])

  useEffect(() => {
    fetchLiveGamingStreams()
    const interval = setInterval(fetchLiveGamingStreams, 30000)
    return () => clearInterval(interval)
  }, [fetchLiveGamingStreams])

  // Load blocked user IDs on mount and when user changes
  useEffect(() => {
    if (!user?.id) {
      setBlockedIds(new Set())
      blockedIdsRef.current = new Set()
      return
    }
    getBlockedUserIds().then(ids => {
      if (isMountedRef.current) {
        const newSet = new Set(ids)
        setBlockedIds(newSet)
        blockedIdsRef.current = newSet
      }
    }).catch(() => {})
  }, [user?.id])

  useEffect(() => {
    blockedIdsRef.current = blockedIds
  }, [blockedIds])

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
        const { data, error } = await (() => {
          let query = supabase
            .from('troll_wall_posts')
            .select(
              '*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, role, is_verified, is_gold, username_style, badge, empire_role, officer_level, troller_level, is_troller, rgb_username_expires_at, glowing_username_color)'
            )
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })

          if (append && oldestCreatedAt) {
            query = query.lt('created_at', oldestCreatedAt)
          }

          return query.range(0, PAGE_SIZE - 1)
        })()

        if (error) throw error
        if (!isActiveRequest()) return

        const currentBlockedIds = blockedIdsRef.current
        const rows = ((data as any[]) || []).filter((row) => !currentBlockedIds.has(row.user_id))
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

        const parentPosts = normalized.filter((post: WallPost) => !post.reply_to_post_id)
        const replies = normalized.filter((post: WallPost) => post.reply_to_post_id && !currentBlockedIds.has(post.user_id))

        const repliesMap: Record<string, WallPost[]> = {}

        replies.forEach((reply: WallPost) => {
          const parentId = reply.reply_to_post_id
          if (!parentId) return
          if (!repliesMap[parentId]) repliesMap[parentId] = []
          repliesMap[parentId].push(reply)
        })

        Object.keys(repliesMap).forEach((parentId) => {
          repliesMap[parentId].sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          )
        })

        const parentIds = new Set(parentPosts.map((post) => post.id))
        const orphanReplies = replies.filter((reply) => !parentIds.has(reply.reply_to_post_id))

        const postsWithReplies = parentPosts.map((post: WallPost) => ({
          ...post,
          replies: repliesMap[post.id] || [],
        })) as WallPost[]

        if (!isActiveRequest()) return

        const mergedPosts = (prev: WallPost[]) => {
          if (!append) return [...postsWithReplies, ...orphanReplies.map((reply) => ({ ...reply, replies: [] }))]

          const existingIds = new Set(prev.map((post) => post.id))
          const appendPosts = [
            ...postsWithReplies,
            ...orphanReplies.map((reply) => ({ ...reply, replies: [] })),
          ].filter((post) => !existingIds.has(post.id))
          return [...prev, ...appendPosts]
        }

        const newPosts = [
          ...postsWithReplies,
          ...orphanReplies.map((reply) => ({ ...reply, replies: [] })),
        ]

        setPosts((prev) => mergedPosts(prev))

        const oldestPost = newPosts[newPosts.length - 1]
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
    [user, oldestCreatedAt]
  )

  useEffect(() => {
    isMountedRef.current = true
    loadPosts(0, false)

    const channel = supabase.channel('public:troll_wall_posts_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'troll_wall_posts' },
        (payload) => {
          const incoming = payload.event === 'DELETE' ? payload.old : payload.new
          if (!incoming || !incoming.id) return
          postBufferRef.current.push({ ...incoming, _event: payload.event } as any)
        }
      )
      .subscribe()

    const flushInterval = setInterval(() => {
      if (postBufferRef.current.length === 0) return

      const updates = [...postBufferRef.current]
      postBufferRef.current = []

      setPosts(prev => {
        let next = [...prev]
        updates.forEach(newPost => {
          if (!newPost || !newPost.id) return

          if (newPost._event === 'DELETE') {
            next = next.filter((post) => post.id !== newPost.id)
            return
          }

          if (newPost.reply_to_post_id) {
            const parentIdx = next.findIndex(p => p.id === newPost.reply_to_post_id)
            if (parentIdx !== -1) {
              const parent = next[parentIdx]
              const existingReplies = parent.replies || []
              const replyIdx = existingReplies.findIndex(r => r.id === newPost.id)
              if (replyIdx !== -1) {
                const updatedReplies = [...existingReplies]
                updatedReplies[replyIdx] = { ...updatedReplies[replyIdx], ...newPost }
                next[parentIdx] = { ...parent, replies: updatedReplies }
              } else {
                next[parentIdx] = {
                  ...parent,
                  replies: [...existingReplies, newPost as WallPost]
                }
              }
            } else {
              const existingIdx = next.findIndex(p => p.id === newPost.id)
              if (existingIdx === -1) {
                next = [{ ...newPost, replies: [] }, ...next]
              }
            }
          } else {
            const idx = next.findIndex(p => p.id === newPost.id)
            if (idx !== -1) {
              const existingReplies = next[idx].replies || []
              next[idx] = { ...next[idx], ...newPost, replies: existingReplies }
            } else {
              next = [{ ...newPost, replies: [] }, ...next]
            }
          }
        })
        return next.slice(0, 100)
      })
    }, POST_BUFFER_FLUSH_MS)

    return () => {
      isMountedRef.current = false
      clearInterval(flushInterval)
      supabase.removeChannel(channel)
    }
  }, [loadPosts])

  const handlePostCreated = useCallback((post: WallPost) => {
    if (blockedIds.has(post.user_id)) return
    setPosts((prev) => [post, ...prev])
  }, [blockedIds])

  const handleLike = useCallback(
    async (postId: string) => {
      if (!user?.id) {
        onRequireAuth('like a post')
        return
      }

      if (likingPosts.has(postId)) return

      setLikingPosts((prev) => new Set(prev).add(postId))

      try {
        const { data, error } = await supabase.rpc('toggle_wall_post_like', {
          p_post_id: postId,
          p_user_id: user.id,
        })

        if (error) throw error

        if (data) {
          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId
                ? { ...post, likes: data.likes_count, user_liked: data.liked }
                : post
            )
          )
        }
      } catch (err: any) {
        console.error('Error toggling like:', err)
        toast.error('Failed to like post')
      } finally {
        setLikingPosts((prev) => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      }
    },
    [user?.id, onRequireAuth, likingPosts]
  )

  const handleReplySubmit = useCallback(
    async (postId: string) => {
      if (!user?.id) {
        onRequireAuth('reply to a post')
        return
      }

      if (!replyText.trim()) {
        toast.error('Write a reply before posting')
        return
      }

      try {
        const { error } = await supabase.rpc('create_wall_post_reply', {
          p_original_post_id: postId,
          p_user_id: user.id,
          p_content: replyText.trim(),
        })

        if (error) throw error

        toast.success('Reply posted')
        setReplyingTo(null)
        setReplyText('')
        setPage(0)
        loadPosts(0, false)
      } catch (err: any) {
        console.error('Error posting reply:', err)
        toast.error('Failed to post reply')
      }
    },
    [user?.id, replyText, onRequireAuth, loadPosts]
  )

  const handlePinToggle = useCallback(
    async (postId: string, currentlyPinned: boolean) => {
      if (!user?.id) {
        onRequireAuth('pin a post')
        return
      }

      try {
        const { data, error } = await supabase.rpc('toggle_wall_post_pin', {
          p_post_id: postId,
          p_user_id: user.id,
        })

        if (error) throw error

        const pinned = typeof data === 'boolean' ? data : !currentlyPinned

        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId ? { ...post, is_pinned: pinned } : post
          )
        )

        toast.success(pinned ? 'Post pinned' : 'Post unpinned')
      } catch (err: any) {
        console.error('Error toggling pin:', err)
        toast.error('Failed to pin/unpin post')
      }
    },
    [user?.id, onRequireAuth]
  )

  const handleDelete = useCallback(
    async (postId: string) => {
      if (!user?.id) {
        onRequireAuth('delete a post')
        return
      }

      if (!confirm('Are you sure you want to delete this post?')) return

      try {
        let query = supabase.from('troll_wall_posts').delete().eq('id', postId)

        if (!isAdmin) query = query.eq('user_id', user.id)

        const { error } = await query

        if (error) {
          toast.error(`Failed to delete post: ${error.message}`)
          return
        }

        setPosts((prev) => prev.filter((post) => post.id !== postId))
        toast.success('Post deleted')
      } catch (err: any) {
        console.error('Error deleting post:', err)
        toast.error('Failed to delete post')
      }
    },
    [user?.id, isAdmin, onRequireAuth]
  )

  const openLightbox = useCallback((imageUrl: string, title?: string | null) => {
    setLightboxImage(imageUrl)
    setLightboxTitle(title || null)
    setLightboxVisible(true)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxVisible(false)
    setTimeout(() => {
      setLightboxImage(null)
      setLightboxTitle(null)
    }, 200)
  }, [])

  const renderPost = useCallback(
    (_index: number, post: WallPost) => {
      const isTrending = (post.likes || 0) >= 25
      const avatarUrl =
        post.avatar_url ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          post.username || 'TC'
        )}`

      return (
        <div className="pb-4">
          <div className="group relative overflow-hidden rounded-3xl border border-cyan-400/10 bg-[#050816]/90 p-4 shadow-[0_0_25px_rgba(34,211,238,0.08)] transition-all duration-300 hover:border-cyan-300/25 hover:shadow-[0_0_45px_rgba(34,211,238,0.18)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.09),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent)]" />

            {post.is_pinned && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-300/80 to-transparent" />
            )}

            <div className="relative">
             <div className="flex items-start justify-between gap-3">
                 <div className="flex min-w-0 items-center gap-3">
                   <button
                     type="button"
                     onClick={() => {
                       if (!post.user_id || !post.username) return
                       setSelectedUserId(post.user_id)
                       setSelectedUsername(post.username)
                     }}
                     className="relative shrink-0"
                   >
                     <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 opacity-70 blur-sm transition group-hover:opacity-100" />
                     <img
                       src={avatarUrl}
                       alt={post.username || 'User'}
                       loading="lazy"
                       className="relative h-10 w-10 rounded-full border border-white/10 object-cover"
                     />
                   </button>

                   <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {post.is_system_generated ? (
                            <>
                                <div className="relative h-10 w-10 rounded-full border border-white/10 object-cover">
                                    <div className="absolute inset-0 flex items-center justify-center text-cyan-400 text-[10px]">
                                        ⚡
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-cyan-400">
                                            Troll City System
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-cyan-300">
                                            <span className="text-[10px]">⚡</span>
                                            System
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {post.username ? (
                                    <NeonGlowUsername
                                        username={post.username}
                                        avatarUrl={avatarUrl}
                                        profile={{
                                            is_admin: post.is_admin,
                                            is_troll_officer: post.is_troll_officer,
                                            is_og_user: post.is_og_user,
                                            is_verified: post.user_verified,
                                            is_gold: post.user_is_gold,
                                            officer_level: post.officer_level,
                                            troller_level: post.troller_level,
                                            is_troller: post.is_troller,
                                            username_style: post.username_style,
                                            badge: post.badge,
                                        }}
                                        size="sm"
                                        onClick={() => {
                                            setSelectedUserId(post.user_id)
                                            setSelectedUsername(post.username || null)
                                        }}
                                    />
                                ) : (
                                    <span className="text-sm font-semibold text-white/60">
                                        Deleted User
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                     <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
                       <span>{new Date(post.created_at).toLocaleString()}</span>
                       <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-cyan-100/70">
                         Troll City Feed
                       </span>
                     </div>
                   </div>
                 </div>

                 {post.reply_to_post_id && (
                   <p className="mt-2 rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-bold text-purple-300">
                     Replying to a post
                   </p>
                 )}

             </div>
               <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/90">
                 {post.is_system_generated ? (
                   <>
                     <span className="flex items-center gap-2 text-cyan-400">
                       <span className="text-[10px]">⚡</span>
                       <span className="font-semibold">Troll City System</span>
                     </span>
                     <span className="block mt-1">{parseTextWithLinks(post.content)}</span>
                   </>
                 ) : (
                   parseTextWithLinks(post.content)
                 )}
               </p>

              {post.metadata?.image_url && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/10 bg-black/30">
                  <button
                    type="button"
                    onClick={() =>
                      openLightbox(post.metadata?.image_url || '', post.content || null)
                    }
                    className="w-full text-left"
                  >
                    <img
                      src={post.metadata.image_url}
                      alt="Post media"
                      loading="lazy"
                      className="max-h-64 w-full cursor-pointer object-cover transition duration-300 hover:scale-[1.015]"
                    />
                  </button>
                </div>
              )}

              {post.metadata?.video_url && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/10 bg-black/30">
                  <video controls className="max-h-64 w-full">
                    <source src={post.metadata.video_url} />
                  </video>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                <button
                  type="button"
                  onClick={() => handleLike(post.id)}
                  disabled={likingPosts.has(post.id)}
                  className={`group/action flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all duration-200 ${
                    post.user_liked
                      ? 'border-pink-400/20 bg-pink-500/15 text-pink-300'
                      : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:text-cyan-100'
                  }`}
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${
                      post.user_liked ? 'fill-current' : ''
                    }`}
                  />
                  {post.likes || 0}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReplyingTo((prev) => (prev === post.id ? null : post.id))
                  }
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition-all duration-200 hover:border-purple-300/20 hover:bg-purple-500/10 hover:text-purple-100"
                >
                  <Reply className="h-3.5 w-3.5" />
                  Reply
                </button>

                {user && (post.user_id === user.id || isAdmin) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePinToggle(post.id, !!post.is_pinned)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all duration-200 ${
                        post.is_pinned
                          ? 'border-yellow-300/20 bg-yellow-500/15 text-yellow-300'
                          : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-yellow-300/20 hover:bg-yellow-500/10 hover:text-yellow-200'
                      }`}
                      title={post.is_pinned ? 'Unpin post' : 'Pin post'}
                    >
                      <Pin
                        className={`h-3.5 w-3.5 ${
                          post.is_pinned ? 'fill-current' : ''
                        }`}
                      />
                      {post.is_pinned ? 'Unpin' : 'Pin'}
                    </button>

                     <button
                       type="button"
                       onClick={() => handleDelete(post.id)}
                       className="flex items-center gap-1.5 rounded-full border border-red-300/10 bg-red-500/5 px-3 py-1.5 text-red-300 transition-all duration-200 hover:border-red-300/30 hover:bg-red-500/15 hover:text-red-100"
                       title={
                         isAdmin && post.user_id !== user.id
                           ? 'Admin delete post'
                           : 'Delete post'
                       }
                     >
                       <Trash2 className="h-3.5 w-3.5" />
                       Delete
                     </button>

                     <button
                       type="button"
                       onClick={() => setSharingPost(post)}
                       className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-white/60 transition-all duration-200 hover:border-blue-300/20 hover:bg-blue-500/10 hover:text-blue-200"
                       title="Share post"
                     >
                       <Share2 className="h-3.5 w-3.5" />
                       Share
                     </button>
                   </>
                 )}
              </div>

              {replyingTo === post.id && (
                <div className="mt-3 rounded-2xl border border-purple-300/15 bg-black/35 p-3">
                  <Suspense
                    fallback={<div className="min-h-[60px] w-full bg-transparent" />}
                  >
                    <MentionTextarea
                      value={replyText}
                      onChange={setReplyText}
                      placeholder="Write a reply... Use # to tag users"
                      className="min-h-[60px] w-full bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
                    />
                  </Suspense>

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyText('')
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReplySubmit(post.id)}
                      className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-purple-500"
                    >
                      Post Reply
                    </button>
                  </div>
                </div>
              )}

              {post.replies && post.replies.length > 0 && (
                <div className="mt-4 space-y-2 border-l-2 border-purple-500/30 pl-3">
                  {post.replies.map((reply) => {
                    const replyAvatar =
                      reply.avatar_url ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        reply.username || 'TC'
                      )}`

                    return (
                      <div
                        key={reply.id}
                        className="relative overflow-hidden rounded-2xl border border-purple-400/10 bg-[#0a0f1f]/90 p-3"
                      >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.08),transparent_35%)]" />

                        <div className="relative flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!reply.user_id || !reply.username) return
                              setSelectedUserId(reply.user_id)
                              setSelectedUsername(reply.username)
                            }}
                            className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10"
                          >
                            <img
                              src={replyAvatar}
                              alt={reply.username || 'User'}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {reply.username ? (
                                <button
                                  type="button"
                                  className="transition hover:opacity-80"
                                  onClick={() => {
                                    setSelectedUserId(reply.user_id)
                                    setSelectedUsername(reply.username || null)
                                  }}
                                >
                                  <UserNameWithAge
                                    user={{
                                      username: reply.username,
                                      id: reply.user_id,
                                      is_admin: reply.is_admin,
                                      is_troll_officer: reply.is_troll_officer,
                                      is_og_user: reply.is_og_user,
                                      created_at: reply.user_created_at,
                                    }}
                                    className="text-xs font-semibold text-white"
                                  />
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-white/60">
                                  Deleted User
                                </span>
                              )}

                              <span className="text-[10px] text-white/40">
                                {new Date(reply.created_at).toLocaleString()}
                              </span>
                            </div>

                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-white/80">
                              {parseTextWithLinks(reply.content)}
                            </p>

                            <div className="mt-2 flex items-center gap-2 text-[10px] text-white/50">
                              <button
                                type="button"
                                onClick={() => handleLike(reply.id)}
                                disabled={likingPosts.has(reply.id)}
                                className={`flex items-center gap-1 rounded-full border px-2 py-1 transition-colors ${
                                  reply.user_liked
                                    ? 'border-pink-400/20 bg-pink-600/20 text-pink-300'
                                    : 'border-white/10 bg-white/[0.03] hover:bg-white/5'
                                }`}
                              >
                                <Heart
                                  className={`h-3 w-3 ${
                                    reply.user_liked ? 'fill-current' : ''
                                  }`}
                                />
                                {reply.likes || 0}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    },
    [
      user,
      isAdmin,
      likingPosts,
      replyingTo,
      replyText,
      handleLike,
      handleReplySubmit,
      handlePinToggle,
      handleDelete,
      openLightbox,
      setSharingPost,
    ]
  )

  return (
    <div className="flex flex-col min-h-full w-full">
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
              {/* Live gaming streams ticker items */}
              {liveGamingStreams.map((stream) => (
                <span key={`live-${stream.id}`} className="rainbow-ticker__item" style={{ color: '#06b6d4' }}>
                  <Radio className="h-3 w-3" /> {stream.broadcaster_name} is live playing {stream.game_title || 'a game'}
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="rainbow-glow-border rainbow-top-glow mb-3 rounded-3xl border border-cyan-400/10 bg-[#050816]/95 p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="rainbow-text-shimmer text-xl font-black tracking-tight">
              Troll Wall
            </h2>
            <p className="mt-1 text-xs text-cyan-100/70">
              The live social pulse of Troll City.
            </p>
          </div>

          <div className="hidden rounded-2xl border border-pink-300/20 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200 sm:flex sm:items-center sm:gap-1.5">
            <Radio className="h-3 w-3 text-pink-300" />
            <span className="rainbow-text-shimmer">Live Feed</span>
          </div>
        </div>
        </div>

        <div className={cn("rounded-3xl border border-cyan-400/10 bg-[#050816]/95 p-2 sm:p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]", feedClassName)}>
          <CreatePostComposer
            onPostCreated={handlePostCreated}
            onRequireAuth={onRequireAuth}
          />
        </div>

        <div className={cn("rainbow-scrollbar w-full", !isPwa && "h-[60vh] sm:h-[80vh] overflow-auto")}>
        {loading && posts.length === 0 ? (
          <div className="rounded-3xl border border-cyan-400/10 bg-[#050816]/80 py-10 text-center text-white/50">
            Loading Wall...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-cyan-400/10 bg-[#050816]/80 p-10 text-center text-white/50">
            <MessageSquare className="mx-auto mb-3 h-8 w-8" />
            <p>No posts yet. Start the conversation.</p>
          </div>
        ) : (
          <Virtuoso
            useWindowScroll={true}
            style={!isPwa ? { height: '100%' } : undefined}
            data={posts}
            itemContent={renderPost}
            endReached={() => {
              if (hasMore && !loadingMore) {
                const nextPage = page + 1
                setPage(nextPage)
                loadPosts(nextPage, true)
              }
            }}
            components={{
              Footer: () =>
                loadingMore ? (
                  <div className="py-4 text-center text-xs">
                    <span className="rainbow-text-shimmer font-bold">Loading more city posts...</span>
                  </div>
                ) : (
                  <div className="h-3" />
                ),
            }}
            increaseViewportBy={300}
          />
        )}
      </div>

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

      {lightboxImage &&
        createPortal(
          <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-out ${
              lightboxVisible ? 'bg-black/85' : 'bg-black/0'
            }`}
            onClick={closeLightbox}
          >
            <div
              className={`relative max-h-[95vh] max-w-[95vw] overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#050816]/95 shadow-[0_0_60px_rgba(34,211,238,0.2)] transition-all duration-300 ease-out ${
                lightboxVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-slate-950/90 p-2 text-white transition hover:bg-slate-800"
                onClick={closeLightbox}
                aria-label="Close image preview"
              >
                <X className="h-4 w-4" />
              </button>

              <img
                src={lightboxImage}
                alt={lightboxTitle || 'Preview'}
                className="max-h-[90vh] w-auto object-contain"
              />

              {lightboxTitle && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/75 p-3 text-sm text-white">
                  {lightboxTitle}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {sharingPost && (
        <WallShareModal
          isOpen={!!sharingPost}
          onClose={() => setSharingPost(null)}
          post={sharingPost}
          postUrl={`${window.location.origin}/wall/${sharingPost.id}`}
          onShare={(postId) => {
            if (!user?.id) return
            supabase
              .from('troll_wall_post_shares')
              .insert({ post_id: postId, user_id: user.id })
              .then(({ error }) => {
                if (error) console.warn('Failed to record share:', error)
              })
              .catch((err) => console.warn('Failed to record share:', err))
          }}
        />
      )}
    </div>
  )
}