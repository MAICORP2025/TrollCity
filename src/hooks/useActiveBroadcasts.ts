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

    const refreshTimer = window.setInterval(checkActiveContent, 30000);

    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  return hasActiveContent;
}
