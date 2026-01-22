import { create } from 'zustand'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../lib/store'

interface XPState {
  xpTotal: number
  level: number
  xpToNext: number
  progress: number
  isLoading: boolean
  fetchXP: (userId: string) => Promise<void>
  subscribeToXP: (userId: string) => void
  unsubscribe: () => void
}

export const useXPStore = create<XPState>((set) => {
  let channel: any = null;

  const syncAuthProfile = (level: number, totalXp: number, nextLevelXp: number | null) => {
    const auth = useAuthStore.getState()
    if (!auth?.profile || !auth?.setProfile) return

    auth.setProfile({
      ...auth.profile,
      level: level || auth.profile.level || 1,
      xp: totalXp ?? auth.profile.xp ?? 0,
      total_xp: totalXp ?? auth.profile.total_xp,
      next_level_xp: nextLevelXp ?? auth.profile.next_level_xp,
    })
  }

  const computeXpState = (data: {
    level?: number; xp?: number; total_xp?: number; next_level_xp?: number;
    current_level?: number; current_xp?: number; buyer_level?: number; buyer_xp?: number; stream_level?: number; stream_xp?: number;
    [key: string]: any;
  }) => {
    // Prefer primary level columns, but use buyer_level/stream_level from user_level table
    // For now, prioritize buyer_level as the main level
    const levelValue = data.level
      ?? data.current_level
      ?? data.buyer_level
      ?? data.stream_level
      ?? 1

    // Prefer buyer_xp from user_level table as main XP source
    const absoluteXp = data.total_xp
      ?? data.xp
      ?? data.current_xp
      ?? data.buyer_xp
      ?? data.stream_xp
      ?? 0

    const nextLevelAbsolute = data.next_level_xp ?? (levelValue + 1) * 100
    const prevLevelAbsolute = Math.max(0, levelValue * 100)

    // If absoluteXp already looks like within-level XP, don't subtract a base
    const looksLikeSegmentXp = absoluteXp <= nextLevelAbsolute && absoluteXp <= 100000 // guard against huge subtraction
    const xpIntoLevel = looksLikeSegmentXp ? Math.max(0, absoluteXp) : Math.max(0, absoluteXp - prevLevelAbsolute)
    const xpNeededThisLevel = Math.max(1, nextLevelAbsolute - prevLevelAbsolute)
    const progressValue = Math.min(1, xpIntoLevel / xpNeededThisLevel)

    console.log('XP Store computed:', { levelValue, absoluteXp, xpIntoLevel, xpNeededThisLevel, progressValue })

    return {
      levelValue,
      totalXp: absoluteXp,
      xpToNext: Math.max(0, xpNeededThisLevel - xpIntoLevel),
      progressValue,
      nextLevelAbsolute,
    }
  }

  return {
    xpTotal: 0,
    level: 1,
    xpToNext: 100,
    progress: 0,
    isLoading: false,

    fetchXP: async (userId: string) => {
      set({ isLoading: true })
      try {
        console.log('Fetching XP for user:', userId)
        const { data, error } = await supabase
          .from('user_profiles')
          .select('level, xp')
          .eq('id', userId)
          .single()

        console.log('user_profiles level query result:', { data, error })
        
        if (error && error.code !== 'PGRST116') throw error
        
        if (data) {
          const { levelValue, totalXp, xpToNext, progressValue, nextLevelAbsolute } = computeXpState(data)

          set({
            xpTotal: totalXp,
            level: levelValue,
            xpToNext,
            progress: progressValue,
            isLoading: false
          })

          syncAuthProfile(levelValue, totalXp, nextLevelAbsolute)
        } else {
          // No row exists - create it with defaults
          console.warn('No user_level data found for user:', userId, '- creating initial row')
          const { error: insertError } = await supabase
            .from('user_profiles')
            .update({ level: 1, xp: 0 })
            .eq('id', userId)
            .select('level, xp')
            .single()
          
          if (insertError) {
            console.error('Error creating user_level row:', insertError)
          }
          
          set({ 
            xpTotal: 0,
            level: 1,
            xpToNext: 100,
            progress: 0,
            isLoading: false 
          })

          syncAuthProfile(1, 0, 100)
        }
      } catch (err) {
        console.error('Error fetching XP stats:', err)
        set({ isLoading: false })
      }
    },

    subscribeToXP: (userId: string) => {
      if (channel) return;

      channel = supabase
        .channel('xp_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            const newData = payload.new
            if (newData) {
              const { levelValue, totalXp, xpToNext, progressValue, nextLevelAbsolute } = computeXpState(newData)

              set({
                xpTotal: totalXp,
                level: levelValue,
                xpToNext,
                progress: progressValue
              })

              syncAuthProfile(levelValue, totalXp, nextLevelAbsolute)
            }
          }
        )
        .subscribe()
    },

    unsubscribe: () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }
  }
})
