import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

// ============================================================================
// Types
// ============================================================================

export interface SmokeathonEvent {
  id: string
  title: string
  description: string | null
  status: 'upcoming' | 'active' | 'paused' | 'completed' | 'cancelled'
  event_start_at: string
  event_end_at: string | null
  stream_id: string | null
  raffle_ticket_price: number
  max_raffle_entries_per_user: number
  raffle_winner_id: string | null
  participation_bonus_coins: number
  dj_user_id: string | null
  music_request_cost: number
  trivia_reward_coins: number
  tro_drop_enabled: boolean
  max_seats: number
  total_participants: number
  total_raffle_entries: number
  total_music_requests: number
  total_trivia_answers: number
  total_tro_drops: number
  total_coins_distributed: number
}

export interface SmokeathonParticipant {
  id: string
  event_id: string
  user_id: string
  joined_at: string
  bonus_claimed: boolean
  bonus_claimed_at: string | null
  raffle_ticket_count: number
  songs_requested: number
  trivia_correct_answers: number
  trivia_rewarded_coins: number
  tro_drop_collected_coins: number
  seat_index: number | null
  seated_at: string | null
}

export interface MusicRequest {
  id: string
  event_id: string
  user_id: string
  username: string
  song_title: string
  artist: string | null
  cost_paid: number
  status: 'pending' | 'playing' | 'completed' | 'skipped' | 'cancelled'
  queue_position: number | null
  requested_at: string
}

// ============================================================================
// Hook
// ============================================================================

