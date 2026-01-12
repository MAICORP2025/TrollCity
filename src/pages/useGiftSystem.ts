import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import { isPurchaseRequiredError, openPurchaseGate } from '../lib/purchaseGate'

interface GiftItem {
  id: string
  name: string
  icon: string
  coinCost: number
  type: 'paid' | 'free'
}

export function useGiftSystem(streamerId: string, streamId: string) {
  const { user, profile } = useAuthStore()
  const [isSending, setIsSending] = useState(false)

  const sendGift = async (gift: GiftItem) => {
    if (!user || !profile) {
      toast.error('You must be logged in to send gifts.')
      return
    }

    setIsSending(true)

    try {
      const { error } = await supabase.rpc('process_gift', {
        p_sender_id: profile.id,
        p_streamer_id: streamerId,
        p_stream_id: streamId,
        p_gift_id: gift.id,
        p_gift_name: gift.name,
        p_coins_spent: gift.coinCost,
        p_gift_type: gift.type,
      })
      if (error) {
        if (isPurchaseRequiredError(error)) {
          openPurchaseGate(error?.message || error?.error)
          return false
        }
        throw error
      }
      toast.success(`Gift sent: ${gift.name} 🎁`)
      return true
    } catch (err: any) {
      if (isPurchaseRequiredError(err)) {
        openPurchaseGate(err?.message || err?.error)
        return false
      }
      toast.error('Failed to send gift.')
      return false
    } finally {
      setIsSending(false)
    }
  }

  return { sendGift, isSending }
}
