import React, { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'

export default function SessionMonitor() {
  const { user, logout } = useAuthStore()

  useEffect(() => {
    if (!user) return

    const sessionId = localStorage.getItem('current_device_session_id')
    if (!sessionId) {
      // If no session ID is found (e.g. legacy login), we could optionally
      // force a logout or just ignore it. 
      // For strict enforcement, we should probably ignore it until next login 
      // or generate one. But generating one now implies calling register_session
      // which might kick other devices.
      // Let's just monitor if we have one.
      return
    }

    // Initial check
    const checkSession = async () => {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('is_active')
        .eq('session_id', sessionId)
        .single()

      if (data && data.is_active === false) {
        console.log('[SessionMonitor] Session is marked inactive. Logging out.')
        toast.error('Session expired. You have logged in on another device.')
        logout()
      }
    }
    
    checkSession()

    // Subscribe to changes
    const channel = supabase
      .channel(`session_monitor_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_sessions',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new && payload.new.is_active === false) {
            console.log('[SessionMonitor] Session deactivated via realtime. Logging out.')
            toast.error('Session expired. You have logged in on another device.')
            logout()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, logout])

  return null
}
