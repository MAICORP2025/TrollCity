import { useEffect, useState, useCallback } from 'react'
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

  const fetchCredit = useCallback(async () => {
    const userId = targetUserId || user?.id
    if (!userId) return

    setLoading(true)
    setError(null)
    try {
      // Fetch credit_score and trends from user_credit
          const { data: row, error: err } = await supabase
            .from('user_credit')
            .select('user_id, score, tier, trend_7d, trend_30d')
            .eq('user_id', userId)
            .maybeSingle()

      if (err && err.code !== 'PGRST116') throw err
      
      // PGRST116 means no rows found - that's ok
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
            // If no credit row found, provide default values
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
      console.error('Credit score fetch error:', e)
      setError(e?.message || 'Failed to load credit score')
    } finally {
      setLoading(false)
    }
  }, [targetUserId, user?.id])

  useEffect(() => {
    fetchCredit()
  }, [fetchCredit])

  return { data, loading, error, refresh: fetchCredit }
}
