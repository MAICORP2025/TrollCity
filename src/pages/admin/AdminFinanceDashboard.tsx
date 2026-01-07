import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

type FinanceSummary = {
  total_coins_in_circulation: number
  total_gift_coins_spent: number
  total_payouts_processed_usd: number
  total_pending_payouts_usd: number
  total_creator_earned_coins: number
  top_earning_broadcaster: string | null
  total_revenue_usd: number
}

export default function AdminFinanceDashboard() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.from('economy_summary').select('*').single()
      if (error) throw error
      setSummary(data)
    } catch (err: unknown) {
      console.error('Failed to load finance summary:', err)
      setError(err instanceof Error ? err.message : 'Unable to load finance data')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()

    const channel = supabase
      .channel('finance_dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_transactions' }, () => {
        loadSummary()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, () => {
        loadSummary()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests' }, () => {
        loadSummary()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadSummary])

  const summaryItems = [
    {
      label: 'Total Revenue',
      value: summary ? `$${(summary.total_revenue_usd || 0).toLocaleString()}` : '$0',
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      label: 'Coins in Circulation',
      value: summary ? summary.total_coins_in_circulation : 0,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10'
    },
    {
      label: 'Gift Coins Spent',
      value: summary ? summary.total_gift_coins_spent : 0,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10'
    },
    {
      label: 'Processed Payouts',
      value: summary ? `$${(summary.total_payouts_processed_usd || 0).toLocaleString()}` : '$0',
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      label: 'Pending Payouts',
      value: summary ? `$${(summary.total_pending_payouts_usd || 0).toLocaleString()}` : '$0',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10'
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-gray-400 uppercase tracking-[0.4em]">Finance Dashboard</p>
          <h1 className="text-3xl font-bold">Platform Finance Overview</h1>
          <p className="text-sm text-gray-400">
            High level finance metrics pulled from the economy summary view.
          </p>
        </header>

        <div className="bg-[#141414] border border-[#2C2C2C] rounded-2xl p-6 shadow-lg shadow-black/40 space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading finance metrics...
            </div>
          ) : error ? (
            <div className="text-red-400">
              {error}
              <button onClick={loadSummary} className="ml-4 text-xs uppercase tracking-wider text-gray-300">
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className={`border border-[#2C2C2C] rounded-xl p-4 ${item.bg}`}
                  >
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-400 mb-2">{item.label}</p>
                    <p className={`text-xl font-semibold ${item.color}`}>
                      {typeof item.value === 'number'
                        ? item.value.toLocaleString()
                        : item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="border border-[#2C2C2C] rounded-xl p-5 bg-[#0D0D16]">
                  <h2 className="text-lg font-semibold text-white mb-2">Creator Economy</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    {summary?.total_creator_earned_coins.toLocaleString()} coins earned by creators through gifts.
                  </p>
                  <div className="text-xs uppercase tracking-[0.4em] text-gray-400">Top Broadcaster</div>
                  <p className="text-xl font-semibold">
                    {summary?.top_earning_broadcaster || 'N/A'}
                  </p>
                </div>
                <div className="border border-[#2C2C2C] rounded-xl p-5 bg-[#0D0D16]">
                  <h2 className="text-lg font-semibold text-white mb-2">Pending Obligations</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Track funds waiting to be paid out to creators.
                  </p>
                  <p className="text-xl font-semibold text-orange-300">
                    ${summary?.total_pending_payouts_usd.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {summary ? 'Based on live payout requests' : 'Loading data'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
