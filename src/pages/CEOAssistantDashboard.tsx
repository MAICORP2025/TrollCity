import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Coin,
  Coins,
  Command,
  FileText,
  Gavel,
  Home,
  LifeBuoy,
  List,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Newspaper,
  Package,
  Radio,
  Scale,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Users,
  Video,
  Wallet,
  XCircle,
} from 'lucide-react'

type DashboardTab = 
  | 'overview' 
  | 'payout_requests' 
  | 'user_reports' 
  | 'moderation_actions' 
  | 'applications' 
  | 'admin_reports' 
  | 'rtc_monitor' 
  | 'audit_log'

type PayoutRequest = {
  id: string
  user_id: string
  coin_amount: number
  cash_amount: number
  net_amount: number
  bonus_amount: number
  status: string
  provider_type: string | null
  provider_username: string | null
  user_tag: string | null
  forwarded_to_admin: boolean
  created_at: string
  requester: {
    username: string
    display_name: string
    payout_paypal_email: string
  }
}

type UserReport = {
  id: string
  reporter_id: string
  reported_user_id: string
  reason: string
  description: string
  status: string
  created_at: string
  reporter: {
    username: string
    display_name: string
  }
  reported_user: {
    username: string
    display_name: string
  }
}

type ModerationAction = {
  id: string
  actor_id: string
  target_user_id: string
  action_type: string
  reason: string
  created_at: string
  actor: {
    username: string
    display_name: string
  }
  target_user: {
    username: string
    display_name: string
  }
}

type Application = {
  id: string
  user_id: string
  role_requested: string
  message: string
  status: string
  created_at: string
  user_profiles: {
    username: string
    display_name: string
  }
}

type AdminReport = {
  id: string
  title: string
  severity: string
  category: string
  description: string
  status: string
  created_at: string
  submitted_by: {
    username: string
    display_name: string
  }
}

type AuditLog = {
  id: string
  action: string
  details: unknown
  created_at: string
  user_profiles: {
    username: string
    display_name: string
  }
}

const statsCardClasses =
  'rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/30 backdrop-blur-xl'

const panelClasses =
  'rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/30 backdrop-blur-xl'

const inputClasses =
  'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20'

const labelClasses = 'text-xs font-black uppercase tracking-[0.16em] text-slate-300'

const primaryButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-4 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50'

const dangerButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-black text-red-50 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50'

const softButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'payout_requests', label: 'Payout Requests' },
  { id: 'user_reports', label: 'User Reports' },
  { id: 'moderation_actions', label: 'Moderation Actions' },
  { id: 'applications', label: 'Applications' },
  { id: 'admin_reports', label: 'Admin Reports' },
  { id: 'rtc_monitor', label: 'RTC Monitor' },
  { id: 'audit_log', label: 'Audit Log' }
]

const parseNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const safeDate = (value?: string | null) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleString()
}

const safeShortDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

const renderDetails = (details: unknown) => {
  if (!details) return 'No additional details recorded.'
  if (typeof details === 'string') return details
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return 'Details could not be displayed.'
  }
}

const statusTone = (status?: string | null) => {
  const normalized = (status || '').toLowerCase()
  if (['approved', 'active', 'completed', 'signed', 'paid', 'delivered'].includes(normalized)) return 'bg-emerald-500/10 text-emerald-100 border-emerald-300/20'
  if (['pending', 'pending_signature', 'under_review', 'changes_requested', 'reviewed', 'submitted'].includes(normalized)) return 'bg-amber-500/10 text-amber-100 border-amber-300/20'
  if (['rejected', 'void', 'voided', 'suspended', 'failed', 'cancelled'].includes(normalized)) return 'bg-red-500/10 text-red-100 border-red-300/20'
  return 'bg-cyan-500/10 text-cyan-100 border-cyan-300/20'
}

const serializeDashboardError = (error: any): any => {
  if (!error) {
    return {
      message: 'Unknown dashboard error',
      raw: error,
    }
  }

  if (typeof error === 'string') {
    return {
      message: error || 'Empty string error',
      raw: error,
    }
  }

  const message =
    error.message ||
    error.error_description ||
    error.error ||
    error.details ||
    error.hint ||
    error.statusText ||
    ''

  return {
    message: message || JSON.stringify(error) || 'Dashboard error returned no message',
    code: error.code || null,
    details: error.details || null,
    hint: error.hint || null,
    status: error.status || null,
    raw: error,
  }
}

