import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Gem, Coins, Home, AlertTriangle, Shield, Hammer, Wrench,
  User, Car, CreditCard, History, ShieldCheck, Gift
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { spendCoins } from '../../lib/coinUtils';
import { useInsurance } from '../../lib/hooks/useInsurance';
import SubscribeButton from '../user/SubscribeButton';

interface House {
  id: string;
  condition: number;
  upgrade_level?: number;
  house_style?: string;
  neighborhood_id?: string;
  owner_user_id: string;
}

interface HouseRaid {
  id: string;
  house_id: string;
  raided_by_user_id: string;
  damage_level: string;
  raided_at: string;
  repaired_at?: string;
  deductible_paid?: number;
}

interface CoinTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description?: string;
  created_at: string;
}

interface UserStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  trollCoins: number;
  trollmonds: number;
  licensePlate?: string | null;
  streamId?: string;
  isSeatUser?: boolean;
}

export default function UserStatsModal({
  isOpen,
  onClose,
  userId,
  username,
  trollCoins,
  trollmonds,
  licensePlate,
  streamId,
  isSeatUser = false
}: UserStatsModalProps) {
  const { user: currentUser, profile: currentProfile } = useAuthStore();
  const { hasHomeownersInsurance, fetchInsurance: fetchUserInsurance } = useInsurance();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const RAID_COST = 100;

  const [loading, setLoading] = useState(true);
  const [house, setHouse] = useState<House | null>(null);
  const [raids, setRaids] = useState<HouseRaid[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [processing, setProcessing] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);

  // Live display balances. These prevent the modal from staying stuck on stale props.
  const [displayTrollCoins, setDisplayTrollCoins] = useState(Number(trollCoins || 0));
  const [displayTrollmonds, setDisplayTrollmonds] = useState(Number(trollmonds || 0));

  const isOwnProfile = currentUser?.id === userId;

  const isStaff =
    currentProfile?.is_admin ||
    currentProfile?.is_troll_officer ||
    currentProfile?.role === 'admin' ||
    currentProfile?.role === 'moderator';

  const isRaided = raids.some((r) => !r.repaired_at);
  const latestRaid = raids.find((r) => !r.repaired_at);

  const hasInsurance = hasHomeownersInsurance();
  const insuranceDeductible = currentProfile?.homeowners_insurance_deductible ?? 25;

  useEffect(() => {
    setDisplayTrollCoins(Number(trollCoins || 0));
  }, [trollCoins]);

  useEffect(() => {
    setDisplayTrollmonds(Number(trollmonds || 0));
  }, [trollmonds]);

  const refreshProfileBalances = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('troll_coins, trollmonds')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[UserStatsModal] Failed to refresh profile balances:', error);
      return;
    }

    if (data) {
      setDisplayTrollCoins(Number(data.troll_coins || 0));
      setDisplayTrollmonds(Number(data.trollmonds || 0));
    }
  }, [userId]);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;

    try {
      setTxLoading(true);

      const { data: txData } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      setTransactions(txData || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setTxLoading(false);
    }
  }, [userId]);

  const fetchSubscription = useCallback(async () => {
    if (!currentUser || !userId) return;

    try {
      setSubLoading(true);

      const { data } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          tier: subscription_tiers(*)
        `)
        .eq('subscriber_id', currentUser.id)
        .eq('broadcaster_id', userId)
        .eq('is_active', true)
        .single();

      setSubscription(data);
    } catch (error) {
      setSubscription(null);
    } finally {
      setSubLoading(false);
    }
  }, [currentUser, userId]);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const { data: houseData } = await supabase
        .from('houses')
        .select('*')
        .eq('owner_user_id', userId)
        .maybeSingle();

      setHouse(houseData);

      if (houseData) {
        const { data: raidsData } = await supabase
          .from('house_raids')
          .select('*')
          .eq('house_id', houseData.id)
          .order('raided_at', { ascending: false })
          .limit(10);

        setRaids(raidsData || []);
      } else {
        setRaids([]);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    fetchData();
    fetchTransactions();
    fetchUserInsurance();
    refreshProfileBalances();

    if (currentUser && userId !== currentUser.id) {
      fetchSubscription();
    }
  }, [
    isOpen,
    userId,
    currentUser,
    fetchData,
    fetchTransactions,
    fetchUserInsurance,
    refreshProfileBalances,
    fetchSubscription
  ]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const handleBroadcastBalanceUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      console.log('Balance update received:', detail);

      const receiverId = detail.receiver_id || detail.receiverId;
      const senderId = detail.sender_id || detail.senderId;
      const amount = Number(detail.amount || detail.coins || detail.value || 0);

      if (!amount || !(receiverId === userId || senderId === userId)) return;

      setDisplayTrollCoins(prev => {
        if (receiverId === userId) return prev + amount;
        if (senderId === userId) return Math.max(0, prev - amount);
        return prev;
      });

      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshProfileBalances();
        fetchTransactions();
      }, 800);
    };

    window.addEventListener(
      'broadcast-balance-update',
      handleBroadcastBalanceUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        'broadcast-balance-update',
        handleBroadcastBalanceUpdate as EventListener
      );
    };
  }, [isOpen, userId, refreshProfileBalances, fetchTransactions]);

  const handleRaid = async () => {
    if (!currentUser || !house) return;

    if (isStaff) {
      toast.error('Staff cannot raid houses');
      return;
    }

    if ((currentProfile?.troll_coins || 0) < RAID_COST) {
      toast.error(`Need ${RAID_COST} Troll Coins to raid`);
      return;
    }

    if (!confirm(`Raid ${username}'s house for ${RAID_COST} TC?`)) return;

    setProcessing(true);

    try {
      const spendResult = await spendCoins(currentUser.id, RAID_COST, {
        type: 'penalty',
        description: `House raid on ${username}'s property`,
        metadata: {
          target_user_id: userId,
          house_id: house.id,
          stream_id: streamId,
          action: 'raid'
        },
        source: 'broadcast'
      });

      if (!spendResult.success) {
        toast.error(spendResult.error || 'Failed to deduct coins');
        return;
      }

      await supabase.from('house_raids').insert({
        house_id: house.id,
        raided_by_user_id: currentUser.id,
        damage_level: 'minor',
        raided_at: new Date().toISOString()
      });

      await supabase.rpc('update_house_condition', {
        house_id: house.id,
        condition_change: -10
      });

      toast.success(`House raided! -${RAID_COST} TC`);

      await Promise.all([fetchData(), fetchTransactions(), refreshProfileBalances()]);

      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', currentUser.id)
        .single();

      if (updatedProfile && currentProfile) {
        useAuthStore.getState().setProfile({
          ...currentProfile,
          troll_coins: updatedProfile.troll_coins
        });
      }
    } catch (error: any) {
      console.error('Raid error:', error);
      toast.error(error.message || 'Raid failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRepair = async () => {
    if (!currentUser || !house || !latestRaid) return;

    const canRepairWithInsurance = (isOwnProfile || isSeatUser) && hasInsurance;
    const actualRepairCost = canRepairWithInsurance ? insuranceDeductible : 200;

    if ((currentProfile?.troll_coins || 0) < actualRepairCost) {
      toast.error(`Need ${actualRepairCost} Troll Coins to repair${canRepairWithInsurance ? ' (deductible)' : ''}`);
      return;
    }

    const confirmMsg = canRepairWithInsurance
      ? `Pay ${actualRepairCost} TC deductible to repair this house?`
      : `Pay ${actualRepairCost} TC to repair this house?`;

    if (!confirm(confirmMsg)) return;

    setProcessing(true);

    try {
      const spendResult = await spendCoins(currentUser.id, actualRepairCost, {
        type: 'penalty',
        description: `House repair${canRepairWithInsurance ? ' (insurance claim)' : ''}`,
        metadata: {
          target_user_id: userId,
          house_id: house.id,
          raid_id: latestRaid.id,
          insurance_used: canRepairWithInsurance,
          deductible_paid: canRepairWithInsurance ? actualRepairCost : 0,
          stream_id: streamId
        },
        source: 'broadcast'
      });

      if (!spendResult.success) {
        toast.error(spendResult.error || 'Failed to deduct coins');
        return;
      }

      await supabase
        .from('house_raids')
        .update({
          repaired_at: new Date().toISOString(),
          deductible_paid: canRepairWithInsurance ? actualRepairCost : 0
        })
        .eq('house_id', house.id)
        .is('repaired_at', null);

      await supabase
        .from('houses')
        .update({ condition: 100 })
        .eq('id', house.id);

      toast.success(`House repaired! -${actualRepairCost} TC`);

      await Promise.all([fetchData(), fetchTransactions(), refreshProfileBalances()]);

      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', currentUser.id)
        .single();

      if (updatedProfile && currentProfile) {
        useAuthStore.getState().setProfile({
          ...currentProfile,
          troll_coins: updatedProfile.troll_coins
        });
      }
    } catch (error: any) {
      console.error('Repair error:', error);
      toast.error(error.message || 'Repair failed');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'gift_sent':
      case 'gift_received':
        return Gift;
      case 'penalty':
        return Hammer;
      case 'refund':
        return CreditCard;
      case 'insurance':
        return Shield;
      default:
        return Coins;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
              {username ? username.charAt(0).toUpperCase() : <User size={24} />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-lg">{username}</h2>

                {!isOwnProfile && currentUser && (
                  <SubscribeButton
                    broadcasterId={userId}
                    broadcasterUsername={username}
                    currentSubscription={subscription}
                    onSubscribe={fetchSubscription}
                    onUnsubscribe={fetchSubscription}
                  />
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Gem className="text-purple-400" />
                  {displayTrollmonds.toLocaleString()}
                </span>

                <span className="flex items-center gap-1">
                  <Coins className="text-yellow-400" />
                  {displayTrollCoins.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* House Section */}
          <div className="p-4 border-b border-white/10">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
              House Status
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : house ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  {/* House Icon */}
                  <div
                    className={`relative w-20 h-20 rounded-xl flex items-center justify-center ${
                      isRaided ? 'bg-red-500/80' : 'bg-blue-500/80'
                    } ${hasInsurance ? 'ring-2 ring-green-400' : ''}`}
                  >
                    <Home className="w-10 h-10 text-white" />

                    {isRaided && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {hasInsurance && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* House Stats */}
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-zinc-500">Condition</span>
                        <p
                          className={`font-bold ${
                            house.condition < 50
                              ? 'text-red-400'
                              : house.condition < 85
                                ? 'text-yellow-400'
                                : 'text-green-400'
                          }`}
                        >
                          {house.condition}%
                        </p>
                      </div>

                      <div>
                        <span className="text-zinc-500">Level</span>
                        <p className="font-bold text-white">{house.upgrade_level || 1}</p>
                      </div>

                      <div>
                        <span className="text-zinc-500">Style</span>
                        <p className="font-bold text-white capitalize">
                          {house.house_style?.replace('_', ' ') || 'Standard'}
                        </p>
                      </div>

                      <div>
                        <span className="text-zinc-500">Neighborhood</span>
                        <p className="font-bold text-white">
                          {house.neighborhood_id?.substring(0, 8) || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {licensePlate && (
                      <div className="mt-2 flex items-center gap-2">
                        <Car size={14} className="text-slate-400" />
                        <span className="font-mono text-xs uppercase tracking-wider text-slate-300 bg-white/5 px-2 py-0.5 rounded">
                          {licensePlate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {(isOwnProfile ? isRaided : true) && (
                  <div className="flex gap-2">
                    {isRaided ? (
                      <button
                        onClick={handleRepair}
                        disabled={processing}
                        className="flex-1 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <Wrench size={18} />
                        {processing
                          ? 'Processing...'
                          : (() => {
                              const canUseInsurance = (isOwnProfile || isSeatUser) && hasInsurance;
                              const repairCost = canUseInsurance ? insuranceDeductible : 200;
                              return `Repair (${repairCost} TC${canUseInsurance ? ' Insured' : ''})`;
                            })()}
                      </button>
                    ) : (
                      !isOwnProfile && (
                        <button
                          onClick={handleRaid}
                          disabled={processing || isStaff}
                          className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                          <Hammer size={18} />
                          {processing ? 'Processing...' : `Raid (${RAID_COST} TC)`}
                        </button>
                      )
                    )}
                  </div>
                )}

                {isOwnProfile && !isRaided && (
                  <div className="text-center py-2 text-zinc-400 text-sm">
                    Your house is in perfect condition
                  </div>
                )}

                {isRaided && (
                  <div className="text-center text-xs text-zinc-400 mt-2">
                    {(() => {
                      const canUseInsurance = (isOwnProfile || isSeatUser) && hasInsurance;
                      const repairCost = canUseInsurance ? insuranceDeductible : 200;
                      return `Repair cost: ${repairCost} TC${canUseInsurance ? ' (insurance deductible)' : ''}`;
                    })()}
                  </div>
                )}

                {isRaided && (isSeatUser || isOwnProfile) && hasInsurance && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-green-400" />
                    <div className="text-sm">
                      <p className="text-green-400 font-medium">Insurance Active</p>
                      <p className="text-zinc-400 text-xs">
                        Deductible: {insuranceDeductible} TC saved {200 - insuranceDeductible} TC
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-400">
                <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No house owned</p>
              </div>
            )}
          </div>

          {/* Transaction History */}
          <div className="p-4">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <History size={16} />
              Recent Transactions
            </h3>

            {txLoading ? (
              <div className="py-8 text-center text-zinc-500 text-sm">
                Loading transactions...
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-sm">
                No transaction history
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const Icon = getTransactionIcon(tx.type);
                  const isPositive = Number(tx.amount || 0) > 0;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}
                        >
                          <Icon
                            size={16}
                            className={isPositive ? 'text-green-400' : 'text-red-400'}
                          />
                        </div>

                        <div>
                          <p className="text-sm font-medium text-white">
                            {tx.description || tx.type}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatDate(tx.created_at)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`font-bold ${
                          isPositive ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {Number(tx.amount || 0).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}