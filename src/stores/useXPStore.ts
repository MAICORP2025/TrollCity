import { create } from 'zustand'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../lib/store'
import { grantLevelPerksForUser } from '../lib/levelPerkSystem'

interface XPState {
  xpTotal: number
  level: number
  buyerLevel: number
  streamLevel: number
  xpToNext: number
  progress: number
  isLoading: boolean
  fetchXP: (userId: string) => Promise<void>
  subscribeToXP: (userId: string) => void
  unsubscribe: () => void
}

export const useXPStore = create<XPState>((set) => {
  let channel: any = null;
  let xpChannelUserId: string | null = null;
  let xpFetchPromise: Promise<void> | null = null;
  let lastXPFetchUserId: string | null = null;
  let lastXPFetchTime = 0;
  let lastLevelPerksSynced = 0;
  const XP_FETCH_DEBOUNCE_MS = 20 * 1000;

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

  const _computeXpState = (data: {
    level?: number; xp?: number; total_xp?: number; next_level_xp?: number; xp_total?: number; xp_to_next_level?: number;
    current_level?: number; current_xp?: number; buyer_level?: number; buyer_xp?: number; stream_level?: number; stream_xp?: number;
    [key: string]: any;
  }) => {
    // Use xp_total from user_stats table (as calculated by SQL migration)
    const absoluteXp = data.xp_total || data.total_xp || data.xp || 0;
    
    // Calculate level based on the same thresholds as the SQL migration
    let levelValue = 1;
    let xpNeededThisLevel = 100;  // XP needed to reach next level
    let prevLevelAbsolute = 0;    // XP at start of current level
    let nextLevelAbsolute = 100;  // XP needed to reach next level
    
    if (absoluteXp < 100) {
      levelValue = 1;
      xpNeededThisLevel = 100;
      prevLevelAbsolute = 0;
      nextLevelAbsolute = 100;
    } else if (absoluteXp < 250) {
      levelValue = 2;
      xpNeededThisLevel = 150;
      prevLevelAbsolute = 100;
      nextLevelAbsolute = 250;
    } else if (absoluteXp < 500) {
      levelValue = 3;
      xpNeededThisLevel = 250;
      prevLevelAbsolute = 250;
      nextLevelAbsolute = 500;
    } else if (absoluteXp < 800) {
      levelValue = 4;
      xpNeededThisLevel = 300;
      prevLevelAbsolute = 500;
      nextLevelAbsolute = 800;
    } else if (absoluteXp < 1200) {
      levelValue = 5;
      xpNeededThisLevel = 400;
      prevLevelAbsolute = 800;
      nextLevelAbsolute = 1200;
    } else if (absoluteXp < 1700) {
      levelValue = 6;
      xpNeededThisLevel = 500;
      prevLevelAbsolute = 1200;
      nextLevelAbsolute = 1700;
    } else if (absoluteXp < 2300) {
      levelValue = 7;
      xpNeededThisLevel = 600;
      prevLevelAbsolute = 1700;
      nextLevelAbsolute = 2300;
    } else if (absoluteXp < 3000) {
      levelValue = 8;
      xpNeededThisLevel = 700;
      prevLevelAbsolute = 2300;
      nextLevelAbsolute = 3000;
    } else if (absoluteXp < 4000) {
      levelValue = 9;
      xpNeededThisLevel = 1000;
      prevLevelAbsolute = 3000;
      nextLevelAbsolute = 4000;
    } else {
      // Level 10+: Each level requires 1000 more XP
      levelValue = 10 + Math.floor((absoluteXp - 4000) / 1000);
      xpNeededThisLevel = 1000;
      prevLevelAbsolute = 4000 + ((levelValue - 10) * 1000);
      nextLevelAbsolute = prevLevelAbsolute + 1000;
    }

    const xpIntoLevel = Math.max(0, absoluteXp - prevLevelAbsolute);
    const progressValue = Math.min(100, (xpIntoLevel / xpNeededThisLevel) * 100);

    console.log('XP Store computed:', { levelValue, absoluteXp, xpIntoLevel, xpNeededThisLevel, progressValue });

    return {
      levelValue,
      totalXp: absoluteXp,
      xpToNext: Math.max(0, xpNeededThisLevel - xpIntoLevel),
      progressValue,
      nextLevelAbsolute,
    };
  };

  return {
    xpTotal: 0,
    level: 1,
    buyerLevel: 1,
    streamLevel: 1,
    xpToNext: 100,
    progress: 0,
    isLoading: false,

    fetchXP: async (userId: string) => {
      if (!userId || userId.startsWith('TC-')) {
        console.log('[XP Store] Guest user detected, skipping XP fetch');
        set({
          xpTotal: 0,
          level: 1,
          buyerLevel: 1,
          streamLevel: 1,
          xpToNext: 100,
          progress: 0,
          isLoading: false
        });
        return;
      }

      const now = Date.now();
      if (userId === lastXPFetchUserId && xpFetchPromise) {
        console.log('[XP Store] XP fetch already in progress for user:', userId);
        set({ isLoading: true });
        await xpFetchPromise;
        return;
      }

      if (userId !== lastXPFetchUserId) {
        lastLevelPerksSynced = 0;
      }

      if (userId === lastXPFetchUserId && now - lastXPFetchTime < XP_FETCH_DEBOUNCE_MS) {
        console.log('[XP Store] Skipping XP fetch due to cooldown:', userId);
        set({ isLoading: false });
        return;
      }

      lastXPFetchUserId = userId;
      set({ isLoading: true });

      xpFetchPromise = (async () => {
        try {
          console.log('[XP Store] Fetching XP for user:', userId);

          const { data, error } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          console.log('[XP Store] user_stats query result:', { data, error });

          if (error) throw error;

          if (data) {
            const { levelValue, totalXp, xpToNext, progressValue, nextLevelAbsolute } = _computeXpState(data);

            set({
              xpTotal: totalXp,
              level: levelValue,
              buyerLevel: levelValue,
              streamLevel: levelValue,
              xpToNext: xpToNext,
              progress: progressValue,
              isLoading: false
            });

            syncAuthProfile(levelValue, totalXp, nextLevelAbsolute);
            if (levelValue > lastLevelPerksSynced) {
              const { data: sessionData } = await supabase.auth.getSession()
              if (sessionData?.session?.access_token) {
                await grantLevelPerksForUser(userId, levelValue)
              }
              lastLevelPerksSynced = levelValue
            }
            lastXPFetchTime = Date.now();
          } else {
            console.log('[XP Store] No user_stats found, initializing...');
            const { data: _newData, error: insertError } = await supabase.rpc('grant_xp', {
              p_user_id: userId,
              p_amount: 0,
              p_source: 'init',
              p_source_id: `init_${Date.now()}`
            });

            if (!insertError) {
              set({
                xpTotal: 0,
                level: 1,
                buyerLevel: 1,
                streamLevel: 1,
                xpToNext: 100,
                progress: 0,
                isLoading: false
              });
              syncAuthProfile(1, 0, 100);
              lastLevelPerksSynced = 1;
              const { data: sessionData } = await supabase.auth.getSession()
              if (sessionData?.session?.access_token) {
                await grantLevelPerksForUser(userId, 1)
              }
              lastXPFetchTime = Date.now();
            } else {
              set({ isLoading: false });
            }
          }
        } catch (error) {
          console.error('[XP Store] Error fetching XP:', error);
          set({ isLoading: false });
        } finally {
          xpFetchPromise = null;
        }
      })();

      await xpFetchPromise;
    },

    subscribeToXP: (userId: string) => {
      // Skip guest users and clear existing subscription when switching away
      if (!userId || userId.startsWith('TC-')) {
        if (channel) {
          supabase.removeChannel(channel)
          channel = null
          xpChannelUserId = null
        }
        console.log('[XP Store] Guest user, skipping subscription')
        return
      }

      if (channel && channel.state === 'joined') {
        console.log('[XP Store] Already subscribed to XP for user:', userId)
        return
      }

      if (xpChannelUserId === userId && channel) {
        console.log('[XP Store] Channel exists for user, skipping re-subscribe:', userId)
        return
      }

      if (xpChannelUserId !== userId) {
        lastLevelPerksSynced = 0
      }

      if (channel) {
        supabase.removeChannel(channel)
        channel = null
        xpChannelUserId = null
      }

      xpChannelUserId = userId
      console.log('[XP Store] Subscribing to user_stats for user:', userId)

      // Use a stable channel name so we do not resubscribe on rerenders
      const channelName = `user_stats:${userId}`
      
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'user_stats',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            console.log('[XP Store] Realtime update received:', payload)
            
            if (payload.eventType === 'DELETE') {
              console.log('[XP Store] User stats deleted, resetting')
              set({
                xpTotal: 0,
                level: 1,
                buyerLevel: 1,
                streamLevel: 1,
                xpToNext: 100,
                progress: 0,
                isLoading: false
              })
              syncAuthProfile(1, 0, 100)
              return
            }
            
            if (payload.new) {
              const data = payload.new as any;
              console.log('[XP Store] Processing new data:', data)
              
              const { levelValue, totalXp, xpToNext, progressValue, nextLevelAbsolute } = _computeXpState(data);

              console.log('[XP Store] Computed state:', { levelValue, totalXp, xpToNext, progressValue })

              set({
                xpTotal: totalXp,
                level: levelValue,
                buyerLevel: levelValue,
                streamLevel: levelValue,
                xpToNext: xpToNext,
                progress: progressValue,
                isLoading: false
              });
              syncAuthProfile(levelValue, totalXp, nextLevelAbsolute);
              if (levelValue > lastLevelPerksSynced) {
                const { data: sessionData } = await supabase.auth.getSession()
                if (sessionData?.session?.access_token) {
                  await grantLevelPerksForUser(userId, levelValue)
                }
                lastLevelPerksSynced = levelValue
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('[XP Store] Subscription status:', status)
          if (status === 'CHANNEL_ERROR') {
            console.warn('[XP Store] Channel error, will retry in 5s')
            const capturedChannel = channel
            channel = null
            xpChannelUserId = null
            setTimeout(() => {
              supabase.removeChannel(capturedChannel)
              useXPStore.getState().subscribeToXP(userId)
            }, 5000)
          }
        })
    },

    unsubscribe: () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
        xpChannelUserId = null
      }
    }
  }
})
