import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeAlert,
  Bug,
  ChevronRight,
  ClipboardList,
  Copy,
  DollarSign,
  Eye,
  FileWarning,
  Filter,
  Gauge,
  Lock,
  Megaphone,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

import { Button } from '@/components/ui/button'
import { useSecurityEvents } from '../../hooks/useSecurityEvents'
import { logSecurityEvent } from '../../lib/securityLogger'
import { sendNotification } from '../../lib/sendNotification'

type SecurityTab =
  | 'overview'
  | 'threat-feed'
  | 'risk-users'
  | 'rate-limits'
  | 'cashout-risk'
  | 'admin-audit'
  | 'incident-reports'
  | 'page-errors'
  | 'settings'

type SecurityEvent = {
  id: string
  event_type?: string | null
  severity?: string | null
  status?: string | null
  user_id?: string | null
  actor_id?: string | null
  target_user_id?: string | null
  stream_id?: string | null
  agency_id?: string | null
  cashout_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  device_fingerprint?: string | null
  route?: string | null
  url?: string | null
  source?: string | null
  title?: string | null
  description?: string | null
  metadata?: any
  risk_score?: number | null
  created_at?: string | null
  updated_at?: string | null
}

type RiskScore = {
  id?: string
  user_id?: string | null
  risk_score?: number | null
  risk_level?: string | null
  failed_login_count?: number | null
  suspicious_action_count?: number | null
  last_event_at?: string | null
  last_ip_address?: string | null
  notes?: string | null
  metadata?: any
}

type RateLimitRow = {
  id: string
  bucket?: string
  identifier?: string
  user_id?: string | null
  ip_address?: string | null
  action?: string
  hit_count?: number
  window_start?: string
  window_end?: string
  blocked_until?: string | null
  created_at?: string
}

type AuditLogEntry = {
  id: string
  action?: string
  user_id?: string | null
  target_id?: string | null
  details?: any
  created_at?: string
  ip_address?: string | null
}

type BugReport = {
  id: string
  created_at?: string
  status?: string
  severity?: string
  source?: string
  page_url?: string | null
  route_path?: string | null
  user_id?: string | null
  user_email?: string | null
  error_code?: string | null
  error_message?: string
  error_details?: string | null
  browser_info?: any
  app_context?: any
  occurrence_count?: number
}

type PayoutRequest = {
  id: string
  user_id?: string
  coin_amount?: number
  cash_amount?: number
  status?: string
  created_at?: string
  updated_at?: string
  rejection_reason?: string | null
  amount_usd?: number
}

const shellClass =
  'min-h-screen overflow-y-auto bg-[#040611] text-white'

const glassPanel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-2xl shadow-cyan-950/25 backdrop-blur-xl'

const softPanel =
  'rounded-3xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/25 backdrop-blur-xl'

const inputClass =
  'h-11 w-full rounded-2xl border border-cyan-300/15 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'

const tabButtonBase =
  'group relative flex min-w-max items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition whitespace-nowrap'

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
}

