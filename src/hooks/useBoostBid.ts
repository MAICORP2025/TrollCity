import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface BoostBidConfig {
  enabled: boolean;
  allowedIncrements: number[];
  maxAmount: number;
  customEnabled: boolean;
}

interface UseBoostBidReturn {
  config: BoostBidConfig;
  placeBoostBid: (lotId: string, bidAmount: number, boostAmount: number) => Promise<boolean>;
  loading: boolean;
}

const DEFAULT_CONFIG: BoostBidConfig = {
  enabled: true,
  allowedIncrements: [2, 5, 10],
  maxAmount: 100,
  customEnabled: false,
};

export function useBoostBid(
  showId: string | null | undefined,
  isAuctioneer: boolean,
): UseBoostBidReturn {
  const [config, setConfig] = useState<BoostBidConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);

  // Fetch boost bid config from show
  useEffect(() => {
    if (!showId) return;

    supabase
      .from('auction_shows')
      .select('boost_bids_enabled, boost_bid_allowed_increments, boost_bid_max_amount, boost_bid_custom_enabled')
      .eq('id', showId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfig({
            enabled: data.boost_bids_enabled ?? true,
            allowedIncrements: data.boost_bid_allowed_increments || [2, 5, 10],
            maxAmount: data.boost_bid_max_amount || 100,
            customEnabled: data.boost_bid_custom_enabled || false,
          });
        }
      });
  }, [showId]);

  // Don't allow auctioneers to place boost bids
  const placeBoostBid = useCallback(
    async (lotId: string, bidAmount: number, boostAmount: number): Promise<boolean> => {
      if (!showId || isAuctioneer) return false;

      if (!config.enabled) {
        toast.error('Boost bids are not enabled for this show');
        return false;
      }

      if (boostAmount > 0) {
        if (boostAmount > config.maxAmount) {
          toast.error(`Maximum boost is ${config.maxAmount} coins`);
          return false;
        }
        if (!config.customEnabled && !config.allowedIncrements.includes(boostAmount)) {
          toast.error(`Allowed boosts: ${config.allowedIncrements.map((v) => `+${v}`).join(', ')}`);
          return false;
        }
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('place_boost_bid', {
          p_show_id: showId,
          p_lot_id: lotId,
          p_bid_amount: bidAmount,
          p_boost_amount: boostAmount,
        });

        if (error) throw error;

        const result = data as any;
        if (!result?.accepted) {
          toast.error(result?.reason || 'Boost bid failed');
          return false;
        }

        if (boostAmount > 0) {
          toast.success(`⚡ Boost Bid +${boostAmount} placed: ${bidAmount.toLocaleString()} coins!`, {
            duration: 4000,
            style: { background: '#1a1a2e', border: '1px solid #f59e0b', color: '#fef3c7' },
          });
        }

        return true;
      } catch (err: any) {
        toast.error(err?.message || 'Failed to place boost bid');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [showId, isAuctioneer, config],
  );

  return { config, placeBoostBid, loading };
}
