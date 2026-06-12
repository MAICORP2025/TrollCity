import { useEffect, useRef } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { usePresenceStore } from '../lib/presenceStore';

/**
 * GlobalPresenceTracker - tracks user presence and visibility
 * - Sends heartbeat every 30 seconds to keep user "online"
 * - Updates is_online status based on visibility (visible = online, hidden = offline)
 * - Does NOT log out users - just tracks presence
 */
export default function GlobalPresenceTracker() {
  const { user, profile } = useAuthStore();
  const setOnlineCount = usePresenceStore(state => state.setOnlineCount);
  const setOnlineUserIds = usePresenceStore(state => state.setOnlineUserIds);
  const isVisibleRef = useRef<boolean>(!document.hidden);
  const lastOnlineUpdateRef = useRef<number>(0);
  const heartbeatRef = useRef<number>(0);
  const onlineCountRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  // Update user's online status in database
  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!user?.id || !profile?.id) return;
    
    // Debounce - don't update more than every 10 seconds if same status
    const now = Date.now();
    if (now - lastOnlineUpdateRef.current < 10000 && isOnline === isVisibleRef.current) return;
    
    lastOnlineUpdateRef.current = now;
    isVisibleRef.current = isOnline;

    try {
      // Update user_profiles is_online status
      await supabase
        .from('user_profiles')
        .update({
          is_online: isOnline,
          last_active: new Date().toISOString()
        })
        .eq('id', user.id);

      // Also update active_sessions if we have a session ID
      const sessionId = localStorage.getItem('current_device_session_id');
      if (sessionId) {
        await supabase
          .from('active_sessions')
          .update({
            is_active: isOnline,
            last_active: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('session_id', sessionId);
      }
    } catch (error) {
      console.error('[GlobalPresenceTracker] Failed to update online status:', error);
    }
  };

  useEffect(() => {
    if (!user?.id || !profile?.id) return;

    const clearSyncInterval = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    // Heartbeat & Count fetch - debounced to prevent connection storms
    const syncPresence = async () => {
      if (document.hidden) return

      try {
        // 1. Send heartbeat - debounce to max once per 60 seconds per user
        const now = Date.now();
        if (now - heartbeatRef.current >= 60000) {
          heartbeatRef.current = now;
          // Upsert directly to user_presence table (RPC doesn't exist)
          await supabase.from('user_presence').upsert(
            {
              user_id: user.id,
              last_seen_at: new Date().toISOString(),
              is_online: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          );
        }

        // 2. Fetch total online count - debounce to max once per 45 seconds
        if (now - onlineCountRef.current >= 45000) {
          onlineCountRef.current = now;
          const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
          const { data: presenceData, count, error } = await supabase
            .from('user_presence')
            .select('user_id', { count: 'exact' })
            .gt('last_seen_at', twoMinutesAgo)
            .limit(1000);

          if (!error) {
            if (presenceData) {
              const userIds = (presenceData as Array<{ user_id: string | null }>).map(p => p.user_id).filter(Boolean) as string[];
              const uniqueUserIds = Array.from(new Set(userIds));
              setOnlineCount(uniqueUserIds.length);
              setOnlineUserIds(uniqueUserIds);
            }
          }
        }
      } catch (err) {
        console.error('Presence sync failed:', err);
      }
    };

    const startSyncLoop = () => {
      clearSyncInterval()
      if (document.hidden) return
      syncPresence()
      intervalRef.current = window.setInterval(syncPresence, 30000)
    }

    const stopSyncLoop = () => {
      clearSyncInterval()
    }

    // Initial: user is online when app opens
    updateOnlineStatus(true)

    if (!document.hidden) {
      startSyncLoop()
    }

    // Handle visibility changes - update online status when tab becomes visible/hidden
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      isVisibleRef.current = isVisible;
      console.log('[GlobalPresenceTracker] Visibility changed:', isVisible ? 'visible' : 'hidden');

      if (!isVisible) {
        stopSyncLoop()
        void updateOnlineStatus(false)
        return
      }

      void updateOnlineStatus(true)
      startSyncLoop()
    };

    // Handle beforeunload - mark as offline but don't logout
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable async update on page close
      const sessionId = localStorage.getItem('current_device_session_id');
      if (user?.id) {
        // Mark as offline in user_profiles
        const payload = JSON.stringify({
          is_online: false,
          last_active: new Date().toISOString()
        });

        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}`,
          payload
        );
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for page close
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      stopSyncLoop()
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Mark as offline when component unmounts (e.g., user navigates away or logs out)
      updateOnlineStatus(false);
    };
  }, [user?.id, setOnlineCount, setOnlineUserIds]);

  return null;
}
