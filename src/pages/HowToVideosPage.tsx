import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { HowToVideo } from '../types/howToVideos'
import HowToVideoAdmin from '../components/HowToVideoAdmin'
import HowToVideoUpload from '../components/HowToVideoUpload'
import { PlayCircle, Plus, X, Loader2, Trash2, Settings, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

function isAdminOrCEO(profile: any): boolean {
  if (!profile) return false
  return (
    profile.role === 'admin' ||
    profile.role === 'ceo' ||
    profile.is_admin === true ||
    profile.troll_role === 'admin' ||
    profile.troll_role === 'ceo'
  )
}

type PlayerState = { video: HowToVideo; url: string | null; thumbnailUrl: string | null }

export default function HowToVideosPage() {
  const { profile } = useAuthStore()
  const admin = isAdminOrCEO(profile)

  const [videos, setVideos] = useState<HowToVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [player, setPlayer] = useState<PlayerState | null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const base = supabase.from('how_to_videos').select('*')
      if (admin) {
        base.order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      } else {
        base
          .eq('is_published', true)
          .order('sort_order', { ascending: true })
      }
      const { data, error } = await base
      if (error) throw error
      setVideos((data as HowToVideo[]) || [])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [admin])

  useEffect(() => {
    load()
  }, [load])

  const openPlayer = async (video: HowToVideo) => {
    setPlayer({ video, url: null, thumbnailUrl: null })
    setPlayerLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-how-to-video-url', {
        body: { videoId: video.id },
      })
      if (error || !data?.url) {
        toast.error(data?.error || error?.message || 'Could not load video')
        setPlayer(null)
        return
      }
      setPlayer({ video, url: data.url, thumbnailUrl: data.thumbnailUrl || null })
    } catch (err: any) {
      toast.error(err?.message || 'Could not load video')
      setPlayer(null)
    } finally {
      setPlayerLoading(false)
    }
  }

  const togglePublish = async (video: HowToVideo) => {
    const next = !video.is_published
    setVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, is_published: next } : v)))
    const { error } = await supabase
      .from('how_to_videos')
      .update({ is_published: next })
      .eq('id', video.id)
    if (error) {
      toast.error(error.message)
      load()
    }
  }

  const remove = async (video: HowToVideo) => {
    if (!confirm(`Delete "${video.title}"?`)) return
    const { error } = await supabase.from('how_to_videos').delete().eq('id', video.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Deleted')
    setVideos((prev) => prev.filter((v) => v.id !== video.id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#13071f] to-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <PlayCircle size={28} className="text-pink-300" />
            <div>
              <h1 className="text-2xl font-black">How-To Videos</h1>
              <p className="text-sm text-slate-400">Tutorial library for Troll City</p>
            </div>
          </div>

          {admin && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowUpload((s) => !s)}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 px-3 py-2 text-sm font-bold"
              >
                <Plus size={16} /> Upload Video
              </button>
              <button
                onClick={() => setShowManage((s) => !s)}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200"
              >
                <Settings size={16} /> Manage
              </button>
            </div>
          )}
        </div>

        {admin && showUpload && (
          <div className="mb-6">
            <HowToVideoUpload onUploaded={() => load()} />
          </div>
        )}

        {admin && showManage && (
          <div className="mb-6">
            <HowToVideoAdmin />
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={18} className="animate-spin" /> Loading videos…
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-10 text-center text-slate-400">
            No how-to videos available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <div
                key={video.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <button
                  onClick={() => openPlayer(video)}
                  className="relative block w-full"
                  aria-label={`Play ${video.title}`}
                >
                  {video.thumbnail_path ? (
                    <ThumbnailThumb video={video} />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-cyan-400/20">
                      <PlayCircle size={48} className="text-white/80" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                    <PlayCircle size={48} className="text-white drop-shadow" />
                  </div>
                  {!video.is_published && (
                    <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                      Draft
                    </span>
                  )}
                </button>

                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white">{video.title}</h3>
                  </div>
                  {video.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-slate-400">{video.description}</p>
                  )}

                  {admin && (
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      <button
                        onClick={() => togglePublish(video)}
                        className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:text-white"
                      >
                        {video.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                        {video.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => remove(video)}
                        className="flex items-center gap-1 rounded-md border border-red-400/30 px-2 py-1 text-xs text-red-300 hover:text-red-200"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {player && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => setPlayer(null)}
              className="absolute -top-10 right-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h2 className="mb-2 text-lg font-bold text-white">{player.video.title}</h2>
            {playerLoading ? (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-slate-900">
                <Loader2 size={28} className="animate-spin text-pink-300" />
              </div>
            ) : (
              <video
                src={player.url || undefined}
                poster={player.thumbnailUrl || undefined}
                controls
                autoPlay
                className="aspect-video w-full rounded-xl bg-black"
              />
            )}
            {player.video.description && (
              <p className="mt-3 text-sm text-slate-300">{player.video.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ThumbnailThumb({ video }: { video: HowToVideo }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    supabase.functions
      .invoke('get-how-to-video-url', { body: { videoId: video.id } })
      .then(({ data }) => {
        if (active && data?.thumbnailUrl) setUrl(data.thumbnailUrl)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [video.id])

  if (!url) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-cyan-400/20">
        <PlayCircle size={48} className="text-white/80" />
      </div>
    )
  }
  return <img src={url} alt={video.title} className="aspect-video w-full object-cover" />
}
