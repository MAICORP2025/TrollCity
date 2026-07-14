import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import {
  extractVideoThumbnail,
  resolveVideoContentType,
} from '../hooks/useHowToVideoUpload'
import { uploadTreelzVideo } from '../services/treelzService'
import { HowToVideo } from '../types/howToVideos'
import { Upload, X, Loader2, Film } from 'lucide-react'
import { toast } from 'sonner'

// How-To uploads now use the same upload path as Treelz (single upload to the
// treelz-videos bucket via uploadTreelzVideo), which also creates the Treelz post.
const MAX_FILE_SIZE = 512 * 1024 * 1024 // 15 GB

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

export default function HowToVideoUpload({
  onUploaded,
}: {
  onUploaded?: (video: HowToVideo) => void
}) {
  const { user, profile } = useAuthStore()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isPublished, setIsPublished] = useState(false)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isAdminOrCEO(profile)) return
  }, [profile])

  if (!isAdminOrCEO(profile)) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    if (!selected) return
    if (!selected.type.startsWith('video/') && resolveVideoContentType(selected) === 'video/mp4' && !/\.(mp4|mov|webm|mkv|avi|m4v|mpg|mpeg|wmv|flv|ogv|3gp|ts)$/i.test(selected.name)) {
      toast.error('Only video files are allowed')
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('File exceeds the 15GB limit')
      return
    }
    setFile(selected)
    setThumbnailPreview(null)
    setDuration(null)

    const url = URL.createObjectURL(selected)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      setDuration(Math.round(video.duration || 0))
    }
    video.src = url

    const thumb = await extractVideoThumbnail(selected)
    setThumbnailPreview(thumb)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please choose a video file')
      return
    }
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }
    if (!user?.id) {
      toast.error('You must be signed in')
      return
    }

    setSubmitting(true)
    try {
      // Upload via Treelz's upload path (single upload to the treelz-videos
      // bucket). This also creates the Treelz post, satisfying "send to Treelz".
      const treelzPost = await uploadTreelzVideo(
        file,
        thumbnailPreview || '',
        title.trim(),
        user.id,
        setProgress,
      )

      const insertPayload = {
        title: title.trim(),
        description: description.trim() || null,
        storage_path: treelzPost.video_url,
        thumbnail_path: treelzPost.thumbnail_url || null,
        duration,
        sort_order: sortOrder,
        is_published: isPublished,
        file_type: resolveVideoContentType(file),
        file_size: file.size,
        created_by: user.id,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('how_to_videos')
        .insert(insertPayload)
        .select()
        .single()

      if (insertError) {
        toast.error(insertError.message)
        return
      }

      toast.success('Video uploaded successfully')
      setFile(null)
      setTitle('')
      setDescription('')
      setSortOrder(0)
      setIsPublished(false)
      setThumbnailPreview(null)
      setDuration(null)
      setProgress(0)
      onUploaded?.(inserted as HowToVideo)
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  const showProgress = submitting || progress > 0

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-pink-300/20 bg-slate-950/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
    >
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-white/90">
        <Film size={18} className="text-pink-300" />
        Upload How-To Video
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">
          Video File
        </label>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-pink-600/80 file:px-3 file:py-2 file:text-white file:cursor-pointer hover:file:bg-pink-500"
        />
      </div>

      {thumbnailPreview && (
        <div className="relative w-fit">
          <img
            src={thumbnailPreview}
            alt="Thumbnail preview"
            className="h-28 rounded-lg border border-white/10 object-cover"
          />
          <button
            type="button"
            onClick={() => setThumbnailPreview(null)}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"
            aria-label="Remove preview"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-pink-400"
          placeholder="How to do X"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-pink-400"
          placeholder="Briefly describe this tutorial"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-pink-400"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 accent-pink-500"
            />
            Published
          </label>
        </div>
      </div>

      {showProgress && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{submitting ? `Uploading… ${progress}%` : `${progress}%`}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {submitting ? 'Uploading…' : 'Upload Video'}
        </button>
      </div>
    </form>
  )
}
