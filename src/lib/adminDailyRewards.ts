/**
 * Admin Controls for Daily Reward System
 * 
 * Provides admin functions to:
 * - Enable/disable broadcaster/viewer rewards
 * - Adjust coin amounts
 * - Set minimum pool threshold
 * - View reward logs and statistics
 */

import { supabase } from './supabase'
import { getDailyRewardSettings, getDailyRewardStats, type DailyRewardSettings } from './dailyRewardSystem'
import { updateSetting } from './appSettingsStore'

// Setting keys (must match migration)
const SETTING_KEYS = {
  BROADCASTER_ENABLED: 'broadcaster_daily_reward_enabled',
  BROADCASTER_AMOUNT: 'broadcaster_daily_reward_amount',
  BROADCASTER_MIN_DURATION: 'broadcaster_reward_min_duration_seconds',
  VIEWER_ENABLED: 'viewer_daily_reward_enabled',
  VIEWER_AMOUNT: 'viewer_daily_reward_amount',
  VIEWER_MIN_STAY: 'viewer_reward_min_stay_seconds',
  VIEWER_MIN_ACCOUNT_AGE: 'viewer_reward_min_account_age_hours',
  POOL_THRESHOLD: 'daily_reward_pool_threshold',
  POOL_REDUCTION_PCT: 'daily_reward_pool_reduction_pct',
  FAIL_SAFE_MODE: 'daily_reward_fail_safe_mode',
  POOL_BALANCE: 'public_pool_balance'
} as const

/**
 * Check if current user is admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    if (error || !profile) return false

    return profile.role === 'admin' || profile.is_admin === true
  } catch (error) {
    console.error('[AdminDailyRewards] Error checking admin status:', error)
    return false
  }
}

/**
 * Enable or disable broadcaster rewards
 */
