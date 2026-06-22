import { useEffect, useRef, useCallback } from 'react'
import { registerPolling, unregisterPolling } from '../lib/realtime/RealtimeManager'

interface UseVisibilityPollingOptions {
  id: string
  label: string
  callback: () => void
  intervalMs: number
  /** If true, polling only runs when tab is visible. Defaults to true. */
  visibilityOnly?: boolean
  /** If true, starts paused. Defaults to false. */
  paused?: boolean
}

/**
 * A visibility-aware polling hook that:
 * - Pauses polling when the tab is backgrounded (if visibilityOnly=true)
 * - Registers itself in the global polling registry for monitoring
 * - Cleans up on unmount
 */
export function useVisibilityPolling({
  id,
  label,
  callback,
  intervalMs,
  visibilityOnly = true,
  paused = false,
}: UseVisibilityPollingOptions) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const tick = useCallback(() => {
    if (pausedRef.current) return
    if (visibilityOnly && document.visibilityState !== 'visible') return
    callbackRef.current()
  }, [visibilityOnly])

  useEffect(() => {
    registerPolling(id, label, intervalMs, id, visibilityOnly)

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    intervalRef.current = setInterval(tick, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      unregisterPolling(id)
    }
  }, [id, label, intervalMs, tick, visibilityOnly])

  /** Manually pause/resume polling */
  const setPaused = useCallback((value: boolean) => {
    pausedRef.current = value
  }, [])

  return { setPaused }
}
