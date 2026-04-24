import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { 
  List, Gavel, Calendar, Play, Eye, Layers,
  Tag, DollarSign, Users, CheckCircle, XCircle, Clock3
} from 'lucide-react';

interface AuctionShow {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduled_for: string;
  live_started_at: string;
  ended_at: string;
  livekit_room_name: string;
  created_at: string;
  lot_count?: number;
  total_bids?: number;
  total_sales?: number;
  auctioneer?: {
    user_id: string;
    display_name?: string;
  };
}

export default function MyAuctionShows() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [shows, setShows] = useState<AuctionShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuctioneer, setIsAuctioneer] = useState(false);

  const fetchShows = useCallback(async () => {
    try {
      const { data: auctioneerData } = await supabase
        .from('auctioneer_profiles')
        .select('id, user_id')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .single();

      setIsAuctioneer(!!auctioneerData);

      let query = supabase
        .from('auction_shows')
        .select('*')
        .order('created_at', { ascending: false });

      if (auctioneerData) {
        query = query.eq('auctioneer_id', auctioneerData.id);
      } else {
        query = query.limit(20);
      }

      const { data, error } = await query;

      if (error) throw error;

      const showsWithStats = await Promise.all((data || []).map(async (show) => {
        const [lotCount, bidCount, salesResult] = await Promise.all([
          supabase.from('auction_lots').select('*', { count: 'exact', head: true }).eq('auction_show_id', show.id),
          supabase.from('auction_bids').select('*', { count: 'exact', head: true }).eq('auction_show_id', show.id),
          supabase.from('auction_wins').select('final_bid').eq('auction_show_id', show.id)
        ]);

        const totalSales = salesResult.data?.reduce((sum, w) => sum + (w.final_bid || 0), 0) || 0;

        return {
          ...show,
          lot_count: lotCount.count || 0,
          total_bids: bidCount.count || 0,
          total_sales: totalSales
        };
      }));

      setShows(showsWithStats);
    } catch (_error) {
      console.error('Error fetching shows:', _error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live': return <Play className="w-4 h-4 text-red-400" />;
      case 'scheduled': return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'ended': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock3 className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      live: 'bg-red-500/20 text-red-400 border-red-500/30',
      ended: 'bg-green-500/20 text-green-400 border-green-500/30',
      cancelled: 'bg-red-900/20 text-red-600 border-red-900/30'
    };
    return styles[status] || styles.draft;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
            <List className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">My Auction Shows</h1>
            <p className="text-gray-400">
              {isAuctioneer 
                ? 'View and manage your auction shows' 
                : 'Browse auction shows'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Gavel className="w-4 h-4" />
              <span className="text-sm">Total Shows</span>
            </div>
            <p className="text-2xl font-bold text-white">{shows.length}</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Play className="w-4 h-4 text-red-400" />
              <span className="text-sm">Live Now</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{shows.filter(s => s.status === 'live').length}</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-sm">Upcoming</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{shows.filter(s => s.status === 'scheduled').length}</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm">Total Sales</span>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {shows.reduce((sum, s) => sum + (s.total_sales || 0), 0).toLocaleString()} TC
            </p>
          </div>
        </div>

        {/* Shows List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">Loading shows...</p>
          </div>
        ) : shows.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800">
            <List className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No Shows Found</h3>
            <p className="text-gray-500">
              {isAuctioneer 
                ? 'Create your first show in Auction Studio!'
                : 'Check back later for new auctions.'}
            </p>
            {isAuctioneer && (
              <button
                onClick={() => navigate('/auctions/studio')}
                className="mt-6 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-medium"
              >
                Go to Auction Studio
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {shows.map((show) => (
              <div
                key={show.id}
                className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 hover:border-green-500/30 rounded-xl transition-all cursor-pointer"
                onClick={() => navigate(`/auctions/${show.id}`)}
              >
                <div className="w-20 h-14 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                  {show.thumbnail_url ? (
                    <img src={show.thumbnail_url} alt={show.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gavel className="w-6 h-6 text-gray-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white truncate">{show.title}</h3>
                    <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${getStatusBadge(show.status)}`}>
                      {getStatusIcon(show.status)}
                      {show.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      {show.lot_count || 0} lots
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {show.total_bids || 0} bids
                    </span>
                    {show.category && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {show.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  {show.total_sales ? (
                    <p className="text-green-400 font-medium">{show.total_sales.toLocaleString()} TC</p>
                  ) : null}
                  {show.status === 'live' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/auctions/${show.id}`); }}
                      className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium flex items-center gap-1"
                    >
                      <Play className="w-4 h-4" />
                      Join Live
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/auctions/${show.id}`); }}
                      className="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}