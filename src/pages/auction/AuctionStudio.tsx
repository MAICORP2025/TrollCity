import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { 
  Gavel, Plus, Calendar, Eye, 
  Trash2, Layers, Play,
  Save, X, Tag
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
  livekit_room_name: string;
  created_at: string;
  lot_count?: number;
}

const CATEGORIES = [
  'Collectibles', 'Art', 'Fashion', 'Electronics', 'Home & Garden',
  'Sports', 'Toys & Games', 'Vehicles', 'Jewelry', 'Books', 'Other'
];

export default function AuctionStudio() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [shows, setShows] = useState<AuctionShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Collectibles',
    thumbnail_url: '',
    scheduled_for: ''
  });

  const fetchMyShows = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      const { data: auctioneer } = await supabase
        .from('auctioneer_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .single();

      if (!auctioneer) {
        toast.error('You must be an approved auctioneer to use the studio');
        navigate('/auctions');
        return;
      }

      const { data, error } = await supabase
        .from('auction_shows')
        .select('*')
        .eq('auctioneer_id', auctioneer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const showsWithCounts = await Promise.all((data || []).map(async (show) => {
        const { count } = await supabase
          .from('auction_lots')
          .select('*', { count: 'exact', head: true })
          .eq('auction_show_id', show.id);
        return { ...show, lot_count: count || 0 };
      }));
      
      setShows(showsWithCounts);
    } catch (_error) {
      console.error('Error fetching shows:', _error);
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchMyShows();
  }, [fetchMyShows]);

  const createShow = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_auction_show', {
        p_title: formData.title,
        p_description: formData.description || null,
        p_category: formData.category || null,
        p_thumbnail_url: formData.thumbnail_url || null,
        p_scheduled_for: formData.scheduled_for ? new Date(formData.scheduled_for).toISOString() : null
      });

      if (rpcError) throw rpcError;
      
      const result = rpcData as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('Auction show created!');
      setShowCreator(false);
      setFormData({ title: '', description: '', category: 'Collectibles', thumbnail_url: '', scheduled_for: '' });
      fetchMyShows();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create show');
    }
  };

  const deleteShow = async (showId: string) => {
    if (!confirm('Are you sure you want to delete this show?')) return;
    
    try {
      const { error } = await supabase
        .from('auction_shows')
        .delete()
        .eq('id', showId);

      if (error) throw error;
      toast.success('Show deleted');
      fetchMyShows();
    } catch {
      toast.error('Failed to delete show');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      live: 'bg-red-500/20 text-red-400 border-red-500/30',
      ended: 'bg-green-500/20 text-green-400 border-green-500/30',
      cancelled: 'bg-red-900/20 text-red-600 border-red-900/30'
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
              <Gavel className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Auction Studio</h1>
              <p className="text-gray-400">Create and manage your live auction shows</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg font-medium hover:from-green-500 hover:to-emerald-500 transition-all"
          >
            <Plus className="w-5 h-5" />
            New Show
          </button>
        </div>

        {/* Create Modal */}
        {showCreator && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold">Create New Auction Show</h2>
                <button onClick={() => setShowCreator(false)} className="p-2 hover:bg-gray-800 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="My Awesome Auction"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-green-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Describe your auction show..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-green-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Thumbnail URL</label>
                  <input
                    type="text"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Schedule For (Optional)</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_for}
                    onChange={(e) => setFormData({ ...formData, scheduled_for: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => setShowCreator(false)}
                  className="flex-1 px-4 py-3 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={createShow}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500"
                >
                  <Save className="w-5 h-5" />
                  Create Show
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shows List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">Loading your shows...</p>
          </div>
        ) : shows.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800">
            <Gavel className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No Shows Yet</h3>
            <p className="text-gray-500 mb-6">Create your first auction show to get started!</p>
            <button
              onClick={() => setShowCreator(true)}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-medium"
            >
              Create Your First Show
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {shows.map((show) => (
              <div
                key={show.id}
                className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 hover:border-green-500/30 rounded-xl transition-all"
              >
                <div className="w-24 h-16 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                  {show.thumbnail_url ? (
                    <img src={show.thumbnail_url} alt={show.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gavel className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white truncate">{show.title}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusBadge(show.status)}`}>
                      {show.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      {show.lot_count || 0} lots
                    </span>
                    {show.category && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {show.category}
                      </span>
                    )}
                    {show.scheduled_for && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(show.scheduled_for).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {show.status === 'draft' || show.status === 'scheduled' ? (
                    <>
                      <button
                        onClick={() => navigate(`/auctions/studio/${show.id}/lots`)}
                        className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
                        title="Manage Lots"
                      >
                        <Layers className="w-5 h-5" />
                      </button>
                      {(show.lot_count || 0) > 0 && (
                        <button
                          onClick={() => navigate(`/auctions/studio/${show.id}/live`)}
                          className="p-2 hover:bg-green-800 rounded-lg text-green-400 hover:text-green-300"
                          title="Go Live"
                        >
                          <Play className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  ) : show.status === 'live' ? (
                    <button
                      onClick={() => navigate(`/auctions/studio/${show.id}/live`)}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-sm"
                    >
                      <Play className="w-4 h-4" />
                      Dashboard
                    </button>
                  ) : null}
                  <button
                    onClick={() => navigate(`/auctions/${show.id}`)}
                    className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
                    title="View"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  {show.status === 'draft' && (
                    <button
                      onClick={() => deleteShow(show.id)}
                      className="p-2 hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
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