import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

export default function RecordsTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  const [records, setRecords] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  const load = async () => {
    let { data } = await supabase
      .from('employee_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    let records = (data as any[]) || []
    const ids = [...new Set(records.map(r => r.user_id).filter(Boolean))]
    if (ids.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, username, role').in('id', ids)
      const map = new Map((profiles || []).map((p: any) => [p.id, p]))
      records = records.map(r => ({ ...r, user: map.get(r.user_id) || null }))
    }
    setRecords(records)
  }
  useEffect(() => { if (canEmployee(realProfile, 'view_records')) load() }, [realProfile])

  const setStatus = async (userId: string, status: string) => {
    setBusy(true)
    try {
      await supabase.from('employee_records').update({ employment_status: status, updated_at: new Date().toISOString() }).eq('user_id', userId)
      load()
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <PermissionGate profile={realProfile} action="view_records" fallback={<div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-slate-400">Employee records are restricted to management.</div>}>
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h2 className="mb-3 text-lg font-bold">Employee Records</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.user_id} className="border-b border-white/5">
                  <td className="px-3 py-2 text-slate-200">{r.user?.username ?? r.user_id}</td>
                  <td className="px-3 py-2 text-slate-300">{(r.user?.role ?? '').replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.employment_status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>{r.employment_status}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{[r.location_city, r.location_state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <select defaultValue={r.employment_status} disabled={busy} onChange={(e) => setStatus(r.user_id, e.target.value)}
                      className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs">
                      {['active', 'inactive', 'suspended', 'terminated'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
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
