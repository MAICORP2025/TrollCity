import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Gift, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface Reward {
  id: string;
  title: string;
  description: string;
  rarity: string;
  reward_type: string;
  coin_value: number;
  duration_hours: number;
}

interface Spin {
  id: string;
  reward: Reward;
  created_at: string;
}

const REWARDS: Reward[] = [
  {
    id: '1',
    title: 'Free Movie Pass',
    description: 'Watch any movie free for 24 hours',
    rarity: 'rare',
    reward_type: 'unlock_content',
    coin_value: 500,
    duration_hours: 24,
  },
  {
    id: '2',
    title: '100 Bonus Coins',
    description: 'Get 100 extra coins',
    rarity: 'common',
    reward_type: 'coins',
    coin_value: 100,
    duration_hours: 0,
  },
  {
    id: '3',
    title: '250 Bonus Coins',
    description: 'Get 250 extra coins',
    rarity: 'uncommon',
    reward_type: 'coins',
    coin_value: 250,
    duration_hours: 0,
  },
  {
    id: '4',
    title: 'VIP Status',
    description: 'VIP status for 7 days',
    rarity: 'rare',
    reward_type: 'vip_status',
    coin_value: 1000,
    duration_hours: 168,
  },
  {
    id: '5',
    title: '50 Bonus Coins',
    description: 'Get 50 extra coins',
    rarity: 'common',
    reward_type: 'coins',
    coin_value: 50,
    duration_hours: 0,
  },
  {
    id: '6',
    title: 'Double XP Pass',
    description: 'Double XP for 24 hours',
    rarity: 'rare',
    reward_type: 'double_xp',
    coin_value: 500,
    duration_hours: 24,
  },
  {
    id: '7',
    title: '500 Bonus Coins',
    description: 'Get 500 extra coins',
    rarity: 'epic',
    reward_type: 'coins',
    coin_value: 500,
    duration_hours: 0,
  },
  {
    id: '8',
    title: '1000 Bonus Coins',
    description: 'Get 1000 extra coins',
    rarity: 'legendary',
    reward_type: 'coins',
    coin_value: 1000,
    duration_hours: 0,
  },
];

const RARITY_COLORS = {
  common: 'from-gray-400 to-gray-500',
  uncommon: 'from-green-400 to-green-500',
  rare: 'from-blue-400 to-blue-500',
  epic: 'from-purple-400 to-purple-500',
  legendary: 'from-yellow-400 to-yellow-600',
};

