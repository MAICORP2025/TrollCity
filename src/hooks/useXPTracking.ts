import { useCallback } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

export function useXPTracking() {
  const { user } = useAuthStore();

  const startWatchTracking = useCallback((streamId: string) => {
    if (!user) return;
    // Implementation for starting tracking
    console.log(`Started tracking XP for stream ${streamId}`);
  }, [user]);

  const stopWatchTracking = useCallback((streamId?: string) => {
    if (!user) return;
    // Implementation for stopping tracking
    console.log(`Stopped tracking XP for stream ${streamId}`);
  }, [user]);

  const updateWatchTime = useCallback(async (streamId: string) => {
    if (!user) return;
    try {
        // Call backend RPC to track watch time and grant XP securely
        // Rate limiting is handled server-side
        await supabase.rpc('track_watch_time', {
            p_stream_id: streamId
        });
    } catch (error) {
        console.error('Error updating watch XP:', error);
    }
  }, [user]);

  return {
    startWatchTracking,
    stopWatchTracking,
    updateWatchTime
  };
}