export async function setBroadcasterRewardEnabled(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    await updateSetting(SETTING_KEYS.BROADCASTER_ENABLED, enabled)
    console.log(`[AdminDailyRewards] Broadcaster rewards ${enabled ? 'enabled' : 'disabled'}`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting broadcaster reward enabled:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set broadcaster reward amount
 */
export async function setBroadcasterRewardAmount(amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    if (amount < 0 || amount > 10000) {
      return { success: false, error: 'Amount must be between 0 and 10,000' }
    }

    await updateSetting(SETTING_KEYS.BROADCASTER_AMOUNT, amount)
    console.log(`[AdminDailyRewards] Broadcaster reward amount set to ${amount}`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting broadcaster reward amount:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set minimum broadcast duration for broadcaster reward (seconds)
 */
export async function setBroadcasterMinDuration(seconds: number): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    if (seconds < 0 || seconds > 3600) {
      return { success: false, error: 'Duration must be between 0 and 3600 seconds' }
    }

    await updateSetting(SETTING_KEYS.BROADCASTER_MIN_DURATION, seconds)
    console.log(`[AdminDailyRewards] Broadcaster min duration set to ${seconds} seconds`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting broadcaster min duration:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Enable or disable viewer rewards
 */
export async function setViewerRewardEnabled(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    await updateSetting(SETTING_KEYS.VIEWER_ENABLED, enabled)
    console.log(`[AdminDailyRewards] Viewer rewards ${enabled ? 'enabled' : 'disabled'}`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting viewer reward enabled:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set viewer reward amount
 */
export async function setViewerRewardAmount(amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    if (amount < 0 || amount > 10000) {
      return { success: false, error: 'Amount must be between 0 and 10,000' }
    }

    await updateSetting(SETTING_KEYS.VIEWER_AMOUNT, amount)
    console.log(`[AdminDailyRewards] Viewer reward amount set to ${amount}`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting viewer reward amount:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set minimum viewer stay duration (seconds)
 */
export async function setViewerMinStay(seconds: number): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    if (seconds < 0 || seconds > 3600) {
      return { success: false, error: 'Duration must be between 0 and 3600 seconds' }
    }

    await updateSetting(SETTING_KEYS.VIEWER_MIN_STAY, seconds)
    console.log(`[AdminDailyRewards] Viewer min stay set to ${seconds} seconds`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting viewer min stay:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set minimum account age for viewer rewards (hours)
 */
export async function setViewerMinAccountAge(hours: number): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    if (hours < 0 || hours > 8760) { // Max 1 year
      return { success: false, error: 'Hours must be between 0 and 8760 (1 year)' }
    }

    await updateSetting(SETTING_KEYS.VIEWER_MIN_ACCOUNT_AGE, hours)
    console.log(`[AdminDailyRewards] Viewer min account age set to ${hours} hours`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting viewer min account age:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set minimum pool threshold
 */
export async function setPoolThreshold(threshold: number): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    if (threshold < 0) {
      return { success: false, error: 'Threshold must be positive' }
    }

    await updateSetting(SETTING_KEYS.POOL_THRESHOLD, threshold)
    console.log(`[AdminDailyRewards] Pool threshold set to ${threshold}`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting pool threshold:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set pool reduction percentage
 */
export async function setPoolReductionPct(pct: number): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    if (pct < 0 || pct > 100) {
      return { success: false, error: 'Percentage must be between 0 and 100' }
    }

    await updateSetting(SETTING_KEYS.POOL_REDUCTION_PCT, pct)
    console.log(`[AdminDailyRewards] Pool reduction percentage set to ${pct}%`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting pool reduction pct:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set fail-safe mode
 */
export async function setFailSafeMode(mode: 'disable' | 'reduce'): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    await updateSetting(SETTING_KEYS.FAIL_SAFE_MODE, mode)
    console.log(`[AdminDailyRewards] Fail-safe mode set to ${mode}`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error setting fail-safe mode:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Add funds to the public pool
 */
export async function addToPublicPool(amount: number): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    const currentBalance = await getPublicPoolBalanceAdmin()
    const newBalance = currentBalance + amount

    await updateSetting(SETTING_KEYS.POOL_BALANCE, newBalance)
    console.log(`[AdminDailyRewards] Added ${amount} to public pool. New balance: ${newBalance}`)
    
    return { success: true, newBalance }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error adding to public pool:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get public pool balance
 */
export async function getPublicPoolBalanceAdmin(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('admin_app_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEYS.POOL_BALANCE)
      .maybeSingle()

    if (error || !data) {
      return 1000000 // Default balance
    }

    return parseInt(data.setting_value, 10) || 1000000
  } catch (error) {
    console.error('[AdminDailyRewards] Error getting pool balance:', error)
    return 1000000
  }
}

/**
 * Get comprehensive admin dashboard data
 */
export async function getDailyRewardAdminDashboard(): Promise<{
  settings: DailyRewardSettings
  poolBalance: number
  stats: {
    totalRewards: number
    totalCoins: number
    broadcasterRewards: number
    viewerRewards: number
  }
}> {
  try {
    const settings = await getDailyRewardSettings()
    const poolBalance = await getPublicPoolBalanceAdmin()
    const stats = await getDailyRewardStats()

    return {
      settings,
      poolBalance,
      stats: {
        totalRewards: stats.totalRewards,
        totalCoins: stats.totalCoins,
        broadcasterRewards: stats.broadcasterRewards,
        viewerRewards: stats.viewerRewards
      }
    }
  } catch (error) {
    console.error('[AdminDailyRewards] Error getting admin dashboard:', error)
    throw error
  }
}

/**
 * Get reward logs for admin viewing
 */
export async function getRewardLogs(
  limit: number = 100,
  offset: number = 0,
  userId?: string,
  rewardType?: 'broadcaster_daily' | 'viewer_daily',
  startDate?: string,
  endDate?: string
): Promise<{
  logs: Array<{
    id: string
    user_id: string
    reward_type: string
    date: string
    broadcast_id: string | null
    amount: number
    created_at: string
  }>
  total: number
}> {
  try {
    let query = supabase
      .from('daily_rewards')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (rewardType) {
      query = query.eq('reward_type', rewardType)
    }

    if (startDate) {
      query = query.gte('date', startDate)
    }

    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data, count, error } = await query

    if (error) throw error

    return {
      logs: data || [],
      total: count || 0
    }
  } catch (error) {
    console.error('[AdminDailyRewards] Error getting reward logs:', error)
    return { logs: [], total: 0 }
  }
}

/**
 * Reset a user's daily reward (for testing/admin purposes)
 * This allows a user to claim their reward again today
 */
export async function resetUserDailyReward(
  userId: string,
  rewardType: 'broadcaster_daily' | 'viewer_daily'
): Promise<{ success: boolean; error?: string }> {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    const today = new Date().toISOString().split('T')[0]

    const { error: deleteError } = await supabase
      .from('daily_rewards')
      .delete()
      .eq('user_id', userId)
      .eq('reward_type', rewardType)
      .eq('date', today)

    if (deleteError) {
      console.error('[AdminDailyRewards] Error resetting user reward:', deleteError)
      return { success: false, error: deleteError.message }
    }

    console.log(`[AdminDailyRewards] Reset ${rewardType} reward for user ${userId}`)
    return { success: true }
  } catch (error: any) {
    console.error('[AdminDailyRewards] Error resetting user reward:', error)
    return { success: false, error: error.message }
  }
}
