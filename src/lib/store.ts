import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile, UserRole, validateProfile, ensureSupabaseSession } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean | null
  setAuth: (user: User | null, session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  setAdmin: (isAdmin: boolean | null) => void
  refreshProfile: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isAdmin: null,

      // Called when Supabase auth changes
      setAuth: (user, session) => {
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
        console.log('Auth updated', { user: !!user })
        set({ user, session, isLoading: false, isAdmin: user ? null : null })
      },

      // Sets profile AND applies admin overrides with production validation
      setProfile: (profile) => {
        if (!profile) {
          set({ profile: null, isAdmin: null })
          return
        }

        // Avoid unnecessary updates: compare with current profile
        try {
          const prev = get().profile
          if (prev) {
            const sameId = prev.id === (profile as any).id
            const prevStr = JSON.stringify(prev)
            const newStr = JSON.stringify(profile)
            if (sameId && prevStr === newStr) {
              // No changes — skip state update to prevent re-renders
              return
            }
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
            is_admin: true
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

        console.log('Profile updated:', profile?.username, profile?.role)
        set({ profile, isAdmin: hasAdminFlag })
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setAdmin: (adminState) => set({ isAdmin: adminState }),

      // Reload profile from DB
      refreshProfile: async () => {
        const u = get().user
        if (!u) return

        await ensureSupabaseSession(supabase)

        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', u.id)
          .maybeSingle()

        if (error) {
          console.error('refreshProfile error:', error)
          return
        }

        if (data) {
          get().setProfile(data as UserProfile)
        }
      },

      logout: async () => {
        console.log('Logging out')
        
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

export async function initAuthAndData() {
  if (initDone) return
  initDone = true

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user) {
    useAuthStore.getState().setAuth(session.user, session)
    await useAuthStore.getState().refreshProfile()
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
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
      useAuthStore.getState().setAuth(session.user, session)
      await useAuthStore.getState().refreshProfile()
    } else {
      useAuthStore.getState().setAuth(null, null)
      useAuthStore.getState().setProfile(null)
      useAuthStore.getState().setAdmin(null)
    }
  })
}
