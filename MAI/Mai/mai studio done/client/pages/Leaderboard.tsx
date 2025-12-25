import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { fetchTopCreators, Profile } from '@/lib/supabaseClient';
import { formatNumber } from '@/utils/index';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Award, Zap } from 'lucide-react';

export default function Leaderboard() {
  const [creators, setCreators] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCreators();
  }, []);

  const loadCreators = async () => {
    try {
      setIsLoading(true);
      const data = await fetchTopCreators(50);
      setCreators(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getVIPBadge = (vipStatus?: string) => {
    if (!vipStatus || vipStatus === 'none') return null;
    const badges: Record<string, { bg: string; text: string; icon: string }> = {
      platinum: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '⭐' },
      gold: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '✨' },
      silver: { bg: 'bg-gray-400/20', text: 'text-gray-300', icon: '◆' },
      bronze: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '●' },
    };
    const badge = badges[vipStatus];
    return badge ? (
      <span className={`text-xs font-semibold px-2 py-1 rounded ${badge.bg} ${badge.text}`}>
        {badge.icon} {vipStatus.toUpperCase()}
      </span>
    ) : null;
  };

  return (
    <Layout>
      <section className="section-padding bg-gradient-to-b from-black via-slate-900/20 to-black">
        <div className="container-wide">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Trophy className="text-yellow-400" size={36} />
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Leaderboard
              </h1>
            </div>
            <p className="text-gray-400 text-lg">
              Top creators and earners on MAI Studios
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-12 justify-center">
            {['Earnings', 'Followers', 'Active'].map((tab) => (
              <button
                key={tab}
                className="px-6 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Leaderboard Table */}
          <div className="card-glow rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-white/10">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="p-6 flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            ) : creators.length > 0 ? (
              <div className="divide-y divide-white/10">
                {creators.map((creator, index) => {
                  const medal = getMedalIcon(index + 1);
                  return (
                    <div
                      key={creator.id}
                      className={`p-6 flex items-center gap-4 hover:bg-white/5 transition ${
                        index < 3 ? 'bg-white/5' : ''
                      }`}
                    >
                      {/* Rank */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-red-500 flex items-center justify-center flex-shrink-0">
                        {medal ? (
                          <span className="text-xl">{medal}</span>
                        ) : (
                          <span className="text-white font-bold">
                            #{index + 1}
                          </span>
                        )}
                      </div>

                      {/* Creator Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-semibold">
                            {creator.username}
                          </h3>
                          {getVIPBadge(creator.vip_status)}
                        </div>
                        <p className="text-gray-400 text-sm">
                          {formatNumber(creator.followers_count)} followers
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1 justify-end">
                          <Zap className="text-yellow-400" size={16} />
                          <span className="text-white font-semibold">
                            {formatNumber(creator.coin_balance)}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs">
                          ${formatNumber(creator.total_earnings)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-400 text-lg">
                  No creators on the leaderboard yet
                </p>
              </div>
            )}
          </div>

          {/* How it Works */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: '1',
                title: 'Upload Content',
                desc: 'Share your best shorts, movies, and creative content',
              },
              {
                num: '2',
                title: 'Get Coins',
                desc: 'Earn MAI Coins when users watch and like your content',
              },
              {
                num: '3',
                title: 'Climb the Ranks',
                desc: 'Top earners get featured and unlock exclusive opportunities',
              },
            ].map((step, i) => (
              <div key={i} className="card-glow rounded-xl p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-400 to-red-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">{step.num}</span>
                </div>
                <h3 className="text-white font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
