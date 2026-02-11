import { useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { usePresenceStore } from '../lib/presenceStore';

export default function GlobalPresenceTracker() {
  const { user } = useAuthStore();
  const { setOnlineCount, setOnlineUserIds } = usePresenceStore();

  useEffect(() => {
    if (!user?.id) return;

    // Initial heartbeat
    const sendHeartbeat = async () => {
      try {
        await supabase.rpc('heartbeat_presence');
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    };

    sendHeartbeat();

    // Heartbeat every 30 seconds
    const interval = setInterval(sendHeartbeat, 30000);

    const channel = supabase.channel('global_online_users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userIds = Object.keys(state);
        setOnlineCount(userIds.length);
        setOnlineUserIds(userIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: user.id,
          });
        }
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, setOnlineCount, setOnlineUserIds]);

  return null;
}
