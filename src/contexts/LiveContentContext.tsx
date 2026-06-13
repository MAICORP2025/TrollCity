import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface LiveItem {
  id: string
  title: string
  type: 'stream' | 'podcast' | 'auction'
  viewerCount: number
  streamerName: string
  streamerAvatar: string | null
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
  loadingLive: boolean
  refresh: () => void
}

const LiveContentContext = createContext<LiveContentState | null>(null)

export function LiveContentProvider({ children }: { children: React.ReactNode }) {
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [liveAuctions, setLiveAuctions] = useState<AuctionShow[]>([])
  const [totalViewers, setTotalViewers] = useState(0)
  const [loadingLive, setLoadingLive] = useState(true)
  const mountedRef = useRef(true)

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

  const fetchLiveAuctions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auction_shows')
        .select('*')
        .eq('status', 'live')
        .order('live_started_at', { ascending: false })
        .limit(5)

      if (error) throw error
      if (!mountedRef.current) setLiveAuctions(data || [])
    } catch (err) {
      console.error('Error fetching live auctions:', err)
    }
  }, [])

  useEffect(() => {
    fetchLiveContent()
    fetchLiveAuctions()

    const streamInterval = setInterval(fetchLiveContent, 60000)
    const auctionInterval = setInterval(fetchLiveAuctions, 30000)

    const channel = supabase.channel('home:live-streams')
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, (payload) => {
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
        console.warn('home:live-streams handler error', e)
      }
    })
    channel.subscribe()

    const auctionChannel = supabase.channel('home:live-auctions')
    auctionChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'auction_shows' }, () => {
      fetchLiveAuctions()
    })
    auctionChannel.subscribe()

    const visibilityChannel = supabase.channel('home:visibility-scores')
    visibilityChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'visibility_scores' }, () => {
      fetchLiveContent()
    })
    visibilityChannel.subscribe()

    return () => {
      clearInterval(streamInterval)
      clearInterval(auctionInterval)
      try { supabase.removeChannel(channel) } catch {}
      try { supabase.removeChannel(auctionChannel) } catch {}
      try { supabase.removeChannel(visibilityChannel) } catch {}
    }
  }, [fetchLiveContent, fetchLiveAuctions])

  const refresh = useCallback(() => {
    fetchLiveContent()
    fetchLiveAuctions()
  }, [fetchLiveContent, fetchLiveAuctions])

  const value = useMemo(() => ({
    liveItems,
    liveAuctions,
    totalViewers,
    loadingLive,
    refresh,
  }), [liveItems, liveAuctions, totalViewers, loadingLive, refresh])

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
