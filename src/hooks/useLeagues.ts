import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import type { UserLeague } from './useUserLeagues'

export interface UseLeaguesResult {
  publicLeagues: UserLeague[]
  isLoading: boolean
  error: string | null
  refreshLeagues: () => Promise<void>
}

export function useLeagues(): UseLeaguesResult {
  const { user } = useAuthStore()
  const [publicLeagues, setPublicLeagues] = useState<UserLeague[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPublicLeagues = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('user_leagues')
        .select('*')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('league_score', { ascending: false })
        .limit(50)

      if (fetchError) {
        if (fetchError.code === '42P01') {
        // Table doesn't exist yet
          setPublicLeagues([])
          setIsLoading(false)
          return
        }
        throw fetchError
      }

      setPublicLeagues(Array.isArray(data) ? data as UserLeague[] : [])
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useLeagues] Failed to load public leagues:', err)
      }
      setError(err instanceof Error ? err.message : 'Failed to load leagues')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPublicLeagues()
  }, [fetchPublicLeagues])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel('public-leagues')
    channel
      // OPTIMIZED: Only listen to INSERT/UPDATE (not DELETE) and only for public leagues
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_leagues' }, () => fetchPublicLeagues())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_leagues' }, () => fetchPublicLeagues())
      .subscribe()

    return () => { 
      if (channel) {
        supabase.removeChannel(channel) 
      }
    }
  }, [fetchPublicLeagues, user?.id])

  return {
    publicLeagues,
    isLoading,
    error,
    refreshLeagues: fetchPublicLeagues,
  }
}
