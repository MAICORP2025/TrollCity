import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabaseClient as supabase} from '../lib/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser } from '../services/authService';
import {
  Play, Coins, Eye, Heart, Share2, Flag, User,
  ChevronLeft, Lock, ThumbsUp, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import VideoCard from '../components/video/VideoCard';

export default function Watch() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('id');
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch {
      setUser(null);
    }
  };

  const { data: video, isLoading } = useQuery({
    queryKey: ['video', videoId],
    queryFn: () => supabase.entities.Video.filter({ id: videoId }),
    select: (data) => data[0],
    enabled: !!videoId,
  });

  const { data: unlockedContent = [] } = useQuery({
    queryKey: ['unlocked', videoId, user?.email],
    queryFn: () => supabase.entities.UnlockedContent.filter({
      user_email: user.email,
      video_id: videoId
    }),
    enabled: !!user?.email && !!videoId,
  });

  const { data: relatedVideos = [] } = useQuery({
    queryKey: ['related-videos', video?.category],
    queryFn: () => supabase.entities.Video.filter(
      { status: 'approved', category: video.category },
      '-views',
      8
    ).then(videos => videos.filter(v => v.id !== videoId)),
    enabled: !!video?.category,
  });

  useEffect(() => {
    if (video) {
      if (!video.is_premium) {
        setHasAccess(true);
      } else if (unlockedContent.length > 0) {
        setHasAccess(true);
      } else if (user?.email === video.creator_email) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    }
  }, [video, unlockedContent, user]);

  // Increment view count
  useEffect(() => {
    if (video && hasAccess) {
      supabase.entities.Video.update(video.id, { views: (video.views || 0) + 1 });
    }
  }, [video, hasAccess]);

  const handleUnlock = async () => {
    if (!user) {
      toast.error('Please sign in to unlock content');
      supabase.auth.redirectToLogin();
      return;
    }

    if ((user.coin_balance || 0) < video.coin_price) {
      toast.error('Not enough MAI Coins. Visit the Coin Store to purchase more.');
      return;
    }

    setIsUnlocking(true);

    try {
      // Deduct coins from user
      await supabase.auth.updateMe({
        coin_balance: (user.coin_balance || 0) - video.coin_price
      });

      // Record unlock
      await supabase.entities.UnlockedContent.create({
        user_email: user.email,
        video_id: video.id,
        coins_paid: video.coin_price
      });

      // Record transaction
      await supabase.entities.CoinTransaction.create({
        user_email: user.email,
        type: 'spend',
        amount: -video.coin_price,
        description: `Unlocked: ${video.title}`,
        video_id: video.id,
      });

      toast.success('Content unlocked successfully!');
      loadUser();
      queryClient.invalidateQueries(['unlocked', videoId, user.email]);
    } catch {
      toast.error('Unlock failed. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="aspect-video rounded-xl bg-gray-800/50 animate-pulse mb-8" />
          <div className="h-8 bg-gray-800/50 rounded animate-pulse mb-4" />
          <div className="h-4 bg-gray-800/50 rounded animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Video not found</h1>
          <Link to="/" className="text-[#FFD700] hover:underline">Return to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6">
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Video */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <div className="aspect-video rounded-xl overflow-hidden mb-6 card-glow">
              {hasAccess ? (
                <video
                  controls
                  className="w-full h-full"
                  poster={video.thumbnail_url}
                >
                  <source src={video.video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center relative">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-50"
                  />
                  <div className="relative z-10 text-center">
                    <Lock className="w-16 h-16 text-[#FFD700] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Premium Content</h3>
                    <p className="text-gray-400 mb-6">Unlock this video with MAI Coins</p>
                    <div className="flex items-center justify-center gap-2 mb-6">
                      <Coins className="w-5 h-5 text-[#FFD700]" />
                      <span className="text-[#FFD700] font-bold text-lg">{video.coin_price} Coins</span>
                    </div>
                    <button
                      onClick={handleUnlock}
                      disabled={isUnlocking}
                      className="neon-btn-gold text-black px-8 py-3 rounded-lg font-semibold"
                    >
                      {isUnlocking ? 'Unlocking...' : `Unlock for ${video.coin_price} Coins`}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">{video.title}</h1>
              <p className="text-gray-400 mb-4">{video.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {video.views || 0} views
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {video.created_at ? new Date(video.created_at).toLocaleDateString() : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
                    <Heart className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
                    <Flag className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Creator Info */}
            <div className="card-glow p-4 rounded-lg mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#FFD700] flex items-center justify-center">
                  <User className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{video.creator_name || 'Creator'}</h3>
                  <p className="text-sm text-gray-400">Content Creator</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold text-white mb-4">Related Videos</h3>
            <div className="space-y-4">
              {relatedVideos.map((relatedVideo) => (
                <VideoCard key={relatedVideo.id} video={relatedVideo} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};