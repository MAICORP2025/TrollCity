import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface Stream {
  id: string;
  title: string;
  broadcaster_id: string;
  status: string;
  current_viewers: number;
  created_at: string;
}

export const useRealtimeStreams = (): Stream[] => {
  const [streams, setStreams] = useState<Stream[]>([]);

  const loadStreams = async () => {
    // SAFETY: only fetch active or recent streams, not the entire table
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('streams')
      .select('id, title, broadcaster_id, status, current_viewers, created_at')
      .or('status.eq.live,status.eq.starting')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(100);
    setStreams(data || []);
  };

  useEffect(() => {
    loadStreams();

    // SAFETY: reduced from 30s to 2min since realtime subscription also refreshes
    const interval = setInterval(() => {
      loadStreams();
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return streams;
};