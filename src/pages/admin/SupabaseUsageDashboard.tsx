import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, Database, Shield, Sparkles, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { calculateSupabaseMonthlyEstimate, formatCost } from '../../lib/supabasePricing'

interface AdminSupabaseUsageSummary {
  project_key: string
  billing_period_start?: string | null
  billing_period_end?: string | null
  captured_at?: string | null
  metrics?: Record<string, number | string | null>
  estimated_monthly_cost?: number
  confidence?: string
  source?: string
  summary?: string
}

export default function SupabaseUsageDashboard() {
  const [summary, setSummary] = useState<AdminSupabaseUsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true)
      setError(null)
      setDebug(null)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          throw new Error(sessionError.message)
        }
        const accessToken = session?.access_token
        if (!accessToken) {
          throw new Error('Please sign in to view the admin Supabase usage dashboard.')
        }

        const response = await fetch('/api/admin/supabase-usage/summary', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          if (payload?.debug) setDebug(payload.debug)
          throw new Error(payload?.error || 'Unable to load Supabase usage summary')
        }
        setSummary(payload)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadSummary()
  }, [])

  const estimate = useMemo(() => {
    if (!summary) return null
    return calculateSupabaseMonthlyEstimate({
      projectKey: summary.project_key,
      billingPeriodStart: summary.billing_period_start,
      billingPeriodEnd: summary.billing_period_end,
      databaseGbHours: Number(summary.metrics?.database_gb_hours || 0),
      databaseCpuHours: Number(summary.metrics?.database_cpu_hours || 0),
      storageGb: Number(summary.metrics?.storage_gb || 0),
      storageEgressGb: Number(summary.metrics?.storage_egress_gb || 0),
      storageBucketGb: Number(summary.metrics?.storage_bucket_gb || 0),
      authMonthlyActiveUsers: Number(summary.metrics?.auth_monthly_active_users || 0),
      realtimeChannels: Number(summary.metrics?.realtime_channels || 0),
      realtimeMessages: Number(summary.metrics?.realtime_messages || 0),
      telemetryEvents: Number(summary.metrics?.telemetry_events || 0),
      confidence: summary.confidence || 'high',
      source: summary.source || 'estimated',
    })
  }, [summary])

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Supabase Usage</p>
            <h1 className="text-3xl font-semibold text-white">Admin-only Supabase usage & cost dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">View server-side usage estimates, cost drivers, and historical ranges without exposing secrets to the client.</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <div className="flex items-center gap-2 font-semibold"><Shield className="h-4 w-4" /> Server-authorized</div>
            <div className="mt-1 text-xs text-emerald-300/80">Private metrics layer • admin-only access</div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-sm text-slate-300">Loading server-backed summary…</div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-200">
            <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {error}</div>
            {debug && (
              <pre className="mt-4 overflow-x-auto rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/90">
                {JSON.stringify(debug, null, 2)}
              </pre>
            )}
          </div>
        )}

        {!loading && !error && summary && estimate && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-sm text-cyan-300"><Database className="h-4 w-4" /> Estimated monthly cost</div>
                <div className="mt-3 text-3xl font-semibold text-white">{formatCost(estimate.totalMonthlyCost)}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">{summary.confidence || 'high'} confidence</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-sm text-fuchsia-300"><Activity className="h-4 w-4" /> Database & compute</div>
                <div className="mt-3 text-2xl font-semibold text-white">{formatCost(estimate.items.database)}</div>
                <div className="mt-2 text-xs text-slate-400">Compute plus storage pressure drivers</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-sm text-emerald-300"><Sparkles className="h-4 w-4" /> Storage & CDN</div>
                <div className="mt-3 text-2xl font-semibold text-white">{formatCost(estimate.items.storage + estimate.items.cdn)}</div>
                <div className="mt-2 text-xs text-slate-400">Bucket + transfer estimates</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-sm text-amber-300"><BarChart3 className="h-4 w-4" /> Auth & realtime</div>
                <div className="mt-3 text-2xl font-semibold text-white">{formatCost(estimate.items.auth + estimate.items.realtime + estimate.items.telemetry + estimate.items.edge)}</div>
                <div className="mt-2 text-xs text-slate-400">Monthly active users + realtime activity</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex items-center gap-2 text-lg font-semibold text-white"><TrendingUp className="h-5 w-5" /> Executive summary</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{summary.summary || estimate.summary}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3 text-sm text-slate-300">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">Billing period: {summary.billing_period_start || 'n/a'} → {summary.billing_period_end || 'n/a'}</div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">Captured: {summary.captured_at ? new Date(summary.captured_at).toLocaleString() : 'n/a'}</div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">Source: {summary.source || 'estimated'}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
