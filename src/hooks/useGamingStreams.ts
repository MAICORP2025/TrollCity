import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface GamingStream {
  id: string
  title: string
  streamerName: string
  streamerAvatar: string | null
  gameTitle: string | null
  viewerCount: number
  thumbnailUrl: string | null
  isFeatured: boolean
}

export function useGamingStreams(limit = 10) {
  const [streams, setStreams] = useState<GamingStream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('streams')
          .select(`
            id, title, game_title, thumbnail_url, viewer_count, is_featured,
            user_profiles (username, avatar_url)
          `)
          .eq('status', 'live')
          .eq('category', 'gaming')
          .gte('viewer_count', 20)
          .order('viewer_count', { ascending: false })
          .limit(limit)
        if (!mounted) return
        if (error) throw error
        const mapped: GamingStream[] = (data || []).map((s: any) => {
          const profile = Array.isArray(s.user_profiles) ? s.user_profiles[0] : s.user_profiles
          return {
            id: s.id,
            title: s.title || 'Gaming Stream',
            streamerName: profile?.username || 'Unknown',
            streamerAvatar: profile?.avatar_url || null,
            gameTitle: s.game_title,
            viewerCount: s.viewer_count || 0,
            thumbnailUrl: s.thumbnail_url,
            isFeatured: s.is_featured === true,
          }
        })
        setStreams(mapped)
      } catch {
        // Silently fail
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetch()
    return () => { mounted = false }
  }, [limit])

  return { streams, loading }
}
