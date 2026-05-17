import { useAuthStore } from '../lib/store'

export function useAuth() {
  const {
    user,
    profile,
    isLoading,
    isAdmin,
    session,
    logout,
    setAuth,
    setProfile,
  } = useAuthStore()

  return {
    user,
    profile,
    isLoading,
    isAdmin,
    session,
    logout,
    setAuth,
    setProfile,
  }
}
