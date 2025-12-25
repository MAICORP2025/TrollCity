import React, { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, Users, Film, Coins, Wallet, 
  CheckCircle, XCircle, Clock, Eye, Search,
  AlertTriangle, TrendingUp, DollarSign, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const queryClient = useQueryClient();

  const loadUser = async () => {
    try {
      const userData = await supabase.auth.me();
      if (userData.role !== 'admin') {
        toast.error('Access denied');
        window.location.href = '/';
        return;
      }
    } catch {
      window.location.href = '/';
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      await loadUser();
    };
    fetchUser();
  }, []);

  // Queries
  const { data: pendingVideos = [] } = useQuery({
    queryKey: ['pending-videos'],
    queryFn: () => supabase.entities.Video.filter({ status: 'pending' }, '-created_date'),
  });

  const { data: allVideos = [] } = useQuery({
    queryKey: ['all-videos'],
    queryFn: () => supabase.entities.Video.list('-created_date', 100),
  });

  const { data: creatorApplications = [] } = useQuery({
    queryKey: ['creator-applications'],
    queryFn: () => supabase.entities.CreatorApplication.filter({ status: 'pending' }, '-created_date'),
  });

  const { data: payoutRequests = [] } = useQuery({
    queryKey: ['payout-requests'],
    queryFn: () => supabase.entities.PayoutRequest.filter({ status: 'pending' }, '-created_date'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => supabase.entities.User.list('-created_date', 100),
  });

  // Stats
  const totalCoinsInCirculation = allUsers.reduce((sum, u) => sum + (u.coin_balance || 0), 0);
  const totalCreators = allUsers.filter(u => u.is_creator).length;
  const totalVideos = allVideos.filter(v => v.status === 'approved').length;

  // Video moderation
  const handleApproveVideo = async (video) => {
    try {
      await supabase.entities.Video.update(video.id, { status: 'approved' });
      toast.success('Video approved');
      queryClient.invalidateQueries(['pending-videos']);
      queryClient.invalidateQueries(['all-videos']);
    } catch {
      toast.error('Failed to approve video');
    }
  };

  const handleRejectVideo = async () => {
    if (!selectedVideo) return;
    try {
      await supabase.entities.Video.update(selectedVideo.id, { 
        status: 'rejected'
      });
      toast.success('Video rejected');
      setSelectedVideo(null);
      setRejectionReason('');
      queryClient.invalidateQueries(['pending-videos']);
      queryClient.invalidateQueries(['all-videos']);
    } catch {
      toast.error('Failed to reject video');
    }
  };

  // Creator application handling
  const handleApproveCreator = async (application) => {
    try {
      // Update application
      await supabase.entities.CreatorApplication.update(application.id, { status: 'approved' });
      
      // Update user
      const users = await supabase.entities.User.filter({ email: application.user_email });
      if (users.length > 0) {
        await supabase.entities.User.update(users[0].id, { 
          is_creator: true,
          channel_name: application.channel_name
        });
      }
      
      toast.success('Creator approved');
      queryClient.invalidateQueries(['creator-applications']);
      queryClient.invalidateQueries(['all-users']);
    } catch {
      toast.error('Failed to approve creator');
    }
  };

  const handleRejectCreator = async (application, reason) => {
    try {
      await supabase.entities.CreatorApplication.update(application.id, { 
        status: 'rejected',
        rejection_reason: reason || 'Application did not meet requirements'
      });
      toast.success('Application rejected');
      queryClient.invalidateQueries(['creator-applications']);
    } catch {
      toast.error('Failed to reject application');
    }
  };

  // Payout handling
  const handleProcessPayout = async (payout, action) => {
    try {
      if (action === 'complete') {
        await supabase.entities.PayoutRequest.update(payout.id, { 
          status: 'completed',
          processed_date: new Date().toISOString().split('T')[0]
        });
        toast.success(`Payout of $${payout.usd_amount} marked as completed`);
      } else {
        // Reject - refund coins
        await supabase.entities.PayoutRequest.update(payout.id, { status: 'rejected' });
        
        const users = await supabase.entities.User.filter({ email: payout.user_email });
        if (users.length > 0) {
          await supabase.entities.User.update(users[0].id, {
            coin_balance: (users[0].coin_balance || 0) + payout.coin_amount
          });
        }
        toast.success('Payout rejected and coins refunded');
      }
      queryClient.invalidateQueries(['payout-requests']);
    } catch {
      toast.error('Failed to process payout');
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-[#FF1744]/20">
            <Shield className="w-8 h-8 text-[#FF1744]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-400">Manage users, content, and transactions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-6 rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/5">
            <Users className="w-8 h-8 text-[#FFD700] mb-3" />
            <p className="text-3xl font-bold text-white">{allUsers.length}</p>
            <p className="text-sm text-gray-400">Total Users</p>
          </div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Film className="w-8 h-8 text-blue-400 mb-3" />
            <p className="text-3xl font-bold text-white">{totalVideos}</p>
            <p className="text-sm text-gray-400">Published Videos</p>
          </div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Coins className="w-8 h-8 text-[#FFD700] mb-3" />
            <p className="text-3xl font-bold text-white">{totalCoinsInCirculation.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Coins in Circulation</p>
          </div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <TrendingUp className="w-8 h-8 text-green-400 mb-3" />
            <p className="text-3xl font-bold text-white">{totalCreators}</p>
            <p className="text-sm text-gray-400">Active Creators</p>
          </div>
        </div>

        {/* Pending Items Alert */}
        {(pendingVideos.length > 0 || creatorApplications.length > 0 || payoutRequests.length > 0) && (
          <div className="mb-8 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <span className="text-yellow-400">
                <strong>{pendingVideos.length}</strong> pending videos, {' '}
                <strong>{creatorApplications.length}</strong> creator applications, {' '}
                <strong>{payoutRequests.length}</strong> payout requests need attention
              </span>
            </div>
          </div>
        )}

        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="w-full bg-gray-900/50 border border-gray-800 p-1 mb-6">
            <TabsTrigger value="videos" className="flex-1 data-[state=active]:bg-[#FFD700]/20 data-[state=active]:text-[#FFD700]">
              Videos {pendingVideos.length > 0 && `(${pendingVideos.length})`}
            </TabsTrigger>
            <TabsTrigger value="creators" className="flex-1 data-[state=active]:bg-[#FFD700]/20 data-[state=active]:text-[#FFD700]">
              Creator Apps {creatorApplications.length > 0 && `(${creatorApplications.length})`}
            </TabsTrigger>
            <TabsTrigger value="payouts" className="flex-1 data-[state=active]:bg-[#FFD700]/20 data-[state=active]:text-[#FFD700]">
              Payouts {payoutRequests.length > 0 && `(${payoutRequests.length})`}
            </TabsTrigger>
            <TabsTrigger value="users" className="flex-1 data-[state=active]:bg-[#FFD700]/20 data-[state=active]:text-[#FFD700]">
              Users
            </TabsTrigger>
          </TabsList>

          {/* Videos Tab */}
          <TabsContent value="videos">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Pending Review ({pendingVideos.length})</h3>
              
              {pendingVideos.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-gray-800 bg-gray-900/30">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-400">No videos pending review</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingVideos.map((video) => (
                    <div 
                      key={video.id}
                      className="flex gap-4 p-4 rounded-xl border border-gray-800 bg-gray-900/30"
                    >
                      <div className="w-48 aspect-video rounded-lg overflow-hidden flex-shrink-0">
                        <img 
                          src={video.thumbnail_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400'}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{video.title}</h4>
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">{video.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>By: {video.creator_name}</span>
                          <span>Type: {video.content_type}</span>
                          <span>Category: {video.category}</span>
                          {video.is_premium && <span className="text-[#FFD700]">Premium: {video.coin_price} coins</span>}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            onClick={() => handleApproveVideo(video)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedVideo(video)}
                            className="border-red-500 text-red-500 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                          {video.video_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(video.video_url, '_blank')}
                              className="border-gray-600 text-gray-400"
                            >
                              <Eye className="w-4 h-4 mr-1" /> Preview
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Creator Applications Tab */}
          <TabsContent value="creators">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Pending Applications ({creatorApplications.length})</h3>
              
              {creatorApplications.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-gray-800 bg-gray-900/30">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-400">No pending applications</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {creatorApplications.map((app) => (
                    <div 
                      key={app.id}
                      className="p-6 rounded-xl border border-gray-800 bg-gray-900/30"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-white">{app.full_name}</h4>
                          <p className="text-sm text-gray-400">{app.user_email}</p>
                          <p className="text-[#FFD700] font-medium mt-1">Channel: {app.channel_name}</p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {format(new Date(app.created_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-gray-300 mt-4 text-sm">{app.content_description}</p>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {app.agreed_to_safety_policy && (
                          <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">✓ Safety</span>
                        )}
                        {app.agreed_to_copyright_policy && (
                          <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">✓ Copyright</span>
                        )}
                        {app.agreed_to_speech_policy && (
                          <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">✓ Speech</span>
                        )}
                        {app.agreed_to_terms && (
                          <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">✓ Terms</span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => handleApproveCreator(app)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectCreator(app)}
                          className="border-red-500 text-red-500 hover:bg-red-500/10"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Pending Payouts ({payoutRequests.length})</h3>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Process on Mondays & Fridays</span>
                </div>
              </div>
              
              {payoutRequests.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-gray-800 bg-gray-900/30">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-400">No pending payouts</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-800 bg-gray-900/30 overflow-hidden">
                  <div className="divide-y divide-gray-800">
                    {payoutRequests.map((payout) => (
                      <div key={payout.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{payout.user_email}</p>
                          <p className="text-sm text-gray-500">PayPal: {payout.paypal_email}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {format(new Date(payout.created_date), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#FFD700] font-bold">{payout.coin_amount.toLocaleString()} coins</p>
                          <p className="text-2xl font-bold text-green-400">${payout.usd_amount}</p>
                          <p className="text-xs text-gray-500">{payout.tier_name} Tier</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleProcessPayout(payout, 'complete')}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <DollarSign className="w-4 h-4 mr-1" /> Mark Paid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProcessPayout(payout, 'reject')}
                            className="border-red-500 text-red-500 hover:bg-red-500/10"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-900 border-gray-700 text-white"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/30 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-gray-400">User</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400">Role</th>
                      <th className="text-right p-4 text-sm font-medium text-gray-400">Coins</th>
                      <th className="text-right p-4 text-sm font-medium text-gray-400">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {allUsers
                      .filter(u => 
                        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-gray-800/30">
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-white">{u.full_name || 'Unknown'}</p>
                              <p className="text-sm text-gray-500">{u.email}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              {u.role === 'admin' && (
                                <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">Admin</span>
                              )}
                              {u.is_creator && (
                                <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">Creator</span>
                              )}
                              {!u.is_creator && u.role !== 'admin' && (
                                <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-400">User</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className="text-[#FFD700] font-medium">{(u.coin_balance || 0).toLocaleString()}</span>
                          </td>
                          <td className="p-4 text-right text-sm text-gray-500">
                            {format(new Date(u.created_date), 'MMM d, yyyy')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Rejection Dialog */}
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">Reject Video</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-gray-400 mb-4">Rejecting: {selectedVideo?.title}</p>
              <Textarea
                placeholder="Reason for rejection (optional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSelectedVideo(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRejectVideo}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reject Video
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}