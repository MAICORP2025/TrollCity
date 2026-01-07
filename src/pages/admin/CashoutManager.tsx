import React, { useState } from 'react'
import CashoutRequestsList from './components/shared/CashoutRequestsList'
import GiftCardFulfillmentList from './components/shared/GiftCardFulfillmentList'
import { Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, Gift } from 'lucide-react'

export default function CashoutManager() {
  const [activeTab, setActiveTab] = useState<'requests' | 'fulfillment'>('requests')

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Cashout Manager</h1>
            <p className="text-slate-400">Manage payout requests and gift card fulfillment</p>
          </div>
          
          <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'requests' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" /> Requests
            </button>
            <button
              onClick={() => setActiveTab('fulfillment')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'fulfillment' 
                  ? 'bg-purple-600 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gift className="w-4 h-4" /> Fulfillment
            </button>
          </div>
        </div>
        
        {activeTab === 'requests' ? (
          <CashoutRequestsList viewMode="admin" />
        ) : (
          <GiftCardFulfillmentList viewMode="admin" />
        )}
      </div>
    </div>
  )
}
