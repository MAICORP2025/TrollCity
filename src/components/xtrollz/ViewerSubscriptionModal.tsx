import { useState, useEffect } from 'react'
import { X, Crown, Lock, Eye, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

interface ViewerSubscriptionModalProps {
  streamerId: string
  streamerName: string
  profileImageUrl?: string
  onClose: () => void
  onSubscribed?: () => void
}

export default function ViewerSubscriptionModal({
  streamerId,
  streamerName,
  profileImageUrl,
  onClose,
  onSubscribed,
}: ViewerSubscriptionModalProps) {
  const { user } = useAuthStore()
  const [prices, setPrices] = useState({ subscription_price: 800, private_show_price: 500, tip_message_price: 50, description: '' })
  const [hasSubscription, setHasSubscription] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !streamerId) return
    ;(async () => {
      const { data: priceData } = await supabase.rpc('xtrollz_get_streamer_prices', {
        p_streamer_id: streamerId,
      })
      if (priceData && (priceData as any[]).length > 0) {
        const p = (priceData as any[])[0]
        setPrices({
          subscription_price: p.subscription_price || 800,
          private_show_price: p.private_show_price || 500,
          tip_message_price: p.tip_message_price || 50,
          description: p.description || '',
        })
      }

      const { data: subData } = await supabase.rpc('xtrollz_check_viewer_subscription', {
        p_user_id: user.id,
        p_streamer_id: streamerId,
      })
      if (subData && (subData as any[]).length > 0) {
        const s = (subData as any[])[0]
        setHasSubscription(!!s.has_subscription)
      }
      setLoading(false)
    })()
  }, [user?.id, streamerId])

  const handleSubscribe = async () => {
    if (!user?.id) {
      toast.error('Please sign in to subscribe')
      return
    }
    setSubscribing(true)
    try {
      const { data, error } = await supabase.rpc('xtrollz_buy_viewer_subscription', {
        p_user_id: user.id,
        p_streamer_id: streamerId,
        p_amount: prices.subscription_price,
      })
      if (error) throw error
      const result = (data as any[]) || data
      const row = Array.isArray(result) ? result[0] : result
      if (!row?.success) {
        throw new Error(row?.message || 'Subscription failed')
      }
      toast.success(`Subscribed to ${streamerName} for 6 months!`)
      setHasSubscription(true)
      onSubscribed?.()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to process subscription')
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="" className="h-10 w-10 rounded-full border border-white/10 object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-white">
                {streamerName[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-black text-white">{streamerName}</p>
              <p className="text-xs text-white/60">Subscription Options</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center justify-center">
            <div className="animate-pulse px-4 py-2 rounded bg-black/50 border border-white/10 text-xs font-bold text-white">Loading prices...</div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {prices.description && (
              <p className="text-xs text-white/70 leading-relaxed">{prices.description}</p>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-400/20 bg-purple-500/10">
                    <Crown size={18} className="text-purple-300" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">6-Month Subscription</p>
                    <p className="text-xs text-white/60">Full access to all content</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-amber-300">{prices.subscription_price}</p>
                  <p className="text-[10px] text-white/40">Troll Coins</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-pink-400/20 bg-pink-500/10">
                    <Eye size={18} className="text-pink-300" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Private Show</p>
                    <p className="text-xs text-white/60">One-time private session</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-amber-300">{prices.private_show_price}</p>
                  <p className="text-[10px] text-white/40">Troll Coins</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/10">
                    <Heart size={18} className="text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Tip Message</p>
                    <p className="text-xs text-white/60">Send a highlighted message</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-amber-300">{prices.tip_message_price}</p>
                  <p className="text-[10px] text-white/40">Troll Coins</p>
                </div>
              </div>
            </div>

            {hasSubscription ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-300">
                <Lock size={16} />
                <span className="text-sm font-black">You have an active subscription to {streamerName}</span>
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-black text-white hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
              >
                {subscribing ? 'Processing...' : `Subscribe for ${prices.subscription_price} Troll Coins`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
