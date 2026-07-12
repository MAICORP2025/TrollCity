import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Radio, Eye, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import type { XTrollzFavorite } from '@/lib/xtrollz'

interface FavoritesTabProps {
  favorites: XTrollzFavorite[]
  onStreamClick: (streamId: string) => void
}

export default function FavoritesTab({ favorites, onStreamClick }: FavoritesTabProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<XTrollzFavorite[]>(favorites)

  useEffect(() => {
    setItems(favorites)
  }, [favorites])

  const handleUnfavorite = async (streamerId: string) => {
    if (!user?.id) return
    const { error } = await supabase.rpc('xtrollz_toggle_favorite', {
      p_user_id: user.id,
      p_streamer_id: streamerId,
    })
    if (error) {
      toast.error('Failed to remove favorite')
      return
    }
    setItems((prev) => prev.filter((f) => f.streamer_id !== streamerId))
    toast.success('Removed from favorites')
  }

  const live = items.filter((f) => f.is_live)
  const offline = items.filter((f) => !f.is_live)

  const formatLastLive = (iso: string) => {
    if (!iso) return 'Never'
    const date = new Date(iso)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2">
        <Heart size={16} className="text-pink-400" />
        Favorite XTrollerz
      </h2>

      {items.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center">
          <Heart size={32} className="mx-auto text-white/20" />
          <p className="mt-4 text-sm font-bold text-white">No favorites yet</p>
          <p className="mt-1 text-xs text-white/60">Tap the heart icon on any streamer to add them here.</p>
        </div>
      )}

      {live.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-green-400 flex items-center gap-2">
            <Radio size={14} /> Live Now
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {live.map((streamer) => (
              <div
                key={streamer.streamer_id}
                onClick={() => onStreamClick(streamer.streamer_id)}
                className="cursor-pointer rounded-2xl border border-white/10 bg-black/30 p-3 transition-all hover:border-purple-400/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-white">
                    {streamer.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{streamer.display_name}</p>
                    <p className="truncate text-xs text-white/60">{streamer.category || 'Chat'}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnfavorite(streamer.streamer_id) }}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:text-red-400 hover:border-red-400/30"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-white/60">
                  <Eye size={10} /> {streamer.viewer_count?.toLocaleString() || '0'} viewers
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {offline.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/40 flex items-center gap-2">
            Offline
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {offline.map((streamer) => (
              <div
                key={streamer.streamer_id}
                onClick={() => navigate(`/profile/${streamer.display_name || streamer.streamer_id}`)}
                className="cursor-pointer rounded-2xl border border-white/10 bg-black/30 p-3 opacity-70 transition-all hover:opacity-100 hover:border-purple-400/30"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-white">
                    {streamer.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{streamer.display_name}</p>
                    <p className="truncate text-xs text-white/60">
                      Last live: {formatLastLive(streamer.last_live_at || streamer.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnfavorite(streamer.streamer_id) }}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:text-red-400 hover:border-red-400/30"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
