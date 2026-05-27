import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Loader } from '../../components/ui/loader'
import { Badge } from '../../components/ui/badge'
import AgencyStatsCard from './components/AgencyStatsCard'
import AgencyMembersTable from './components/AgencyMembersTable'
import { AgencyApplicationsTable } from './components/AgencyApplicationsTable'
import { AgencyGoalsTable } from './components/AgencyGoalsTable'
import { AgencyEarningsChart } from './components/AgencyEarningsChart'
import { AgencyInvitesPanel } from './components/AgencyInvitesPanel'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  XCircle,
} from 'lucide-react'

type AgencyStatus = 'pending' | 'approved' | 'suspended' | 'denied' | 'under_review' | 'active' | 'inactive' | 'rejected' | string

type Agency = {
  id: string
  name: string
  slug?: string | null
  bio?: string | null
  logo_url?: string | null
  banner_url?: string | null
  status: AgencyStatus | null
  default_split_percent?: number | null
  owner_id?: string | null
  created_at?: string | null
  updated_at?: string | null
  monthly_fee_amount?: number | null
  billing_status?: string | null
  next_monthly_fee_due_at?: string | null
}

type AgencyMember = {
  id?: string
  agency_id?: string | null
  user_id?: string | null
  role?: 'owner' | 'manager' | 'creator' | 'agency_leader' | string | null
  status?: string | null
  agencies?: Agency | null
}

type AgencyApplication = {
  id: string
  agency_id?: string | null
  applicant_id?: string | null
  status?: string | null
  message?: string | null
  content_type?: string | null
  live_schedule?: string | null
  battle_interest?: string | null
  social_links?: unknown
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string | null
  application_type?: string | null
  application_fee_paid?: boolean | null
  application_fee_amount?: number | null
  fee_paid_at?: string | null
  source_family_id?: string | null
}

type ActivityLog = {
  id: string
  agency_id: string
  actor_id: string
  target_user_id?: string | null
  action: string
  metadata?: unknown
  details?: unknown
  created_at?: string | null
}

type UserRole = 'owner' | 'manager' | 'creator' | 'agency_leader' | string | null

const shellClass = 'min-h-screen overflow-y-auto bg-[#050507] text-white'
const glassPanel = 'rounded-[1.75rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl'
const softPanel = 'rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl'
const tabClass =
  'rounded-2xl border border-cyan-500/20 bg-slate-950/60 px-4 py-2 text-slate-300 data-[state=active]:border-cyan-300/40 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-100'

const statusConfig: Record<
  string,
  {
    label: string
    badge: string
    icon: React.ElementType
    headline: string
    description: string
    nextSteps: string[]
  }
> = {
  pending: {
    label: 'Pending Review',
    badge: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
    icon: Clock3,
    headline: 'Your agency application is pending HR approval.',
    description:
      'Agency HR is reviewing your application, payment status, and agency details. Your full agency dashboard unlocks after approval.',
    nextSteps: [
      'Wait for Agency HR Manager review.',
      'Check that your 25,000 Troll Coin application fee was paid.',
      'Keep your agency name, bio, and creator plan ready for approval.',
    ],
  },
  under_review: {
    label: 'Under Review',
    badge: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
    icon: FileText,
    headline: 'Your agency is actively under review.',
    description:
      'Agency HR may be checking your application details, creator roster, contract terms, or billing setup before approval.',
    nextSteps: [
      'Watch for any requested changes from Agency HR.',
      'Make sure your agency leader contract details are accurate.',
      'Do not recreate the application while review is in progress.',
    ],
  },
  approved: {
    label: 'Approved',
    badge: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
    icon: CheckCircle2,
    headline: 'Your agency is approved.',
    description: 'Your agency dashboard is ready.',
    nextSteps: ['Manage members.', 'Review applications.', 'Track goals and earnings.'],
  },
  active: {
    label: 'Active',
    badge: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
    icon: CheckCircle2,
    headline: 'Your agency is active.',
    description: 'Your agency dashboard is ready.',
    nextSteps: ['Manage members.', 'Review applications.', 'Track goals and earnings.'],
  },
  suspended: {
    label: 'Suspended',
    badge: 'border-red-300/30 bg-red-500/10 text-red-100',
    icon: AlertTriangle,
    headline: 'Your agency is suspended.',
    description:
      'Agency tools are paused. This can happen because of billing, policy review, or an Agency HR Manager action.',
    nextSteps: [
      'Contact Agency HR or admin for review.',
      'Resolve any past-due monthly agency fee.',
      'Wait for reactivation before managing creators.',
    ],
  },
  denied: {
    label: 'Denied',
    badge: 'border-red-300/30 bg-red-500/10 text-red-100',
    icon: XCircle,
    headline: 'Your agency application was denied.',
    description:
      'This application is not approved. You may need to correct information or contact Agency HR before applying again.',
    nextSteps: [
      'Review any HR notes or status updates.',
      'Prepare corrected agency details.',
      'Do not pay another application fee unless the app flow requires a new application.',
    ],
  },
  rejected: {
    label: 'Rejected',
    badge: 'border-red-300/30 bg-red-500/10 text-red-100',
    icon: XCircle,
    headline: 'Your agency application was rejected.',
    description:
      'This application is not approved. You may need to correct information or contact Agency HR before applying again.',
    nextSteps: [
      'Review any HR notes or status updates.',
      'Prepare corrected agency details.',
      'Do not pay another application fee unless the app flow requires a new application.',
    ],
  },
  inactive: {
    label: 'Inactive',
    badge: 'border-slate-300/30 bg-slate-500/10 text-slate-100',
    icon: AlertTriangle,
    headline: 'Your agency is inactive.',
    description: 'Agency tools are not available until this agency is reactivated.',
    nextSteps: ['Contact Agency HR.', 'Check billing status.', 'Wait for reactivation.'],
  },
}

