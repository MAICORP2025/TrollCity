import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Sparkles, Eye, MessageCircle,
  Share2, Bookmark, Gift, Play, Upload, Search,
} from 'lucide-react'
import { TreelzVideoPlayer, TreelzActions, CommentSheet, TipModal, ShareModal, MoreModal } from '@/components/treelz/TreelzVideoPlayer'
import {
  fetchTreelzFeed, fetchTrendingTreelz, recordTreelzView,
  loadTreelzSettings, fetchTreelzProfile, reportTreelzPost,
  downloadTreelzVideo,
} from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'
import type { TreelzPost, TreelzFeedCursor } from '@/types/treelz'

type FeedMode = 'discover' | 'following' | 'trending' | 'most-trolled' | 'most-gifted' | 'profile'

const CATEGORIES = [
  { key: 'discover', label: 'Discover', icon: '✨' },
  { key: 'trending', label: 'Trending', icon: '🔥' },
  { key: 'most-trolled', label: 'Most Trolled', icon: '🤡' },
  { key: 'most-gifted', label: 'Most Gifted', icon: '🎁' },
  { key: 'following', label: 'Following', icon: '👥' },
]

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function TreelzPage() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialPostId = searchParams.get('post')

  const [posts, setPosts] = useState<TreelzPost[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<TreelzFeedCursor | null>(null)
  const [loading, setLoading] = useState(true)
   const [showComments, setShowComments] = useState(false)
   const [showTip, setShowTip] = useState(false)
   const [showShare, setShowShare] = useState(false)
   const [showMore, setShowMore] = useState(false)
  const [settings] = useState(loadTreelzSettings())
  const [activeCategory, setActiveCategory] = useState<string>('discover')
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  const loadFeed = useCallback(async (category?: string, profileId?: string | null) => {
    setLoading(true)
    try {
      let result: { posts: TreelzPost[]; nextCursor: TreelzFeedCursor | null }
      const cat = category || activeCategory

      if (profileId) {
        const profilePosts = await fetchTreelzProfile(user?.id || null, profileId)
        result = { posts: profilePosts, nextCursor: null }
      } else if (cat === 'trending') {
        const trending = await fetchTrendingTreelz(20)
        result = { posts: trending, nextCursor: null }
      } else {
        result = await fetchTreelzFeed(user?.id || null, null)
      }

      setPosts(result.posts)
      setNextCursor(result.nextCursor)

      if (initialPostId) {
        const idx = result.posts.findIndex((p) => p.id === initialPostId)
        if (idx >= 0) setCurrentIndex(idx)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [user?.id, initialPostId, activeCategory])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return
    try {
      const result = await fetchTreelzFeed(user?.id || null, nextCursor)
      setPosts((prev) => [...prev, ...result.posts])
      setNextCursor(result.nextCursor)
    } catch { /* ignore */ }
  }, [nextCursor, loading, user?.id])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  const switchCategory = useCallback((cat: string) => {
    setActiveCategory(cat)
    setCurrentIndex(0)
    setProfileUserId(null)
    setSearchParams({})
    loadFeed(cat)
  }, [loadFeed, setSearchParams])

  const openPost = useCallback((postId: string) => {
    const idx = posts.findIndex((p) => p.id === postId)
    if (idx >= 0) {
      setCurrentIndex(idx)
      setSearchParams({ post: postId })
    }
  }, [posts, setSearchParams])

  const goNext = useCallback(() => {
    if (currentIndex < posts.length - 1) {
      setCurrentIndex((i) => i + 1)
      if (currentIndex >= posts.length - 3) loadMore()
    }
  }, [currentIndex, posts.length, loadMore])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }, [currentIndex])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  const handleView = useCallback((postId: string, watchSeconds: number, completed: boolean) => {
    recordTreelzView(postId, watchSeconds, completed).catch(() => {})
  }, [])

  const currentPost = posts[currentIndex]
  const prevPost = currentIndex > 0 ? posts[currentIndex - 1] : null
  const nextPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null
  const preloadRef1 = useRef<HTMLVideoElement>(null)
  const preloadRef2 = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (prevPost && preloadRef1.current) {
      preloadRef1.current.src = prevPost.video_url
      preloadRef1.current.load()
    }
  }, [prevPost?.video_url])

  useEffect(() => {
    if (nextPost && preloadRef2.current) {
      preloadRef2.current.src = nextPost.video_url
      preloadRef2.current.load()
    }
  }, [nextPost?.video_url])

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-full flex-col bg-[#050715] overflow-hidden" style={{ overflow: 'hidden' }}>
      {/* ─── HEADER ─── */}
      <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#050715]/95 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-white transition hover:text-cyan-400">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-black tracking-tight">Treelz</span>
          </Link>
        </div>

        {/* Category tabs */}
        <nav className="hidden items-center gap-1 md:flex">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => switchCategory(cat.key)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeCategory === cat.key && !profileUserId
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-xs">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/treelz/search"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Search size={16} />
          </Link>
          {user ? (
            <Link
              to="/treelz/upload"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-cyan-500/20 transition hover:shadow-cyan-500/40"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Upload</span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Mobile category scroll */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/5 bg-[#050715]/80 px-3 py-2 scrollbar-hide md:hidden">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => switchCategory(cat.key)}
            className={`flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition ${
              activeCategory === cat.key && !profileUserId
                ? 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

       {/* ─── MAIN CONTENT ─── */}
       <div className="relative flex flex-1 overflow-hidden">
        {/* Back button — top left, always visible */}
        <Link
          to="/"
          className="absolute top-2 left-3 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 hover:text-cyan-400"
          aria-label="Back to home"
        >
          <ArrowLeft size={16} />
        </Link>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex h-full w-full max-w-[480px] flex-col items-center justify-center gap-4 bg-black/40">
              <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
              <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
              <div className="h-2 w-24 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        ) : posts.length === 0 ? (
          /* ─── EMPTY STATE: Browse categories grid ─── */
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="w-full max-w-lg text-center">
              <Sparkles className="mx-auto mb-4 h-10 w-10 text-cyan-400/60" />
              <h2 className="mb-1 text-base font-black text-white">
                {profileUserId ? 'No Treelz Yet' : 'Explore Treelz'}
              </h2>
              <p className="mb-5 text-xs text-slate-400">
                {profileUserId
                  ? 'This creator hasn\'t uploaded any Treelz yet.'
                  : 'Watch, troll, and share short videos from the community.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.filter((c) => c.key !== 'following').map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => switchCategory(cat.key)}
                    className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <div>
                      <p className="text-xs font-black text-white">{cat.label}</p>
                      <p className="text-[9px] text-slate-500">Browse videos</p>
                    </div>
                  </button>
                ))}
              </div>
              {user ? (
                <Link
                  to="/treelz/upload"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-5 py-2.5 text-xs font-black text-white"
                >
                  <Upload size={14} />
                  Upload Your First Treelz
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-slate-300"
                >
                  Sign In to Upload
                </Link>
              )}
            </div>
          </div>
        ) : (
          /* ─── VIDEO FEED ─── */
          <>
            {/* Main video area */}
            <div className="relative flex flex-1 items-center justify-center">
              {/* Navigation arrows */}
              {currentIndex > 0 && (
                <button
                  onClick={goPrev}
                  className="absolute left-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              {currentIndex < posts.length - 1 && (
                <button
                  onClick={goNext}
                  className="absolute right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <ArrowRight size={18} />
                </button>
              )}

              {/* Video container */}
              <div className="relative h-full w-full max-w-[480px]">
                {currentPost && (
                  <TreelzVideoPlayer
                    post={currentPost}
                    isActive={true}
                    autoPlay={settings.autoPlayEnabled}
                    onView={(sec, completed) => handleView(currentPost.id, sec, completed)}
                  />
                )}
                <video ref={preloadRef1} className="hidden" muted playsInline preload="auto" />
                <video ref={preloadRef2} className="hidden" muted playsInline preload="auto" />
              </div>

               {/* Left side: Chat/Comment button */}
               {currentPost && (
                 <div className="absolute left-0 top-1/2 z-20 -translate-y-1/2 xl:left-2">
                   <button
                     onClick={() => setShowComments(true)}
                     className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                   >
                     <MessageCircle size={20} />
                   </button>
                 </div>
               )}

               {/* Right side: Action buttons */}
               {currentPost && (
                 <div className="pointer-events-none absolute bottom-0 right-0 left-1/2" style={{ maxWidth: 480 }}>
                   <div className="pointer-events-auto">
                     <TreelzActions
                       post={currentPost}
                       onCommentClick={() => setShowComments(true)}
                       onShare={() => setShowShare(true)}
                       onTip={() => setShowTip(true)}
                       onMore={() => setShowMore(true)}
                     />
                   </div>
                 </div>
               )}
            </div>

            {/* Right sidebar — desktop only */}
            <div className="hidden w-72 flex-col border-l border-white/10 bg-[#070b19]/80 xl:flex 2xl:w-80">
              {/* Current post info */}
              {currentPost && (
                <div className="border-b border-white/10 p-4">
                  <button
                    onClick={() => {
                      if (currentPost.author) {
                        setProfileUserId(currentPost.author.id)
                        setCurrentIndex(0)
                        fetchTreelzProfile(user?.id || null, currentPost.author.id).then((p) => {
                          setPosts(p)
                          setNextCursor(null)
                        }).catch(() => {})
                      }
                    }}
                    className="flex items-center gap-2 text-left transition hover:opacity-80"
                  >
                    {currentPost.author?.avatar_url ? (
                      <img src={currentPost.author.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-cyan-400/30" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-xs font-black text-white">
                        {currentPost.author?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-white">@{currentPost.author?.username || 'unknown'}</p>
                      <p className="text-[10px] text-slate-500">{currentPost.author?.display_name || ''}</p>
                    </div>
                  </button>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300 line-clamp-3">{currentPost.caption || 'No caption'}</p>
                  <div className="mt-3 flex items-center gap-3 text-[10px] font-bold text-slate-400">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatCount(currentPost.views_count || 0)}</span>
                    <span className="flex items-center gap-1">🤡 {formatCount(currentPost.likes_count || 0)}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {formatCount(currentPost.comments_count || 0)}</span>
                    <span className="flex items-center gap-1"><Gift className="h-3 w-3 text-yellow-400" /> {formatCount(currentPost.gifts_received || 0)}</span>
                  </div>
                </div>
              )}

              {/* Up next */}
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Up Next</h3>
                <div className="space-y-2">
                  {posts.slice(currentIndex + 1, currentIndex + 8).map((post) => (
                    <button
                      key={post.id}
                      onClick={() => openPost(post.id)}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
                    >
                      <div className="relative h-14 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-black/40">
                        {post.thumbnail_url ? (
                          <img src={post.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Play className="h-3 w-3 text-white/40" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-bold text-white/80">{post.caption || 'Untitled'}</p>
                        <p className="text-[9px] text-slate-500">@{post.author?.username || 'unknown'}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-[8px] text-slate-600">
                          <span>🤡 {formatCount(post.likes_count || 0)}</span>
                          <span>👁 {formatCount(post.views_count || 0)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {currentPost && (
        <>
          <CommentSheet post={currentPost} isOpen={showComments} onClose={() => setShowComments(false)} />
          <TipModal post={currentPost} isOpen={showTip} onClose={() => setShowTip(false)} />
          <ShareModal post={currentPost} isOpen={showShare} onClose={() => setShowShare(false)} />
          <MoreModal
            post={currentPost}
            isOpen={showMore}
            onClose={() => setShowMore(false)}
            onReport={() => {
              if (!user) { toast.info('Sign in to report'); return }
              reportTreelzPost(user.id, currentPost.id, 'reported_from_treelz')
                .then(() => toast.success('Report submitted'))
                .catch(() => toast.error('Failed to report'))
            }}
            onDownload={() => {
              if (!user) { toast.info('Sign in to download'); return }
              downloadTreelzVideo(user.id, currentPost.id, currentPost.video_url)
                .then(() => toast.success('Download started! (-10 coins)'))
                .catch((err: any) => toast.error(err?.message || 'Download failed'))
            }}
          />
        </>
      )}
    </div>
  )
}
