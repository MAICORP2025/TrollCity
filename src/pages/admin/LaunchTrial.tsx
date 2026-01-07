import React, { useEffect, useState } from 'react'
import { getSystemSettings, startLaunchTrial, endTrialEarly, relockPayouts, getCountdown } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import RequireRole from '../../components/RequireRole'
import { UserRole } from '../../lib/supabase'
import { Clock, Lock, Unlock } from 'lucide-react'

export default function LaunchTrial() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<any>(null)
  const [, setTick] = useState(0)
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    const s = await getSystemSettings()
    setSettings(s)
  }

  useEffect(() => {
    void reload()
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const onStart = async () => {
    if (!user?.id) return
    setLoading(true)
    await startLaunchTrial(user.id)
    setLoading(false)
    void reload()
  }
  const onEnd = async () => {
    setLoading(true)
    await endTrialEarly()
    setLoading(false)
    void reload()
  }
  const onRelock = async () => {
    setLoading(true)
    await relockPayouts('Emergency payout lock')
    setLoading(false)
    void reload()
  }

  const locked = Boolean(settings?.payout_lock_enabled)
  const c = getCountdown(settings?.payout_unlock_at || null)

  return (
    <RequireRole roles={[UserRole.ADMIN]}>
      <div className="min-h-screen bg-[#0A0814] text-white px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Launch Trial Mode</h1>
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-400" />
              <div className="font-semibold">
                {locked ? `Locked` : `Unlocked`}
              </div>
            </div>
            <div className="text-sm text-gray-300">
              Unlock at: {settings?.payout_unlock_at ? new Date(settings.payout_unlock_at).toLocaleString() : '—'}
            </div>
            {locked && (
              <div className="text-yellow-300 font-semibold">
                Unlocks in {c.days}d {c.hours}h {c.minutes}m {c.seconds}s
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={onStart}
                disabled={loading}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-semibold flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> Start 14-Day Launch Trial
              </button>
              <button
                onClick={onEnd}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold flex items-center gap-2"
              >
                <Unlock className="w-4 h-4" /> End Trial Early (Unlock Payouts)
              </button>
              <button
                onClick={onRelock}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold"
              >
                Re-lock payouts
              </button>
            </div>
          </div>
        </div>
      </div>
    </RequireRole>
  )
}
