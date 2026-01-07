import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import GiftCardFulfillmentList from './components/shared/GiftCardFulfillmentList'

export default function GiftCardsManager() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Gift Cards Manager
          </h1>
          <p className="text-gray-400 mt-1">
            Manage gift card fulfillments and issues
          </p>
        </div>

        <GiftCardFulfillmentList viewMode="admin" />
      </div>
    </div>
  )
}
