import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AnonymousRoundState {
  isActive: boolean;
  endsAt: string | null;
  durationSeconds: number;
  maxDuration: number;
  secondsRemaining: number;
}

interface UseAnonymousRoundReturn {
  state: AnonymousRoundState;
  startRound: (durationSeconds?: number) => Promise<void>;
  endRound: () => Promise<void>;
  loading: boolean;
}

const DEFAULT_DURATION = 30;
const MIN_DURATION = 10;

export function useAnonymousRound(
  showId: string | null | undefined,
  isAuctioneer: boolean,
): UseAnonymousRoundReturn {
  const [isActive, setIsActive] = useState(false);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION);
  const [maxDuration, setMaxDuration] = useState(120);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear interval helper
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!isActive || !endsAt) {
      clearTimer();
      return;
    }

    const updateRemaining = () => {
      const diff = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);
      if (diff <= 0) {
        clearTimer();
        setIsActive(false);
        setEndsAt(null);
        toast.info('Anonymous Bid Round Ended');
      }
    };

    updateRemaining();
    intervalRef.current = setInterval(updateRemaining, 1000);

    return clearTimer;
  }, [isActive, endsAt, clearTimer]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!showId) return;

    // Fetch initial state
    supabase
      .from('auction_shows')
      .select('is_anonymous_round_active, anonymous_round_ends_at, anonymous_round_duration_seconds, anonymous_round_max_duration')
      .eq('id', showId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsActive(data.is_anonymous_round_active || false);
          setEndsAt(data.anonymous_round_ends_at || null);
          setDurationSeconds(data.anonymous_round_duration_seconds || DEFAULT_DURATION);
          setMaxDuration(data.anonymous_round_max_duration || 120);
        }
      });

    const channel = supabase
      .channel(`anonymous-round:${showId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auction_shows',
          filter: `id=eq.${showId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          setIsActive(newData.is_anonymous_round_active || false);
          setEndsAt(newData.anonymous_round_ends_at || null);
          setDurationSeconds(newData.anonymous_round_duration_seconds || DEFAULT_DURATION);
          setMaxDuration(newData.anonymous_round_max_duration || 120);

          if (newData.is_anonymous_round_active) {
            toast.success('🔒 Anonymous Bid Round Activated!', {
              duration: 5000,
              style: { background: '#1a1a2e', border: '1px solid #6366f1', color: '#e0e7ff' },
            });
          } else if (payload.old?.is_anonymous_round_active && !newData.is_anonymous_round_active) {
            toast.info('Anonymous Bid Round Ended', {
              duration: 4000,
            });
          }
        },
      )
      .subscribe();

    return () => {
      clearTimer();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [showId, clearTimer]);

  const startRound = useCallback(
    async (duration?: number) => {
      if (!showId || !isAuctioneer) return;

      const dur = duration || DEFAULT_DURATION;
      if (dur < MIN_DURATION) {
        toast.error(`Minimum duration is ${MIN_DURATION} seconds`);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('start_anonymous_round', {
          p_show_id: showId,
          p_duration_seconds: dur,
        });

        if (error) throw error;

        const result = data as any;
        if (!result?.success) {
          toast.error(result?.reason || 'Failed to start anonymous round');
          return;
        }

        toast.success(`Anonymous round started: ${dur}s`, {
          icon: '🔒',
          style: { background: '#1a1a2e', border: '1px solid #6366f1', color: '#e0e7ff' },
        });
      } catch (err: any) {
        toast.error(err?.message || 'Failed to start anonymous round');
      } finally {
        setLoading(false);
      }
    },
    [showId, isAuctioneer],
  );

  const endRound = useCallback(async () => {
    if (!showId || !isAuctioneer) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('end_anonymous_round', {
        p_show_id: showId,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast.error(result?.reason || 'Failed to end anonymous round');
        return;
      }

      toast.info('Anonymous round ended early');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to end anonymous round');
    } finally {
      setLoading(false);
    }
  }, [showId, isAuctioneer]);

  return {
    state: {
      isActive,
      endsAt,
      durationSeconds,
      maxDuration,
      secondsRemaining,
    },
    startRound,
    endRound,
    loading,
  };
}
