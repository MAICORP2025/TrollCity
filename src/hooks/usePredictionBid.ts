import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

type PredictionType = 'winner' | 'price' | 'combined';

interface AuctionPrediction {
  id: string;
  user_id: string;
  auction_show_id: string;
  predicted_winner_id: string | null;
  predicted_price: number | null;
  prediction_type: PredictionType;
  is_locked: boolean;
  locked_at: string | null;
  submitted_at: string;
  updated_at: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface PredictionSettings {
  enabled: boolean;
  enabled_global: boolean;
  lock_before_end_seconds: number;
  reward_crowns_correct_winner: number;
  reward_crowns_correct_price: number;
  reward_crowns_combined: number;
  reward_xp_correct_winner: number;
  reward_xp_correct_price: number;
  reward_xp_combined: number;
  reward_event_points_correct_winner: number;
  reward_event_points_correct_price: number;
  reward_event_points_combined: number;
}

interface UsePredictionBidReturn {
  prediction: AuctionPrediction | null;
  predictions: AuctionPrediction[];
  predictionCount: number;
  settings: PredictionSettings | null;
  isLocked: boolean;
  isEnabled: boolean;
  submitPrediction: (
    predictedWinnerId: string | null,
    predictedPrice: number | null,
    type: PredictionType,
  ) => Promise<boolean>;
  lockPredictions: () => Promise<void>;
  loading: boolean;
}

const DEFAULT_SETTINGS: PredictionSettings = {
  enabled: true,
  enabled_global: true,
  lock_before_end_seconds: 30,
  reward_crowns_correct_winner: 10,
  reward_crowns_correct_price: 25,
  reward_crowns_combined: 50,
  reward_xp_correct_winner: 100,
  reward_xp_correct_price: 250,
  reward_xp_combined: 500,
  reward_event_points_correct_winner: 5,
  reward_event_points_correct_price: 10,
  reward_event_points_combined: 20,
};

export function usePredictionBid(
  showId: string | null | undefined,
  isAuctioneer: boolean,
): UsePredictionBidReturn {
  const [prediction, setPrediction] = useState<AuctionPrediction | null>(null);
  const [predictions, setPredictions] = useState<AuctionPrediction[]>([]);
  const [predictionCount, setPredictionCount] = useState(0);
  const [settings, setSettings] = useState<PredictionSettings | null>(DEFAULT_SETTINGS);
  const [isLocked, setIsLocked] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  // Fetch settings
  useEffect(() => {
    supabase
      .from('auction_prediction_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettings({
            enabled: data.enabled ?? true,
            enabled_global: data.enabled_global ?? true,
            lock_before_end_seconds: data.lock_before_end_seconds ?? 30,
            reward_crowns_correct_winner: data.reward_crowns_correct_winner ?? 10,
            reward_crowns_correct_price: data.reward_crowns_correct_price ?? 25,
            reward_crowns_combined: data.reward_crowns_combined ?? 50,
            reward_xp_correct_winner: data.reward_xp_correct_winner ?? 100,
            reward_xp_correct_price: data.reward_xp_correct_price ?? 250,
            reward_xp_combined: data.reward_xp_combined ?? 500,
            reward_event_points_correct_winner: data.reward_event_points_correct_winner ?? 5,
            reward_event_points_correct_price: data.reward_event_points_correct_price ?? 10,
            reward_event_points_combined: data.reward_event_points_combined ?? 20,
          });
        }
      });
  }, []);

  // Fetch show prediction state
  useEffect(() => {
    if (!showId) return;

    supabase
      .from('auction_shows')
      .select('predictions_enabled, predictions_locked')
      .eq('id', showId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsEnabled(data.predictions_enabled ?? true);
          setIsLocked(data.predictions_locked ?? false);
        }
      });
  }, [showId]);

  // Fetch user's prediction
  const fetchMyPrediction = useCallback(async () => {
    if (!showId || !user?.id) return;

    const { data } = await supabase
      .from('auction_predictions')
      .select('*')
      .eq('auction_show_id', showId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPrediction(data as AuctionPrediction);
    } else {
      setPrediction(null);
    }
  }, [showId, user?.id]);

  // Fetch all predictions (for leaderboard)
  const fetchPredictions = useCallback(async () => {
    if (!showId) return;

    const { data } = await supabase
      .from('auction_predictions')
      .select(`
        id, user_id, auction_show_id, predicted_winner_id, predicted_price,
        prediction_type, is_locked, locked_at, submitted_at, updated_at,
        username:user_profiles(username),
        display_name:user_profiles(display_name),
        avatar_url:user_profiles(avatar_url)
      `)
      .eq('auction_show_id', showId)
      .order('submitted_at', { ascending: false });

    if (data) {
      setPredictions(data as unknown as AuctionPrediction[]);
    }
  }, [showId]);

  // Fetch prediction count
  const fetchCount = useCallback(async () => {
    if (!showId) return;

    const { data } = await supabase.rpc('get_prediction_count', {
      p_show_id: showId,
    });
    setPredictionCount(data || 0);
  }, [showId]);

  useEffect(() => {
    void fetchMyPrediction();
    void fetchPredictions();
    void fetchCount();
  }, [fetchMyPrediction, fetchPredictions, fetchCount]);

  // Realtime subscription
  useEffect(() => {
    if (!showId) return;

    const channel = supabase
      .channel(`predictions:${showId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auction_shows',
          filter: `id=eq.${showId}`,
        },
        (payload: any) => {
          if (payload.new?.predictions_locked !== undefined) {
            setIsLocked(payload.new.predictions_locked);
            if (payload.new.predictions_locked && !payload.old?.predictions_locked) {
              toast.info('🔒 Predictions are now locked!', {
                duration: 4000,
              });
            }
          }
          if (payload.new?.predictions_enabled !== undefined) {
            setIsEnabled(payload.new.predictions_enabled);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_predictions',
          filter: `auction_show_id=eq.${showId}`,
        },
        () => {
          void fetchMyPrediction();
          void fetchPredictions();
          void fetchCount();
        },
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [showId, fetchMyPrediction, fetchPredictions, fetchCount]);

  const submitPrediction = useCallback(
    async (
      predictedWinnerId: string | null,
      predictedPrice: number | null,
      type: PredictionType,
    ): Promise<boolean> => {
      if (!showId || !user?.id) {
        toast.error('You must be logged in to predict');
        return false;
      }

      if (isLocked) {
        toast.error('Predictions are locked');
        return false;
      }

      if (!isEnabled) {
        toast.error('Predictions are not enabled for this show');
        return false;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('submit_prediction', {
          p_show_id: showId,
          p_predicted_winner_id: predictedWinnerId,
          p_predicted_price: predictedPrice,
          p_prediction_type: type,
        });

        if (error) throw error;

        const result = data as any;
        if (!result?.success) {
          toast.error(result?.reason || 'Failed to submit prediction');
          return false;
        }

        const action = result.action === 'updated' ? 'updated' : 'submitted';
        toast.success(`Prediction ${action}! 🔮`, {
          duration: 3000,
          style: { background: '#1a1a2e', border: '1px solid #8b5cf6', color: '#e9d5ff' },
        });

        await fetchMyPrediction();
        await fetchPredictions();
        await fetchCount();
        return true;
      } catch (err: any) {
        toast.error(err?.message || 'Failed to submit prediction');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [showId, user?.id, isLocked, isEnabled, fetchMyPrediction, fetchPredictions, fetchCount],
  );

  const lockPredictions = useCallback(async () => {
    if (!showId || !isAuctioneer) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('lock_predictions', {
        p_show_id: showId,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast.error(result?.reason || 'Failed to lock predictions');
        return;
      }

      toast.success('Predictions locked');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to lock predictions');
    } finally {
      setLoading(false);
    }
  }, [showId, isAuctioneer]);

  return {
    prediction,
    predictions,
    predictionCount,
    settings,
    isLocked,
    isEnabled,
    submitPrediction,
    lockPredictions,
    loading,
  };
}
