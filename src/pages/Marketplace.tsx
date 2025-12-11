import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Store, ShoppingCart, Coins } from 'lucide-react'

export default function Marketplace() {
  console.log('🛒 Marketplace component rendering')
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }
    loadShops()
  }, [user, navigate])

  const loadShops = async () => {
    setLoading(true)
    try {
      // Load shops first
      const { data: shopsData, error: shopsError } = await supabase
        .from('trollcity_shops')
        .select('*')
        .eq('is_active', true)

      if (shopsError) throw shopsError

      // Load items for each shop
      const shopsWithItems = await Promise.all(
        (shopsData || []).map(async (shop) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('shop_items')
            .select('*')
            .eq('shop_id', shop.id)

          if (itemsError) {
            console.error(`Error loading items for shop ${shop.id}:`, itemsError)
            return { ...shop, shop_items: [] }
          }

          return { ...shop, shop_items: itemsData || [] }
        })
      )

      setShops(shopsWithItems)
    } catch (err) {
      console.error('Error loading shops:', err)
      toast.error('Failed to load marketplace')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Store className="w-8 h-8 text-purple-400" />
            Troll City Marketplace
          </h1>
          <p className="text-gray-400">Discover and purchase items from fellow Troll City members</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Shops Available</h2>
            <p className="text-gray-400 mb-6">Be the first to create a shop and start selling!</p>
            <button
              onClick={() => navigate('/sell')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
            >
              Create Your Shop
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => (
              <div key={shop.id} className="bg-zinc-900 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-purple-300">{shop.name}</h3>
                  <p className="text-sm text-gray-400">by {shop.owner_id}</p>
                </div>

                <div className="space-y-3 mb-4">
                  {shop.shop_items?.length > 0 ? (
                    shop.shop_items.slice(0, 3).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between bg-black/20 p-2 rounded">
                        <span className="text-sm">{item.name}</span>
                        <span className="text-yellow-400 font-bold flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {item.price}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No items listed yet</p>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/shop/${shop.id}`)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Visit Shop
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}