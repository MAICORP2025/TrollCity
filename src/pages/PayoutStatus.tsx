import React, { useEffect, useState } from 'react'
import { getSystemSettings, getCountdown } from '../lib/supabase'
import { Clock } from 'lucide-react'

export default function PayoutStatus() {
  const [settings, setSettings] = useState<any>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const s = await getSystemSettings()
      if (!mounted) return
      setSettings(s)
    }
    void load()
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => {
      mounted = false
      clearInterval(i)
    }
  }, [])

  const locked = Boolean(settings?.payout_lock_enabled)
  const c = getCountdown(settings?.payout_unlock_at || null)

  return (
    <div className="min-h-screen bg-[#0A0814] text-white px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Launch Trial Status</h1>
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <div className="font-semibold">
              {locked ? `Payouts locked` : `Payouts open`}
            </div>
          </div>
          {locked && (
            <div className="text-yellow-300 font-semibold">
              Unlocks in {c.days}d {c.hours}h {c.minutes}m {c.seconds}s
            </div>
          )}
          <div className="bg-black/40 rounded-xl border border-gray-800 p-4 space-y-2">
            <div className="font-bold">Launch Trial Mode (14 Days)</div>
            <div>Coins can be earned and spent immediately.</div>
            <div>Payouts are temporarily locked to measure system stability and prevent fraud.</div>
            <div>Payouts unlock automatically on 1-23-2026</div>
          </div>
        </div>
      </div>
    </div>
  )
}
