import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/supabaseClient'
import { useAuthStore } from '@/lib/store'

export interface CreditScoreData {
  user_id: string
  score: number
  tier?: string
  trend_7d?: number
  trend_30d?: number
  updated_at?: string
}

export function useCreditScore(targetUserId?: string) {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CreditScoreData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const userId = targetUserId || user?.id
  const fetchingRef = useRef(false)

  const fetchCredit = useCallback(async () => {
    if (!userId || fetchingRef.current) return
    fetchingRef.current = true

    setLoading(true)
    setError(null)
    try {
      const { data: row, error: err } = await supabase
        .from('user_credit')
        .select('user_id, score, tier, trend_7d, trend_30d, updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (err && err.code !== 'PGRST116') throw err
      
      if (row) {
        setData({
          user_id: row.user_id,
          score: row.score ?? 400,
          tier: row.tier ?? 'Unknown',
          trend_7d: row.trend_7d ?? 0,
          trend_30d: row.trend_30d ?? 0,
          updated_at: row.updated_at ?? new Date().toISOString()
        } as CreditScoreData)
      } else {
        setData({
          user_id: userId,
          score: 400,
          tier: 'Unknown',
          trend_7d: 0,
          trend_30d: 0,
          updated_at: new Date().toISOString()
        })
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load credit score')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [userId])

  // Initial fetch when user changes
  useEffect(() => {
    fetchCredit()
  }, [fetchCredit])

  // Realtime subscription — only set up once per user
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`credit-score-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credit',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchCredit()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchCredit])

  return { data, loading, error, refresh: fetchCredit }
}
