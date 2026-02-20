/**
 * Broadcaster Daily Reward Hook
 * 
 * Issues a 25 coin reward when a broadcaster starts a live broadcast.
 * Reward is issued after the broadcast has been active for 60 seconds.
 * 
 * Usage:
 * - Call checkAndIssueBroadcasterReward when user starts a broadcast
 * - The reward is issued asynchronously after minimum duration
 */

import { supabase } from './supabase'
import { 
  issueDailyReward, 
  getDailyRewardSettings,
  checkAccountAge,
  hasClaimedRewardToday,
  type DailyRewardResult
} from './dailyRewardSystem'

// Track pending rewards to prevent duplicate triggers
const pendingBroadcasterRewards = new Map<string, NodeJS.Timeout>()

/**
 * Check if user is eligible for broadcaster reward and issue it
 * This should be called when a broadcast starts
 */
export async function checkAndIssueBroadcasterReward(
  userId: string,
  broadcastId: string
): Promise<DailyRewardResult> {
  try {
    console.log('[BroadcasterReward] Checking reward eligibility:', { userId, broadcastId })

    // Get settings
    const settings = await getDailyRewardSettings()

    // Check if broadcaster rewards are enabled
    if (!settings.broadcasterRewardEnabled) {
      return {
        success: true,
        rewardGiven: false,
        amount: 0,
        message: 'Broadcaster rewards are currently disabled'
      }
    }

    // Check if already claimed today
    const hasClaimed = await hasClaimedRewardToday(userId, 'broadcaster_daily')
    if (hasClaimed) {
      return {
        success: true,
        rewardGiven: false,
        amount: 0,
        message: 'You have already claimed your broadcaster reward today'
      }
    }

    // Schedule reward after minimum duration
    // The broadcast must stay active for at least 60 seconds
    const delayMs = settings.broadcasterMinDurationSeconds * 1000
    
    console.log(`[BroadcasterReward] Scheduling reward in ${delayMs}ms for broadcast ${broadcastId}`)

    // Clear any existing pending reward for this broadcast
    if (pendingBroadcasterRewards.has(broadcastId)) {
      clearTimeout(pendingBroadcasterRewards.get(broadcastId))
    }

    // Schedule the reward check
    const timeoutId = setTimeout(async () => {
      try {
        // Check if broadcast is still active
        const { data: stream, error: streamError } = await supabase
          .from('streams')
          .select('id, is_live, status, started_at')
          .eq('id', broadcastId)
          .single()

        if (streamError || !stream) {
          console.log('[BroadcasterReward] Stream no longer exists, not issuing reward')
          pendingBroadcasterRewards.delete(broadcastId)
          return
        }

        // Check if stream is still live
        if (!stream.is_live || stream.status !== 'live') {
          console.log('[BroadcasterReward] Stream no longer live, not issuing reward')
          pendingBroadcasterRewards.delete(broadcastId)
          return
        }

        // Issue the reward
        const result = await issueDailyReward(
          userId,
          'broadcaster_daily',
          broadcastId
        )

        console.log('[BroadcasterReward] Reward result:', result)
        pendingBroadcasterRewards.delete(broadcastId)

      } catch (error) {
        console.error('[BroadcasterReward] Error issuing scheduled reward:', error)
        pendingBroadcasterRewards.delete(broadcastId)
      }
    }, delayMs)

    pendingBroadcasterRewards.set(broadcastId, timeoutId)

    return {
      success: true,
      rewardGiven: false,
      amount: 0,
      message: `Reward will be issued after ${settings.broadcasterMinDurationSeconds} seconds of broadcasting`
    }

  } catch (error: any) {
    console.error('[BroadcasterReward] Error checking reward:', error)
    return {
      success: false,
      rewardGiven: false,
      amount: 0,
      message: 'An error occurred while checking reward eligibility',
      error: error.message
    }
  }
}

/**
 * Cancel a pending broadcaster reward (if broadcast ends before minimum duration)
 */
export function cancelPendingBroadcasterReward(broadcastId: string): void {
  if (pendingBroadcasterRewards.has(broadcastId)) {
    clearTimeout(pendingBroadcasterRewards.get(broadcastId))
    pendingBroadcasterRewards.delete(broadcastId)
    console.log('[BroadcasterReward] Cancelled pending reward for broadcast:', broadcastId)
  }
}

/**
 * Force issue broadcaster reward immediately (for testing or admin purposes)
 */
export async function forceIssueBroadcasterReward(
  userId: string,
  broadcastId: string
): Promise<DailyRewardResult> {
  return issueDailyReward(userId, 'broadcaster_daily', broadcastId)
}

/**
 * Get broadcaster reward status (eligibility check)
 */
export async function getBroadcasterRewardStatus(
  userId: string
): Promise<{
  eligible: boolean
  hasClaimedToday: boolean
  message: string
}> {
  try {
    const settings = await getDailyRewardSettings()

    if (!settings.broadcasterRewardEnabled) {
      return {
        eligible: false,
        hasClaimedToday: false,
        message: 'Broadcaster rewards are currently disabled'
      }
    }

    const hasClaimed = await hasClaimedRewardToday(userId, 'broadcaster_daily')

    if (hasClaimed) {
      return {
        eligible: false,
        hasClaimedToday: true,
        message: 'You have already claimed your broadcaster reward today'
      }
    }

    return {
      eligible: true,
      hasClaimedToday: false,
      message: `You can earn ${settings.broadcasterRewardAmount} coins for going live today!`
    }
  } catch (error) {
    console.error('[BroadcasterReward] Error getting status:', error)
    return {
      eligible: false,
      hasClaimedToday: false,
      message: 'Error checking reward status'
    }
  }
}
