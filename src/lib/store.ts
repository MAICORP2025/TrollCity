import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile, UserRole, validateProfile, ensureSupabaseSession } from '../lib/supabase'
import { handleConcurrentLogin, resetConcurrentLoginCheck } from './sessionUtils'
import { generateUUID } from './uuid'
import { globalRequestScheduler } from './requestScheduler'

// Module-level debounce tracking
// NOTE: keep this block free of merge markers (<<<<<<< / ======= / >>>>>>>)
// because Vite/esbuild will fail hard on any unresolved conflict tokens.
let lastRefreshProfileTime = 0
let lastProfileUpdateTime = 0
const PROFILE_UPDATE_DEBOUNCE_MS = 2000 // 2 seconds
const REFRESH_PROFILE_DEBOUNCE_MS = 5000 // 5 seconds - increased from 3s to reduce lock conflicts
const GLOBAL_EVENT_DEDUP_MS = 60 * 1000 // 1 minute
const announcedGlobalEvents: Record<string, number> = {}

function shouldAnnounceGlobalEvent(key: string): boolean {
  const now = Date.now()
  const last = announcedGlobalEvents[key]
  if (last && now - last < GLOBAL_EVENT_DEDUP_MS) {
    return false
  }
  announcedGlobalEvents[key] = now
  return true
}

function announceGlobalEvent(event: { title: string; icon: string; priority: number }) {
  const key = `${event.title.toLowerCase()}`
  if (!shouldAnnounceGlobalEvent(key)) {
    return
  }

  supabase.from('global_events').insert([event]).then().catch(() => {})
}

// Check if logout was requested via sessionStorage (set before signOut)
function checkLogoutRequested(): boolean {
  try {
    return sessionStorage.getItem('logout_requested') === 'true'
  } catch {
    return false
  }
}

function clearLogoutRequested() {
  try {
    sessionStorage.removeItem('logout_requested')
  } catch {}
}

const PROFILE_IGNORED_KEYS = new Set([
  '_lastRgbUpdate',
  'updated_at',
  'last_seen',
  'last_active_at',
  'online_at',
  'presence_state',
  'session_id',
  'last_login_at',
  'last_sign_in_at',
])

function areProfilesShallowEqual(a: UserProfile, b: UserProfile) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (PROFILE_IGNORED_KEYS.has(key)) continue
    if ((a as any)[key] !== (b as any)[key]) {
      return false
    }
  }
  return true
}

function setLogoutRequested() {
  try {
    sessionStorage.setItem('logout_requested', 'true')
  } catch {}
}

interface AuthState {
  user: User | null
  session: Session | null
  sessionId: string | null
  profile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean | null
  showLegacySidebar: boolean
  isRefreshing: boolean
  setAuth: (user: User | null, session: Session | null, sessionId?: string | null) => void
  setProfile: (profile: UserProfile | null) => void

  setLoading: (loading: boolean) => void
  setAdmin: (isAdmin: boolean | null) => void
  setShowLegacySidebar: (value: boolean) => void
  refreshProfile: (force?: boolean) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      sessionId: null,
      profile: null,
      isLoading: true,  // Start as true — auth initialization is async
      isAdmin: null,
      showLegacySidebar: true,
      isRefreshing: false,

      // Called when Supabase auth changes
      setAuth: (user, session, sessionId = null) => {
        // Clear logout flag when setting auth
        clearLogoutRequested()
        
        try {
          const prev = get()
          const sameUser = (!!prev.user && !!user && prev.user.id === user.id) || (!prev.user && !user)
          const prevToken = (prev.session as any)?.access_token
          const newToken = (session as any)?.access_token
          if (sameUser && prevToken === newToken) {
            // No meaningful change — skip update
            return
          }
        } catch {
          // ignore and continue
        }
        if ((import.meta as any).env?.DEV) {
          console.log('Auth updated', { user: !!user });
        }
        set({ user, session, sessionId, isLoading: false, isAdmin: user ? null : null });
      },

