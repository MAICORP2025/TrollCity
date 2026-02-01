import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface Metrics {
  totalUsers: number;
  totalStreams: number;
  activeStreams: number;
  totalCoins: number;
  totalRevenue: number;
  [key: string]: number;
}

export const useRealtimeMetrics = (): Metrics => {
  const [metrics, setMetrics] = useState<Metrics>({
    totalUsers: 0,
    totalStreams: 0,
    activeStreams: 0,
    totalCoins: 0,
    totalRevenue: 0,
  });

  const loadMetrics = async () => {
    try {
      const [
        usersRes,
        streamsRes,
        activeStreamsRes,
      ] = await Promise.all([
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('streams').select('*', { count: 'exact', head: true }),
        supabase.from('streams').select('*', { count: 'exact', head: true }).eq('is_live', true),
      ]);

      const totalUsers = usersRes.count || 0;
      const totalStreams = streamsRes.count || 0;
      const activeStreams = activeStreamsRes.count || 0;
      
      // OPTIMIZATION: Calculating total coins/revenue from client-side iteration of ALL transactions 
      // is impossible at scale (millions of rows). 
      // For now, we set these to 0 to prevent browser crashes. 
      // In production, these should be replaced by a Postgres View or RPC function (e.g. get_platform_stats).
      const totalCoins = 0; 
      const totalRevenue = 0;

      setMetrics({
        totalUsers,
        totalStreams,
        activeStreams,
        totalCoins,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  useEffect(() => {
    loadMetrics();

    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);

    // Real-time subscriptions
    /* 
    // CRITICAL: Removed global subscriptions to high-velocity tables to reduce DB load
    // Polling is sufficient for these metrics
    const usersChannel = supabase
      .channel('metrics-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, loadMetrics)
      .subscribe();
    
    const streamsChannel = supabase
      .channel('metrics-streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, loadMetrics)
      .subscribe();

    const coinsChannel = supabase
      .channel('metrics-coins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_transactions' }, loadMetrics)
      .subscribe();
    */
    
    return () => {
      clearInterval(interval);
      // supabase.removeChannel(usersChannel);
      // supabase.removeChannel(streamsChannel);
      // supabase.removeChannel(coinsChannel);
    };
  }, []);

  return metrics;
};