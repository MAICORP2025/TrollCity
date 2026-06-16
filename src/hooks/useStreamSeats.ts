import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'

export interface SeatSession {
  id: string
  stream_id?: string
  seat_index: number
  user_id?: string | null
  guest_id?: string | null
  status?: string
  created_at?: string | null
  updated_at?: string | null
  joined_at?: string | null
  left_at?: string | null
  livekit_participant_identity?: string | null
  livekit_identity?: string | null
  participant_identity?: string | null
  seat_price_paid?: number
  price_paid?: number
  user_profile?: {
    id?: string
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
  profile?: {
    id?: string
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
}

type SeatEventName = 'seat_joined' | 'seat_live' | 'seat_left' | 'seat_refreshed'

const SUBSCRIBER_DISCOUNT_PERCENT = 0.10

const ACTIVE_SEAT_STATUSES = new Set(['reserved', 'camera_starting', 'active', 'live'])

function normalizeSeatStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase()
}

function isActiveSeatStatus(status?: string | null) {
  return ACTIVE_SEAT_STATUSES.has(normalizeSeatStatus(status))
}

function safeNumber(value: any, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function checkIsSubscribedToBroadcaster(userId: string, broadcasterId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('subscriber_id', userId)
      .eq('broadcaster_id', broadcasterId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.warn('[useStreamSeats] subscription check error:', error)
      return false
    }

    return !!data
  } catch (err) {
    console.warn('[useStreamSeats] subscription check failed:', err)
    return false
  }
}

function buildSeatProfile(raw: any) {
  if (!raw) return null

  if (raw.user_profile || raw.profile) {
    return raw.user_profile || raw.profile
  }

  if (raw.username || raw.display_name || raw.avatar_url || raw.user_id) {
    return {
      id: raw.user_id || undefined,
      username: raw.username || null,
      display_name: raw.display_name || raw.username || null,
      avatar_url: raw.avatar_url || null,
    }
  }

  return null
}

function normalizeSeatSession(raw: any): SeatSession | null {
  if (!raw) return null

  const seatIndex = Number(raw.seat_index)
  if (!Number.isFinite(seatIndex)) return null

  return {
    id: String(raw.id),
    stream_id: raw.stream_id || undefined,
    seat_index: seatIndex,
    user_id: raw.user_id || null,
    guest_id: raw.guest_id || null,
    status: raw.status || null,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    joined_at: raw.joined_at || null,
    left_at: raw.left_at || null,
    livekit_participant_identity:
      raw.livekit_participant_identity ||
      raw.participant_identity ||
      raw.livekit_identity ||
      raw.user_id ||
      null,
    livekit_identity:
      raw.livekit_identity ||
      raw.livekit_participant_identity ||
      raw.participant_identity ||
      raw.user_id ||
      null,
    participant_identity:
      raw.participant_identity ||
      raw.livekit_participant_identity ||
      raw.livekit_identity ||
      raw.user_id ||
      null,
    seat_price_paid: raw.seat_price_paid ?? raw.price_paid ?? undefined,
    price_paid: raw.price_paid ?? raw.seat_price_paid ?? undefined,
    user_profile: buildSeatProfile(raw),
    profile: raw.profile || raw.user_profile || buildSeatProfile(raw),
  }
}

export function useStreamSeats(
  _streamId?: string,
  _userId?: string,
  _broadcasterProfile?: any,
  _streamData?: any,
) {
  const { user } = useAuthStore()
  const effectiveUserId = _userId || user?.id || null
  const streamId = String(_streamId || '').trim()

  const [seats, setSeats] = useState<Record<number, SeatSession>>({})
  const [mySeat, setMySeat] = useState<SeatSession | null>(null)
  const [joiningSeatId, setJoiningSeatId] = useState<number | null>(null)
  const [leavingSeatId, setLeavingSeatId] = useState<number | null>(null)
  const [seatVersion, setSeatVersion] = useState(0)

  const fetchSeqRef = useRef(0)
  const mountedRef = useRef(true)
  const refreshTimersRef = useRef<number[]>([])
  const seatsRef = useRef<Record<number, SeatSession>>({})
  const mySeatRef = useRef<SeatSession | null>(null)

  const clearRefreshTimers = useCallback(() => {
    for (const timerId of refreshTimersRef.current) {
      window.clearTimeout(timerId)
    }
    refreshTimersRef.current = []
  }, [])

  const parseSeatArray = useCallback(
    (arr: any[]): { map: Record<number, SeatSession>; mine: SeatSession | null } => {
      const map: Record<number, SeatSession> = {}
      let mine: SeatSession | null = null

      if (!Array.isArray(arr)) return { map, mine }

      for (const raw of arr) {
        const session = normalizeSeatSession(raw)
        if (!session) continue

        if (!isActiveSeatStatus(session.status)) continue

        map[session.seat_index] = session

        if (
          effectiveUserId &&
          (session.user_id === effectiveUserId || session.guest_id === effectiveUserId)
        ) {
          mine = session
        }
      }

      return { map, mine }
    },
    [effectiveUserId],
  )

  const getSeatsSignature = useCallback((map: Record<number, SeatSession>, mine: SeatSession | null) => {
    const keys = Object.keys(map).sort()
    const seatSig = keys
      .map((k) => {
        const s = map[Number(k)]
        return `${k}:${s.user_id || s.guest_id || ''}:${s.status || ''}:${s.id}:${s.updated_at || ''}:${s.joined_at || ''}`
      })
      .join('|')
    const mineSig = mine ? `${mine.seat_index}:${mine.id}:${mine.status}` : 'none'
    return `${seatSig}||${mineSig}`
  }, [])

  const applySeatRows = useCallback(
    (rows: any[]) => {
      const { map, mine } = parseSeatArray(rows)

      const sig = getSeatsSignature(map, mine)
      const prevSig = getSeatsSignature(seatsRef.current, mySeatRef.current)

      if (sig === prevSig) {
        return { map: seatsRef.current, mine: mySeatRef.current }
      }

      seatsRef.current = map
      mySeatRef.current = mine

      setSeats(() => ({ ...map }))
      setMySeat(mine)
      setSeatVersion((v) => v + 1)

      return { map, mine }
    },
    [parseSeatArray, getSeatsSignature],
  )

  const fetchSeats = useCallback(
    async (reason = 'manual') => {
      if (!streamId) return { map: {}, mine: null }

      const seq = ++fetchSeqRef.current

      try {
        const { data, error } = await supabase.rpc('get_stream_seats', {
          p_stream_id: streamId,
        })

        if (error) {
          console.warn('[useStreamSeats] fetchSeats error:', { reason, error })
          return { map: seatsRef.current, mine: mySeatRef.current }
        }

        if (!mountedRef.current || seq !== fetchSeqRef.current) {
          return { map: seatsRef.current, mine: mySeatRef.current }
        }

        const rows = Array.isArray(data) ? data : data || []
        const result = applySeatRows(rows)

        if (import.meta.env.DEV) {
          console.log('[useStreamSeats] fetched seats:', {
            reason,
            streamId,
            count: Object.keys(result.map).length,
            seatIndexes: Object.keys(result.map),
          })
        }

        return result
      } catch (err) {
        console.warn('[useStreamSeats] fetchSeats failed:', { reason, err })
        return { map: seatsRef.current, mine: mySeatRef.current }
      }
    },
    [streamId, applySeatRows],
  )

  // Dedupe guard: skip duplicate refreshes within 500ms window
  const lastRefreshAtRef = useRef(0)
  const pendingRefreshTimerRef = useRef<number | null>(null)

  const scheduleRefresh = useCallback(
    (reason: string, delay = 400) => {
      if (!streamId) return

      const now = Date.now()
      if (now - lastRefreshAtRef.current < 300) {
        // Already refreshed recently — schedule one debounced refresh if not already pending
        if (pendingRefreshTimerRef.current !== null) {
          window.clearTimeout(pendingRefreshTimerRef.current)
        }
        pendingRefreshTimerRef.current = window.setTimeout(() => {
          pendingRefreshTimerRef.current = null
          lastRefreshAtRef.current = Date.now()
          void fetchSeats(reason)
        }, delay)
        return
      }

      lastRefreshAtRef.current = now
      void fetchSeats(reason)
    },
    [streamId, fetchSeats],
  )

  const sendSeatEvent = useCallback(
    async (event: SeatEventName, payload: Record<string, any>) => {
      if (!streamId) return

      try {
        const channel = supabase.channel(`stream-seat-events:${streamId}`)

        await channel.send({
          type: 'broadcast',
          event,
          payload: {
            stream_id: streamId,
            ...payload,
            sent_at: new Date().toISOString(),
          },
        })

        // Removing this send-only channel prevents leaked duplicate channels.
        void supabase.removeChannel(channel)
      } catch (err) {
        console.warn('[useStreamSeats] seat broadcast event failed:', {
          event,
          streamId,
          payload,
          err,
        })
      }
    },
    [streamId],
  )

  const joinSeat = useCallback(
    async (seatIndex: number, price: number) => {
      if (!effectiveUserId || !streamId) {
        toast.error('Login to join a stage seat')
        return false
      }

      setJoiningSeatId(seatIndex)

      const broadcasterId = _streamData?.user_id || _broadcasterProfile?.id || _broadcasterProfile?.user_id
      let finalPrice = safeNumber(price, 0)

      if (broadcasterId && effectiveUserId !== broadcasterId) {
        const isSubscribed = await checkIsSubscribedToBroadcaster(effectiveUserId, broadcasterId)

        if (isSubscribed && finalPrice > 0) {
          const discountedPrice = Math.max(
            0,
            Math.floor(finalPrice * (1 - SUBSCRIBER_DISCOUNT_PERCENT)),
          )

          if (discountedPrice !== finalPrice) {
            console.log(
              `[useStreamSeats] Subscriber discount applied: ${finalPrice} -> ${discountedPrice} coins`,
            )
          }

          finalPrice = discountedPrice
        }
      }

      // ✅ Optimistic update: show seat immediately before RPC completes
      const optimisticSeat: SeatSession = {
        id: `optimistic-${Date.now()}`,
        stream_id: streamId,
        seat_index: seatIndex,
        user_id: effectiveUserId,
        guest_id: null,
        status: 'reserved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
        left_at: null,
        livekit_participant_identity: effectiveUserId,
        livekit_identity: effectiveUserId,
        participant_identity: effectiveUserId,
        seat_price_paid: finalPrice,
        price_paid: finalPrice,
        user_profile: {
          id: effectiveUserId,
          username: user?.user_metadata?.username || null,
          display_name: user?.user_metadata?.display_name || null,
          avatar_url: null,
        },
        profile: {
          id: effectiveUserId,
          username: user?.user_metadata?.username || null,
          display_name: user?.user_metadata?.display_name || null,
          avatar_url: null,
        },
      }

      setSeats(prev => ({ ...prev, [seatIndex]: optimisticSeat }))
      setMySeat(optimisticSeat)
      seatsRef.current = { ...seatsRef.current, [seatIndex]: optimisticSeat }
      mySeatRef.current = optimisticSeat
      setSeatVersion(v => v + 1)

      try {
        const { data, error } = await supabase.rpc('join_seat_atomic', {
          p_stream_id: streamId,
          p_seat_index: seatIndex,
          p_price: finalPrice,
          p_user_id: effectiveUserId,
        })

        if (error) {
          console.warn('[useStreamSeats] joinSeat rpc error:', error)
          // Rollback optimistic update on error
          setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
          setMySeat(null)
          seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
          mySeatRef.current = null
          setSeatVersion(v => v + 1)
          toast.error(error.message || 'Failed to join seat')
          return false
        }

        const payload = data as any

        if (!payload?.success) {
          // Rollback optimistic update on failure
          setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
          setMySeat(null)
          seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
          mySeatRef.current = null
          setSeatVersion(v => v + 1)
          toast.error(payload?.message || 'Failed to join seat')
          return false
        }

        // Replace optimistic seat with real data
        const realSeat = normalizeSeatSession(payload?.seat || payload)
        if (realSeat) {
          setSeats(prev => ({ ...prev, [seatIndex]: realSeat }))
          setMySeat(realSeat)
          seatsRef.current = { ...seatsRef.current, [seatIndex]: realSeat }
          mySeatRef.current = realSeat
          setSeatVersion(v => v + 1)
        }

        await sendSeatEvent('seat_joined', {
          seat_index: seatIndex,
          user_id: effectiveUserId,
          price_paid: finalPrice,
        })

        // Single debounced refresh to sync state
        scheduleRefresh('joinSeat:post-event')

        return true
      } catch (err) {
        console.warn('[useStreamSeats] joinSeat failed:', err)
        // Rollback optimistic update on exception
        setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
        setMySeat(null)
        seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
        mySeatRef.current = null
        setSeatVersion(v => v + 1)
        toast.error('Failed to join seat')
        return false
      } finally {
        setJoiningSeatId(null)
      }
    },
    [
      effectiveUserId,
      streamId,
      _streamData,
      _broadcasterProfile,
      fetchSeats,
      sendSeatEvent,
      scheduleRefresh,
    ],
  )

  const leaveSeat = useCallback(async () => {
    const currentSeat = mySeatRef.current
    if (!currentSeat || !streamId) return

    const seatIndex = currentSeat.seat_index
    const userId = currentSeat.user_id || currentSeat.guest_id || effectiveUserId || null

    setLeavingSeatId(seatIndex)

    // ✅ Optimistic update: remove seat immediately
    const previousSeat = { ...seatsRef.current }
    const previousMySeat = mySeatRef.current

    setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
    if (mySeatRef.current?.seat_index === seatIndex) {
      setMySeat(null)
      mySeatRef.current = null
    }
    seatsRef.current = { ...seatsRef.current }
    delete seatsRef.current[seatIndex]
    setSeatVersion(v => v + 1)

    try {
      const { data, error } = await supabase.rpc('leave_seat_atomic', {
        p_session_id: currentSeat.id,
      })

      if (error) {
        console.warn('[useStreamSeats] leaveSeat rpc error:', error)
        // Rollback on error
        setSeats(previousSeat)
        setMySeat(previousMySeat)
        seatsRef.current = previousSeat
        mySeatRef.current = previousMySeat
        setSeatVersion(v => v + 1)
        toast.error(error.message || 'Failed to leave seat')
        return
      }

      if (data && (data as any).success === false) {
        // Rollback on failure
        setSeats(previousSeat)
        setMySeat(previousMySeat)
        seatsRef.current = previousSeat
        mySeatRef.current = previousMySeat
        setSeatVersion(v => v + 1)
        toast.error((data as any).message || 'Failed to leave seat')
        return
      }

      await sendSeatEvent('seat_left', {
        seat_index: seatIndex,
        user_id: userId,
        session_id: currentSeat.id,
      })

      // Single debounced refresh to sync
      scheduleRefresh('leaveSeat:post-event')
    } catch (err) {
      console.warn('[useStreamSeats] leaveSeat failed:', err)
      // Rollback on exception
      setSeats(previousSeat)
      setMySeat(previousMySeat)
      seatsRef.current = previousSeat
      mySeatRef.current = previousMySeat
      setSeatVersion(v => v + 1)
      toast.error('Failed to leave seat')
    } finally {
      setLeavingSeatId(null)
    }
  }, [streamId, effectiveUserId, fetchSeats, sendSeatEvent, scheduleRefresh])

  const markSeatLive = useCallback(
    async (seatIndex: number, livekitParticipantIdentity?: string | null) => {
      if (!streamId) return

      const currentStatus = normalizeSeatStatus(mySeatRef.current?.status)

      if (currentStatus === 'active' || currentStatus === 'live') {
        await sendSeatEvent('seat_live', {
          seat_index: seatIndex,
          user_id: effectiveUserId,
          livekit_participant_identity: livekitParticipantIdentity || effectiveUserId,
        })
        scheduleRefresh('markSeatLive:already-live')
        return
      }

      try {
        const rpcPayload: Record<string, any> = {
          p_stream_id: streamId,
          p_seat_index: seatIndex,
        }

        if (livekitParticipantIdentity) {
          rpcPayload.p_livekit_participant_identity = livekitParticipantIdentity
        }

        const { error } = await supabase.rpc('mark_stream_seat_live', rpcPayload)

        if (error) {
          console.warn('[useStreamSeats] markSeatLive error:', error)
          await fetchSeats('markSeatLive:error-refetch')
          return
        }

        await fetchSeats('markSeatLive:success')

        await sendSeatEvent('seat_live', {
          seat_index: seatIndex,
          user_id: effectiveUserId,
          livekit_participant_identity: livekitParticipantIdentity || effectiveUserId,
        })

        scheduleRefresh('markSeatLive:post-event')
      } catch (err) {
        console.warn('[useStreamSeats] markSeatLive failed:', err)
        await fetchSeats('markSeatLive:catch-refetch')

        const refreshedStatus = normalizeSeatStatus(mySeatRef.current?.status)
        if (refreshedStatus !== 'active' && refreshedStatus !== 'live') {
          toast.error('Failed to go live')
        }
      }
    },
    [
      streamId,
      effectiveUserId,
      fetchSeats,
      sendSeatEvent,
      scheduleRefresh,
    ],
  )

  const refreshSeats = useCallback(async () => {
    await fetchSeats('refreshSeats')
  }, [fetchSeats])

  // Immediately remove a seat from local state (used when broadcaster/officer kicks a user)
  const removeSeat = useCallback((seatIndex: number) => {
    const idx = Number(seatIndex)
    if (!Number.isFinite(idx)) return

    setSeats((prev) => {
      if (!prev[idx]) return prev
      const next = { ...prev }
      delete next[idx]
      return next
    })

    setMySeat((prev) => {
      if (!prev) return prev
      return prev.seat_index === idx ? null : prev
    })

    seatsRef.current = { ...seatsRef.current }
    delete seatsRef.current[idx]
    if (mySeatRef.current?.seat_index === idx) {
      mySeatRef.current = null
    }
    setSeatVersion((v) => v + 1)
  }, [])

  const handleParticipantDisconnected = useCallback(
    (identity: string) => {
      if (!identity) return

      const matchedSeat = Object.values(seatsRef.current).find((seat) => {
        const candidates = [
          seat.user_id,
          seat.guest_id,
          seat.livekit_participant_identity,
          seat.livekit_identity,
          seat.participant_identity,
        ]
          .filter(Boolean)
          .map((value) => String(value))

        return candidates.some(
          (candidate) => identity === candidate || identity.endsWith(`-${candidate}`),
        )
      })

      if (matchedSeat) {
        scheduleRefresh('participant-disconnected', [0, 500])
      }
    },
    [scheduleRefresh],
  )

  const approveSeatRequest = useCallback(
    async (_id: string) => {
      try {
        const { data, error } = await supabase.rpc('approve_seat_request', {
          p_request_id: _id,
        })

        if (error) throw error

        await fetchSeats('approveSeatRequest')
        scheduleRefresh('approveSeatRequest:delayed', [300, 800])

        return data || null
      } catch (err) {
        console.warn('[useStreamSeats] approveSeatRequest failed:', err)
        return null
      }
    },
    [fetchSeats, scheduleRefresh],
  )

  const denySeatRequest = useCallback(
    async (_id: string, _reason?: string) => {
      try {
        const { error } = await supabase.rpc('deny_seat_request', {
          p_request_id: _id,
          p_reason: _reason || '',
        })

        if (error) throw error

        await fetchSeats('denySeatRequest')
        return true
      } catch (err) {
        console.warn('[useStreamSeats] denySeatRequest failed:', err)
        return false
      }
    },
    [fetchSeats],
  )

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      clearRefreshTimers()
    }
  }, [clearRefreshTimers])

  useEffect(() => {
    if (!streamId) {
      setSeats({})
      setMySeat(null)
      seatsRef.current = {}
      mySeatRef.current = null
      setSeatVersion((v) => v + 1)
      return
    }

    void fetchSeats('mount')
  }, [streamId])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream-seats:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_seat_sessions',
          filter: `stream_id=eq.${streamId}`,
        },
         (payload) => {
           // Handle DELETE: remove seat locally
           if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as any
            const seatIndex = Number(oldRow?.seat_index)
            if (Number.isFinite(seatIndex)) {
              setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
              setMySeat(prev => prev?.seat_index === seatIndex ? null : prev)
              seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
              if (mySeatRef.current?.seat_index === seatIndex) mySeatRef.current = null
              setSeatVersion(v => v + 1)
            }
            return
          }

          // Handle INSERT: add/update seat locally from payload
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as any
            const session = normalizeSeatSession(newRow)
            if (session && isActiveSeatStatus(session.status)) {
              setSeats(prev => ({ ...prev, [session.seat_index]: session }))
              seatsRef.current = { ...seatsRef.current, [session.seat_index]: session }
              if (effectiveUserId && (session.user_id === effectiveUserId || session.guest_id === effectiveUserId)) {
                setMySeat(session)
                mySeatRef.current = session
              }
              setSeatVersion(v => v + 1)
            }
            return
          }

          // Handle UPDATE: update seat locally from payload
           if (payload.eventType === 'UPDATE') {
             const newRow = payload.new as any
             const oldRow = payload.old as any
             const newStatus = newRow?.status

             if (newStatus === 'left' || newStatus === 'kicked') {
               const seatIndex = Number(oldRow?.seat_index ?? newRow?.seat_index)
               if (Number.isFinite(seatIndex)) {
                 setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
                 setMySeat(prev => prev?.seat_index === seatIndex ? null : prev)
                 seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
                 if (mySeatRef.current?.seat_index === seatIndex) mySeatRef.current = null
                 setSeatVersion(v => v + 1)
               }
             } else {
               // Update seat data in place
               const session = normalizeSeatSession(newRow)
               if (session) {
                 setSeats(prev => ({ ...prev, [session.seat_index]: session }))
                 seatsRef.current = { ...seatsRef.current, [session.seat_index]: session }
                 if (effectiveUserId && (session.user_id === effectiveUserId || session.guest_id === effectiveUserId)) {
                   setMySeat(session)
                   mySeatRef.current = session
                 }
                 setSeatVersion(v => v + 1)
               }
             }
             return
           }
        },
      )
      .subscribe((status) => {
        console.log('[useStreamSeats] postgres realtime status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream-seat-events:${streamId}`)
       .on('broadcast', { event: 'seat_joined' }, () => {
         // Postgres changes handler already updates state — just do a single sync refresh
         scheduleRefresh('broadcast-seat_joined')
       })
       .on('broadcast', { event: 'seat_live' }, () => {
         scheduleRefresh('broadcast-seat_live')
       })
       .on('broadcast', { event: 'seat_left' }, () => {
         scheduleRefresh('broadcast-seat_left')
       })
       .on('broadcast', { event: 'seat_refreshed' }, () => {
         scheduleRefresh('broadcast-seat_refreshed')
       })
       .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

  const pendingSeatRequests: any[] = []
  const loadingSeatRequests = false

  const refreshSeatRequests = useCallback(() => {
    void fetchSeats('refreshSeatRequests')
  }, [fetchSeats])

  const capacity = {
    capacity: 0,
    isInQueue: false,
    canJoinInteractively: !!effectiveUserId,
    joinQueue: async () => false,
    leaveQueue: async () => false,
  }

  const myRequest = null

  const stagePasses = Object.values(seats)
    .sort((a, b) => (a.seat_index || 0) - (b.seat_index || 0))
    .map((s) => ({
      id: s.id,
      stream_id: streamId || null,
      broadcaster_id:
        (_broadcasterProfile && (_broadcasterProfile.id || _broadcasterProfile.user_id)) ||
        _streamData?.user_id ||
        null,
      user_id: s.user_id || null,
      status: (s.status as any) || 'live',
      stage_index: s.seat_index,
      price_coins: (_streamData?.seat_prices?.[s.seat_index] ?? _streamData?.seat_price) || 0,
      paid_amount: s.price_paid || s.seat_price_paid || 0,
      requested_at: s.joined_at || null,
      approved_at: s.joined_at || null,
      went_live_at: s.joined_at || null,
      denied_at: null,
      removed_at: null,
      expired_at: null,
      created_at: s.joined_at || s.created_at || new Date().toISOString(),
      updated_at: s.updated_at || new Date().toISOString(),
      user_profile: s.user_profile || null,
    }))

  return {
    seats,
    mySeat,
    joiningSeatId,
    leavingSeatId,
    seatVersion,
    joinSeat,
    leaveSeat,
    markSeatLive,
    refreshSeats,
    removeSeat,
    seatJoinTransition: null,
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
    stagePasses,
  }
}
