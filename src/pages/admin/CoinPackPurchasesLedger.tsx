// src/pages/admin/CoinPackPurchasesLedger.tsx
//
// AUDIT / REPORTING PAGE — READ ONLY
// Admin / CEO only. This component never changes wallet balances.
//
// Active sources merged:
//   A) coin_transactions
//   B) purchase_ledger + purchasable_items
//
// Manual coin order support is intentionally removed. This page must not query
// the old manual order table or use embedded package joins through package_id.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Calendar,
  Coins,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Filter,
  FolderOpen,
  Save,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react'

import { useAuthStore } from '../../lib/store'
import { hasRole, supabase } from '../../lib/supabase'

type CoinPurchaseStatus =
  | 'created'
  | 'paid'
  | 'fulfilled'
  | 'canceled'
  | 'cancelled'
  | 'failed'
  | 'refunded'
  | 'pending'
  | 'chargeback'

type PurchaseSource = 'coin_transactions' | 'purchase_ledger'

interface CoinPackPurchaseLedgerRow {
  id: string
  source: PurchaseSource
  purchaseDate: string
  userId: string
  realName: string | null
  email: string | null
  username: string | null
  displayName: string | null
  coinPackName: string | null
  coinsPurchased: number
  amountPaid: number
  currency: string
  paymentProvider: string | null
  providerTransactionId: string | null
  stripeSessionId: string | null
  status: CoinPurchaseStatus
  createdAt: string
  notes?: string | null
}

interface PurchaseNote {
  id: string
  purchaseId: string
  body: string
  createdAt: string
  updatedAt: string
}

interface FileAttachment {
  id: string
  purchaseId: string
  name: string
  type: string
  size: number
  dataUrl: string
  uploadedAt: string
}

interface FilterDateRange {
  start: string
  end: string
}

type ProfileLike = {
  id?: string
  username?: string | null
  display_name?: string | null
  full_name?: string | null
  legal_full_name?: string | null
  email?: string | null
}

type CoinPackageLike = {
  id?: string
  name?: string | null
  price_usd?: number | string | null
  coins?: number | string | null
}

type PurchasableItemLike = {
  display_name?: string | null
  item_key?: string | null
  is_coin_pack?: boolean | null
  usd_price?: number | string | null
  coin_price?: number | string | null
  metadata?: Record<string, unknown> | null
}

const LS_NOTES_KEY = 'tc_purchase_ledger_notes'
const LS_FILES_KEY = 'tc_purchase_ledger_files'
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const STATUS_STYLES: Record<CoinPurchaseStatus, string> = {
  created: 'bg-slate-500/15 border-slate-400/25 text-slate-300',
  paid: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300',
  fulfilled: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300',
  pending: 'bg-amber-500/15 border-amber-400/30 text-amber-300',
  failed: 'bg-red-500/18 border-red-400/30 text-red-300',
  refunded: 'bg-purple-500/15 border-purple-400/30 text-purple-300',
  chargeback: 'bg-red-900/25 border-red-600/40 text-red-400',
  canceled: 'bg-slate-500/15 border-slate-400/25 text-slate-300',
  cancelled: 'bg-slate-500/15 border-slate-400/25 text-slate-300',
}

