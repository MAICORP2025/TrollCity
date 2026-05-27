import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'

export interface SeatSession {
  id: string
  seat_index: number
  user_id?: string | null
  guest_id?: string | null
  user_profile?: any
  status?: 'empty' | 'reserved' | 'camera_starting' | 'active' | 'live' | 'failed'
  joined_at?: string | null
  left_at?: string | null
  livekit_participant_identity?: string
  seat_price_paid?: number
  updated_at?: string
}

const SUBSCRIBER_DISCOUNT_PERCENT = 0.10 // 10% discount for subscribers

async function checkIsSubscribedToBroadcaster(userId: string, broadcasterId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('subscriber_id', userId)
      .eq('broadcaster_id', broadcasterId)
      .eq('is_active', true)
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}

export function useStreamSeats(
  _streamId?: string,
  _userId?: string,
  _broadcasterProfile?: any,
  _streamData?: any,
) {
  const { user } = useAuthStore()
  const effectiveUserId = _userId || user?.id

  const [seats, setSeats] = useState<Record<number, SeatSession>>({})
  const [mySeat, setMySeat] = useState<SeatSession | null>(null)
  const [joiningSeatId, setJoiningSeatId] = useState<number | null>(null)
  const [leavingSeatId, setLeavingSeatId] = useState<number | null>(null)

  const parseSeatArray = (arr: any[]): { map: Record<number, SeatSession>; mine: SeatSession | null } => {
    const map: Record<number, SeatSession> = {}
    let mine: SeatSession | null = null
    if (!Array.isArray(arr)) return { map, mine }
    for (const s of arr) {
      const idx = Number(s.seat_index)
      const session: SeatSession = {
        id: s.id,
        seat_index: idx,
        user_id: s.user_id || null,
        guest_id: s.guest_id || null,
        user_profile: s.user_profile || s.profile || null,
        status: s.status,
        joined_at: s.joined_at || null,
        left_at: s.left_at || null,
        livekit_participant_identity: s.livekit_participant_identity,
        seat_price_paid: s.seat_price_paid,
        updated_at: s.updated_at,
      }
      map[idx] = session
      if (effectiveUserId && (session.user_id === effectiveUserId || session.guest_id === effectiveUserId)) {
        mine = session
      }
    }
    return { map, mine }
  }

  const fetchSeats = useCallback(async () => {
    if (!_streamId) return
    try {
      const { data, error } = await supabase.rpc('get_stream_seats', { p_stream_id: _streamId })
      if (error) {
        console.warn('[useStreamSeats] fetchSeats error', error)
        return
      }

      // rpc returns jsonb array; data may already be an array
      const arr = Array.isArray(data) ? data : (data || [])
      const { map, mine } = parseSeatArray(arr)
      setSeats(map)
      setMySeat(mine)
    } catch (err) {
      console.warn('[useStreamSeats] fetchSeats failed', err)
    }
  }, [_streamId, effectiveUserId])

  const joinSeat = useCallback(async (seatIndex: number, price: number) => {
    if (!effectiveUserId || !_streamId) {
      toast.error('Login to join a stage seat')
      return false
    }

    // Optimistically set joining state
    setJoiningSeatId(seatIndex)

    // Check for subscriber discount - get broadcaster ID from stream data
    const broadcasterId = (_streamData as any)?.user_id
    let finalPrice = price
    
    if (broadcasterId && effectiveUserId !== broadcasterId) {
      const isSubscribed = await checkIsSubscribedToBroadcaster(effectiveUserId, broadcasterId)
if (isSubscribed && price > 0) {
        finalPrice = Math.max(0, Math.floor(price * (1 - SUBSCRIBER_DISCOUNT_PERCENT)))
        if (finalPrice !== price) {
          console.log(`[useStreamSeats] Subscriber discount applied: ${price} -> ${finalPrice} coins`)
        }
      }
    }

    try {
      const { data, error } = await supabase.rpc('join_seat_atomic', {
        p_stream_id: _streamId,
        p_seat_index: seatIndex,
        p_price: finalPrice,
        p_user_id: effectiveUserId,
      })

      if (error) {
        console.warn('[useStreamSeats] joinSeat rpc error', error)
        toast.error('Failed to join seat')
        setJoiningSeatId(null)
        return false
      }

      const payload = data as any
      if (payload?.success) {
        await fetchSeats()
        setJoiningSeatId(null)
        return true
      }

      toast.error(payload?.message || 'Failed to join seat')
      setJoiningSeatId(null)
      return false
    } catch (err) {
      console.warn('[useStreamSeats] joinSeat failed', err)
      toast.error('Failed to join seat')
      setJoiningSeatId(null)
      return false
    }
  }, [_streamId, effectiveUserId, _streamData, fetchSeats])

  const leaveSeat = useCallback(async () => {
    if (!mySeat) return

    // Optimistically set leaving state
    setLeavingSeatId(mySeat.seat_index)

    try {
      const { data, error } = await supabase.rpc('leave_seat_atomic', { p_session_id: mySeat.id })
      if (error) {
        console.warn('[useStreamSeats] leaveSeat rpc error', error)
        setLeavingSeatId(null)
        return
      }
      if (data && (data as any).success) {
        await fetchSeats()
        setLeavingSeatId(null)
      }
    } catch (err) {
      console.warn('[useStreamSeats] leaveSeat failed', err)
      setLeavingSeatId(null)
    }
  }, [mySeat, fetchSeats])

  const markSeatLive = useCallback(async (seatIndex: number, livekitParticipantIdentity?: string | null) => {
    if (!_streamId) return

    const currentStatus = String(mySeat?.status || '').toLowerCase()
    if (currentStatus === 'active' || currentStatus === 'live') {
      return
    }

    try {
      const rpcPayload: Record<string, any> = {
        p_stream_id: _streamId,
        p_seat_index: seatIndex,
      }

      if (livekitParticipantIdentity) {
        rpcPayload.p_livekit_participant_identity = livekitParticipantIdentity
      }

      const { error } = await supabase.rpc('mark_stream_seat_live', rpcPayload)
      if (error) {
        console.warn('[useStreamSeats] markSeatLive error', error)
        await fetchSeats()
        return
      }
      await fetchSeats()
    } catch (err) {
      console.warn('[useStreamSeats] markSeatLive failed', err)
      await fetchSeats()
      const refreshedStatus = String(mySeat?.status || '').toLowerCase()
      if (refreshedStatus !== 'active' && refreshedStatus !== 'live') {
        toast.error('Failed to go live')
      }
    }
  }, [_streamId, fetchSeats, mySeat?.status])

  const refreshSeats = useCallback(async () => {
    await fetchSeats()
  }, [fetchSeats])

  const handleParticipantDisconnected = useCallback((_identity: string) => {
    // no-op for now; consumer may call refreshSeats
  }, [])

  // minimal request approval helpers (may be replaced by fuller RPCs)
  const approveSeatRequest = useCallback(async (_id: string) => {
    try {
      const { data, error } = await supabase.rpc('approve_seat_request', { p_request_id: _id })
      if (error) throw error
      await fetchSeats()
      return data || null
    } catch (err) {
      console.warn('[useStreamSeats] approveSeatRequest failed', err)
      return null
    }
  }, [fetchSeats])

  const denySeatRequest = useCallback(async (_id: string, _reason?: string) => {
    try {
      const { data, error } = await supabase.rpc('deny_seat_request', { p_request_id: _id, p_reason: _reason || '' })
      if (error) throw error
      await fetchSeats()
      return true
    } catch (err) {
      console.warn('[useStreamSeats] denySeatRequest failed', err)
      return false
    }
  }, [fetchSeats])

  useEffect(() => {
    void fetchSeats()
  }, [fetchSeats])

  // subscribe to realtime seat changes
  useEffect(() => {
    if (!_streamId) return

    const channel = supabase
      .channel(`stream-seats:${_streamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_seat_sessions', filter: `stream_id=eq.${_streamId}` }, (payload) => {
        try {
          const evt = (payload as any).eventType || '*'
          const newRow = (payload as any).new
          const oldRow = (payload as any).old

          setSeats((prev) => {
            const next = { ...prev }
            if (evt === 'DELETE') {
              if (oldRow && typeof oldRow.seat_index !== 'undefined') {
                delete next[Number(oldRow.seat_index)]
              }
            } else {
              const row = newRow || oldRow
              if (row && typeof row.seat_index !== 'undefined') {
                const idx = Number(row.seat_index)
                next[idx] = {
                  id: row.id,
                  seat_index: idx,
                  user_id: row.user_id || null,
                  guest_id: row.guest_id || null,
                  user_profile: row.user_profile || row.profile || null,
                  status: row.status,
                  joined_at: row.joined_at || null,
                  left_at: row.left_at || null,
                  livekit_participant_identity: row.livekit_participant_identity,
                  seat_price_paid: row.price_paid ?? row.seat_price_paid ?? null,
                  updated_at: row.updated_at,
                }
              }
            }
            return next
          })

          // also refresh mySeat if affected
          setMySeat((prev) => {
            const candidate = (payload as any).new || (payload as any).old
            if (!candidate) return prev
            if (effectiveUserId && (candidate.user_id === effectiveUserId || candidate.guest_id === effectiveUserId)) {
              return {
                id: candidate.id,
                seat_index: Number(candidate.seat_index),
                user_id: candidate.user_id || null,
                guest_id: candidate.guest_id || null,
                user_profile: candidate.user_profile || candidate.profile || null,
                status: candidate.status,
                joined_at: candidate.joined_at || null,
                left_at: candidate.left_at || null,
                livekit_participant_identity: candidate.livekit_participant_identity,
                seat_price_paid: candidate.price_paid ?? candidate.seat_price_paid ?? null,
                updated_at: candidate.updated_at,
              }
            }
            return prev
          })

          // Clear joining/leaving states if the seat update indicates completion
          if (newRow) {
            const status = String(newRow.status || '').toLowerCase()
            const seatIndex = Number(newRow.seat_index)
            if (status === 'live' || status === 'active' || status === 'failed') {
              if (joiningSeatId === seatIndex) {
                setJoiningSeatId(null)
              }
              if (leavingSeatId === seatIndex) {
                setLeavingSeatId(null)
              }
            }
          }
        } catch (err) {
          console.warn('[useStreamSeats] realtime handler error', err)
        }
      })
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {}
    }
  }, [_streamId, effectiveUserId, joiningSeatId, leavingSeatId])

  const pendingSeatRequests: any[] = []
  const loadingSeatRequests = false

  const refreshSeatRequests = useCallback(() => {
    void fetchSeats()
  }, [fetchSeats])

  const capacity = {
    capacity: 0,
    isInQueue: false,
    canJoinInteractively: !!effectiveUserId,
    joinQueue: async () => false,
    leaveQueue: async () => false,
  }

  const myRequest = null

  return {
    seats,
    mySeat,
    joiningSeatId,
    leavingSeatId,
    joinSeat,
    leaveSeat,
    markSeatLive,
    refreshSeats,
    // Compatibility for existing consumers
    seatJoinTransition: null, // placeholder, not used in new logic
    handleParticipantDisconnected,
    pendingSeatRequests,
    loadingSeatRequests,
    approveSeatRequest,
    denySeatRequest,
    refreshSeatRequests,
    capacity,
    isInQueue: false,
    canJoinInteractively: capacity.canJoinInteractively,
    joinQueue: capacity.joinQueue,
    leaveQueue: capacity.leaveQueue,
    myRequest,
    // Compatibility for BroadcastStageLayout and other consumers expecting StagePass[]
    stagePasses: Object.values(seats)
      .sort((a, b) => (a.seat_index || 0) - (b.seat_index || 0))
      .map((s) => ({
        id: s.id,
        stream_id: (_streamId as any) || null,
        broadcaster_id: (_broadcasterProfile && (_broadcasterProfile.id || _broadcasterProfile.user_id)) || null,
        user_id: s.user_id || null,
        status: (s.status as any) || 'live',
        stage_index: s.seat_index,
        price_coins: ((_streamData as any)?.seat_prices?.[s.seat_index] ?? (_streamData as any)?.seat_price) || 0,
        paid_amount: 0,
        requested_at: s.joined_at || null,
        approved_at: s.joined_at || null,
        went_live_at: s.joined_at || null,
        denied_at: null,
        removed_at: null,
        expired_at: null,
        created_at: s.joined_at || new Date().toISOString(),
        updated_at: s.updated_at || new Date().toISOString(),
        user_profile: s.user_profile || null,
      })),
  }
}