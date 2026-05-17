import React, { useEffect, useState } from 'react'
import { DollarSign, RefreshCw, ShieldAlert } from 'lucide-react'
import { supabase, UserRole } from '../../lib/supabase'
import RequireRole from '../../components/RequireRole'
import { toast } from 'sonner'

interface PayrollLogRow {
  id: string
  officer_id: string
  pay_period_start: string
  pay_period_end: string
  base_pay: number
  bonus_pay: number
  total_paid: number
  status: string
  reason: string | null
  created_at: string
  officer_username?: string
  officer_role?: string
}

interface CorruptionFlagRow {
  id: string
  officer_id: string
  reason: string
  severity: 'low' | 'medium' | 'high'
  created_at: string
  officer_username?: string
  officer_role?: string
}

interface SummaryStats {
  totalPaid: number
  officersPaid: number
  logCount: number
  frozenCount: number
}

export default function OfficerPayrollReports() {
  const [logs, setLogs] = useState<PayrollLogRow[]>([])
  const [frozen, setFrozen] = useState<CorruptionFlagRow[]>([])
  const [summary, setSummary] = useState<SummaryStats>({
    totalPaid: 0,
    officersPaid: 0,
    logCount: 0,
    frozenCount: 0
  })
  const [loading, setLoading] = useState(true)

  const loadReports = async () => {
    setLoading(true)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      const startDateString = startDate.toISOString().split('T')[0]

      const { data: payrollData, error: payrollError } = await supabase
        .from('officer_payroll_logs')
        .select('id, officer_id, pay_period_start, pay_period_end, base_pay, bonus_pay, total_paid, status, reason, created_at')
        .gte('pay_period_start', startDateString)
        .order('pay_period_start', { ascending: false })
        .order('created_at', { ascending: false })

      if (payrollError) {
        throw payrollError
      }

      const { data: flagData, error: flagError } = await supabase
        .from('officer_corruption_flags')
        .select('id, officer_id, reason, severity, created_at')
        .eq('resolved', false)
        .order('created_at', { ascending: false })

      if (flagError) {
        throw flagError
      }

      const payrollRows = (payrollData as PayrollLogRow[]) || []
      const flagRows = (flagData as CorruptionFlagRow[]) || []

      const profileIds = new Set<string>()
      payrollRows.forEach((row) => profileIds.add(row.officer_id))
      flagRows.forEach((row) => profileIds.add(row.officer_id))

      let profileMap = new Map<string, { username: string | null; role: string | null }>()

      if (profileIds.size > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, username, role')
          .in('id', Array.from(profileIds))

        if (profileError) {
          throw profileError
        }

        profileMap = new Map(
          (profiles || []).map((profile) => [profile.id, { username: profile.username, role: profile.role }])
        )
      }

      const hydratedLogs = payrollRows.map((row) => ({
        ...row,
        officer_username: profileMap.get(row.officer_id)?.username || 'Unknown',
        officer_role: profileMap.get(row.officer_id)?.role || 'Unknown'
      }))

      const hydratedFlags = flagRows.map((row) => ({
        ...row,
        officer_username: profileMap.get(row.officer_id)?.username || 'Unknown',
        officer_role: profileMap.get(row.officer_id)?.role || 'Unknown'
      }))

      const totalPaid = hydratedLogs.reduce((sum, row) => sum + (row.total_paid || 0), 0)
      const officersPaid = new Set(hydratedLogs.filter((row) => row.total_paid > 0).map((row) => row.officer_id)).size

      setLogs(hydratedLogs)
      setFrozen(hydratedFlags)
      setSummary({
        totalPaid,
        officersPaid,
        logCount: hydratedLogs.length,
        frozenCount: hydratedFlags.length
      })
    } catch (error: any) {
      console.error('Failed to load payroll reports:', error)
      toast.error('Failed to load payroll reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  return (
    <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Officer Payroll Reports</h1>
              <p className="text-sm text-slate-300">Weekly salary payouts and frozen officer flags</p>
            </div>
            <button
              onClick={loadReports}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase text-slate-400">Total Paid</p>
              <p className="text-2xl font-bold text-emerald-200">{summary.totalPaid.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase text-slate-400">Officers Paid</p>
              <p className="text-2xl font-bold text-indigo-200">{summary.officersPaid}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase text-slate-400">Payroll Logs</p>
              <p className="text-2xl font-bold text-amber-200">{summary.logCount}</p>
            </div>
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-xs uppercase text-red-300">Frozen Officers</p>
              <p className="text-2xl font-bold text-red-200">{summary.frozenCount}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-emerald-200" />
              <h2 className="text-lg font-bold">Weekly Payroll Logs</h2>
            </div>
            {loading ? (
              <div className="text-sm text-slate-400">Loading payroll logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-sm text-slate-400">No payroll logs for the last 7 days.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr className="border-b border-white/10">
                      <th className="py-2 text-left">Officer</th>
                      <th className="py-2 text-left">Role</th>
                      <th className="py-2 text-right">Base</th>
                      <th className="py-2 text-right">Bonus</th>
                      <th className="py-2 text-right">Paid</th>
                      <th className="py-2 text-left">Status</th>
                      <th className="py-2 text-left">Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row) => (
                      <tr key={row.id} className="border-b border-white/5">
                        <td className="py-2 text-slate-200">{row.officer_username}</td>
                        <td className="py-2 text-slate-400">{row.officer_role}</td>
                        <td className="py-2 text-right text-slate-200">{Number(row.base_pay || 0).toLocaleString()}</td>
                        <td className="py-2 text-right text-slate-200">{Number(row.bonus_pay || 0).toLocaleString()}</td>
                        <td className="py-2 text-right text-emerald-200">{Number(row.total_paid || 0).toLocaleString()}</td>
                        <td className="py-2 text-left">
                          <span className="inline-flex rounded-full bg-white/10 px-2 py-1 text-xs">
                            {row.status}
                          </span>
                          {row.reason ? <span className="ml-2 text-xs text-slate-400">{row.reason}</span> : null}
                        </td>
                        <td className="py-2 text-left text-slate-400">
                          {row.pay_period_start} - {row.pay_period_end}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-300" />
              <h2 className="text-lg font-bold">Frozen Officers</h2>
            </div>
            {loading ? (
              <div className="text-sm text-slate-400">Loading frozen officers...</div>
            ) : frozen.length === 0 ? (
              <div className="text-sm text-slate-400">No unresolved corruption flags.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr className="border-b border-white/10">
                      <th className="py-2 text-left">Officer</th>
                      <th className="py-2 text-left">Role</th>
                      <th className="py-2 text-left">Severity</th>
                      <th className="py-2 text-left">Reason</th>
                      <th className="py-2 text-left">Flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frozen.map((row) => (
                      <tr key={row.id} className="border-b border-white/5">
                        <td className="py-2 text-slate-200">{row.officer_username}</td>
                        <td className="py-2 text-slate-400">{row.officer_role}</td>
                        <td className="py-2 text-red-200">{row.severity}</td>
                        <td className="py-2 text-slate-300">{row.reason}</td>
                        <td className="py-2 text-slate-400">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </RequireRole>
  )
}
