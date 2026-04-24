import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useActiveBroadcasts() {
  const [hasActiveContent, setHasActiveContent] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkActiveContent = async () => {
      try {
        // Check active streams
        const { count: streamCount } = await supabase
          .from('streams')
          .select('*', { count: 'exact', head: true })
          .eq('is_live', true);

        if (streamCount && streamCount > 0) {
          if (mounted) setHasActiveContent(true);
          return;
        }

        // Check active pods
        const { count: podCount } = await supabase
          .from('pod_rooms')
          .select('*', { count: 'exact', head: true })
          .eq('is_live', true);

        if (mounted) {
          setHasActiveContent((podCount || 0) > 0);
        }
      } catch (error) {
        console.error('Error checking active content:', error);
      }
    };

    // Initial check
    checkActiveContent();

    // Subscribe to changes
    const channel = supabase.channel('active-content-monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: 'is_live=eq.true'
        },
        () => checkActiveContent()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pod_rooms',
          filter: 'is_live=eq.true'
        },
        () => checkActiveContent()
      )
      // Also listen for updates that might turn is_live to false
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams'
        },
        () => checkActiveContent()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pod_rooms'
        },
        () => checkActiveContent()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return hasActiveContent;
}
