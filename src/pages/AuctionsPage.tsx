import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Gavel, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Auction {
  id: string;
  asset_type: 'house' | 'car';
  asset_id: string;
  reason: string;
  starting_bid: number;
  current_bid: number;
  current_winner_user_id: string | null;
  ends_at: string;
  status: 'active' | 'ended' | 'cancelled';
}

export default function AuctionsPage() {
  const { user, profile, refreshProfile } = useAuthStore();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchAuctions = async () => {
    try {
      const { data, error } = await supabase
        .from('asset_auctions')
        .select('*')
        .eq('status', 'active')
        .order('ends_at', { ascending: true });
      
      if (error) throw error;
      setAuctions(data || []);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async (auction: Auction) => {
    const amount = parseInt(bidAmount[auction.id] || '0');
    if (!amount || amount <= auction.current_bid) {
      toast.error('Bid must be higher than current bid');
      return;
    }
    
    if (profile && profile.troll_coins < amount) {
      toast.error('Insufficient funds');
      return;
    }

    setBidding(auction.id);
    try {
      const { data, error } = await supabase.rpc('place_bid', {
        p_auction_id: auction.id,
        p_amount: amount
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Bid placed successfully!');
        fetchAuctions();
        refreshProfile();
      } else {
        toast.error(data.error || 'Bid failed');
      }
    } catch (error) {
      console.error('Bid error:', error);
      toast.error('Failed to place bid');
    } finally {
      setBidding(null);
    }
  };

  const getTimeLeft = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - new Date().getTime();
    if (diff <= 0) return 'Ending...';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading auctions...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-400">
          Asset Auctions
        </h1>
        <p className="text-zinc-400">
          Bid on foreclosed properties and seized vehicles. High risk, high reward.
        </p>
      </div>

      {auctions.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
          <Gavel className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <h3 className="text-lg font-medium text-zinc-300">No Active Auctions</h3>
          <p className="text-zinc-500">Check back later for foreclosed assets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {auctions.map(auction => (
            <Card key={auction.id} className="bg-zinc-900/50 border-zinc-800 overflow-hidden hover:border-zinc-700 transition-all">
              <div className="h-1 bg-gradient-to-r from-orange-500 to-red-500" />
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="bg-orange-900/20 text-orange-400 border-orange-800">
                    {auction.asset_type.toUpperCase()}
                  </Badge>
                  <div className="flex items-center text-red-400 text-sm font-mono">
                    <Clock className="w-3 h-3 mr-1" />
                    {getTimeLeft(auction.ends_at)}
                  </div>
                </div>
                <CardTitle className="text-xl">
                   {auction.reason === 'foreclosure' ? 'Foreclosed Asset' : 'Seized Asset'}
                </CardTitle>
                <div className="text-zinc-500 text-xs uppercase tracking-wider">{auction.id.slice(0, 8)}...</div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="bg-zinc-950/50 p-4 rounded border border-zinc-800 text-center">
                  <div className="text-zinc-500 text-xs mb-1">Current Bid</div>
                  <div className="text-2xl font-bold text-white flex justify-center items-center">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    {auction.current_bid > 0 ? auction.current_bid.toLocaleString() : auction.starting_bid.toLocaleString()}
                  </div>
                  {auction.current_winner_user_id === user?.id && (
                    <Badge className="mt-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      You are winning
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Place your bid</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-2 top-2.5 w-4 h-4 text-zinc-500" />
                      <Input 
                        type="number" 
                        placeholder={(auction.current_bid + 100).toString()}
                        className="pl-8 bg-zinc-950 border-zinc-700"
                        value={bidAmount[auction.id] || ''}
                        onChange={(e) => setBidAmount({...bidAmount, [auction.id]: e.target.value})}
                        disabled={bidding === auction.id}
                      />
                    </div>
                    <Button 
                      onClick={() => handleBid(auction)}
                      disabled={bidding === auction.id}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      Bid
                    </Button>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="bg-zinc-950/30 border-t border-zinc-800/50 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500 w-full justify-center">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Bid holds funds until outbid</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
