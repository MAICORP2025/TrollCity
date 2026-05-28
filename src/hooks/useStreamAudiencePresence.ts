import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'

export interface StreamAudienceMember {
  id: string
  stream_id: string
  user_id: string
  username: string
  avatar_url: string | null
  joined_at: string
  left_at: string | null
  is_active: boolean
  is_present?: boolean
  gift_total: number
  gift_score?: number
  seat_id: string | null
  seat_status: 'audience' | 'seated'
  role: 'viewer' | 'audience' | 'seat' | 'broadcaster'
  last_seen_at: string
}

function normalizeSeatStatus(value: any): 'audience' | 'seated' {
  return value === 'seated' ? 'seated' : 'audience'
}

function normalizeAudienceMember(row: any): StreamAudienceMember {
  const giftTotal = Number(row?.gift_total ?? row?.gift_score ?? row?.gift_total_coins ?? 0)
  const seatStatus = normalizeSeatStatus(row?.seat_status)

  return {
    id: row?.id ?? `${row?.stream_id ?? 'stream'}-${row?.user_id ?? 'viewer'}`,
    stream_id: row?.stream_id ?? '',
    user_id: row?.user_id ?? '',
    username: row?.username ?? row?.display_name ?? 'Viewer',
    avatar_url: row?.avatar_url ?? null,
    joined_at: row?.joined_at ?? new Date().toISOString(),
    left_at: row?.left_at ?? null,
    is_active: Boolean(row?.is_active ?? row?.is_present ?? true),
    is_present: row?.is_present ?? Boolean(row?.is_active ?? true),
    gift_total: giftTotal,
    gift_score: Number(row?.gift_score ?? giftTotal),
    seat_id: row?.seat_id ?? null,
    seat_status: seatStatus,
    role: row?.role ?? (seatStatus === 'seated' ? 'seat' : 'audience'),
    last_seen_at: row?.last_seen_at ?? row?.joined_at ?? new Date().toISOString(),
  }
}

function dedupeAudienceMembers(list: StreamAudienceMember[]) {
  const map = new Map<string, StreamAudienceMember>()

  list.forEach((member) => {
    const key = `${member.stream_id}:${member.user_id}`
    const existing = map.get(key)
    if (!existing || new Date(member.joined_at).getTime() < new Date(existing.joined_at).getTime()) {
      map.set(key, member)
    }
  })

  return Array.from(map.values())
}

