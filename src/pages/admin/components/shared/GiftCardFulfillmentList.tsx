import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '../../../../lib/store'
import { Gift, Save } from 'lucide-react'

interface GiftCardFulfillmentListProps {
  viewMode: 'admin' | 'secretary'
}

type VisaRedemption = {
  id: string
  user_id: string
  coins_reserved: number
  usd_amount: number
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected'
  giftcard_code: string | null
  created_at: string
  approved_at: string | null
  fulfilled_at: string | null
  rejected_at: string | null
}

export default function GiftCardFulfillmentList({ viewMode: _viewMode }: GiftCardFulfillmentListProps) {
  const { user: _user } = useAuthStore()
  const [redemptions, setRedemptions] = useState<VisaRedemption[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [giftCode, setGiftCode] = useState<string>('')

  const fetchFulfillments = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('visa_redemptions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRedemptions((data as any) || [])
    } catch (error) {
      console.error('Error fetching visa redemptions:', error)
      toast.error('Failed to load redemptions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFulfillments()
  }, [fetchFulfillments])

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase.rpc('approve_visa_redemption', { p_redemption_id: id })
      if (error) throw error
      toast.success('Redemption approved')
      fetchFulfillments()
    } catch (e) {
      console.error(e)
      toast.error('Failed to approve redemption')
    }
  }

  const handleFulfill = async (id: string) => {
    try {
      if (!giftCode || giftCode.trim().length < 6) {
        toast.error('Enter a valid gift card code')
        return
      }
      const { error } = await supabase.rpc('fulfill_visa_redemption', { p_redemption_id: id, p_giftcard_code: giftCode.trim() })
      if (error) throw error
      toast.success('Redemption fulfilled')
      setEditingId(null)
      setGiftCode('')
      fetchFulfillments()
    } catch (error) {
      console.error(error)
      toast.error('Failed to fulfill redemption')
    }
  }

  const handleReject = async (id: string) => {
    try {
      const reason = window.prompt('Enter rejection reason (optional):') || null
      const { error } = await supabase.rpc('reject_visa_redemption', { p_redemption_id: id, p_reason: reason })
      if (error) throw error
      toast.success('Redemption rejected')
      fetchFulfillments()
    } catch (error) {
      console.error(error)
      toast.error('Failed to reject redemption')
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-400" />
          Visa eGift Redemptions
        </h2>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-slate-400">Loading...</div>
        ) : redemptions.length === 0 ? (
          <div className="text-center text-slate-400">No redemptions</div>
        ) : (
          redemptions.map(item => (
            <div key={item.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              {editingId === item.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">Gift Card Code</label>
                    <input 
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
                      value={giftCode}
                      onChange={e => setGiftCode(e.target.value)}
                      placeholder="Enter gift card code"
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                    <button 
                      onClick={() => { setEditingId(null); setGiftCode('') }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleFulfill(item.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Fulfill
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-white">${item.usd_amount} • {item.coins_reserved.toLocaleString()} coins</h3>
                    <p className="text-sm text-slate-400">
                      User: {item.user_id}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === 'fulfilled' ? 'bg-green-500/20 text-green-300' :
                        item.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                        item.status === 'approved' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                      {item.giftcard_code && item.status === 'fulfilled' && (
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                          Code: {item.giftcard_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'pending' && (
                      <button 
                        onClick={() => handleApprove(item.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                      >
                        Approve
                      </button>
                    )}
                    {(item.status === 'pending' || item.status === 'approved') && (
                      <button 
                        onClick={() => { setEditingId(item.id); setGiftCode(item.giftcard_code || '') }}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded"
                      >
                        Fulfill
                      </button>
                    )}
                    {item.status !== 'fulfilled' && item.status !== 'rejected' && (
                      <button 
                        onClick={() => handleReject(item.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
