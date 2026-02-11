import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/supabaseClient'
import { useAuthStore } from '@/lib/store'

export interface CreditScoreData {
  user_id: string
  score: number
  tier: string
  trend_7d: number
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
      const { data: row, error: err } = await supabase
        .from('public_user_credit')
        .select('user_id, score, tier, trend_7d, updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (err && err.code !== 'PGRST116') throw err
      
      // PGRST116 means no rows found - that's ok, just set null data
      if (row) {
        setData(row as CreditScoreData)
      } else {
        // User has no credit score yet - set default
        setData(null)
      }
    } catch (e: any) {
      console.error('Credit score fetch error:', e)
      // Handle JSON coercion errors gracefully
      if (e.message?.includes('cannot coerce') || e.code === '22P02') {
        setError(null)
        setData(null)
      } else {
        setError(e?.message || 'Failed to load credit score')
      }
    } finally {
      setLoading(false)
    }
  }, [targetUserId, user?.id])

  useEffect(() => {
    fetchCredit()
  }, [fetchCredit])

  return { data, loading, error, refresh: fetchCredit }
}
