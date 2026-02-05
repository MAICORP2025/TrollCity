import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  coinCost: number;
  type: 'paid' | 'free';
  slug: string;
}

export function useGiftSystem(
  recipientId: string, 
  streamId: string, 
  battleId?: string | null,
  _targetUserId?: string
) {
  const [isSending, setIsSending] = useState(false);
  const { user, refreshProfile } = useAuthStore();

  const sendGift = async (gift: GiftItem, targetIdOverride?: string, quantity: number = 1): Promise<boolean> => {
    if (!user) {
      toast.error("You must be logged in to send gifts");
      return false;
    }

    const finalRecipientId = targetIdOverride || recipientId;

    if (user.id === finalRecipientId) {
      toast.error("You cannot send gifts to yourself");
      return false;
    }

    setIsSending(true);

    try {
      // Use the scalable send_gift_ledger RPC (Single Write)
      const { data, error } = await supabase.rpc('send_gift_ledger', {
        p_receiver_id: finalRecipientId,
        p_gift_id: gift.slug || gift.id,
        p_amount: gift.coinCost,
        p_stream_id: streamId,
        p_quantity: quantity,
        p_metadata: {
          stream_id: streamId,
          battle_id: battleId || null,
          gift_name: gift.name,
          gift_icon: gift.icon,
          original_gift_id: gift.id
        },
        p_idempotency_key: crypto.randomUUID()
      });

      if (error) throw error;

      if (data && data.success) {
        toast.success(`Sent ${gift.name}!`);
        
        // Refresh profile to update balance (Optimistic)
        refreshProfile(); 
        
        // NO manual insert into stream_gifts. 
        // The ledger processor will handle history and stats.
        
        return true;
      } else {
        toast.error(data?.message || "Failed to send gift");
        return false;
      }

    } catch (err: any) {
      console.error("Gift error:", err);
      toast.error(err.message || "Transaction failed");
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendGift,
    isSending
  };
}
