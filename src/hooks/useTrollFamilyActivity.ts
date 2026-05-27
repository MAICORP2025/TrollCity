/**
 * useTrollFamilyActivity Hook
 * 
 * Provides a centralized way to record family activity across the app
 * Handles recording events to the troll_family_activity_events table
 * and updating family goals automatically
 */

import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'

export interface FamilyActivityOptions {
  streamId?: string
  giftId?: string
  senderId?: string
  receiverId?: string
  battleId?: string
  dedup_key?: string
  [key: string]: any
}

export interface FamilyActivityResult {
  success: boolean
  message?: string
  event_id?: string
  family_id?: string
  event_type?: string
  goals_matched?: number
  error?: string
}

/**
 * Hook to record family activity from any event source
 * Returns a function to call when activity occurs
 */
export function useTrollFamilyActivity() {
  const { user } = useAuthStore()

  /**
   * Record a family activity event
   * @param eventType - Type of event (broadcast_gift_earned, broadcast_watch_time, etc.)
   * @param amount - Numeric value of the event (coins, seconds watched, etc.)
   * @param metadata - Additional context (stream_id, gift_id, etc.)
   * @returns Result object with success status and details
   */
  const recordActivity = useCallback(
    async (
      eventType: string,
      amount: number = 1,
      metadata: FamilyActivityOptions = {}
    ): Promise<FamilyActivityResult> => {
      if (!user?.id) {
        console.warn('[FamilyActivity] No user logged in')
        return {
          success: false,
          error: 'You must be logged in to record family activity',
        }
      }

      try {
        // Generate dedup key if not provided
        const dedupKey = metadata.dedup_key || `${eventType}_${user.id}_${Date.now()}_${uuidv4()}`

        const { data, error } = await supabase.rpc('record_troll_family_activity', {
          p_user_id: user.id,
          p_event_type: eventType,
          p_amount: amount,
          p_metadata: {
            ...metadata,
            dedup_key: dedupKey,
          },
        })

        if (error) {
          console.error('[FamilyActivity] RPC Error:', error)
          return {
            success: false,
            error: error.message,
          }
        }

        if (data?.success === false) {
          console.warn('[FamilyActivity] Activity not recorded:', data.message)
          return {
            success: false,
            message: data.message,
            error: data.message,
          }
        }

        return {
          success: true,
          ...data,
        }
      } catch (err) {
        console.error('[FamilyActivity] Exception:', err)
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    },
    [user?.id]
  )

  /**
   * Record a gift event (when coins are received from a gift)
   */
  const recordGiftEarned = useCallback(
    async (
      amount: number,
      streamId?: string,
      giftId?: string,
      senderId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('broadcast_gift_earned', amount, {
        stream_id: streamId,
        gift_id: giftId,
        sender_id: senderId,
        dedup_key: `gift_earned_${streamId}_${giftId}_${senderId}_${amount}_${user?.id}`,
      })
    },
    [recordActivity, user?.id]
  )

  /**
   * Record a gift sent event (when user sends gift coins)
   */
  const recordGiftSent = useCallback(
    async (
      amount: number,
      receiverId?: string,
      streamId?: string,
      giftId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('broadcast_gift_sent', amount, {
        stream_id: streamId,
        gift_id: giftId,
        receiver_id: receiverId,
        dedup_key: `gift_sent_${streamId}_${giftId}_${receiverId}_${user?.id}`,
      })
    },
    [recordActivity, user?.id]
  )

  /**
   * Record broadcast watch time
   */
  const recordWatchTime = useCallback(
    async (
      seconds: number,
      streamId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('broadcast_watch_time', seconds, {
        stream_id: streamId,
        watch_duration_seconds: seconds,
        dedup_key: `watch_${streamId}_${Math.floor(Date.now() / 60000)}_${user?.id}`,
      })
    },
    [recordActivity, user?.id]
  )

  /**
   * Record Hype Coin earned from watching
   */
  const recordHypeCoinsEarned = useCallback(
    async (
      amount: number,
      streamId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('hype_coin_earned', amount, {
        stream_id: streamId,
        dedup_key: `hype_${streamId}_${amount}_${user?.id}`,
      })
    },
    [recordActivity, user?.id]
  )

  /**
   * Record battle joined
   */
  const recordBattleJoined = useCallback(
    async (
      battleId?: string,
      streamId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('battle_joined', 1, {
        battle_id: battleId,
        stream_id: streamId,
        dedup_key: `battle_joined_${battleId}_${user?.id}`,
      })
    },
    [recordActivity, user?.id]
  )

  /**
   * Record battle won
   */
  const recordBattleWon = useCallback(
    async (
      battleId?: string,
      streamId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('battle_won', 1, {
        battle_id: battleId,
        stream_id: streamId,
        dedup_key: `battle_won_${battleId}_${user?.id}`,
      })
    },
    [recordActivity, user?.id]
  )

  /**
   * Record battle lost
   */
  const recordBattleLost = useCallback(
    async (
      battleId?: string,
      streamId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('battle_lost', 1, {
        battle_id: battleId,
        stream_id: streamId,
        dedup_key: `battle_lost_${battleId}_${user?.id}`,
      })
    },
    [recordActivity, user?.id]
  )

  /**
   * Record stream started
   */
  const recordStreamStarted = useCallback(
    async (streamId?: string): Promise<FamilyActivityResult> => {
      return recordActivity('stream_started', 1, {
        stream_id: streamId,
        dedup_key: `stream_started_${streamId}`,
      })
    },
    [recordActivity]
  )

  /**
   * Record chat message sent
   */
  const recordChatMessage = useCallback(
    async (
      messageLength: number = 1,
      streamId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('chat_message_sent', 1, {
        stream_id: streamId,
        message_length: messageLength,
        dedup_key: `chat_${streamId}_${Date.now()}_${user?.id}`,
      })
    },
    [recordActivity, user?.id]
  )

  /**
   * Record generic Troll Coins earned
   */
  const recordTrollCoinsEarned = useCallback(
    async (
      amount: number,
      source?: string,
      streamId?: string
    ): Promise<FamilyActivityResult> => {
      return recordActivity('troll_coin_earned', amount, {
        source,
        stream_id: streamId,
        dedup_key: `coins_${source}_${streamId}_${amount}_${user?.id}_${Date.now()}`,
      })
    },
    [recordActivity, user?.id]
  )

  return {
    // Generic recorder
    recordActivity,
    
    // Specific recorders (convenience functions)
    recordGiftEarned,
    recordGiftSent,
    recordWatchTime,
    recordHypeCoinsEarned,
    recordBattleJoined,
    recordBattleWon,
    recordBattleLost,
    recordStreamStarted,
    recordChatMessage,
    recordTrollCoinsEarned,
  }
}

export default useTrollFamilyActivity
