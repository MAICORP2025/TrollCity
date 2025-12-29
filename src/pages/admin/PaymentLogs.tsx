import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

export default function PaymentLogs() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('coin_transactions')
        .select('id, user_id, amount, type, coin_type, created_at, status, description')
        .order('created_at', { ascending: false })
        .limit(40)

      if (fetchError) {
        throw fetchError
      }

      setPayments(data || [])
    } catch (fetchError: any) {
      console.error('Failed to load payment logs:', fetchError)
      setError(fetchError?.message || 'Unable to load payment history')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col gap-3 mb-6">
          <h1 className="text-3xl font-bold">Payment Logs</h1>
          <p className="text-sm text-gray-400">
            Recent coin transactions recorded for administrative review.
          </p>
        </div>

        <div className="rounded-2xl border border-[#2C2C2C] bg-[#141414] p-6 shadow-lg shadow-black/40">
          {loading ? (
            <div className="flex items-center gap-3 text-gray-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading payment activity...
            </div>
          ) : error ? (
            <div className="text-red-400">
              {error}
              <button
                onClick={loadPayments}
                className="ml-4 px-3 py-1 bg-purple-600 rounded text-xs uppercase tracking-wide"
              >
                Retry
              </button>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-gray-400 text-sm">No recent payments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs uppercase text-gray-400 border-b border-[#2C2C2C]">
                    <th className="py-2">User</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Coin Type</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2C]">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-white/5">
                      <td className="py-2 text-sm text-white">{payment.user_id}</td>
                      <td className="py-2 text-sm text-green-300">
                        {payment.amount?.toLocaleString?.() ?? payment.amount}
                      </td>
                      <td className="py-2 text-sm text-gray-200">{payment.type}</td>
                      <td className="py-2 text-sm text-yellow-300">{payment.coin_type}</td>
                      <td className="py-2 text-sm text-gray-200">{payment.status || 'unknown'}</td>
                      <td className="py-2 text-sm text-gray-400">
                        {payment.created_at
                          ? new Date(payment.created_at).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
