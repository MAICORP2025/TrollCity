import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

export default function AttendanceTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [sessions, setSessions] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('officer_work_sessions')
      .select('id, officer_id, clock_in, clock_out, hours_worked, auto_clocked_out, status, user_profiles(username)')
      .order('clock_in', { ascending: false })
      .limit(100)
    setSessions((data as any[]) || [])
  }
  useEffect(() => { if (canEmployee(realProfile, 'correct_attendance')) load() }, [realProfile])

  const correct = async (id: string) => {
    setBusy(true)
    try {
      await supabase.rpc('log_employee_audit', { p_actor: user?.id, p_action: 'attendance_review', p_target: id, p_department: 'attendance' })
      import('sonner').then((s) => s.toast.success('Attendance reviewed (audit logged)'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <PermissionGate profile={realProfile} action="correct_attendance" fallback={<div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-slate-400">Attendance management is restricted to leads and admins.</div>}>
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h2 className="mb-3 text-lg font-bold">Attendance (Managed Employees)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Clock In</th>
                <th className="px-3 py-2 text-left">Clock Out</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-white/5">
                  <td className="px-3 py-2 text-slate-200">{s.user_profiles?.username ?? s.officer_id}</td>
                  <td className="px-3 py-2 text-slate-300">{new Date(s.clock_in).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-300">{s.clock_out ? new Date(s.clock_out).toLocaleString() : 'Active'}</td>
                  <td className="px-3 py-2 text-right text-cyan-300">{(Number(s.hours_worked) || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">
                    {s.auto_clocked_out ? <span className="text-xs text-yellow-400">auto</span> : s.clock_out ? <span className="text-xs text-emerald-300">ok</span> : <span className="text-xs text-blue-300">active</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => correct(s.id)} disabled={busy} className="rounded-lg border border-white/10 px-2 py-1 text-xs">Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PermissionGate>
  )
}
