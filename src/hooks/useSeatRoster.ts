import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import api, { API_ENDPOINTS } from '../lib/api'

const ROOM_NAME = 'officer-stream'
const SEAT_COUNT = 6

export type SeatAssignment = {
  room: string
  seat_index: number
  user_id: string
  username: string
  avatar_url?: string | null
  role: string
  metadata?: Record<string, any>
  assigned_at: string
} | null

type SeatActionPayload = {
  action: 'claim' | 'release'
  seat_index: number
  room?: string
  username?: string
  avatar_url?: string | null
  role?: string
  metadata?: Record<string, any>
  user_id?: string
  force?: boolean
}

export function useSeatRoster() {
  const [seats, setSeats] = useState<SeatAssignment[]>(Array(SEAT_COUNT).fill(null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClaimingSeat, setIsClaimingSeat] = useState<number | null>(null)

  const normalize = useCallback((data: any[]): SeatAssignment[] => {
    const map = new Map<number, any>()
    data?.forEach((seat) => {
      if (seat?.seat_index) {
        map.set(Number(seat.seat_index), seat)
      }
    })
    return Array.from({ length: SEAT_COUNT }, (_, index) => {
      const entry = map.get(index + 1)
      if (!entry) return null
      return {
        room: entry.room,
        seat_index: entry.seat_index,
        user_id: entry.user_id,
        username: entry.username,
        avatar_url: entry.avatar_url,
        role: entry.role,
        metadata: entry.metadata,
        assigned_at: entry.assigned_at,
      }
    })
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get<{ seats: SeatAssignment[] }>(API_ENDPOINTS.broadcastSeats.list, { room: ROOM_NAME })
      if (response.success && response.data?.seats) {
        setSeats(normalize(response.data.seats))
        setError(null)
      } else {
        throw new Error(response.error || 'Failed to fetch seats')
      }
    } catch (err: any) {
      console.error('[useSeatRoster] refresh failed', err)
      setError(err?.message || 'Unable to load seats')
    } finally {
      setLoading(false)
    }
  }, [normalize])

  useEffect(() => {
    const channel = supabase
      .channel(`broadcast-seats-${ROOM_NAME}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcast_seats',
          filter: `room=eq.${ROOM_NAME}`,
        },
        () => {
          refresh()
        }
      )
      .subscribe()

    refresh()

    return () => {
      channel.unsubscribe()
    }
  }, [refresh])

  const claimSeat = useCallback(
    async (seatIndex: number, payload: { username: string; avatarUrl?: string | null; role: string; metadata?: Record<string, any> }) => {
      setIsClaimingSeat(seatIndex)
      try {
      const response = await api.post(API_ENDPOINTS.broadcastSeats.action, {
        action: 'claim',
        room: ROOM_NAME,
        seat_index: seatIndex + 1,
        username: payload.username,
        avatar_url: payload.avatarUrl ?? null,
        role: payload.role,
        metadata: payload.metadata ?? {},
      })

      if (!response.success) {
        throw new Error(response.error || 'Seat claim failed')
      }

      const seat =
        response?.seat ??
        response?.data?.seat ??
        response?.data?.data?.seat ??
        response?.data?.payload?.seat ??
        null
      const created =
        response?.created ??
        response?.data?.created ??
        response?.data?.data?.created ??
        false
      const isOwner =
        response?.is_owner ??
        response?.data?.is_owner ??
        response?.data?.data?.is_owner ??
        false
      if (!seat) {
        throw new Error('Seat claim returned no data')
      }

      if (!created && !isOwner) {
        throw new Error('Seat already occupied')
      }

      refresh()
      return seat
      } finally {
        setIsClaimingSeat(null)
      }
    },
    [refresh]
  )

  const releaseSeat = useCallback(
    async (seatIndex: number, userId: string, options?: { force?: boolean }) => {
      try {
        await api.post(API_ENDPOINTS.broadcastSeats.action, {
          action: 'release',
          room: ROOM_NAME,
          seat_index: seatIndex + 1,
          user_id: userId,
          force: Boolean(options?.force),
        })
        refresh()
      } catch (err) {
        console.warn('[useSeatRoster] releaseSeat failed', err)
      }
    },
    [refresh]
  )

  const currentOccupants = useMemo(
    () => seats.filter((seat): seat is NonNullable<SeatAssignment> => Boolean(seat)),
    [seats]
  )

  return {
    seats,
    seatsLoading: loading,
    seatsError: error,
    refreshSeats: refresh,
    claimSeat,
    releaseSeat,
    currentOccupants,
    isClaimingSeat,
  }
}
