import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Coins, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Creator {
  id: string;
  user_id: string;
  creator_name: string;
}

interface CreatorFam {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  coin_cost_monthly: number;
  max_members: number | null;
  current_members: number;
  perks_included: Record<string, any>;
  active: boolean;
  created_at: string;
  creators?: Creator;
}

export default function FamShop() {
  const { user } = useAuth();
  const [allFams, setAllFams] = useState<CreatorFam[]>([]);
  const [userFams, setUserFams] = useState<CreatorFam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchFams();
    }
  }, [user]);

  const fetchFams = async () => {
    setIsLoading(true);
    try {
      const userFamsResponse = await fetch('/api/user/fams');
      if (userFamsResponse.ok) {
        const userFamsData = await userFamsResponse.json();
        setUserFams(userFamsData.fams || []);
      }

      const allCreators = await fetch('/api/admin/stats').catch(() => null);

      setAllFams([
        {
          id: '1',
          creator_id: '1',
          name: 'Premium Community',
          description: 'Get exclusive content and early access',
          coin_cost_monthly: 500,
          max_members: 100,
          current_members: 45,
          perks_included: { exclusive_content: true, early_access: true },
          active: true,
          created_at: new Date().toISOString(),
          creators: { id: '1', user_id: '1', creator_name: 'Sample Creator' },
        },
        {
          id: '2',
          creator_id: '2',
          name: 'VIP Circle',
          description: 'Join our exclusive VIP circle with special perks',
          coin_cost_monthly: 1000,
          max_members: 50,
          current_members: 30,
          perks_included: { exclusive_content: true, early_access: true, custom_shoutout: true },
          active: true,
          created_at: new Date().toISOString(),
          creators: { id: '2', user_id: '2', creator_name: 'Another Creator' },
        },
      ]);
    } catch (error) {
      console.error('Failed to load fams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinFam = async (famId: string) => {
    if (!user || user.coin_balance < 100) {
      toast.error('Need enough coins to join this fam');
      return;
    }

    setIsJoining(famId);
    try {
      const response = await fetch('/api/fams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ famId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join fam');
      }

      toast.success('Successfully joined fam!');
      fetchFams();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to join fam');
    } finally {
      setIsJoining(null);
    }
  };

  const handleLeaveFam = async (famId: string) => {
    if (!window.confirm('Are you sure you want to leave this fam?')) return;

    try {
      const response = await fetch('/api/fams/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ famId }),
      });

      if (!response.ok) throw new Error('Failed to leave fam');

      toast.success('Left fam successfully');
      fetchFams();
    } catch (error) {
      toast.error('Failed to leave fam');
    }
  };

  const isMember = (famId: string) => userFams.some((f) => f.id === famId);

  const filteredFams = allFams.filter((fam) =>
    fam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fam.creators?.creator_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white">Loading fams...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-20">
        <div className="container-wide max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-black text-gradient-gold-red mb-3">
              Creator Fams
            </h1>
            <p className="text-gray-400">
              Join creator fan clubs to get exclusive content and connect with like-minded fans
            </p>
          </div>

          {/* User Stats */}
          {user && userFams.length > 0 && (
            <div className="card-glow rounded-lg p-6 border border-white/10 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Your Fams</p>
                  <p className="text-2xl font-bold text-yellow-400">{userFams.length} fams</p>
                </div>
                <Users className="text-yellow-400" size={32} />
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <Input
                placeholder="Search fams or creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/10 border border-white/20 text-white text-lg h-11"
              />
            </div>
          </div>

          {/* Fams Grid */}
          {filteredFams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredFams.map((fam) => {
                const isMem = isMember(fam.id);
                const isAtCapacity =
                  fam.max_members && fam.current_members >= fam.max_members;

                return (
                  <div
                    key={fam.id}
                    className="card-glow rounded-lg overflow-hidden border border-white/10 flex flex-col"
                  >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-yellow-400/10 to-red-500/10 p-4 border-b border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-bold text-white flex-1">
                          {fam.name}
                        </h3>
                        {isMem && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded">
                            Member
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">
                        by {fam.creators?.creator_name || 'Unknown'}
                      </p>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4">
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {fam.description}
                      </p>

                      {/* Stats */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Members</span>
                          <span className="text-white font-semibold">
                            {fam.current_members}
                            {fam.max_members ? `/${fam.max_members}` : '+'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Cost/Month</span>
                          <div className="flex items-center gap-1 text-yellow-400 font-semibold">
                            <Coins size={16} />
                            {fam.coin_cost_monthly}
                          </div>
                        </div>
                      </div>

                      {/* Perks */}
                      {Object.keys(fam.perks_included || {}).length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-400 mb-2">Perks:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.keys(fam.perks_included).map((perk) => (
                              <span
                                key={perk}
                                className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300 capitalize"
                              >
                                {perk.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="p-4 border-t border-white/10">
                      {isMem ? (
                        <Button
                          onClick={() => handleLeaveFam(fam.id)}
                          className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold"
                        >
                          Leave Fam
                        </Button>
                      ) : isAtCapacity ? (
                        <Button
                          disabled
                          className="w-full bg-gray-500/20 text-gray-400"
                        >
                          <AlertCircle className="mr-2" size={16} />
                          At Capacity
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleJoinFam(fam.id)}
                          disabled={isJoining === fam.id}
                          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                        >
                          {isJoining === fam.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Joining...
                            </>
                          ) : (
                            <>
                              <Coins className="mr-2" size={16} />
                              Join for {fam.coin_cost_monthly}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white/5 rounded-lg border border-white/10">
              <Users className="mx-auto mb-3 text-gray-400" size={32} />
              <p className="text-gray-400">
                {searchQuery ? 'No fams found matching your search' : 'No fams available yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
