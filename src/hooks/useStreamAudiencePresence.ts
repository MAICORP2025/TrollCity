import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { getProfiles } from '../lib/profileCache'

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
  seat_id: number | null
  seat_status?: 'audience' | 'seated'
  role: 'audience' | 'seat' | 'broadcaster'
  last_seen_at: string
  is_ghost_mode?: boolean
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
    role: row?.role === 'seat' || row?.role === 'broadcaster' ? row.role : 'audience',
    last_seen_at: row?.last_seen_at ?? row?.joined_at ?? new Date().toISOString(),
    is_ghost_mode: row?.is_ghost_mode ?? false,
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

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastGiftUpdateRef = useRef<Record<string, number>>({})
  const channelsRef = useRef<any[]>([])
  const ghostModeFetchedRef = useRef<{ streamId: string; userIds: string } | null>(null)
  const profileRef = useRef(profile)
  const userRef = useRef(user)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  useEffect(() => {
    userRef.current = user
  }, [user])

  const cleanupChannels = useCallback(() => {
    channelsRef.current.forEach(ch => { if (ch) supabase.removeChannel(ch) })
    channelsRef.current = []
  }, [])

  const fetchAudience = useCallback(async () => {
    if (!streamId) return
    try {
const { data, error } = await supabase
          .from('stream_audience_presence')
          .select('*')
          .eq('stream_id', streamId)
          .eq('is_active', true)
          .order('gift_total', { ascending: false })
          .order('joined_at', { ascending: true })

      if (error) {
        console.warn('[useStreamAudiencePresence] fetchAudience error', error)
        return
      }

      const audienceList = dedupeAudienceMembers((data || []).map(normalizeAudienceMember))
      setAudience(audienceList)

      const active = audienceList.filter(
        (member) => member.is_active && !member.left_at
      )
      setActiveAudience(active)

      const top = [...audienceList].sort((a, b) => {
        if (b.gift_total !== a.gift_total) {
          return b.gift_total - a.gift_total
        }
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      })
      setTopAudience(top)

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

    const currentProfile = profileRef.current
    const currentUser = userRef.current

    // Don't join audience presence if user has ghost mode enabled
    if (currentProfile?.is_ghost_mode) return

    const now = new Date().toISOString()
    const username = currentProfile?.username || currentUser?.email?.split('@')?.[0] || effectiveUserId
    const avatarUrl = currentProfile?.avatar_url ?? null

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
            left_at: null,
            last_seen_at: now,
            username,
            avatar_url: avatarUrl,
            seat_id: null,
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
            gift_total: 0,
            seat_id: null,
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
  }, [streamId, effectiveUserId])

  const leaveAudience = useCallback(async () => {
    if (!effectiveUserId || !streamId) return
    const now = new Date().toISOString()

    try {
      const { error } = await supabase
        .from('stream_audience_presence')
        .update({
          is_active: false,
          left_at: now,
          last_seen_at: now,
          seat_id: null,
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

  useEffect(() => {
    void fetchAudience()
  }, [fetchAudience])

  useEffect(() => {
    if (!streamId) return

    cleanupChannels()

    const audienceChannel = supabase
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

            // Update myPresence from the realtime payload directly — no DB refetch needed
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
        }
      )
      .subscribe()

    channelsRef.current = [audienceChannel]

    return () => {
      cleanupChannels()
    }
  }, [streamId, effectiveUserId, fetchAudience, cleanupChannels])

  // Fetch ghost mode status for audience members (realtime doesn't support joins)
  // Guard with a ref so we only fetch once per unique set of audience user IDs.
  useEffect(() => {
    if (!streamId) return

    const currentUserIds = audience
      .map(m => m.user_id)
      .filter(Boolean)
      .sort()
      .join(',')

    const last = ghostModeFetchedRef.current
    if (last?.streamId === streamId && last.userIds === currentUserIds) {
      return
    }

    if (!currentUserIds) return

    const fetchGhostModeStatus = async () => {
      const ids = currentUserIds.split(',')
      const profiles = await getProfiles(ids)

      if (profiles.length > 0) {
        ghostModeFetchedRef.current = { streamId, userIds: currentUserIds }
        const ghostModeMap = new Map(profiles.map((p: any) => [p.id, p.is_ghost_mode]))
        setAudience((prev) =>
          prev.map((member) => ({
            ...member,
            is_ghost_mode: ghostModeMap.get(member.user_id) ?? false,
          }))
        )
      }
    }

    fetchGhostModeStatus()
  }, [streamId, audience])

  // REPLACED: 30s DB heartbeat interval removed.
  // The postgres_changes subscription on stream_audience_presence (above) already
  // pushes all changes in real-time. The heartbeat was redundant — any update to
  // last_seen_at, is_active, or gift_total is already received via the realtime
  // channel without polling.
  useEffect(() => {
    if (!effectiveUserId || !streamId) return

    // No interval needed — realtime subscription handles all updates
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [effectiveUserId, streamId])

  useEffect(() => {
    if (!effectiveUserId || !streamId) return
    const now = Date.now()
    const lastUpdate = lastGiftUpdateRef.current[effectiveUserId] || 0
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
