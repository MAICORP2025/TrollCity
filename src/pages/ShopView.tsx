import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Store, ShoppingCart, Coins, ArrowLeft, Package } from 'lucide-react'

export default function ShopView() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [shop, setShop] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }
    if (id) {
      loadShop()
    }
  }, [user, id, navigate])

  const loadShop = async () => {
    if (!id) return

    setLoading(true)
    try {
      // Load shop details
      const { data: shopData, error: shopError } = await supabase
        .from('trollcity_shops')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single()

      if (shopError) throw shopError
      if (!shopData) {
        toast.error('Shop not found')
        navigate('/marketplace')
        return
      }

      setShop(shopData)

      // Load shop items
      const { data: itemsData, error: itemsError } = await supabase
        .from('shop_items')
        .select('*')
        .eq('shop_id', id)
        .order('created_at', { ascending: false })

      if (itemsError) throw itemsError
      setItems(itemsData || [])

    } catch (err) {
      console.error('Error loading shop:', err)
      toast.error('Failed to load shop')
      navigate('/marketplace')
    } finally {
      setLoading(false)
    }
  }

  const purchaseItem = async (item: any) => {
    if (!user) return

    setPurchasing(item.id)
    try {
      // Check if user has enough coins
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance')
        .eq('id', user.id)
        .single()

      const totalCoins = (profile?.paid_coin_balance || 0) + (profile?.free_coin_balance || 0)

      if (totalCoins < item.price) {
        toast.error('Not enough coins!')
        return
      }

      // Deduct coins
      const { error: deductError } = await supabase.rpc('deduct_coins', {
        p_user_id: user.id,
        p_amount: item.price,
        p_coin_type: 'paid' // Prefer paid coins first
      })

      if (deductError) throw deductError

      // Create purchase record
      const { error: purchaseError } = await supabase
        .from('marketplace_purchases')
        .insert([{
          buyer_id: user.id,
          seller_id: shop.owner_id,
          item_id: item.id,
          price_paid: item.price,
          platform_fee: Math.floor(item.price * 0.1), // 10% platform fee
          seller_earnings: item.price - Math.floor(item.price * 0.1)
        }])

      if (purchaseError) throw purchaseError

      // Add to user inventory
      const { error: inventoryError } = await supabase
        .from('user_inventory')
        .insert([{
          user_id: user.id,
          item_id: item.id,
          acquired_at: new Date().toISOString()
        }])

      if (inventoryError) throw inventoryError

      toast.success(`Purchased ${item.name}!`)
      navigate('/inventory') // Redirect to inventory

    } catch (err: any) {
      console.error('Purchase error:', err)
      toast.error('Purchase failed: ' + err.message)
    } finally {
      setPurchasing(null)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
                  <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Store className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Shop Not Found</h2>
          <p className="text-gray-400 mb-6">This shop may have been removed or is no longer available.</p>
          <button
            onClick={() => navigate('/marketplace')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/marketplace')}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Store className="w-8 h-8 text-purple-400" />
                {shop.name}
              </h1>
              <p className="text-gray-400">Browse and purchase items from this shop</p>
            </div>
          </div>
        </div>

        {/* Shop Info */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-purple-300">{shop.name}</h2>
              <p className="text-gray-400">Shop ID: {shop.id}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Items Available</p>
              <p className="text-2xl font-bold text-green-400">{items.length}</p>
            </div>
          </div>
        </div>

        {/* Items Grid */}
        {items.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Items Available</h2>
            <p className="text-gray-400">This shop doesn't have any items listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-zinc-900 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-32 object-cover rounded-lg mb-4"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-purple-300 mb-2">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-400 mb-3">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="text-xl font-bold text-yellow-400">{item.price.toLocaleString()}</span>
                    <span className="text-sm text-gray-400">Troll Coins</span>
                  </div>
                </div>

                <button
                  onClick={() => purchaseItem(item)}
                  disabled={purchasing === item.id}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {purchasing === item.id ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Purchase
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}