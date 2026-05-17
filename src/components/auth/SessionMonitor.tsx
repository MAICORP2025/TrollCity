import { useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'

export default function SessionMonitor() {
  const { user, logout } = useAuthStore()
  const hasCheckedRef = useRef(false)
  const loginTimeRef = useRef<number>(Date.now())

  const checkSession = async (sessionId: string) => {
    // Validate sessionId is a proper UUID to avoid 400 errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!sessionId || sessionId === 'undefined' || !uuidRegex.test(sessionId)) {
      console.log('[SessionMonitor] Invalid or missing session ID:', sessionId);
      return;
    }

    console.log('[SessionMonitor] Checking session:', sessionId, 'for user:', user?.id);

    const { data, error } = await supabase
      .from('active_sessions')
      .select('is_active')
      .eq('session_id', sessionId)
      .maybeSingle()

    console.log('[SessionMonitor] Session query result:', { data, error });

    // If no session found (error or null data), session doesn't exist or was deleted
    // This can happen if session was cleaned up or is a stale localStorage value
    if (error || !data) {
      // For new logins, give more time for register_session to complete
      const timeSinceLogin = Date.now() - loginTimeRef.current;
      const isNewLogin = timeSinceLogin < 5000; // First 5 seconds after login
      
      console.log('[SessionMonitor] Session not found or error:', error?.message, 'Time since login:', timeSinceLogin, 'ms', 'isNewLogin:', isNewLogin)
      
      // Only check for concurrent login if it's not a brand new session
      if (!isNewLogin) {
        // Check if user has any other active sessions - if so, this is a concurrent login
        const { data: otherSessions } = await supabase
          .from('active_sessions')
          .select('session_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .neq('session_id', sessionId)
          .limit(1)
        
        // Only logout if there are other active sessions (concurrent login)
        // If no other sessions exist, this is just a stale localStorage value or cleanup
        if (otherSessions && otherSessions.length > 0) {
          console.log('[SessionMonitor] Other active sessions found - logging out')
          toast.error('Session expired. You have logged in on another device.')
          logout()
        } else {
          console.log('[SessionMonitor] No other active sessions - not logging out')
        }
      } else {
        console.log('[SessionMonitor] Brand new login - skipping concurrent check')
      }
      return
    }

    if (data.is_active === false) {
      // Check if this is because of a new session being created (same device)
      // by checking if there are other active sessions for this user
      const { data: otherSessions } = await supabase
        .from('active_sessions')
        .select('session_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .neq('session_id', sessionId)
        .limit(1)
      
      if (otherSessions && otherSessions.length > 0) {
        // Another device logged in - logout
        console.log('[SessionMonitor] Session is inactive and other sessions exist. Logging out.')
        toast.error('Session expired. You have logged in on another device.')
        logout()
      } else {
        // No other sessions - this is likely the same device's session being
        // replaced during refresh or re-login. Don't logout.
        console.log('[SessionMonitor] Session is inactive but no other sessions - not logging out')
      }
    }
  }

  useEffect(() => {
    if (!user) return

    // Reset login time when user changes
    loginTimeRef.current = Date.now()

    // Get session ID from localStorage
    const sessionId = localStorage.getItem('current_device_session_id')
    if (!sessionId) {
      return
    }

    // Skip if this is the first check right after login - give time for register_session to commit
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true
      // Add a 2 second delay to allow register_session to complete and propagate
      const timeoutId = setTimeout(() => {
        checkSession(sessionId)
      }, 2000)
      return () => clearTimeout(timeoutId)
    }

    // Only subscribe if we have a valid session ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!sessionId || sessionId === 'undefined' || !uuidRegex.test(sessionId)) {
      return;
    }

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
            // Check if there are other active sessions - only logout if another device logged in
            supabase
              .from('active_sessions')
              .select('session_id')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .neq('session_id', sessionId)
              .limit(1)
              .then(({ data: otherSessions }) => {
                if (otherSessions && otherSessions.length > 0) {
                  // Another device logged in - logout
                  console.log('[SessionMonitor] Session deactivated via realtime and other sessions exist. Logging out.')
                  toast.error('Session expired. You have logged in on another device.')
                  logout()
                } else {
                  // No other active sessions - this is likely same device refresh
                  console.log('[SessionMonitor] Session deactivated but no other sessions - not logging out')
                }
              })
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