const PROVIDER_ICONS: Record<string, string> = {
  stripe: '💳',
  paypal: '🅿️',
  cashapp: '💵',
  venmo: '🟣',
  square: '⬜',
  coins: '🪙',
  other: '💳',
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function uid(prefix = 'id'): string {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${randomPart}`
}

function stableId(source: PurchaseSource, id: string | number | null | undefined): string {
  return `${source}:${String(id ?? uid('missing'))}`
}

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveLS<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`[CoinPackPurchasesLedger] Failed to save ${key}`, error)
  }
}

function normaliseJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatCoins(value: number): string {
  return `${value.toLocaleString('en-US')} 🪙`
}

function buildRealName(profile: ProfileLike | null): string | null {
  const legalName = profile?.legal_full_name?.trim()
  if (legalName) return legalName

  const fullName = profile?.full_name?.trim()
  if (fullName) return fullName

  return null
}

function normaliseStatus(status: unknown): CoinPurchaseStatus {
  const raw = String(status ?? 'paid').toLowerCase()

  if (raw === 'cancelled') return 'cancelled'
  if (raw === 'canceled') return 'canceled'
  if (raw === 'fulfilled') return 'fulfilled'
  if (raw === 'pending') return 'pending'
  if (raw === 'failed') return 'failed'
  if (raw === 'refunded') return 'refunded'
  if (raw === 'chargeback') return 'chargeback'
  if (raw === 'created') return 'created'

  return 'paid'
}

function isWithin60s(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false

  const ta = Date.parse(a)
  const tb = Date.parse(b)

  if (Number.isNaN(ta) || Number.isNaN(tb)) return false
  return Math.abs(ta - tb) <= 60_000
}

function getTxProvider(tx: Record<string, any>): string {
  const source = String(tx.source ?? '').toLowerCase()
  const type = String(tx.type ?? tx.transaction_type ?? '').toLowerCase()

  if (source === 'paypal' || type.includes('paypal')) return 'paypal'
  if (source === 'cashapp' || type.includes('cashapp')) return 'cashapp'
  if (source === 'venmo' || type.includes('venmo')) return 'venmo'
  if (source === 'square' || type.includes('square')) return 'square'
  if (source === 'stripe' || type.includes('stripe')) return 'stripe'
  if (source === 'coin_store' || type.includes('store') || type.includes('purchase')) return 'stripe'

  return source || type || 'other'
}

function getLedgerProvider(ledgerRow: Record<string, any>): string {
  const rawMethod = String(ledgerRow.payment_method ?? '').toLowerCase()
  const sourceContext = String(ledgerRow.source_context ?? '').toLowerCase()

  if (rawMethod === 'card') return 'square'
  if (rawMethod === 'manual') return 'cashapp'
  if (rawMethod === 'coins') return 'coins'
  if (rawMethod) return rawMethod

  if (sourceContext.includes('square')) return 'square'
  if (sourceContext.includes('paypal')) return 'paypal'
  if (sourceContext.includes('stripe')) return 'stripe'
  if (sourceContext.includes('coin_store')) return 'stripe'

  return 'other'
}

function getTxAmountPaid(tx: Record<string, any>): number {
  const metadata = asRecord(tx.metadata)

  const directUsd = toNumber(tx.usd_amount)
  if (directUsd > 0) return directUsd

  const amountUsd = toNumber(tx.amount_usd)
  if (amountUsd > 0) return amountUsd

  const platformProfit = toNumber(tx.platform_profit)
  if (platformProfit > 0) return platformProfit

  const metadataAmount = toNumber(
    metadata.amount_paid ??
      metadata.amount_usd ??
      metadata.usd_amount ??
      metadata.total ??
      metadata.amount,
  )

  return metadataAmount > 0 ? metadataAmount : 0
}

function dateIsInRange(dateValue: string, dateRange: FilterDateRange): boolean {
  if (!dateRange.start && !dateRange.end) return true

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false

  if (dateRange.start) {
    const start = new Date(`${dateRange.start}T00:00:00`)
    if (date < start) return false
  }

  if (dateRange.end) {
    const end = new Date(`${dateRange.end}T23:59:59.999`)
    if (date > end) return false
  }

  return true
}

function csvCell(value: unknown): string {
  const clean = String(value ?? '').replace(/"/g, '""')
  return `"${clean}"`
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const StatCard: React.FC<{
  label: string
  value: React.ReactNode
  sub?: string
  icon: React.ReactNode
  accent?: string
  glow?: 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'pink'
}> = ({ label, value, sub, icon, accent = 'text-cyan-200', glow }) => {
  const glowRgb = {
    cyan: '45,212,191',
    green: '52,211,153',
    amber: '251,191,36',
    red: '244,63,94',
    purple: '167,139,250',
    pink: '236,72,153',
  } as const

  const glowStyle: React.CSSProperties | undefined = glow
    ? {
        boxShadow: `0 0 22px rgba(${glowRgb[glow]},0.26), inset 0 0 10px rgba(${glowRgb[glow]},0.06)`,
      }
    : undefined

  return (
    <div
      className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm transition-all hover:border-white/20"
      style={glowStyle}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={accent}>{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
      </div>
      <p className="text-xl font-black text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] font-medium text-slate-400">{sub}</p> : null}
    </div>
  )
}

const ActionButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'danger' | 'ghost'
    icon?: React.ReactNode
  }
> = ({ children, variant = 'primary', icon, className = '', ...props }) => {
  const base = 'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200'
  const variants = {
    primary:
      'bg-cyan-500/20 border border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/35 hover:border-cyan-400/50 hover:shadow-[0_0_14px_rgba(45,212,191,0.22)] disabled:cursor-not-allowed disabled:opacity-40',
    danger:
      'bg-red-500/15 border border-red-400/25 text-red-200 hover:bg-red-500/30 hover:border-red-400/45 disabled:cursor-not-allowed disabled:opacity-40',
    ghost:
      'bg-white/[0.04] border border-white/10 text-slate-300 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40',
  }

  return (
    <button type="button" className={cx(base, variants[variant], className)} {...props}>
      {icon}
      {children}
    </button>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-purple-300">{icon}</span>
      <h2 className="text-base font-black uppercase tracking-[0.12em] text-purple-100/80">
        {label}
      </h2>
      <span className="h-px flex-1 bg-gradient-to-r from-purple-400/30 via-cyan-400/15 to-transparent" />
    </div>
  )
}

function InfoCard({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item, index) => (
          <p
            key={`${label}-${item}-${index}`}
            className={cx(
              'text-[11px]',
              index % 2 === 0 ? 'font-bold text-slate-300' : 'text-slate-400',
            )}
          >
            {item}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function CoinPackPurchasesLedger() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const allowed = useMemo(() => hasRole(profile, ['admin', 'ceo'] as any), [profile])

  const [purchases, setPurchases] = useState<CoinPackPurchaseLedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [packFilter, setPackFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<FilterDateRange>({ start: '', end: '' })

  const [notes, setNotes] = useState<PurchaseNote[]>(() => loadLS(LS_NOTES_KEY, []))
  const [files, setFiles] = useState<FileAttachment[]>(() => loadLS(LS_FILES_KEY, []))

  const [showNotePanel, setShowNotePanel] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteTargetPurchaseId, setNoteTargetPurchaseId] = useState<string | null>(null)

  const [showFileUpload, setShowFileUpload] = useState(false)
  const [selectedPurchaseForUpload, setSelectedPurchaseForUpload] = useState<string | null>(null)
  const [uploadPreview, setUploadPreview] = useState<{
    name: string
    type: string
    size: number
    dataUrl: string
  } | null>(null)

  useEffect(() => {
    saveLS(LS_NOTES_KEY, notes)
  }, [notes])

  useEffect(() => {
    saveLS(LS_FILES_KEY, files)
  }, [files])

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true)

      const [txResult, ledgerResult, coinPackagesResult] = await Promise.all([
        supabase
          .from('coin_transactions')
          .select(`
            id,
            user_id,
            amount,
            coin_amount,
            type,
            transaction_type,
            status,
            source,
            usd_amount,
            amount_usd,
            platform_profit,
            paypal_order_id,
            paypal_capture_id,
            external_id,
            metadata,
            transaction_date,
            created_at,
            user_profiles:user_id (
              id,
              username,
              display_name,
              full_name,
              legal_full_name,
              email
            )
          `)
          .or(
            [
              'type.in.(purchase,store_purchase,paypal_purchase,coin_purchase,cashapp_purchase,stripe_purchase,square_purchase)',
              'source.in.(paypal,coin_store,purchase,stripe,cashapp,square)',
              'paypal_order_id.not.is.null',
              'paypal_capture_id.not.is.null',
            ].join(','),
          )
          .order('created_at', { ascending: false })
          .limit(5000),

        supabase
          .from('purchase_ledger')
          .select(`
            id,
            user_id,
            item_id,
            coin_amount,
            usd_amount,
            payment_method,
            source_context,
            created_at,
            metadata,
            purchasable_items:item_id (
              display_name,
              item_key,
              is_coin_pack,
              usd_price,
              coin_price,
              metadata
            ),
            user_profiles:user_id (
              id,
              username,
              display_name,
              full_name,
              legal_full_name,
              email
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5000),

        supabase.from('coin_packages').select('id, name, price_usd, coins').limit(1000),
      ])

      const firstError = txResult.error ?? ledgerResult.error ?? coinPackagesResult.error
      if (firstError) throw firstError

      const txRows = (txResult.data ?? []) as Array<Record<string, any>>
      const ledgerRows = (ledgerResult.data ?? []) as Array<Record<string, any>>
      const coinPackages = (coinPackagesResult.data ?? []) as CoinPackageLike[]

      const userIds = Array.from(
        new Set(
          [...txRows, ...ledgerRows]
            .map(row => String(row.user_id ?? ''))
            .filter(Boolean),
        ),
      )

      const profilesMap = new Map<string, ProfileLike>()

      for (const row of [...txRows, ...ledgerRows]) {
        const joinedProfile = normaliseJoined<ProfileLike>(row.user_profiles)
        if (joinedProfile?.id) profilesMap.set(joinedProfile.id, joinedProfile)
      }

      if (userIds.length) {
        const { data: profilesData, error: profilesErr } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, full_name, legal_full_name, email')
          .in('id', userIds)

        if (profilesErr) throw profilesErr

        for (const profileRow of profilesData ?? []) {
          profilesMap.set(profileRow.id, profileRow)
        }
      }

      const packageMap = new Map<string, CoinPackageLike>()
      for (const pack of coinPackages) {
        if (pack.id) packageMap.set(String(pack.id), pack)
      }

      const rows: CoinPackPurchaseLedgerRow[] = []

      for (const tx of txRows) {
        const userId = String(tx.user_id ?? '')
        const txDate = String(tx.transaction_date ?? tx.created_at ?? '')

        const coveredByLedger = ledgerRows.some(
          ledgerRow => ledgerRow.user_id === tx.user_id && isWithin60s(txDate, ledgerRow.created_at),
        )

        if (coveredByLedger) continue

        const profileRow = profilesMap.get(userId) ?? normaliseJoined<ProfileLike>(tx.user_profiles)
        const metadata = asRecord(tx.metadata)
        const packageId = metadata.package_id ? String(metadata.package_id) : null
        const packageInfo = packageId ? packageMap.get(packageId) : null

        rows.push({
          id: stableId('coin_transactions', tx.id),
          source: 'coin_transactions',
          purchaseDate: txDate,
          userId,
          realName: buildRealName(profileRow ?? null),
          email: profileRow?.email ?? null,
          username: profileRow?.username ?? null,
          displayName: profileRow?.display_name ?? profileRow?.username ?? null,
          coinPackName:
            packageInfo?.name ??
            (String(metadata.package_name ?? metadata.coin_pack_name ?? metadata.pack_name ?? '') || null),
          coinsPurchased: toNumber(tx.coin_amount ?? tx.amount ?? metadata.coins ?? metadata.coin_amount),
          amountPaid: getTxAmountPaid(tx),
          currency: 'USD',
          paymentProvider: getTxProvider(tx),
          providerTransactionId:
            tx.paypal_order_id ?? tx.paypal_capture_id ?? tx.external_id ?? tx.id ?? null,
          stripeSessionId: String(metadata.stripe_session_id ?? metadata.session_id ?? '') || null,
          status: normaliseStatus(tx.status),
          createdAt: String(tx.created_at ?? txDate),
          notes: String(metadata.note_suggested ?? metadata.notes ?? '') || null,
        })
      }

      for (const ledgerRow of ledgerRows) {
        const userId = String(ledgerRow.user_id ?? '')
        const profileRow = profilesMap.get(userId) ?? normaliseJoined<ProfileLike>(ledgerRow.user_profiles)
        const item = normaliseJoined<PurchasableItemLike>(ledgerRow.purchasable_items)
        const itemMetadata = asRecord(item?.metadata)
        const ledgerMetadata = asRecord(ledgerRow.metadata)

        let amountPaid = toNumber(ledgerRow.usd_amount)
        if (amountPaid <= 0) amountPaid = toNumber(item?.usd_price)

        const coinsPurchased = toNumber(
          ledgerRow.coin_amount ??
            ledgerMetadata.coins ??
            ledgerMetadata.coin_amount ??
            (item?.is_coin_pack ? itemMetadata.coins : 0),
        )

        rows.push({
          id: stableId('purchase_ledger', ledgerRow.id),
          source: 'purchase_ledger',
          purchaseDate: String(ledgerRow.created_at ?? ''),
          userId,
          realName: buildRealName(profileRow ?? null),
          email: profileRow?.email ?? null,
          username: profileRow?.username ?? null,
          displayName: profileRow?.display_name ?? profileRow?.username ?? null,
          coinPackName: item?.display_name ?? item?.item_key ?? null,
          coinsPurchased,
          amountPaid,
          currency: 'USD',
          paymentProvider: getLedgerProvider(ledgerRow),
          providerTransactionId: ledgerRow.id ? `ledger:${String(ledgerRow.id).slice(0, 12)}` : null,
          stripeSessionId: String(ledgerMetadata.stripe_session_id ?? ledgerMetadata.session_id ?? '') || null,
          status: 'paid',
          createdAt: String(ledgerRow.created_at ?? ''),
          notes: String(ledgerMetadata.note_suggested ?? ledgerMetadata.notes ?? '') || null,
        })
      }

      rows.sort((a, b) => {
        const bTime = new Date(b.purchaseDate).getTime()
        const aTime = new Date(a.purchaseDate).getTime()
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
      })

      setPurchases(rows)
    } catch (error: any) {
      console.error('[CoinPackPurchasesLedger] Failed to load purchases:', error)
      toast.error(`Load failed: ${error?.message ?? 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!allowed) {
      toast.error('Admin or CEO access only')
      navigate('/', { replace: true })
    }
  }, [allowed, navigate])

  useEffect(() => {
    if (!allowed) return

    void loadPurchases()
    const timer = window.setInterval(() => {
      void loadPurchases()
    }, 120_000)

    return () => window.clearInterval(timer)
  }, [allowed, loadPurchases])

  const filtered = useMemo(() => {
    let list = purchases

    if (statusFilter !== 'all') list = list.filter(row => row.status === statusFilter)
    if (providerFilter !== 'all') {
      list = list.filter(row => String(row.paymentProvider ?? '') === providerFilter)
    }

    if (packFilter !== 'all') {
      list = list.filter(
        row => String(row.coinPackName ?? '').toLowerCase() === packFilter.toLowerCase(),
      )
    }

    if (dateRange.start || dateRange.end) {
      list = list.filter(row => dateIsInRange(row.purchaseDate, dateRange))
    }

    const query = search.trim().toLowerCase()
    if (query) {
      list = list.filter(row =>
        [
          row.realName,
          row.displayName,
          row.username,
          row.email,
          row.userId,
          row.providerTransactionId,
          row.stripeSessionId,
          row.coinPackName,
          row.paymentProvider,
          row.source,
        ]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(query)),
      )
    }

    return list
  }, [dateRange, packFilter, providerFilter, purchases, search, statusFilter])

  const allProviders = useMemo(
    () =>
      Array.from(new Set(purchases.map(row => row.paymentProvider).filter(Boolean) as string[])).sort(),
    [purchases],
  )

  const allPacks = useMemo(
    () =>
      Array.from(new Set(purchases.map(row => row.coinPackName).filter(Boolean) as string[])).sort(),
    [purchases],
  )

  const stats = useMemo(() => {
    const revenueRows = filtered.filter(row => row.status === 'paid' || row.status === 'fulfilled')
    const totalRevenue = revenueRows.reduce((sum, row) => sum + row.amountPaid, 0)
    const totalCoins = revenueRows.reduce((sum, row) => sum + row.coinsPurchased, 0)
    const uniqueBuyers = new Set(revenueRows.map(row => row.userId)).size
    const missingNames = filtered.filter(row => !row.realName).length
    const failed = filtered.filter(row =>
      ['failed', 'refunded', 'chargeback', 'cancelled', 'canceled'].includes(row.status),
    ).length

    return {
      totalRevenue,
      totalCoins,
      totalPurchases: revenueRows.length,
      uniqueBuyers,
      missingNames,
      failed,
      totalDisplayed: filtered.length,
    }
  }, [filtered])

  const exportCSV = useCallback(() => {
    const headers = [
      'Purchase Date',
      'Real Name',
      'Email',
      'User ID',
      'Username',
      'Display Name',
      'Coin Pack / Type',
      'Coins Purchased',
      'Amount Paid (USD)',
      'Payment Provider',
      'Provider Transaction ID',
      'Stripe Session ID',
      'Status',
      'Source',
      'Created At',
      'Notes',
    ]

    const csvRows = filtered.map(row => [
      row.purchaseDate,
      row.realName ?? 'Missing real name',
      row.email ?? '',
      row.userId,
      row.username ?? '',
      row.displayName ?? '',
      row.coinPackName ?? '',
      row.coinsPurchased,
      row.amountPaid.toFixed(2),
      row.paymentProvider ?? '',
      row.providerTransactionId ?? '',
      row.stripeSessionId ?? '',
      row.status,
      row.source,
      row.createdAt,
      row.notes ?? '',
    ])

    const csv = [headers, ...csvRows].map(row => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `coin_purchases_ledger_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()

    URL.revokeObjectURL(url)
    toast.success('Ledger exported to CSV')
  }, [filtered])

  const clearFilters = () => {
    setStatusFilter('all')
    setProviderFilter('all')
    setPackFilter('all')
    setSearch('')
    setDateRange({ start: '', end: '' })
  }

  const notesForPurchase = useCallback(
    (purchaseId: string) => notes.filter(note => note.purchaseId === purchaseId),
    [notes],
  )

  const attachmentsForPurchase = useCallback(
    (purchaseId: string) => files.filter(file => file.purchaseId === purchaseId),
    [files],
  )

  const addNoteForPurchase = (purchaseId: string) => {
    const body = noteBody.trim()
    if (!body) {
      toast.error('Write a note first')
      return
    }

    const now = new Date().toISOString()

    setNotes(previous => [
      {
        id: uid('note'),
        purchaseId,
        body,
        createdAt: now,
        updatedAt: now,
      },
      ...previous,
    ])

    setNoteBody('')
    toast.success('Note added')
  }

  const deleteNote = (noteId: string) => {
    setNotes(previous => previous.filter(note => note.id !== noteId))
  }

  const handleAttachmentUpload = () => {
    if (!uploadPreview || !selectedPurchaseForUpload) return

    const attachment: FileAttachment = {
      id: uid('file'),
      purchaseId: selectedPurchaseForUpload,
      name: uploadPreview.name,
      type: uploadPreview.type,
      size: uploadPreview.size,
      dataUrl: uploadPreview.dataUrl,
      uploadedAt: new Date().toISOString(),
    }

    setFiles(previous => [attachment, ...previous])
    toast.success(`"${uploadPreview.name}" attached`)

    setUploadPreview(null)
    setShowFileUpload(false)
    setSelectedPurchaseForUpload(null)
  }

  const deleteAttachment = (id: string) => {
    setFiles(previous => previous.filter(file => file.id !== id))
  }

  if (!allowed) return null

  const activePurchase = noteTargetPurchaseId
    ? purchases.find(row => row.id === noteTargetPurchaseId)
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050A14] via-[#08101F] to-[#0A0514] p-4 text-white md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-400 bg-clip-text text-2xl font-black text-transparent md:text-3xl">
            Coin Pack Purchases Ledger
          </h1>
          <p className="text-sm text-slate-400">
            Full audit trail of coin pack purchases.
            <span className="ml-1 font-bold text-purple-300">
              Admin / CEO only. Read-only. No wallet changes.
            </span>
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            sub={`${stats.totalPurchases} paid / fulfilled purchases`}
            icon={<DollarSign size={16} />}
            accent="text-emerald-200"
            glow="green"
          />
          <StatCard
            label="Coins Sold"
            value={formatCoins(stats.totalCoins)}
            icon={<Coins size={16} />}
            accent="text-yellow-300"
          />
          <StatCard
            label="Rows Displayed"
            value={stats.totalDisplayed}
            sub="after filters"
            icon={<CreditCard size={16} />}
            accent="text-cyan-200"
            glow="cyan"
          />
          <StatCard
            label="Unique Buyers"
            value={stats.uniqueBuyers}
            icon={<Users size={16} />}
            accent="text-blue-200"
          />
          <StatCard
            label="Missing Real Name"
            value={stats.missingNames}
            sub={stats.missingNames > 0 ? 'needs backfill' : 'all named'}
            icon={<AlertTriangle size={16} />}
            accent={stats.missingNames > 0 ? 'text-amber-300' : 'text-emerald-300'}
            glow={stats.missingNames > 0 ? 'amber' : 'green'}
          />
          <StatCard
            label="Failed / Refunded"
            value={stats.failed}
            sub="flagged rows"
            icon={<ShieldCheck size={16} />}
            accent={stats.failed > 0 ? 'text-red-300' : 'text-emerald-300'}
          />
          <StatCard
            label="Attachments"
            value={files.length}
            icon={<FolderOpen size={16} />}
            accent="text-purple-200"
            glow="purple"
          />
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-cyan-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Filters
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ActionButton onClick={clearFilters} variant="ghost" icon={<X size={13} />}>
                Clear All
              </ActionButton>
              <ActionButton onClick={exportCSV} variant="primary" icon={<Download size={14} />}>
                Export CSV
              </ActionButton>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-sm text-white placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none"
                placeholder="Search name, email, user id, tx id..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>

            <select
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="chargeback">Chargeback</option>
              <option value="cancelled">Cancelled</option>
              <option value="canceled">Canceled</option>
            </select>

            <select
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none"
              value={providerFilter}
              onChange={event => setProviderFilter(event.target.value)}
            >
              <option value="all">All Providers</option>
              {allProviders.map(provider => (
                <option key={provider} value={provider}>
                  {PROVIDER_ICONS[provider] ?? '💳'} {provider.toUpperCase()}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <Calendar size={11} className="text-slate-500" />
              <input
                type="date"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none"
                value={dateRange.start}
                onChange={event =>
                  setDateRange(previous => ({ ...previous, start: event.target.value }))
                }
              />
              <span className="text-xs text-slate-500">→</span>
              <input
                type="date"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none"
                value={dateRange.end}
                onChange={event =>
                  setDateRange(previous => ({ ...previous, end: event.target.value }))
                }
              />
            </div>

            <select
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none"
              value={packFilter}
              onChange={event => setPackFilter(event.target.value)}
            >
              <option value="all">All Coin Packs</option>
              {allPacks.map(pack => (
                <option key={pack} value={pack}>
                  {pack}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Schema Discovery & Backfill Status</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
              <InfoCard
                label="Schema Validation"
                items={['No manual orders', 'No first_name select', 'Valid TSX close']}
              />
              <InfoCard
                label="Backfill Tracking"
                items={['Missing names flagged', 'CSV export ready', 'Notes local only']}
              />
              <InfoCard
                label="Data Sources"
                items={['coin_transactions', 'purchase_ledger', 'coin_packages lookup']}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-purple-300" />
              <h3 className="text-sm font-bold text-white">Local Attachment Storage</h3>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              Attachments and notes are saved in this browser&apos;s localStorage. For official
              company records, move this later to a Supabase Storage bucket with admin / CEO RLS.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader
              icon={<Wallet size={18} />}
              label={`Purchase Ledger — ${filtered.length} of ${purchases.length} rows`}
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-purple-400" />
              <p className="mt-4 text-sm text-slate-400">Loading purchase ledger...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
              No purchases match current filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04]">
                      {[
                        'Date',
                        'Real Name',
                        'Email',
                        'User ID',
                        'Username / Display',
                        'Coin Pack',
                        'Coins',
                        'Amount USD',
                        'Provider',
                        'Provider Tx ID',
                        'Status',
                        'Source',
                        'Created At',
                        'Actions',
                      ].map(heading => (
                        <th
                          key={heading}
                          className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map(row => {
                      const isMissingName = !row.realName
                      const isFlaggedStatus = ['failed', 'refunded', 'chargeback'].includes(row.status)
                      const rowNotes = notesForPurchase(row.id)
                      const rowAttachments = attachmentsForPurchase(row.id)

                      return (
                        <tr
                          key={row.id}
                          className={cx(
                            'border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]',
                            isFlaggedStatus && 'bg-red-950/10',
                            isMissingName && 'bg-amber-950/10',
                          )}
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                            {formatDate(row.purchaseDate)}
                          </td>

                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {isMissingName ? (
                                <AlertTriangle
                                  size={12}
                                  className="shrink-0 text-amber-400"
                                  aria-label="Real name missing"
                                />
                              ) : null}
                              <span
                                className={cx(
                                  'whitespace-nowrap font-medium',
                                  isMissingName ? 'text-amber-300 italic' : 'text-white',
                                )}
                              >
                                {row.realName ?? 'Missing real name'}
                              </span>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-400">
                            {row.email ?? '—'}
                          </td>

                          <td
                            className="max-w-[140px] truncate whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-slate-500"
                            title={row.userId}
                          >
                            {row.userId}
                          </td>

                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-300">
                            {row.displayName ?? row.username ?? '—'}
                          </td>

                          <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-cyan-200">
                            {row.coinPackName ?? '—'}
                          </td>

                          <td className="whitespace-nowrap px-3 py-2.5 font-black text-yellow-300">
                            {formatCoins(row.coinsPurchased)}
                          </td>

                          <td className="whitespace-nowrap px-3 py-2.5 font-black text-emerald-300">
                            {formatCurrency(row.amountPaid)}
                          </td>

                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className="text-sm">
                              {PROVIDER_ICONS[row.paymentProvider ?? ''] ?? '💳'}
                            </span>
                            <span className="ml-1 text-xs text-slate-300">
                              {row.paymentProvider ?? '—'}
                            </span>
                          </td>

                          <td
                            className="max-w-[160px] truncate px-3 py-2.5 font-mono text-xs text-slate-400"
                            title={row.providerTransactionId ?? ''}
                          >
                            {row.providerTransactionId ? (
                              <span className="text-purple-300">
                                {row.providerTransactionId.slice(0, 18)}
                                {row.providerTransactionId.length > 18 ? '…' : ''}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="px-3 py-2.5">
                            <span
                              className={cx(
                                'inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                                STATUS_STYLES[row.status],
                              )}
                            >
                              {row.status}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-500">
                            {row.source}
                          </td>

                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                            {formatDate(row.createdAt)}
                          </td>

                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setNoteTargetPurchaseId(row.id)
                                  setShowNotePanel(true)
                                }}
                                className="relative rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-purple-300"
                                title="Add / view notes"
                              >
                                <StickyNote size={13} />
                                {rowNotes.length ? (
                                  <span className="absolute -right-1 -top-1 rounded-full bg-purple-500 px-1 text-[8px] font-black text-white">
                                    {rowNotes.length}
                                  </span>
                                ) : null}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPurchaseForUpload(row.id)
                                  setUploadPreview(null)
                                  setShowFileUpload(true)
                                }}
                                className="relative rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-cyan-300"
                                title="Attach file"
                              >
                                <Upload size={13} />
                                {rowAttachments.length ? (
                                  <span className="absolute -right-1 -top-1 rounded-full bg-cyan-500 px-1 text-[8px] font-black text-white">
                                    {rowAttachments.length}
                                  </span>
                                ) : null}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {files.length ? (
          <section className="space-y-3">
            <SectionHeader icon={<FolderOpen size={18} />} label="Attached Receipts / Documents" />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {files.map(file => {
                const linkedPurchase = purchases.find(row => row.id === file.purchaseId)

                return (
                  <div
                    key={file.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <FileText size={18} className="mt-0.5 shrink-0 text-purple-300" />
                      <div className="min-w-0 flex-1">
                        <a
                          href={file.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-bold text-white hover:text-cyan-200"
                          title={file.name}
                        >
                          {file.name}
                        </a>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {(file.size / 1024).toFixed(1)} KB · {formatDateTime(file.uploadedAt)}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-slate-400">
                          {linkedPurchase?.realName ??
                            linkedPurchase?.displayName ??
                            linkedPurchase?.username ??
                            linkedPurchase?.userId ??
                            'Unknown purchase'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteAttachment(file.id)}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
                        title="Delete attachment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {showNotePanel ? (
          <section
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => {
              setShowNotePanel(false)
              setNoteTargetPurchaseId(null)
              setNoteBody('')
            }}
          >
            <div
              className="w-full max-w-lg space-y-4 rounded-2xl border border-white/15 bg-slate-950 p-6 shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Purchase Notes</h3>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
                    {activePurchase?.realName ??
                      activePurchase?.displayName ??
                      activePurchase?.username ??
                      noteTargetPurchaseId ??
                      'Purchase'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowNotePanel(false)
                    setNoteTargetPurchaseId(null)
                    setNoteBody('')
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-red-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none"
                  placeholder="Write a note about this purchase..."
                  value={noteBody}
                  onChange={event => setNoteBody(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && noteTargetPurchaseId) {
                      addNoteForPurchase(noteTargetPurchaseId)
                    }
                  }}
                />
                <ActionButton
                  onClick={() => noteTargetPurchaseId && addNoteForPurchase(noteTargetPurchaseId)}
                  icon={<Save size={14} />}
                >
                  Save
                </ActionButton>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto">
                {noteTargetPurchaseId && notesForPurchase(noteTargetPurchaseId).length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">
                    No notes for this purchase yet.
                  </p>
                ) : null}

                {noteTargetPurchaseId
                  ? notesForPurchase(noteTargetPurchaseId).map(note => (
                      <div
                        key={note.id}
                        className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-200">
                          {note.body}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-slate-600">
                            {formatDateTime(note.createdAt)}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteNote(note.id)}
                            className="rounded-lg p-1 text-slate-500 transition hover:text-red-400"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </section>
        ) : null}

        {showFileUpload ? (
          <section
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => {
              setShowFileUpload(false)
              setUploadPreview(null)
              setSelectedPurchaseForUpload(null)
            }}
          >
            <div
              className="w-full max-w-lg space-y-4 rounded-2xl border border-white/15 bg-slate-950 p-6 shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Attach Receipt / Document</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowFileUpload(false)
                    setUploadPreview(null)
                    setSelectedPurchaseForUpload(null)
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-red-400"
                >
                  <X size={18} />
                </button>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-purple-400/20 bg-white/[0.02] p-8 transition hover:border-purple-400/45 hover:bg-white/[0.04]">
                <Upload size={28} className="text-purple-300" />
                <span className="text-sm font-medium text-slate-300">Select file, max 10 MB</span>
                <input
                  type="file"
                  className="hidden"
                  accept="*/*"
                  onChange={async event => {
                    const file = event.target.files?.[0]
                    if (!file) return

                    if (file.size > MAX_ATTACHMENT_BYTES) {
                      toast.error('Max 10 MB per attachment')
                      return
                    }

                    const dataUrl = await readFileAsDataURL(file)
                    setUploadPreview({
                      name: file.name,
                      type: file.type || 'application/octet-stream',
                      size: file.size,
                      dataUrl,
                    })
                  }}
                />
              </label>

              {uploadPreview ? (
                <div className="flex items-center gap-3 rounded-xl border border-purple-400/20 bg-purple-500/10 p-3">
                  <FileText size={18} className="shrink-0 text-purple-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{uploadPreview.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {(uploadPreview.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <ActionButton variant="ghost" onClick={() => setUploadPreview(null)}>
                    <X size={14} />
                  </ActionButton>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <ActionButton
                  variant="ghost"
                  onClick={() => {
                    setShowFileUpload(false)
                    setUploadPreview(null)
                    setSelectedPurchaseForUpload(null)
                  }}
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  onClick={handleAttachmentUpload}
                  disabled={!uploadPreview || !selectedPurchaseForUpload}
                  icon={<Upload size={14} />}
                >
                  Attach to Purchase
                </ActionButton>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
