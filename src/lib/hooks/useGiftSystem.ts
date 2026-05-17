import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { processGiftXp } from '../xp'
import { useXPStore } from '@/stores/useXPStore'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'

export async function quietRefreshGiftProfile(userId: string) {
  const authStore = useAuthStore.getState();
  const currentProfile = authStore.profile;

  try {
    const [{ data: profileRow }, { data: levelRow }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_stats').select('level, xp_total, xp_to_next_level').eq('user_id', userId).maybeSingle(),
    ]);

    if (profileRow) {
      authStore.setProfile({
        ...currentProfile,
        ...profileRow,
        level: levelRow?.level ?? profileRow.level ?? currentProfile?.level ?? 1,
        xp: levelRow?.xp_total ?? profileRow.xp ?? currentProfile?.xp ?? 0,
        total_xp: levelRow?.xp_total ?? profileRow.total_xp ?? currentProfile?.total_xp ?? 0,
        next_level_xp: levelRow?.xp_to_next_level ?? profileRow.next_level_xp ?? currentProfile?.next_level_xp,
      } as any);
    }
  } catch (err) {
    console.warn('[GiftSystem] Quiet profile refresh failed:', err);
  }
}

export interface GiftItem {
  id: string
  name: string
  icon?: string
  coinCost: number
  type: 'paid' | 'free'
  category?: string
  subcategory?: string
  slug?: string
  currency?: 'troll_coins'
}

export interface GiftSendOptions {
  receiverId?: string
  quantity?: number
  battleId?: string | null
  metadata?: Record<string, any>
}

interface GiftSystemContextValue {
  sendGift: (gift: GiftItem, options?: GiftSendOptions) => Promise<boolean | { success: boolean; bonus?: any }>
  isSending: boolean
}

const GiftSystemContext = createContext<GiftSystemContextValue | null>(null)

// Global counter for debugging
if (typeof window !== 'undefined') {
  (window as any).GIFT_SYSTEM_PROVIDER_RENDER_COUNT = 0
}

export function GiftSystemProvider({
  streamId,
  defaultReceiverId,
  children,
}: {
  streamId?: string | null
  defaultReceiverId?: string
  children: React.ReactNode
}) {
  if (typeof window !== 'undefined') {
    (window as any).GIFT_SYSTEM_PROVIDER_RENDER_COUNT = ((window as any).GIFT_SYSTEM_PROVIDER_RENDER_COUNT || 0) + 1
  }

  // Guard: Do not initialize provider without streamId
  if (!streamId) {
    if (import.meta.env.DEV) console.debug('[GiftSystemProvider] Skipping - no streamId provided')
    return React.createElement(React.Fragment, {}, children)
  }

  const { user, profile } = useAuthStore()
  const [isSending, setIsSending] = useState(false)

  const sendGift = useCallback(
    async (gift: GiftItem, options: GiftSendOptions = {}) => {
      const targetReceiverId = options.receiverId || defaultReceiverId || streamId
      const quantity = Math.max(1, Number(options.quantity) || 1)
      const battleId = options.battleId ?? null

      if (!user || !profile) {
        toast.error('You must be logged in to send gifts.')
        return false
      }

      const trollmonds = (profile as any)?.trollmonds || 0
      const battleCrowns = (profile as any)?.battle_crowns || 0
      let discountPercent = 0

      if (battleCrowns >= 100) {
        discountPercent = 5
      }
      if (trollmonds >= 100) {
        discountPercent = Math.max(discountPercent, 10)
      }

      const discountAmount = Math.floor(gift.coinCost * (discountPercent / 100))
      const finalCost = (gift.coinCost - discountAmount) * quantity
      const balance = gift.type === 'paid' ? (profile.troll_coins || 0) : 0

      if (gift.type === 'paid' && balance < finalCost) {
        toast.error(`Not enough Coins for this gift.${discountPercent > 0 ? ` (${discountPercent}% off: ${finalCost} coins needed)` : ''}`)
        return false
      }

      setIsSending(true)
      try {
        const { data: result, error: rpcError } = await supabase.rpc('send_gift_in_stream', {
          p_sender_id: user.id,
          p_receiver_id: targetReceiverId,
          p_stream_id: streamId,
          p_gift_id: gift.id,
          p_quantity: quantity,
          p_metadata: {
            source: battleId ? 'battle_gift' : 'stream_gift',
            battle_id: battleId,
            ...options.metadata,
          },
        })

        if (rpcError) {
          throw rpcError
        }

        if (!result?.success) {
          const message = result?.message || result?.error || 'Failed to send gift'
          toast.error(message)
          return false
        }

        try {
          await processGiftXp(user.id, Math.floor(gift.coinCost * quantity * 1.1))
        } catch (xpError) {
          console.error('[GiftDebugger] XP Award Error:', xpError)
        }

        await quietRefreshGiftProfile(user.id)

        const xpState = useXPStore.getState()
        if (xpState.xpTotal > 0) {
          await xpState.fetchXP(user?.id)
        }

        return { success: true, bonus: result }
      } catch (error: any) {
        console.error('[GiftDebugger] Error:', error)
        toast.error(error?.message || 'Failed to send gift')
        return false
      } finally {
        setIsSending(false)
      }
    },
    [defaultReceiverId, profile, streamId, user]
  )

  const contextValue = useMemo(
    () => ({ sendGift, isSending }),
    [sendGift, isSending]
  )

  return React.createElement(
    GiftSystemContext.Provider,
    { value: contextValue },
    children
  )
}

export function useGiftSystem() {
  const context = useContext(GiftSystemContext)
  if (!context) {
    throw new Error('useGiftSystem must be used within GiftSystemProvider')
  }
  return context
}

// Helper function to calculate trollmonds discount percentage
// Only applies discount if user has 100+ trollmonds
export function getTrollmondDiscount(trollmonds: number): number {
  if (trollmonds >= 100) {
    return 10
  }
  return 0
}

// Helper function to calculate discounted price
export function getDiscountedPrice(originalCost: number, discountPercent: number): number {
  if (discountPercent <= 0) return originalCost
  const discountAmount = Math.floor(originalCost * (discountPercent / 100))
  return originalCost - discountAmount
}
