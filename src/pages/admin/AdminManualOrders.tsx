import React from 'react'
import ManualCoinOrdersList from './components/shared/ManualCoinOrdersList'
import { DollarSign } from 'lucide-react'

export default function AdminManualOrders() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-500/20 p-2 rounded-lg">
          <DollarSign className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Manual Orders</h1>
          <p className="text-slate-400">Review and approve manual coin purchases</p>
        </div>
      </div>

      <div className="bg-[#13111C] rounded-xl border border-white/5 p-6">
        <ManualCoinOrdersList />
      </div>
    </div>
  )
}
