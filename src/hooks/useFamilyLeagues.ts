/**
 * Hooks for fetching Troll Family goals, league data, and progress
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

// Types
export interface FamilyGoal {
  id: string
  family_id: string
  title: string
  description?: string
  category: 'daily' | 'weekly' | 'monthly'
  difficulty: 'easy' | 'medium' | 'hard' | 'elite'
  target_value: number
  current_value: number
  status: 'active' | 'completed' | 'expired' | 'failed'
  reward_coins: number
  bonus_coins: number
  reward_xp: number
  goal_type: string
  expires_at: string
  completed_at?: string
}

export interface FamilyGoalProgress {
  id: string
  goal_id: string
  user_id: string
  family_id: string
  contribution_value: number
  last_activity_at: string
}

export interface LeagueSeason {
  id: string
  season_number: number
  season_start_date: string
  season_end_date: string
  is_active: boolean
  is_completed: boolean
  name?: string
  description?: string
  theme?: string
}

export interface LeagueStanding {
  id: string
  season_id: string
  family_id: string
  rank: number
  points: number
  wins: number
  losses: number
  goals_completed: number
  goals_failed: number
  members_active: number
  total_member_activity: number
  participation_rate: number
  coins_earned: number
  xp_earned: number
  bonus_coins: number
  created_at: string
  updated_at: string
}

/**
 * Hook to fetch active family goals for a family
 */
export function useFamilyGoals(familyId?: string) {
  const [goals, setGoals] = useState<FamilyGoal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    if (!familyId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: err } = await supabase
        .from('family_goals')
        .select('*')
        .eq('family_id', familyId)
        .eq('status', 'active')
        .order('category', { ascending: false })
        .order('expires_at', { ascending: true })

      if (err) throw err

      setGoals(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch goals'
      setError(message)
      console.error('[useFamilyGoals]', message)
    } finally {
      setLoading(false)
    }
  }, [familyId])

  useEffect(() => {
    fetchGoals()

    // Set up realtime subscription
    if (!familyId) return

    const subscription = supabase
      .channel(`family_goals:${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_goals',
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          // Refetch on any change
          fetchGoals()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [familyId, fetchGoals])

  return { goals, loading, error, refetch: fetchGoals }
}

/**
 * Hook to fetch current user's family progress on goals
 */
export function useFamilyGoalProgress(familyId?: string) {
  const { user } = useAuthStore()
  const [progress, setProgress] = useState<FamilyGoalProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    if (!familyId || !user?.id) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: err } = await supabase
        .from('family_goal_progress')
        .select('*')
        .eq('family_id', familyId)
        .eq('user_id', user.id)

      if (err) throw err

      setProgress(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch progress'
      setError(message)
      console.error('[useFamilyGoalProgress]', message)
    } finally {
      setLoading(false)
    }
  }, [familyId, user?.id])

  useEffect(() => {
    fetchProgress()

    // Set up realtime subscription
    if (!familyId || !user?.id) return

    const subscription = supabase
      .channel(`family_goal_progress:${familyId}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_goal_progress',
          filter: `family_id=eq.${familyId},user_id=eq.${user.id}`,
        },
        () => {
          fetchProgress()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [familyId, user?.id, fetchProgress])

  return { progress, loading, error, refetch: fetchProgress }
}

/**
 * Hook to fetch current league season
 */
export function useLeagueSeason() {
  const [season, setSeason] = useState<LeagueSeason | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSeason = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: err } = await supabase
        .from('troll_family_league_seasons')
        .select('*')
        .eq('is_active', true)
        .maybeSingle()

      if (err) throw err

      setSeason(data || null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch season'
      setError(message)
      console.error('[useLeagueSeason]', message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSeason()

    // Refetch periodically (seasons rarely change)
    const interval = setInterval(fetchSeason, 60000)

    return () => clearInterval(interval)
  }, [fetchSeason])

  return { season, loading, error, refetch: fetchSeason }
}

/**
 * Hook to fetch league standings for current season
 */
export function useLeagueStandings() {
  const { season } = useLeagueSeason()
  const [standings, setStandings] = useState<LeagueStanding[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStandings = useCallback(async () => {
    if (!season?.id) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: err } = await supabase
        .from('troll_family_league_standings')
        .select(`
          *,
          troll_families:family_id (id, name, tag, crest_url, banner_url, level)
        `)
        .eq('season_id', season.id)
        .order('rank', { ascending: true })

      if (err) throw err

      setStandings(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch standings'
      setError(message)
      console.error('[useLeagueStandings]', message)
    } finally {
      setLoading(false)
    }
  }, [season?.id])

  useEffect(() => {
    fetchStandings()

    // Set up realtime subscription
    if (!season?.id) return

    const subscription = supabase
      .channel(`league_standings:${season.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'troll_family_league_standings',
          filter: `season_id=eq.${season.id}`,
        },
        () => {
          fetchStandings()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [season?.id, fetchStandings])

  return { standings, season, loading, error, refetch: fetchStandings }
}

/**
 * Hook to fetch user's family standing for current season
 */
export function useMyFamilyLeagueStanding() {
  const { user } = useAuthStore()
  const { season } = useLeagueSeason()
  const [standing, setStanding] = useState<LeagueStanding | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStanding = useCallback(async () => {
    if (!user?.id || !season?.id) return

    setLoading(true)
    setError(null)

    try {
      // First, get user's family
      const { data: membership, error: membershipErr } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .eq('approval_status', 'approved')
        .maybeSingle()

      if (membershipErr) throw membershipErr

      if (!membership) {
        setStanding(null)
        setFamilyId(null)
        return
      }

      setFamilyId(membership.family_id)

      // Then get their family's standing
      const { data, error: err } = await supabase
        .from('troll_family_league_standings')
        .select('*')
        .eq('season_id', season.id)
        .eq('family_id', membership.family_id)
        .maybeSingle()

      if (err) throw err

      setStanding(data || null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch standing'
      setError(message)
      console.error('[useMyFamilyLeagueStanding]', message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, season?.id])

  useEffect(() => {
    fetchStanding()

    // Set up realtime subscription
    if (!user?.id || !season?.id || !familyId) return

    const subscription = supabase
      .channel(`my_league_standing:${season.id}:${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'troll_family_league_standings',
          filter: `season_id=eq.${season.id},family_id=eq.${familyId}`,
        },
        () => {
          fetchStanding()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user?.id, season?.id, familyId, fetchStanding])

  return { standing, familyId, season, loading, error, refetch: fetchStanding }
}
