import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { CheckCircle, Shield } from 'lucide-react'

export default function AIVerificationPage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Please log in to get verified</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Log In
          </button>
        </div>
      </div>
    )
  }
  if (profile?.is_verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="max-w-lg mx-auto bg-[#1A1A1A] border-2 border-green-500/30 rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">You&apos;re Already Verified!</h1>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg mt-4"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
      <div className="max-w-lg mx-auto bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Verification</h1>
        </div>
        <p className="opacity-80 mb-6">
          ID verification is now handled by our standard verification flow. AI-based ID checks are no longer required.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/verification')}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
          >
            Go to Verification
          </button>
          <button
            onClick={() => navigate('/profile/setup')}
            className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold border border-purple-500/60"
          >
            Manage ID in Profile Setup
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-transparent hover:bg-white/5 rounded-lg font-semibold border border-white/20"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  )
}