export function useStreamAudiencePresence(
  streamId: string,
  userId: string | null
) {
  const { user, profile } = useAuthStore()
  const effectiveUserId = userId || user?.id

  const [audience, setAudience] = useState<StreamAudienceMember[]>([])
  const [activeAudience, setActiveAudience] = useState<StreamAudienceMember[]>([])
  const [topAudience, setTopAudience] = useState<StreamAudienceMember[]>([])
  const [myPresence, setMyPresence] = useState<StreamAudienceMember | null>(null)

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const lastGiftUpdateRef = useRef<Record<string, number>>({})

  const fetchAudience = useCallback(async () => {
    if (!streamId) return
    try {
      const { data, error } = await supabase
        .from('stream_audience_presence')
        .select('*')
        .eq('stream_id', streamId)
        .order('gift_total', { ascending: false })
        .order('joined_at', { ascending: true })

      if (error) {
        console.warn('[useStreamAudiencePresence] fetchAudience error', error)
        return
      }

      const audienceList = dedupeAudienceMembers((data || []).map(normalizeAudienceMember))
      setAudience(audienceList)

      // Active audience: those with is_active true and left_at null
      const active = audienceList.filter(
        (member) => member.is_active && !member.left_at
      )
      setActiveAudience(active)

      // Top audience: sorted by gift_total descending, then joined_at ascending
      const top = [...audienceList].sort((a, b) => {
        if (b.gift_total !== a.gift_total) {
          return b.gift_total - a.gift_total
        }
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      })
      setTopAudience(top)

      // My presence
      if (effectiveUserId) {
        const myMember = audienceList.find(
          (member) => member.user_id === effectiveUserId
        )
        setMyPresence(myMember || null)
      }
    } catch (err) {
      console.warn('[useStreamAudiencePresence] fetchAudience failed', err)
    }
  }, [streamId, effectiveUserId])

  const joinAudience = useCallback(async () => {
    if (!effectiveUserId || !streamId) return

    const now = new Date().toISOString()
    const username = profile?.username || user?.email?.split('@')?.[0] || effectiveUserId
    const avatarUrl = profile?.avatar_url ?? null

    try {
      const { data: existingRow, error: lookupError } = await supabase
        .from('stream_audience_presence')
        .select('id')
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)
        .maybeSingle()

      if (lookupError) {
        console.warn('[useStreamAudiencePresence] joinAudience lookup error', lookupError)
        toast.error('Failed to join audience')
        return false
      }

       if (existingRow) {
         const { error: updateError } = await supabase
           .from('stream_audience_presence')
           .update({
             is_active: true,
             is_present: true,
             left_at: null,
             last_seen_at: now,
             username,
             avatar_url: avatarUrl,
             gift_score: 0,
             seat_id: null,
             seat_index: null,
             seat_status: 'audience',
             role: 'audience',
           })
           .eq('id', existingRow.id)

        if (updateError) {
          console.warn('[useStreamAudiencePresence] joinAudience update error', updateError)
          toast.error('Failed to join audience')
          return false
        }
       } else {
         const { error: insertError } = await supabase
           .from('stream_audience_presence')
           .insert({
             stream_id: streamId,
             user_id: effectiveUserId,
             username,
             avatar_url: avatarUrl,
             joined_at: now,
             left_at: null,
             is_active: true,
             is_present: true,
             gift_total: 0,
             gift_total_coins: 0,
             gift_score: 0,
             message_count: 0,
             seat_id: null,
             seat_index: null,
             seat_status: 'audience',
             role: 'audience',
             last_seen_at: now,
           })

        if (insertError) {
          console.warn('[useStreamAudiencePresence] joinAudience insert error', insertError)
          toast.error('Failed to join audience')
          return false
        }
      }

      return true
    } catch (err) {
      console.warn('[useStreamAudiencePresence] joinAudience failed', err)
      toast.error('Failed to join audience')
      return false
    }
  }, [streamId, effectiveUserId, profile?.avatar_url, profile?.username, user?.email])

   const leaveAudience = useCallback(async () => {
     if (!effectiveUserId || !streamId) return
     const now = new Date().toISOString()

     try {
       const { error } = await supabase
         .from('stream_audience_presence')
         .update({
           is_active: false,
           is_present: false,
           left_at: now,
           last_seen_at: now,
           seat_id: null,
           seat_index: null,
           seat_status: 'audience',
         })
         .eq('stream_id', streamId)
         .eq('user_id', effectiveUserId)

       if (error) {
         console.warn('[useStreamAudiencePresence] leaveAudience error', error)
       }
     } catch (err) {
       console.warn('[useStreamAudiencePresence] leaveAudience failed', err)
     }
   }, [streamId, effectiveUserId])

  const heartbeatAudience = useCallback(async () => {
    if (!effectiveUserId || !streamId) return
    const now = new Date().toISOString()

    try {
      const { error } = await supabase
        .from('stream_audience_presence')
        .update({
          last_seen_at: now,
        })
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)

      if (error) {
        console.warn('[useStreamAudiencePresence] heartbeatAudience error', error)
      }
    } catch (err) {
      console.warn('[useStreamAudiencePresence] heartbeatAudience failed', err)
    }
  }, [streamId, effectiveUserId])

  const incrementGiftTotal = useCallback(async (amount: number) => {
    if (!effectiveUserId || !streamId) return
    const now = new Date().toISOString()

    try {
      const { data: existingRow, error: lookupError } = await supabase
        .from('stream_audience_presence')
        .select('gift_total')
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)
        .maybeSingle()

      if (lookupError) {
        console.warn('[useStreamAudiencePresence] incrementGiftTotal lookup error', lookupError)
        return
      }

      const currentGiftTotal = Number(existingRow?.gift_total ?? 0)

      const { error: updateError } = await supabase
        .from('stream_audience_presence')
        .update({
          gift_total: currentGiftTotal + amount,
          last_seen_at: now,
        })
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)

      if (updateError) {
        console.warn('[useStreamAudiencePresence] incrementGiftTotal update error', updateError)
        return
      }

      setAudience((prev) =>
        prev.map((member) =>
          member.user_id === effectiveUserId
            ? { ...member, gift_total: member.gift_total + amount }
            : member
        )
      )
      lastGiftUpdateRef.current[effectiveUserId] = Date.now()
    } catch (err) {
      console.warn('[useStreamAudiencePresence] incrementGiftTotal failed', err)
    }
  }, [streamId, effectiveUserId])

  // Fetch initial data
  useEffect(() => {
    void fetchAudience()
  }, [fetchAudience])

  // Subscribe to realtime audience presence changes
  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream-audience-presence:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_audience_presence',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          try {
            const evt = (payload as any).eventType || '*'
            const newRow = (payload as any).new
            const oldRow = (payload as any).old

            setAudience((prev) => {
              let next = [...prev]
              if (evt === 'DELETE') {
                if (oldRow) {
                  next = next.filter((member) => member.id !== oldRow.id && member.user_id !== oldRow.user_id)
                }
              } else {
                const row = newRow || oldRow
                if (row) {
                  const member = normalizeAudienceMember(row)
                  const existingIndex = next.findIndex((candidate) => candidate.id === member.id || candidate.user_id === member.user_id)
                  if (existingIndex >= 0) {
                    next[existingIndex] = member
                  } else {
                    next.push(member)
                  }
                }
              }
              return dedupeAudienceMembers(next)
            })

            // Update active audience
            setActiveAudience((prev) => {
              let next = [...prev]
              if (evt === 'DELETE') {
                if (oldRow) {
                  next = next.filter((member) => member.id !== oldRow.id && member.user_id !== oldRow.user_id)
                }
              } else {
                const row = newRow || oldRow
                if (row) {
                  const member = normalizeAudienceMember(row)
                  const isActive = member.is_present && !member.left_at
                  const existingIndex = next.findIndex((candidate) => candidate.id === member.id || candidate.user_id === member.user_id)
                  if (isActive) {
                    if (existingIndex >= 0) {
                      next[existingIndex] = member
                    } else {
                      next.push(member)
                    }
                  } else if (existingIndex >= 0) {
                    next.splice(existingIndex, 1)
                  }
                }
              }
              return dedupeAudienceMembers(next)
            })

            // Update top audience (we'll refetch on gift updates or use a more complex sort)
            // For simplicity, we refetch on any change that might affect order
            void fetchAudience()

            // Update my presence
            if (effectiveUserId) {
              setMyPresence((prev) => {
                if (!newRow && !oldRow) return prev
                const row = newRow || oldRow
                if (row && row.user_id === effectiveUserId) {
                  return normalizeAudienceMember(row)
                }
                return prev
              })
            }
          } catch (err) {
            console.warn('[useStreamAudiencePresence] realtime handler error', err)
          }
        }
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {}
    }
  }, [streamId, effectiveUserId, fetchAudience])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream-gifts-audience:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_gifts',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const gift = (payload as any).new
          if (!gift?.sender_id) return

          const amount = Number(gift.amount ?? 0) * Number(gift.quantity ?? 1)
          if (!amount) return

          setAudience((prev) => {
            const next = prev.map((member) =>
              member.user_id === gift.sender_id
                ? { ...member, gift_total: member.gift_total + amount, gift_score: (member.gift_score ?? member.gift_total) + amount }
                : member
            )
            return dedupeAudienceMembers(next)
          })

          setActiveAudience((prev) => {
            const next = prev.map((member) =>
              member.user_id === gift.sender_id
                ? { ...member, gift_total: member.gift_total + amount, gift_score: (member.gift_score ?? member.gift_total) + amount }
                : member
            )
            return dedupeAudienceMembers(next)
          })

          void fetchAudience()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, fetchAudience])

  // Heartbeat every 30 seconds to keep presence active
  useEffect(() => {
    if (!effectiveUserId || !streamId) return

    heartbeatRef.current = setInterval(() => {
      void heartbeatAudience()
    }, 30 * 1000)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [effectiveUserId, streamId, heartbeatAudience])

  // Refetch audience on gift updates (if we don't want to rely solely on realtime for sorting)
  useEffect(() => {
    if (!effectiveUserId || !streamId) return
    const now = Date.now()
    const lastUpdate = lastGiftUpdateRef.current[effectiveUserId] || 0
    // Refetch if gift was updated in the last 5 seconds to avoid excessive requests
    if (now - lastUpdate < 5000) {
      void fetchAudience()
    }
  }, [effectiveUserId, streamId, fetchAudience])

  const refreshAudience = useCallback(async () => {
    await fetchAudience()
  }, [fetchAudience])

  return {
    audience,
    activeAudience,
    topAudience,
    myPresence,
    joinAudience,
    leaveAudience,
    heartbeatAudience,
    incrementGiftTotal,
    refreshAudience,
  }
}