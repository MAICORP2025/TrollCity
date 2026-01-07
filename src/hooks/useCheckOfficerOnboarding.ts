import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export function useCheckOfficerOnboarding() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const checkOnboarding = useCallback(async (redirect = true): Promise<boolean> => {
    if (!user || !profile) return false

    // If not officer, no need to check
    if (!profile.is_troll_officer && profile.role !== 'troll_officer') {
      return true
    }

    // Admins bypass this check
    if (profile.is_admin || profile.role === 'admin') {
      return true
    }

    try {
      const { data, error } = await supabase.rpc('get_officer_orientation_status', {
        p_user_id: user.id
      })

      if (error) {
        console.error('Error checking onboarding status:', error)
        // If error, fail safe (block access to be safe, or allow? Block is safer for enforcement)
        toast.error('Could not verify officer status. Please try again.')
        return false
      }

      // If status is not passed, block
      if (data && data.status !== 'passed') {
        if (redirect) {
          toast.error('You must complete officer onboarding first!')
          navigate('/officer/onboarding')
        }
        return false
      }

      return true
    } catch (err) {
      console.error('Error in checkOnboarding:', err)
      return false
    }
  }, [user, profile, navigate])

  return { checkOnboarding }
}
