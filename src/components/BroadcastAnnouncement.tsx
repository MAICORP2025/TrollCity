import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminBroadcast from './stream/AdminBroadcast';

interface Broadcast {
  id: string;
  message: string;
  admin_id: string;
  created_at: string;
}

export default function BroadcastAnnouncement() {
  const [broadcastQueue, setBroadcastQueue] = useState<Broadcast[]>([]);

  useEffect(() => {
    const fetchBroadcasts = async () => {
      try {
        // Only fetch broadcasts from the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data, error } = await supabase
          .from('admin_broadcasts')
          .select('*')
          .gte('created_at', yesterday.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          // Ignore permission denied errors for unauthenticated users
          if (error.code !== '42501') {
            console.error('Error fetching broadcasts:', error);
          }
          setBroadcastQueue([]);
          return;
        }

        if (!data) {
          setBroadcastQueue([]);
          return;
        }

        // Filter out dismissed broadcasts
        const dismissedBroadcasts = JSON.parse(localStorage.getItem('dismissedBroadcasts') || '[]');
        let activeBroadcasts = data.filter(b => !dismissedBroadcasts.includes(b.id));

        // Deduplicate messages (keep only the latest instance of each unique message)
        const seenMessages = new Set();
        activeBroadcasts = activeBroadcasts.filter(b => {
          if (seenMessages.has(b.message)) return false;
          seenMessages.add(b.message);
          return true;
        });

        setBroadcastQueue(activeBroadcasts);
      } catch (err) {
        console.error('Error fetching broadcasts:', err);
        setBroadcastQueue([]);
      }
    };

    fetchBroadcasts();

    // Set up real-time subscription for new broadcasts
    const channel = supabase
      .channel('broadcast-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_broadcasts' },
        (payload) => {
          const newBroadcast = payload.new as Broadcast;
          // Check if not dismissed
          const dismissedBroadcasts = JSON.parse(localStorage.getItem('dismissedBroadcasts') || '[]');
          if (!dismissedBroadcasts.includes(newBroadcast.id)) {
            setBroadcastQueue(prev => {
                // Add to front if not already there
                if (prev.find(b => b.id === newBroadcast.id)) return prev;
                return [newBroadcast, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleClose = () => {
    // Remove the current broadcast from the queue
    setBroadcastQueue(prev => prev.slice(1));
  };

  if (broadcastQueue.length === 0) {
    return null;
  }

  const currentBroadcast = broadcastQueue[0];

  return (
    <AdminBroadcast
      key={currentBroadcast.id}
      message={currentBroadcast.message}
      broadcastId={currentBroadcast.id}
      onClose={handleClose}
    />
  );
}
