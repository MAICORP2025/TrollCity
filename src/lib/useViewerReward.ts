/**
 * Viewer Daily Reward Hook
 * 
 * Issues a 10 coin reward when a viewer joins a live broadcast.
 * Requirements:
 * - Viewer must stay in room at least 30 seconds
 * - Viewer account must be older than 24 hours
 * - One reward per calendar day per user
 * 
 * Usage:
 * - Call checkAndIssueViewerReward when user joins a broadcast
 * - Call cancelPendingViewerReward when user leaves the broadcast
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
// Key: broadcastId_viewerId
const pendingViewerRewards = new Map<string, NodeJS.Timeout>()

// Track viewer join times for stay duration tracking
const viewerJoinTimes = new Map<string, number>()

/**
 * Generate a unique key for tracking viewer rewards
 */
function getViewerRewardKey(broadcastId: string, viewerId: string): string {
  return `${broadcastId}_${viewerId}`
}

/**
 * Check if user is eligible for viewer reward and schedule it
 * This should be called when a viewer joins a broadcast
 */
export async function checkAndIssueViewerReward(
  viewerId: string,
  broadcastId: string
): Promise<DailyRewardResult> {
  try {
    console.log('[ViewerReward] Checking reward eligibility:', { viewerId, broadcastId })

    // Get settings
    const settings = await getDailyRewardSettings()

    // Check if viewer rewards are enabled
    if (!settings.viewerRewardEnabled) {
      return {
        success: true,
        rewardGiven: false,
        amount: 0,
        message: 'Viewer rewards are currently disabled'
      }
    }

    // Check if already claimed today
    const hasClaimed = await hasClaimedRewardToday(viewerId, 'viewer_daily')
    if (hasClaimed) {
      return {
        success: true,
        rewardGiven: false,
        amount: 0,
        message: 'You have already claimed your viewer reward today'
      }
    }

    // Check account age (must be older than 24 hours)
    const { meetsRequirement: meetsAgeRequirement, accountAgeHours } = await checkAccountAge(
      viewerId,
      settings.viewerMinAccountAgeHours
    )

    if (!meetsAgeRequirement) {
      return {
        success: true,
        rewardGiven: false,
        amount: 0,
        message: `Your account must be at least ${settings.viewerMinAccountAgeHours} hours old to receive viewer rewards. Your account is ${accountAgeHours} hours old.`
      }
    }

    // Record join time for stay duration tracking
    const joinKey = getViewerRewardKey(broadcastId, viewerId)
    viewerJoinTimes.set(joinKey, Date.now())

    // Schedule reward after minimum stay duration
    const delayMs = settings.viewerMinStaySeconds * 1000
    
    console.log(`[ViewerReward] Scheduling reward in ${delayMs}ms for viewer ${viewerId} in broadcast ${broadcastId}`)

    // Clear any existing pending reward for this viewer+broadcast
    if (pendingViewerRewards.has(joinKey)) {
      clearTimeout(pendingViewerRewards.get(joinKey))
    }

    // Schedule the reward check
    const timeoutId = setTimeout(async () => {
      try {
        // Check if viewer is still in the broadcast
        // We'll check if they're still in the stream viewers or presence
        const isStillInBroadcast = await checkViewerStillInBroadcast(viewerId, broadcastId)
        
        if (!isStillInBroadcast) {
          console.log('[ViewerReward] Viewer no longer in broadcast, not issuing reward')
          pendingViewerRewards.delete(joinKey)
          viewerJoinTimes.delete(joinKey)
          return
        }

        // Issue the reward
        const result = await issueDailyReward(
          viewerId,
          'viewer_daily',
          broadcastId
        )

        console.log('[ViewerReward] Reward result:', result)
        pendingViewerRewards.delete(joinKey)
        viewerJoinTimes.delete(joinKey)

      } catch (error) {
        console.error('[ViewerReward] Error issuing scheduled reward:', error)
        pendingViewerRewards.delete(joinKey)
        viewerJoinTimes.delete(joinKey)
      }
    }, delayMs)

    pendingViewerRewards.set(joinKey, timeoutId)

    return {
      success: true,
      rewardGiven: false,
      amount: 0,
      message: `Reward will be issued after staying ${settings.viewerMinStaySeconds} seconds`
    }

  } catch (error: any) {
    console.error('[ViewerReward] Error checking reward:', error)
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
 * Check if viewer is still in the broadcast
 * Uses presence tracking or stream viewers table
 */
async function checkViewerStillInBroadcast(viewerId: string, broadcastId: string): Promise<boolean> {
  try {
    // Check stream_viewers table
    const { data: viewer, error } = await supabase
      .from('stream_viewers')
      .select('id')
      .eq('stream_id', broadcastId)
      .eq('user_id', viewerId)
      .maybeSingle()

    if (error) {
      console.error('[ViewerReward] Error checking viewer presence:', error)
      // If we can't verify, be generous and allow the reward
      return true
    }

    return !!viewer
  } catch (error) {
    console.error('[ViewerReward] Error checking viewer presence:', error)
    // Default to true on error
    return true
  }
}

/**
 * Cancel a pending viewer reward (if viewer leaves before minimum duration)
 */
export function cancelPendingViewerReward(viewerId: string, broadcastId: string): void {
  const joinKey = getViewerRewardKey(broadcastId, viewerId)
  
  if (pendingViewerRewards.has(joinKey)) {
    clearTimeout(pendingViewerRewards.get(joinKey))
    pendingViewerRewards.delete(joinKey)
    viewerJoinTimes.delete(joinKey)
    console.log('[ViewerReward] Cancelled pending reward for viewer:', viewerId, 'broadcast:', broadcastId)
  }
}

/**
 * Get the duration a viewer has been in a broadcast
 */
export function getViewerStayDuration(viewerId: string, broadcastId: string): number {
  const joinKey = getViewerRewardKey(broadcastId, viewerId)
  const joinTime = viewerJoinTimes.get(joinKey)
  
  if (!joinTime) return 0
  
  return Math.floor((Date.now() - joinTime) / 1000) // Return seconds
}

/**
 * Force issue viewer reward immediately (for testing or admin purposes)
 */
export async function forceIssueViewerReward(
  viewerId: string,
  broadcastId: string
): Promise<DailyRewardResult> {
  return issueDailyReward(viewerId, 'viewer_daily', broadcastId)
}

/**
 * Get viewer reward status (eligibility check)
 */
export async function getViewerRewardStatus(
  viewerId: string
): Promise<{
  eligible: boolean
  hasClaimedToday: boolean
  accountAgeValid: boolean
  accountAgeHours?: number
  message: string
}> {
  try {
    const settings = await getDailyRewardSettings()

    if (!settings.viewerRewardEnabled) {
      return {
        eligible: false,
        hasClaimedToday: false,
        accountAgeValid: false,
        message: 'Viewer rewards are currently disabled'
      }
    }

    const hasClaimed = await hasClaimedRewardToday(viewerId, 'viewer_daily')

    if (hasClaimed) {
      return {
        eligible: false,
        hasClaimedToday: true,
        accountAgeValid: true,
        message: 'You have already claimed your viewer reward today'
      }
    }

    // Check account age
    const { meetsRequirement: meetsAgeRequirement, accountAgeHours } = await checkAccountAge(
      viewerId,
      settings.viewerMinAccountAgeHours
    )

    if (!meetsAgeRequirement) {
      return {
        eligible: false,
        hasClaimedToday: false,
        accountAgeValid: false,
        accountAgeHours,
        message: `Your account must be at least ${settings.viewerMinAccountAgeHours} hours old. Current age: ${accountAgeHours} hours.`
      }
    }

    return {
      eligible: true,
      hasClaimedToday: false,
      accountAgeValid: true,
      accountAgeHours,
      message: `You can earn ${settings.viewerRewardAmount} coins for watching live today!`
    }
  } catch (error) {
    console.error('[ViewerReward] Error getting status:', error)
    return {
      eligible: false,
      hasClaimedToday: false,
      accountAgeValid: false,
      message: 'Error checking reward status'
    }
  }
}

/**
 * Cleanup function to clear all pending rewards
 * Call this on app unload or when user logs out
 */
export function cleanupViewerRewards(): void {
  pendingViewerRewards.forEach((timeout) => clearTimeout(timeout))
  pendingViewerRewards.clear()
  viewerJoinTimes.clear()
  console.log('[ViewerReward] Cleaned up all pending rewards')
}
