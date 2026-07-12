import React, { useEffect, useState } from 'react'
import OfficerShiftCalendar from '../../../components/officer/OfficerShiftCalendar'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

export default function ScheduleTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState<any[]>([])
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<'time_off' | 'late' | 'cannot_attend'>('time_off')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('officer_time_off_requests')
      .select('*, officer:user_profiles(username)')
      .order('created_at', { ascending: false })
      .limit(30)
    setRequests((data as any[]) || [])
  }
  useEffect(() => { load() }, [user])

  const submit = async () => {
    if (!user || !reason || !date) return
    setBusy(true)
    try {
      const { error } = await supabase.from('officer_time_off_requests').insert({
        officer_id: user.id, request_date: date, reason, request_type: type, status: 'pending',
      })
      if (error) throw error
      setReason(''); setDate(''); load()
      import('sonner').then((s) => s.toast.success('Request submitted'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h2 className="mb-3 text-lg font-bold">My Schedule</h2>
        <OfficerShiftCalendar title="Upcoming Shifts" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="mb-3 text-lg font-bold">Request Time Off / Late / Absence</h2>
          <div className="space-y-2">
            <select value={type} onChange={(e) => setType(e.target.value as any)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
              <option value="time_off">Time Off</option>
              <option value="late">Report Late</option>
              <option value="cannot_attend">Cannot Attend Shift</option>
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason"
              className="min-h-[70px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none" />
            <button disabled={busy || !reason || !date} onClick={submit}
              className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">
              Submit Request
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="mb-3 text-lg font-bold">My Requests</h2>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {requests.filter((r) => r.officer_id === user?.id).length === 0 && <p className="text-sm text-slate-400">No requests.</p>}
            {requests.filter((r) => r.officer_id === user?.id).map((r) => (
              <div key={r.id} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <p className="font-medium text-white">{r.request_date} · {r.request_type}</p>
                <p className="text-xs text-slate-400">{r.reason}</p>
                <span className={`text-xs font-bold ${r.status === 'approved' ? 'text-emerald-300' : r.status === 'rejected' ? 'text-red-300' : 'text-amber-300'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PermissionGate profile={realProfile} action="correct_attendance">
        <ManagementRequests requests={requests} onChanged={load} />
      </PermissionGate>
    </div>
  )
}

function ManagementRequests({ requests, onChanged }: { requests: any[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const act = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(true)
    try {
      const { error } = await supabase.from('officer_time_off_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      if (status === 'approved') {
        await supabase.from('officer_shift_slots').delete().eq('officer_id', requests.find((r) => r.id === id)?.officer_id).eq('shift_date', requests.find((r) => r.id === id)?.request_date)
      }
      onChanged()
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }
  const pending = requests.filter((r) => r.status === 'pending')
  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5">
      <h2 className="mb-3 text-lg font-bold text-amber-200">Pending Requests (Management)</h2>
      <div className="space-y-2">
        {pending.length === 0 && <p className="text-sm text-slate-400">None pending.</p>}
        {pending.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
            <div>
              <p className="font-medium text-white">{r.officer?.username} · {r.request_date}</p>
              <p className="text-xs text-slate-400">{r.reason}</p>
            </div>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => act(r.id, 'approved')} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">Approve</button>
              <button disabled={busy} onClick={() => act(r.id, 'rejected')} className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-200">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
