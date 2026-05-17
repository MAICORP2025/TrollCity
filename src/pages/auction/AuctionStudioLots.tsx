import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { 
  ArrowLeft, Gavel, Plus, Trash2, 
  Save, X
} from 'lucide-react';

interface AuctionLot {
  id: string;
  title: string;
  description: string;
  image_urls: string[];
  starting_bid: number;
  min_increment: number;
  order_index: number;
  status: 'upcoming' | 'live' | 'sold' | 'unsold';
  current_highest_bid: number;
}

export default function AuctionStudioLots() {
  const { showId } = useParams<{ showId: string }>();
  const navigate = useNavigate();
  const _user = useAuthStore();
  
  const [show, setShow] = useState<any>(null);
  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    starting_bid: 0,
    min_increment: 100,
    image_urls: ''
  });

  const fetchData = useCallback(async () => {
    if (!showId) return;

    try {
      const { data: showData, error: showError } = await supabase
        .from('auction_shows')
        .select('*')
        .eq('id', showId)
        .single();

      if (showError) throw showError;
      setShow(showData);

      const { data: lotsData, error: lotsError } = await supabase
        .from('auction_lots')
        .select('*')
        .eq('auction_show_id', showId)
        .order('order_index');

      if (lotsError) throw lotsError;
      setLots(lotsData || []);
    } catch (_error) {
      console.error('Error fetching data:', _error);
      toast.error('Failed to load auction data');
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createLot = async () => {
    if (!formData.title.trim() || !showId) {
      toast.error('Title is required');
      return;
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_auction_lot', {
        p_show_id: showId,
        p_title: formData.title,
        p_description: formData.description || null,
        p_starting_bid: formData.starting_bid,
        p_min_increment: formData.min_increment,
        p_image_urls: formData.image_urls ? JSON.stringify(formData.image_urls.split(',').map(s => s.trim()).filter(Boolean)) : JSON.stringify([]),
        p_order_index: lots.length
      });

      if (rpcError) throw rpcError;
      
      const result = rpcData as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('Lot created!');
      setShowCreator(false);
      setFormData({ title: '', description: '', starting_bid: 0, min_increment: 100, image_urls: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create lot');
    }
  };

  const deleteLot = async (lotId: string) => {
    if (!confirm('Delete this lot?')) return;
    
    try {
      const { error } = await supabase
        .from('auction_lots')
        .delete()
        .eq('id', lotId);

      if (error) throw error;
      toast.success('Lot deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete lot');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      upcoming: 'bg-gray-500/20 text-gray-400',
      live: 'bg-green-500/20 text-green-400',
      sold: 'bg-blue-500/20 text-blue-400',
      unsold: 'bg-red-500/20 text-red-400'
    };
    return styles[status] || styles.upcoming;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/auctions/studio')}
            className="p-2 hover:bg-gray-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{show?.title || 'Auction Lots'}</h1>
            <p className="text-gray-400">Manage auction lots</p>
          </div>
          <button
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg"
          >
            <Plus className="w-5 h-5" />
            Add Lot
          </button>
        </div>

        {/* Create Modal */}
        {showCreator && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold">Add New Lot</h2>
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
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Starting Bid</label>
                    <input
                      type="number"
                      value={formData.starting_bid}
                      onChange={(e) => setFormData({ ...formData, starting_bid: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Min Increment</label>
                    <input
                      type="number"
                      value={formData.min_increment}
                      onChange={(e) => setFormData({ ...formData, min_increment: parseInt(e.target.value) || 100 })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Image URLs (comma separated)</label>
                  <input
                    type="text"
                    value={formData.image_urls}
                    onChange={(e) => setFormData({ ...formData, image_urls: e.target.value })}
                    placeholder="https://..., https://..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => setShowCreator(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={createLot}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg"
                >
                  <Save className="w-5 h-5" />
                  Add Lot
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lots List */}
        {lots.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800">
            <Gavel className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No Lots Yet</h3>
            <p className="text-gray-500 mb-6">Add your first lot to this auction!</p>
            <button
              onClick={() => setShowCreator(true)}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-medium"
            >
              Add First Lot
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {lots.map((lot, index) => (
              <div
                key={lot.id}
                className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 hover:border-green-500/30 rounded-xl"
              >
                <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 font-bold">
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white truncate">{lot.title}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded ${getStatusBadge(lot.status)}`}>
                      {lot.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>Starting: {lot.starting_bid.toLocaleString()} TC</span>
                    {lot.current_highest_bid > 0 && (
                      <span className="text-green-400">Current: {lot.current_highest_bid.toLocaleString()} TC</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteLot(lot.id)}
                  className="p-2 hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-400"
                  disabled={lot.status === 'live'}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {show?.status !== 'live' && lots.length > 0 && (
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <p className="text-blue-400 text-center">
              Your auction is ready. Go to Auction Studio to start the show!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}