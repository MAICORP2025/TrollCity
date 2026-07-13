import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { 
  BarChart3, TrendingUp, Users, Coins, 
  Calendar, Filter, Loader2, Download, RefreshCw
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface SubStats {
  total_subscribers: number;
  new_subscribers_30d: number;
  total_revenue: number;
  monthly_revenue: number;
}

interface SubscriberRecord {
  id: string;
  subscriber_username: string;
  tier_name: string;
  price_coins: number;
  started_at: string;
  is_active: boolean;
}

const COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#F59E0B'];

export default function SubAnalytics() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<SubStats | null>(null);
  const [topBroadcasters, setTopBroadcasters] = useState<any[]>([]);
  const [recentSubscriptions, setRecentSubscriptions] = useState<SubscriberRecord[]>([]);
  const [tierBreakdown, setTierBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const isAdmin = profile?.role === 'admin' || profile?.is_admin;

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin, dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: string;
      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          startDate = new Date(0).toISOString();
      }

      const [platformStatsData, topBroadcasterData, recentSubsData, tierData] = await Promise.all([
        supabase.rpc('get_platform_subscription_stats'),
        supabase
          .from('user_profiles')
          .select(`
            username,
            monthly_subscriber_count,
            total_subscriber_revenue_coins
          `)
          .gt('monthly_subscriber_count', 0)
          .order('total_subscriber_revenue_coins', { ascending: false })
          .limit(10),
        supabase
          .from('user_subscriptions')
          .select(`
            id,
            started_at,
            is_active,
            tier: subscription_tiers(name, price_coins, color_hex),
            subscriber: subscriber_id(username),
            broadcaster: broadcaster_id(username)
          `)
          .gte('started_at', startDate)
          .order('started_at', { ascending: false })
          .limit(20),
        supabase
          .from('user_subscriptions')
          .select(`
            tier: subscription_tiers(name, color_hex, icon_name)
          `)
          .eq('is_active', true)
          .gte('started_at', startDate)
      ])

      if (platformStatsData.data) {
        setStats(platformStatsData.data);
      }

      setTopBroadcasters(topBroadcasterData.data || []);

      const formattedRecent = (recentSubsData.data || []).map((sub: any) => ({
        id: sub.id,
        subscriber_username: sub.subscriber?.username || 'Unknown',
        tier_name: sub.tier?.name || 'Unknown',
        price_coins: sub.tier?.price_coins || 0,
        started_at: sub.started_at,
        is_active: sub.is_active,
      }));

      setRecentSubscriptions(formattedRecent);

      const tierMap: Record<string, any> = {};
      (tierData.data || []).forEach((sub: any) => {
        const name = sub.tier?.name || 'Unknown';
        if (!tierMap[name]) {
          tierMap[name] = { name, color_hex: sub.tier?.color_hex, icon_name: sub.tier?.icon_name, count: 0 };
        }
        tierMap[name].count++;
      });
      setTierBreakdown(Object.values(tierMap).sort((a: any, b: any) => b.count - a.count));
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = stats?.total_revenue || 0;
  const totalSubs = stats?.total_subscribers || 0;
  const newSubs30d = stats?.new_subscribers_30d || 0;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Admin Access Required</h1>
          <p className="text-slate-400">You must be an admin to view subscription analytics.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-cyan-500" />
            <h1 className="text-3xl font-bold">Sub Analytics</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-800 rounded-lg p-1">
              {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {range === 'all' ? 'All Time' : range}
                </button>
              ))}
            </div>
            <button
              onClick={fetchAllData}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-cyan-400" />
              <span className="text-slate-400 text-sm">Total Subscribers</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalSubs.toLocaleString()}</p>
            <p className="text-sm text-emerald-400 mt-1">+{newSubs30d} this month</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <span className="text-slate-400 text-sm">Total Revenue</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-yellow-400 mt-1">Troll Coins</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-purple-400" />
              <span className="text-slate-400 text-sm">Monthly Revenue</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.monthly_revenue?.toLocaleString() || 0}</p>
            <p className="text-sm text-purple-400 mt-1">Last 30 days</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-6 h-6 text-pink-400" />
              <span className="text-slate-400 text-sm">Active Tiers</span>
            </div>
            <p className="text-3xl font-bold text-white">{tierBreakdown.length}</p>
            <p className="text-sm text-pink-400 mt-1">Subscription tiers</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tier Breakdown Pie Chart */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyan-500" />
              Subscribers by Tier
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tierBreakdown}
                  dataKey="count"
                  nameKey="tier.name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ tier, count }) => `${tier?.name}: ${count}`}
                >
                  {tierBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.tier?.color_hex || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any, name: any) => [`${value} subscribers`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Broadcasters Bar Chart */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              Top Broadcasters by Revenue
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topBroadcasters.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="username" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  formatter={(value: any) => [value.toLocaleString() + ' coins', 'Revenue']}
                />
                <Bar dataKey="total_subscriber_revenue_coins" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Subscriptions Table */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            Recent Subscriptions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-300">Subscriber</th>
                  <th className="text-left py-3 px-4 text-slate-300">Tier</th>
                  <th className="text-left py-3 px-4 text-slate-300">Amount</th>
                  <th className="text-left py-3 px-4 text-slate-300">Date</th>
                  <th className="text-left py-3 px-4 text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSubscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-4 text-white">{sub.subscriber_username}</td>
                    <td className="py-3 px-4">
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-bold"
                        style={{ 
                          backgroundColor: tierBreakdown.find(t => t.tier?.name === sub.tier_name)?.tier?.color_hex + '30',
                          color: tierBreakdown.find(t => t.tier?.name === sub.tier_name)?.tier?.color_hex
                        }}
                      >
                        {sub.tier_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-yellow-400 font-mono">{sub.price_coins.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {new Date(sub.started_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {sub.is_active ? (
                        <span className="text-emerald-400 text-xs">Active</span>
                      ) : (
                        <span className="text-red-400 text-xs">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex justify-end">
          <button
            onClick={() => {
              // Export CSV of recent subscriptions
              const csv = [
                ['Subscriber', 'Tier', 'Amount', 'Date', 'Status'],
                ...recentSubscriptions.map(s => [
                  s.subscriber_username,
                  s.tier_name,
                  s.price_coins.toString(),
                  new Date(s.started_at).toISOString().split('T')[0],
                  s.is_active ? 'Active' : 'Inactive'
                ])
              ].map(row => row.join(',')).join('\n');
              
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `subscription-analytics-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
