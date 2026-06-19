/**
 * Shared frame cache utilities.
 * Separated from useUserFrame to avoid circular dependencies.
 */

import type { ProfileFrame } from '@/config/profileFrames'

// Global cache for user frame data
export const frameCache = new Map<string, ProfileFrame | null>()

// Listener set for cache invalidation notifications
export const frameListeners = new Set<() => void>()

/** Notify all listeners that the cache changed */
export function notifyFrameListeners() {
  frameListeners.forEach((fn) => fn())
}

/** Invalidate the frame cache for a specific user */
export function invalidateFrameCache(userId: string) {
  frameCache.delete(userId)
  notifyFrameListeners()
}

/** Invalidate the entire frame cache */
export function invalidateAllFrameCache() {
  frameCache.clear()
  notifyFrameListeners()
}