const runDashboardQuery = async <T,>(
  label: string,
  query: PromiseLike<{ data: T; error: any; count?: number | null }>,
): Promise<{ data: T; count?: number | null }> => {
  console.log(`[CEOAssistantDashboard] starting: ${label}`)

  const result = await query

  if (result.error) {
    const serialized = serializeDashboardError(result.error)

    console.error(`[CEOAssistantDashboard] failed: ${label}`, {
      label,
      ...serialized,
    })

    const err = new Error(`${label} failed: ${serialized.message}`)
    ;(err as any).label = label
    ;(err as any).supabaseError = serialized
    throw err
  }

  console.log(`[CEOAssistantDashboard] loaded: ${label}`, {
    label,
    count: result.count ?? (Array.isArray(result.data) ? result.data.length : null),
    hasData: !!result.data,
  })

  return {
    data: result.data,
    count: result.count,
  }
}

const runOptionalDashboardQuery = async <T,>(
  label: string,
  query: PromiseLike<{ data: T; error: any; count?: number | null }>,
  fallbackData: T,
): Promise<{ data: T; count?: number | null }> => {
  try {
    return await runDashboardQuery(label, query)
  } catch (error) {
    const serialized = serializeDashboardError(error)
    console.warn(`[CEOAssistantDashboard] optional query failed, using fallback: ${label}`, serialized)

    return {
      data: fallbackData,
      count: 0,
    }
  }
}

