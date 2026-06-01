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

export function useStreamTopGifters({
  streamId,
  limit = 8,
  refreshIntervalMs = 15000,
}: UseStreamTopGiftersOptions) {
  const [topGifters, setTopGifters] = useState<TopGifter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastRefreshRef = useRef<number>(0)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTopGifters = useCallback(async () => {
    if (!streamId) return

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase
        .rpc('stream_top_gifters', { p_stream_id: streamId, p_limit: limit })
        .limit(limit)

      if (rpcError && rpcError.code !== 'PGRST204') {
        console.debug('[useStreamTopGifters] RPC not available, using manual query:', rpcError)

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
          .limit(200)

        if (queryError) throw queryError

        if (!giftData || giftData.length === 0) {
          setTopGifters([])
          setIsLoading(false)
          return
        }

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

  useEffect(() => {
    if (!streamId) {
      setTopGifters([])
      return
    }

    fetchTopGifters()
    lastRefreshRef.current = Date.now()

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

  return {
    topGifters,
    isLoading,
    error,
    refetch: fetchTopGifters,
  }
}
