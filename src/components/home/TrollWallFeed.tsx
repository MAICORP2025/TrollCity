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
  Radio,
  Sparkles,
  Flame,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Virtuoso } from 'react-virtuoso'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { WallPost } from '@/types/trollWall'
import UserNameWithAge from '@/components/UserNameWithAge'
import NeonGlowUsername from '@/components/NeonGlowUsername'
import CreatePostComposer from './CreatePostComposer'
import { parseTextWithLinks } from '@/lib/utils'

const UserProfilePopup = lazy(() => import('@/components/UserProfilePopup'))
const MentionTextarea = lazy(() => import('@/components/MentionTextarea'))

interface TrollWallFeedProps {
  onRequireAuth: (intent?: string) => boolean
}

const PAGE_SIZE = 10

export default function TrollWallFeed({ onRequireAuth }: TrollWallFeedProps) {
  const { user, isAdmin } = useAuthStore()
  const isMountedRef = useRef(true)
  const latestRequestId = useRef(0)

  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [lightboxTitle, setLightboxTitle] = useState<string | null>(null)
  const [lightboxVisible, setLightboxVisible] = useState(false)

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
        const start = pageIndex * PAGE_SIZE
        const end = start + PAGE_SIZE - 1

        const { data, error } = await supabase
          .from('troll_wall_posts')
          .select(
            '*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, role, is_verified, is_gold, username_style, badge, empire_role, officer_level, troller_level, is_troller, rgb_username_expires_at, glowing_username_color)'
          )
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .range(start, end)

        if (error) throw error
        if (!isActiveRequest()) return

        const rows = (data as any[]) || []
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
            user_role: author.role,
            is_verified: author.is_verified,
            is_gold: author.is_gold,
            username_style: author.username_style,
            badge: author.badge,
            empire_role: author.empire_role,
            officer_level: author.officer_level,
            troller_level: author.troller_level,
            is_troller: author.is_troller,
            rgb_username_expires_at: author.rgb_username_expires_at,
            glowing_username_color: author.glowing_username_color,
          } as WallPost
        })

        const parentPosts = normalized.filter((post: WallPost) => !post.reply_to_post_id)
        const replies = normalized.filter((post: WallPost) => post.reply_to_post_id)

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

        const postsWithReplies = parentPosts.map((post: WallPost) => ({
          ...post,
          replies: repliesMap[post.id] || [],
        })) as WallPost[]

        if (!isActiveRequest()) return

        setPosts((prev) => (append ? [...prev, ...postsWithReplies] : postsWithReplies))
        setHasMore(rows.length === PAGE_SIZE)
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
    [user]
  )

  useEffect(() => {
    isMountedRef.current = true
    loadPosts(0, false)

    return () => {
      isMountedRef.current = false
    }
  }, [loadPosts])

  const handlePostCreated = useCallback((post: WallPost) => {
    setPosts((prev) => [post, ...prev])
  }, [])

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
          <article className="group relative overflow-hidden rounded-3xl border border-cyan-400/10 bg-[#050816]/90 p-4 shadow-[0_0_25px_rgba(34,211,238,0.08)] transition-all duration-300 hover:border-cyan-300/25 hover:shadow-[0_0_45px_rgba(34,211,238,0.18)]">
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
                      {post.username ? (
                        <NeonGlowUsername
                          username={post.username}
                          avatarUrl={post.avatar_url}
                          profile={{
                            is_admin: post.is_admin,
                            is_troll_officer: post.is_troll_officer,
                            is_og_user: post.is_og_user,
                            is_verified: post.user_verified,
                            is_gold: post.user_is_gold,
                            role: post.user_role,
                            officer_level: post.officer_level,
                            troller_level: post.troller_level,
                            is_troller: post.is_troller,
                            username_style: post.username_style,
                            badge: post.badge,
                            empire_role: post.empire_role,
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

                      {post.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300/20 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-yellow-300">
                          <Pin className="h-2.5 w-2.5 fill-current" />
                          City Pinned
                        </span>
                      )}

                      {isTrending && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-pink-300/20 bg-pink-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-pink-300">
                          <Flame className="h-2.5 w-2.5" />
                          Trending
                        </span>
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
              </div>

              {post.reply_to_post_id && (
                <p className="mt-2 rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-bold text-purple-300">
                  Replying to a post
                </p>
              )}

              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/90">
                {parseTextWithLinks(post.content)}
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
          </article>
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
    ]
  )

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 rounded-3xl border border-cyan-400/10 bg-[#050816]/95 p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Troll Wall
            </h2>
            <p className="mt-1 text-xs text-cyan-100/70">
              The live social pulse of Troll City.
            </p>
          </div>

          <div className="hidden rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200 sm:flex sm:items-center sm:gap-1.5">
            <Radio className="h-3 w-3" />
            Live Feed
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
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
            style={{ height: '100%' }}
            data={posts}
            itemContent={renderPost}
            endReached={() => {
              if (hasMore && !loadingMore && user?.id) {
                const nextPage = page + 1
                setPage(nextPage)
                loadPosts(nextPage, true)
              }
            }}
            components={{
              Footer: () =>
                loadingMore ? (
                  <div className="py-4 text-center text-xs text-cyan-100/60">
                    Loading more city posts...
                  </div>
                ) : (
                  <div className="h-3" />
                ),
            }}
            increaseViewportBy={300}
          />
        )}
      </div>

      <div className="mt-2 flex-shrink-0 border-t border-white/10 pt-2">
        <div className="rounded-3xl border border-cyan-400/10 bg-[#050816]/95 p-2 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
          <CreatePostComposer
            onPostCreated={handlePostCreated}
            onRequireAuth={onRequireAuth}
          />
        </div>
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
    </div>
  )
}