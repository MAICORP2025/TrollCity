import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePresenceStore } from '@/lib/presenceStore'
import { supabase } from '@/lib/supabase'

export interface LiveItem {
  id: string
  title: string
  type: 'stream' | 'podcast' | 'auction'
  viewerCount: number
  streamerName: string
  streamerAvatar: string | null
  broadcasterId?: string
  isFeatured?: boolean
  isBattle?: boolean
  battleFormat?: string
  battleStatus?: string
  category?: string | null
  visibilityScore?: number
  hotScore?: number
  isRising?: boolean
  isTrending?: boolean
  momentumLevel?: number
  velocityTrend?: string
}

export interface AuctionShow {
  id: string
  title: string
  description?: string | null
  category?: string | null
  thumbnail_url?: string | null
  status: string
  scheduled_for?: string | null
  live_started_at?: string | null
  ended_at?: string | null
  livekit_room_name?: string | null
  auctioneer_id: string
  current_lot_id?: string | null
  hls_url?: string | null
  egress_id?: string | null
  visibilityScore?: number
  hotScore?: number
  isRising?: boolean
  isTrending?: boolean
}

   interface LiveContentState {
      liveItems: LiveItem[]
      liveAuctions: AuctionShow[]
      totalViewers: number
      onlineUsers: number
      loadingLive: boolean
      loadingOnline: boolean
      refresh: () => void
    }

const LiveContentContext = createContext<LiveContentState | null>(null)

