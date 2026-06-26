import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { isPrideMonth, getPrideWeek } from '@/lib/prideMonth';

export interface WeeklyPrideChallenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  xp_reward: number;
  target_value: number;
  progress_type: string;
  action_type: string;
  icon: string;
  sort_order: number;
  week_number: number;
  ui_color: string;
  starts_at: string;
  ends_at: string | null;
  // Progress fields
  progress_value: number;
  completion_percentage: number;
  is_completed: boolean;
  completed_at: string | null;
}

export interface UsePrideWeeklyChallengesReturn {
  challenges: WeeklyPrideChallenge[];
  loading: boolean;
  currentWeek: number;
  totalWeeks: number;
  completedCount: number;
  totalCount: number;
  totalXpEarned: number;
  totalXpAvailable: number;
  isPrideActive: boolean;
  refetch: () => Promise<void>;
}

export function usePrideWeeklyChallenges(): UsePrideWeeklyChallengesReturn {
  const { user } = useAuthStore();
  const [allChallenges, setAllChallenges] = useState<WeeklyPrideChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const isPrideActive = isPrideMonth();
  const currentWeek = isPrideActive ? getPrideWeek() : 0;

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      // Only fetch weekly challenges during Pride Month
      if (!isPrideMonth()) {
        setAllChallenges([]);
        setLoading(false);
        return;
      }

      // Get all weekly challenges (week_number > 0) that have started
      const now = new Date().toISOString();
      const { data: challengeData, error: challengeError } = await supabase
        .from('pride_challenges')
        .select('*')
        .gt('week_number', 0)
        .eq('is_active', true)
        .lte('starts_at', now)
        .order('sort_order', { ascending: true });

      if (challengeError) throw challengeError;

      if (!user?.id) {
        const noProgress = (challengeData || []).map((c) => ({
          ...c,
          progress_value: 0,
          completion_percentage: 0,
          is_completed: false,
          completed_at: null,
        }));
        setAllChallenges(noProgress);
        setLoading(false);
        return;
      }

      const { data: progressData } = await supabase
        .from('pride_user_progress')
        .select('*')
        .eq('user_id', user.id);

      const progressMap = new Map(
        (progressData || []).map((p) => [p.challenge_id, p])
      );

      const merged: WeeklyPrideChallenge[] = (challengeData || []).map((c) => {
        const p = progressMap.get(c.id);
        return {
          ...c,
          progress_value: p?.progress_value || 0,
          completion_percentage: p?.completion_percentage || 0,
          is_completed: p?.is_completed || false,
          completed_at: p?.completed_at || null,
        };
      });

      setAllChallenges(merged);
    } catch (err) {
      console.error('[usePrideWeeklyChallenges] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Realtime subscription for progress updates
  useEffect(() => {
    if (!user?.id || !isPrideActive) return;

    const channel = supabase
      .channel(`pride-weekly-progress-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pride_user_progress',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchChallenges();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, fetchChallenges, isPrideActive]);

  // Filter to only show challenges up to the current week
  const challenges = useMemo(
    () => allChallenges.filter((c) => c.week_number <= currentWeek),
    [allChallenges, currentWeek]
  );

  const completedCount = useMemo(
    () => challenges.filter((c) => c.is_completed).length,
    [challenges]
  );

  const totalXpEarned = useMemo(
    () => challenges.filter((c) => c.is_completed).reduce((s, c) => s + c.xp_reward, 0),
    [challenges]
  );

  const totalXpAvailable = useMemo(
    () => challenges.reduce((s, c) => s + c.xp_reward, 0),
    [challenges]
  );

  return {
    challenges,
    loading,
    currentWeek,
    totalWeeks: 4,
    completedCount,
    totalCount: challenges.length,
    totalXpEarned,
    totalXpAvailable,
    isPrideActive,
    refetch: fetchChallenges,
  };
}
