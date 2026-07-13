import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield,
  Lock,
  Users,
  FileText,
  Eye,
  Radio,
  AlertTriangle,
  Ban,
  Settings,
  MessageCircle,
  Activity,
  RefreshCw,
  ShieldAlert,
  Bug,
  Wallet,
  CheckCircle2,
  XCircle,
  EyeOff,
} from 'lucide-react'
import { useSecurityEvents } from '../../hooks/useSecurityEvents'

const tools = [
  { label: 'Chat Moderation', icon: MessageCircle, to: '/admin/chat-moderation', desc: 'Review and moderate live chat' },
  { label: 'Jail Management', icon: Lock, to: '/admin/jail-management', desc: 'Monitor city inmates' },
  { label: 'Reports Queue', icon: FileText, to: '/admin/reports-queue', desc: 'Review user reports' },
  { label: 'Stream Monitor', icon: Eye, to: '/admin/stream-monitor', desc: 'Watch active broadcasts' },
  { label: 'Night Watch', icon: Radio, to: '/admin/night-watch', desc: 'Patrol and oversight' },
  { label: 'Officer Operations', icon: Shield, to: '/admin/officer-operations', desc: 'Manage officers and shifts' },
  { label: 'User Search', icon: Users, to: '/admin/user-search', desc: 'Find and inspect users' },
  { label: 'Stream Restrictions', icon: Ban, to: '/admin', desc: 'Manage broadcast lockdowns' },
  { label: 'System Config', icon: Settings, to: '/admin/system/config', desc: 'Edit platform settings' },
  { label: 'Activity Log', icon: Activity, to: '/admin/activity', desc: 'Monitor user activity' },
]

const severityStyles: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-300',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  low: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
    </div>
  )
}

export default function SecurityCommandCenter() {
  const {
    events,
    riskScores,
    bugReports,
    payoutRequests,
    incidentReports,
    loading,
    error,
    refresh,
    resolveEvent,
    markFalsePositive,
    ignoreEvent,
  } = useSecurityEvents()

  const openEvents = useMemo(
    () => events.filter((e) => !['resolved', 'false_positive', 'ignored'].includes(e.status)),
    [events],
  )
  const highRiskUsers = useMemo(
    () => riskScores.filter((r) => r.risk_score >= 50).slice(0, 15),
    [riskScores],
  )
  const criticalBugs = useMemo(
    () => bugReports.filter((b) => ['critical', 'high'].includes((b.severity || '').toLowerCase()) && b.status !== 'resolved'),
    [bugReports],
  )
  const pendingPayouts = useMemo(
    () => payoutRequests.filter((p) => ['pending', 'requested', 'processing'].includes((p.status || '').toLowerCase())),
    [payoutRequests],
  )
  const openIncidents = useMemo(
    () => incidentReports.filter((i) => i.status !== 'resolved' && i.status !== 'closed'),
    [incidentReports],
  )

  const handleResolve = async (id: string, fn: (id: string) => Promise<void>) => {
    try {
      await fn(id)
    } catch (err) {
      console.error('[SecurityCommandCenter] action failed:', err)
    }
  }

  return (
    <main className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.12),transparent_30%)]" />
      </div>

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white md:text-4xl">Security Command</h1>
              <p className="text-xs text-slate-400">Live security events, risk, and moderation hub</p>
            </div>
          </div>
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20 md:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Some security data could not be loaded.</p>
              <p className="text-red-300/80">
                {error.message}. If you are not an admin, superadmin, owner, or CEO this data is
                restricted. Otherwise, verify the security tables and RLS policies are deployed.
              </p>
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-5">
          <StatCard icon={AlertTriangle} label="Open Events" value={loading ? '—' : openEvents.length} tone="border-orange-400/30 bg-orange-500/10 text-orange-300" />
          <StatCard icon={ShieldAlert} label="High Risk Users" value={loading ? '—' : highRiskUsers.length} tone="border-red-400/30 bg-red-500/10 text-red-300" />
          <StatCard icon={Bug} label="Critical Bugs" value={loading ? '—' : criticalBugs.length} tone="border-amber-400/30 bg-amber-500/10 text-amber-300" />
          <StatCard icon={Wallet} label="Pending Payouts" value={loading ? '—' : pendingPayouts.length} tone="border-emerald-400/30 bg-emerald-500/10 text-emerald-300" />
          <StatCard icon={FileText} label="Open Incidents" value={loading ? '—' : openIncidents.length} tone="border-cyan-400/30 bg-cyan-500/10 text-cyan-300" />
        </div>

        {/* Open security events */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <AlertTriangle className="h-5 w-5 text-orange-300" /> Open Security Events
          </h2>
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Loading security events…</p>
          ) : openEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No open security events. All clear.</p>
          ) : (
            <div className="space-y-2">
              {openEvents.slice(0, 25).map((e) => (
                <div key={e.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${severityStyles[(e.severity || 'low').toLowerCase()] || severityStyles.low}`}>
                        {e.severity || 'low'}
                      </span>
                      <span className="text-sm font-bold text-white">{e.title || e.event_type}</span>
                      <span className="text-[11px] text-slate-500">risk {e.risk_score ?? 0}</span>
                    </div>
                    {e.description && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{e.description}</p>}
                    <p className="mt-1 text-[10px] text-slate-500">
                      {new Date(e.created_at).toLocaleString()} · {e.source}{e.route ? ` · ${e.route}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => handleResolve(e.id, (id) => resolveEvent(id, 'resolved'))} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                    </button>
                    <button onClick={() => handleResolve(e.id, markFalsePositive)} className="inline-flex items-center gap-1 rounded-lg border border-slate-500/30 bg-slate-500/10 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-500/20">
                      <XCircle className="h-3.5 w-3.5" /> False+
                    </button>
                    <button onClick={() => handleResolve(e.id, ignoreEvent)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/10">
                      <EyeOff className="h-3.5 w-3.5" /> Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High risk users + critical bugs */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <ShieldAlert className="h-5 w-5 text-red-300" /> High-Risk Users
            </h2>
            {loading ? (
              <p className="py-4 text-center text-sm text-slate-400">Loading…</p>
            ) : highRiskUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No high-risk users flagged.</p>
            ) : (
              <div className="space-y-2">
                {highRiskUsers.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-300">{r.user_id}</p>
                      <p className="text-[10px] text-slate-500">
                        {r.risk_level} · fails {r.failed_login_count} · suspicious {r.suspicious_action_count}
                      </p>
                    </div>
                    <span className="ml-2 shrink-0 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-sm font-black text-red-300">
                      {r.risk_score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <Bug className="h-5 w-5 text-amber-300" /> Critical Bug Reports
            </h2>
            {loading ? (
              <p className="py-4 text-center text-sm text-slate-400">Loading…</p>
            ) : criticalBugs.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No critical bugs reported.</p>
            ) : (
              <div className="space-y-2">
                {criticalBugs.slice(0, 15).map((b) => (
                  <div key={b.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${severityStyles[(b.severity || 'low').toLowerCase()] || severityStyles.low}`}>
                        {b.severity}
                      </span>
                      <span className="truncate text-sm font-bold text-white">{b.error_message}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {b.route_path || b.page_url || '—'} · seen {b.occurrence_count}× · {new Date(b.last_seen_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tool tiles */}
        <h2 className="mb-4 text-lg font-black text-white">Security Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.label}
                to={tool.to}
                className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-black text-white">{tool.label}</span>
                </div>
                <p className="text-[11px] text-slate-400">{tool.desc}</p>
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}
