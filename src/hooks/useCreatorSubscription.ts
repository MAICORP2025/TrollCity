import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

export function useCreatorSubscription(broadcasterId?: string, userId?: string) {
  const { user } = useAuthStore()
  const targetBroadcasterId = broadcasterId
  const targetUserId = userId || user?.id

  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  const checkSubscription = useCallback(async () => {
    if (!targetBroadcasterId || !targetUserId) {
      setIsSubscribed(false)
      return
    }

    setLoading(true)
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('subscriber_id', targetUserId)
        .eq('broadcaster_id', targetBroadcasterId)
        .eq('is_active', true)
        .maybeSingle()

      setIsSubscribed(!!data)
    } catch {
      setIsSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [targetBroadcasterId, targetUserId])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

  return { isSubscribed, loading, refresh: checkSubscription }
}

export function useSubscriberUsernames(broadcasterId?: string) {
  const [usernames, setUsernames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!broadcasterId) {
      setUsernames(new Set())
      return
    }

    setLoading(true)
    supabase
      .from('user_subscriptions')
      .select(`
        subscriber_id,
        user_profiles:subscriber_id (username)
      `)
      .eq('broadcaster_id', broadcasterId)
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) {
          const nameSet = new Set<string>()
          data.forEach((row: any) => {
            if (row.user_profiles?.username) {
              nameSet.add(row.user_profiles.username)
            }
          })
          setUsernames(nameSet)
        }
      })
      .catch((err) => {
        console.error('[useSubscriberUsernames] error:', err)
        setUsernames(new Set())
      })
      .finally(() => setLoading(false))
  }, [broadcasterId])

  return { subscriberUsernames: usernames, loading }
}

export function useSubscriberBadges(broadcasterId?: string) {
  const { subscriberUsernames, loading } = useSubscriberUsernames(broadcasterId)

  const isSubscriber = useCallback((username: string) => {
    return subscriberUsernames.has(username)
  }, [subscriberUsernames])

  return { isSubscriber, loading }
}