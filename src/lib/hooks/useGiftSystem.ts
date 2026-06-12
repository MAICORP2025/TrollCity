import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { processGiftXp } from '../xp'
import { useXPStore } from '@/stores/useXPStore'
import { toast } from 'sonner'
import { BattleSounds } from '../battleSounds';
import { useAuthStore } from '../../lib/store'
import { useTrollFamilyActivity } from '@/hooks/useTrollFamilyActivity'

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
  animationKey?: string
  animationType?: string
  animationUrl?: string | null
  animationDurationMs?: number
  soundUrl?: string | null
  isFullscreen?: boolean
  rarity?: string
  trayVisualUrl?: string | null
  trayGradient?: string | null
  videoUrl?: string | null
}

export interface GiftSendOptions {
  receiverId?: string
  quantity?: number
  battleId?: string | null
  streamId?: string | null
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
  const { recordGiftSent, recordGiftEarned } = useTrollFamilyActivity()
  const [isSending, setIsSending] = useState(false)

  const sendGift = useCallback(
    async (gift: GiftItem, options: GiftSendOptions = {}) => {
      const targetReceiverId = options.receiverId || defaultReceiverId || streamId
      const quantity = Math.max(1, Number(options.quantity) || 1)
      const battleId = options.battleId ?? null
      const effectiveStreamId = options.streamId ?? streamId

      if (!user || !profile) {
        toast.error('You must be logged in to send gifts.')
        return false
      }

      // Note: trollmond deduction is now handled entirely by the RPC.
      // Gifts >= 100 coins deduct 100 trollmonds per gift (if sender has trollmonds).
      // No client-side coin discount is applied.
      const totalCost = gift.coinCost * quantity
      const balance = gift.type === 'paid' ? (profile.troll_coins || 0) : 0

      if (gift.type === 'paid' && balance < totalCost) {
        toast.error(`Not enough Coins for this gift. Need ${totalCost} coins.`)
        return false
      }

      setIsSending(true)
      try {
        const giftMetadata = {
        source: battleId ? 'battle_gift' : 'stream_gift',
        battle_id: battleId,
        gift_name: gift.name,
        gift_slug: gift.slug,
        gift_icon: gift.icon,
        animation_key: gift.animationKey || gift.slug || gift.name,
        animation_type: gift.animationType,
        animation_url: gift.animationUrl || gift.animation_url || gift.videoUrl || gift.video_url || null,
        video_url: gift.videoUrl || gift.video_url || gift.animationUrl || gift.animation_url || null,
        animation_duration_ms: gift.animationDurationMs || gift.animation_duration_ms,
        sound_url: gift.soundUrl || gift.sound_url || null,
        is_fullscreen: gift.isFullscreen ?? gift.is_fullscreen,
        rarity: gift.rarity,
        tray_visual_url: gift.trayVisualUrl || gift.tray_visual_url || null,
        tray_gradient: gift.trayGradient || gift.tray_gradient || null,
        ...options.metadata,
      }

      const { data: result, error: rpcError } = await supabase.rpc('send_gift_in_stream', {
          p_sender_id: user.id,
          p_receiver_id: targetReceiverId,
          p_stream_id: effectiveStreamId,
          p_gift_id: gift.id,
          p_quantity: quantity,
          p_metadata: giftMetadata,
        })

        if (rpcError) {
          throw rpcError
        }

          if (!result?.success) {
          const message = result?.message || result?.error || 'Failed to send gift'
          toast.error(message)
          BattleSounds.error();
          return false
        }

        // Play gift sent sound
        BattleSounds.giftSent();

        // Non-critical post-send operations — fire and forget for instant UI response
        void (async () => {
          try { await processGiftXp(user.id, Math.floor(gift.coinCost * quantity * 1.1)) } catch (e) { /* ignore */ }
          try { await quietRefreshGiftProfile(user.id) } catch (e) { /* ignore */ }
          try {
            const xpState = useXPStore.getState()
            if (xpState.xpTotal > 0) await xpState.fetchXP(user?.id)
          } catch (e) { /* ignore */ }
          try {
            const dedupKey = `gift_${effectiveStreamId}_${gift.id}_${user.id}_${targetReceiverId}_${Date.now()}`
            await recordGiftSent(totalCost, targetReceiverId, effectiveStreamId, gift.id)
            await supabase.rpc('record_troll_family_activity', {
              p_user_id: targetReceiverId,
              p_event_type: 'broadcast_gift_earned',
              p_amount: totalCost,
              p_metadata: { stream_id: effectiveStreamId, gift_id: gift.id, sender_id: user.id, dedup_key: dedupKey },
            })
          } catch (e) { /* ignore */ }
        })()

        return { success: true, bonus: result }
      } catch (error: any) {
        console.error('[GiftDebugger] Error:', error)
        toast.error(error?.message || 'Failed to send gift')
        return false
      } finally {
        setIsSending(false)
      }
    },
    [defaultReceiverId, profile, streamId, user, recordGiftSent, recordGiftEarned]
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