const shortId = (value?: string | null) => {
  if (!value) return '—'
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

const normalize = (value?: string | null, fallback = 'unknown') =>
  String(value || fallback).trim().toLowerCase()

const titleCase = (value?: string | null) =>
  String(value || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const getSeverityClasses = (severity?: string | null) => {
  const normalized = normalize(severity, 'low')
  if (normalized === 'critical') {
    return 'border-pink-300/40 bg-pink-500/15 text-pink-100 shadow-[0_0_22px_rgba(236,72,153,0.18)]'
  }
  if (normalized === 'high') {
    return 'border-red-300/40 bg-red-500/15 text-red-100'
  }
  if (normalized === 'medium') {
    return 'border-amber-300/40 bg-amber-500/15 text-amber-100'
  }
  return 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100'
}

const getStatusClasses = (status?: string | null) => {
  const normalized = normalize(status, 'open')
  if (normalized === 'resolved') {
    return 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
  }
  if (normalized === 'investigating') {
    return 'border-blue-300/35 bg-blue-500/12 text-blue-100'
  }
  if (normalized === 'ignored' || normalized === 'false_positive') {
    return 'border-slate-300/25 bg-slate-500/10 text-slate-200'
  }
  return 'border-amber-300/35 bg-amber-500/12 text-amber-100'
}

const getRiskClasses = (level?: string | null) => {
  const normalized = normalize(level, 'low')
  if (normalized === 'critical') return 'border-pink-300/40 bg-pink-500/15 text-pink-100'
  if (normalized === 'high') return 'border-red-300/40 bg-red-500/15 text-red-100'
  if (normalized === 'medium') return 'border-amber-300/40 bg-amber-500/15 text-amber-100'
  return 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100'
}

const Pill = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${className}`}>
    {children}
  </span>
)

const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) => (
  <div className={`${softPanel} flex min-h-[16rem] flex-col items-center justify-center px-6 py-10 text-center`}>
    <div className="grid h-16 w-16 place-items-center rounded-3xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="mt-5 text-xl font-black text-white">{title}</h3>
    <p className="mt-2 max-w-xl text-sm leading-7 text-slate-300">{description}</p>
  </div>
)

const MetricCard = ({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'cyan',
}: {
  label: string
  value: string | number
  helper: string
  icon: React.ElementType
  tone?: 'cyan' | 'purple' | 'amber' | 'red' | 'emerald' | 'pink'
}) => {
  const toneMap: Record<string, string> = {
    cyan: 'border-cyan-300/20 bg-cyan-500/10 text-cyan-200 shadow-cyan-950/30',
    purple: 'border-purple-300/20 bg-purple-500/10 text-purple-200 shadow-purple-950/30',
    amber: 'border-amber-300/20 bg-amber-500/10 text-amber-200 shadow-amber-950/20',
    red: 'border-red-300/20 bg-red-500/10 text-red-200 shadow-red-950/20',
    emerald: 'border-emerald-300/20 bg-emerald-500/10 text-emerald-200 shadow-emerald-950/20',
    pink: 'border-pink-300/20 bg-pink-500/10 text-pink-200 shadow-pink-950/20',
  }

  return (
    <div className={`${softPanel} overflow-hidden p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-4 text-3xl font-black tracking-tight text-white">{value}</p>
        </div>
        <div className={`grid h-12 w-12 place-items-center rounded-2xl border shadow-xl ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{helper}</p>
    </div>
  )
}

const DetailRow = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <div className={`mt-2 break-words text-sm text-slate-100 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
  </div>
)

const safeJson = (value: any) => {
  if (!value) return '{}'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const tabItems: Array<{ id: SecurityTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'threat-feed', label: 'Threat Feed', icon: ShieldAlert },
  { id: 'risk-users', label: 'Risk Users', icon: Users },
  { id: 'rate-limits', label: 'Rate Limits', icon: Zap },
  { id: 'cashout-risk', label: 'Cashout Risk', icon: DollarSign },
  { id: 'admin-audit', label: 'Admin Audit', icon: ClipboardList },
  { id: 'incident-reports', label: 'Incidents', icon: FileWarning },
  { id: 'page-errors', label: 'Page Errors', icon: Bug },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function SecurityCommandCenter() {
  const navigate = useNavigate()
  const securityHook = useSecurityEvents() as any

  const {
    events = [],
    riskScores = [],
    rateLimits = [],
    auditLogs = [],
    bugReports = [],
    payoutRequests = [],
    incidentReports = [],
    loading,
    error,
    refresh,
    resolveEvent,
    markFalsePositive,
    ignoreEvent,
  } = securityHook

  const [activeTab, setActiveTab] = useState<SecurityTab>('overview')
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingEventId, setSavingEventId] = useState<string | null>(null)
  const [sendingNotificationId, setSendingNotificationId] = useState<string | null>(null)

  useEffect(() => {
    void refresh?.()
  }, [refresh])

  const typedEvents = (events || []) as SecurityEvent[]
  const typedRiskScores = (riskScores || []) as RiskScore[]
  const typedRateLimits = (rateLimits || []) as RateLimitRow[]
  const typedAuditLogs = (auditLogs || []) as AuditLogEntry[]
  const typedBugReports = (bugReports || []) as BugReport[]
  const typedPayoutRequests = (payoutRequests || []) as PayoutRequest[]
  const typedIncidentReports = (incidentReports || []) as any[]

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    return typedEvents.filter((event) => {
      const severityMatch = severityFilter === 'all' || normalize(event.severity) === severityFilter
      const statusMatch = statusFilter === 'all' || normalize(event.status) === statusFilter
      if (!severityMatch || !statusMatch) return false
      if (!term) return true
      const haystack = [
        event.id, event.event_type, event.title, event.description,
        event.user_id, event.actor_id, event.target_user_id,
        event.route, event.url, event.source, event.ip_address,
        safeJson(event.metadata),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [typedEvents, search, severityFilter, statusFilter])

  const cashoutEvents = useMemo(
    () => typedEvents.filter((event) => {
      const text = `${event.event_type || ''} ${event.title || ''} ${event.description || ''}`.toLowerCase()
      return text.includes('cashout') || text.includes('payout') || text.includes('wallet') || text.includes('coin')
    }),
    [typedEvents],
  )

  const cashoutPayouts = useMemo(
    () => typedPayoutRequests.filter((pr) => {
      const status = normalize(pr.status)
      return status === 'pending' || status === 'rejected'
    }),
    [typedPayoutRequests],
  )

  const apiSecurityEvents = useMemo(
    () => typedEvents.filter((event) => {
      const code = String(event.metadata?.error_code || event.metadata?.code || '').toLowerCase()
      return ['401', '403', '42501', '23514', 'pgrst301'].includes(code)
    }),
    [typedEvents],
  )

  const adminAccountEmail = String(import.meta.env.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com').toLowerCase()

  const incidentEvents = useMemo(
    () => typedEvents.filter((event) => {
      return ['critical', 'high'].includes(normalize(event.severity)) || normalize(event.status) === 'investigating'
    }),
    [typedEvents],
  )

  const pageErrorsFromBugs = useMemo(() => {
    return typedBugReports.filter((bug) => {
      const userEmail = String(bug.user_email || '').toLowerCase()
      if (userEmail === adminAccountEmail) return false
      return true
    })
  }, [typedBugReports, adminAccountEmail])

  const stats = useMemo(() => {
    const openThreats = typedEvents.filter((event) => normalize(event.status) === 'open').length
    const criticalThreats = typedEvents.filter((event) => normalize(event.severity) === 'critical').length
    const highRiskUsers = typedRiskScores.filter((score) => ['high', 'critical'].includes(normalize(score.risk_level))).length
    const failedLogins24h = typedEvents.filter((event) => {
      if (normalize(event.event_type) !== 'failed_login') return false
      const created = event.created_at ? new Date(event.created_at).getTime() : 0
      return created > Date.now() - 24 * 60 * 60 * 1000
    }).length
    const nowMs = Date.now()
    return {
      openThreats,
      criticalThreats,
      highRiskUsers,
      failedLogins24h,
      cashoutFlags: cashoutEvents.filter((event) => ['high', 'critical'].includes(normalize(event.severity))).length,
      adminActions: typedAuditLogs.length,
      broadcastAbuse: typedEvents.filter((event) => normalize(event.event_type).includes('broadcast')).length,
      apiSecurityErrors: apiSecurityEvents.length,
      pageErrors: pageErrorsFromBugs.length,
    }
  }, [typedEvents, typedRiskScores, cashoutEvents, typedAuditLogs, apiSecurityEvents, pageErrorsFromBugs])

  const updateEventStatus = async (event: SecurityEvent, status: 'investigating' | 'resolved' | 'ignored' | 'false_positive') => {
    if (!event?.id) return
    try {
      setSavingEventId(event.id)
      if (status === 'false_positive' && typeof markFalsePositive === 'function') {
        await markFalsePositive(event.id)
      } else if (status === 'ignored' && typeof ignoreEvent === 'function') {
        await ignoreEvent(event.id)
      } else if (typeof resolveEvent === 'function') {
        await resolveEvent(event.id, status, `Marked ${status} from Security Command Center`)
      } else {
        throw new Error('Security event action handler is not available.')
      }
      toast.success(`Event marked ${status.replaceAll('_', ' ')}`)
      await refresh?.()
    } catch (err: any) {
      console.error('[SecurityCommandCenter] Failed to update event status', err)
      toast.error(err?.message || 'Could not update event status.')
    } finally {
      setSavingEventId(null)
    }
  }

  const sendRetryNotification = async (event: SecurityEvent) => {
    if (!event?.user_id) return
    try {
      setSendingNotificationId(event.id)
      const issue = String(event.metadata?.error || event.metadata?.issue || event.description || 'Unknown issue')
      const url = event.route || event.url || window.location.pathname
      await sendNotification(
        event.user_id,
        'account_warning',
        'Retry the action that failed',
        `We detected an issue on ${url}. Please retry the action now. Issue: ${issue}`,
        { error_id: event.id, retry_url: url, issue, event_type: event.event_type, route: event.route, metadata: event.metadata },
      )
      toast.success('Retry notification sent to user.')
    } catch (err: any) {
      console.error('[SecurityCommandCenter] Failed to send retry notification', err)
      toast.error(err?.message || 'Could not send retry notification.')
    } finally {
      setSendingNotificationId(null)
    }
  }

  const logTestEvent = async () => {
    try {
      await logSecurityEvent({
        event_type: 'test_event',
        title: 'Security Command Center test event',
        description: 'This is a test event from the redesigned Security Command Center.',
        severity: 'low',
        risk_score: 10,
        metadata: { source_component: 'SecurityCommandCenter', route: window.location.pathname, tested_at: new Date().toISOString() },
      } as any)
      toast.success('Test security event logged.')
      await refresh?.()
    } catch (err: any) {
      console.error('[SecurityCommandCenter] Test event failed', err)
      toast.error(err?.message || 'Test event failed.')
    }
  }

  const copyEventId = async (eventId?: string | null) => {
    if (!eventId) return
    try {
      await navigator.clipboard.writeText(eventId)
      toast.success('Event ID copied.')
    } catch {
      toast.error('Could not copy event ID.')
    }
  }

  const isLoading = Boolean(loading)

  return (
    <div className={shellClass}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-12%] top-[10%] h-[34rem] w-[34rem] rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-[-16%] left-[20%] h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.045)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <main className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className={`${glassPanel} overflow-hidden`}>
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-8 top-8 hidden rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 lg:block">
              Defensive Monitoring Only
            </div>

            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                <Shield className="h-4 w-4" />
                Troll City Security Command
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">
                Security Command Center
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Review platform threats, risky accounts, cashout flags, API/RLS issues, and admin actions from one clean Troll City control room.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button type="button" onClick={() => void refresh?.()} disabled={isLoading}
                  className="rounded-2xl border border-cyan-300/30 bg-cyan-500/15 px-4 py-3 font-black text-cyan-50 hover:bg-cyan-500/25">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Security Data
                </Button>
                <Button type="button" onClick={() => void logTestEvent()}
                  className="rounded-2xl border border-purple-300/30 bg-purple-500/15 px-4 py-3 font-black text-purple-50 hover:bg-purple-500/25">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Log Test Event
                </Button>
                <Button type="button" onClick={() => navigate('/admin/payouts')}
                  className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 font-black text-emerald-50 hover:bg-emerald-500/20">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Open Payouts
                </Button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl border border-red-300/30 bg-red-500/10 p-5 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
              <div>
                <p className="font-black">Security dashboard load error</p>
                <p className="mt-1 text-sm leading-6 text-red-100/80">{error?.message || String(error)}</p>
              </div>
            </div>
          </section>
        )}

        <section className={`${softPanel} p-1.5 sm:p-2`}>
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-300/20 scrollbar-track-transparent pb-1">
            {tabItems.map((tab) => {
              const TabIcon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`${tabButtonBase} ${
                    active
                      ? 'border-cyan-300/40 bg-cyan-500/20 text-cyan-50 shadow-lg shadow-cyan-950/30'
                      : 'border-white/10 bg-black/20 text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-500/10 hover:text-white'
                  }`}
                >
                  <TabIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {activeTab === 'overview' && (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="Open Threats" value={stats.openThreats} helper="Events waiting for admin review." icon={ShieldAlert} tone="amber" />
              <MetricCard label="Critical Threats" value={stats.criticalThreats} helper="Highest priority events across the app." icon={BadgeAlert} tone="pink" />
              <MetricCard label="High Risk Users" value={stats.highRiskUsers} helper="Users with elevated risk scores." icon={Users} tone="red" />
              <MetricCard label="Failed Logins" value={stats.failedLogins24h} helper="Failed login events in the last 24 hours." icon={Lock} tone="purple" />
              <MetricCard label="Cashout Flags" value={stats.cashoutFlags} helper="Wallet, payout, or cashout related warnings." icon={DollarSign} tone="emerald" />
              <MetricCard label="Admin Actions" value={stats.adminActions} helper="Audit log entries from admin activity." icon={ClipboardList} tone="cyan" />
              <MetricCard label="Page Errors" value={stats.pageErrors} helper="App bug reports from real users." icon={Bug} tone="red" />
              <MetricCard label="Broadcast Abuse" value={stats.broadcastAbuse} helper="Stream and broadcast security signals." icon={Megaphone} tone="purple" />
              <MetricCard label="RLS/API Errors" value={stats.apiSecurityErrors} helper="Auth, RLS, and API security codes." icon={Activity} tone="red" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className={glassPanel}>
                <SectionHeader icon={ShieldAlert} eyebrow="Live threat feed" title="Newest security events"
                  actionLabel="Open Feed" onAction={() => setActiveTab('threat-feed')} />
                <div className="space-y-3 p-5 pt-0">
                  {typedEvents.slice(0, 6).length === 0 ? (
                    <EmptyState icon={ShieldCheck} title="No security events yet" description="When events are logged, the newest threats will appear here." />
                  ) : (
                    typedEvents.slice(0, 6).map((event) => (
                      <EventCard key={event.id} event={event}
                        onOpen={() => setSelectedEvent(event)}
                        onCopy={() => void copyEventId(event.id)}
                        onUser={() => event.user_id && navigate(`/profile/id/${event.user_id}`)} />
                    ))
                  )}
                </div>
              </div>

              <div className={glassPanel}>
                <SectionHeader icon={Users} eyebrow="Risk board" title="Highest risk users"
                  actionLabel="Risk Users" onAction={() => setActiveTab('risk-users')} />
                <div className="space-y-3 p-5 pt-0">
                  {typedRiskScores.slice(0, 6).length === 0 ? (
                    <EmptyState icon={User} title="No risk users yet" description="User risk scores will appear after events are logged." />
                  ) : (
                    typedRiskScores.slice()
                      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
                      .slice(0, 6)
                      .map((score) => <RiskUserCard key={score.id || score.user_id || Math.random()} score={score}
                        onProfile={() => score.user_id && navigate(`/profile/id/${score.user_id}`)} />)
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'threat-feed' && (
          <section className={glassPanel}>
            <SectionHeader icon={ShieldAlert} eyebrow="Security results" title="Threat Feed" />

            <div className="flex flex-col gap-3 border-t border-b border-white/10 bg-black/20 p-5 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, user, route, event type, source, metadata..."
                  className={`${inputClass} pl-11`} />
              </div>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className={inputClass}>
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
                <option value="false_positive">False Positive</option>
              </select>
              <Button type="button" onClick={() => { setSearch(''); setSeverityFilter('all'); setStatusFilter('all') }}
                className="rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 flex-shrink-0">
                <Filter className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>

            <div className="p-5">
              {filteredEvents.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No matching events" description="Change filters or log a test event to verify the feed." />
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event) => (
                    <EventCard key={event.id} event={event} detailed saving={savingEventId === event.id}
                      onOpen={() => setSelectedEvent(event)}
                      onCopy={() => void copyEventId(event.id)}
                      onUser={() => event.user_id && navigate(`/profile/id/${event.user_id}`)}
                      onInvestigate={() => void updateEventStatus(event, 'investigating')}
                      onResolve={() => void updateEventStatus(event, 'resolved')}
                      onIgnore={() => void updateEventStatus(event, 'ignored')}
                      onFalsePositive={() => void updateEventStatus(event, 'false_positive')} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'risk-users' && (
          <section className={glassPanel}>
            <SectionHeader icon={Users} eyebrow="Risk results" title="Risk Users" />
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {typedRiskScores.length === 0 ? (
                <div className="md:col-span-2 xl:col-span-3">
                  <EmptyState icon={User} title="No risk score rows found" description="Risk users will appear when security events update security_user_risk_scores." />
                </div>
              ) : (
                typedRiskScores.slice()
                  .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
                  .map((score) => <RiskUserCard key={score.id || score.user_id || Math.random()} score={score}
                    onProfile={() => score.user_id && navigate(`/profile/id/${score.user_id}`)} detailed />)
              )}
            </div>
          </section>
        )}

        {activeTab === 'rate-limits' && (
          <section className={glassPanel}>
            <SectionHeader icon={Zap} eyebrow="App protection" title="Rate Limits" />

            <div className="p-5 space-y-5">
              <p className="text-sm leading-7 text-slate-300">
                Real rate limit data from <code className="text-cyan-200">security_rate_limits</code>. These rows are written by the <code className="text-cyan-200">security_check_rate_limit</code> RPC when actions exceed configured thresholds.
              </p>

              {typedRateLimits.length === 0 ? (
                <EmptyState icon={Zap} title="No rate limit entries" description="Rate limit rows appear when the security_check_rate_limit RPC is called and records hits. This is normal if rate limiting hasn't been triggered yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                        <th className="pb-3 pr-4">Bucket</th>
                        <th className="pb-3 pr-4">Action</th>
                        <th className="pb-3 pr-4">Identifier</th>
                        <th className="pb-3 pr-4">User</th>
                        <th className="pb-3 pr-4">Hits</th>
                        <th className="pb-3 pr-4">Window</th>
                        <th className="pb-3 pr-4">Blocked Until</th>
                        <th className="pb-3">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typedRateLimits.slice(0, 50).map((rl) => (
                        <tr key={rl.id} className="border-b border-white/5 text-slate-200">
                          <td className="py-2.5 pr-4 font-mono text-xs text-cyan-200">{rl.bucket || '—'}</td>
                          <td className="py-2.5 pr-4">{rl.action || '—'}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{shortId(rl.identifier)}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{shortId(rl.user_id)}</td>
                          <td className="py-2.5 pr-4 font-bold">{rl.hit_count ?? 0}</td>
                          <td className="py-2.5 pr-4 text-xs">{formatDateTime(rl.window_start)}</td>
                          <td className="py-2.5 pr-4">
                            {rl.blocked_until ? (
                              <span className="rounded-full border border-red-300/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-200">
                                {formatDateTime(rl.blocked_until)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2.5 text-xs text-slate-400">{formatDateTime(rl.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'cashout-risk' && (
          <section className={glassPanel}>
            <SectionHeader icon={DollarSign} eyebrow="Money movement" title="Cashout Risk"
              actionLabel="Open Payouts" onAction={() => navigate('/admin/payouts')} />

            <div className="p-5 space-y-6">
              <div>
                <h3 className="text-lg font-black text-white mb-3">Flagged Security Events</h3>
                {cashoutEvents.length === 0 ? (
                  <p className="text-sm text-slate-400">No cashout, payout, wallet, or coin related security events found.</p>
                ) : (
                  <div className="space-y-3">
                    {cashoutEvents.map((event) => (
                      <EventCard key={event.id} event={event} detailed
                        onOpen={() => setSelectedEvent(event)}
                        onCopy={() => void copyEventId(event.id)}
                        onUser={() => event.user_id && navigate(`/profile/id/${event.user_id}`)} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-white mb-3">Pending / Rejected Payout Requests</h3>
                {cashoutPayouts.length === 0 ? (
                  <EmptyState icon={DollarSign} title="No flagged payout requests" description="Payout requests with pending or rejected status will appear here." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                          <th className="pb-3 pr-4">Payout ID</th>
                          <th className="pb-3 pr-4">User</th>
                          <th className="pb-3 pr-4">Coins</th>
                          <th className="pb-3 pr-4">Amount USD</th>
                          <th className="pb-3 pr-4">Status</th>
                          <th className="pb-3 pr-4">PayPal</th>
                          <th className="pb-3">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashoutPayouts.slice(0, 50).map((pr) => (
                          <tr key={pr.id} className="border-b border-white/5 text-slate-200">
                            <td className="py-2.5 pr-4 font-mono text-xs text-cyan-200">{shortId(pr.id)}</td>
                            <td className="py-2.5 pr-4 font-mono text-xs">{shortId(pr.user_id)}</td>
                            <td className="py-2.5 pr-4">{pr.coin_amount?.toLocaleString() ?? '—'}</td>
                            <td className="py-2.5 pr-4">${Number(pr.amount_usd || pr.cash_amount || 0).toFixed(2)}</td>
                            <td className="py-2.5 pr-4">
                              <Pill className={
                                normalize(pr.status) === 'rejected'
                                  ? 'border-red-300/40 bg-red-500/15 text-red-100'
                                  : 'border-amber-300/35 bg-amber-500/12 text-amber-100'
                              }>{pr.status || 'unknown'}</Pill>
                            </td>
                            <td className="py-2.5 pr-4 text-xs">{pr.paypal_email || '—'}</td>
                            <td className="py-2.5 text-xs text-slate-400">{formatDateTime(pr.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'admin-audit' && (
          <section className={glassPanel}>
            <SectionHeader icon={ClipboardList} eyebrow="Audit visibility" title="Admin Audit" />

            <div className="p-5">
              {typedAuditLogs.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No audit log entries" description="Admin actions logged to audit_logs will appear here. Actions like role changes, coin grants, and moderation events are recorded by triggers and application code." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                        <th className="pb-3 pr-4">Action</th>
                        <th className="pb-3 pr-4">Actor</th>
                        <th className="pb-3 pr-4">Target</th>
                        <th className="pb-3 pr-4">IP</th>
                        <th className="pb-3 pr-4">Details</th>
                        <th className="pb-3">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typedAuditLogs.slice(0, 100).map((log) => (
                        <tr key={log.id} className="border-b border-white/5 text-slate-200">
                          <td className="py-2.5 pr-4">
                            <span className="font-bold text-cyan-100">{titleCase(log.action)}</span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{shortId(log.user_id)}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{shortId(log.target_id)}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{log.ip_address || '—'}</td>
                          <td className="py-2.5 pr-4 max-w-xs">
                            <pre className="truncate text-xs text-slate-400">{safeJson(log.details)}</pre>
                          </td>
                          <td className="py-2.5 text-xs text-slate-400">{formatDateTime(log.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'incident-reports' && (
          <section className={glassPanel}>
            <SectionHeader icon={FileWarning} eyebrow="Incident queue" title="Incident Reports" />

            <div className="p-5 space-y-6">
              <div>
                <h3 className="text-lg font-black text-white mb-3">High-Priority Security Events</h3>
                {incidentEvents.length === 0 ? (
                  <EmptyState icon={FileWarning} title="No high-priority incidents" description="High, critical, and investigating events will appear here as incident candidates." />
                ) : (
                  <div className="space-y-3">
                    {incidentEvents.map((event) => (
                      <EventCard key={event.id} event={event} detailed
                        onOpen={() => setSelectedEvent(event)}
                        onCopy={() => void copyEventId(event.id)}
                        onUser={() => event.user_id && navigate(`/profile/id/${event.user_id}`)}
                        onInvestigate={() => void updateEventStatus(event, 'investigating')}
                        onResolve={() => void updateEventStatus(event, 'resolved')}
                        onIgnore={() => void updateEventStatus(event, 'ignored')}
                        onFalsePositive={() => void updateEventStatus(event, 'false_positive')} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-white mb-3">Incident Reports</h3>
                {typedIncidentReports.length === 0 ? (
                  <EmptyState icon={FileWarning} title="No incident reports" description="Formal incident reports created from security_incident_reports will appear here." />
                ) : (
                  <div className="space-y-3">
                    {typedIncidentReports.map((ir: any) => (
                      <article key={ir.id} className="rounded-3xl border border-white/10 bg-black/25 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <Pill className={getSeverityClasses(ir.severity)}>{normalize(ir.severity, 'medium')}</Pill>
                            <Pill className={`ml-2 ${getStatusClasses(ir.status)}`}>{normalize(ir.status, 'open')}</Pill>
                            <h4 className="mt-3 text-lg font-black text-white">{ir.title}</h4>
                            {ir.summary && <p className="mt-2 text-sm leading-6 text-slate-300">{ir.summary}</p>}
                            <p className="mt-2 text-xs text-slate-500">Created: {formatDateTime(ir.created_at)}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'page-errors' && (
          <section className={glassPanel}>
            <SectionHeader icon={Bug} eyebrow="Page diagnostics" title="Page Error Reports" />

            <div className="p-5">
              <p className="mb-4 text-sm text-slate-400">
                Real bug reports from <code className="text-cyan-200">app_bug_reports</code>. These are submitted by users from the BugCenter or via the report-bug Edge Function.
              </p>

              {pageErrorsFromBugs.length === 0 ? (
                <EmptyState icon={Bug} title="No bug reports" description="Bug reports submitted by users will appear here." />
              ) : (
                <div className="space-y-3">
                  {pageErrorsFromBugs.slice(0, 50).map((bug) => (
                    <BugReportCard key={bug.id} bug={bug} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className={glassPanel}>
            <SectionHeader icon={Settings} eyebrow="Recommended stack" title="Security Settings" />

            <div className="px-5 pb-5 space-y-6">
              <p className="max-w-4xl text-sm leading-7 text-slate-300">
                This page is defensive monitoring only. Keep third-party secrets out of the frontend and use backend Edge Functions for API-token integrations.
              </p>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Cloudflare WAF + Turnstile', 'Use WAF rules, bot protection, rate limits, and Turnstile on login, signup, cashout, and agency applications.'],
                  ['Supabase RLS + Audit Tables', 'Keep RLS tight and write important platform events into security_events and audit_logs.'],
                  ['Sentry / Better Stack', 'Use monitoring for app errors, abnormal spikes, and production incident grouping.'],
                  ['GitHub CodeQL / Dependabot / Snyk', 'Scan dependencies and code paths before deployment.'],
                  ['Frontend-safe env', 'VITE_TURNSTILE_SITE_KEY can be public. Cloudflare API tokens must be backend-only.'],
                  ['Data Sources', 'This dashboard reads from: security_events, security_user_risk_scores, security_rate_limits, security_incident_reports, audit_logs, app_bug_reports, payout_requests.'],
                ].map(([cardTitle, cardDescription]) => (
                  <div key={cardTitle} className={`${softPanel} p-5`}>
                    <h3 className="text-lg font-black text-white">{cardTitle}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{cardDescription}</p>
                  </div>
                ))}
              </div>

              <div className={`${softPanel} p-5`}>
                <h3 className="text-lg font-black text-white mb-3">Database Tables Connected</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  {[
                    { name: 'security_events', rows: typedEvents.length },
                    { name: 'security_user_risk_scores', rows: typedRiskScores.length },
                    { name: 'security_rate_limits', rows: typedRateLimits.length },
                    { name: 'audit_logs', rows: typedAuditLogs.length },
                    { name: 'app_bug_reports', rows: typedBugReports.length },
                    { name: 'payout_requests', rows: typedPayoutRequests.length },
                    { name: 'security_incident_reports', rows: typedIncidentReports.length },
                  ].map((t) => (
                    <div key={t.name} className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="font-mono text-xs text-cyan-200">{t.name}</p>
                      <p className="mt-1 text-lg font-black text-white">{t.rows} <span className="text-xs font-normal text-slate-400">rows loaded</span></p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <EventDetailsModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onCopy={() => selectedEvent?.id && void copyEventId(selectedEvent.id)}
        onUser={() => selectedEvent?.user_id && navigate(`/profile/id/${selectedEvent.user_id}`)}
        onRetryNotification={() => selectedEvent && void sendRetryNotification(selectedEvent)}
      />

      <Toaster position="top-right" />
    </div>
  )
}

function SectionHeader({ icon: Icon, eyebrow, title, actionLabel, onAction }: {
  icon: React.ElementType; eyebrow: string; title: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-black text-white">{title}</h2>
        </div>
      </div>
      {actionLabel && onAction && (
        <Button type="button" onClick={onAction}
          className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 font-black text-cyan-50 hover:bg-cyan-500/20">
          {actionLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function EventCard({ event, detailed = false, saving = false, onOpen, onCopy, onUser, onRetryNotification, onInvestigate, onResolve, onIgnore, onFalsePositive }: {
  event: SecurityEvent; detailed?: boolean; saving?: boolean; onOpen: () => void; onCopy: () => void;
  onUser?: () => void; onRetryNotification?: () => void; onInvestigate?: () => void;
  onResolve?: () => void; onIgnore?: () => void; onFalsePositive?: () => void;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-cyan-300/25 hover:bg-cyan-500/[0.045]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className={getSeverityClasses(event.severity)}>{normalize(event.severity, 'low')}</Pill>
            <Pill className={getStatusClasses(event.status)}>{normalize(event.status, 'open')}</Pill>
            <Pill className="border-slate-300/20 bg-slate-500/10 text-slate-200">{titleCase(event.event_type)}</Pill>
          </div>
          <h3 className="mt-3 break-words text-lg font-black text-white">{event.title || 'Security event'}</h3>
          {event.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{event.description}</p>}
          <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
            <span className="rounded-xl bg-white/[0.035] px-3 py-2">
              User: <span className="font-mono text-cyan-100">{shortId(event.user_id)}</span>
            </span>
            <span className="rounded-xl bg-white/[0.035] px-3 py-2">
              Route: <span className="text-slate-200">{event.route || event.url || '—'}</span>
            </span>
            <span className="rounded-xl bg-white/[0.035] px-3 py-2">
              Score: <span className="font-black text-white">{Number(event.risk_score || 0)}</span>
            </span>
            <span className="rounded-xl bg-white/[0.035] px-3 py-2">
              Time: <span className="text-slate-200">{formatDateTime(event.created_at)}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-[28rem] lg:justify-end">
          <Button type="button" onClick={onOpen} className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/20">
            <Eye className="mr-2 h-4 w-4" />Details
          </Button>
          <Button type="button" onClick={onCopy} className="rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Copy className="mr-2 h-4 w-4" />Copy
          </Button>
          {event.user_id && onUser && (
            <Button type="button" onClick={onUser} className="rounded-xl border border-purple-300/25 bg-purple-500/10 text-purple-50 hover:bg-purple-500/20">
              <User className="mr-2 h-4 w-4" />Profile
            </Button>
          )}
          {detailed && (
            <>
              {onInvestigate && (
                <Button type="button" disabled={saving} onClick={onInvestigate}
                  className="rounded-xl border border-blue-300/25 bg-blue-500/10 text-blue-50 hover:bg-blue-500/20">Investigate</Button>
              )}
              {onResolve && (
                <Button type="button" disabled={saving} onClick={onResolve}
                  className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 text-emerald-50 hover:bg-emerald-500/20">Resolve</Button>
              )}
              {onIgnore && (
                <Button type="button" disabled={saving} onClick={onIgnore}
                  className="rounded-xl border border-slate-300/20 bg-slate-500/10 text-slate-100 hover:bg-slate-500/20">Ignore</Button>
              )}
              {onRetryNotification && (
                <Button type="button" disabled={saving} onClick={onRetryNotification}
                  className="rounded-xl border border-pink-300/25 bg-pink-500/10 text-pink-50 hover:bg-pink-500/20">Retry Notice</Button>
              )}
              {onFalsePositive && (
                <Button type="button" disabled={saving} onClick={onFalsePositive}
                  className="rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10">False Positive</Button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  )
}

function RiskUserCard({ score, onProfile, detailed = false }: {
  score: RiskScore; onProfile?: () => void; detailed?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/25 p-5 transition hover:border-cyan-300/25">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Pill className={getRiskClasses(score.risk_level)}>{normalize(score.risk_level, 'low')}</Pill>
          <h3 className="mt-3 break-all font-mono text-sm font-black text-white">{score.user_id || 'Unknown user'}</h3>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-2xl font-black text-cyan-100">
          {Number(score.risk_score || 0)}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DetailMini label="Failed logins" value={Number(score.failed_login_count || 0)} />
        <DetailMini label="Suspicious actions" value={Number(score.suspicious_action_count || 0)} />
        <DetailMini label="Last event" value={formatDateTime(score.last_event_at)} />
        <DetailMini label="Last IP" value={score.last_ip_address || '—'} />
      </div>
      {detailed && score.notes && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-slate-300">{score.notes}</p>
      )}
      <Button type="button" onClick={onProfile} disabled={!score.user_id}
        className="mt-5 w-full rounded-2xl border border-purple-300/25 bg-purple-500/10 font-black text-purple-50 hover:bg-purple-500/20">
        Open Profile <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </article>
  )
}

function DetailMini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-100">{value}</p>
    </div>
  )
}

function BugReportCard({ bug }: { bug: BugReport }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-cyan-300/25">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className={getSeverityClasses(bug.severity)}>{normalize(bug.severity, 'medium')}</Pill>
            <Pill className={getStatusClasses(bug.status)}>{normalize(bug.status, 'open')}</Pill>
            <Pill className="border-slate-300/20 bg-slate-500/10 text-slate-200">{bug.source || 'unknown'}</Pill>
          </div>
          <h3 className="mt-3 text-lg font-black text-white">{bug.error_message || 'Bug report'}</h3>
          {bug.error_details && <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-300">{bug.error_details}</p>}
          <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
            <span className="rounded-xl bg-white/[0.035] px-3 py-2">
              Route: <span className="text-slate-200">{bug.route_path || bug.page_url || '—'}</span>
            </span>
            <span className="rounded-xl bg-white/[0.035] px-3 py-2">
              User: <span className="font-mono text-cyan-100">{shortId(bug.user_id)}</span>
            </span>
            <span className="rounded-xl bg-white/[0.035] px-3 py-2">
              Count: <span className="font-black text-white">{bug.occurrence_count ?? 1}</span>
            </span>
            <span className="rounded-xl bg-white/[0.035] px-3 py-2">
              Time: <span className="text-slate-200">{formatDateTime(bug.created_at)}</span>
            </span>
          </div>
          {bug.error_code && (
            <div className="mt-2">
              <span className="rounded-xl bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
                Code: <span className="font-mono text-amber-200">{bug.error_code}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function EventDetailsModal({ event, onClose, onCopy, onUser, onRetryNotification }: {
  event: SecurityEvent | null; onClose: () => void; onCopy: () => void; onUser: () => void; onRetryNotification?: () => void;
}) {
  if (!event) return null

  const replayUrl = String(event.metadata?.replay_url || event.metadata?.recording_url || event.metadata?.screen_recording_url || '').trim() || null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" aria-label="Close event details" onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      <section className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-[#050714] shadow-2xl shadow-cyan-950/40">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill className={getSeverityClasses(event.severity)}>{normalize(event.severity, 'low')}</Pill>
              <Pill className={getStatusClasses(event.status)}>{normalize(event.status, 'open')}</Pill>
            </div>
            <h2 className="mt-3 text-2xl font-black text-white">{event.title || 'Security event'}</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">{event.id}</p>
          </div>
          <button type="button" onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-7rem)] overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DetailRow label="Event type" value={titleCase(event.event_type)} />
            <DetailRow label="Source" value={event.source || '—'} />
            <DetailRow label="Risk score" value={Number(event.risk_score || 0)} />
            <DetailRow label="User ID" value={event.user_id || '—'} mono />
            <DetailRow label="Actor ID" value={event.actor_id || '—'} mono />
            <DetailRow label="Target User ID" value={event.target_user_id || '—'} mono />
            <DetailRow label="Route / URL" value={event.route || event.url || '—'} />
            <DetailRow label="IP address" value={event.ip_address || '—'} mono />
            <DetailRow label="Created" value={formatDateTime(event.created_at)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <DetailRow label="Description" value={<p className="whitespace-pre-wrap leading-7">{event.description || 'No description provided.'}</p>} />
              <DetailRow label="User agent" value={event.user_agent || '—'} />
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Metadata</p>
                {replayUrl && (
                  <a href={replayUrl} target="_blank" rel="noreferrer"
                    className="rounded-2xl border border-pink-300/25 bg-pink-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-100 hover:bg-pink-500/15">
                    View recording
                  </a>
                )}
              </div>
              <pre className="mt-3 max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/50 p-4 text-xs leading-6 text-cyan-100">
                {safeJson(event.metadata)}
              </pre>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" onClick={onCopy}
              className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 font-black text-cyan-50 hover:bg-cyan-500/20">
              <Copy className="mr-2 h-4 w-4" />Copy Event ID
            </Button>
            {event.user_id && (
              <Button type="button" onClick={onUser}
                className="rounded-2xl border border-purple-300/25 bg-purple-500/10 font-black text-purple-50 hover:bg-purple-500/20">
                <User className="mr-2 h-4 w-4" />Open User Profile
              </Button>
            )}
            {event.user_id && onRetryNotification && (
              <Button type="button" onClick={onRetryNotification}
                className="rounded-2xl border border-pink-300/25 bg-pink-500/10 font-black text-pink-50 hover:bg-pink-500/20">
                <ArrowRight className="mr-2 h-4 w-4" />Send Retry Notification
              </Button>
            )}
            <Button type="button" onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 font-black text-white hover:bg-white/10">
              <XCircle className="mr-2 h-4 w-4" />Close
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