export function useSmokeathon(eventId?: string) {
  const { user } = useAuthStore()
  const [event, setEvent] = useState<SmokeathonEvent | null>(null)
  const [participant, setParticipant] = useState<SmokeathonParticipant | null>(null)
  const [musicQueue, setMusicQueue] = useState<MusicRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch event status
  const fetchEvent = useCallback(async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc('smokeathon_get_status', {
        p_event_id: eventId || null
      })

      if (rpcError) throw rpcError
      if (data?.success === false) throw new Error(data.message || 'Event not found')

      setEvent(data.event as SmokeathonEvent)
    } catch (err: any) {
      console.error('Failed to fetch smokeathon event:', err)
      setError(err.message)
    }
  }, [eventId])

  // Fetch participant status
  const fetchParticipant = useCallback(async () => {
    if (!user || !eventId) return

    try {
      const { data, error: queryError } = await supabase
        .from('smokeathon_participants')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .single()

      if (queryError && queryError.code !== 'PGRST116') throw queryError
      setParticipant(data as SmokeathonParticipant | null)
    } catch (err: any) {
      console.error('Failed to fetch participant:', err)
    }
  }, [user, eventId])

  // Fetch music queue
  const fetchMusicQueue = useCallback(async () => {
    if (!eventId) return

    try {
      const { data, error: queryError } = await supabase
        .from('smokeathon_music_requests')
        .select('*')
        .eq('event_id', eventId)
        .in('status', ['pending', 'playing'])
        .order('queue_position', { ascending: true })
        .limit(20)

      if (queryError) throw queryError
      setMusicQueue((data || []) as MusicRequest[])
    } catch (err: any) {
      console.error('Failed to fetch music queue:', err)
    }
  }, [eventId])

  // Initial fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchEvent()
      await fetchParticipant()
      await fetchMusicQueue()
      setLoading(false)
    }
    load()
  }, [fetchEvent, fetchParticipant, fetchMusicQueue])

  // Realtime subscription
  useEffect(() => {
    if (!eventId) return

    const eventChannel = supabase
      .channel(`smokeathon-event-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'smokeathon_events',
          filter: `id=eq.${eventId}`
        },
        () => fetchEvent()
      )
      .subscribe()

    const participantChannel = supabase
      .channel(`smokeathon-participant-${eventId}-${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'smokeathon_participants',
          filter: `event_id=eq.${eventId}`
        },
        () => fetchParticipant()
      )
      .subscribe()

    const musicChannel = supabase
      .channel(`smokeathon-music-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'smokeathon_music_requests',
          filter: `event_id=eq.${eventId}`
        },
        () => fetchMusicQueue()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(eventChannel)
      supabase.removeChannel(participantChannel)
      supabase.removeChannel(musicChannel)
    }
  }, [eventId, user?.id, fetchEvent, fetchParticipant, fetchMusicQueue])

  // ==========================================================================
  // Actions
  // ==========================================================================

  // Claim participation bonus
  const claimBonus = useCallback(async () => {
    if (!user || !eventId) {
      toast.error('You must be logged in to claim the bonus')
      return false
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('smokeathon_claim_bonus', {
        p_event_id: eventId,
        p_user_id: user.id
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        toast.success(`🎉 ${data.message} (+${data.coins} coins!)`)
        await fetchParticipant()
        await fetchEvent()
        return true
      } else {
        toast.error(data?.message || 'Failed to claim bonus')
        return false
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim bonus')
      return false
    }
  }, [user, eventId, fetchParticipant, fetchEvent])

  // Buy raffle ticket
  const buyRaffleTicket = useCallback(async () => {
    if (!user || !eventId) {
      toast.error('You must be logged in to enter the raffle')
      return false
    }

    try {
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user'

      const { data, error: rpcError } = await supabase.rpc('smokeathon_buy_raffle_ticket', {
        p_event_id: eventId,
        p_user_id: user.id,
        p_username: username
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        toast.success(`🎫 ${data.message} (#${data.ticket_number})`)
        await fetchParticipant()
        await fetchEvent()
        return true
      } else {
        toast.error(data?.message || 'Failed to buy ticket')
        return false
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to buy ticket')
      return false
    }
  }, [user, eventId, fetchParticipant, fetchEvent])

  // Request a song
  const requestSong = useCallback(async (songTitle: string, artist?: string) => {
    if (!user || !eventId) {
      toast.error('You must be logged in to request a song')
      return false
    }

    if (!songTitle.trim()) {
      toast.error('Please enter a song title')
      return false
    }

    try {
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user'

      const { data, error: rpcError } = await supabase.rpc('smokeathon_request_song', {
        p_event_id: eventId,
        p_user_id: user.id,
        p_username: username,
        p_song_title: songTitle.trim(),
        p_artist: artist?.trim() || null
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        toast.success(`🎵 ${data.message} (Position #${data.queue_position})`)
        await fetchParticipant()
        await fetchMusicQueue()
        return true
      } else {
        toast.error(data?.message || 'Failed to request song')
        return false
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to request song')
      return false
    }
  }, [user, eventId, fetchParticipant, fetchMusicQueue])

  // Admin: Reward trivia winner
  const rewardTriviaWinner = useCallback(async (targetUserId: string, username: string, questionNumber?: number) => {
    if (!user || !eventId) return false

    try {
      const { data, error: rpcError } = await supabase.rpc('smokeathon_reward_trivia', {
        p_event_id: eventId,
        p_user_id: targetUserId,
        p_username: username,
        p_reward_amount: event?.trivia_reward_coins || 50,
        p_question_number: questionNumber || null,
        p_admin_id: user.id
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        toast.success(`🏆 ${data.message}`)
        await fetchEvent()
        return true
      } else {
        toast.error(data?.message || 'Failed to reward')
        return false
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reward')
      return false
    }
  }, [user, eventId, event?.trivia_reward_coins, fetchEvent])

  // Admin: Trigger Tro Drop
  const triggerTroDrop = useCallback(async (totalAmount: number, perClick: number = 5, maxPerUser: number = 100) => {
    if (!user || !eventId) return false

    try {
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'host'

      const { data, error: rpcError } = await supabase.rpc('smokeathon_trigger_drop', {
        p_event_id: eventId,
        p_activator_id: user.id,
        p_activator_username: username,
        p_total_amount: totalAmount,
        p_per_click: perClick,
        p_max_per_user: maxPerUser
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        toast.success(`🪙 ${data.message}`)
        await fetchEvent()
        return true
      } else {
        toast.error(data?.message || 'Failed to trigger drop')
        return false
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger drop')
      return false
    }
  }, [user, eventId, fetchEvent])

  // Admin: Draw raffle winner
  const drawRaffle = useCallback(async (winnerId?: string) => {
    if (!user || !eventId) return false

    try {
      const { data, error: rpcError } = await supabase.rpc('smokeathon_draw_raffle', {
        p_event_id: eventId,
        p_winner_user_id: winnerId || null,
        p_admin_id: user.id
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        toast.success(`🎰 ${data.message}`)
        await fetchEvent()
        return true
      } else {
        toast.error(data?.message || 'Failed to draw raffle')
        return false
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to draw raffle')
      return false
    }
  }, [user, eventId, fetchEvent])

  // Admin: Set DJ
  const setDj = useCallback(async (djUserId: string) => {
    if (!user || !eventId) return false

    try {
      const { data, error: rpcError } = await supabase.rpc('smokeathon_set_dj', {
        p_event_id: eventId,
        p_dj_user_id: djUserId
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        toast.success('🎧 DJ set!')
        await fetchEvent()
        return true
      } else {
        toast.error(data?.message || 'Failed to set DJ')
        return false
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to set DJ')
      return false
    }
  }, [user, eventId, fetchEvent])

  // Admin: Set stream
  const setStream = useCallback(async (streamId: string, status: string = 'active') => {
    if (!user || !eventId) return false

    try {
      const { data, error: rpcError } = await supabase.rpc('smokeathon_set_stream', {
        p_event_id: eventId,
        p_stream_id: streamId,
        p_status: status
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        toast.success('📺 Stream set!')
        await fetchEvent()
        return true
      } else {
        toast.error(data?.message || 'Failed to set stream')
        return false
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to set stream')
      return false
    }
  }, [user, eventId, fetchEvent])

  return {
    // State
    event,
    participant,
    musicQueue,
    loading,
    error,

    // User actions
    claimBonus,
    buyRaffleTicket,
    requestSong,

    // Admin actions
    rewardTriviaWinner,
    triggerTroDrop,
    drawRaffle,
    setDj,
    setStream,

    // Refresh
    refresh: async () => {
      await Promise.all([fetchEvent(), fetchParticipant(), fetchMusicQueue()])
    }
  }
}

export default useSmokeathon
