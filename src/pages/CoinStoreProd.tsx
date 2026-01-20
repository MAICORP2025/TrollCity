// src/pages/CoinStoreProd.tsx
// Production-ready PayPal coin purchase component with centralized fulfillment
import React from 'react'
import { useAuthStore } from '../lib/store'
import { AlertCircle, Coins, Wallet } from 'lucide-react'

export default function CoinStoreProd() {
  const { user, profile } = useAuthStore()

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <p>Please sign in to access the Coin Store</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Coins className="w-8 h-8 text-purple-500" />
            Troll Bank Coin Store
          </h1>
          <p className="text-gray-400">
            Current balance: <span className="text-purple-400 font-semibold">{(profile?.troll_coins || 0).toLocaleString()}</span> coins
          </p>
        </div>

        {/* Troll Bank Loan Promo */}
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-xl p-8 text-center mb-12">
          <Wallet className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Need more coins?</h2>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            Apply for a Troll Bank Loan instantly! No external payments required.
            Repay automatically as you earn.
          </p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-coin-store'))}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors"
          >
            Open Troll Bank
          </button>
        </div>
        
        {/* Legacy Packages removed */}

        {/* Security Notice */}
        <div className="mt-12 max-w-2xl mx-auto bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-200">
            ✓ Payments secured by PayPal • ✓ Coins credited server-side • ✓ Fraud protection enabled • ✓ Transaction logging
          </p>
        </div>
      </div>
    </div>
  )
}
