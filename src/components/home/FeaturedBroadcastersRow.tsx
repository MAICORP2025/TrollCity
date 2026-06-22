import React, { useEffect, useState } from 'react'
import { Radio, Users, Play } from 'lucide-react'
import HorizontalScrollRow from './HorizontalScrollRow'
import { supabase } from '@/lib/supabase'

interface Broadcaster {
  id: string
  title: string
  streamerName: string
  streamerAvatar: string | null
  viewerCount: number
  category: string | null
}

interface FeaturedBroadcastersRowProps {
  onItemClick: (id: string) => void
}

export default function FeaturedBroadcastersRow({ onItemClick }: FeaturedBroadcastersRowProps) {
  const [broadcasters, setBroadcasters] = useState<Broadcaster[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBroadcasters = async () => {
      try {
        const { data } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            current_viewers,
            viewer_count,
            category,
            broadcaster_id,
            user_profiles!streams_broadcaster_id_fkey(username, avatar_url)
          `)
          .eq('is_live', true)
          .order('current_viewers', { ascending: false })
          .limit(20)

        const items = (data ?? []).map((stream: any) => ({
          id: stream.id,
          title: stream.title || 'Untitled Stream',
          streamerName: stream.user_profiles?.username || 'Unknown',
          streamerAvatar: stream.user_profiles?.avatar_url || null,
          viewerCount: stream.current_viewers || stream.viewer_count || 0,
          category: stream.category || null,
        }))

        setBroadcasters(items)
      } catch (err) {
        console.error('Error fetching broadcasters:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBroadcasters()

    // Poll every 90 seconds to update viewer counts
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchBroadcasters()
      }
    }, 90000)

    return () => clearInterval(pollInterval)
  }, [])

  const hasData = broadcasters.length > 0

  return (
    <HorizontalScrollRow
      title="Broadcasters"
      subtitle={hasData ? `${broadcasters.length} live now` : 'No live broadcasts'}
      icon={<Radio className="h-3.5 w-3.5 text-red-400" />}
    >
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[220px] w-[180px] shrink-0 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]" />
        ))
      ) : hasData ? (
        broadcasters.map((item) => {
          const avatarUrl =
            item.streamerAvatar ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.streamerName)}`

          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className="group relative flex h-[220px] w-[180px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c1a]/95 text-left transition-all duration-200 hover:border-red-400/30 hover:shadow-[0_0_24px_rgba(239,68,68,0.12)]"
            >
              <div className="relative h-[130px] w-full shrink-0 overflow-hidden">
                {item.streamerAvatar ? (
                  <img
                    src={item.streamerAvatar}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-[1.06]"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-red-900/40 via-[#080c1a] to-purple-900/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#080c1a]/95" />
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  LIVE
                </div>
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                  <Users className="h-2.5 w-2.5" />
                  {item.viewerCount}
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600/90 shadow-[0_0_20px_rgba(239,68,68,0.4)] backdrop-blur-sm">
                    <Play className="h-5 w-5 text-white" fill="white" />
                  </div>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                    <img src={avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080c1a] bg-red-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">{item.streamerName}</p>
                    <p className="truncate text-[9px] font-bold text-white/35">{item.category || 'Streaming'}</p>
                  </div>
                </div>
                <p className="line-clamp-2 flex-1 text-[10px] leading-relaxed text-white/40">{item.title}</p>
              </div>
            </button>
          )
        })
      ) : (
        <div className="flex h-[220px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-[#080c1a]/60 p-4 text-center">
          <Radio className="h-8 w-8 text-red-400/40" />
          <p className="text-xs font-bold text-white/30">No Broadcasters Live</p>
          <p className="text-[10px] text-white/15">Live streams will appear here!</p>
        </div>
      )}
    </HorizontalScrollRow>
  )
}
