import { useRef, useState } from 'react'
import { Image, Send, Smile } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { trollCityTheme } from '@/styles/trollCityTheme'
import { WallPost } from '@/types/trollWall'
import MentionTextarea from '../MentionTextarea'

const EMOJI_OPTIONS = [':)', ':D', '<3', ':-)', ';)', ':P']

interface CreatePostComposerProps {
  onPostCreated: (post: WallPost) => void
  onRequireAuth: (intent?: string) => boolean
}

export default function CreatePostComposer({ onPostCreated, onRequireAuth }: CreatePostComposerProps) {
  const { user, profile } = useAuthStore()
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleRequireAuth = (intent?: string) => {
    if (user) return true
    onRequireAuth(intent)
    return false
  }

  const handleEmojiInsert = (emoji: string) => {
    setContent((prev) => `${prev}${prev ? ' ' : ''}${emoji}`)
    setShowEmoji(false)
  }

  const handleMediaPick = () => {
    if (!handleRequireAuth('add media')) return
    fileInputRef.current?.click()
  }

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const type = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
      ? 'video'
      : null

    if (!type) {
      toast.error('Upload an image or video file')
      event.target.value = ''
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File must be under 50MB')
      event.target.value = ''
      return
    }

    if (type === 'video') {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.src = url
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        if (video.duration > 300) {
          toast.error('Video must be 5 minutes or shorter')
          event.target.value = ''
          return
        }
        setMediaFile(file)
        setMediaType('video')
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        toast.error('Failed to read video file')
        event.target.value = ''
      }
      return
    }

    setMediaFile(file)
    setMediaType('image')
  }

  const handleSubmit = async () => {
    if (!handleRequireAuth('create a post')) return

    if (!content.trim()) {
      toast.error('Write something before posting')
      return
    }

    setSubmitting(true)
    try {
      const metadata: Record<string, string> = {}

      if (mediaFile && user) {
        const extension = mediaFile.name.split('.').pop() || 'png'
        const fileName = `${user.id}/${Date.now()}_media.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, mediaFile)

        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName)

        if (mediaType === 'video') {
          metadata.video_url = publicData.publicUrl
        } else {
          metadata.image_url = publicData.publicUrl
        }
      }

      const { data, error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user?.id,
          post_type: 'text',
          content: content.trim(),
          metadata
        })
        .select('*')
        .single()

      if (error) throw error

      const optimisticPost: WallPost = {
        ...(data as WallPost),
        username: profile?.username || 'You',
        avatar_url: profile?.avatar_url || null,
        is_admin: profile?.is_admin || false,
        is_troll_officer: profile?.is_troll_officer || false,
        is_og_user: profile?.is_og_user || false,
        user_created_at: profile?.created_at,
        user_liked: false,
        reactions: {},
        gifts: {}
      }

      onPostCreated(optimisticPost)
      setContent('')
      setMediaFile(null)
      setMediaType(null)
      toast.success('Post created')
    } catch (err: any) {
      console.error('Error creating post:', err)
      toast.error(err?.message || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-2`}
      onClick={() => handleRequireAuth('create a post')}
    >
      {mediaFile && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
          <span className="truncate">{mediaFile.name} {mediaType === 'video' ? '(video)' : '(image)'}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setMediaFile(null)
              setMediaType(null)
            }}
            className="text-red-300 hover:text-red-200 ml-2"
          >
            Remove
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="h-7 w-7 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username || 'Profile'} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-white/60">
              {profile?.username?.[0]?.toUpperCase() || 'T'}
            </div>
          )}
        </div>
        <div className="flex-1">
          <MentionTextarea
            value={content}
            onChange={setContent}
            placeholder="What's happening in the City? Use # to tag users"
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm placeholder-white/40 focus:outline-none focus:border-purple-400/60 resize-none"
            maxLength={5000}
            onFocus={() => handleRequireAuth('create a post')}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              handleMediaPick()
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
            title="Upload image or video"
          >
            <Image className="h-3.5 w-3.5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                if (!handleRequireAuth('add an emoji')) return
                setShowEmoji((prev) => !prev)
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            {showEmoji && (
              <div className="absolute z-10 bottom-full mb-2 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl">
                <div className="flex gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleEmojiInsert(emoji)
                      }}
                      className="px-2 py-1 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 text-xs"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              handleSubmit()
            }}
            disabled={submitting || !content.trim()}
            className="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-40 text-white"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaChange}
        className="hidden"
      />
    </div>
  )
}
