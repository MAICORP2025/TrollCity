import React from 'react'
import { useAuthStore } from '../lib/store'
import { useNavigate } from 'react-router-dom'
import { Settings, Boxes, Sparkles, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { setResetPin } from '@/services/passwordManager'
import UserInventory from './UserInventory'

export default function ProfileSettings() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)

  if (!user) {
    navigate('/auth')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-sm text-gray-400">Manage your items and account preferences.</p>
          </div>
        </div>

        <div className="bg-black/40 border border-purple-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="w-5 h-5 text-purple-300" />
            <h2 className="text-xl font-semibold">My Items</h2>
          </div>
          <UserInventory embedded />
        </div>

        {/* Password Reset PIN */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-semibold">Password Reset PIN</h2>
              <p className="text-xs text-gray-400">Set a 6-digit PIN used to reset your password.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              inputMode="numeric"
              pattern="\\d*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                setPin(v)
              }}
              placeholder="Enter 6-digit PIN"
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white w-48 tracking-widest"
            />
            <button
              disabled={savingPin || pin.length !== 6}
              onClick={async () => {
                if (pin.length !== 6) {
                  toast.error('PIN must be exactly 6 digits')
                  return
                }
                setSavingPin(true)
                const { error } = await setResetPin(pin)
                setSavingPin(false)
                if (error) {
                  toast.error('Failed to save PIN')
                } else {
                  toast.success('Password reset PIN saved')
                  setPin('')
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold disabled:opacity-50"
            >
              {savingPin ? 'Saving...' : 'Save PIN'}
            </button>
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <div>
              <h2 className="text-lg font-semibold">Avatar Customizer</h2>
              <p className="text-xs text-gray-400">Equip clothing and update your look.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/avatar-customizer')}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-semibold"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  )
}
