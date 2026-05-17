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
    const { data } = await supabase
      .from('streams')
      .select('id, title, broadcaster_id, status, current_viewers, created_at')
      .order('created_at', { ascending: false });
    setStreams(data || []);
  };

  useEffect(() => {
    loadStreams();

    const interval = setInterval(() => {
      loadStreams();
    }, 30000); // Poll every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  return streams;
};