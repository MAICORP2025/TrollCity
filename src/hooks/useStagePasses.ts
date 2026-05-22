import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import type { StagePass } from '../types/broadcast'

interface UseStagePassesResult {
  stagePasses: StagePass[]
  requests: StagePass[]
  currentUserStagePass: StagePass | null
  loading: boolean
  message: string | null
  openStagePasses: (count: number, priceCoins: number) => Promise<void>
  requestStagePass: (stagePassId: string) => Promise<{ success: boolean; error?: string }>
  approveStagePass: (stagePassId: string) => Promise<void>
  denyStagePass: (stagePassId: string) => Promise<void>
  removeStageGuest: (stagePassId: string) => Promise<void>
  loadStagePasses: () => Promise<void>
  refetch: () => Promise<void>
}

const TABLE_NAME = 'stream_stage_passes'
const MAX_STAGE_SLOTS = 5

type RawStagePassRow = {
  id: string
  stream_id: string
  broadcaster_id: string | null
  user_id: string | null
  status: string
  stage_index: number | null
  price_coins: number | null
  paid_amount: number | null
  requested_at: string | null
  approved_at: string | null
  went_live_at: string | null
  denied_at: string | null
  removed_at: string | null
  expired_at: string | null
  created_at: string
  updated_at: string | null
  user_profile?: {
    id: string
    username: string | null
    avatar_url: string | null
  } | null
}

function mapStagePassRow(row: RawStagePassRow): StagePass {
  return {
    id: row.id,
    stream_id: row.stream_id,
    broadcaster_id: row.broadcaster_id,
    user_id: row.user_id,
    status: row.status as any,
    stage_index: Number(row.stage_index ?? 0),
    price_coins: Number(row.price_coins ?? 0),
    paid_amount: Number(row.paid_amount ?? 0),
    requested_at: row.requested_at,
    approved_at: row.approved_at,
    went_live_at: row.went_live_at,
    denied_at: row.denied_at,
    removed_at: row.removed_at,
    expired_at: row.expired_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_profile: row.user_profile
      ? {
          id: row.user_profile.id,
          username: row.user_profile.username,
          avatar_url: row.user_profile.avatar_url,
        }
      : undefined,
  }
}

function isOpenStatus(status: string | null | undefined) {
  return status === 'open'
}

function isRequestStatus(status: string | null | undefined) {
  return status === 'requested'
}

function isActiveUserStatus(status: string | null | undefined) {
  return status === 'requested' || status === 'approved'
}

