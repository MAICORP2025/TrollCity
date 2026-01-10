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
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchLatestBroadcast = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_broadcasts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          setBroadcast(null);
          return;
        }

        // Check if user has dismissed this broadcast
        const dismissedBroadcasts = JSON.parse(localStorage.getItem('dismissedBroadcasts') || '[]');
        if (dismissedBroadcasts.includes(data.id)) {
          setBroadcast(null);
          return;
        }

        setBroadcast(data);
        setIsVisible(true);
      } catch (err) {
        console.error('Error fetching broadcast:', err);
        setBroadcast(null);
      }
    };

    fetchLatestBroadcast();

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
            setBroadcast(newBroadcast);
            setIsVisible(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!broadcast || !isVisible) {
    return null;
  }

  return (
    <AdminBroadcast
      message={broadcast.message}
      broadcastId={broadcast.id}
      onClose={handleClose}
    />
  );
}
