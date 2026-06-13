import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

const DEFAULT_TIMER_SECONDS = 120 // 2 minutes default

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function useAuctionTimer(lotId: string | null, isAuctioneer: boolean) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Clear interval helper
  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Start the countdown locally — also used by realtime handler
  const startCountdown = useCallback((fromSeconds: number) => {
    clearTimerInterval()
    setSecondsLeft(fromSeconds)
    setIsRunning(true)
    setIsExpired(false)
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimerInterval()
          setIsRunning(false)
          setIsExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearTimerInterval])

  // Expose intervalRef via a ref so the realtime handler can restart intervals
  const intervalRefStable = useRef(intervalRef)
  useEffect(() => { intervalRefStable.current = intervalRef }, [])

  // Use refs for callbacks so the realtime effect only depends on lotId
  const startCountdownRef = useRef(startCountdown)
  const clearTimerIntervalRef = useRef(clearTimerInterval)
  useEffect(() => { startCountdownRef.current = startCountdown }, [startCountdown])
  useEffect(() => { clearTimerIntervalRef.current = clearTimerInterval }, [clearTimerInterval])

  // Subscribe to real-time timer updates
  useEffect(() => {
    if (!lotId) return

    // Fetch initial timer state from DB
    supabase
      .from('auction_lots')
      .select('countdown_end_at, status')
      .eq('id', lotId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.countdown_end_at) {
          const diff = Math.max(0, Math.ceil((new Date(data.countdown_end_at).getTime() - Date.now()) / 1000))
          if (diff > 0 && data.status === 'live') {
            startCountdownRef.current(diff)
          } else if (diff <= 0) {
            setIsExpired(true)
            setSecondsLeft(0)
          }
        }
      })

    // Subscribe to changes on this specific lot
    const channel = supabase
      .channel(`auction-timer:${lotId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auction_lots',
          filter: `id=eq.${lotId}`,
        },
        (payload: any) => {
          const newLot = payload.new
          clearTimerIntervalRef.current()
          if (newLot.countdown_end_at) {
            const diff = Math.max(0, Math.ceil((new Date(newLot.countdown_end_at).getTime() - Date.now()) / 1000))
            if (diff > 0 && newLot.status === 'live') {
              setSecondsLeft(diff)
              setIsRunning(true)
              setIsExpired(false)
              intervalRefStable.current.current = setInterval(() => {
                setSecondsLeft((prev) => {
                  if (prev <= 1) {
                    clearTimerIntervalRef.current()
                    setIsRunning(false)
                    setIsExpired(true)
                    return 0
                  }
                  return prev - 1
                })
              }, 1000)
            } else if (diff <= 0) {
              setSecondsLeft(0)
              setIsRunning(false)
              setIsExpired(true)
            }
          } else {
            setSecondsLeft(0)
            setIsRunning(false)
            setIsExpired(false)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      clearTimerIntervalRef.current()
      supabase.removeChannel(channel)
    }
  }, [lotId])

  // Auctioneer: Start timer
  const startTimer = useCallback(async (durationSeconds: number = DEFAULT_TIMER_SECONDS) => {
    if (!lotId || !isAuctioneer) return
    const endAt = new Date(Date.now() + durationSeconds * 1000).toISOString()
    const { error } = await supabase
      .from('auction_lots')
      .update({ countdown_end_at: endAt, updated_at: new Date().toISOString() })
      .eq('id', lotId)
    if (error) {
      toast.error('Failed to start timer')
      return
    }
    startCountdown(durationSeconds)
    toast.success(`Timer started: ${formatCountdown(durationSeconds)}`)
  }, [lotId, isAuctioneer, startCountdown])

  // Auctioneer: Pause timer
  const pauseTimer = useCallback(async () => {
    if (!lotId || !isAuctioneer) return
    clearTimerInterval()
    setIsRunning(false)
    // Store remaining time so we can resume
    if (secondsLeft > 0) {
      const endAt = new Date(Date.now() + secondsLeft * 1000).toISOString()
      await supabase
        .from('auction_lots')
        .update({ countdown_end_at: endAt, updated_at: new Date().toISOString() })
        .eq('id', lotId)
    }
    toast.info('Timer paused')
  }, [lotId, isAuctioneer, secondsLeft, clearTimerInterval])

  // Auctioneer: Resume timer
  const resumeTimer = useCallback(async () => {
    if (!lotId || !isAuctioneer || secondsLeft <= 0) return
    const endAt = new Date(Date.now() + secondsLeft * 1000).toISOString()
    const { error } = await supabase
      .from('auction_lots')
      .update({ countdown_end_at: endAt, updated_at: new Date().toISOString() })
      .eq('id', lotId)
    if (error) {
      toast.error('Failed to resume timer')
      return
    }
    startCountdown(secondsLeft)
    toast.success('Timer resumed')
  }, [lotId, isAuctioneer, secondsLeft, startCountdown])

  // Auctioneer: Reset timer
  const resetTimer = useCallback(async () => {
    if (!lotId || !isAuctioneer) return
    clearTimerInterval()
    setSecondsLeft(0)
    setIsRunning(false)
    setIsExpired(false)
    const { error } = await supabase
      .from('auction_lots')
      .update({ countdown_end_at: null, updated_at: new Date().toISOString() })
      .eq('id', lotId)
    if (error) {
      toast.error('Failed to reset timer')
      return
    }
    toast.info('Timer reset')
  }, [lotId, isAuctioneer, clearTimerInterval])

  // Auctioneer: Add time
  const addTime = useCallback(async (extraSeconds: number) => {
    if (!lotId || !isAuctioneer) return
    const currentEnd = secondsLeft > 0 ? secondsLeft : 0
    const newTotal = currentEnd + extraSeconds
    const endAt = new Date(Date.now() + newTotal * 1000).toISOString()
    const { error } = await supabase
      .from('auction_lots')
      .update({ countdown_end_at: endAt, updated_at: new Date().toISOString() })
      .eq('id', lotId)
    if (error) {
      toast.error('Failed to add time')
      return
    }
    if (isRunning) {
      startCountdown(newTotal)
    } else {
      setSecondsLeft(newTotal)
    }
    toast.success(`+${extraSeconds}s added`)
  }, [lotId, isAuctioneer, secondsLeft, isRunning, startCountdown])

  return {
    secondsLeft,
    isRunning,
    isExpired,
    formatted: formatCountdown(secondsLeft),
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    addTime,
  }
}
