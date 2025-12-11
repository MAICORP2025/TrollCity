import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Gift, Sparkles, Sticker, Zap, ShoppingBag, Loader2 } from 'lucide-react'

interface TrollmondItem {
  id: string
  name: string
  icon: string
  value: number
  description: string
  category: string
}

export default function TrollmondsStore() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [items, setItems] = useState<TrollmondItem[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('gift_items')
        .select('*')
        .eq('currency', 'trollmonds')
        .order('value', { ascending: true })
      
      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Error loading items:', err)
    } finally {
      setLoading(false)
    }
  }

  const buyItem = async (item: TrollmondItem) => {
    if (!user || !profile) return toast.error('Please log in')
    if ((profile.free_coin_balance || 0) < item.value) return toast.error('Not enough Trollmonds')

    setPurchasing(item.id)
    try {
      const { data, error } = await supabase.rpc('purchase_inventory_item', {
        p_user_id: user.id,
        p_item_id: item.id,
        p_quantity: 1
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error)

      toast.success(`Purchased ${item.name}! Added to inventory.`)
      await refreshProfile() // Update balance
    } catch (err: any) {
      console.error('Purchase error:', err)
      toast.error(err.message || 'Failed to purchase')
    } finally {
      setPurchasing(null)
    }
  }

  const categories = [
    { id: 'Small Gifts', icon: Gift, label: 'Small Gifts' },
    { id: 'Fun Animations', icon: Sparkles, label: 'Fun Animations' },
    { id: 'Chat Stickers', icon: Sticker, label: 'Chat Stickers' },
    { id: 'Mini Effects', icon: Zap, label: 'Mini Effects' }
  ]

  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, TrollmondItem[]>)

  if (loading) return (
    <div className="min-h-screen bg-[#0A0814] flex items-center justify-center text-white">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShoppingBag className="text-green-400" />
              Trollmonds Store
            </h1>
            <p className="text-gray-400">Spend your Trollmonds on exclusive items!</p>
          </div>
          
          <div className="bg-[#1A1A1A] px-6 py-3 rounded-xl border border-green-500/30 flex items-center gap-3">
            <span className="text-gray-400 text-sm">Your Balance</span>
            <span className="text-2xl font-bold text-green-400">
              {(profile?.free_coin_balance || 0).toLocaleString()}
            </span>
            <span className="text-xs text-green-500/70">Trollmonds</span>
          </div>
        </div>

        <div className="space-y-10">
          {categories.map(cat => {
            const catItems = groupedItems[cat.id]
            if (!catItems?.length) return null
            const Icon = cat.icon

            return (
              <div key={cat.id}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-300 border-b border-purple-500/20 pb-2">
                  <Icon className="w-5 h-5" />
                  {cat.label}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {catItems.map(item => (
                    <div key={item.id} className="bg-[#15151A] rounded-xl p-4 border border-[#2C2C2C] hover:border-purple-500/50 transition-all group">
                      <div className="text-4xl text-center mb-3">{item.icon}</div>
                      <h3 className="font-semibold text-center mb-1 truncate">{item.name}</h3>
                      <p className="text-xs text-gray-500 text-center mb-3 h-8 line-clamp-2">{item.description}</p>
                      <button
                        onClick={() => buyItem(item)}
                        disabled={!!purchasing}
                        className="w-full py-2 bg-green-900/30 hover:bg-green-600 text-green-400 hover:text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        {purchasing === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Buy'}
                        {item.value} 💎
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
