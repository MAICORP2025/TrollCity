import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  Crown,
  Gift,
  History,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RedemptionRecord {
  id: string
  user_id: string
  reward_type: 'troll_coins' | 'gift_card'
  crowns_redeemed: number
  reward_value: string
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled'
  email_sent: boolean
  fulfilled_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type RedemptionTab = 'convert' | 'gift_cards' | 'history'

interface GiftCardTier {
  min: number
  max: number
  reward: string
  color: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GIFT_CARD_TIERS: GiftCardTier[] = [
  { min: 101, max: 200, reward: '$10 Gift Card', color: 'from-blue-500 to-cyan-500' },
  { min: 201, max: 300, reward: '$20 Gift Card', color: 'from-purple-500 to-pink-500' },
  { min: 301, max: 500, reward: '$30 Gift Card', color: 'from-amber-500 to-orange-500' },
  { min: 501, max: 750, reward: '$50 Gift Card', color: 'from-emerald-500 to-teal-500' },
  { min: 751, max: 1000, reward: '$75 Gift Card', color: 'from-rose-500 to-red-500' },
  { min: 1001, max: Infinity, reward: '$100 Gift Card', color: 'from-yellow-400 to-amber-500' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function CrownRedemption() {
  const { user, profile } = useAuthStore()
  const navigate = (useNavigate as any)()

  // State
  const [activeTab, setActiveTab] = useState<RedemptionTab>('convert')
  const [crownBalance, setCrownBalance] = useState(0)
  const [convertAmount, setConvertAmount] = useState('')
  const [selectedGiftTier, setSelectedGiftTier] = useState<GiftCardTier | null>(null)
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<'convert' | 'gift_card' | null>(null)

  // ── Fetch crown balance ──────────────────────────────────────────────────

  const fetchCrownBalance = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('crowns')
        .eq('id', user.id)
        .single()
      setCrownBalance(data?.crowns ?? profile?.crowns ?? 0)
    } catch (err) {
      console.warn('[CrownRedemption] Failed to fetch crown balance:', err)
    }
  }, [user?.id, profile?.crowns])

  // ── Fetch redemption history ─────────────────────────────────────────────

  const fetchRedemptions = useCallback(async () => {
    if (!user?.id) return
    setHistoryLoading(true)
    try {
      const { data } = await supabase
        .from('crown_redemptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setRedemptions(data || [])
    } catch (err) {
      console.warn('[CrownRedemption] Failed to fetch redemptions:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchCrownBalance()
    fetchRedemptions()
  }, [fetchCrownBalance, fetchRedemptions])

  // ── Convert crowns to troll coins ─────────────────────────────────────────

  const handleConvertCoins = useCallback(async () => {
    const amount = parseInt(convertAmount, 10)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (amount > crownBalance) {
      toast.error('Insufficient crowns')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('redeem_crowns_for_coins', {
        p_user_id: user!.id,
        p_crowns: amount,
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Converted ${amount} crowns to ${amount} Troll Coins!`)
        setConvertAmount('')
        setShowConfirmModal(false)
        fetchCrownBalance()
        fetchRedemptions()
        // Refresh profile to update coin balance
        useAuthStore.getState().refreshProfile()
      } else {
        toast.error(data?.error || 'Conversion failed')
      }
    } catch (err: any) {
      console.error('[CrownRedemption] Convert error:', err)
      toast.error(err?.message || 'Failed to convert crowns')
    } finally {
      setLoading(false)
    }
  }, [convertAmount, crownBalance, user?.id, fetchCrownBalance, fetchRedemptions])

  // ── Redeem crowns for gift card ──────────────────────────────────────────

  const handleGiftCardRedeem = useCallback(async () => {
    if (!selectedGiftTier) return
    const amount = selectedGiftTier.min

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('redeem_crowns_for_gift_card', {
        p_user_id: user!.id,
        p_crowns: amount,
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Redeemed ${amount} crowns for ${selectedGiftTier.reward}! Your request is pending admin review.`)
        setSelectedGiftTier(null)
        setShowConfirmModal(false)
        fetchCrownBalance()
        fetchRedemptions()
      } else {
        toast.error(data?.error || 'Redemption failed')
      }
    } catch (err: any) {
      console.error('[CrownRedemption] Gift card error:', err)
      toast.error(err?.message || 'Failed to redeem crowns')
    } finally {
      setLoading(false)
    }
  }, [selectedGiftTier, user?.id, fetchCrownBalance, fetchRedemptions])

  // ── Cancel pending redemption ────────────────────────────────────────────

  const handleCancelRedemption = useCallback(async (redemptionId: string) => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('cancel_redemption', {
        p_redemption_id: redemptionId,
        p_user_id: user.id,
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Redemption cancelled. ${data.crowns_refunded} crowns refunded.`)
        fetchCrownBalance()
        fetchRedemptions()
      } else {
        toast.error(data?.error || 'Failed to cancel')
      }
    } catch (err: any) {
      console.error('[CrownRedemption] Cancel error:', err)
      toast.error(err?.message || 'Failed to cancel redemption')
    } finally {
      setLoading(false)
    }
  }, [user?.id, fetchCrownBalance, fetchRedemptions])

  // ── Confirm action ───────────────────────────────────────────────────────

  const handleConfirmAction = useCallback(() => {
    if (pendingAction === 'convert') {
      handleConvertCoins()
    } else if (pendingAction === 'gift_card') {
      handleGiftCardRedeem()
    }
    setPendingAction(null)
  }, [pendingAction, handleConvertCoins, handleGiftCardRedeem])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fulfilled': return 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
      case 'approved': return 'text-cyan-300 border-cyan-400/30 bg-cyan-500/10'
      case 'pending': return 'text-amber-300 border-amber-400/30 bg-amber-500/10'
      case 'rejected': return 'text-red-300 border-red-400/30 bg-red-500/10'
      case 'cancelled': return 'text-slate-400 border-slate-400/30 bg-slate-500/10'
      default: return 'text-slate-400 border-slate-400/30 bg-slate-500/10'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fulfilled': return <CheckCircle2 className="h-3.5 w-3.5" />
      case 'approved': return <Sparkles className="h-3.5 w-3.5" />
      case 'pending': return <Loader2 className="h-3.5 w-3.5 animate-spin" />
      case 'rejected': return <X className="h-3.5 w-3.5" />
      case 'cancelled': return <Trash2 className="h-3.5 w-3.5" />
      default: return null
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const tabs: { key: RedemptionTab; label: string; icon: React.ElementType }[] = [
    { key: 'convert', label: 'Convert', icon: Coins },
    { key: 'gift_cards', label: 'Gift Cards', icon: Gift },
    { key: 'history', label: 'History', icon: History },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.15),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.10),transparent_50%)]" />

      <div className="relative mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/25 bg-amber-400/10">
              <Crown className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-black">Crown Redemption</h1>
              <p className="text-xs text-slate-400">Redeem your crowns for rewards</p>
            </div>
          </div>
        </div>

        {/* Crown Balance Card */}
        <div className="mb-6 rounded-3xl border border-amber-300/20 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/15">
                <Crown className="h-7 w-7 text-amber-300" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300/70">Your Crowns</p>
                <p className="text-3xl font-black text-white">{crownBalance.toLocaleString()}</p>
              </div>
            </div>
            <button
              onClick={() => { fetchCrownBalance(); fetchRedemptions() }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition',
                activeTab === tab.key
                  ? 'bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Convert to Troll Coins ─────────────────────────────────── */}
        {activeTab === 'convert' && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-cyan-400/15 bg-slate-950/70 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10">
                  <Coins className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Convert to Troll Coins</h3>
                  <p className="text-xs text-slate-400">1 Crown = 1 Troll Coin (instant)</p>
                </div>
              </div>

              {/* Quick amounts */}
              <div className="mb-4 grid grid-cols-4 gap-2">
                {[1, 5, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setConvertAmount(String(amt))}
                    disabled={amt > crownBalance}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-bold transition',
                      convertAmount === String(amt)
                        ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                      amt > crownBalance && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {amt}
                  </button>
                ))}
                <button
                  onClick={() => setConvertAmount(String(crownBalance))}
                  disabled={crownBalance <= 0}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-xs font-bold transition',
                    'border-amber-300/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20',
                    crownBalance <= 0 && 'cursor-not-allowed opacity-40',
                  )}
                >
                  Max
                </button>
              </div>

              {/* Custom amount input */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-bold text-slate-400">Custom Amount</label>
                <input
                  type="number"
                  min={1}
                  max={crownBalance}
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  placeholder="Enter crowns to convert..."
                  className="w-full rounded-xl border border-cyan-300/15 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/50"
                />
              </div>

              {/* Preview */}
              {convertAmount && parseInt(convertAmount, 10) > 0 && (
                <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">You convert</span>
                    <span className="font-bold text-amber-300">{parseInt(convertAmount, 10).toLocaleString()} Crowns</span>
                  </div>
                  <div className="my-2 h-px bg-white/10" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">You receive</span>
                    <span className="font-bold text-cyan-300">{parseInt(convertAmount, 10).toLocaleString()} Troll Coins</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  const amt = parseInt(convertAmount, 10)
                  if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
                  if (amt > crownBalance) { toast.error('Insufficient crowns'); return }
                  setPendingAction('convert')
                  setShowConfirmModal(true)
                }}
                disabled={!convertAmount || parseInt(convertAmount, 10) <= 0 || parseInt(convertAmount, 10) > crownBalance}
                className="w-full rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Convert to Troll Coins
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Gift Card Rewards ──────────────────────────────────────── */}
        {activeTab === 'gift_cards' && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-purple-400/15 bg-slate-950/70 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-purple-300/25 bg-purple-400/10">
                  <Gift className="h-5 w-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Gift Card Rewards</h3>
                  <p className="text-xs text-slate-400">Minimum 101 crowns required. Manually fulfilled by Troll City.</p>
                </div>
              </div>

              {/* Gift card tiers */}
              <div className="space-y-2">
                {GIFT_CARD_TIERS.map((tier) => {
                  const isSelected = selectedGiftTier?.reward === tier.reward
                  const isAvailable = crownBalance >= tier.min

                  return (
                    <button
                      key={tier.reward}
                      onClick={() => isAvailable && setSelectedGiftTier(isSelected ? null : tier)}
                      disabled={!isAvailable}
                      className={cn(
                        'flex w-full items-center justify-between rounded-2xl border p-4 transition',
                        isSelected
                          ? 'border-purple-300/40 bg-purple-500/15 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                        !isAvailable && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br', tier.color)}>
                          <Gift className="h-5 w-5 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black">{tier.reward}</p>
                          <p className="text-[10px] text-slate-400">
                            {tier.max === Infinity ? `${tier.min}+` : `${tier.min}–${tier.max}`} Crowns
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        'h-5 w-5 rounded-full border-2 transition',
                        isSelected
                          ? 'border-purple-400 bg-purple-400'
                          : 'border-slate-600',
                      )}>
                        {isSelected && <CheckCircle2 className="h-full w-full text-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Selected tier info */}
              {selectedGiftTier && (
                <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/5 p-3">
                  <p className="text-xs text-amber-200">
                    <strong>{selectedGiftTier.min}</strong> crowns will be deducted.
                    You'll receive a <strong>{selectedGiftTier.reward}</strong> via email after admin approval.
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  if (!selectedGiftTier) { toast.error('Select a gift card tier'); return }
                  setPendingAction('gift_card')
                  setShowConfirmModal(true)
                }}
                disabled={!selectedGiftTier || crownBalance < (selectedGiftTier?.min ?? 0)}
                className="mt-4 w-full rounded-xl border border-purple-200/40 bg-purple-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Redeem for Gift Card
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Redemption History ─────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">Redemption History</h3>
              <button
                onClick={fetchRedemptions}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', historyLoading && 'animate-spin')} />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : redemptions.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <History className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                <p className="font-bold text-slate-300">No redemptions yet</p>
                <p className="mt-1 text-xs text-slate-500">Your redemption history will appear here</p>
              </div>
            ) : (
              redemptions.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'grid h-9 w-9 place-items-center rounded-xl',
                        r.reward_type === 'troll_coins' ? 'bg-cyan-400/10' : 'bg-purple-400/10',
                      )}>
                        {r.reward_type === 'troll_coins'
                          ? <Coins className="h-4 w-4 text-cyan-300" />
                          : <Gift className="h-4 w-4 text-purple-300" />
                        }
                      </div>
                      <div>
                        <p className="text-xs font-bold">{r.reward_value}</p>
                        <p className="text-[10px] text-slate-500">
                          {r.crowns_redeemed} crown{r.crowns_redeemed !== 1 ? 's' : ''} &bull; {formatDate(r.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                        getStatusColor(r.status),
                      )}>
                        {getStatusIcon(r.status)}
                        {r.status}
                      </span>
                      {r.status === 'pending' && (
                        <button
                          onClick={() => handleCancelRedemption(r.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                          title="Cancel redemption"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {r.notes && (
                    <p className="mt-2 rounded-lg bg-white/[0.03] px-3 py-1.5 text-[10px] text-slate-400">
                      Note: {r.notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Confirmation Modal ──────────────────────────────────────────── */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl border border-cyan-300/20 bg-[#0b1628] p-6 shadow-2xl">
              <div className="mb-4 text-center">
                <Crown className="mx-auto mb-2 h-10 w-10 text-amber-300" />
                <h2 className="text-lg font-black">Confirm Redemption</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {pendingAction === 'convert' && (
                    <>Convert <strong className="text-amber-300">{convertAmount}</strong> crowns to <strong className="text-cyan-300">{parseInt(convertAmount || '0').toLocaleString()}</strong> Troll Coins?</>
                  )}
                  {pendingAction === 'gift_card' && selectedGiftTier && (
                    <>Redeem <strong className="text-amber-300">{selectedGiftTier.min}</strong> crowns for a <strong className="text-purple-300">{selectedGiftTier.reward}</strong>?</>
                  )}
                </p>
              </div>

              {pendingAction === 'gift_card' && (
                <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-500/5 p-3 text-center">
                  <p className="text-[10px] text-amber-200">
                    This will be reviewed by an admin. The gift card will be sent to your email on file.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowConfirmModal(false); setPendingAction(null) }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// We need useNavigate but it's imported from react-router-dom
import { useNavigate } from 'react-router-dom'