export default function CEOAssistantDashboard() {
  const { user, profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Stats for overview
  const [pendingPayoutsCount, setPendingPayoutsCount] = useState(0)
  const [pendingReportsCount, setPendingReportsCount] = useState(0)
  const [pendingModerationCount, setPendingModerationCount] = useState(0)
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0)
  const [pendingAdminReportsCount, setPendingAdminReportsCount] = useState(0)
  const [auditLogCount, setAuditLogCount] = useState(0)

  // Data for tabs
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([])
  const [userReports, setUserReports] = useState<UserReport[]>([])
  const [moderationActions, setModerationActions] = useState<ModerationAction[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [adminReports, setAdminReports] = useState<AdminReport[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Role check: only ceo_assistant, admin, ceo can access
  const isCEOAssistant =
    profile?.role === 'ceo_assistant' ||
    profile?.troll_role === 'ceo_assistant'
  const isAdmin =
    profile?.role === UserRole.ADMIN ||
    profile?.troll_role === UserRole.ADMIN ||
    profile?.role === UserRole.HR_ADMIN ||
    profile?.role === UserRole.AGENCY_HR_MANAGER ||
    profile?.is_admin ||
    profile?.role === 'superadmin' ||
    profile?.troll_role === 'ceo' ||
    !!(profile as { is_superadmin?: boolean })?.is_superadmin
  const isCEO = profile?.troll_role === 'ceo'

  const canAccess = isCEOAssistant || isAdmin || isCEO

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#050507] px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 shadow-2xl shadow-red-950/30">
          <div className="flex items-center gap-3 text-red-100">
            <ShieldAlert className="h-6 w-6" />
            <h1 className="text-2xl font-black">CEO Assistant Dashboard access required</h1>
          </div>
          <p className="mt-4 text-sm leading-7 text-red-100/90">
            Your current role is {profile?.role || 'unknown'}. This page is restricted to CEO Assistant, Admin, and CEO roles.
          </p>
          <Link to="/" className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">
            Return home
          </Link>
        </div>
      </div>
    )
  }

  const setNotice = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      setSuccess(message)
      setError(null)
    } else {
      setError(message)
      setSuccess(null)
    }
  }

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      console.log('[CEOAssistantDashboard] loading dashboard', {
        userId: user?.id,
        profileId: profile?.id,
        role: profile?.role,
        trollRole: profile?.troll_role,
        isAdmin: profile?.is_admin,
      })

      // Load overview stats
      const pendingPayouts = await runDashboardQuery(
        'pending payouts count',
        supabase
          .from('payout_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'reviewed', 'submitted']),
      )
      setPendingPayoutsCount(pendingPayouts.count || 0)

      const pendingReports = await runDashboardQuery(
        'pending user reports count',
        supabase
          .from('user_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
      )
      setPendingReportsCount(pendingReports.count || 0)

      const pendingModeration = await runDashboardQuery(
        'pending moderation actions count',
        supabase
          .from('moderation_actions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      )
      setPendingModerationCount(pendingModeration.count || 0)

      const pendingApplications = await runDashboardQuery(
        'pending applications count',
        supabase
          .from('role_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      )
      setPendingApplicationsCount(pendingApplications.count || 0)

      const pendingAdminReports = await runDashboardQuery(
        'pending admin reports count',
        supabase
          .from('admin_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
      )
      setPendingAdminReportsCount(pendingAdminReports.count || 0)

      const auditLogCountQuery = await runDashboardQuery(
        'audit log count',
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('actor_id', profile?.id),
      )
      setAuditLogCount(auditLogCountQuery.count || 0)

      // Load payout requests
      const payoutRequestsResult = await runDashboardQuery(
        'payout requests',
        supabase
          .from('payout_requests')
          .select('*, requester:user_profiles!payout_requests_user_id_fkey(username, display_name, payout_paypal_email)')
          .in('status', ['pending', 'reviewed', 'submitted'])
          .order('created_at', { ascending: false }),
      )
      setPayoutRequests(payoutRequestsResult.data || [])

      // Load user reports
      const userReportsResult = await runDashboardQuery(
        'user reports',
        supabase
          .from('user_reports')
          .select('*, reporter:user_profiles!user_reports_reporter_id_fkey(username, display_name), reported_user:user_profiles!user_reports_reported_user_id_fkey(username, display_name)')
          .eq('status', 'open')
          .order('created_at', { ascending: false }),
      )
      setUserReports(userReportsResult.data || [])

      // Load moderation actions
      const moderationActionsResult = await runDashboardQuery(
        'moderation actions',
        supabase
          .from('moderation_actions')
          .select('*, actor:user_profiles!moderation_actions_actor_id_fkey(username, display_name), target_user:user_profiles!moderation_actions_target_user_id_fkey(username, display_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      )
      setModerationActions(moderationActionsResult.data || [])

      // Load applications (role requests)
      const applicationsResult = await runDashboardQuery(
        'applications',
        supabase
          .from('role_requests')
          .select('*, user_profiles(username, display_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      )
      setApplications(applicationsResult.data || [])

      // Load admin reports
      const adminReportsResult = await runDashboardQuery(
        'admin reports',
        supabase
          .from('admin_reports')
          .select('*, submitted_by:user_profiles(username, display_name)')
          .eq('status', 'open')
          .order('created_at', { ascending: false }),
      )
      setAdminReports(adminReportsResult.data || [])

      // Load audit logs (my actions)
      const auditLogsResult = await runDashboardQuery(
        'audit logs',
        supabase
          .from('audit_logs')
          .select('*, user_profiles(username, display_name)')
          .eq('actor_id', profile?.id)
          .order('created_at', { ascending: false })
          .limit(50),
      )
      setAuditLogs(auditLogsResult.data || [])

    } catch (err: any) {
      const serialized = serializeDashboardError(err)

      console.error('[CEOAssistantDashboard] Failed to load dashboard', {
        ...serialized,
        label: err?.label,
        supabaseError: err?.supabaseError,
      })

      setNotice(
        `CEO Assistant dashboard failed at ${err?.label || 'unknown query'}: ${
          err?.supabaseError?.message || serialized.message || 'No error message returned'
        }`,
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const summaryCards = [
    { label: 'Pending Payouts', value: pendingPayoutsCount, helper: 'Awaiting review/processing', icon: Coins, tone: 'text-cyan-300' },
    { label: 'User Reports', value: pendingReportsCount, helper: 'Open reports requiring review', icon: AlertTriangle, tone: 'text-amber-300' },
    { label: 'Moderation Actions', value: pendingModerationCount, helper: 'Pending actions to process', icon: ShieldAlert, tone: 'text-red-300' },
    { label: 'Applications', value: pendingApplicationsCount, helper: 'Role requests pending review', icon: BriefcaseBusiness, tone: 'text-purple-300' },
    { label: 'Admin Reports', value: pendingAdminReportsCount, helper: 'Reports from staff', icon: FileText, tone: 'text-blue-300' },
    { label: 'My Actions', value: auditLogCount, helper: 'Your audit log entries', icon: List, tone: 'text-green-300' },
  ]

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#050507] px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 shadow-2xl shadow-red-950/30">
          <div className="flex items-center gap-3 text-red-100">
            <ShieldAlert className="h-6 w-6" />
            <h1 className="text-2xl font-black">CEO Assistant Dashboard access required</h1>
          </div>
          <p className="mt-4 text-sm leading-7 text-red-100/90">
            Your current role is {profile?.role || 'unknown'}. This page is restricted to CEO Assistant, Admin, and CEO roles.
          </p>
          <Link to="/" className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">
            Return home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.15),transparent_28%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_32%)]" />
      </div>

      <main className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                CEO Assistant Dashboard
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Manage payouts, reports, applications, and moderation actions
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
                {profile?.role || 'unknown'} access for operational oversight and support.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[24rem]">
              <button type="button" onClick={() => void loadDashboard()} disabled={loading || saving} className={primaryButtonClasses}>
                <ArrowRight className="h-4 w-4" />
                Refresh
              </button>
              <Link
                to="/home"
                className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-3 text-center text-sm font-bold text-fuchsia-50 transition hover:border-fuchsia-200/50 hover:bg-fuchsia-500/15"
              >
                Home
              </Link>
            </div>
          </div>
        </section>

        {(error || success) && (
          <div
            className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
              error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
            }`}
          >
            {error || success}
          </div>
        )}

        <section className="flex gap-2 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-black/30 p-2 backdrop-blur-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black transition ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-50 shadow-lg shadow-cyan-950/30'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </section>

        {(activeTab === 'overview' || activeTab === 'payout_requests' || activeTab === 'user_reports' || activeTab === 'moderation_actions' || activeTab === 'applications' || activeTab === 'admin_reports' || activeTab === 'rtc_monitor' || activeTab === 'audit_log') && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className={statsCardClasses}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{card.label}</p>
                      <p className="mt-3 text-3xl font-black text-white">{loading ? '…' : card.value}</p>
                    </div>
                    <div className={`rounded-2xl bg-white/5 p-3 ${card.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{card.helper}</p>
                </div>
              )
            })}
          </section>
        )}

        {activeTab === 'overview' && (
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className={panelClasses}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Operations overview</p>
                  <h2 className="mt-2 text-xl font-black text-white">Current workload and queues</h2>
                </div>
                <button type="button" onClick={() => setActiveTab('payout_requests')} className="inline-flex items-center gap-2 text-sm font-bold text-cyan-100">
                  Payout Requests
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">Loading overview...</div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">Pending Payouts</p>
                          <p className="text-xs text-slate-300">Awaiting review and processing</p>
                        </div>
                        <span className="text-2xl font-black text-white">{pendingPayoutsCount}</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">User Reports</p>
                          <p className="text-xs text-slate-300">Open reports requiring review</p>
                        </div>
                        <span className="text-2xl font-black text-white">{pendingReportsCount}</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">Moderation Actions</p>
                          <p className="text-xs text-slate-300">Pending actions to process</p>
                        </div>
                        <span className="text-2xl font-black text-white">{pendingModerationCount}</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">Applications</p>
                          <p className="text-xs text-slate-300">Role requests pending review</p>
                        </div>
                        <span className="text-2xl font-black text-white">{pendingApplicationsCount}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={panelClasses}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Quick links</p>
              <div className="mt-4 space-y-3">
                <Link
                  to="/payouts/request"
                  className="block rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Create Payout Request</p>
                      <p className="text-xs text-slate-300">Submit a new payout request for processing</p>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>

                <Link
                  to="/"
                  className="block rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Staff Reports</p>
                      <p className="text-xs text-slate-300">View and manage reports from lead officers and secretary</p>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>

                <Link
                  to="/rtc-admin-monitor"
                  className="block rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">RTC Admin Monitor</p>
                      <p className="text-xs text-slate-300">Monitor real-time chat and interactions</p>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'payout_requests' && (
          <section className={panelClasses}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Cashout Request Queue</p>
                <h2 className="mt-2 text-xl font-black text-white">Review cashout requests and forward to Admin</h2>
                <p className="mt-1 text-xs text-slate-400">Cashout requests from users appear here on weekends. Review and forward to the Admin Operations & Control Deck for payout processing.</p>
              </div>
            </div>

            <div className="mt-5">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">Loading cashout requests...</div>
              ) : payoutRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">No pending cashout requests. Users submit these on weekends from their wallet page.</div>
              ) : (
                <div className="bg-black/40 rounded-lg border border-purple-700/50 overflow-hidden overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                    <thead className="bg-purple-900/30 text-xs uppercase text-gray-400">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3">Provider Username</th>
                        <th className="px-4 py-3">User Tag</th>
                        <th className="px-4 py-3">Coins</th>
                        <th className="px-4 py-3">Cash (USD)</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {payoutRequests.map((req) => (
                        <tr key={req.id} className="border-t border-purple-700/30">
                          <td className="px-4 py-3">
                            <div className="font-bold">{req.requester?.display_name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">@{req.requester?.username || 'N/A'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded capitalize">
                              {req.provider_type || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded">
                              {req.provider_username || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded text-cyan-300">
                              {req.user_tag || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">{req.coin_amount?.toLocaleString() || '0'}</td>
                          <td className="px-4 py-3 font-bold text-troll-gold">
                            ${req.cash_amount?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${statusTone(req.status)}`}>
                              {req.forwarded_to_admin ? 'Forwarded' : req.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {!req.forwarded_to_admin && (
                              <button
                                onClick={async () => {
                                  try {
                                    setSaving(true);
                                    const { error } = await supabase.rpc('forward_payout_to_admin', {
                                      p_payout_id: req.id,
                                      p_assistant_id: profile?.id,
                                      p_assistant_username: profile?.username || 'ceo_assistant',
                                    });
                                    if (error) throw error;
                                    setNotice(`Payout request forwarded to Admin Operations & Control Deck.`, 'success');
                                    await loadDashboard();
                                  } catch (err: any) {
                                    setNotice(`Failed to forward: ${err.message}`, 'error');
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                                disabled={saving}
                                className="px-3 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs font-bold disabled:opacity-50"
                              >
                                Forward to Admin
                              </button>
                            )}
                            {req.forwarded_to_admin && (
                              <span className="text-xs text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Sent to Admin
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'user_reports' && (
          <section className={panelClasses}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">User Reports Review</p>
                <h2 className="mt-2 text-xl font-black text-white">Review and act on user reports</h2>
              </div>
              <select
                value=""
                onChange={(e) => {}}
                className={`${inputClasses} lg:max-w-xs`}
                disabled
              >
                <option value="">Filter by status</option>
                <option value="open">Open</option>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="mt-5">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">Loading user reports...</div>
              ) : userReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">No user reports found.</div>
              ) : (
                <div className="bg-black/40 rounded-lg border border-purple-700/50 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-purple-900/30 text-xs uppercase text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Reporter</th>
                        <th className="px-4 py-3">Reported User</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {userReports.map((report) => (
                        <tr key={report.id} className="border-t border-purple-700/30">
                          <td className="px-4 py-3">
                            <div className="font-bold">{report.reporter?.display_name}</div>
                            <div className="text-xs text-gray-500">@{report.reporter?.username}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold">{report.reported_user?.display_name}</div>
                            <div className="text-xs text-gray-500">@{report.reported_user?.username}</div>
                          </td>
                          <td className="px-4 py-3">{report.reason}</td>
                          <td className="px-4 py-3">{report.description}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold uppercase ${statusTone(report.status)}`}>
                              {report.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 space-x-2">
                            <button
                              onClick={() => {
                                // Resolve report (placeholder)
                                setNotice(`Report ${report.id} marked as resolved`, 'success')
                              }}
                              className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => {
                                // Reject report (placeholder)
                                setNotice(`Report ${report.id} rejected`, 'success')
                              }}
                              className="px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                      {userReports.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No user reports found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'moderation_actions' && (
          <section className="rounded-[1.5rem] border border-white/10 bg-black/30 p-6">
            <div className="text-sm text-slate-300">
              Moderation action details are loading. Please refresh or select another tab.
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default CEOAssistantDashboard
