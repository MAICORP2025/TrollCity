import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { agencyService } from '../services/agencyService';
import type {
  AgencyApplication,
  AgencyMember,
  AgencyPointTransaction,
  AgencyWeeklyStats,
  AgencyReward,
  AgencyTier,
} from '../types/agency';
import { TIER_CONFIG } from '../types/agency';

export function useAgencyApplication() {
  const [application, setApplication] = useState<AgencyApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplication = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getMyApplication();
      setApplication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplication(); }, [fetchApplication]);

  const submit = useCallback(async (data: Parameters<typeof agencyService.submitApplication>[0]) => {
    const result = await agencyService.submitApplication(data);
    setApplication(result);
    return result;
  }, []);

  return { application, loading, error, refresh: fetchApplication, submit };
}

export function useAgencyMember() {
  const [member, setMember] = useState<AgencyMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMember = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getMyMemberRecord();
      setMember(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load member record');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMember(); }, [fetchMember]);

  const tierOrder: AgencyTier[] = ['none', 'bronze', 'silver', 'gold', 'legend'];
  const tierInfo = member ? TIER_CONFIG[member.current_tier] : TIER_CONFIG.none;
  const currentTierIndex = member ? tierOrder.indexOf(member.current_tier) : 0;
  const nextTier = currentTierIndex < tierOrder.length - 1 ? TIER_CONFIG[tierOrder[currentTierIndex + 1]] : TIER_CONFIG.legend;
  const prevThreshold = member && member.current_tier !== 'none' ? TIER_CONFIG[member.current_tier].threshold : 0;
  const nextThreshold = nextTier.threshold;
  const progressPercent = member && member.current_tier !== 'legend'
    ? ((member.total_points - prevThreshold) / (nextThreshold - prevThreshold)) * 100
    : member?.current_tier === 'legend' ? 100 : 0;

  return {
    member, loading, error, refresh: fetchMember,
    tierInfo, nextTier, progressPercent,
    pointsToNext: member ? Math.max(nextThreshold - member.total_points, 0) : nextThreshold,
  };
}

export function useAgencyTransactions(limit: number = 50) {
  const [transactions, setTransactions] = useState<AgencyPointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getMyTransactions(limit);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const weeklyBreakdown = transactions.reduce((acc, tx) => {
    const week = tx.week_start || 'unknown';
    if (!acc[week]) acc[week] = { stream_hours: 0, platform_share: 0, verified_viewer: 0, user_registration: 0, other: 0 };
    if (tx.transaction_type === 'stream_hours') acc[week].stream_hours += tx.points;
    else if (tx.transaction_type === 'platform_share') acc[week].platform_share += tx.points;
    else if (tx.transaction_type === 'verified_viewer') acc[week].verified_viewer += tx.points;
    else if (tx.transaction_type === 'user_registration') acc[week].user_registration += tx.points;
    else acc[week].other += tx.points;
    return acc;
  }, {} as Record<string, { stream_hours: number; platform_share: number; verified_viewer: number; user_registration: number; other: number }>);

  return { transactions, loading, error, refresh: fetchTransactions, weeklyBreakdown };
}

export function useAgencyWeeklyStats(limit: number = 12) {
  const [stats, setStats] = useState<AgencyWeeklyStats[]>([]);
  const [currentWeek, setCurrentWeek] = useState<AgencyWeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [history, current] = await Promise.allSettled([
        agencyService.getMyWeeklyStats(limit),
        agencyService.getCurrentWeekStats(),
      ]);
      if (history.status === 'fulfilled') setStats(history.value);
      if (current.status === 'fulfilled') setCurrentWeek(current.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weekly stats');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, currentWeek, loading, error, refresh: fetchStats };
}

export function useAgencyRewards() {
  const [rewards, setRewards] = useState<AgencyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRewards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getMyRewards();
      setRewards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  const claimReward = useCallback(async (rewardId: string) => {
    const updated = await agencyService.claimReward(rewardId);
    setRewards(prev => prev.map(r => r.id === rewardId ? updated : r));
    return updated;
  }, []);

  const availableRewards = rewards.filter(r => r.status === 'available');
  const claimedRewards = rewards.filter(r => r.status === 'claimed');

  return { rewards, availableRewards, claimedRewards, loading, error, refresh: fetchRewards, claimReward };
}

export function useAgencyLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  return { leaderboard, loading, error, refresh: fetchLeaderboard };
}

export function useAgencyRealtime() {
  useEffect(() => {
    const channel = supabase.channel('agency-global')
      .on('postgres_changes', { schema: 'public', table: 'agency_point_transactions', event: 'INSERT' }, () => {})
      .on('postgres_changes', { schema: 'public', table: 'agency_members', event: 'UPDATE' }, () => {})
      .on('postgres_changes', { schema: 'public', table: 'agency_rewards', event: '*' }, () => {})
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}