      // Sets profile AND applies admin overrides with production validation
      setProfile: (profile) => {
        const prevProfile = get().profile;

        // Debounce: prevent multiple updates within 2 seconds
        // BUT allow if: it's first profile set or profile changed meaningfully
        const now = Date.now()
        const isFirstProfile = prevProfile === null || prevProfile === undefined
        const hasSignificantChange = prevProfile && profile && !areProfilesShallowEqual(prevProfile, profile)

        if (!isFirstProfile && !hasSignificantChange && (now - lastProfileUpdateTime < PROFILE_UPDATE_DEBOUNCE_MS)) {
          // Too soon and no significant change - skip this update
          return
        }

        if (!profile) {
          if (!prevProfile) {
            return
          }
          lastProfileUpdateTime = now
          set({ profile: null, isAdmin: null })
          return
        }

        // Update timestamp on any profile change
        lastProfileUpdateTime = now

        // Announce login when profile is first loaded
        if (!prevProfile && profile.username) {
          announceGlobalEvent({ title: `${profile.username} just logged in!`, icon: 'login', priority: 1 })
        }

        // Avoid unnecessary updates: compare with current profile
        try {
          const prev = get().profile
          if (prev && profile && prev.id === profile.id && areProfilesShallowEqual(prev, profile)) {
            // No meaningful changes — skip state update to prevent re-renders
            return
          }
        } catch {
          // If comparison fails, continue with update
        }

        // Ensure profile has email (fallback to auth/session)
        const authEmail = get().user?.email || get().session?.user?.email
        if (!profile.email && authEmail) {
          profile = { ...profile, email: authEmail }
        }

        // Import admin email from environment
        const adminEmail = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'
        const adminEmailLower = adminEmail.toLowerCase()
        const profileEmailLower = profile.email?.toLowerCase()

        // Auto-admin if email matches (with validation)
        if (profileEmailLower && profileEmailLower === adminEmailLower) {
          profile = {
            ...profile,
            role: UserRole.ADMIN,
            is_admin: true,
            troll_role: 'admin'
          }
        }

        // Enhanced admin role handling
        const hasAdminFlag = profile.role === UserRole.ADMIN || profile.is_admin
        if (hasAdminFlag) {
          profile = {
            ...profile,
            is_troll_officer: true,
            is_officer_active: true,
            is_lead_officer: true,
            troll_role: 'admin',
            // Ensure admin has highest officer level
            officer_level: Math.max(profile.officer_level || 0, 5)
          }
        }

        // Production logging with validation
        try {
          const validation = validateProfile(profile)
          if (!validation.isValid) {
            console.warn('Profile validation warnings:', validation.warnings)
          }
        } catch {
          // Silent fail if validation not available
        }

        if ((import.meta as any).env?.DEV) {
          console.log('Profile updated:', profile?.username, profile?.role)
        }
        set({ profile, isAdmin: hasAdminFlag })
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setAdmin: (adminState) => set({ isAdmin: adminState }),

      setShowLegacySidebar: (value) => set({ showLegacySidebar: value }),

       // Reload profile from DB - NON-BLOCKING & FAIL-SAFE
    refreshProfile: async (force = false) => {
      const state = get()
      const u = state.user

      if (!u) {
        console.log('[refreshProfile] No user to refresh profile for')
        state.setLoading(false)
        return
      }

      const now = Date.now()

      if (!force && now - lastRefreshProfileTime < REFRESH_PROFILE_DEBOUNCE_MS) {
        console.log('[refreshProfile] Skipping - refreshed too recently')
        state.setLoading(false)
        return
      }

      if (state.isRefreshing) {
        console.log('[refreshProfile] Skipping - already refreshing')
        state.setLoading(false)
        return
      }

      if (force) {
        console.log('[refreshProfile] Force refresh - bypassing debounce')
      }

      lastRefreshProfileTime = now

      console.log('[refreshProfile] Fetching profile for user:', u.id)

      state.setLoading(true)
      set({ isRefreshing: true })

      try {
        const { data, error } = await globalRequestScheduler.schedule(
          async () => {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
            )

            const fetchPromise = ensureSupabaseSession(supabase).then(async () => {
              const { data, error } = await supabase
                .from('user_profiles')
                 .select(`
                  id,
                  user_id,
                  email,
                  username,
                  display_name,
                  avatar_url,
                  role,
                  troll_role,
                  is_admin,
                  is_troll_officer,
                  is_officer_active,
                  is_lead_officer,
                  drivers_license_status,
                  organization_id,
                  is_org_student,
                  organization_profile_visible,
                  troll_coins,
                  paid_coin_balance,
                  free_coin_balance,
                  cashout_coins,
                  cashout_reserved_coins,
                  reserved_troll_coins,
                  total_earned_coins,
                  credit_score,
                  credit_used,
                  level,
                  xp,
                  total_xp,
                  next_level_xp,
                  rgb_username_expires_at,
                  terms_accepted,
                  terms_accepted_at,
                  court_recording_consent,
                  muted_until,
                  account_state,
                  account_deleted_at,
                  account_deletion_cooldown_until,
                  account_reset_after_ban,
                  is_test_account,
                  insurance_type,
                  home_type,
                  entrance_join_type,
                  created_at,
                  updated_at
                `)
                .eq('id', u.id)
                .maybeSingle()

              return { data, error }
            })

            return Promise.race([fetchPromise, timeoutPromise]) as any
          },
          10
        )

        if (error) {
          // PGRST116 = "JSON result is empty" - this is expected when profile doesn't exist for a new user
          // Treat as "no profile exists" rather than a fatal error
          if ((error as any).code === 'PGRST116' || (error as any).message?.includes('JSON result is empty')) {
            console.log('[refreshProfile] No profile row exists (PGRST116) - awaiting signup/profile creation')
            return
          }
          console.error('[refreshProfile] Error:', error)
          return
        }

        if (!data) {
          // No profile returned - this is expected for users who haven't completed signup
          console.log('[refreshProfile] No profile returned for user:', u.id, '- awaiting profile creation')
          return
        }

        let profileData = data as any

        const currentProfile = get().profile

        const mergedProfile = {
          ...(currentProfile || {}),
          ...profileData,

          // Protect agreement fields from accidental undefined/null overwrites.
          terms_accepted:
            profileData.terms_accepted === true || currentProfile?.terms_accepted === true,

          terms_accepted_at:
            profileData.terms_accepted_at || currentProfile?.terms_accepted_at || null,

          court_recording_consent:
            profileData.court_recording_consent === true ||
            currentProfile?.court_recording_consent === true,
        }

        console.log('[refreshProfile] Fetched profile data:', {
          id: mergedProfile.id,
          username: mergedProfile.username,
          role: mergedProfile.role,
          troll_role: mergedProfile.troll_role,
          credit_score: mergedProfile.credit_score,
          credit_used: mergedProfile.credit_used,
          troll_coins: mergedProfile.troll_coins,
          terms_accepted: mergedProfile.terms_accepted,
          terms_accepted_at: mergedProfile.terms_accepted_at,
        })

        get().setProfile(mergedProfile as UserProfile)
        get().setLoading(false)

        profileData = mergedProfile

        ;(async () => {
          try {
            const { data: levelRow } = await supabase
              .from('user_stats')
              .select('level, xp_total, xp_to_next_level')
              .eq('user_id', u.id)
              .maybeSingle()

            if (levelRow) {
              const current = get().profile || profileData

              const updatedProfile = {
                ...current,
                level: levelRow.level ?? current.level ?? 1,
                xp: levelRow.xp_total ?? current.xp ?? 0,
                total_xp: levelRow.xp_total ?? current.total_xp,
                next_level_xp: levelRow.xp_to_next_level ?? current.next_level_xp,
              }

              get().setProfile(updatedProfile as UserProfile)
              profileData = updatedProfile
            }

            const nowIso = new Date().toISOString()

            const { data: rgbPerk } = await supabase
              .from('user_perks')
              .select('expires_at')
              .eq('user_id', u.id)
              .eq('perk_id', 'perk_rgb_username')
              .eq('is_active', true)
              .gt('expires_at', nowIso)
              .order('expires_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            const desiredRgb = rgbPerk?.expires_at || null
            const currentRgb = profileData?.rgb_username_expires_at || null

            if (desiredRgb !== currentRgb) {
              const lastRgbUpdate = (profileData as any)?._lastRgbUpdate || 0
              const now = Date.now()
              const RGB_UPDATE_COOLDOWN_MS = 60000

              if (now - lastRgbUpdate > RGB_UPDATE_COOLDOWN_MS) {
                const { error: rgbUpdateError } = await supabase
                  .from('user_profiles')
                  .update({ rgb_username_expires_at: desiredRgb })
                  .eq('id', u.id)

                if (!rgbUpdateError) {
                  const current = get().profile || profileData

                  const updatedProfile = {
                    ...current,
                    rgb_username_expires_at: desiredRgb,
                    _lastRgbUpdate: now,
                  }

                  get().setProfile(updatedProfile as UserProfile)
                }
              } else {
                const current = get().profile || profileData

                const updatedProfile = {
                  ...current,
                  rgb_username_expires_at: desiredRgb,
                }

                get().setProfile(updatedProfile as UserProfile)
              }
            }
          } catch (secondaryErr) {
            console.warn('[refreshProfile] Secondary profile refresh failed:', secondaryErr)
          }
         })()
        } catch (err) {
          console.error('[refreshProfile] Failed:', err)
        } finally {
          set({ isRefreshing: false })
          get().setLoading(false)
        }
      },

      logout: async () => {
        // Set logout requested flag BEFORE clearing state
        setLogoutRequested()

        // Cleanup realtime profile subscription
        cleanupProfileRealtime()
        
        console.log('Logging out');
        const currentState = get();

        if (currentState.profile?.username) {
          announceGlobalEvent({ title: `${currentState.profile.username} just logged out!`, icon: 'logout', priority: 1 })
        }
         
        const userId = currentState.user?.id
        const sessionId = currentState.sessionId
         
        try {
          // Check if we have a valid session before attempting to sign out
          const { data: { session }, error } = await supabase.auth.getSession()
           
          // Only attempt signOut if we have a valid session
          if (session && !error) {
            const { error: signOutError } = await supabase.auth.signOut()
            if (signOutError) {
              // Handle specific auth errors gracefully
              if (signOutError.message.includes('Auth session missing') ||
                  signOutError.message.includes('Invalid JWT') ||
                  signOutError.message.includes('expired')) {
                console.log('Session already expired or invalid, proceeding with local logout')
              } else {
                console.warn('Sign out error:', signOutError.message)
              }
            }
          } else {
            console.log('No valid session found, proceeding with local logout')
          }
        } catch (error) {
          // If getSession fails, it's likely already logged out
          console.log('Session check failed, proceeding with local logout:', error)
        }
         
        // Mark session as inactive in our tracking system
        if (userId && sessionId) {
          try {
            await supabase
              .from('active_sessions')
              .update({ is_active: false, last_active: new Date().toISOString() })
              .eq('user_id', userId)
              .eq('session_id', sessionId)
          } catch (error) {
            console.error('Error updating session status:', error)
          }
        }
         
        // Always clear local state regardless of server sign out result
        set({ user: null, session: null, profile: null, isLoading: false, isAdmin: null })
         
        // Clear any persisted auth data
        try {
          localStorage.removeItem('troll-city-auth')
        } catch (e) {
          console.warn('Failed to clear local storage:', e)
        }
      }
    }),

    {
      name: 'troll-city-auth', // localStorage key
      version: 1,

      // Persist ALL user, session, and profile safely
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        profile: state.profile,
        isAdmin: state.isAdmin
      })
    }
  )
)