export default function MAIWheel() {
  const { user } = useAuth();
  const [spins, setSpins] = useState<Spin[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [spinHistory, setSpinHistory] = useState<Spin[]>([]);
  const [dailySpinsLeft, setDailySpinsLeft] = useState(1);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      setDailySpinsLeft(1);
    }
  }, [user]);

  const handleSpin = async () => {
    if (dailySpinsLeft <= 0) {
      toast.error('No more daily spins available. Come back tomorrow!');
      return;
    }

    setIsSpinning(true);
    const randomIndex = Math.floor(Math.random() * REWARDS.length);
    const selectedReward = REWARDS[randomIndex];
    setSelectedReward(selectedReward);

    setTimeout(() => {
      setIsSpinning(false);
      setDailySpinsLeft(0);
      toast.success(`You won: ${selectedReward.title}!`);
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${randomIndex * 45}deg)`;
      }
    }, 3000);
  };

  const handlePremiumSpin = async () => {
    if (!user || user.coin_balance < 100) {
      toast.error('Need 100 coins for a premium spin');
      return;
    }

    toast.success('Premium spin feature coming soon!');
  };

  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-20">
        <div className="container-wide max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-black text-gradient-gold-red mb-3">
              🎡 MAI Wheel
            </h1>
            <p className="text-gray-400 text-lg">
              Spin daily to win coins, perks, and exclusive rewards!
            </p>
          </div>

          {/* Spin Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="card-glow rounded-lg p-4 border border-white/10 text-center">
              <p className="text-gray-400 text-sm mb-1">Daily Spins Left</p>
              <p className="text-2xl font-bold text-yellow-400">{dailySpinsLeft}</p>
            </div>
            <div className="card-glow rounded-lg p-4 border border-white/10 text-center">
              <p className="text-gray-400 text-sm mb-1">Your Coins</p>
              <p className="text-2xl font-bold text-yellow-400">{user?.coin_balance || 0}</p>
            </div>
            <div className="card-glow rounded-lg p-4 border border-white/10 text-center">
              <p className="text-gray-400 text-sm mb-1">Total Spins</p>
              <p className="text-2xl font-bold text-yellow-400">
                {spinHistory.length + 1}
              </p>
            </div>
          </div>

          {/* Wheel Container */}
          <div className="card-glow rounded-lg p-8 border border-white/10 mb-8">
            <div className="flex flex-col items-center">
              {/* Wheel */}
              <div className="relative w-64 h-64 mb-8">
                {/* Pointer */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-10 text-yellow-400">
                  <svg
                    className="w-8 h-8"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 0l3 8h8l-6.5 5 2.5 7.5L10 15.5l-6.5 4.5L6 12.5 0 8h8l3-8z" />
                  </svg>
                </div>

                {/* Wheel */}
                <div
                  ref={wheelRef}
                  className="absolute inset-0 rounded-full transition-transform duration-3000"
                  style={{
                    background: `conic-gradient(${REWARDS.map(
                      (reward, i) => {
                        const [from, to] = RARITY_COLORS[
                          reward.rarity as keyof typeof RARITY_COLORS
                        ].split(' ');
                        return `#FFD700 ${(i * 360) / REWARDS.length}deg ${
                          ((i + 1) * 360) / REWARDS.length
                        }deg`;
                      }
                    ).join(',')})`,
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                  }}
                >
                  {REWARDS.map((reward, i) => {
                    const angle = (i * 360) / REWARDS.length + 360 / REWARDS.length / 2;
                    return (
                      <div
                        key={reward.id}
                        className="absolute w-full h-full flex items-center justify-center"
                        style={{
                          transform: `rotate(${angle}deg)`,
                        }}
                      >
                        <div
                          className="text-xs font-bold text-white text-center transform -rotate-12"
                          style={{
                            position: 'absolute',
                            top: '10px',
                            width: '50px',
                          }}
                        >
                          {reward.coin_value > 0 ? `+${reward.coin_value}` : reward.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <Button
                  onClick={handleSpin}
                  disabled={isSpinning || dailySpinsLeft <= 0}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-12 text-lg"
                >
                  {isSpinning ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Spinning...
                    </>
                  ) : dailySpinsLeft > 0 ? (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Daily Spin (Free)
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-5 w-5" />
                      No Spins Left
                    </>
                  )}
                </Button>
                <Button
                  onClick={handlePremiumSpin}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold h-12 text-lg flex items-center justify-center"
                >
                  <Gift className="mr-2 h-5 w-5" />
                  Premium Spin (100 coins)
                </Button>
              </div>
            </div>
          </div>

          {/* Selected Reward */}
          {selectedReward && (
            <div className="card-glow rounded-lg p-6 border border-yellow-400/50 mb-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-2">
                  🎉 You Won!
                </h3>
                <p className="text-3xl font-black text-yellow-400 mb-2">
                  {selectedReward.title}
                </p>
                <p className="text-gray-400 mb-4">{selectedReward.description}</p>
                {selectedReward.coin_value > 0 && (
                  <div className="text-lg font-semibold text-green-400">
                    +{selectedReward.coin_value} coins added to your account!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rewards Info */}
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Available Rewards</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REWARDS.map((reward) => (
                <div
                  key={reward.id}
                  className={`p-4 rounded-lg bg-gradient-to-r ${RARITY_COLORS[
                    reward.rarity as keyof typeof RARITY_COLORS
                  ]?.split(' ').join('/') || 'from-gray-400 to-gray-500'} bg-opacity-20 border border-white/20`}
                >
                  <p className="font-semibold text-white">{reward.title}</p>
                  <p className="text-xs text-gray-300">{reward.description}</p>
                  <div className="flex gap-2 mt-2 text-xs">
                    <span className="px-2 py-1 bg-white/20 rounded capitalize text-white">
                      {reward.rarity}
                    </span>
                    {reward.coin_value > 0 && (
                      <span className="px-2 py-1 bg-yellow-400/20 rounded text-yellow-300">
                        +{reward.coin_value}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