export function LiveContentProvider({ children }: { children: React.ReactNode }) {
    // Initialize all state variables to avoid undefined references
    const [liveItems, setLiveItems] = useState<LiveItem[]>([]);
    const [liveAuctions, setLiveAuctions] = useState<AuctionShow[]>([]);
    const [totalViewers, setTotalViewers] = useState(0);
    const [onlineUsers, setOnlineUsers] = useState(0); // Ensures onlineUsers is always defined
    const [loadingLive, setLoadingLive] = useState(true);
    const [loadingOnline, setLoadingOnline] = useState(true);
    const presenceOnlineCount = usePresenceStore((state) => state.onlineCount);
    const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchLiveContent = useCallback(async () => {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_active_streams_v2', {
        p_limit: 100,
        p_offset: 0,
        p_sort_by: 'visibility'
      })

      if (rpcError) {
        const { data: streamsData, error: streamsError } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            current_viewers,
            viewer_count,
            is_featured,
            battle_mode,
            battle_format,
            battle_status,
            category,
            broadcaster_id,
            user_profiles!streams_broadcaster_id_fkey(username, avatar_url)
          `)
          .eq('is_live', true)
          .order('current_viewers', { ascending: false })
          .limit(100)

        if (streamsError) throw streamsError
        if (!mountedRef.current) return

        const streams: LiveItem[] = (streamsData || []).map((stream: any) => ({
          id: stream.id,
          title: stream.title || 'Untitled Stream',
          type: 'stream' as const,
          viewerCount: stream.current_viewers || stream.viewer_count || 0,
          streamerName: stream.user_profiles?.username || 'Unknown',
          streamerAvatar: stream.user_profiles?.avatar_url || null,
          broadcasterId: stream.broadcaster_id || stream.user_id || null,
          isFeatured: stream.is_featured || false,
          isBattle: stream.battle_mode === 'universal',
          battleFormat: stream.battle_format,
          battleStatus: stream.battle_status,
          category: stream.category || null,
        }))

        setLiveItems(streams)
        setTotalViewers(streams.reduce((sum, item) => sum + item.viewerCount, 0))
        return
      }

      if (!mountedRef.current) return

      const streams: LiveItem[] = (rpcData || []).map((row: any) => ({
        id: row.id,
        title: row.title || 'Untitled Stream',
        type: 'stream' as const,
        viewerCount: row.current_viewers || 0,
        streamerName: row.broadcaster_username || 'Unknown',
        streamerAvatar: row.broadcaster_avatar || null,
        broadcasterId: row.broadcaster_id || null,
        isFeatured: row.visibility_score > 0,
        isBattle: false,
        category: row.category || null,
        visibilityScore: row.visibility_score || 0,
        hotScore: row.hot_score || 0,
        isRising: row.is_rising || false,
        isTrending: row.is_trending || false,
        momentumLevel: row.momentum_level || 0,
        velocityTrend: row.stream_momentum?.velocity_trend || 'stable',
      }))

      setLiveItems(streams)
      setTotalViewers(streams.reduce((sum, item) => sum + item.viewerCount, 0))
    } catch (err) {
      console.error('Error fetching live content:', err)
    } finally {
      if (mountedRef.current) setLoadingLive(false)
    }
  }, [])

  useEffect(() => {
    if (presenceOnlineCount > 0) {
      setOnlineUsers(presenceOnlineCount)
      setLoadingOnline(false)
    }
  }, [presenceOnlineCount])

const fetchLiveAuctions = useCallback(async () => {
     try {
       const { data, error } = await supabase
         .from('auction_shows')
         .select('*')
         .eq('status', 'live')
         .order('live_started_at', { ascending: false })
         .limit(5)

       if (error) throw error
       if (!mountedRef.current) return
       setLiveAuctions(data || [])
     } catch (err) {
       console.error('Error fetching live auctions:', err)
     }
   }, [])

   const fetchOnlineUsers = useCallback(async () => {
     try {
       const { count, error } = await supabase
         .from('user_profiles')
         .select('id', { count: 'exact', head: true })
         .eq('is_online', true)

       if (error) throw error
       if (!mountedRef.current) return
       setOnlineUsers(count || 0)
     } catch (err) {
       console.error('Error fetching online users:', err)
     } finally {
       if (mountedRef.current) setLoadingOnline(false)
     }
   }, [])

useEffect(() => {
     fetchLiveContent()
     fetchLiveAuctions()
     fetchOnlineUsers()

     // Visibility-gated polling: pause intervals when tab is hidden to reduce load
     let streamInterval: ReturnType<typeof setInterval> | null = null
     let auctionInterval: ReturnType<typeof setInterval> | null = null
     let onlineInterval: ReturnType<typeof setInterval> | null = null

     const startPolling = () => {
       if (!streamInterval) streamInterval = setInterval(fetchLiveContent, 90000)
       if (!auctionInterval) auctionInterval = setInterval(fetchLiveAuctions, 30000)
       if (!onlineInterval) onlineInterval = setInterval(fetchOnlineUsers, 60000)
     }

     const stopPolling = () => {
       if (streamInterval) { clearInterval(streamInterval); streamInterval = null }
       if (auctionInterval) { clearInterval(auctionInterval); auctionInterval = null }
       if (onlineInterval) { clearInterval(onlineInterval); onlineInterval = null }
     }

     const handleVisibilityChange = () => {
       if (document.visibilityState === 'visible') {
         startPolling()
       } else {
         stopPolling()
       }
     }

     document.addEventListener('visibilitychange', handleVisibilityChange)
     startPolling()

    // Consolidated single channel for home page (replaces 3 separate channels)
    // OPTIMIZED: Only listen to UPDATE events on live streams to reduce event volume
    const homeChannel = supabase.channel('home:global')
    homeChannel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: 'is_live=eq.true' }, (payload) => {
        try {
          const oldRow = (payload.old || null) as any
          const newRow = (payload.new || null) as any
          const relevantChange = (() => {
            if (!oldRow && newRow) return newRow.is_live === true
            if (oldRow && !newRow) return oldRow.is_live === true
            if (oldRow && newRow) {
              if ((oldRow.is_live || newRow.is_live) && oldRow.is_live !== newRow.is_live) return true
              const keys = ['current_viewers','viewer_count','is_featured','battle_mode','battle_format','battle_status']
              return keys.some(k => (oldRow as any)[k] !== (newRow as any)[k])
            }
            return false
          })()
          if (relevantChange) fetchLiveContent()
        } catch (e) {
          console.warn('home:global streams handler error', e)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_participants' }, () => {
        // Poll every 90 seconds for viewer count updates instead of realtime spam
        if (document.visibilityState === 'visible') {
          fetchLiveContent()
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_shows' }, () => {
        fetchLiveAuctions()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visibility_scores' }, () => {
        fetchLiveContent()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles' }, () => {
        fetchOnlineUsers()
      })
      .subscribe()

    return () => {
      clearInterval(streamInterval)
      clearInterval(auctionInterval)
      clearInterval(onlineInterval)
      try { supabase.removeChannel(homeChannel) } catch {}
    }
  }, [fetchLiveContent, fetchLiveAuctions, fetchOnlineUsers])

  const refresh = useCallback(() => {
    fetchLiveContent()
    fetchLiveAuctions()
  }, [fetchLiveContent, fetchLiveAuctions])

const value = useMemo(() => ({
      liveItems: liveItems || [],
      liveAuctions: liveAuctions || [],
      totalViewers: totalViewers || 0,
      onlineUsers: onlineUsers || 0,
      loadingLive: loadingLive !== undefined ? loadingLive : true,
      loadingOnline: loadingOnline !== undefined ? loadingOnline : true,
      refresh,
    }), [liveItems, liveAuctions, totalViewers, onlineUsers, loadingLive, loadingOnline, refresh])

  return (
    <LiveContentContext.Provider value={value}>
      {children}
    </LiveContentContext.Provider>
  )
}

export function useLiveContent() {
  const ctx = useContext(LiveContentContext)
  if (!ctx) throw new Error('useLiveContent must be used within LiveContentProvider')
  return ctx
}
