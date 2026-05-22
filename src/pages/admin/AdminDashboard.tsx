// src/pages/admin/AdminDashboard.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import './admin.css'
import { useAuthStore } from '../../lib/store'
import { supabase, isAdminEmail, UserRole } from '../../lib/supabase'
import { sendNotification } from '../../lib/sendNotification'
import {
  Shield,
  LogOut,
  RotateCcw,
  RefreshCw,
  DollarSign,
  Coins,
  CreditCard,
  Activity,
  Radio,
  AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import CitySummaryBar from './components/CitySummaryBar'
import CityControlsHealth from './components/CityControlsHealth'
import FinanceEconomyCenter from './components/FinanceEconomyCenter'
import RevenueInventoryDashboard from './components/RevenueInventoryDashboard'
import OperationsControlDeck from './components/OperationsControlDeck'
import AdditionalTasksGrid from './components/AdditionalTasksGrid'
import QuickActionsBar from './components/QuickActionsBar'
import PresidentialOversightPanel from './components/PresidentialOversightPanel'
import ProposalManagementPanel from './components/shared/ProposalManagementPanel'
import TempAdminDashboard from './TempAdminDashboard'
import ErrorBoundary from '../../components/ErrorBoundary'
import { useAdminFinanceRealtime } from '../../hooks/useAdminFinanceRealtime'
import { useAdminDashboardMetrics } from '../../hooks/useAdminDashboardMetrics'

type StatState = {
  totalUsers: number
  adminsCount: number
  pendingApps: number
  pendingPayouts: number
  trollOfficers: number
  aiFlags: number
  coinSalesRevenue: number
  totalPayouts: number
  feesCollected: number
  platformProfit: number
  purchasedCoins: number
  earnedCoins: number
  freeCoins: number
  totalCoinsInCirculation: number
  totalValue: number
  giftCoins: number
  appSponsoredGifts: number
  total_liability_coins: number
  total_platform_profit_usd: number
  kick_ban_revenue: number
}

interface EconomySummary {
  troll_coins: {
    totalPurchased: number
    totalSpent: number
    outstandingLiability: number
  }
  broadcasters: {
    totalUsdOwed: number
    pendingCashoutsUsd: number
    paidOutUsd: number
  }
  officers: {
    totalUsdPaid: number
  }
  messages?: {
    totalPayments: number
    totalIncome: number
    transactionCount: number
  }
}

type TabId =
  | 'hr'
  | 'all_hr'
  | 'database_backup'
  | 'system_health'
  | 'cache_clear'
  | 'system_config'
  | 'user_search'
  | 'reports_queue'
  | 'role_management'
  | 'stream_monitor'
  | 'media_library'
  | 'chat_moderation'
  | 'announcements'
  | 'economy_dashboard'
  | 'finance_dashboard'
  | 'cost_dashboard'
  | 'grant_coins'
  | 'tax_reviews'
  | 'payment_logs'
  | 'create_schedule'
  | 'officer_shifts'
  | 'shift_requests_approval'
  | 'empire_applications'
  | 'referral_bonuses'
  | 'control_panel'
  | 'test_diagnostics'
  | 'reset_maintenance'
  | 'export_data'
  | 'connections'
  | 'payouts'
  | 'payout_queue'
  | 'voting'
  | 'cashouts'
  | 'purchases'
  | 'declined'
  | 'verification'
  | 'users'
  | 'broadcasters'
  | 'families'
  | 'support'
  | 'support_tickets'
  | 'agreements'
  | 'reports'
  | 'send_notifications'
  | 'applications'

interface TransactionRow {
  id: string
  user_id: string | null
  type?: string | null
  transaction_type?: string | null
  coins_used?: number | null
  amount?: number | null
  description?: string | null
  status?: string | null
  metadata?: {
    coins?: number
    coin_amount?: number
    coins_awarded?: number
    package_id?: string
    paypal_order_id?: string
    paypal_capture_id?: string
    payer_email?: string
    [key: string]: unknown
  } | null
  created_at?: string
}

interface LiveStream {
  id: string
  title: string
  category: string
  status: string
  created_at: string
  broadcaster_id: string
}

interface CoinPurchaseRow {
  id: string
  user_id: string | null
  username: string
  amount_coins: number
  amount_usd: number
  type: string
  source: string
  package_id?: string | null
  paypal_order_id?: string | null
  paypal_capture_id?: string | null
  payer_email?: string | null
  created_at: string
  status?: string | null
}

const pageShell =
  'min-h-screen bg-slate-950 text-white relative overflow-hidden'

const glassPanel =
  'rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 backdrop-blur-2xl shadow-[0_0_48px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]'

const card =
  'rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[0_0_30px_rgba(45,212,191,0.08)]'

function CityBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </>
  )
}

