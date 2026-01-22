import { useState, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { useCoins } from './useCoins'
import { toast } from 'sonner'

interface DailyLoginPostReward {
  success: boolean
  coinsEarned: number
  message: string
  canPostToday: boolean
  lastPostDate?: string
}

/**
 * Hook for managing daily login wall posts with coin rewards
 * Users can post once per day to earn random coins (0-100)
 */
export function useDailyLoginPost() {
  const { user } = useAuthStore()
  const { refreshCoins } = useCoins()
  const [loading, setLoading] = useState(false)
  const [canPostToday, setCanPostToday] = useState(true)
  const [lastPostDate, setLastPostDate] = useState<string | null>(null)

  // Check if user has already posted today
  const checkDailyPostStatus = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('daily_login_posts')
        .select('posted_at')
        .eq('user_id', user.id)
        .gte('posted_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .lte('posted_at', new Date(new Date().setHours(23, 59, 59, 999)).toISOString())
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking daily post status:', error)
        return
      }

      // If there's a record from today, user cannot post
      if (data) {
        setCanPostToday(false)
        setLastPostDate(data.posted_at)
      } else {
        setCanPostToday(true)
        setLastPostDate(null)
      }
    } catch (err) {
      console.error('Error checking daily post status:', err)
      setCanPostToday(true)
    }
  }, [user?.id])

  // Generate random coin reward (0-100)
  const generateRandomReward = useCallback(() => {
    return Math.floor(Math.random() * 101) // 0-100 inclusive
  }, [])

  // Submit daily login post with coin reward
  const submitDailyPost = useCallback(
    async (postId: string): Promise<DailyLoginPostReward> => {
      if (!user?.id) {
        toast.error('You must be logged in to post')
        return {
          success: false,
          coinsEarned: 0,
          message: 'Not logged in',
          canPostToday: false,
        }
      }

      if (!canPostToday) {
        toast.error('You have already posted today. Come back tomorrow!')
        return {
          success: false,
          coinsEarned: 0,
          message: 'Already posted today',
          canPostToday: false,
        }
      }

      setLoading(true)

      try {
        // Generate random coins (0-100)
        const coinsEarned = generateRandomReward()

        // Call Supabase function to record post and award coins
        const { data, error } = await supabase
          .rpc('record_daily_login_post', {
            p_post_id: postId,
            p_coins: coinsEarned,
          })
          .select()
          .single()

        if (error) {
          console.error('Error recording daily post:', error)
          toast.error(error.message || 'Failed to record post')
          return {
            success: false,
            coinsEarned: 0,
            message: error.message || 'Failed to record post',
            canPostToday,
          }
        }

        // Check if the RPC call was successful
        if (!data || !data.success) {
          toast.error(data?.message || 'Failed to record post')
          return {
            success: false,
            coinsEarned: 0,
            message: data?.message || 'Failed to record post',
            canPostToday,
          }
        }

        // Refresh coins in UI
        await refreshCoins()

        // Update local state
        setCanPostToday(false)
        setLastPostDate(new Date().toISOString())

        // Show success toast with coin amount
        toast.success(`🎉 You earned ${data.coins_earned} Troll Coins!`, {
          description: 'Come back tomorrow for another daily post!',
        })

        return {
          success: true,
          coinsEarned: data.coins_earned,
          message: `You earned ${data.coins_earned} Troll Coins!`,
          canPostToday: false,
          lastPostDate: new Date().toISOString(),
        }
      } catch (err) {
        console.error('Error submitting daily post:', err)
        toast.error('An error occurred while posting')
        return {
          success: false,
          coinsEarned: 0,
          message: 'An error occurred',
          canPostToday,
        }
      } finally {
        setLoading(false)
      }
    },
    [user?.id, canPostToday, generateRandomReward, refreshCoins]
  )

  return {
    loading,
    canPostToday,
    lastPostDate,
    checkDailyPostStatus,
    submitDailyPost,
    generateRandomReward,
  }
}