export function useStagePasses(streamId: string | undefined): UseStagePassesResult {
  const { user } = useAuthStore()

  const [stagePasses, setStagePasses] = useState<StagePass[]>([])
  const [currentUserStagePass, setCurrentUserStagePass] = useState<StagePass | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const loadInFlightRef = useRef(false)
  const reloadQueuedRef = useRef(false)

  const safeSetLoading = useCallback((value: boolean) => {
    if (mountedRef.current) setLoading(value)
  }, [])

  const safeSetMessage = useCallback((value: string | null) => {
    if (mountedRef.current) setMessage(value)
  }, [])

  const loadStagePasses = useCallback(async () => {
    if (!streamId) {
      if (mountedRef.current) {
        setStagePasses([])
        setCurrentUserStagePass(null)
      }
      return
    }

    if (loadInFlightRef.current) {
      reloadQueuedRef.current = true
      return
    }

    loadInFlightRef.current = true
    safeSetLoading(true)

    console.debug('[useStagePasses] loadStagePasses:start', {
      table: TABLE_NAME,
      streamId,
      userId: user?.id,
    })

    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(
          `
          *,
          user_profile:user_profiles!stream_stage_passes_user_id_fkey(
            id,
            username,
            avatar_url
          )
        `,
        )
        .eq('stream_id', streamId)
        .order('stage_index', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error

      const passes = ((data || []) as RawStagePassRow[]).map(mapStagePassRow)

      if (!mountedRef.current) return

      setStagePasses(passes)

      if (user?.id) {
        const mine =
          passes.find((sp) => sp.user_id === user.id && isActiveUserStatus(sp.status)) || null
        setCurrentUserStagePass(mine)
      } else {
        setCurrentUserStagePass(null)
      }

      console.debug('[useStagePasses] loadStagePasses:success', {
        streamId,
        userId: user?.id,
        count: passes.length,
        open: passes.filter((sp) => isOpenStatus(sp.status)).length,
        requested: passes.filter((sp) => isRequestStatus(sp.status)).length,
        approved: passes.filter((sp) => sp.status === 'approved').length,
        passes,
      })
    } catch (err: any) {
      const msg = err?.message || 'Failed to load Stage Passes'
      console.error('[useStagePasses] loadStagePasses:error', {
        streamId,
        userId: user?.id,
        error: err,
      })
      safeSetMessage(msg)
    } finally {
      loadInFlightRef.current = false
      safeSetLoading(false)

      if (reloadQueuedRef.current) {
        reloadQueuedRef.current = false
        void loadStagePasses()
      }
    }
  }, [streamId, user?.id, safeSetLoading, safeSetMessage])

  const openStagePasses = useCallback(
    async (count: number, priceCoins: number) => {
      if (!streamId || !user?.id) {
        safeSetMessage('Missing stream or user.')
        return
      }

      const requestedCount = Math.max(1, Math.min(MAX_STAGE_SLOTS, Number(count || 1)))
      const normalizedPrice = Math.max(0, Number(priceCoins || 0))

      safeSetLoading(true)
      safeSetMessage(null)

      console.debug('[useStagePasses] openStagePasses:start', {
        table: TABLE_NAME,
        streamId,
        broadcasterId: user.id,
        requestedCount,
        normalizedPrice,
      })

      try {
        const { data: existing, error: existingError } = await supabase
          .from(TABLE_NAME)
          .select('id, stage_index, status')
          .eq('stream_id', streamId)
          .order('stage_index', { ascending: true })

        if (existingError) throw existingError

        const existingByIndex = new Map<number, { id: string; stage_index: number; status: string }>()

        ;(existing || []).forEach((row: any) => {
          existingByIndex.set(Number(row.stage_index), {
            id: row.id,
            stage_index: Number(row.stage_index),
            status: row.status,
          })
        })

        let opened = 0

        for (let stageIndex = 1; stageIndex <= MAX_STAGE_SLOTS && opened < requestedCount; stageIndex++) {
          const existingSlot = existingByIndex.get(stageIndex)

          if (existingSlot?.status === 'open') {
            continue
          }

          if (existingSlot && ['removed', 'denied', 'expired'].includes(existingSlot.status)) {
            const { error: updateError } = await supabase
              .from(TABLE_NAME)
              .update({
                broadcaster_id: user.id,
                user_id: null,
                status: 'open',
                price_coins: normalizedPrice,
                paid_amount: 0,
                requested_at: null,
                approved_at: null,
                went_live_at: null,
                denied_at: null,
                removed_at: null,
                expired_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingSlot.id)

            if (updateError) throw updateError

            opened++
            continue
          }

          if (!existingSlot) {
            const { error: insertError } = await supabase.from(TABLE_NAME).insert({
              stream_id: streamId,
              broadcaster_id: user.id,
              user_id: null,
              status: 'open',
              stage_index: stageIndex,
              price_coins: normalizedPrice,
              paid_amount: 0,
            })

            if (insertError) throw insertError

            opened++
            continue
          }

          console.debug('[useStagePasses] openStagePasses:slot skipped', {
            stageIndex,
            existingSlot,
          })
        }

        if (opened === 0) {
          safeSetMessage('No slots available.')
        }

        console.debug('[useStagePasses] openStagePasses:success', {
          streamId,
          opened,
        })

        await loadStagePasses()
      } catch (err: any) {
        const msg = err?.message || 'Failed to open Stage Passes'
        console.error('[useStagePasses] openStagePasses:error', {
          streamId,
          broadcasterId: user.id,
          error: err,
        })
        safeSetMessage(msg)
      } finally {
        safeSetLoading(false)
      }
    },
    [streamId, user?.id, loadStagePasses, safeSetLoading, safeSetMessage],
  )

  const requestStagePass = useCallback(
    async (stagePassId: string): Promise<{ success: boolean; error?: string }> => {
      if (!streamId) return { success: false, error: 'Missing stream.' }
      if (!user?.id) return { success: false, error: 'Not logged in.' }
      if (!stagePassId || typeof stagePassId !== 'string') {
        return { success: false, error: 'Invalid Stage Pass.' }
      }

      safeSetLoading(true)
      safeSetMessage(null)

      console.debug('[useStagePasses] requestStagePass:start', {
        table: TABLE_NAME,
        streamId,
        userId: user.id,
        stagePassId,
      })

      try {
        const { data: slot, error: fetchErr } = await supabase
          .from(TABLE_NAME)
          .select('*')
          .eq('id', stagePassId)
          .eq('stream_id', streamId)
          .eq('status', 'open')
          .maybeSingle()

        console.debug('[useStagePasses] requestStagePass:open slot fetch', {
          stagePassId,
          slot,
          fetchErr,
        })

        if (fetchErr) throw fetchErr

        if (!slot) {
          const { data: debugSlot, error: debugErr } = await supabase
            .from(TABLE_NAME)
            .select('id, stream_id, status, stage_index, user_id, broadcaster_id, price_coins, paid_amount')
            .eq('id', stagePassId)
            .maybeSingle()

          console.warn('[useStagePasses] requestStagePass:slot unavailable', {
            stagePassId,
            streamId,
            debugSlot,
            debugErr,
            reason:
              'No open slot matched this id + stream_id. The UI may be passing the wrong id, or the slot is no longer open.',
          })

          return { success: false, error: 'Slot not available' }
        }

        const priceCoins = Math.max(0, Number(slot.price_coins || 0))

        if (priceCoins > 0) {
          const { error: coinErr } = await supabase.rpc('deduct_troll_coins', {
            p_user_id: user.id,
            p_amount: priceCoins,
            p_description: `Stage Pass request for stream ${slot.stream_id}`,
          })

          if (coinErr) {
            console.warn('[useStagePasses] requestStagePass:coin deduction failed', {
              stagePassId,
              userId: user.id,
              priceCoins,
              coinErr,
            })

            return { success: false, error: 'Insufficient coins' }
          }
        }

        const now = new Date().toISOString()

        const { data: updated, error: updateErr } = await supabase
          .from(TABLE_NAME)
          .update({
            user_id: user.id,
            status: 'requested',
            requested_at: now,
            paid_amount: priceCoins,
            updated_at: now,
          })
          .eq('id', stagePassId)
          .eq('stream_id', streamId)
          .eq('status', 'open')
          .select('id, stream_id, status, stage_index, user_id, requested_at')
          .maybeSingle()

        if (updateErr) throw updateErr

        if (!updated) {
          console.warn('[useStagePasses] requestStagePass:update returned no row', {
            stagePassId,
            streamId,
            userId: user.id,
          })

          return { success: false, error: 'Slot was already taken or changed.' }
        }

        console.debug('[useStagePasses] requestStagePass:success', {
          stagePassId,
          updated,
        })

        await loadStagePasses()
        return { success: true }
      } catch (err: any) {
        const msg = err?.message || 'Failed to request Stage Pass'

        console.error('[useStagePasses] requestStagePass:error', {
          stagePassId,
          streamId,
          userId: user?.id,
          error: err,
        })

        safeSetMessage(msg)
        return { success: false, error: msg }
      } finally {
        safeSetLoading(false)
      }
    },
    [streamId, user?.id, loadStagePasses, safeSetLoading, safeSetMessage],
  )

  const approveStagePass = useCallback(
    async (stagePassId: string) => {
      if (!streamId || !user?.id || !stagePassId) return

      safeSetLoading(true)
      safeSetMessage(null)

      console.debug('[useStagePasses] approveStagePass:start', {
        table: TABLE_NAME,
        streamId,
        broadcasterId: user.id,
        stagePassId,
      })

      try {
        const now = new Date().toISOString()

        const { data, error } = await supabase
          .from(TABLE_NAME)
          .update({
            status: 'approved',
            approved_at: now,
            went_live_at: now,
            updated_at: now,
          })
          .eq('id', stagePassId)
          .eq('stream_id', streamId)
          .eq('broadcaster_id', user.id)
          .eq('status', 'requested')
          .select('id, stream_id, status, stage_index, user_id')
          .maybeSingle()

        if (error) throw error

        if (!data) {
          console.warn('[useStagePasses] approveStagePass:no row updated', {
            stagePassId,
            streamId,
            broadcasterId: user.id,
            reason:
              'No requested stage pass matched this broadcaster + stream. Check broadcaster_id, status, or RLS.',
          })
          safeSetMessage('Could not approve this request.')
          return
        }

        console.debug('[useStagePasses] approveStagePass:success', { data })

        await loadStagePasses()
      } catch (err: any) {
        const msg = err?.message || 'Failed to approve'
        console.error('[useStagePasses] approveStagePass:error', {
          stagePassId,
          streamId,
          broadcasterId: user.id,
          error: err,
        })
        safeSetMessage(msg)
      } finally {
        safeSetLoading(false)
      }
    },
    [streamId, user?.id, loadStagePasses, safeSetLoading, safeSetMessage],
  )

  const denyStagePass = useCallback(
    async (stagePassId: string) => {
      if (!streamId || !user?.id || !stagePassId) return

      safeSetLoading(true)
      safeSetMessage(null)

      console.debug('[useStagePasses] denyStagePass:start', {
        table: TABLE_NAME,
        streamId,
        broadcasterId: user.id,
        stagePassId,
      })

      try {
        const now = new Date().toISOString()

        const { data, error } = await supabase
          .from(TABLE_NAME)
          .update({
            status: 'denied',
            denied_at: now,
            user_id: null,
            requested_at: null,
            approved_at: null,
            went_live_at: null,
            paid_amount: 0,
            updated_at: now,
          })
          .eq('id', stagePassId)
          .eq('stream_id', streamId)
          .eq('broadcaster_id', user.id)
          .eq('status', 'requested')
          .select('id, stream_id, status, stage_index')
          .maybeSingle()

        if (error) throw error

        if (!data) {
          console.warn('[useStagePasses] denyStagePass:no row updated', {
            stagePassId,
            streamId,
            broadcasterId: user.id,
          })
          safeSetMessage('Could not deny this request.')
          return
        }

        console.debug('[useStagePasses] denyStagePass:success', { data })

        await loadStagePasses()
      } catch (err: any) {
        const msg = err?.message || 'Failed to deny'
        console.error('[useStagePasses] denyStagePass:error', {
          stagePassId,
          streamId,
          broadcasterId: user?.id,
          error: err,
        })
        safeSetMessage(msg)
      } finally {
        safeSetLoading(false)
      }
    },
    [streamId, user?.id, loadStagePasses, safeSetLoading, safeSetMessage],
  )

  const removeStageGuest = useCallback(
    async (stagePassId: string) => {
      if (!streamId || !user?.id || !stagePassId) return

      safeSetLoading(true)
      safeSetMessage(null)

      console.debug('[useStagePasses] removeStageGuest:start', {
        table: TABLE_NAME,
        streamId,
        broadcasterId: user.id,
        stagePassId,
      })

      try {
        const now = new Date().toISOString()

        const { data, error } = await supabase
          .from(TABLE_NAME)
          .update({
            status: 'removed',
            removed_at: now,
            user_id: null,
            requested_at: null,
            approved_at: null,
            went_live_at: null,
            paid_amount: 0,
            updated_at: now,
          })
          .eq('id', stagePassId)
          .eq('stream_id', streamId)
          .eq('broadcaster_id', user.id)
          .select('id, stream_id, status, stage_index')
          .maybeSingle()

        if (error) throw error

        if (!data) {
          console.warn('[useStagePasses] removeStageGuest:no row updated', {
            stagePassId,
            streamId,
            broadcasterId: user.id,
          })
          safeSetMessage('Could not remove this guest.')
          return
        }

        console.debug('[useStagePasses] removeStageGuest:success', { data })

        if (data.stage_index != null) {
          const { data: seatData, error: seatError } = await supabase
            .from('stream_seats')
            .select('id')
            .eq('stream_id', streamId)
            .eq('seat_index', data.stage_index)
            .eq('status', 'active')
            .maybeSingle()

          if (seatError) {
            console.warn('[useStagePasses] removeStageGuest:stream_seats lookup failed', {
              streamId,
              stageIndex: data.stage_index,
              error: seatError,
            })
          } else if (seatData?.id) {
            const { error: leaveError } = await supabase.rpc('leave_seat_atomic', {
              p_session_id: seatData.id,
            })

            if (leaveError) {
              console.warn('[useStagePasses] removeStageGuest:leave_seat_atomic failed', {
                streamId,
                stageIndex: data.stage_index,
                sessionId: seatData.id,
                error: leaveError,
              })
            }
          }
        }

        await loadStagePasses()
      } catch (err: any) {
        const msg = err?.message || 'Failed to remove guest'
        console.error('[useStagePasses] removeStageGuest:error', {
          stagePassId,
          streamId,
          broadcasterId: user?.id,
          error: err,
        })
        safeSetMessage(msg)
      } finally {
        safeSetLoading(false)
      }
    },
    [streamId, user?.id, loadStagePasses, safeSetLoading, safeSetMessage],
  )

  useEffect(() => {
    mountedRef.current = true

    if (!streamId) {
      setStagePasses([])
      setCurrentUserStagePass(null)
      return
    }

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channelName = `stage-passes-${streamId}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE_NAME,
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.debug('[useStagePasses] realtime payload', {
            channelName,
            streamId,
            eventType: payload.eventType,
            payload,
          })

          void loadStagePasses()
        },
      )
      .subscribe((status, err) => {
        console.debug('[useStagePasses] realtime subscription status', {
          channelName,
          streamId,
          status,
          err,
        })

        if (status === 'SUBSCRIBED') {
          void loadStagePasses()
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useStagePasses] realtime subscription problem', {
            channelName,
            streamId,
            status,
            err,
          })
        }
      })

    channelRef.current = channel

    void loadStagePasses()

    return () => {
      mountedRef.current = false

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [streamId, loadStagePasses])

  const requests = useMemo(() => {
    return stagePasses.filter((sp) => isRequestStatus(sp.status))
  }, [stagePasses])

  return {
    stagePasses,
    requests,
    currentUserStagePass,
    loading,
    message,
    openStagePasses,
    requestStagePass,
    approveStagePass,
    denyStagePass,
    removeStageGuest,
    loadStagePasses,
    refetch: loadStagePasses,
  }
}