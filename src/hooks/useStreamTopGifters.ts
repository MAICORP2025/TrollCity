import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface TopGifter {
  sender_id: string
  sender_username: string
  sender_avatar_url?: string
  total_gift_coins: number
  total_gifts: number
  last_gift_at: string
  rank: number
}

interface UseStreamTopGiftersOptions {
  streamId: string | null
  limit?: number
  refreshIntervalMs?: number
}

/**
 * Hook to fetch and monitor top gifters/supporters for a live broadcast.
 * This is the real source of truth for "Live/supporter row" in ViewerPage.
 * 
 * Data is fetched from the real gift system and updated on new gift events.
 * Throttled to avoid excessive queries.
 */
export function useStreamTopGifters({
  streamId,
  limit = 8,
  refreshIntervalMs = 10000, // Refresh every 10s if no recent gifts
}: UseStreamTopGiftersOptions) {
  const [topGifters, setTopGifters] = useState<TopGifter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastRefreshRef = useRef<number>(0)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchTopGifters = useCallback(async () => {
    if (!streamId) return

    setIsLoading(true)
    setError(null)

    try {
      // Try to use a Supabase RPC if available: public.stream_top_gifters(stream_id, limit)
      // If not available, fall back to manual query from stream gift events
      const { data, error: rpcError } = await supabase
        .rpc('stream_top_gifters', { p_stream_id: streamId, p_limit: limit })
        .limit(limit)

      if (rpcError && rpcError.code !== 'PGRST204') {
        // RPC doesn't exist or failed, fall back to manual query
        console.debug('[useStreamTopGifters] RPC not available, using manual query:', rpcError)

        // Manual query: aggregate gifts sent to this stream
        const { data: giftData, error: queryError } = await supabase
          .from('stream_gifts')
          .select(
            `
            id,
            sender_id,
            gift_name,
            amount,
            quantity,
            created_at,
            sender:sender_id (
              id,
              username,
              display_name,
              avatar_url
            )
          `
          )
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(200) // Fetch more to aggregate

        if (queryError) throw queryError

        if (!giftData || giftData.length === 0) {
          setTopGifters([])
          setIsLoading(false)
          return
        }

        // Aggregate by sender
        const gifterMap = new Map<
          string,
          {
            sender_id: string
            sender_username: string
            sender_avatar_url?: string
            total_gift_coins: number
            total_gifts: number
            last_gift_at: string
          }
        >()

        giftData.forEach((gift: any) => {
          const senderId = gift.sender_id
          const senderProfile = gift.sender
          const existing = gifterMap.get(senderId) || {
            sender_id: senderId,
            sender_username: senderProfile?.username || senderProfile?.display_name || 'Unknown',
            sender_avatar_url: senderProfile?.avatar_url || undefined,
            total_gift_coins: 0,
            total_gifts: 0,
            last_gift_at: gift.created_at,
          }

          existing.total_gift_coins += (gift.amount || 0) * (gift.quantity || 1)
          existing.total_gifts += gift.quantity || 1
          existing.last_gift_at = gift.created_at

          gifterMap.set(senderId, existing)
        })

        // Sort by total coins and take top N
        const sorted = Array.from(gifterMap.values())
          .sort((a, b) => b.total_gift_coins - a.total_gift_coins)
          .slice(0, limit)
          .map((gifter, index) => ({
            ...gifter,
            rank: index + 1,
          }))

        setTopGifters(sorted)
        setIsLoading(false)
        return
      }

      if (rpcError) {
        throw rpcError
      }

      // RPC succeeded
      const sorted = (data || [])
        .slice(0, limit)
        .map((gifter: any, index: number) => ({
          sender_id: gifter.sender_id,
          sender_username: gifter.sender_username,
          sender_avatar_url: gifter.sender_avatar_url || undefined,
          total_gift_coins: gifter.total_gift_coins || 0,
          total_gifts: gifter.total_gifts || 0,
          last_gift_at: gifter.last_gift_at,
          rank: index + 1,
        }))

      setTopGifters(sorted)
      setIsLoading(false)
    } catch (err) {
      console.error('[useStreamTopGifters] Error fetching top gifters:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch top gifters')
      setIsLoading(false)
    }
  }, [streamId, limit])

  // Initial fetch
  useEffect(() => {
    if (!streamId) {
      setTopGifters([])
      return
    }

    fetchTopGifters()
    lastRefreshRef.current = Date.now()

    // Schedule periodic refresh
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = setTimeout(() => {
        fetchTopGifters()
        lastRefreshRef.current = Date.now()
        scheduleRefresh()
      }, refreshIntervalMs)
    }

    scheduleRefresh()

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [streamId, fetchTopGifters, refreshIntervalMs])

  // Optional: Listen to realtime gift events and update optimistically
  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream-gifts-realtime:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_gifts',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const newGift = payload.new as any

          // Optimistically update topGifters
          setTopGifters((prev) => {
            const senderId = newGift.sender_id
            const updatedList = [...prev]
            const existingIndex = updatedList.findIndex((g) => g.sender_id === senderId)

            if (existingIndex >= 0) {
              updatedList[existingIndex] = {
                ...updatedList[existingIndex],
                total_gift_coins:
                  updatedList[existingIndex].total_gift_coins +
                  (newGift.amount || 0) * (newGift.quantity || 1),
                total_gifts: updatedList[existingIndex].total_gifts + (newGift.quantity || 1),
                last_gift_at: newGift.created_at,
              }
            } else {
              // Add new gifter
              updatedList.push({
                sender_id: senderId,
                sender_username: newGift.sender_username || 'Unknown',
                sender_avatar_url: newGift.sender_avatar_url,
                total_gift_coins: (newGift.amount || 0) * (newGift.quantity || 1),
                total_gifts: newGift.quantity || 1,
                last_gift_at: newGift.created_at,
                rank: 0,
              })
            }

            // Re-sort and re-rank
            return updatedList
              .sort((a, b) => b.total_gift_coins - a.total_gift_coins)
              .slice(0, limit)
              .map((gifter, index) => ({
                ...gifter,
                rank: index + 1,
              }))
          })

          // Throttle full refresh to every 5+ seconds
          const now = Date.now()
          if (now - lastRefreshRef.current > 5000) {
            fetchTopGifters()
            lastRefreshRef.current = now
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, limit, fetchTopGifters])

  return {
    topGifters,
    isLoading,
    error,
    refetch: fetchTopGifters,
  }
}
