import { supabase } from './supabase'

export async function checkConcurrentLogin(userId: string, sessionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_concurrent_login', {
      p_user_id: userId,
      p_current_session_id: sessionId,
    })

    if (error) {
      if (error.code === 'PGRST116') {
        // Function returned no rows — treat as "no concurrent login"
        return false
      }
      console.error('Error checking concurrent login:', error)
      return false
    }

    if (typeof data === 'boolean') {
      return data
    }

    if (data && typeof data === 'object') {
      const firstValue = Object.values(data)[0]
      if (typeof firstValue === 'boolean') {
        return firstValue
      }
    }

    return Boolean(data)
  } catch (err) {
    console.error('Failed to call check_concurrent_login RPC:', err)
    return false
  }
}
