import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Coins,
  DollarSign,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet as WalletIcon,
  Receipt,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '../lib/store'
import { getTransactionHistory, logCoinAction } from '../lib/coinUtils'
import { supabase } from '../lib/supabase'
import { format12hr } from '../utils/timeFormat'
import { cn } from '../lib/utils'
import MAIPayCard from '../components/MAIPayCard'
import PayoutMethodManager from '../components/PayoutMethodManager'
import type { CashoutRequest } from '../types/cashout'
import {
  calculateFeeCoins,
  CASHOUT_TIERS as TIERS,
} from '../config/coinConfig'

// Map the central config tiers to the format expected by this component
const CASHOUT_TIERS = TIERS.map(tier => ({
  coins: tier.coins,
  usd: tier.usd,
}))

const panel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const card =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:opacity-50'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white disabled:opacity-50'

function getCashoutEstimate(availableCoins: number) {
  const safeCoins = Math.max(0, Number(availableCoins || 0))

  const eligibleTier =
    [...CASHOUT_TIERS].reverse().find((tier) => safeCoins >= tier.coins) || null

  const nextTier = CASHOUT_TIERS.find((tier) => safeCoins < tier.coins) || null

  return {
    availableCoins: safeCoins,
    estimatedUsd: eligibleTier?.usd || 0,
    eligibleTier,
    nextTier,
    coinsNeededForNextTier: nextTier ? Math.max(0, nextTier.coins - safeCoins) : 0,
    isMaxTierReached: !nextTier,
  }
}

