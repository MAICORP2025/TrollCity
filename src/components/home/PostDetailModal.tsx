import React, { useEffect, useState, useCallback } from 'react'
import { X, Heart, MessageSquare, Share2, Clock, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { WallPost } from '@/types/trollWall'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PostDetailModalProps {
  post: WallPost | null
  isOpen: boolean
  onClose: () => void
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PostDetailModal({ post, isOpen, onClose }: PostDetailModalProps) {
  const { user } = useAuthStore()
  const [fullPost, setFullPost] = useState<WallPost | null>(null)
  const [loading, setLoading] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  const fetchPost = useCallback(async () => {
    if (!post) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('troll_wall_posts')
        .select('*')
        .eq('id', post.id)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setFullPost({
          ...data,
          replies: data.replies || [],
        })
        setLikeCount(data.likes || 0)
        if (user?.id) {
          const { data: likeData } = await supabase
            .from('troll_wall_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .maybeSingle()
          setLiked(!!likeData)
        }
      }
    } catch {
      setFullPost(post)
      setLikeCount(post.likes || 0)
    } finally {
      setLoading(false)
    }
  }, [post, user?.id])

  useEffect(() => {
    if (isOpen && post) {
      fetchPost()
    } else {
      setFullPost(null)
      setLiked(false)
      setLikeCount(0)
    }
  }, [isOpen, post, fetchPost])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen || !post) return false

  const displayPost = fullPost || post
  const preview = displayPost.content
    ? displayPost.content.split(/\s+/).slice(0, 10).join(' ') + (displayPost.content.split(/\s+/).length > 10 ? '…' : '')
    : ''

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={cn(
        'relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e1e]/95 backdrop-blur-2xl shadow-2xl'
      )}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={16} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        ) : (
          <div className="p-5">
            {/* User header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/10 flex-shrink-0">
                {displayPost.avatar_url ? (
                  <img src={displayPost.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {(displayPost.username || '?')[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white truncate">{displayPost.username}</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Clock className="w-3 h-3" />
                  {timeAgo(displayPost.created_at)}
                </div>
              </div>
            </div>

            {/* Image preview */}
            {(displayPost.metadata?.thumbnail_url || displayPost.metadata?.image_url) && (
              <div className="relative aspect-video rounded-xl overflow-hidden mb-4 border border-white/5">
                <img
                  src={displayPost.metadata.thumbnail_url || displayPost.metadata.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap mb-4">
              {displayPost.content}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-3 border-t border-white/5">
              <button
                onClick={async () => {
                  if (!user) { toast.info('Sign in to like posts'); return }
                  setLiked(!liked)
                  setLikeCount(prev => liked ? prev - 1 : prev + 1)
                }}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-bold transition-colors',
                  liked ? 'text-pink-400' : 'text-slate-400 hover:text-pink-300'
                )}
              >
                <Heart className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} />
                {likeCount}
              </button>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <MessageSquare className="w-4 h-4" />
                {displayPost.replies?.length || 0}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/wall-post/${displayPost.id}`)
                  toast.success('Link copied!')
                }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors ml-auto"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <a
                href={`/wall-post/${displayPost.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
