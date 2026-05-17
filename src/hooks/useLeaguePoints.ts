import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

const callAwardPoints = async (
  userId: string,
  eventType: string,
  points: number,
  streamId?: string | null,
  metadata?: Record<string, unknown>
) => {
  return supabase.rpc('award_league_points', {
    p_user_id: userId,
    p_event_type: eventType,
    p_points: points,
    p_stream_id: streamId,
    p_metadata: metadata ?? {},
  })
}

export function useLeaguePoints() {
  const { user } = useAuthStore()

  const awardGiftPoints = useCallback(
    async (amount: number, streamId?: string | null, metadata?: Record<string, unknown>) => {
      if (!user?.id) return { error: 'No authenticated user' }
      return callAwardPoints(user.id, 'send_gift', amount, streamId, metadata)
    },
    [user?.id]
  )

  const awardWatchPoints = useCallback(
    async (minutes: number, streamId?: string | null, metadata?: Record<string, unknown>) => {
      if (!user?.id) return { error: 'No authenticated user' }
      return callAwardPoints(user.id, 'watch_live_10_min', 25, streamId, { ...metadata, minutes })
    },
    [user?.id]
  )

  const awardBattlePoints = useCallback(
    async (won: boolean, streamId?: string | null, metadata?: Record<string, unknown>) => {
      if (!user?.id) return { error: 'No authenticated user' }
      const eventType = won ? 'win_battle' : 'participate_battle'
      const points = won ? 500 : 150
      return callAwardPoints(user.id, eventType, points, streamId, metadata)
    },
    [user?.id]
  )

  const awardSeatJoinPoints = useCallback(
    async (streamId?: string | null, metadata?: Record<string, unknown>) => {
      if (!user?.id) return { error: 'No authenticated user' }
      return callAwardPoints(user.id, 'join_broadcast_seat', 50, streamId, metadata)
    },
    [user?.id]
  )

  const awardMissionPoints = useCallback(
    async (points: number, streamId?: string | null, metadata?: Record<string, unknown>) => {
      if (!user?.id) return { error: 'No authenticated user' }
      return callAwardPoints(user.id, 'mission_progress', points, streamId, metadata)
    },
    [user?.id]
  )

  const awardPaidChatPoints = useCallback(
    async (sent: boolean, streamId?: string | null, metadata?: Record<string, unknown>) => {
      if (!user?.id) return { error: 'No authenticated user' }
      const eventType = sent ? 'paid_chat_sent' : 'paid_chat_received'
      const points = sent ? 100 : 150
      return callAwardPoints(user.id, eventType, points, streamId, metadata)
    },
    [user?.id]
  )

  const awardBroadcastHostPoints = useCallback(
    async (streamId?: string | null, metadata?: Record<string, unknown>) => {
      if (!user?.id) return { error: 'No authenticated user' }
      return callAwardPoints(user.id, 'host_broadcast_10_min', 75, streamId, metadata)
    },
    [user?.id]
  )

  return {
    awardGiftPoints,
    awardWatchPoints,
    awardBattlePoints,
    awardSeatJoinPoints,
    awardMissionPoints,
    awardPaidChatPoints,
    awardBroadcastHostPoints,
  }
}