const normalizeStatus = (status?: string | null) => String(status || 'pending').toLowerCase()

const getStatusConfig = (status?: string | null) => {
  const normalized = normalizeStatus(status)
  return (
    statusConfig[normalized] || {
      label: normalized.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      badge: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
      icon: ShieldCheck,
      headline: `Agency status: ${normalized}`,
      description: 'Your agency status is being checked before full dashboard access is unlocked.',
      nextSteps: ['Refresh this page.', 'Check with Agency HR if this status looks wrong.', 'Wait for the next status update.'],
    }
  )
}

const safeDate = (value?: string | null) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
}

const renderDetails = (details: unknown) => {
  if (!details) return 'No extra details.'
  if (typeof details === 'string') return details
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return 'Details could not be displayed.'
  }
}

export default function AgencyDashboard() {
  const { user } = useAuth()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [membership, setMembership] = useState<AgencyMember | null>(null)
  const [latestApplication, setLatestApplication] = useState<AgencyApplication | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [pendingApplications, setPendingApplications] = useState(0)
  const [activeGoals, setActiveGoals] = useState(0)
  const [pendingContracts, setPendingContracts] = useState(0)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const agencyStatus = normalizeStatus(agency?.status || latestApplication?.status)
  const statusInfo = getStatusConfig(agency?.status || latestApplication?.status)
  const StatusIcon = statusInfo.icon
  const isApprovedAgency = agencyStatus === 'approved' || agencyStatus === 'active'
  const isOwnerOrManager = ['owner', 'manager', 'agency_leader'].includes(String(userRole || '').toLowerCase())

  const fetchCounts = useCallback(async (agencyId: string) => {
    const [membersResult, appsResult, goalsResult, contractsResult, logsResult] = await Promise.all([
      supabase.from('agency_members').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'active'),
      supabase.from('agency_applications').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).in('status', ['pending', 'under_review', 'changes_requested']),
      supabase.from('agency_goals').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'active'),
      supabase.from('agency_contracts').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).in('status', ['pending', 'pending_signature', 'draft']),
      supabase
        .from('agency_activity_logs')
        .select('id, agency_id, actor_id, target_user_id, action, metadata, details, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    setMemberCount(membersResult.count || 0)
    setPendingApplications(appsResult.count || 0)
    setActiveGoals(goalsResult.count || 0)
    setPendingContracts(contractsResult.count || 0)

    if (!logsResult.error) {
      setActivityLogs((logsResult.data || []) as ActivityLog[])
    }
  }, [])

  const fetchLatestApplication = useCallback(async (userId: string) => {
    const { data, error: applicationError } = await supabase
      .from('agency_applications')
      .select(
        'id, agency_id, applicant_id, status, message, content_type, live_schedule, battle_interest, social_links, reviewed_by, reviewed_at, created_at, application_type, application_fee_paid, application_fee_amount, fee_paid_at, source_family_id',
      )
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (applicationError) {
      console.warn('Could not load latest agency application', applicationError)
      return null
    }

    return (data || null) as AgencyApplication | null
  }, [])

  const fetchAgencyById = useCallback(async (agencyId: string) => {
    const { data, error: agencyError } = await supabase
      .from('agencies')
      .select(
        'id, name, slug, bio, logo_url, banner_url, status, default_split_percent, owner_id, created_at, updated_at, monthly_fee_amount, billing_status, next_monthly_fee_due_at',
      )
      .eq('id', agencyId)
      .maybeSingle()

    if (agencyError) {
      const fallback = await supabase
        .from('agencies')
        .select('id, name, slug, bio, logo_url, banner_url, status, default_split_percent, owner_id, created_at, updated_at')
        .eq('id', agencyId)
        .maybeSingle()

      if (fallback.error) throw fallback.error
      return (fallback.data || null) as Agency | null
    }

    return (data || null) as Agency | null
  }, [])

  const fetchAgencyData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setError(null)

      const { data: membershipData, error: membershipError } = await supabase
        .from('agency_members')
        .select(
          `
          *,
          agencies (
            id,
            name,
            slug,
            bio,
            logo_url,
            banner_url,
            status,
            default_split_percent,
            owner_id,
            created_at,
            updated_at,
            monthly_fee_amount,
            billing_status,
            next_monthly_fee_due_at
          )
        `,
        )
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let loadedMembership = (membershipData || null) as AgencyMember | null
      let loadedAgency = loadedMembership?.agencies || null

      if (membershipError) {
        console.warn('Agency membership join failed, using fallback loaders', membershipError)

        const fallbackMembership = await supabase
          .from('agency_members')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (fallbackMembership.error) throw fallbackMembership.error

        loadedMembership = (fallbackMembership.data || null) as AgencyMember | null
        loadedAgency = loadedMembership?.agency_id ? await fetchAgencyById(loadedMembership.agency_id) : null
      }

      const app = await fetchLatestApplication(user.id)

      if (!loadedAgency && app?.agency_id) {
        loadedAgency = await fetchAgencyById(app.agency_id)
      }

      setMembership(loadedMembership)
      setAgency(loadedAgency)
      setLatestApplication(app)
      setUserRole((loadedMembership?.role || (loadedAgency?.owner_id === user.id ? 'owner' : null)) as UserRole)

      if (loadedAgency?.id) {
        await fetchCounts(loadedAgency.id)
      }

      if (!loadedAgency && !app) {
        setError('You do not have an agency application or agency membership yet.')
      }
    } catch (err: any) {
      console.error('Failed to load agency dashboard', err)
      setError(err?.message || 'We could not load your agency dashboard right now.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchAgencyById, fetchCounts, fetchLatestApplication, user?.id])

  useEffect(() => {
    void fetchAgencyData()
  }, [fetchAgencyData])

  const refresh = async () => {
    setRefreshing(true)
    await fetchAgencyData()
  }

  const ownerLabel = useMemo(() => {
    if (!agency?.owner_id) return 'Not assigned yet'
    return agency.owner_id === user?.id ? 'You' : agency.owner_id.slice(0, 8)
  }, [agency?.owner_id, user?.id])

  if (loading) return <Loader />

  if (error && !agency && !latestApplication) {
    return (
      <div className={shellClass}>
        <BackgroundGlow />
        <main className="relative mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
          <section className={`${glassPanel} p-6 sm:p-8`}>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-500/10 p-3 text-red-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">Agency dashboard</p>
                <h1 className="mt-2 text-2xl font-black text-white">No agency access found</h1>
                <p className="mt-3 text-sm leading-7 text-slate-300">{error}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={refresh} disabled={refreshing} className="bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => window.history.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (!isApprovedAgency) {
    return (
      <div className={shellClass}>
        <BackgroundGlow />
        <main className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <section className={`${glassPanel} overflow-hidden`}>
            {agency?.banner_url ? (
              <div className="h-40 w-full bg-cover bg-center" style={{ backgroundImage: `url(${agency.banner_url})` }} />
            ) : (
              <div className="h-40 w-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(88,28,135,0.55))]" />
            )}

            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  {agency?.logo_url ? (
                    <img src={agency.logo_url} alt={`${agency.name} logo`} className="-mt-14 h-24 w-24 rounded-3xl border-4 border-[#050507] object-cover shadow-2xl shadow-cyan-950/40" />
                  ) : (
                    <div className="-mt-14 flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-[#050507] bg-slate-900 shadow-2xl shadow-cyan-950/40">
                      <Building2 className="h-10 w-10 text-cyan-200" />
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-3xl font-black tracking-tight text-white">{agency?.name || 'Agency Application'}</h1>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${statusInfo.badge}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                      {agency?.bio || latestApplication?.message || statusInfo.description}
                    </p>
                  </div>
                </div>

                <Button onClick={refresh} disabled={refreshing} className="bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30">
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusMiniCard label="Application Status" value={statusInfo.label} helper={latestApplication ? `Submitted ${safeDate(latestApplication.created_at)}` : 'No application row found'} />
            <StatusMiniCard label="Application Fee" value={latestApplication?.application_fee_paid ? 'Paid' : 'Check Required'} helper={`${latestApplication?.application_fee_amount || 25000} Troll Coins`} />
            <StatusMiniCard label="Billing Status" value={agency?.billing_status || 'Pending Approval'} helper={agency?.next_monthly_fee_due_at ? `Next due ${safeDate(agency.next_monthly_fee_due_at)}` : 'Monthly fee unlocks after approval'} />
            <StatusMiniCard label="Your Role" value={userRole || 'Applicant'} helper={membership?.status ? `Membership ${membership.status}` : 'Waiting for approval'} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className={`${glassPanel} p-5`}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-100">
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Status center</p>
                  <h2 className="text-xl font-black text-white">{statusInfo.headline}</h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-300">{statusInfo.description}</p>

              <div className="mt-5 grid gap-3">
                {statusInfo.nextSteps.map((step) => (
                  <div key={step} className={`${softPanel} flex items-start gap-3 p-4`}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-cyan-200" />
                    <p className="text-sm text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${glassPanel} p-5`}>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Application Details</p>
              <div className="mt-4 space-y-3 text-sm">
                <DetailRow label="Application ID" value={latestApplication?.id || 'Not available'} />
                <DetailRow label="Type" value={latestApplication?.application_type || 'standard'} />
                <DetailRow label="Content Type" value={latestApplication?.content_type || 'Not provided'} />
                <DetailRow label="Live Schedule" value={latestApplication?.live_schedule || 'Not provided'} />
                <DetailRow label="Battle Interest" value={latestApplication?.battle_interest || 'Not provided'} />
                <DetailRow label="Reviewed At" value={safeDate(latestApplication?.reviewed_at)} />
                <DetailRow label="Agency Owner" value={ownerLabel} />
              </div>
            </div>
          </section>

          <section className={`${glassPanel} p-5`}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Recent agency updates</p>
            <div className="mt-4 space-y-3">
              {activityLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                  No agency activity updates are available yet.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className={`${softPanel} p-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-bold text-white">{log.action.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-slate-500">{safeDate(log.created_at)}</p>
                    </div>
                    <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-slate-300">
                      {renderDetails(log.details || log.metadata)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (!isOwnerOrManager) {
    return (
      <div className={shellClass}>
        <BackgroundGlow />
        <main className="relative mx-auto max-w-xl px-4 py-8">
          <div className={`${glassPanel} p-6`}>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-100">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Agency member access</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Your agency is approved, but only owners, agency leaders, and managers can access the management dashboard.
                </p>
                <p className="mt-3 text-sm text-slate-400">Your current agency role: {userRole || 'member'}</p>
                <Button variant="outline" className="mt-6 border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => window.history.back()}>
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <BackgroundGlow />
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className={`${glassPanel} mb-6 overflow-hidden`}>
          {agency?.banner_url ? (
            <div className="h-44 w-full bg-cover bg-center" style={{ backgroundImage: `url(${agency.banner_url})` }} />
          ) : (
            <div className="h-44 w-full bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.26),transparent_35%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.20),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))]" />
          )}

          <div className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex gap-4">
                {agency?.logo_url ? (
                  <img src={agency.logo_url} alt={`${agency.name} logo`} className="-mt-14 h-24 w-24 rounded-3xl border-4 border-[#050507] object-cover shadow-2xl shadow-cyan-950/40" />
                ) : (
                  <div className="-mt-14 flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-[#050507] bg-slate-900 shadow-2xl shadow-cyan-950/40">
                    <span className="text-4xl font-black text-cyan-200">{agency?.name?.charAt(0) || 'A'}</span>
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-3xl font-black text-white">{agency?.name}</h2>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
                      Approved
                    </Badge>
                    <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                      {userRole}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Owner: <span className="text-cyan-300">@{ownerLabel}</span>
                  </p>
                  {agency?.bio && <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{agency.bio}</p>}
                </div>
              </div>

              <Button onClick={refresh} disabled={refreshing} className="bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30">
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                👥 {memberCount} Creators
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                📄 {pendingApplications} Pending Apps
              </Badge>
              <Badge variant="outline" className="border-purple-500/30 text-purple-300">
                🎯 {activeGoals} Active Goals
              </Badge>
              <Badge variant="outline" className="border-pink-500/30 text-pink-300">
                📝 {pendingContracts} Contracts
              </Badge>
            </div>
          </div>
        </section>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-2 border border-white/10 bg-black/30 p-2 backdrop-blur-xl">
            <TabsTrigger value="overview" className={tabClass}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className={tabClass}>
              Members
            </TabsTrigger>
            <TabsTrigger value="applications" className={tabClass}>
              Applications
            </TabsTrigger>
            <TabsTrigger value="invites" className={tabClass}>
              Invites
            </TabsTrigger>
            <TabsTrigger value="goals" className={tabClass}>
              Goals
            </TabsTrigger>
            <TabsTrigger value="earnings" className={tabClass}>
              Earnings
            </TabsTrigger>
            <TabsTrigger value="activity" className={tabClass}>
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <AgencyStatsCard label="Live Hours This Week" value="0" icon="⏰" color="blue" />
                <AgencyStatsCard label="Gift Earnings This Week" value="0 coins" icon="🎁" color="purple" />
                <AgencyStatsCard label="Battles This Week" value="0" icon="⚔️" color="pink" />
                <AgencyStatsCard label="Active Creators" value={String(memberCount)} icon="👥" color="cyan" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Button variant="default" className="w-full bg-cyan-500/20 px-6 py-3 text-cyan-50 hover:bg-cyan-500/30" onClick={() => alert('Edit agency profile')}>
                  Edit Agency Profile
                </Button>

                <Button variant="outline" className="w-full border border-cyan-500/30 bg-transparent px-6 py-3 text-cyan-50 hover:bg-cyan-500/10" onClick={() => alert('Upload new logo/banner')}>
                  Update Agency Media
                </Button>
              </div>

              <div className={`${glassPanel} p-5`}>
                <h3 className="mb-3 text-lg font-black text-cyan-300">Recent Activity</h3>
                <div className="space-y-3">
                  {activityLogs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                      No activity has been logged for this agency yet.
                    </div>
                  ) : (
                    activityLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="flex items-center space-x-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/20">
                          <Sparkles className="h-4 w-4 text-cyan-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{log.action.replaceAll('_', ' ')}</p>
                          <p className="text-xs text-slate-400">{safeDate(log.created_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="members">
            <AgencyMembersTable agencyId={agency!.id} currentUserId={user?.id} canManage={isOwnerOrManager} />
          </TabsContent>

          <TabsContent value="applications">
            <AgencyApplicationsTable agencyId={agency!.id} currentUserId={user?.id} canManage={isOwnerOrManager} />
          </TabsContent>

          <TabsContent value="invites">
  <AgencyInvitesPanel
    agencyId={agency!.id}
    currentUserId={user?.id}
    canManage={isOwnerOrManager}
  />
</TabsContent>

          <TabsContent value="goals">
            <AgencyGoalsTable agencyId={agency!.id} userRole={userRole} />
          </TabsContent>

          <TabsContent value="earnings">
            <AgencyEarningsChart agencyId={agency!.id} />
          </TabsContent>

          <TabsContent value="activity">
            <div className={`${glassPanel} p-6`}>
              <h3 className="mb-4 text-lg font-black text-cyan-300">Agency Activity Log</h3>
              <div className="space-y-3">
                {activityLogs.length === 0 ? (
                  <p className="text-slate-400">No agency activity logs are available yet.</p>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <p className="font-bold text-white">{log.action.replaceAll('_', ' ')}</p>
                        <p className="text-xs text-slate-500">{safeDate(log.created_at)}</p>
                      </div>
                      <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-xs text-slate-300">
                        {renderDetails(log.details || log.metadata)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.15),transparent_28%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_32%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
    </div>
  )
}

function StatusMiniCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className={`${glassPanel} p-5`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="break-all text-sm font-bold text-slate-100">{value}</span>
    </div>
  )
}
