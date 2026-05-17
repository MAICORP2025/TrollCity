import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useLeagueMissions } from './useLeagueMissions'
import { buildUserLeagueProgress, UserLeagueProgress } from '../lib/leagueHelpers'

export interface LeagueEvent {
  id: string
  name: string
  slug: string
  type: string
  status: 'scheduled' | 'active' | 'ended' | 'archived'
  starts_at: string
  ends_at: string
  metadata?: Record<string, any>
  points_multiplier?: number
}

export interface LeaderboardRow {
  supporter_id?: string | null
  supporter_username?: string | null
  supporter_display_name?: string | null
  supporter_avatar_url?: string | null
  broadcaster_id?: string | null
  broadcaster_username?: string | null
  broadcaster_display_name?: string | null
  stream_id?: string | null
  gift_coins?: number | null
  total_gifts?: number | null
  score?: number | null
  rank?: number | null
}

interface UseLeagueSnapshotOptions {
  streamId?: string | null
  category?: string | null
  broadcasterId?: string | null
  limit?: number
}

export function useLeagueSnapshot({
  streamId,
  category,
  broadcasterId,
  limit = 10,
}: UseLeagueSnapshotOptions) {
  const { user, profile } = useAuthStore()
  const [activeEvent, setActiveEvent] = useState<LeagueEvent | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [userRank, setUserRank] = useState<number | null>(null)
  const [userLeagueProgress, setUserLeagueProgress] = useState<UserLeagueProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    missions,
    refreshMissions,
    claimMission,
    isClaiming: isClaimingMission,
    claimingMissionId,
  } = useLeagueMissions(activeEvent?.id ?? null)

  const fetchLeagueSnapshot = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await supabase.rpc('ensure_league_system_ready')

      const now = new Date().toISOString()
      const { data: eventData, error: eventError } = await supabase
        .from('league_events')
        .select('id, name, slug, type, status, starts_at, ends_at, metadata, points_multiplier')
        .eq('status', 'active')
        .lte('starts_at', now)
        .gte('ends_at', now)
        .order('starts_at', { ascending: false })
        .limit(1)

      if (eventError && eventError.code !== 'PGRST104') {
        throw eventError
      }

      if (!eventData || eventData.length === 0) {
        setActiveEvent(null)
        setLeaderboard([])
        setUserRank(null)
        setUserLeagueProgress(null)
        setIsLoading(false)
        return
      }

      const event = eventData[0]
      setActiveEvent({
        id: event.id,
        name: event.name,
        slug: event.slug,
        type: event.type,
        status: event.status,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        metadata: event.metadata,
        points_multiplier: event.points_multiplier,
      })

      const leaderboardQuery = supabase
        .from('league_leaderboard_snapshots')
        .select(
          'user_id, username, display_name, avatar_url, stream_id, rank, score, total_gifts, stream_count, battle_count, mission_count'
        )
        .eq('league_event_id', event.id)
        .order('rank', { ascending: true })
        .limit(limit)

      if (streamId) {
        leaderboardQuery.eq('stream_id', streamId)
      }

      const { data: snapshotData, error: snapshotError } = await leaderboardQuery
      if (snapshotError && snapshotError.code !== 'PGRST104') {
        throw snapshotError
      }

      let leaderboardRows = Array.isArray(snapshotData) ? snapshotData : []
      if (leaderboardRows.length === 0 && streamId) {
        const fallback = await supabase
          .from('league_leaderboard_snapshots')
          .select('user_id, username, display_name, avatar_url, stream_id, rank, score, total_gifts, stream_count, battle_count, mission_count')
          .eq('league_event_id', event.id)
          .order('rank', { ascending: true })
          .limit(limit)

        if (fallback.error && fallback.error.code !== 'PGRST104') {
          throw fallback.error
        }

        leaderboardRows = Array.isArray(fallback.data) ? fallback.data : []
      }

      setLeaderboard(
        leaderboardRows.map((row: any, index: number) => ({
          supporter_id: row.user_id,
          supporter_username: row.username,
          supporter_display_name: row.display_name,
          supporter_avatar_url: row.avatar_url,
          stream_id: row.stream_id,
          score: Number(row.score ?? 0),
          gift_coins: Number(row.score ?? 0),
          total_gifts: Number(row.total_gifts ?? 0),
          rank: row.rank ?? index + 1,
        }))
      )

      if (user?.id) {
        const { data: rankData } = await supabase
          .from('league_leaderboard_snapshots')
          .select('rank')
          .eq('league_event_id', event.id)
          .eq('user_id', user.id)
          .single()

        setUserRank(rankData?.rank ?? null)
      }

      if (user?.id) {
        const { data: statsData } = await supabase
          .from('user_stats')
          .select('level, xp_total, xp_to_next_level, xp_progress')
          .eq('user_id', user.id)
          .maybeSingle()

        setUserLeagueProgress(buildUserLeagueProgress(statsData ?? undefined, profile ?? undefined))
      } else {
        setUserLeagueProgress(buildUserLeagueProgress(undefined, profile ?? undefined))
      }
    } catch (err) {
      console.error('[useLeagueSnapshot] Error fetching league snapshot:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch league data')
    } finally {
      setIsLoading(false)
    }
  }, [streamId, limit, profile, user?.id])

  useEffect(() => {
    fetchLeagueSnapshot()
  }, [fetchLeagueSnapshot])

  useEffect(() => {
    const channel = supabase.channel(`league-system-${streamId || 'global'}`)

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_events' },
        () => fetchLeagueSnapshot()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_leaderboard_snapshots' },
        () => fetchLeagueSnapshot()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_league_missions', filter: `user_id=eq.${user?.id ?? 'unknown'}` },
        () => refreshMissions()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stats', filter: `user_id=eq.${user?.id ?? 'unknown'}` },
        () => fetchLeagueSnapshot()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLeagueSnapshot, refreshMissions, streamId, user?.id])

  const refreshLeague = useCallback(async () => {
    await fetchLeagueSnapshot()
    await refreshMissions()
  }, [fetchLeagueSnapshot, refreshMissions])

  return {
    activeEvent,
    leaderboard,
    isLoading,
    error,
    userRank,
    userLeagueProgress,
    missions,
    claimMission,
    isClaimingMission,
    claimingMissionId,
    refreshLeague,
  }
}
