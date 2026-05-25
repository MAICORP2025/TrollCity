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
  status?: 'active' | 'reserved' | 'left' | 'kicked'
  joined_at?: string | null
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
  const [mySession, setMySession] = useState<SeatSession | null>(null)
  const seatJoinTransition = useRef<any>(null)

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
        user_profile: s.user_profile || s.profile || s.user_profile || null,
        status: s.status,
        joined_at: s.joined_at || null,
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
      setMySession(mine)
    } catch (err) {
      console.warn('[useStreamSeats] fetchSeats failed', err)
    }
  }, [_streamId, effectiveUserId])

  const joinSeat = useCallback(async (seatIndex: number, _price?: number) => {
    if (!effectiveUserId || !_streamId) {
      toast.error('Login to join a stage seat')
      return false
    }

    // determine price from provided param or stream data
    const price = typeof _price === 'number'
      ? _price
      : (Array.isArray((_streamData as any)?.seat_prices) ? (_streamData as any).seat_prices[seatIndex] : (_streamData as any)?.seat_price)

    try {
      const { data, error } = await supabase.rpc('join_seat_atomic', {
        p_stream_id: _streamId,
        p_seat_index: seatIndex,
        p_price: price ?? 0,
        p_user_id: effectiveUserId,
      })

      if (error) {
        console.warn('[useStreamSeats] joinSeat rpc error', error)
        toast.error('Failed to join seat')
        return false
      }

      if (data && (data as any).success) {
        toast.success('Seat joined')
        await fetchSeats()
        return true
      }

      return false
    } catch (err) {
      console.warn('[useStreamSeats] joinSeat failed', err)
      toast.error('Failed to join seat')
      return false
    }
  }, [_streamId, effectiveUserId, _streamData, fetchSeats])

  const leaveSeat = useCallback(async () => {
    if (!mySession) return
    try {
      const { data, error } = await supabase.rpc('leave_seat_atomic', { p_session_id: mySession.id })
      if (error) {
        console.warn('[useStreamSeats] leaveSeat rpc error', error)
        return
      }
      if (data && (data as any).success) {
        toast.success('Left seat')
        setMySession(null)
        await fetchSeats()
      }
    } catch (err) {
      console.warn('[useStreamSeats] leaveSeat failed', err)
    }
  }, [mySession, fetchSeats])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_seats', filter: `stream_id=eq.${_streamId}` }, (payload) => {
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
                }
              }
            }
            return next
          })

          // also refresh mySession if affected
          setMySession((prev) => {
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
              }
            }
            return prev
          })
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
  }, [_streamId, effectiveUserId])

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
    mySession,
    seatJoinTransition: seatJoinTransition.current,
    joinSeat,
    leaveSeat,
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
        updated_at: s.joined_at || new Date().toISOString(),
        user_profile: s.user_profile || null,
      })),
  }
}
