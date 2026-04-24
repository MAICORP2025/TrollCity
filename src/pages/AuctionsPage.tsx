import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { 
  Gavel, Clock, Users, Coins, Play, Calendar, 
  Trophy, AlertCircle, Video, ArrowRight, Search
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
  is_featured: boolean;
  auctioneer_id: string;
  current_lot_id: string;
  created_at: string;
  current_lot?: {
    id: string;
    title: string;
    current_highest_bid: number;
    starting_bid: number;
    status: string;
    countdown_end_at: string;
  };
}

type TabType = 'live' | 'upcoming' | 'ended';

export default function AuctionsPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [auctions, setAuctions] = useState<AuctionShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 15000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchAuctions = async () => {
    try {
      const { data, error } = await supabase
        .from('auction_shows')
        .select('*')
        .not('status', 'eq', 'draft')
        .not('status', 'eq', 'cancelled')
        .limit(50);

      if (error) throw error;
      setAuctions(data || []);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const filteredAuctions = auctions.filter(auction => {
    if (searchQuery && !auction.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (categoryFilter !== 'all' && auction.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  const categories = ['all', ...new Set(auctions.map(a => a.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
            <Gavel className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Live Auctions
            </h1>
            <p className="text-gray-400">24/7 Real-time bidding with Troll City coins</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-medium">{auctions.filter(a => a.status === 'live').length} Live Now</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400">{auctions.filter(a => a.status === 'scheduled').length} Upcoming</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {[
            { id: 'live', label: 'Live Now', icon: Play },
            { id: 'upcoming', label: 'Upcoming', icon: Calendar },
            { id: 'ended', label: 'Recently Ended', icon: Trophy },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/50 border border-gray-700/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search auctions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white focus:border-purple-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        {/* Auction Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">Loading auctions...</p>
          </div>
        ) : filteredAuctions.length === 0 ? (
          <div className="text-center py-12">
            <Gavel className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No auctions found</h3>
            <p className="text-gray-500">
              {activeTab === 'live' 
                ? 'No live auctions at the moment. Check upcoming!'
                : activeTab === 'upcoming'
                ? 'No scheduled auctions. Check back later!'
                : 'No ended auctions to show.'}
            </p>
            {activeTab === 'live' && (
              <button
                onClick={() => setActiveTab('upcoming')}
                className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium"
              >
                View Upcoming
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuctions.map((auction) => (
              <div
                key={auction.id}
                className="bg-gray-900/50 border border-gray-800 hover:border-purple-500/30 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-purple-500/10 group"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-800">
                  {auction.thumbnail_url ? (
                    <img src={auction.thumbnail_url} alt={auction.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gavel className="w-12 h-12 text-gray-600" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    {auction.status === 'live' ? (
                      <div className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-lg flex items-center gap-1">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    ) : auction.status === 'scheduled' ? (
                      <div className="px-3 py-1 bg-blue-500 text-white text-sm font-bold rounded-lg">
                        UPCOMING
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-gray-600 text-white text-sm font-bold rounded-lg">
                        ENDED
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  {auction.category && (
                    <div className="absolute bottom-3 left-3">
                      <span className="px-2 py-1 bg-black/60 text-white text-xs rounded">
                        {auction.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-purple-400 transition-colors">
                    {auction.title}
                  </h3>
                  
                  {auction.description && (
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{auction.description}</p>
                  )}

                  {/* Time Info */}
                  <div className="flex items-center justify-between text-sm mt-4">
                    {auction.status === 'live' && auction.live_started_at ? (
                      <span className="text-gray-400">
                        Started {new Date(auction.live_started_at).toLocaleTimeString()}
                      </span>
                    ) : auction.status === 'scheduled' && auction.scheduled_for ? (
                      <span className="text-gray-400">
                        {new Date(auction.scheduled_for).toLocaleString()}
                      </span>
                    ) : auction.ended_at ? (
                      <span className="text-gray-400">
                        Ended {new Date(auction.ended_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span />
                    )}

                    <button
                      onClick={() => navigate(`/auctions/${auction.id}`)}
                      className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-all ${
                        auction.status === 'live'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      {auction.status === 'live' ? (
                        <>
                          <Play className="w-4 h-4" />
                          Join
                        </>
                      ) : (
                        <>
                          View
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Minimum Bid Info */}
        <div className="mt-8 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-gray-400">
              <span className="text-yellow-400 font-medium">Minimum 5,000 coins</span> required to place bids. 
              Make sure you have enough balance before joining an auction!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}