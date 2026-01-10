import { useCallback } from 'react'
import { useAuthStore } from '../lib/store'

export function useCheckOfficerOnboarding() {
  const { user, profile } = useAuthStore()

  const checkOnboarding = useCallback(async (): Promise<boolean> => {
    if (!user || !profile) return false

   // Bypass orientation check for all users to allow everyone to access features
   // Admins always bypass this check
   if (profile.is_admin || profile.role === 'admin') {
     return true
   }

   // Allow all users to bypass officer orientation
   return true
  }, [user, profile])

  return { checkOnboarding }
}
