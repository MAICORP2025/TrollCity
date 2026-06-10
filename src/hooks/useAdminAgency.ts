import { useState, useEffect, useCallback } from 'react';
import { agencyService } from '../services/agencyService';
import type {
  AgencyApplication,
  AgencyMember,
  AgencyPointTransaction,
  AgencyAuditLog,
  AgencyReward,
  LeaderboardEntry,
  AgencyMemberRole,
  AgencyRewardType,
  AgencyTier,
} from '../types/agency';

export function useAdminAgencyApplications() {
  const [applications, setApplications] = useState<(AgencyApplication & { username?: string; avatar_url?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getPendingApplications();
      setApplications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const approve = useCallback(async (applicationId: string, notes?: string) => {
    await agencyService.reviewApplication(applicationId, 'approved', notes);
    setApplications(prev => prev.filter(a => a.id !== applicationId));
  }, []);

  const reject = useCallback(async (applicationId: string, reason?: string) => {
    await agencyService.reviewApplication(applicationId, 'rejected', undefined, reason);
    setApplications(prev => prev.filter(a => a.id !== applicationId));
  }, []);

  return { applications, loading, error, refresh: fetchApplications, approve, reject };
}

export function useAdminAgencyMembers() {
  const [members, setMembers] = useState<(AgencyMember & { username?: string; avatar_url?: string; display_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getAllMembers();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const updateRole = useCallback(async (memberId: string, role: AgencyMemberRole) => {
    await agencyService.updateMemberRole(memberId, role);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
  }, []);

  const deactivate = useCallback(async (memberId: string) => {
    await agencyService.deactivateMember(memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }, []);

  return { members, loading, error, refresh: fetchMembers, updateRole, deactivate };
}

export function useAdminAgencyTransactions(userId?: string, limit: number = 50) {
  const [transactions, setTransactions] = useState<AgencyPointTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (uid: string) => {
    if (!uid) return;
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getUserTransactions(uid, limit);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const adjustPoints = useCallback(async (uid: string, points: number, reason: string) => {
    const result = await agencyService.adjustPoints(uid, points, reason);
    await fetchTransactions(uid);
    return result;
  }, [fetchTransactions]);

  return { transactions, loading, error, fetchTransactions, adjustPoints };
}

export function useAdminAgencyLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
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

export function useAdminAgencyAuditLog(limit: number = 100) {
  const [logs, setLogs] = useState<AgencyAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agencyService.getAuditLog(limit);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, loading, error, refresh: fetchLogs };
}

export function useAdminAgencyRewards() {
  const [rewards, setRewards] = useState<AgencyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRewards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { supabase } = await import('../lib/supabase');
      const result = await supabase
        .from('agency_rewards')
        .select('*, user_profiles:user_id(username)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (result.error) throw result.error;
      setRewards(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  const createReward = useCallback(async (data: {
    userId: string;
    rewardType: AgencyRewardType;
    title: string;
    description?: string;
    pointsCost?: number;
    tierRequirement?: AgencyTier;
    coinValue?: number;
  }) => {
    const reward = await agencyService.createReward(data);
    setRewards(prev => [reward, ...prev]);
    return reward;
  }, []);

  const revokeReward = useCallback(async (rewardId: string, reason: string) => {
    await agencyService.revokeReward(rewardId, reason);
    setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, status: 'revoked' as const } : r));
  }, []);

  return { rewards, loading, error, refresh: fetchRewards, createReward, revokeReward };
}
