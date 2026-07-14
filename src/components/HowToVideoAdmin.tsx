import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { HowToVideo } from '../types/howToVideos'
import HowToVideoUpload from './HowToVideoUpload'
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Loader2,
  Check,
  X,
} from 'lucide-react'
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

export default function HowToVideoAdmin() {
  const { profile } = useAuthStore()
  const [videos, setVideos] = useState<HowToVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ title: string; description: string; sort_order: number }>({
    title: '',
    description: '',
    sort_order: 0,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('how_to_videos')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      setVideos((data as HowToVideo[]) || [])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdminOrCEO(profile)) load()
  }, [profile, load])

  if (!isAdminOrCEO(profile)) return null

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
    } else {
      toast.success(next ? 'Published' : 'Unpublished')
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= videos.length) return
    const a = videos[index]
    const b = videos[target]
    const aOrder = a.sort_order
    const bOrder = b.sort_order

    setVideos((prev) => {
      const copy = [...prev]
      copy[index] = { ...a, sort_order: bOrder }
      copy[target] = { ...b, sort_order: aOrder }
      return copy.sort((x, y) => x.sort_order - y.sort_order)
    })

    const updates = [
      supabase.from('how_to_videos').update({ sort_order: bOrder }).eq('id', a.id),
      supabase.from('how_to_videos').update({ sort_order: aOrder }).eq('id', b.id),
    ]
    const results = await Promise.all(updates)
    const err = results.find((r) => r.error)?.error
    if (err) {
      toast.error(err.message)
      load()
    }
  }

  const remove = async (video: HowToVideo) => {
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('how_to_videos').delete().eq('id', video.id)
    if (error) {
      toast.error(error.message)
      return
    }
    try {
      await supabase.storage.from('how-to-videos').remove([video.storage_path])
      if (video.thumbnail_path) {
        await supabase.storage.from('how-to-videos').remove([video.thumbnail_path])
      }
    } catch {
      // Storage cleanup is best-effort
    }
    toast.success('Deleted')
    setVideos((prev) => prev.filter((v) => v.id !== video.id))
  }

  const startEdit = (video: HowToVideo) => {
    setEditingId(video.id)
    setEditForm({
      title: video.title,
      description: video.description || '',
      sort_order: video.sort_order,
    })
  }

  const saveEdit = async (video: HowToVideo) => {
    const { error } = await supabase
      .from('how_to_videos')
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        sort_order: editForm.sort_order,
      })
      .eq('id', video.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setVideos((prev) =>
      prev
        .map((v) =>
          v.id === video.id
            ? {
                ...v,
                title: editForm.title.trim(),
                description: editForm.description.trim() || null,
                sort_order: editForm.sort_order,
              }
            : v
        )
        .sort((a, b) => a.sort_order - b.sort_order)
    )
    setEditingId(null)
    toast.success('Saved')
  }

  return (
    <div className="space-y-6">
      <HowToVideoUpload onUploaded={() => load()} />

      <div className="rounded-2xl border border-pink-300/20 bg-slate-950/60 p-5">
        <div className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-white/90">
          Manage How-To Videos
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : videos.length === 0 ? (
          <p className="text-sm text-slate-400">No videos yet.</p>
        ) : (
          <ul className="space-y-3">
            {videos.map((video, index) => (
              <li
                key={video.id}
                className="rounded-xl border border-white/10 bg-slate-900/50 p-3"
              >
                {editingId === video.id ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white outline-none focus:border-pink-400"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white outline-none focus:border-pink-400"
                    />
                    <input
                      type="number"
                      value={editForm.sort_order}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))
                      }
                      className="w-32 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white outline-none focus:border-pink-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(video)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        <Check size={14} /> Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-white">{video.title}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            video.is_published
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-600/30 text-slate-300'
                          }`}
                        >
                          {video.is_published ? 'Live' : 'Draft'}
                        </span>
                      </div>
                      {video.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          {video.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="rounded-md border border-white/10 p-1.5 text-slate-300 hover:text-white disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => move(index, 1)}
                        disabled={index === videos.length - 1}
                        className="rounded-md border border-white/10 p-1.5 text-slate-300 hover:text-white disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        onClick={() => togglePublish(video)}
                        className="rounded-md border border-white/10 p-1.5 text-slate-300 hover:text-white"
                        aria-label={video.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {video.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => startEdit(video)}
                        className="rounded-md border border-white/10 p-1.5 text-slate-300 hover:text-white"
                        aria-label="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(video)}
                        className="rounded-md border border-red-400/30 p-1.5 text-red-300 hover:text-red-200"
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
