import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase} from '@/api/supabaseClient';
import { getCurrentUser } from '../services/authService';
import { useQuery } from '@tanstack/react-query';
import { 
  User, Coins, Wallet, History, Settings, 
  ChevronRight, CreditCard, ArrowUpRight, ArrowDownLeft,
  CheckCircle, Clock, XCircle, Play, Film, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setPaypalEmail(userData?.paypal_email || '');
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

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', user?.email],
    queryFn: () => supabase.entities.CoinTransaction.filter(
      { user_email: user.email },
      '-created_date',
      50
    ),
    enabled: !!user?.email,
  });

  const { data: unlockedVideos = [] } = useQuery({
    queryKey: ['unlocked-videos', user?.email],
    queryFn: async () => {
      const unlocked = await supabase.entities.UnlockedContent.filter(
        { user_email: user.email },
        '-created_date'
      );
      const videoIds = unlocked.map(u => u.video_id);
      if (videoIds.length === 0) return [];
      const videos = await Promise.all(
        videoIds.map(id => supabase.entities.Video.filter({ id }))
      );
      return videos.flat();
    },
    enabled: !!user?.email,
  });

  const handleSavePaypal = async () => {
    if (!paypalEmail) {
      toast.error('Please enter a PayPal email');
      return;
    }

    setIsSaving(true);
    try {
      await supabase.auth.updateMe({ paypal_email: paypalEmail });
      toast.success('PayPal email saved successfully');
      loadUser();
    } catch {
      toast.error('Failed to save PayPal email');
    }
    setIsSaving(false);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'purchase':
        return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
      case 'spend':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'earn':
        return <ArrowDownLeft className="w-4 h-4 text-[#FFD700]" />;
      case 'payout':
        return <ArrowUpRight className="w-4 h-4 text-purple-500" />;
      default:
        return <Coins className="w-4 h-4 text-gray-500" />;
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
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-[#FFD700]/20 flex items-center justify-center border-2 border-[#FFD700]/50">
              {user.profile_image ? (
                <img src={user.profile_image} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-[#FFD700]" />
              )}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-white mb-2">{user.name || user.email}</h1>
              <p className="text-gray-300 mb-4">{user.email}</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#FFD700]" />
                  <span className="text-white font-semibold">{user.coins || 0} Coins</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Profile Information</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <Input id="email" value={user.email} readOnly className="bg-gray-800 border-gray-600 text-white" />
                </div>
                <div>
                  <Label htmlFor="name" className="text-gray-300">Name</Label>
                  <Input id="name" value={user.name || ''} readOnly className="bg-gray-800 border-gray-600 text-white" />
                </div>
                <div>
                  <Label htmlFor="paypal" className="text-gray-300">PayPal Email</Label>
                  <Input
                    id="paypal"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="Enter PayPal email for payouts"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button onClick={handleSavePaypal} disabled={isSaving} className="mt-2 bg-[#FFD700] text-black hover:bg-[#FFD700]/80">
                    {isSaving ? 'Saving...' : 'Save PayPal Email'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="mt-6">
            <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Transaction History</h2>
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-gray-300">No transactions found.</p>
                ) : (
                  transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <p className="text-white font-medium capitalize">{transaction.type}</p>
                          <p className="text-gray-400 text-sm">{format(new Date(transaction.created_date), 'MMM dd, yyyy')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${transaction.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount} Coins
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="videos" className="mt-6">
            <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Unlocked Videos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unlockedVideos.length === 0 ? (
                  <p className="text-gray-300 col-span-full">No unlocked videos.</p>
                ) : (
                  unlockedVideos.map((video) => (
                    <div key={video.id} className="bg-gray-800/50 rounded-lg p-4">
                      <div className="aspect-video bg-gray-700 rounded mb-3 flex items-center justify-center">
                        <Play className="w-8 h-8 text-[#FFD700]" />
                      </div>
                      <h3 className="text-white font-medium mb-2">{video.title}</h3>
                      <Link to={createPageUrl('watch', { id: video.id })} className="text-[#FFD700] hover:underline">
                        Watch Now
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Settings</h2>
              <p className="text-gray-300">Additional settings can be added here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}