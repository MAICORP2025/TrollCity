import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  User, Users, Heart, MessageCircle, Ban, 
  Star, Coins, Film, Crown, Check, UserPlus, Mail,
  Shield, Twitter, Instagram, Youtube, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import VideoCard from '../components/video/VideoCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function UserProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const profileEmail = urlParams.get('user');
  const queryClient = useQueryClient();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messageContent, setMessageContent] = useState('');

  const loadCurrentUser = async () => {
    try {
      const userData = await supabase.auth.me();
      setCurrentUser(userData);
    } catch {
      setCurrentUser(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      await loadCurrentUser();
    };
    fetchUser();
  }, []);

  const { data: profileUser } = useQuery({
    queryKey: ['profile-user', profileEmail],
    queryFn: async () => {
      const users = await supabase.entities.User.filter({ email: profileEmail });
      return users[0];
    },
    enabled: !!profileEmail,
  });

  const { data: isFollowing = false, refetch: refetchFollowing } = useQuery({
    queryKey: ['is-following', currentUser?.email, profileEmail],
    queryFn: async () => {
      const follows = await supabase.entities.Follower.filter({
        follower_email: currentUser.email,
        following_email: profileEmail
      });
      return follows.length > 0;
    },
    enabled: !!currentUser?.email && !!profileEmail && currentUser?.email !== profileEmail,
  });

  const { data: isBlocked = false } = useQuery({
    queryKey: ['is-blocked', currentUser?.email, profileEmail],
    queryFn: async () => {
      const blocks = await supabase.entities.BlockedUser.filter({
        blocker_email: currentUser.email,
        blocked_email: profileEmail
      });
      return blocks.length > 0;
    },
    enabled: !!currentUser?.email && !!profileEmail,
  });

  const { data: followerCount = 0 } = useQuery({
    queryKey: ['follower-count', profileEmail],
    queryFn: async () => {
      const followers = await supabase.entities.Follower.filter({ following_email: profileEmail });
      return followers.length;
    },
    enabled: !!profileEmail,
  });

  const { data: followingCount = 0 } = useQuery({
    queryKey: ['following-count', profileEmail],
    queryFn: async () => {
      const following = await supabase.entities.Follower.filter({ follower_email: profileEmail });
      return following.length;
    },
    enabled: !!profileEmail,
  });

  const { data: userVideos = [] } = useQuery({
    queryKey: ['user-videos', profileEmail],
    queryFn: () => supabase.entities.Video.filter(
      { creator_email: profileEmail, status: 'approved' },
      '-created_date',
      20
    ),
    enabled: !!profileEmail && !!profileUser?.is_creator,
  });

  const { data: vipPackages = [] } = useQuery({
    queryKey: ['vip-packages', profileEmail],
    queryFn: () => supabase.entities.VIPPackage.filter({ creator_email: profileEmail, active: true }),
    enabled: !!profileEmail && !!profileUser?.is_creator,
  });

  const { data: activeSubscription } = useQuery({
    queryKey: ['active-subscription', currentUser?.email, profileEmail],
    queryFn: async () => {
      const subs = await supabase.entities.Subscription.filter({
        subscriber_email: currentUser.email,
        creator_email: profileEmail,
        status: 'active'
      });
      return subs[0];
    },
    enabled: !!currentUser?.email && !!profileEmail && profileUser?.is_creator,
  });

  const handleFollow = async () => {
    if (!currentUser) {
      supabase.auth.redirectToLogin();
      return;
    }

    try {
      if (isFollowing) {
        const follows = await supabase.entities.Follower.filter({
          follower_email: currentUser.email,
          following_email: profileEmail
        });
        if (follows.length > 0) {
          await supabase.entities.Follower.delete(follows[0].id);
        }
        toast.success('Unfollowed');
      } else {
        await supabase.entities.Follower.create({
          follower_email: currentUser.email,
          following_email: profileEmail
        });
        toast.success('Following!');
      }
      refetchFollowing();
      queryClient.invalidateQueries(['follower-count', profileEmail]);
    } catch {
      toast.error('Action failed');
    }
  };

  const handleBlock = async () => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to block this user?')) return;

    try {
      if (isBlocked) {
        const blocks = await supabase.entities.BlockedUser.filter({
          blocker_email: currentUser.email,
          blocked_email: profileEmail
        });
        if (blocks.length > 0) {
          await supabase.entities.BlockedUser.delete(blocks[0].id);
        }
        toast.success('Unblocked');
      } else {
        await supabase.entities.BlockedUser.create({
          blocker_email: currentUser.email,
          blocked_email: profileEmail
        });
        toast.success('Blocked');
      }
      queryClient.invalidateQueries(['is-blocked']);
    } catch {
      toast.error('Action failed');
    }
  };

  const handleSendMessage = async () => {
    if (!currentUser) {
      supabase.auth.redirectToLogin();
      return;
    }

    if (!messageContent.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      const conversationId = [currentUser.email, profileEmail].sort().join('_');
      await supabase.entities.Message.create({
        from_email: currentUser.email,
        to_email: profileEmail,
        content: messageContent,
        conversation_id: conversationId
      });
      toast.success('Message sent!');
      setShowMessageDialog(false);
      setMessageContent('');
    } catch {
      toast.error('Failed to send message');
    }
  };

  const handleSubscribe = async (packageId) => {
    if (!currentUser) {
      supabase.auth.redirectToLogin();
      return;
    }

    const pkg = vipPackages.find(p => p.id === packageId);
    if (!pkg) return;

    if (currentUser.coin_balance < pkg.coin_price) {
      toast.error('Insufficient MAI Coins');
      return;
    }

    try {
      // Deduct coins
      await supabase.auth.updateMe({
        coin_balance: currentUser.coin_balance - pkg.coin_price,
        total_spent_coins: (currentUser.total_spent_coins || 0) + pkg.coin_price
      });

      // Credit creator
      await supabase.entities.User.update(profileUser.id, {
        coin_balance: (profileUser.coin_balance || 0) + pkg.coin_price,
        total_earned_coins: (profileUser.total_earned_coins || 0) + pkg.coin_price
      });

      // Create subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + pkg.duration_days);

      await supabase.entities.Subscription.create({
        subscriber_email: currentUser.email,
        creator_email: profileEmail,
        package_id: pkg.id,
        package_name: pkg.name,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active'
      });

      // Record support
      await supabase.entities.FanSupport.create({
        fan_email: currentUser.email,
        creator_email: profileEmail,
        amount: pkg.coin_price,
        type: 'subscription'
      });

      // Transaction
      await supabase.entities.CoinTransaction.create({
        user_email: currentUser.email,
        type: 'spend',
        amount: -pkg.coin_price,
        description: `VIP Subscription: ${pkg.name}`
      });

      toast.success(`Subscribed to ${pkg.name}!`);
      queryClient.invalidateQueries(['active-subscription']);
      loadCurrentUser();
    } catch {
      toast.error('Subscription failed');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">User not found</h1>
          <Link to={createPageUrl('Home')}>
            <Button className="neon-btn-gold text-black">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.email === profileEmail;

  return (
    <div className="min-h-screen">
      {/* Banner */}
      <div className="relative h-64 bg-gradient-to-r from-[#FFD700]/20 via-[#FF1744]/20 to-[#FFD700]/20">
        {profileUser.banner_image && (
          <img src={profileUser.banner_image} alt="Banner" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      </div>

      {/* Profile Info */}
      <div className="max-w-6xl mx-auto px-4 -mt-20 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-black bg-gray-900 overflow-hidden">
              {profileUser.profile_image ? (
                <img src={profileUser.profile_image} alt={profileUser.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#FFD700]/20">
                  <User className="w-16 h-16 text-[#FFD700]" />
                </div>
              )}
            </div>
            {activeSubscription && (
              <div className="absolute -bottom-2 -right-2 p-2 rounded-full bg-[#FFD700] border-2 border-black">
                <Crown className="w-5 h-5 text-black" />
              </div>
            )}
          </div>

          {/* Info & Actions */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-white">
                    {profileUser.channel_name || profileUser.full_name}
                  </h1>
                  {profileUser.is_creator && (
                    <div className="px-3 py-1 rounded-full bg-[#FF1744]/20 border border-[#FF1744]/50">
                      <Star className="w-4 h-4 text-[#FF1744] inline mr-1" />
                      <span className="text-sm text-[#FF1744]">Creator</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-6 text-gray-400 mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span><strong className="text-white">{followerCount}</strong> followers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    <span><strong className="text-white">{followingCount}</strong> following</span>
                  </div>
                </div>
                {profileUser.bio && (
                  <p className="text-gray-300 max-w-2xl mb-4">{profileUser.bio}</p>
                )}
                {/* Social Links */}
                {profileUser.social_links && (
                  <div className="flex gap-3">
                    {profileUser.social_links.twitter && (
                      <a href={profileUser.social_links.twitter} target="_blank" className="text-gray-400 hover:text-[#FFD700]">
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                    {profileUser.social_links.instagram && (
                      <a href={profileUser.social_links.instagram} target="_blank" className="text-gray-400 hover:text-[#FFD700]">
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {profileUser.social_links.youtube && (
                      <a href={profileUser.social_links.youtube} target="_blank" className="text-gray-400 hover:text-[#FFD700]">
                        <Youtube className="w-5 h-5" />
                      </a>
                    )}
                    {profileUser.social_links.website && (
                      <a href={profileUser.social_links.website} target="_blank" className="text-gray-400 hover:text-[#FFD700]">
                        <Globe className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {!isOwnProfile && currentUser && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleFollow}
                    className={isFollowing ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'neon-btn-gold text-black'}
                  >
                    {isFollowing ? (
                      <>
                        <Check className="w-4 h-4 mr-2" /> Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" /> Follow
                      </>
                    )}
                  </Button>
                  {profileUser.allow_messages && (
                    <Button
                      variant="outline"
                      onClick={() => setShowMessageDialog(true)}
                      className="border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700]/10"
                    >
                      <Mail className="w-4 h-4 mr-2" /> Message
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleBlock}
                    className="border-red-500 text-red-500 hover:bg-red-500/10"
                  >
                    <Ban className="w-4 h-4 mr-2" /> {isBlocked ? 'Unblock' : 'Block'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* VIP Packages for Creators */}
        {profileUser.is_creator && !isOwnProfile && !activeSubscription && vipPackages.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold text-white mb-4">VIP Packages</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vipPackages.map(pkg => (
                <div key={pkg.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
                    <div className="flex items-center gap-1 text-[#FFD700]">
                      <Coins className="w-4 h-4" />
                      <span>{pkg.coin_price}</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm mb-4">{pkg.description}</p>
                  <Button onClick={() => handleSubscribe(pkg.id)} className="w-full neon-btn-gold text-black">
                    Subscribe
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Tabs */}
        <Tabs defaultValue="videos" className="mt-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="vip" disabled={!profileUser.is_creator}>VIP Packages</TabsTrigger>
          </TabsList>
          <TabsContent value="videos" className="mt-6">
            {userVideos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userVideos.map(video => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No videos yet</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="vip" className="mt-6">
            {vipPackages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vipPackages.map(pkg => (
                  <div key={pkg.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
                    <p className="text-gray-300 text-sm mb-2">{pkg.description}</p>
                    <div className="flex items-center gap-2 text-[#FFD700]">
                      <Coins className="w-4 h-4" />
                      <span>{pkg.coin_price} coins</span>
                    </div>
                    <p className="text-gray-400 text-sm">{pkg.duration_days} days</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Crown className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No VIP packages available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message to {profileUser.full_name}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Type your message..."
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendMessage} className="neon-btn-gold text-black">
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}