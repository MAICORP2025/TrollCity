import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import { useQuery } from '@tanstack/react-query';
import { 
  Trophy, TrendingUp, Coins, Crown, Medal, 
  Star, User, Flame, Heart, Film
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Leaderboard() {

  // Top Supporters (by total coins given)
  const { data: topSupporters = [] } = useQuery({
    queryKey: ['top-supporters'],
    queryFn: async () => {
      const supports = await supabase.entities.FanSupport.list('-created_date', 1000);
      const supportMap = new Map();
      
      supports.forEach(support => {
        const current = supportMap.get(support.fan_email) || { email: support.fan_email, total: 0 };
        current.total += support.amount;
        supportMap.set(support.fan_email, current);
      });
      
      const users = await supabase.entities.User.list();
      const result = Array.from(supportMap.values())
        .map(s => ({
          ...s,
          user: users.find(u => u.email === s.email)
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 50);
      
      return result;
    },
  });

  // Top Creators (by coins earned)
  const { data: topCreators = [] } = useQuery({
    queryKey: ['top-creators'],
    queryFn: async () => {
      const users = await supabase.entities.User.filter({ is_creator: true });
      return users
        .filter(u => u.total_earned_coins > 0)
        .sort((a, b) => (b.total_earned_coins || 0) - (a.total_earned_coins || 0))
        .slice(0, 50);
    },
  });

  // Top Videos (by views)
  const { data: topVideos = [] } = useQuery({
    queryKey: ['top-videos'],
    queryFn: async () => {
      const videos = await supabase.entities.Video.filter({ status: 'approved' }, '-views', 50);
      return videos;
    },
  });

  // Most Followed
  const { data: mostFollowed = [] } = useQuery({
    queryKey: ['most-followed'],
    queryFn: async () => {
      const follows = await supabase.entities.Follower.list();
      const followMap = new Map();
      
      follows.forEach(follow => {
        const current = followMap.get(follow.following_email) || 0;
        followMap.set(follow.following_email, current + 1);
      });
      
      const users = await supabase.entities.User.list();
      const result = Array.from(followMap.entries())
        .map(([email, count]) => ({
          email,
          count,
          user: users.find(u => u.email === email)
        }))
        .filter(item => item.user)
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
      
      return result;
    },
  });

  const getRankIcon = (rank) => {
    switch(rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-gray-500 font-bold">{rank}</span>;
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-6">
            <Trophy className="w-4 h-4 text-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium">Hall of Fame</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            <span className="neon-gold">Leaderboard</span>
          </h1>
          <p className="text-gray-400">Top performers on MAI Studios</p>
        </div>

        <Tabs defaultValue="supporters" className="w-full">
          <TabsList className="w-full bg-gray-900/50 border border-gray-800 p-1 mb-8">
            <TabsTrigger value="supporters" className="flex-1 data-[state=active]:bg-[#FFD700]/20 data-[state=active]:text-[#FFD700]">
              <Coins className="w-4 h-4 mr-2" />
              Top Supporters
            </TabsTrigger>
            <TabsTrigger value="creators" className="flex-1 data-[state=active]:bg-[#FFD700]/20 data-[state=active]:text-[#FFD700]">
              <Star className="w-4 h-4 mr-2" />
              Top Creators
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex-1 data-[state=active]:bg-[#FFD700]/20 data-[state=active]:text-[#FFD700]">
              <Flame className="w-4 h-4 mr-2" />
              Trending Videos
            </TabsTrigger>
            <TabsTrigger value="popular" className="flex-1 data-[state=active]:bg-[#FFD700]/20 data-[state=active]:text-[#FFD700]">
              <Heart className="w-4 h-4 mr-2" />
              Most Followed
            </TabsTrigger>
          </TabsList>

          {/* Top Supporters */}
          <TabsContent value="supporters">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/30 overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#FFD700]" />
                  Top Supporters by Coins Given
                </h3>
                <p className="text-sm text-gray-400 mt-1">Users who support creators the most</p>
              </div>
              <div className="divide-y divide-gray-800">
                {topSupporters.map((supporter, index) => (
                  <div key={supporter.email} className="p-4 flex items-center justify-between hover:bg-gray-800/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 flex items-center justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                      <div className="w-12 h-12 rounded-full bg-[#FFD700]/20 flex items-center justify-center">
                        {supporter.user?.profile_image ? (
                          <img src={supporter.user.profile_image} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-[#FFD700]" />
                        )}
                      </div>
                      <div>
                        <Link 
                          to={createPageUrl(`UserProfile?user=${supporter.email}`)}
                          className="font-medium text-white hover:text-[#FFD700]"
                        >
                          {supporter.user?.full_name || supporter.email.split('@')[0]}
                        </Link>
                        <p className="text-sm text-gray-500">{supporter.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#FFD700] font-bold text-lg">{supporter.total.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">coins given</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Top Creators */}
          <TabsContent value="creators">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/30 overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-[#FF1744]" />
                  Top Creators by Earnings
                </h3>
                <p className="text-sm text-gray-400 mt-1">Most successful content creators</p>
              </div>
              <div className="divide-y divide-gray-800">
                {topCreators.map((creator, index) => (
                  <div key={creator.email} className="p-4 flex items-center justify-between hover:bg-gray-800/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 flex items-center justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                      <div className="w-12 h-12 rounded-full bg-[#FF1744]/20 flex items-center justify-center relative">
                        {creator.profile_image ? (
                          <img src={creator.profile_image} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-[#FF1744]" />
                        )}
                        <Crown className="w-4 h-4 text-[#FFD700] absolute -top-1 -right-1" />
                      </div>
                      <div>
                        <Link 
                          to={createPageUrl(`UserProfile?user=${creator.email}`)}
                          className="font-medium text-white hover:text-[#FFD700] flex items-center gap-2"
                        >
                          {creator.channel_name || creator.full_name}
                          <Star className="w-4 h-4 text-[#FF1744]" />
                        </Link>
                        <p className="text-sm text-gray-500">{creator.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#FFD700] font-bold text-lg">{(creator.total_earned_coins || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">coins earned</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Top Videos */}
          <TabsContent value="videos">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/30 overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#FF1744]" />
                  Trending Videos
                </h3>
                <p className="text-sm text-gray-400 mt-1">Most viewed content</p>
              </div>
              <div className="divide-y divide-gray-800">
                {topVideos.map((video, index) => (
                  <Link
                    key={video.id}
                    to={createPageUrl(`Watch?id=${video.id}`)}
                    className="p-4 flex items-center gap-4 hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="w-12 flex items-center justify-center flex-shrink-0">
                      {getRankIcon(index + 1)}
                    </div>
                    <div className="w-32 aspect-video rounded-lg overflow-hidden flex-shrink-0">
                      <img 
                        src={video.thumbnail_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400'}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white line-clamp-1">{video.title}</h4>
                      <p className="text-sm text-gray-500">{video.creator_name}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Film className="w-3 h-3" /> {video.views?.toLocaleString()} views
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" /> {video.likes?.toLocaleString()} likes
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Most Followed */}
          <TabsContent value="popular">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/30 overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-500" />
                  Most Followed Users
                </h3>
                <p className="text-sm text-gray-400 mt-1">Popular community members</p>
              </div>
              <div className="divide-y divide-gray-800">
                {mostFollowed.map((item, index) => (
                  <div key={item.email} className="p-4 flex items-center justify-between hover:bg-gray-800/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 flex items-center justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                      <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center">
                        {item.user?.profile_image ? (
                          <img src={item.user.profile_image} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-pink-500" />
                        )}
                      </div>
                      <div>
                        <Link 
                          to={createPageUrl(`UserProfile?user=${item.email}`)}
                          className="font-medium text-white hover:text-[#FFD700] flex items-center gap-2"
                        >
                          {item.user?.channel_name || item.user?.full_name || item.email.split('@')[0]}
                          {item.user?.is_creator && <Star className="w-4 h-4 text-[#FF1744]" />}
                        </Link>
                        <p className="text-sm text-gray-500">{item.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-pink-500 font-bold text-lg">{item.count.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">followers</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}