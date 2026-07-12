import React, { useEffect, useState } from 'react'
import OfficerClock from '../../../components/officer/OfficerClock'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { PermissionGate } from '../components/PermissionGate'

export default function ClockTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [sessions, setSessions] = useState<any[]>([])

  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('officer_work_sessions')
      .select('id, clock_in, clock_out, hours_worked, auto_clocked_out, status')
      .eq('officer_id', user.id)
      .order('clock_in', { ascending: false })
      .limit(15)
    setSessions((data as any[]) || [])
  }

  useEffect(() => { load() }, [user])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-1">
        <OfficerClock />
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="mb-3 text-lg font-bold">Attendance History</h2>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {sessions.length === 0 && <p className="text-sm text-slate-400">No sessions yet.</p>}
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-white">{new Date(s.clock_in).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(s.clock_in).toLocaleTimeString()} – {s.clock_out ? new Date(s.clock_out).toLocaleTimeString() : 'Active'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-cyan-300">{(Number(s.hours_worked) || 0).toFixed(2)}h</p>
                  {s.auto_clocked_out && <span className="text-xs text-yellow-400">auto</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <PermissionGate profile={realProfile} action="correct_attendance">
          <ManagementCorrections userId={user?.id} onChanged={load} />
        </PermissionGate>
      </div>
    </div>
  )
}

function ManagementCorrections({ userId, onChanged }: { userId?: string; onChanged: () => void }) {
  const [target, setTarget] = useState('')
  const [found, setFound] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const find = async () => {
    const { data } = await supabase.from('user_profiles').select('id, username').ilike('username', `${target}%`).limit(1).maybeSingle()
    setFound(data)
  }

  const correct = async () => {
    if (!found || !reason) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('manual_clock_out', { p_session_id: found.id })
      if (error) throw error
      await supabase.rpc('log_employee_audit', {
        p_actor: userId, p_action: 'attendance_correction', p_target: found.id,
        p_reason: reason, p_department: 'attendance',
      })
      toastSuccess('Correction logged')
      setReason(''); setTarget(''); setFound(null); onChanged()
    } catch (e: any) {
      toastError(e.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5">
      <h2 className="mb-3 text-lg font-bold text-amber-200">Attendance Corrections (Management)</h2>
      <div className="flex gap-2">
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Employee username"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none" />
        <button onClick={find} className="rounded-lg border border-white/10 px-3 py-2 text-sm">Find</button>
      </div>
      {found && <p className="mt-2 text-sm text-slate-300">Found: {found.username}</p>}
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for correction (required)"
        className="mt-3 min-h-[70px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none" />
      <button disabled={busy || !found || !reason} onClick={correct}
        className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">
        Log Correction
      </button>
    </div>
  )
}

function toastSuccess(m: string) { import('sonner').then((s) => s.toast.success(m)) }
function toastError(m: string) { import('sonner').then((s) => s.toast.error(m)) }
