/**
 * XP Tracking Hook
 * Centralized XP event tracking for all user actions
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAuthStore } from '../store'
import {
  awardDailyLoginXP,
  awardChatMessageXP,
  awardWatchStreamXP,
  award7DayStreakXP
} from '../xp'
import { evaluateBadgesForUser } from '../../services/badgeEvaluationService'

interface UseXPTrackingOptions {
  enableAutoTracking?: boolean
}

export function useXPTracking(options: UseXPTrackingOptions = {}) {
  const { user } = useAuthStore()
  const { enableAutoTracking = true } = options
  
  // Track if daily login XP has been awarded
  const dailyLoginAwarded = useRef(false)
  
  // Track last chat message time (for 30s cooldown)
  const lastChatTime = useRef<number>(0)
  
  // Track watch time per stream
  const watchTimeTracking = useRef<Map<string, { startTime: number, lastUpdate: number }>>(new Map())

  /**
   * Award daily login XP on mount (once per session)
   */
  useEffect(() => {
    if (!user || !enableAutoTracking || dailyLoginAwarded.current) return
    
    const awardDailyLogin = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const lastLoginKey = `last_login_xp_${user.id}`
        const lastLogin = localStorage.getItem(lastLoginKey)
        
        if (lastLogin !== today) {
          await awardDailyLoginXP(user.id)
          localStorage.setItem(lastLoginKey, today)
          dailyLoginAwarded.current = true
          
          // Check for streak badge
          await evaluateBadgesForUser(user.id)
        }
      } catch (err) {
        console.error('Error awarding daily login XP:', err)
      }
    }
    
    awardDailyLogin()
  }, [user, enableAutoTracking])

  /**
   * Track chat message with 30s cooldown
   */
  const trackChatMessage = useCallback(async (roomId: string) => {
    if (!user) return
    
    const now = Date.now()
    const timeSinceLastChat = now - lastChatTime.current
    
    // 30 second cooldown
    if (timeSinceLastChat < 30000) {
      return
    }
    
    lastChatTime.current = now
    
    try {
      await awardChatMessageXP(user.id, roomId)
      await evaluateBadgesForUser(user.id)
    } catch (err) {
      console.error('Error awarding chat message XP:', err)
    }
  }, [user])

  /**
   * Start tracking watch time for a stream
   */
  const startWatchTracking = useCallback((streamId: string) => {
    if (!user) return
    
    const now = Date.now()
    watchTimeTracking.current.set(streamId, {
      startTime: now,
      lastUpdate: now
    })
  }, [user])

  /**
   * Stop tracking and award XP for watch time
   */
  const stopWatchTracking = useCallback(async (streamId: string) => {
    if (!user) return
    
    const tracking = watchTimeTracking.current.get(streamId)
    if (!tracking) return
    
    const now = Date.now()
    const totalMinutes = Math.floor((now - tracking.startTime) / 60000)
    
    if (totalMinutes > 0) {
      try {
        await awardWatchStreamXP(user.id, totalMinutes, streamId)
        await evaluateBadgesForUser(user.id)
      } catch (err) {
        console.error('Error awarding watch stream XP:', err)
      }
    }
    
    watchTimeTracking.current.delete(streamId)
  }, [user])

  /**
   * Update watch time periodically (e.g., every minute)
   */
  const updateWatchTime = useCallback(async (streamId: string) => {
    if (!user) return
    
    const tracking = watchTimeTracking.current.get(streamId)
    if (!tracking) return
    
    const now = Date.now()
    const minutesSinceLastUpdate = Math.floor((now - tracking.lastUpdate) / 60000)
    
    if (minutesSinceLastUpdate >= 1) {
      try {
        await awardWatchStreamXP(user.id, minutesSinceLastUpdate, streamId)
        tracking.lastUpdate = now
        watchTimeTracking.current.set(streamId, tracking)
      } catch (err) {
        console.error('Error updating watch time XP:', err)
      }
    }
  }, [user])

  /**
   * Track 7-day streak bonus
   */
  const track7DayStreak = useCallback(async (streakCount: number) => {
    if (!user) return
    
    try {
      await award7DayStreakXP(user.id, streakCount)
      await evaluateBadgesForUser(user.id)
    } catch (err) {
      console.error('Error awarding 7-day streak XP:', err)
    }
  }, [user])

  /**
   * Manual XP evaluation trigger
   */
  const evaluateBadges = useCallback(async () => {
    if (!user) return
    
    try {
      await evaluateBadgesForUser(user.id)
    } catch (err) {
      console.error('Error evaluating badges:', err)
    }
  }, [user])

  return {
    trackChatMessage,
    startWatchTracking,
    stopWatchTracking,
    updateWatchTime,
    track7DayStreak,
    evaluateBadges
  }
}