export default function Wallet() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()

  const [txs, setTxs] = useState<CoinTx[]>([])
  const [cashoutRequests, setCashoutRequests] = useState<CashoutRequest[]>([])
  const [eligibleCoins, setEligibleCoins] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'wallet' | 'cashout'>('wallet')

  const [recentStats, setRecentStats] = useState({
    earned: 0,
    spent: 0,
    netChange: 0,
    loadedTransactions: 0,
  })

  const totalCoins = useMemo(() => {
    return Math.max(0, Number(profile?.troll_coins || 0))
  }, [profile?.troll_coins])

  const reservedCoins = useMemo(() => {
    return Math.max(0, Number((profile?.cashout_reserved_coins ?? profile?.reserved_troll_coins) || 0))
  }, [profile?.cashout_reserved_coins, profile?.reserved_troll_coins])

  const availableCoins = useMemo(() => {
    return Math.max(0, totalCoins - reservedCoins)
  }, [totalCoins, reservedCoins])

  const cashoutEstimate = useMemo(() => {
    return getCashoutEstimate(eligibleCoins)
  }, [eligibleCoins])

  const loadWalletData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const [{ transactions, error: txError }, { data: cashoutData, error: cashoutError }, { data: eligibleData, error: eligibleError }] = await Promise.all([
        getTransactionHistory(user.id, {
          limit: 50,
        }),
        supabase
          .from('visa_redemptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        profile
          ? supabase.rpc('get_eligible_gift_coins', { p_user_id: user.id })
          : Promise.resolve({ data: null, error: null }),
      ])

      if (txError) throw new Error(txError)
      if (cashoutError) console.warn('Failed to load cashout requests:', cashoutError)
      if (eligibleError) console.warn('Failed to load eligible coins:', eligibleError)

      setTxs(transactions)
      setCashoutRequests(cashoutData || [])

      const eligibleTotal = Array.isArray(eligibleData)
        ? eligibleData[0]?.total_eligible_coins
        : eligibleData?.total_eligible_coins

      if (typeof eligibleTotal === 'number') {
        setEligibleCoins(eligibleTotal)
      }

      const earned = transactions
        .filter((tx) => Number(tx.coins) > 0)
        .reduce((sum, tx) => sum + Number(tx.coins || 0), 0)

      const spent = transactions
        .filter((tx) => Number(tx.coins) < 0)
        .reduce((sum, tx) => sum + Math.abs(Number(tx.coins || 0)), 0)

      setRecentStats({
        earned,
        spent,
        netChange: earned - spent,
        loadedTransactions: transactions.length,
      })

      await logCoinAction(
        user.id,
        'wallet_viewed',
        {
          timestamp: new Date().toISOString(),
          transactionCount: transactions.length,
        },
        supabase
      )
    } catch (err: any) {
      console.error('Wallet loading error:', err)
      setError(err.message || 'Failed to load wallet data')
      toast.error('Failed to load wallet data')
    } finally {
      setLoading(false)
    }
  }, [user, profile])

  const handleRefresh = async () => {
    if (!user) return

    setRefreshing(true)

    try {
      await Promise.all([refreshProfile(), loadWalletData()])
      toast.success('Wallet refreshed')
    } catch {
      toast.error('Failed to refresh wallet')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadWalletData()
  }, [loadWalletData])

  // Real-time subscription for cashout status updates
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`wallet_visa_redemptions_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visa_redemptions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Reload cashout requests
          supabase
            .from('visa_redemptions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data }) => {
              if (data) setCashoutRequests(data)
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050714] px-4 pt-24 text-white">
        <BackgroundFX />
        <div className="relative z-10 flex min-h-[70vh] items-center justify-center">
          <div className={cn(panel, 'max-w-md p-8 text-center')}>
            <WalletIcon className="mx-auto mb-4 h-12 w-12 text-cyan-200" />
            <h1 className="text-2xl font-black">Wallet Access Required</h1>
            <p className="mt-2 text-sm text-slate-400">Please log in to view your wallet.</p>
            <button onClick={() => navigate('/auth')} className={cn(primary, 'mt-5')}>
              Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050714] px-4 pb-8 pt-24 text-white md:px-6">
        <BackgroundFX />
        <div className="relative z-10 mx-auto max-w-4xl">
          <div className={cn(panel, 'p-6 text-center')}>
            <AlertCircle className="mx-auto mb-4 h-14 w-14 text-red-300" />
            <h1 className="text-2xl font-black text-white">Error Loading Wallet</h1>
            <p className="mt-2 text-sm text-red-100/80">{error}</p>
            <button onClick={handleRefresh} className={cn(primary, 'mt-5')}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050714] px-4 pb-8 pt-24 text-white md:px-6">
      <BackgroundFX />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className={cn(panel, 'p-5 md:p-6')}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                <WalletIcon className="h-6 w-6 text-cyan-200" />
              </div>

              <div>
                <h1 className="bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-100 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-5xl">
                  Wallet
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Track coins, cashout status, and transaction history.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate('/store')} className={secondary}>
                Buy Coins
              </button>
              <button onClick={handleRefresh} disabled={refreshing} className={primary}>
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-6 flex gap-4 border-b border-cyan-500/20">
            <button
              onClick={() => setActiveTab('wallet')}
              className={`pb-3 px-2 font-bold text-sm uppercase tracking-wider transition-colors ${
                activeTab === 'wallet'
                  ? 'text-cyan-300 border-b-2 border-cyan-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Wallet Activity
            </button>
            <button
              onClick={() => setActiveTab('cashout')}
              className={`pb-3 px-2 font-bold text-sm uppercase tracking-wider transition-colors flex items-center gap-2 ${
                activeTab === 'cashout'
                  ? 'text-troll-gold border-b-2 border-troll-gold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Cashout Requests
              {cashoutRequests.some(r => r.status === 'pending' || r.status === 'processing') && (
                <span className="ml-1 px-1.5 py-0.5 bg-troll-gold text-troll-purple-900 text-xs rounded-full">
                  {cashoutRequests.filter(r => r.status === 'pending' || r.status === 'processing').length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Tab Content */}
        {activeTab === 'wallet' ? (
          <>
            {/* Existing Wallet Content */}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <BalanceCard
                label="Available Coins"
                value={availableCoins.toLocaleString()}
                helper={reservedCoins > 0 ? `${reservedCoins.toLocaleString()} reserved` : 'Ready to use'}
                icon={<Coins className="h-5 w-5 text-cyan-300" />}
                tone="cyan"
              />

              <BalanceCard
                label="Total Coins"
                value={totalCoins.toLocaleString()}
                helper="Current wallet balance"
                icon={<Coins className="h-5 w-5 text-blue-300" />}
                tone="blue"
              />

              <BalanceCard
                label="Estimated Cashout"
                value={`$${cashoutEstimate.estimatedUsd.toLocaleString()}`}
                helper={
                  cashoutEstimate.eligibleTier
                    ? `${cashoutEstimate.eligibleTier.coins.toLocaleString()} coins tier`
                    : `${cashoutEstimate.coinsNeededForNextTier.toLocaleString()} coins needed`
                }
                icon={<DollarSign className="h-5 w-5 text-emerald-300" />}
                tone={cashoutEstimate.estimatedUsd > 0 ? 'green' : 'red'}
              />

              <BalanceCard
                label="Payout Setup"
                value="Configure in Cashout"
                helper="Set your payout method per request"
                icon={<DollarSign className="h-5 w-5 text-cyan-300" />}
                tone="cyan"
                action={
                  <button
                    onClick={() => setActiveTab('cashout')}
                    className="mt-3 text-xs font-black text-cyan-200 hover:text-white"
                  >
                    Go to Cashout →
                  </button>
                }
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <MAIPayCard disableContinue />

              <div className={cn(panel, 'p-5')}>
                <h2 className="text-xl font-black text-white">Cashout Estimate</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Cashout value is based on Troll City payout tiers, not coin purchase value.
                </p>

                <div className="mt-4 space-y-3">
                  <SummaryRow
                    label="Estimated Value"
                    value={`$${cashoutEstimate.estimatedUsd.toLocaleString()}`}
                    tone={cashoutEstimate.estimatedUsd > 0 ? 'green' : 'red'}
                  />

                  <SummaryRow
                    label="Eligible Tier"
                    value={
                      cashoutEstimate.eligibleTier
                        ? `${cashoutEstimate.eligibleTier.coins.toLocaleString()} → $${cashoutEstimate.eligibleTier.usd.toLocaleString()}`
                        : 'Not eligible yet'
                    }
                    tone={cashoutEstimate.eligibleTier ? 'green' : 'red'}
                  />

                  <SummaryRow
                    label="Next Tier"
                    value={
                      cashoutEstimate.nextTier
                        ? `${cashoutEstimate.nextTier.coins.toLocaleString()} → $${cashoutEstimate.nextTier.usd.toLocaleString()}`
                        : 'Max tier reached'
                    }
                    tone="cyan"
                  />

                  <SummaryRow
                    label="Coins Needed"
                    value={
                      cashoutEstimate.nextTier
                        ? `${cashoutEstimate.coinsNeededForNextTier.toLocaleString()} coins`
                        : 'Highest tier unlocked'
                    }
                    tone="cyan"
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-400/5 p-3 text-xs leading-relaxed text-slate-400">
                  Coin purchase value and cashout value are not the same. Estimated cashout only shows the
                  highest payout tier currently unlocked by your available coins - but only GIFTED coins are eligible for cashout.
                </div>

                <div className="mt-5 space-y-2">
                  <button onClick={() => navigate('/store')} className={cn(secondary, 'w-full justify-start')}>
                    Buy Coins
                  </button>
                  <button onClick={() => navigate('/transactions')} className={cn(secondary, 'w-full justify-start')}>
                    View Full History
                  </button>
                </div>
              </div>
            </section>

            <section className={cn(panel, 'p-5')}>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Recent Wallet Activity</h2>
                  <p className="text-sm text-slate-400">
                    Recent stats are calculated from the latest loaded transaction history.
                  </p>
                </div>

                <button onClick={() => navigate('/transactions')} className={secondary}>
                  View All
                </button>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-4">
                <SummaryStatCard label="Recent Earned" value={`${recentStats.earned.toLocaleString()} coins`} tone="green" />
                <SummaryStatCard label="Recent Spent" value={`${recentStats.spent.toLocaleString()} coins`} tone="red" />
                <SummaryStatCard
                  label="Recent Net"
                  value={`${recentStats.netChange >= 0 ? '+' : ''}${recentStats.netChange.toLocaleString()} coins`}
                  tone={recentStats.netChange >= 0 ? 'green' : 'red'}
                />
                <SummaryStatCard label="Loaded Transactions" value={String(recentStats.loadedTransactions)} tone="cyan" />
              </div>

              {loading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/70">
                      Loading Transactions
                    </p>
                  </div>
                </div>
              ) : txs.length === 0 ? (
                <div className={cn(card, 'flex min-h-[280px] items-center justify-center p-8 text-center')}>
                  <div>
                    <Coins className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                    <h3 className="text-lg font-black text-white">No Transactions Yet</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Start earning coins by streaming, receiving gifts, or completing city activities.
                    </p>
                    <button onClick={() => navigate('/store')} className={cn(primary, 'mt-5')}>
                      Buy Your First Coins
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {txs.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </section>
          </>
) : (
           /* Cashout Tab Content */
           <div className="space-y-6">
             {/* Payout Method Setup */}
             <section className={cn(panel, 'p-6')}>
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                 <DollarSign className="text-troll-gold" />
                 Payout Methods
               </h3>
               <PayoutMethodManager />
             </section>

             {/* Cashout Summary Card */}
             <section className={cn(panel, 'p-6')}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Receipt className="w-6 h-6 text-troll-gold" />
                    Cashout Requests
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Track your cashout request status and submit new requests.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/cashout-request')}
                  className={cn(primary, 'px-6')}
                >
                  <DollarSign className="w-4 h-4" />
                  Request Payout
                </button>
              </div>

              {/* Cashout Stats */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#151027] rounded-lg p-4 border border-purple-500/30">
                  <p className="text-sm text-gray-400">Eligible Gift Coins</p>
                  <p className="text-2xl font-bold text-troll-green-neon">
                    {eligibleCoins.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[#151027] rounded-lg p-4 border border-purple-500/30">
                  <p className="text-sm text-gray-400">Reserved for Pending</p>
                  <p className="text-2xl font-bold text-yellow-300">
                    {reservedCoins.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[#151027] rounded-lg p-4 border border-purple-500/30">
                  <p className="text-sm text-gray-400">Net Available</p>
                  <p className="text-2xl font-bold text-white">
                    {(eligibleCoins - reservedCoins).toLocaleString()}
                  </p>
                </div>
                <div className="bg-[#151027] rounded-lg p-4 border border-emerald-500/30">
                  <p className="text-sm text-gray-400">Est. Cashout Value</p>
                  <p className="text-2xl font-bold text-emerald-300">
                    ${cashoutEstimate.estimatedUsd.toFixed(2)}
                  </p>
                </div>
              </div>
            </section>

            {/* Recent Cashout Requests */}
            <section className={cn(panel, 'p-6')}>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="text-troll-gold" />
                Your Cashout Requests
              </h3>
              {cashoutRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                  <p className="text-gray-400">No cashout requests yet.</p>
                  <button
                    onClick={() => navigate('/cashout-request')}
                    className={cn(primary, 'mt-4')}
                  >
                    Make Your First Request
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cashoutRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-4 bg-[#151027] rounded-lg border border-purple-500/20 hover:border-purple-400/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-white">
                            {(req.coins_reserved - req.fee_coins)?.toLocaleString() || 0} coins
                          </p>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                              req.status === 'pending' || req.status === 'submitted'
                                ? 'bg-yellow-900/50 text-yellow-300'
                                : req.status === 'processing'
                                ? 'bg-blue-900/50 text-blue-300'
                                : req.status === 'approved'
                                ? 'bg-green-900/50 text-green-300'
                                : req.status === 'completed'
                                ? 'bg-green-900/50 text-green-300'
                                : 'bg-red-900/50 text-red-300'
                            }`}
                          >
                            {(req.status || 'pending').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          ${req.usd_amount?.toFixed(2) || '0.00'} via {req.payout_method || 'N/A'}
                          {req.payout_details ? ` • ${req.payout_details}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString()}
                        </p>
                        {req.rejection_reason && (
                          <p className="text-xs text-red-400 mt-1">Reason: {req.rejection_reason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {req.opened_at && (
                          <p className="text-xs text-blue-300">
                            Processing since {new Date(req.opened_at).toLocaleDateString()}
                          </p>
                        )}
                        {req.receipt_url && (
                          <a
                            href={req.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-400 hover:underline"
                          >
                            View Receipt →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quick Actions */}
            <section className={cn(panel, 'p-6')}>
              <h3 className="text-lg font-bold mb-4 text-white">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/cashout-request')}
                  className={cn(secondary, 'flex items-center justify-center gap-2 py-4')}
                >
                  <DollarSign className="w-5 h-5" />
                  New Cashout Request
                </button>
                <button
                  onClick={() => navigate('/transactions')}
                  className={cn(secondary, 'flex items-center justify-center gap-2 py-4')}
                >
                  <Coins className="w-5 h-5" />
                  View Wallet History
                </button>
                <button
                  onClick={() => navigate('/store')}
                  className={cn(secondary, 'flex items-center justify-center gap-2 py-4')}
                >
                  <RefreshCw className="w-5 h-5" />
                  Buy More Coins
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
    </>
  )
}

function BalanceCard({
  label,
  value,
  helper,
  icon,
  tone,
  action,
}: {
  label: string
  value: string
  helper: string
  icon: React.ReactNode
  tone: 'cyan' | 'blue' | 'green' | 'red'
  action?: React.ReactNode
}) {
  const toneClass = {
    cyan: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
    blue: 'border-blue-300/20 bg-blue-400/10 text-blue-100',
    green: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    red: 'border-red-300/20 bg-red-400/10 text-red-100',
  }[tone]

  return (
    <div className={cn(card, 'p-5')}>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl border', toneClass)}>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-4 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
      {action}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'cyan' | 'green' | 'red'
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        className={cn(
          'text-right font-mono font-black',
          tone === 'cyan' && 'text-cyan-100',
          tone === 'green' && 'text-emerald-200',
          tone === 'red' && 'text-red-200'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SummaryStatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'cyan' | 'green' | 'red'
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-2 font-mono text-lg font-black',
          tone === 'cyan' && 'text-cyan-100',
          tone === 'green' && 'text-emerald-200',
          tone === 'red' && 'text-red-200'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function TransactionRow({ tx }: { tx: CoinTx }) {
  const positive = Number(tx.coins) > 0

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition hover:-translate-y-0.5',
        positive
          ? 'border-emerald-300/20 bg-emerald-400/10 hover:border-emerald-300/35'
          : 'border-red-300/20 bg-red-400/10 hover:border-red-300/35'
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('text-lg font-black', positive ? 'text-emerald-200' : 'text-red-200')}>
              {positive ? '+' : ''}
              {Number(tx.coins || 0).toLocaleString()} coins
            </p>
            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
              {tx.type || 'transaction'}
            </span>
          </div>

          {tx.description && <p className="mt-1 text-sm text-slate-300">{tx.description}</p>}

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>{new Date(tx.created_at).toLocaleDateString()}</span>
            <span>{format12hr(tx.created_at)}</span>
            <span>•</span>
            <span className="capitalize">{tx.source || 'app'}</span>
            {tx.payment_status && (
              <>
                <span>•</span>
                <span
                  className={cn(
                    'capitalize',
                    tx.payment_status === 'completed' && 'text-emerald-300',
                    tx.payment_status === 'pending' && 'text-amber-300',
                    tx.payment_status !== 'completed' &&
                      tx.payment_status !== 'pending' &&
                      'text-red-300'
                  )}
                >
                  {tx.payment_status}
                </span>
              </>
            )}
          </div>

          {tx.external_id && (
            <p className="mt-2 font-mono text-xs text-slate-600">
              ID: {tx.external_id.substring(0, 16)}...
            </p>
          )}
        </div>

        <div className="text-left md:text-right">
          {tx.usd_amount && Number(tx.usd_amount) > 0 && (
            <p className={cn('text-lg font-black', positive ? 'text-emerald-200' : 'text-red-200')}>
              ${Number(tx.usd_amount).toFixed(2)}
            </p>
          )}
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {positive ? 'Earned' : 'Spent'}
          </p>
        </div>
      </div>
    </div>
  )
}