import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Radio, Coins, Zap } from 'lucide-react';

interface HomeStats {
  activeUsers: number;
  liveStreams: number;
  coinsEarned: number;
  entertainment: boolean;
}

export default function HomePageStats() {
  const [stats, setStats] = useState<HomeStats>({
    activeUsers: 0,
    liveStreams: 0,
    coinsEarned: 0,
    entertainment: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Subscribe to real-time updates
    const profileChannel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStats();
      })
      .subscribe();

    const broadcastChannel = supabase
      .channel('broadcasts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, () => {
        fetchStats();
      })
      .subscribe();

    const coinChannel = supabase
      .channel('coin-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_transactions' }, () => {
        fetchStats();
      })
      .subscribe();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => {
      profileChannel.unsubscribe();
      broadcastChannel.unsubscribe();
      coinChannel.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const fetchStats = async () => {
    try {
      // Get active users (users with last login in last 24 hours)
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_login', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Get live streams count
      const { count: streamCount } = await supabase
        .from('broadcasts')
        .select('*', { count: 'exact', head: true })
        .eq('is_live', true);

      // Get total coins earned today
      const { data: coinData } = await supabase
        .from('coin_transactions')
        .select('amount')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const totalCoins = coinData?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

      setStats({
        activeUsers: userCount || 0,
        liveStreams: streamCount || 0,
        coinsEarned: totalCoins,
        entertainment: true
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, value, label }: any) => (
    <div className="flex items-center gap-3 p-4 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl hover:border-purple-500/30 transition-all hover:-translate-y-0.5">
      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="text-2xl font-black bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          {loading ? '...' : value.toLocaleString()}
        </div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={Users} value={stats.activeUsers} label="Active Users" />
      <StatCard icon={Radio} value={stats.liveStreams} label="Live Streams Daily" />
      <StatCard icon={Coins} value={stats.coinsEarned} label="Troll Coins Earned" />
      <StatCard icon={Zap} value={24} label="Entertainment" />
    </div>
  );
}
