import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, Coins, Film, Eye, Heart, Upload, 
  Wallet, ArrowRight, Clock, CheckCircle, XCircle, AlertCircle,
  DollarSign, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CreatorDashboard() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCashoutTier, setSelectedCashoutTier] = useState(null);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

  const cashoutTiers = [
    { coins: 12000, usd: 25, name: 'Starter' },
    { coins: 30000, usd: 70, name: 'Bronze' },
    { coins: 60000, usd: 150, name: 'Silver' },
    { coins: 120000, usd: 325, name: 'Gold' },
    { coins: 250000, usd: 700, name: 'Platinum' },
  ];

  const loadUser = async () => {
    try {
      const userData = await supabase.auth.me();
      if (!userData.is_creator) {
        window.location.href = createPageUrl('BecomeCreator');
        return;
      }
      setUser(userData);
    } catch {
      supabase.auth.redirectToLogin();
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      await loadUser();
    };
    fetchUser();
  }, []);

  const { data: myVideos = [] } = useQuery({
    queryKey: ['my-videos', user?.email],
    queryFn: () => supabase.entities.Video.filter(
      { creator_email: user.email },
      '-created_date'
    ),
    enabled: !!user?.email,
  });

  const { data: payoutHistory = [] } = useQuery({
    queryKey: ['payout-history', user?.email],
    queryFn: () => supabase.entities.PayoutRequest.filter(
      { user_email: user.email },
      '-created_date'
    ),
    enabled: !!user?.email,
  });

  const totalViews = myVideos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalLikes = myVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
  const approvedVideos = myVideos.filter(v => v.status === 'approved');
  const pendingVideos = myVideos.filter(v => v.status === 'pending');


  const handleCashout = async () => {
    if (!user.paypal_email) {
      toast.error('Please link your PayPal email in Profile settings first');
      return;
    }

    if (!selectedCashoutTier) {
      toast.error('Please select a cashout tier');
      return;
    }

    const tier = cashoutTiers.find(t => t.coins === parseInt(selectedCashoutTier));
    if (!tier) return;

    if ((user.coin_balance || 0) < tier.coins) {
      toast.error('Insufficient coin balance');
      return;
    }

    setIsRequestingPayout(true);

    try {
      // Deduct coins
      await supabase.auth.updateMe({
        coin_balance: (user.coin_balance || 0) - tier.coins
      });

      // Create payout request
      await supabase.entities.PayoutRequest.create({
        user_email: user.email,
        paypal_email: user.paypal_email,
        coin_amount: tier.coins,
        usd_amount: tier.usd,
        tier_name: tier.name,
        status: 'pending'
      });

      // Record transaction
      await supabase.entities.CoinTransaction.create({
        user_email: user.email,
        type: 'payout',
        amount: -tier.coins,
        description: `Cashout request: ${tier.name} tier - $${tier.usd}`,
        usd_amount: tier.usd,
        status: 'completed'
      });

      toast.success(`Payout request submitted! $${tier.usd} will be sent to your PayPal.`);
      loadUser();
      setSelectedCashoutTier(null);
    } catch {
      toast.error('Failed to process payout request');
    }

    setIsRequestingPayout(false);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle className="w-3 h-3" /> Live
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Creator Dashboard</h1>
            <p className="text-gray-400">Welcome back, {user.channel_name || user.full_name}</p>
          </div>
          <Link to={createPageUrl('Upload')}>
            <Button className="neon-btn-red text-white">
              <Upload className="w-4 h-4 mr-2" />
              Upload New Video
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-6 rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent">
            <Coins className="w-8 h-8 text-[#FFD700] mb-3" />
            <p className="text-3xl font-bold text-white">{(user.coin_balance || 0).toLocaleString()}</p>
            <p className="text-sm text-gray-400">Coin Balance</p>
          </div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Film className="w-8 h-8 text-[#FF1744] mb-3" />
            <p className="text-3xl font-bold text-white">{approvedVideos.length}</p>
            <p className="text-sm text-gray-400">Published Videos</p>
          </div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Eye className="w-8 h-8 text-blue-400 mb-3" />
            <p className="text-3xl font-bold text-white">{totalViews.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Total Views</p>
          </div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Heart className="w-8 h-8 text-pink-400 mb-3" />
            <p className="text-3xl font-bold text-white">{totalLikes.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Total Likes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cashout Section */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/5 to-transparent p-6">
              <div className="flex items-center gap-3 mb-6">
                <Wallet className="w-6 h-6 text-[#FFD700]" />
                <h2 className="text-xl font-bold text-white">Cash Out</h2>
              </div>

              <div className="bg-black/30 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-400 mb-1">Available Balance</p>
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#FFD700]" />
                  <span className="text-2xl font-bold text-[#FFD700]">{(user.coin_balance || 0).toLocaleString()}</span>
                </div>
              </div>

              {!user.paypal_email ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-400">PayPal not linked</p>
                      <Link to={createPageUrl('Profile')} className="text-xs text-red-300 hover:underline">
                        Link PayPal in Profile settings →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-4">
                  PayPal: {user.paypal_email}
                </p>
              )}

              <div className="space-y-3 mb-6">
                {cashoutTiers.map((tier) => {
                  const available = (user.coin_balance || 0) >= tier.coins;
                  return (
                    <button
                      key={tier.coins}
                      onClick={() => available && setSelectedCashoutTier(tier.coins.toString())}
                      disabled={!available}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        selectedCashoutTier === tier.coins.toString()
                          ? 'border-[#FFD700] bg-[#FFD700]/10'
                          : available
                          ? 'border-gray-700 hover:border-[#FFD700]/50'
                          : 'border-gray-800 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-white">{tier.name}</p>
                          <p className="text-sm text-gray-400">{tier.coins.toLocaleString()} coins</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#FFD700]">${tier.usd}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={handleCashout}
                disabled={!selectedCashoutTier || isRequestingPayout || !user.paypal_email}
                className="w-full neon-btn-gold text-black font-semibold py-6"
              >
                {isRequestingPayout ? 'Processing...' : 'Request Payout'}
              </Button>

              <div className="mt-4 p-3 rounded-lg bg-gray-900/50 border border-gray-800">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Payouts processed on Mondays & Fridays</span>
                </div>
              </div>
            </div>
          </div>

          {/* Videos & History */}
          <div className="lg:col-span-2 space-y-8">
            {/* My Videos */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">My Videos</h2>
                {pendingVideos.length > 0 && (
                  <span className="text-sm text-yellow-400">
                    {pendingVideos.length} pending review
                  </span>
                )}
              </div>

              {myVideos.length === 0 ? (
                <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-8 text-center">
                  <Film className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No videos uploaded yet</p>
                  <Link to={createPageUrl('Upload')}>
                    <Button className="neon-btn-gold text-black">Upload Your First Video</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myVideos.slice(0, 5).map((video) => (
                    <div 
                      key={video.id}
                      className="flex gap-4 p-4 rounded-xl border border-gray-800 bg-gray-900/30 hover:border-gray-700 transition-colors"
                    >
                      <div className="relative w-32 aspect-video rounded-lg overflow-hidden flex-shrink-0">
                        <img 
                          src={video.thumbnail_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400'}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-white line-clamp-1">{video.title}</h3>
                          {getStatusBadge(video.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {video.views || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {video.likes || 0}
                          </span>
                          {video.is_premium && (
                            <span className="flex items-center gap-1 text-[#FFD700]">
                              <Coins className="w-3 h-3" /> {video.coin_price}
                            </span>
                          )}
                        </div>
                        {video.status === 'approved' && (
                          <Link 
                            to={createPageUrl(`EditVideo?id=${video.id}`)}
                            className="text-xs text-[#FFD700] hover:underline mt-2 inline-block"
                          >
                            Edit Video →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payout History */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Payout History</h2>
              
              {payoutHistory.length === 0 ? (
                <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-8 text-center">
                  <DollarSign className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400">No payouts yet</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-800 bg-gray-900/30 overflow-hidden">
                  <div className="divide-y divide-gray-800">
                    {payoutHistory.map((payout) => (
                      <div key={payout.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{payout.tier_name} Tier</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(payout.created_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#FFD700]">${payout.usd_amount}</p>
                          <p className={`text-xs ${
                            payout.status === 'completed' ? 'text-green-400' :
                            payout.status === 'processing' ? 'text-blue-400' :
                            payout.status === 'rejected' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}