let initDone = false
let initialAuthHandled = false
let profileChannel: any = null
let creditChannel: any = null
let subscribedUserId: string | null = null

// Setup realtime subscription for profile changes
export function setupProfileRealtime(userId: string) {
  // Prevent duplicate subscription for same user
  if (subscribedUserId === userId && profileChannel && creditChannel) {
    console.log('[ProfileRealtime] Already subscribed to user:', userId)
    return
  }

  // Remove existing subscriptions if any
  if (profileChannel) {
    supabase.removeChannel(profileChannel)
    profileChannel = null
  }
  if (creditChannel) {
    supabase.removeChannel(creditChannel)
    creditChannel = null
  }
  subscribedUserId = null

  // Subscribe to profile changes for real-time balance updates
  profileChannel = supabase
    .channel(`profile-and-credits:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_profiles',
        filter: `id=eq.${userId}`
      },
      (payload) => {
        const currentProfile = useAuthStore.getState().profile
        if (!currentProfile || currentProfile.id !== userId) return

        // Real-time updates bypass debounce - reset timer
        lastProfileUpdateTime = 0

        // Merge current profile with new data, preserving agreement flags
        const updatedProfile = {
          ...currentProfile,
          ...payload.new,
          terms_accepted:
            payload.new?.terms_accepted === true || currentProfile.terms_accepted === true,
          terms_accepted_at:
            payload.new?.terms_accepted_at || currentProfile.terms_accepted_at || null,
          court_recording_consent:
            payload.new?.court_recording_consent === true ||
            currentProfile.court_recording_consent === true,
        }

        if (areProfilesShallowEqual(currentProfile, updatedProfile)) {
          console.debug('[ProfileRealtime] Ignoring unchanged profile update')
          return
        }

        console.log('[ProfileRealtime] Profile changed, updating:', payload.event, {
          username: updatedProfile.username,
          credit_score: updatedProfile.credit_score,
        })
        useAuthStore.getState().setProfile(updatedProfile as UserProfile)
      }
    )
    .subscribe()

  subscribedUserId = userId

// Debounce ref to prevent excessive profile refreshes
let creditDebounceRef = 0
const CREDIT_DEBOUNCE_MS = 10000 // 10 seconds minimum between credit-triggered refreshes

// Also subscribe to user_credit table for credit score updates
creditChannel = supabase
    .channel(`profile-and-credits:${userId}:credit`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_credit',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('[CreditRealtime] user_credit updated:', payload)
        // When user_credit is updated, also refresh the profile to get the latest credit_score
        const now = Date.now()
        // Debounce: only refresh once per 10 seconds to prevent flickering
        if (now - creditDebounceRef > CREDIT_DEBOUNCE_MS) {
          creditDebounceRef = now
          const currentProfile = useAuthStore.getState().profile
          if (currentProfile && currentProfile.id === userId) {
            console.log('[CreditRealtime] Refreshing profile to sync credit_score')
            // Force refresh to get latest credit_score from user_profiles
            lastRefreshProfileTime = 0
            useAuthStore.getState().refreshProfile(true)
          }
        }
      }
    )
    .subscribe()

  console.log('[ProfileRealtime] Subscribed to profile and user_credit changes for user:', userId)
}

// Cleanup realtime subscription
export function cleanupProfileRealtime() {
  if (profileChannel) {
    supabase.removeChannel(profileChannel)
    profileChannel = null
    console.log('[ProfileRealtime] Cleaned up profile subscription')
  }
  if (creditChannel) {
    supabase.removeChannel(creditChannel)
    creditChannel = null
    console.log('[ProfileRealtime] Cleaned up credit subscription')
  }
  subscribedUserId = null
}

export async function initAuthAndData() {
  if (initDone) return
  initDone = true

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Clear logout flag on session load
  clearLogoutRequested()

  if (session?.user) {
      useAuthStore.getState().setAuth(session.user, session, generateUUID())
    
    // Setup realtime profile subscription for real-time balance updates
    setupProfileRealtime(session.user.id)
    
    // Check for concurrent login from other devices
    const storedSessionId = useAuthStore.getState().sessionId
    if (storedSessionId) {
      // Reset the check flag for fresh login
      resetConcurrentLoginCheck()

      // Handle concurrent login - this will log out if fraud detected
      await handleConcurrentLogin(
        session.user.id,
        storedSessionId,
        () => useAuthStore.getState().logout()
      )
    }
    
    await useAuthStore.getState().refreshProfile()
   } else {
    // No active Supabase session - check if we have a persisted user that needs session recovery
    const state = useAuthStore.getState()
    if (state.user || state.session) {
      console.log('[initAuth] No active session but persisted user exists, attempting session recovery...')
      // Try to refresh the session before clearing
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError && refreshData?.session) {
          console.log('[initAuth] Session recovery successful!')
          const newSessionId = generateUUID()
          
          // Register the recovered session so active_sessions is consistent
          try {
            await supabase.rpc('register_session', {
              p_user_id: refreshData.session.user.id,
              p_session_id: newSessionId,
              p_device_info: JSON.stringify({ browser: navigator.userAgent, platform: navigator.platform }),
              p_ip_address: null,
              p_user_agent: navigator.userAgent
            })
            localStorage.setItem('current_device_session_id', newSessionId)
          } catch (regErr) {
            console.warn('[initAuth] Failed to register recovered session:', regErr)
          }
          
          useAuthStore.getState().setAuth(refreshData.session.user, refreshData.session, newSessionId)
          setupProfileRealtime(refreshData.session.user.id)
          await useAuthStore.getState().refreshProfile()
        } else {
          console.log('[initAuth] Session recovery failed, clearing stale auth state')
          state.setAuth(null, null)
          state.setProfile(null)
          state.setAdmin(null)
        }
      } catch (recoveryErr) {
        console.log('[initAuth] Session recovery error, clearing stale auth state:', recoveryErr)
        state.setAuth(null, null)
        state.setProfile(null)
        state.setAdmin(null)
      }
    } else {
      // No session and no persisted user — ensure loading is turned off
      useAuthStore.getState().setLoading(false)
    }
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    // Skip the initial state change event to prevent duplicate profile refresh
    if (!initialAuthHandled) {
      initialAuthHandled = true
      return
    }
    
    try {
      const prev = useAuthStore.getState()
      const sameUser = (!!prev.user && !!session?.user && prev.user.id === session.user.id) || (!prev.user && !session?.user)
      const prevToken = (prev.session as any)?.access_token
      const newToken = (session as any)?.access_token
      if (sameUser && prevToken === newToken) {
        return
      }
    } catch {
      // continue
    }

    if (session?.user) {
    useAuthStore.getState().setAuth(session.user, session, generateUUID())
      
      // Setup realtime profile subscription for real-time balance updates
      setupProfileRealtime(session.user.id)
      
      // Check for concurrent login when session changes
      const sessionId = (session as any)?.access_token
      if (sessionId) {
        resetConcurrentLoginCheck()
        await handleConcurrentLogin(
          session.user.id,
          sessionId,
          () => useAuthStore.getState().logout()
        )
      }
      
      await useAuthStore.getState().refreshProfile()
    } else {
      // Check if logout was requested via sessionStorage
      if (checkLogoutRequested()) {
        console.log('[onAuthStateChange] Explicit logout detected, clearing state')
        clearLogoutRequested()
        cleanupProfileRealtime()
        useAuthStore.getState().setAuth(null, null)
        useAuthStore.getState().setProfile(null)
        useAuthStore.getState().setAdmin(null)
        return
      }
      
      // Session became null - check if we have a persisted user that needs recovery
      
      const state = useAuthStore.getState()
      if (state.user || state.session) {
        console.log('[onAuthStateChange] Session became null but persisted user exists, attempting recovery...')
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          if (!refreshError && refreshData?.session) {
            console.log('[onAuthStateChange] Session recovery successful!')
            const newSessionId = generateUUID()
            
            // Register the recovered session so active_sessions is consistent
            try {
              await supabase.rpc('register_session', {
                p_user_id: refreshData.session.user.id,
                p_session_id: newSessionId,
                p_device_info: JSON.stringify({ browser: navigator.userAgent, platform: navigator.platform }),
                p_ip_address: null,
                p_user_agent: navigator.userAgent
              })
              localStorage.setItem('current_device_session_id', newSessionId)
            } catch (regErr) {
              console.warn('[onAuthStateChange] Failed to register recovered session:', regErr)
            }
            
            useAuthStore.getState().setAuth(refreshData.session.user, refreshData.session, newSessionId)
            setupProfileRealtime(refreshData.session.user.id)
            await useAuthStore.getState().refreshProfile()
            return // Don't clear state
          }
        } catch (recoveryErr) {
          console.log('[onAuthStateChange] Session recovery failed:', recoveryErr)
        }
      }
      // Cleanup realtime subscription on logout
      cleanupProfileRealtime()
      useAuthStore.getState().setAuth(null, null)
      useAuthStore.getState().setProfile(null)
      useAuthStore.getState().setAdmin(null)
    }
  })
}
