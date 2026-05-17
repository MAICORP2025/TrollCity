import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type {
  TrollSeat,
  TrollSeatCoinReceivedMap,
  TrollSeatUserProfile,
} from './trollSeatsTypes'
import {
  buildGoldenRingMap,
  sortTrollSeats,
} from './trollSeatsUtils'
import {
  chargeTrollSeatPrice,
  refundTrollSeatHalf,
} from './trollSeatCoinAdapter'

interface UseTrollSeatsOptions {
  streamId: string
  broadcasterId: string
  currentUserId?: string | null
  enabled?: boolean
}

export function useTrollSeats({
  streamId,
  broadcasterId,
  currentUserId,
  enabled = true,
}: UseTrollSeatsOptions) {
  const [trollSeats, setTrollSeats] = useState<TrollSeat[]>([])
  const [profilesByUserId, setProfilesByUserId] = useState<Record<string, TrollSeatUserProfile>>({})
  const [coinsReceivedByUserId, setCoinsReceivedByUserId] = useState<TrollSeatCoinReceivedMap>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadTrollSeats = useCallback(async () => {
    if (!enabled || !streamId) return

    setLoading(true)

    const { data, error } = await supabase
      .from('stream_trollseats')
      .select('*')
      .eq('stream_id', streamId)
      .neq('status', 'removed')
      .order('seat_index', { ascending: true })

    setLoading(false)

    if (error) {
      console.error('[TrollSeats] load failed:', error)
      setMessage(error.message)
      return
    }

    setTrollSeats((data || []) as TrollSeat[])
  }, [enabled, streamId])

  const loadProfiles = useCallback(async (seats: TrollSeat[]) => {
    const userIds = Array.from(
      new Set(
        seats
          .map((seat) => seat.user_id)
          .filter(Boolean)
      )
    ) as string[]

    if (!userIds.length) {
      setProfilesByUserId({})
      return
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, profile_image_url, photo_url, role')
      .in('id', userIds)

    if (error) {
      console.warn('[TrollSeats] profile load failed:', error)
      return
    }

    const map: Record<string, TrollSeatUserProfile> = {}

    for (const profile of data || []) {
      map[profile.id] = profile
    }

    setProfilesByUserId(map)
  }, [])

  /**
   * This assumes your gift/event table stores stream_id, receiver_id, and coin amount.
   * If your table/columns are named differently, adjust this one query only.
   */
  const loadGoldenRingTotals = useCallback(async (seats: TrollSeat[]) => {
    const occupiedUserIds = Array.from(
      new Set(
        seats
          .filter((seat) => seat.status === 'occupied' && seat.user_id)
          .map((seat) => seat.user_id as string)
      )
    )

    if (!occupiedUserIds.length) {
      setCoinsReceivedByUserId({})
      return
    }

    const { data, error } = await supabase
      .from('gift_transactions')
      .select('receiver_id, coin_amount')
      .eq('stream_id', streamId)
      .in('receiver_id', occupiedUserIds)

    if (error) {
      console.warn('[TrollSeats] golden ring totals failed:', error)
      return
    }

    const totals: TrollSeatCoinReceivedMap = {}

    for (const row of data || []) {
      const receiverId = row.receiver_id as string
      const amount = Number(row.coin_amount || 0)
      totals[receiverId] = (totals[receiverId] || 0) + amount
    }

    setCoinsReceivedByUserId(totals)
  }, [streamId])

  useEffect(() => {
    loadTrollSeats()
  }, [loadTrollSeats])

  useEffect(() => {
    loadProfiles(trollSeats)
    loadGoldenRingTotals(trollSeats)
  }, [trollSeats, loadProfiles, loadGoldenRingTotals])

  useEffect(() => {
    if (!enabled || !streamId) return

    const channel = supabase
      .channel(`trollseats:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_trollseats',
          filter: `stream_id=eq.${streamId}`,
        },
        () => {
          loadTrollSeats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, streamId, loadTrollSeats])

  /**
   * Realtime gift subscription only refreshes golden ring totals.
   * It does not rewrite gift logic.
   */
  useEffect(() => {
    if (!enabled || !streamId) return

    const channel = supabase
      .channel(`trollseats-gifts:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_transactions',
          filter: `stream_id=eq.${streamId}`,
        },
        () => {
          loadGoldenRingTotals(trollSeats)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, streamId, trollSeats, loadGoldenRingTotals])

  const addTrollSeat = useCallback(async (seatPrice = 0) => {
    setMessage(null)

    const activeCount = trollSeats.filter((seat) => seat.status !== 'removed').length

    if (activeCount >= 6) {
      setMessage('Maximum TrollSeats is 6.')
      return null
    }

    const { data, error } = await supabase.rpc('add_trollseat', {
      p_stream_id: streamId,
      p_broadcaster_id: broadcasterId,
      p_seat_price: Math.max(0, Number(seatPrice || 0)),
    })

    if (error) {
      console.error('[TrollSeats] add failed:', error)
      setMessage(error.message)
      return null
    }

    await loadTrollSeats()
    return data as TrollSeat
  }, [streamId, broadcasterId, trollSeats, loadTrollSeats])

  const deductTrollSeat = useCallback(async () => {
    setMessage(null)

    const { data, error } = await supabase.rpc('deduct_trollseat', {
      p_stream_id: streamId,
      p_broadcaster_id: broadcasterId,
    })

    if (error) {
      console.error('[TrollSeats] deduct failed:', error)
      setMessage(error.message)
      return null
    }

    if (data && data.ok === false) {
      setMessage(data.message || 'No empty TrollSeat can be deducted.')
    }

    await loadTrollSeats()
    return data
  }, [streamId, broadcasterId, loadTrollSeats])

  const requestOrPayForTrollSeat = useCallback(async () => {
    if (!currentUserId) {
      setMessage('Sign in to request a TrollSeat.')
      return null
    }

    setMessage(null)

    const { data: requested, error: requestError } = await supabase.rpc('request_trollseat', {
      p_stream_id: streamId,
      p_user_id: currentUserId,
    })

    if (requestError) {
      console.error('[TrollSeats] request failed:', requestError)
      setMessage(requestError.message)
      return null
    }

    const seat = requested as TrollSeat

    if (seat.seat_price > 0 && seat.status === 'pending_payment') {
      await chargeTrollSeatPrice({
        streamId,
        userId: currentUserId,
        broadcasterId: seat.broadcaster_id,
        amount: seat.seat_price,
        trollSeatId: seat.id,
      })

      const { data: paidSeat, error: paidError } = await supabase.rpc('mark_trollseat_paid', {
        p_trollseat_id: seat.id,
        p_user_id: currentUserId,
        p_paid_amount: seat.seat_price,
      })

      if (paidError) {
        console.error('[TrollSeats] mark paid failed:', paidError)
        setMessage(paidError.message)
        return null
      }

      await loadTrollSeats()
      return paidSeat as TrollSeat
    }

    await loadTrollSeats()
    return seat
  }, [streamId, currentUserId, loadTrollSeats])

  const approveTrollSeatCohost = useCallback(async (trollSeatId: string) => {
    setMessage(null)

    const { data, error } = await supabase.rpc('approve_trollseat_cohost', {
      p_trollseat_id: trollSeatId,
      p_broadcaster_id: broadcasterId,
    })

    if (error) {
      console.error('[TrollSeats] approve failed:', error)
      setMessage(error.message)
      return null
    }

    await loadTrollSeats()
    return data as TrollSeat
  }, [broadcasterId, loadTrollSeats])

  const leaveTrollSeat = useCallback(async (trollSeatId: string) => {
    if (!currentUserId) return null

    setMessage(null)

    const { data, error } = await supabase.rpc('leave_trollseat', {
      p_trollseat_id: trollSeatId,
      p_user_id: currentUserId,
    })

    if (error) {
      console.error('[TrollSeats] leave failed:', error)
      setMessage(error.message)
      return null
    }

    await loadTrollSeats()
    return data as TrollSeat
  }, [currentUserId, loadTrollSeats])

  const processBroadcastEndRefunds = useCallback(async () => {
    setMessage(null)

    const { data, error } = await supabase.rpc('mark_trollseat_half_refund_due', {
      p_stream_id: streamId,
      p_broadcaster_id: broadcasterId,
    })

    if (error) {
      console.error('[TrollSeats] refund mark failed:', error)
      setMessage(error.message)
      return []
    }

    const refundRows = (data || []) as TrollSeat[]

    for (const seat of refundRows) {
      if (!seat.user_id || !seat.refunded_amount || seat.refunded_amount <= 0) continue

      await refundTrollSeatHalf({
        streamId,
        userId: seat.user_id,
        broadcasterId,
        amount: seat.refunded_amount,
        trollSeatId: seat.id,
      })
    }

    await loadTrollSeats()
    return refundRows
  }, [streamId, broadcasterId, loadTrollSeats])

  const sortedTrollSeats = useMemo(() => sortTrollSeats(trollSeats), [trollSeats])

  const goldenRingByUserId = useMemo(
    () => buildGoldenRingMap(coinsReceivedByUserId),
    [coinsReceivedByUserId]
  )

  return {
    trollSeats: sortedTrollSeats,
    profilesByUserId,
    coinsReceivedByUserId,
    goldenRingByUserId,
    loading,
    message,

    loadTrollSeats,
    addTrollSeat,
    deductTrollSeat,
    requestOrPayForTrollSeat,
    approveTrollSeatCohost,
    leaveTrollSeat,
    processBroadcastEndRefunds,

    clearMessage: () => setMessage(null),
  }
}