function MoneyMetric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
          <Icon className="h-5 w-5 text-cyan-200" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="text-2xl font-black text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function CoinSalesPanel({
  purchases,
  loading,
  onRefresh,
}: {
  purchases: CoinPurchaseRow[]
  loading: boolean
  onRefresh: () => void
}) {
  const [selectedTx, setSelectedTx] = useState<CoinPurchaseRow | null>(null)
  const totalUsd = purchases.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0)
  const totalCoins = purchases.reduce((sum, p) => sum + Number(p.amount_coins || 0), 0)

  const handleRowClick = (row: CoinPurchaseRow) => {
    setSelectedTx(row)
  }

  const handleCloseModal = () => {
    setSelectedTx(null)
  }

  return (
    <section className={glassPanel}>
      <div className="flex flex-col gap-4 border-b border-cyan-400/10 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10">
              <CreditCard className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Coin Store Sales Ledger</h2>
              <p className="text-sm text-slate-400">
                PayPal / coin-store purchases pulled from public.transactions.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-bold text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-400/15"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Sales
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
        <MoneyMetric icon={DollarSign} label="Recent Sales" value={`$${totalUsd.toFixed(2)}`} sub={`${purchases.length} transactions loaded`} />
        <MoneyMetric icon={Coins} label="Coins Sold" value={totalCoins.toLocaleString()} sub="recent purchased coin volume" />
        <MoneyMetric icon={Activity} label="Source" value="PayPal" sub="coin store checkout feed" />
      </div>

      <div className="px-5 pb-5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <div className="grid grid-cols-12 border-b border-white/10 bg-white/[0.035] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            <div className="col-span-3">Buyer</div>
            <div className="col-span-2">Coins</div>
            <div className="col-span-2">USD</div>
            <div className="col-span-2">Source</div>
            <div className="col-span-3">Date</div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading coin sales...</div>
          ) : purchases.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No coin purchase rows found yet.</div>
          ) : (
            <div className="max-h-[360px] divide-y divide-white/10 overflow-y-auto">
              {purchases.map((row) => (
                <div
                  key={row.id}
                  onClick={() => handleRowClick(row)}
                  className="grid grid-cols-12 cursor-pointer items-center px-4 py-3 text-sm hover:bg-cyan-400/5"
                >
                  <div className="col-span-3 min-w-0">
                    <p className="truncate font-bold text-white">{row.username}</p>
                    {row.payer_email && <p className="truncate text-xs text-slate-500">{row.payer_email}</p>}
                  </div>
                  <div className="col-span-2 font-black text-cyan-200">{row.amount_coins.toLocaleString()}</div>
                  <div className="col-span-2 font-black text-emerald-300">${row.amount_usd.toFixed(2)}</div>
                  <div className="col-span-2">
                    <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-2 py-1 text-xs font-bold text-purple-200">
                      {row.source}
                    </span>
                  </div>
                  <div className="col-span-3 text-xs text-slate-400">
                    {row.created_at ? new Date(row.created_at).toLocaleString() : '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

<p className="mt-3 text-xs text-slate-500">
           Tip: for the most accurate dashboard, make PayPal verification write metadata.amount_paid,
           metadata.coins_awarded, metadata.paypal_order_id, and metadata.paypal_capture_id into public.transactions.
         </p>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-400/20 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-cyan-400/10 bg-slate-900/80">
              <h3 className="text-lg font-black text-white">Transaction Details</h3>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Transaction ID</p>
                  <p className="font-mono text-white">{selectedTx.id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">User ID</p>
                  <p className="text-white">{selectedTx.user_id || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Buyer</p>
                  <p className="font-bold text-white">{selectedTx.username}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="text-cyan-200 font-bold">{selectedTx.amount_coins.toLocaleString()} coins</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">USD Amount</p>
                  <p className="text-emerald-300 font-bold">${selectedTx.amount_usd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Source</p>
                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${
                    selectedTx.source === 'paypal'
                      ? 'border-blue-400/20 bg-blue-400/10 text-blue-200'
                      : 'border-purple-300/20 bg-purple-400/10 text-purple-200'
                  }`}>
                    {selectedTx.source}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Package ID</p>
                  <p className="text-white">{selectedTx.package_id || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Type</p>
                  <p className="text-white">{selectedTx.type}</p>
                </div>
              </div>

              {selectedTx.paypal_order_id && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">PayPal Order ID</p>
                    <p className="font-mono text-xs text-white">{selectedTx.paypal_order_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">PayPal Capture ID</p>
                    <p className="font-mono text-xs text-white">{selectedTx.paypal_capture_id || '-'}</p>
                  </div>
                </div>
              )}

              {selectedTx.payer_email && (
                <div>
                  <p className="text-xs text-slate-500">Payer Email</p>
                  <p className="text-white">{selectedTx.payer_email}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="text-white">{selectedTx.created_at ? new Date(selectedTx.created_at).toLocaleString() : '-'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-cyan-400/10 bg-slate-900/50">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default function AdminDashboard() {
  const { profile, user, setProfile, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [adminCheckLoading, setAdminCheckLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const isTempAdmin = profile?.role === UserRole.TEMP_CITY_ADMIN

  const {
    financeSummary,
    isLoading: financeLoading,
    isConnected,
    lastSync,
    refreshFinance,
    reconciliation,
  } = useAdminFinanceRealtime()

  const { metrics: dashboardMetrics, refreshMetrics } = useAdminDashboardMetrics()

  const stats: StatState = financeSummary
    ? {
        totalUsers: dashboardMetrics.totalUsers || financeSummary.users.totalUsers,
        adminsCount: financeSummary.users.adminsCount,
        pendingApps: 0,
        pendingPayouts: financeSummary.users.pendingPayouts,
        trollOfficers: dashboardMetrics.trollOfficers || financeSummary.users.trollOfficers,
        aiFlags: financeSummary.users.aiFlags,
        coinSalesRevenue: dashboardMetrics.coinRevenue || financeSummary.economy.coinSalesRevenue,
        totalPayouts: financeSummary.economy.totalPayouts,
        feesCollected: financeSummary.economy.feesCollected,
        platformProfit: dashboardMetrics.platformProfit || financeSummary.economy.platformProfit,
        purchasedCoins: dashboardMetrics.coinsSold || financeSummary.economy.purchasedCoins,
        earnedCoins: financeSummary.economy.earnedCoins,
        freeCoins: financeSummary.economy.freeCoins,
        totalCoinsInCirculation: dashboardMetrics.coinsInCirculation || financeSummary.economy.totalCoinsInCirculation,
        totalValue: financeSummary.economy.totalValue,
        giftCoins: financeSummary.economy.giftCoins,
        appSponsoredGifts: financeSummary.economy.appSponsoredGifts,
        total_liability_coins: financeSummary.financial.total_liability_coins,
        total_platform_profit_usd: financeSummary.financial.total_platform_profit_usd,
        kick_ban_revenue: financeSummary.financial.kick_ban_revenue,
      }
    : {
        totalUsers: dashboardMetrics.totalUsers,
        adminsCount: 0,
        pendingApps: 0,
        pendingPayouts: 0,
        trollOfficers: dashboardMetrics.trollOfficers,
        aiFlags: 0,
        coinSalesRevenue: dashboardMetrics.coinRevenue,
        totalPayouts: 0,
        feesCollected: 0,
        platformProfit: dashboardMetrics.platformProfit,
        totalCoinsInCirculation: dashboardMetrics.coinsInCirculation,
        totalValue: 0,
        purchasedCoins: dashboardMetrics.coinsSold,
        earnedCoins: 0,
        freeCoins: 0,
        giftCoins: 0,
        appSponsoredGifts: 0,
        total_liability_coins: 0,
        total_platform_profit_usd: 0,
        kick_ban_revenue: 0,
      }

  const [activeTab, setActiveTab] = useState<TabId>('connections')
  const [supabaseStatus, setSupabaseStatus] = useState<unknown | null>(null)
  const [paypalStatus, setPaypalStatus] = useState<unknown | null>(null)
  const [paypalTesting, setPaypalTesting] = useState(false)
  const [trollDropAmount, setTrollDropAmount] = useState<number>(100)
  const [trollDropDuration, setTrollDropDuration] = useState<number>(60)
  const [economySummary, setEconomySummary] = useState<EconomySummary | null>(null)
  const [economyLoading, setEconomyLoading] = useState(false)
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [streamsLoading, setStreamsLoading] = useState(false)
  const [coinPurchases, setCoinPurchases] = useState<CoinPurchaseRow[]>([])
  const [coinPurchasesLoading, setCoinPurchasesLoading] = useState(false)

  const [taskCounts, setTaskCounts] = useState({
    taxReviews: 0,
    supportTickets: 0,
    alerts: 0,
  })

  useEffect(() => {
    if (['payouts', 'payout_queue', 'purchases', 'stream_monitor', 'send_notifications'].includes(activeTab)) {
      toast.info(`Switched to tab: ${activeTab}`)
    }
  }, [activeTab])

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        setAdminCheckLoading(false)
        setIsAuthorized(false)
        return
      }

      try {
        const { data: session } = await supabase.auth.getUser()

        if (!session.user) {
          setAdminCheckLoading(false)
          setIsAuthorized(false)
          return
        }

        const { data: profileData, error } = await supabase
          .from('user_profiles')
          .select('role, is_admin')
          .eq('id', session.user.id)
          .maybeSingle()

        if (error || !profileData) {
          setAdminCheckLoading(false)
          setIsAuthorized(false)
          return
        }

        const email = session.user.email || ''
        const isAdmin =
          profileData.role === 'admin' ||
          profileData.role === 'superadmin' ||
          profileData.role === 'ceo' ||
          profileData.is_admin === true ||
          (profileData as any).is_superadmin === true ||
          isAdminEmail(email)

        const isOfficerRole =
          profileData.role === 'troll_officer' ||
          profileData.role === 'lead_troll_officer'

        if (isOfficerRole) {
          setIsAuthorized(false)
          return
        }

        setIsAuthorized(isAdmin)
      } catch (error) {
        console.error('Error in admin check:', error)
        setIsAuthorized(false)
      } finally {
        setAdminCheckLoading(false)
      }
    }

    checkAdminAccess()
  }, [user, isLoading])

  const loadCoinPurchases = useCallback(async () => {
    setCoinPurchasesLoading(true)

    try {
      // Primary source: public.transactions
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select(
          'id,user_id,type,transaction_type,coins_used,amount,description,status,metadata,created_at'
        )
        .or(
          [
            'transaction_type.eq.purchase',
            'type.eq.purchase',
            'description.ilike.%PayPal purchase%',
            'description.ilike.%coin%',
            'metadata->>paypal_capture_id.not.is.null',
            'metadata->>paypal_order_id.not.is.null',
            'metadata->>package_id.not.is.null',
          ].join(',')
        )
        .order('created_at', { ascending: false })
        .limit(2000)

      // Secondary source: legacy coinstore sales ledger (if present)
      const { data: storeData, error: storeError } = await supabase
        .from('coin_store_sales')
        .select('id,user_id,amount_coins,amount_usd,paypal_order_id,paypal_capture_id,payer_email,package_id,created_at,status')
        .order('created_at', { ascending: false })
        .limit(2000)

      if (txError && !storeData) throw txError

      const data = (txData || []) as any[]
      const storeRows = (storeData || []) as any[]
      // Merge both sources; prefer public.transactions rows but include store rows that aren't present
      const combined = [...data]
      const existingIds = new Set(combined.map((r) => r.id))
      for (const s of storeRows) {
        if (!existingIds.has(s.id)) {
          combined.push({
            id: s.id,
            user_id: s.user_id,
            type: 'purchase',
            transaction_type: 'purchase',
            coins_used: s.amount_coins,
            amount: s.amount_usd,
            description: 'Coin Store purchase',
            status: s.status,
            metadata: {
              package_id: s.package_id,
              paypal_order_id: s.paypal_order_id,
              paypal_capture_id: s.paypal_capture_id,
              payer_email: s.payer_email,
            },
            created_at: s.created_at,
          })
        }
      }

      if (error) throw error

      const txRows = (combined || []) as TransactionRow[]
      const userIds = [...new Set(txRows.map((tx) => tx.user_id).filter(Boolean))] as string[]

      const userMap = new Map<string, string>()

      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, email')
          .in('id', userIds)

        if (!usersError) {
          ;(usersData || []).forEach((u: any) => {
            userMap.set(u.id, u.display_name || u.username || u.email || u.id)
          })
        }
      }

      const rows: CoinPurchaseRow[] = txRows.map((tx) => {
        const meta = tx.metadata || {}

        const metadataCoins =
          Number(meta.coins_awarded || 0) ||
          Number(meta.coin_amount || 0) ||
          Number(meta.coins || 0)

        const parsedDescriptionCoins = (() => {
          const match = String(tx.description || '').match(/(\d[\d,]*)\s*coins?/i)
          return match ? Number(match[1].replace(/,/g, '')) : 0
        })()

        const coins =
          metadataCoins ||
          Number(tx.coins_used || 0) ||
          parsedDescriptionCoins ||
          Math.round(Number(tx.amount || 0) * 100)

        const usd = Number(tx.amount || 0)

        return {
          id: tx.id,
          user_id: tx.user_id || null,
          username: tx.user_id ? userMap.get(tx.user_id) || tx.user_id : 'Unknown buyer',
          amount_coins: Math.abs(coins),
          amount_usd: Math.abs(usd),
          type: tx.transaction_type || tx.type || 'purchase',
          source: 'public.transactions',
          package_id: typeof meta.package_id === 'string' ? meta.package_id : null,
          paypal_order_id: typeof meta.paypal_order_id === 'string' ? meta.paypal_order_id : null,
          paypal_capture_id: typeof meta.paypal_capture_id === 'string' ? meta.paypal_capture_id : null,
          payer_email: typeof meta.payer_email === 'string' ? meta.payer_email : null,
          created_at: tx.created_at || '',
          status: tx.status || null,
        }
      })

      setCoinPurchases(rows)
    } catch (error) {
      console.error('Error loading coin purchases from public.transactions:', error)
      toast.error('Failed to load coin purchases from public.transactions')
    } finally {
      setCoinPurchasesLoading(false)
    }
  }, [])

  const loadTaskCounts = useCallback(async () => {
    try {
      const [taxReviewsRes, supportRes, alertsRes] = await Promise.all([
        supabase.from('user_tax_info').select('id').eq('status', 'pending'),
        supabase.from('support_tickets').select('id').eq('status', 'open'),
        supabase.from('system_alerts').select('id').eq('status', 'unread'),
      ])

      setTaskCounts({
        taxReviews: taxReviewsRes.data?.length || 0,
        supportTickets: supportRes.data?.length || 0,
        alerts: alertsRes.data?.length || 0,
      })
    } catch (error) {
      console.error('Error loading task counts:', error)
    }
  }, [])

  const loadEconomySummary = useCallback(async () => {
    try {
      setEconomyLoading(true)

      const { error: summaryError } = await supabase
        .from('economy_summary')
        .select('*')
        .maybeSingle()

      if (summaryError) console.warn('Failed to load economy_summary view:', summaryError)

      const json = await (await import('../../lib/api')).default.get('/admin/economy/summary')
      if (!json.success) throw new Error(json?.error || 'Failed to load economy summary')

      setEconomySummary(json.data)
    } catch (err: unknown) {
      console.error('Failed to load economy summary:', err)

      try {
        // Use public.transactions for purchase data (real money purchases)
        const { data: purchaseTx } = await supabase
          .from('transactions')
          .select('user_id, amount, coins_used, metadata')
          .or('transaction_type.eq.purchase,type.eq.purchase,description.ilike.%coin%')

        const purchaseMap: Record<string, { purchased: number }> = {}

        ;(purchaseTx || []).forEach((tx: any) => {
          const userId = tx.user_id || 'unknown'
          const existing = purchaseMap[userId] || { purchased: 0 }
          const coins = Number(tx.coins_used || tx.metadata?.coins || tx.metadata?.coins_awarded || 0)
          existing.purchased += Math.abs(coins)
          purchaseMap[userId] = existing
        })

        let totalPurchased = 0
        Object.values(purchaseMap).forEach((v) => {
          totalPurchased += v.purchased
        })

        const { data: broadcasterEarnings } = await supabase
          .from('earnings_payouts')
          .select('amount, status')

        let totalUsdOwed = 0
        let paidOutUsd = 0

        ;(broadcasterEarnings || []).forEach((e: { amount: number | null; status: string }) => {
          const amt = Number(e.amount || 0)
          if (e.status === 'paid') paidOutUsd += amt
          totalUsdOwed += amt
        })

        const { data: officerPayments } = await supabase
          .from('coin_transactions')
          .select('amount')
          .eq('type', 'officer_payment')

        const totalUsdPaid = (officerPayments || []).reduce(
          (sum: number, p: { amount: number | null }) => sum + Number(p.amount || 0),
          0
        )

        setEconomySummary({
          troll_coins: {
            totalPurchased,
            totalSpent: 0,
            outstandingLiability: totalPurchased,
          },
          broadcasters: {
            totalUsdOwed,
            pendingCashoutsUsd: totalUsdOwed - paidOutUsd,
            paidOutUsd,
          },
          officers: { totalUsdPaid },
          messages: {
            totalPayments: 0,
            totalIncome: 0,
            transactionCount: 0,
          },
        })
      } catch (e) {
        console.error('Economy fallback failed:', e)
      }
    } finally {
      setEconomyLoading(false)
    }
  }, [])

  const loadLiveStreams = useCallback(async () => {
    setStreamsLoading(true)

    try {
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, category, status, created_at, broadcaster_id')
        .eq('is_live', true)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setLiveStreams(data || [])
    } catch (error) {
      console.error('Error loading live streams:', error)
    } finally {
      setStreamsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthorized) return

    loadLiveStreams()
    loadTaskCounts()
    loadCoinPurchases()

    const interval = setInterval(() => {
      loadLiveStreams()
      loadTaskCounts()
      loadCoinPurchases()
    }, 30000)

    return () => clearInterval(interval)
  }, [isAuthorized, loadLiveStreams, loadTaskCounts, loadCoinPurchases])

  const createTrollDrop = async () => {
    try {
      const amt = Math.max(1, Math.min(100000, Number(trollDropAmount || 0)))
      const dur = Math.max(5, Math.min(3600, Number(trollDropDuration || 0)))
      const ends = new Date(Date.now() + dur * 1000).toISOString()

      await sendNotification(null, 'troll_drop', '🎉 Troll Drop!', `Troll Drop: ${amt} coins available!`, {
        coins: amt,
        ends_at: ends,
      })

      toast.success('Troll Drop created')
    } catch {
      toast.error('Failed to create Troll Drop')
    }
  }

  const endStreamById = async (id: string) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      if (!token) {
        toast.error('Authentication required')
        return
      }

      const functionsUrl =
        import.meta.env.VITE_EDGE_FUNCTIONS_URL ||
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      const response = await fetch(`${functionsUrl}/streams-maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'end_stream',
          stream_id: id,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to end stream'

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()
      if (!result.success && result.error) throw new Error(result.error)

      toast.success('Stream ended successfully')
      await loadLiveStreams()
    } catch (error: unknown) {
      console.error('Error ending stream:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to end stream')
    }
  }

  const deleteStreamById = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stream? This action cannot be undone.')) return

    try {
      const { error: endError } = await supabase
        .from('streams')
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (endError) throw endError

      const deleteRelatedData = async (table: string, column: string = 'stream_id') => {
        const { error } = await supabase.from(table).delete().eq(column, id)

        if (error && error.code !== 'PGRST205' && error.code !== '42P01' && error.code !== '42501') {
          console.warn(`Could not delete from ${table}:`, error)
        }
      }

      const cleanupStreamParticipants = async () => {
        const { error } = await supabase.functions.invoke('streams-maintenance', {
          body: {
            action: 'delete_stream',
            stream_id: id,
          },
        })

        if (error) console.warn('Failed to clean up stream participants via service function', error)
      }

      await Promise.allSettled([
        deleteRelatedData('messages'),
        deleteRelatedData('stream_reports'),
        cleanupStreamParticipants(),
        deleteRelatedData('gifts'),
        deleteRelatedData('chat_messages'),
      ])

      const { error: deleteError } = await supabase.from('streams').delete().eq('id', id)
      if (deleteError) throw deleteError

      toast.success('Stream deleted successfully')
      await loadLiveStreams()
    } catch (error: any) {
      console.error('Error deleting stream:', error)
      toast.error(error?.message || 'Failed to delete stream')
    }
  }

  const viewStream = (id: string) => navigate(`/watch/${id}?admin=1`)

  const testSupabase = async () => {
    try {
      const uid = user?.id || profile?.id
      if (!uid) throw new Error('No user id')

      const { data, error } = await supabase.from('user_profiles').select('id').eq('id', uid).limit(1)

      if (error) throw error
      if (!data || data.length === 0) throw new Error('Profile not found')

      setSupabaseStatus({ ok: true })
      toast.success('Supabase connection verified')
    } catch (e: any) {
      setSupabaseStatus({ ok: false, error: e?.message || 'Failed' })
      toast.error('Supabase test failed')
    }
  }

  const testPayPal = async () => {
    setPaypalTesting(true)
    setPaypalStatus(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL environment variable is not set')
      if (!apikey) throw new Error('VITE_SUPABASE_ANON_KEY environment variable is not set')

      const testUrl = `${supabaseUrl}/functions/v1/paypal-test-live`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      try {
        const response = await fetch(testUrl, {
          method: 'OPTIONS',
          headers: { apikey },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok || response.status === 200 || response.status === 204) {
          setPaypalStatus({ ok: true })
          toast.success('PayPal function reachable')
        } else {
          const responseText = await response.text().catch(() => 'No response body')
          throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`)
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)

        if (fetchError.name === 'AbortError') {
          throw new Error(`Request timeout after 15 seconds. Function may not be deployed: ${testUrl}`)
        }

        throw fetchError
      }
    } catch (e: any) {
      const errorMsg = e?.message || 'Unknown error occurred'
      console.error('[PayPal Test] Error:', e)
      setPaypalStatus({ ok: false, error: errorMsg })
      toast.error(`PayPal test failed: ${errorMsg}`)
    } finally {
      setPaypalTesting(false)
    }
  }

  const handleEmergencyStop = async () => {
    if (!window.confirm('EMERGENCY STOP: This will immediately END ALL active broadcasts. Continue?')) return

    try {
      const { error } = await supabase
        .from('streams')
        .update({
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .or('is_live.eq.true,status.eq.live')

      if (error) throw error

      toast.success('Emergency stop executed')
      loadLiveStreams()
    } catch (error) {
      console.error('Error executing emergency stop:', error)
      toast.error('Failed to stop streams')
    }
  }

  const handleLogout = async () => {
    try {
      localStorage.clear()
      const introSeen = sessionStorage.getItem('trollIntroSeen')
      sessionStorage.clear()
      if (introSeen) sessionStorage.setItem('trollIntroSeen', introSeen)

      const { logout } = useAuthStore.getState()
      if (logout) logout()

      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session) await supabase.auth.signOut()

      toast.success('Logged out')
      navigate('/auth', { replace: true })
    } catch (error) {
      console.error('Logout error:', error)
      localStorage.clear()
      sessionStorage.clear()
      navigate('/auth', { replace: true })
    }
  }

  const handleResetApp = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      toast.success('App reset')
    } catch {}
    navigate('/auth?reset=1', { replace: true })
  }

  const handleBroadcastMessage = () => navigate('/admin/send-notifications')
  const handleSendNotifications = () => navigate('/admin/send-notifications')
  const handleSystemMaintenance = () => navigate('/admin/reset-maintenance')
  const handleViewAnalytics = () => navigate('/admin/reports-queue')
  const handleExportData = () => navigate('/admin/export-data')
  const _handleSelectTab = (tabId: string) => setActiveTab(tabId as TabId)

  const handleNavigateToEconomy = () => navigate('/admin/economy')
  const handleNavigateToTaxReviews = () => navigate('/admin/tax-reviews')
  const handleOpenTestDiagnostics = () => navigate('/admin/test-diagnostics')
  const handleOpenControlPanel = () => navigate('/admin/control-panel')
  const handleOpenGrantCoins = () => navigate('/admin/grant-coins')
  const handleOpenFinanceDashboard = () => navigate('/admin/finance')
  const handleOpenCreateSchedule = () => navigate('/admin/create-schedule')
  const handleOpenOfficerShifts = () => navigate('/admin/officer-shifts')
  const handleOpenResetPanel = () => navigate('/admin/reset-maintenance')
  const handleOpenEmpireApplications = () => navigate('/admin/empire-applications')
  const handleOpenReferralBonuses = () => navigate('/admin/referral-bonuses')
  const handleOpenApplications = () => navigate('/admin/applications')
  const handleOpenAdminPool = () => navigate('/admin/pool')
  const handleOpenTrollmersTournament = () => navigate('/admin/trollmers-tournament')
  const handleOpenManualOrders = () => navigate('/admin/manual-orders')

   const redirectRoutes = useMemo(
     () =>
       ({
         hr: '/admin/hr',
         all_hr: '/admin/hr',
         database_backup: '/admin/system/backup',
         cache_clear: '/admin/system/cache',
         system_config: '/admin/system/config',
         user_search: '/admin/user-search',
         users: '/admin/user-search',
         reports_queue: '/admin/reports-queue',
         role_management: '/admin/role-management',
         stream_monitor: '/admin/stream-monitor',
         voting: '/admin/voting',
         media_library: '/admin/media-library',
         chat_moderation: '/admin/chat-moderation',
         announcements: '/admin/announcements',
         reports: '/admin/reports-queue',
         finance_dashboard: '/admin/finance',
         economy_dashboard: '/admin/economy',
         grant_coins: '/admin/grant-coins',
         tax_reviews: '/admin/tax-reviews',
         payment_logs: '/admin/payment-logs',
         create_schedule: '/admin/create-schedule',
         officer_shifts: '/admin/officer-shifts',
         shift_requests_approval: '/admin/officer-shifts',
         empire_applications: '/admin/empire-applications',
         applications: '/admin/applications',
         referral_bonuses: '/admin/referral-bonuses',
         control_panel: '/admin/control-panel',
         test_diagnostics: '/admin/test-diagnostics',
         reset_maintenance: '/admin/reset-maintenance',
         export_data: '/admin/export-data',
         support_tickets: '/admin/support-tickets',
         send_notifications: '/admin/send-notifications',
       }) as Partial<Record<TabId, string>>,
     []
   )

  useEffect(() => {
    const target = redirectRoutes[activeTab]
    if (target) navigate(target)
  }, [activeTab, navigate, redirectRoutes])

  React.useEffect(() => {
    const ensureProfile = async () => {
      if (profile || !user?.id) return

      try {
        const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle()

        if (data) {
          const isAdmin = isAdminEmail(user?.email)
          let nextProfile = data

          if (isAdmin && data.role !== 'admin') {
            const { error: updateError } = await supabase.rpc('admin_update_user_role', {
              p_target_user_id: user.id,
              p_new_role: 'admin',
            })

            if (!updateError) nextProfile = { ...data, role: 'admin' }
          }

          setProfile(nextProfile as any)
          return
        }
      } catch {}

      const isAdmin2 = isAdminEmail(user?.email)
      setProfile({
        id: user.id,
        username: (user?.email || '').split('@')[0] || '',
        role: isAdmin2 ? 'admin' : 'user',
        troll_coins: 0,
      } as any)
    }

    ensureProfile()
  }, [profile, user, setProfile])

  if (adminCheckLoading || !profile) {
    return (
      <div className={`${pageShell} flex items-center justify-center`}>
        <CityBackground />
        <div className={`${glassPanel} relative z-10 px-8 py-5 text-center`}>
          <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-cyan-300" />
          <p className="font-black text-cyan-100">Loading Admin Command Center</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className={`${pageShell} flex items-center justify-center`}>
        <CityBackground />
        <div className={`${glassPanel} relative z-10 max-w-md p-8 text-center`}>
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-300" />
          <p className="mb-1 text-xl font-black text-white">Access Restricted</p>
          <p className="text-sm text-slate-400">This dashboard is limited to administrators only.</p>
        </div>
      </div>
    )
  }

  if (isTempAdmin) return <TempAdminDashboard />

  return (
    <div className={pageShell}>
      <CityBackground />

      <div className="relative z-10">
        <QuickActionsBar
          onEmergencyStop={handleEmergencyStop}
          onBroadcastMessage={handleBroadcastMessage}
          onSendNotifications={handleSendNotifications}
          onSystemMaintenance={handleSystemMaintenance}
          onViewAnalytics={handleViewAnalytics}
          onExportData={handleExportData}
          onManualOrders={handleOpenManualOrders}
        />

        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          <header className={glassPanel}>
            <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-purple-700 via-cyan-500 to-pink-600 shadow-[0_0_28px_rgba(45,212,191,0.25)]">
                  <Shield className="h-7 w-7 text-white" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/70">Executive Admin Console</p>
                  <h1 className="bg-gradient-to-r from-white via-cyan-100 to-pink-200 bg-clip-text text-3xl font-black text-transparent md:text-4xl">
                    Troll City Command Center
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Professional operations, finance, safety, and platform control for Troll City.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 font-bold text-red-200 transition hover:bg-red-500/20"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>

                <button
                  onClick={handleResetApp}
                  className="inline-flex items-center gap-2 rounded-2xl border border-yellow-400/25 bg-yellow-500/10 px-4 py-2 font-bold text-yellow-200 transition hover:bg-yellow-500/20"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset App
                </button>
              </div>
            </div>

<div className="grid grid-cols-1 gap-4 border-t border-cyan-400/10 p-5 md:grid-cols-4">
               <MoneyMetric icon={Activity} label="Realtime" value={isConnected ? 'Online' : 'Offline'} sub={lastSync ? `Last sync ${new Date(lastSync).toLocaleTimeString()}` : 'Awaiting sync'} />
               <MoneyMetric icon={Radio} label="Live Streams" value={Number(dashboardMetrics.activeStreams || liveStreams.length).toLocaleString()} sub="active broadcasts" />
               <MoneyMetric icon={DollarSign} label="Coin Revenue" value={`$${Number(stats.coinSalesRevenue || 0).toFixed(2)}`} sub="from public.transactions" />
               <MoneyMetric icon={Coins} label="Coins Sold" value={Number(stats.purchasedCoins || 0).toLocaleString()} sub="purchased coin balance" />
             </div>
          </header>

<ErrorBoundary>
             <CitySummaryBar
               stats={stats}
               liveStreamsCount={dashboardMetrics.activeStreams || liveStreams.length}
               financeLoading={financeLoading}
               isConnected={isConnected}
               lastSync={lastSync}
               reconciliation={reconciliation}
               onRefreshFinance={() => {
                 refreshFinance()
                 refreshMetrics()
               }}
             />
           </ErrorBoundary>

          <CoinSalesPanel purchases={coinPurchases} loading={coinPurchasesLoading} onRefresh={loadCoinPurchases} />

          <ErrorBoundary>
            <CityControlsHealth
              paypalStatus={paypalStatus}
              supabaseStatus={supabaseStatus}
              liveStreams={liveStreams}
              onTestPayPal={testPayPal}
              onTestSupabase={testSupabase}
              onLoadLiveStreams={loadLiveStreams}
              onCreateTrollDrop={createTrollDrop}
              trollDropAmount={trollDropAmount}
              setTrollDropAmount={setTrollDropAmount}
              trollDropDuration={trollDropDuration}
              setTrollDropDuration={setTrollDropDuration}
              paypalTesting={paypalTesting}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <FinanceEconomyCenter
              stats={stats}
              economySummary={economySummary}
              economyLoading={economyLoading}
              onLoadEconomySummary={loadEconomySummary}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <RevenueInventoryDashboard />
          </ErrorBoundary>

          <ErrorBoundary>
            <OperationsControlDeck
              liveStreams={liveStreams}
              streamsLoading={streamsLoading}
              onLoadLiveStreams={loadLiveStreams}
              onEndStreamById={endStreamById}
              onDeleteStreamById={deleteStreamById}
              onViewStream={viewStream}
              stats={stats}
            />
          </ErrorBoundary>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ErrorBoundary>
              <PresidentialOversightPanel />
            </ErrorBoundary>
            <ErrorBoundary>
              <ProposalManagementPanel viewMode="admin" />
            </ErrorBoundary>
          </div>

          <ErrorBoundary>
            <AdditionalTasksGrid
              onNavigateToEconomy={handleNavigateToEconomy}
              onNavigateToTaxReviews={handleNavigateToTaxReviews}
              onOpenTestDiagnostics={handleOpenTestDiagnostics}
              onOpenControlPanel={handleOpenControlPanel}
              onOpenGrantCoins={handleOpenGrantCoins}
              onOpenAdminPool={handleOpenAdminPool}
              onOpenTrollmersTournament={handleOpenTrollmersTournament}
              onOpenFinanceDashboard={handleOpenFinanceDashboard}
              onOpenCreateSchedule={handleOpenCreateSchedule}
              onOpenOfficerShifts={handleOpenOfficerShifts}
              onOpenResetPanel={handleOpenResetPanel}
              onOpenEmpireApplications={handleOpenEmpireApplications}
              onOpenReferralBonuses={handleOpenReferralBonuses}
              onOpenApplications={handleOpenApplications}
              onSelectTab={_handleSelectTab}
              counts={{
                empire_apps: stats.pendingApps,
                cashouts: stats.pendingPayouts,
                reports: stats.aiFlags,
                alerts: taskCounts.alerts,
                tax_reviews: taskCounts.taxReviews,
                support: taskCounts.supportTickets,
              }}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}