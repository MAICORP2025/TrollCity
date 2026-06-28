/**
 * React hook wrapper for liveStreamingStore subscriptions.
 * Automatically cleans up all 5 Supabase channels on unmount.
 * Prevents channel leaks when navigating between streaming pages.
 */
import { useEffect } from 'react'
import { useLiveStreamingStore } from '@/stores/liveStreamingStore'

export function useLiveStreamingSubscription(streamId: string | null | undefined) {
  useEffect(() => {
    if (!streamId) return

    // Subscribe to all 5 channels (missions, goals, polls, milestones, energy)
    useLiveStreamingStore.getState().subscribe(streamId)

    // Cleanup: remove all channels when unmounting or stream changes
    return () => {
      useLiveStreamingStore.getState().unsubscribe()
    }
  }, [streamId])
}
