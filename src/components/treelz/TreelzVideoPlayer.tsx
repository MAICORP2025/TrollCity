import React, { useEffect, useRef, useState, useCallback, memo } from 'react'
import { MessageCircle, Share2, Bookmark, Gift, MoreHorizontal, Volume2, VolumeX, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Swipeable } from 'react-swipeable'
import { supabase } from '@/lib/supabase'
import type { TreelzPost, TreelzComment } from '@/types/treelz'
import {
  toggleTreelzTroll,
  toggleTreelzSave,
  fetchTreelzComments,
  addTreelzComment,
  sendTreelzTip,
  recordTreelzShare,
  recordTreelzView,
} from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface TreelzVideoPlayerProps {
  post: TreelzPost
  isActive: boolean
  autoPlay: boolean
  onView?: (watchSeconds: number, completed: boolean) => void
}

export function TreelzVideoPlayer({ post, isActive, autoPlay, onView }: TreelzVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [showHeart, setShowHeart] = useState(false)
  const [duration, setDuration] = useState(0)
  const viewStartRef = useRef<number>(0)
  const viewRecordedRef = useRef(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const video = videoRef.current
    const bar = progressBarRef.current
    if (!video) return
    if (video.src !== post.video_url) {
      video.src = post.video_url
      video.load()
    }
    if (bar) bar.style.width = '0%'
    setIsPlaying(false)
    setDuration(0)
  }, [post.id, post.video_url])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isActive && autoPlay) {
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [isActive, autoPlay])

  useEffect(() => {
    if (isActive) {
      viewStartRef.current = Date.now()
      viewRecordedRef.current = false
    } else if (!viewRecordedRef.current && viewStartRef.current > 0) {
      const watchSeconds = Math.round((Date.now() - viewStartRef.current) / 1000)
      if (watchSeconds > 0) {
        onView?.(watchSeconds, false)
      }
      viewRecordedRef.current = true
    }
  }, [isActive, onView])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    const bar = progressBarRef.current
    if (!video || !bar || !video.duration) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const pct = (video.currentTime / video.duration) * 100
      bar.style.width = `${pct}%`
    })
  }, [])

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleEnded = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.duration) {
      onView?.(Math.round(video.currentTime), true)
    }
  }, [onView])

  const handleTap = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }, [isPlaying])

  const handleDoubleTap = useCallback(async () => {
    setShowHeart(true)
    setTimeout(() => setShowHeart(false), 800)
    const { user } = useAuthStore.getState()
    if (!user) return
    try {
      await toggleTreelzTroll(user.id, post.id)
    } catch { /* ignore */ }
  }, [post.id])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || !video.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    video.currentTime = pct * video.duration
  }, [])

  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const handleClick = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 250) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
      lastTapRef.current = 0
      handleDoubleTap()
    } else {
      lastTapRef.current = now
      tapTimeoutRef.current = setTimeout(() => {
        if (Date.now() - lastTapRef.current >= 250) {
          handleTap()
        }
      }, 250)
    }
  }, [handleTap, handleDoubleTap])

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
    }
  }, [])

  return (
    <div className="relative h-full w-full bg-black" onClick={handleClick}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration)
        }}
        onEnded={handleEnded}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

      {showHeart && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="animate-[heartPop_0.8s_ease-out] text-6xl drop-shadow-[0_0_30px_rgba(34,211,238,0.7)]">
            🤡
          </span>
        </div>
      )}

      {!isPlaying && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
            <Play className="h-8 w-8 text-white" fill="white" />
          </div>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); toggleMute() }}
        className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      {post.is_live_promotion && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1 text-xs font-black text-white backdrop-blur-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          LIVE
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-16 z-10 p-4">
        <div className="mb-2 flex items-center gap-2">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-xs font-black text-white ring-2 ring-white/30">
              {post.author?.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <Link
            to={`/profile/${post.author?.username || ''}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-black text-white drop-shadow-lg hover:underline"
          >
            @{post.author?.username || 'unknown'}
          </Link>
        </div>
        <p className="text-xs font-medium text-white/90 drop-shadow-lg line-clamp-2">
          {post.caption || ''}
        </p>
        {post.video_duration_seconds > 0 && (
          <span className="mt-1 inline-block text-[10px] font-bold text-white/60">
            {formatDuration(post.video_duration_seconds)}
          </span>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-20 h-1 cursor-pointer bg-white/10"
        onClick={(e) => { e.stopPropagation(); handleProgressClick(e) }}
      >
        <div ref={progressBarRef} className="h-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{ width: '0%' }} />
      </div>
    </div>
  )
}

interface TreelzActionsProps {
  post: TreelzPost
  onCommentClick: () => void
  onShare: () => void
  onTip: () => void
  onMore: () => void
}

export const TreelzActions = memo(function TreelzActions({ post, onCommentClick, onShare, onTip, onMore }: TreelzActionsProps) {
  const { user } = useAuthStore()
  const [trolled, setTrolled] = useState(post.user_interaction?.liked || false)
  const [saved, setSaved] = useState(post.user_interaction?.saved || false)
  const [trollCount, setTrollCount] = useState(post.likes_count || 0)
  const [shareCount, setShareCount] = useState(post.shares_count || 0)

  const handleTroll = async () => {
    if (!user) { toast.info('Sign in to troll'); return }
    try {
      const liked = await toggleTreelzTroll(user.id, post.id)
      setTrolled(liked)
      setTrollCount((c) => liked ? c + 1 : c - 1)
    } catch { /* ignore */ }
  }

  const handleSave = async () => {
    if (!user) { toast.info('Sign in to save'); return }
    try {
      const isSaved = await toggleTreelzSave(user.id, post.id)
      setSaved(isSaved)
    } catch { /* ignore */ }
  }

  const handleShareClick = () => {
    setShareCount((c) => c + 1)
    onShare()
  }

  return (
    <div className="absolute bottom-24 right-2 z-20 flex flex-col items-center gap-5">
      <button onClick={(e) => { e.stopPropagation(); handleTroll() }} className="group flex flex-col items-center gap-1 border-none bg-transparent p-0">
        <span className={`text-3xl transition-transform ${trolled ? 'scale-110 drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]' : 'drop-shadow-lg'}`}>🤡</span>
        <span className={`text-[11px] font-bold drop-shadow ${trolled ? 'text-red-400' : 'text-white/90'}`}>{formatCount(trollCount)}</span>
      </button>

      <button onClick={(e) => { e.stopPropagation(); onCommentClick() }} className="group flex flex-col items-center gap-1 border-none bg-transparent p-0">
        <MessageCircle className="h-7 w-7 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold text-white/90 drop-shadow">{formatCount(post.comments_count || 0)}</span>
      </button>

      <button onClick={(e) => { e.stopPropagation(); handleShareClick() }} className="group flex flex-col items-center gap-1 border-none bg-transparent p-0">
        <Share2 className="h-7 w-7 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold text-white/90 drop-shadow">{formatCount(shareCount)}</span>
      </button>

      <button onClick={(e) => { e.stopPropagation(); onTip() }} className="group flex flex-col items-center gap-1 border-none bg-transparent p-0">
        <Gift className="h-7 w-7 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold text-white/90 drop-shadow">{formatCount(post.gifts_received || 0)}</span>
      </button>

      <button onClick={(e) => { e.stopPropagation(); handleSave() }} className="group flex flex-col items-center gap-1 border-none bg-transparent p-0">
        <Bookmark className={`h-7 w-7 drop-shadow-lg group-hover:scale-110 transition-transform ${saved ? 'text-yellow-400 fill-yellow-400' : 'text-white'}`} />
        <span className={`text-[11px] font-bold drop-shadow ${saved ? 'text-yellow-400' : 'text-white/90'}`}>{formatCount(post.saves_count || 0)}</span>
      </button>

      <button onClick={(e) => { e.stopPropagation(); onMore() }} className="group flex flex-col items-center gap-1 border-none bg-transparent p-0">
        <MoreHorizontal className="h-7 w-7 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
      </button>
    </div>
  )
})

interface CommentSheetProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
}

export function CommentSheet({ post, isOpen, onClose }: CommentSheetProps) {
  const { user } = useAuthStore()
  const [comments, setComments] = useState<TreelzComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      fetchTreelzComments(post.id).then(setComments).catch(() => {}).finally(() => setLoading(false))
    }
  }, [isOpen, post.id])

  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return
    try {
      await addTreelzComment(user.id, post.id, newComment)
      setNewComment('')
      const updated = await fetchTreelzComments(post.id)
      setComments(updated)
    } catch { /* ignore */ }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-t-3xl border-t border-white/10 bg-[#0a0d1f]/95 backdrop-blur-2xl"
        style={{ maxHeight: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="text-sm font-black text-white">Comments ({comments.length})</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: 'calc(70vh - 120px)' }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  {c.author?.avatar_url ? (
                    <img src={c.author.avatar_url} alt="" className="h-6 w-6 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-[8px] font-black text-white">
                      {c.author?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold text-cyan-400">@{c.author?.username || 'unknown'}</span>
                    <p className="text-xs text-white/80">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Add a comment..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
            />
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim()}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-xs font-black text-white transition hover:opacity-80 disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TipModalProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
}

export function TipModal({ post, isOpen, onClose }: TipModalProps) {
  const { user } = useAuthStore()
  const amounts = [10, 50, 100, 500]
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)

  const handleTip = async (amount: number) => {
    if (!user) return
    setSending(true)
    try {
      await sendTreelzTip(user.id, post.user_id, post.id, amount)
      toast.success(`Tipped ${amount} coins!`)
      onClose()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send tip')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0a0d1f]/95 p-6 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-center text-lg font-black text-white">Send Tip</h3>
        <p className="mb-4 text-center text-xs text-slate-400">
          to @{post.author?.username || 'creator'}
        </p>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {amounts.map((amt) => (
            <button
              key={amt}
              onClick={() => handleTip(amt)}
              disabled={sending}
              className="rounded-xl border border-white/10 bg-white/5 py-3 text-center text-sm font-black text-white transition hover:border-yellow-400/40 hover:bg-yellow-400/10 disabled:opacity-40"
            >
              {amt}
              <span className="ml-0.5 text-[9px] text-yellow-400">🪙</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
            placeholder="Custom amount"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/40"
          />
          <button
            onClick={() => handleTip(Number(custom))}
            disabled={!custom || sending}
            className="rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 text-xs font-black text-white transition hover:opacity-80 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

interface ShareModalProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
}

export function ShareModal({ post, isOpen, onClose }: ShareModalProps) {
  const { user } = useAuthStore()
  const [sharing, setSharing] = useState(false)

  const handleShare = async (platform: string) => {
    if (user) {
      await recordTreelzShare(user.id, post.id, platform).catch(() => {})
    }
    if (platform === 'copy') {
      navigator.clipboard.writeText(`${window.location.origin}/treelz?post=${post.id}`).then(() => {
        toast.success('Link copied!')
      }).catch(() => {})
    } else if (platform === 'download') {
      if (user) {
        const { downloadTreelzVideo } = await import('@/services/treelzService')
        try {
          await downloadTreelzVideo(user.id, post.id, post.video_url)
          toast.success('Download started! (-10 coins)')
        } catch (err: any) {
          toast.error(err?.message || 'Download failed')
        }
      } else {
        window.open(post.video_url, '_blank')
      }
    } else if (platform === 'trollwall') {
      if (!user) { toast.info('Sign in to share to TrollWall'); return }
      setSharing(true)
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', user.id)
          .single()

        const username = profile?.username || 'unknown'
        const shareText = `🎬 @${username} shared a Treelz: ${post.caption || 'Check out this video!'}`

        const { error } = await supabase
          .from('troll_wall_posts')
          .insert({
            user_id: user.id,
            post_type: 'text',
            content: shareText,
            metadata: {
              video_url: post.video_url,
              thumbnail_url: post.thumbnail_url,
              treelz_post_id: post.id,
              type: 'treelz_share',
            },
          })

        if (error) throw error
        toast.success('Shared to TrollWall!')
      } catch (err: any) {
        toast.error(err?.message || 'Failed to share to TrollWall')
      } finally {
        setSharing(false)
      }
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0a0d1f]/95 p-6 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-center text-sm font-black text-white">Share</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'copy', label: 'Copy Link', icon: '🔗' },
            { key: 'download', label: 'Save', icon: '⬇️' },
            { key: 'trollwall', label: 'TrollWall', icon: '📝' },
            { key: 'messages', label: 'Message', icon: '💬' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => handleShare(item.key)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-bold text-slate-300">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface MoreModalProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
  onDisableUploads?: () => void
  onReport?: () => void
  onDownload?: () => void
}

export function MoreModal({ post, isOpen, onClose, onDisableUploads, onReport, onDownload }: MoreModalProps) {
  const { user, profile } = useAuthStore()
  const isMod = profile?.is_admin || profile?.is_troll_officer

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-[#0a0d1f]/95 p-2 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-0.5">
          <button
            onClick={() => { onDownload?.(); onClose() }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-xs font-bold text-white transition hover:bg-white/10"
          >
            <span className="text-sm">⬇️</span> Download Video
            <span className="ml-auto rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-black text-yellow-400">10 🪙</span>
          </button>
          <button
            onClick={() => { onReport?.(); onClose() }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-xs font-bold text-white transition hover:bg-white/10"
          >
            <span className="text-sm">🚫</span> Report
          </button>
          {isMod && (
            <>
              <div className="my-1 border-t border-white/10" />
              <button
                onClick={() => { onDisableUploads?.(); onClose() }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-xs font-bold text-red-400 transition hover:bg-red-500/10"
              >
                <span className="text-sm">🔇</span> Disable Uploads
              </button>
              <button
                onClick={() => { onClose() }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-xs font-bold text-yellow-400 transition hover:bg-yellow-500/10"
              >
                <span className="text-sm">⭐</span> Feature Reel
              </button>
              <button
                onClick={() => { onClose() }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/10"
              >
                <span className="text-sm">📌</span> Pin Reel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
