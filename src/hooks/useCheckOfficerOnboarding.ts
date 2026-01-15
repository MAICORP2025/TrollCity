import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'

export function useCheckOfficerOnboarding() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const checkOnboarding = async () => {
    if (profile?.is_troll_officer && !profile?.is_officer_active) {
      toast.error('Complete officer orientation before using this feature')
      navigate('/officer/orientation')
      return false
    }
    return true
  }

  return { checkOnboarding }
}

