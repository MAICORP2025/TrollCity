import React, { useEffect, useState } from 'react'
import { getSystemSettings, getCountdown } from '../lib/supabase'
import { Clock } from 'lucide-react'

export default function GlobalPayoutBanner() {
  const [locked, setLocked] = useState(false)
  const [unlockAt, setUnlockAt] = useState<string | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const s = await getSystemSettings()
      if (!mounted) return
      setLocked(Boolean(s?.payout_lock_enabled))
      setUnlockAt(s?.payout_unlock_at || null)
    }
    void load()
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => {
      mounted = false
      clearInterval(i)
    }
  }, [])

  if (!locked) return null
  const c = getCountdown(unlockAt)

  return (
    <div className="w-full bg-yellow-900/30 border-b border-yellow-500/40 text-yellow-200">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <Clock className="w-5 h-5 text-yellow-300" />
        <div className="flex-1">
          <span className="font-semibold">Payouts locked: unlocks in {c.days}d {c.hours}h {c.minutes}m {c.seconds}s</span>
        </div>
      </div>
    </div>
  )
}
