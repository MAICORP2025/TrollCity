import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

export default function HiringTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const canHire = canEmployee(realProfile, 'hire')
  const [apps, setApps] = useState<any[]>([])
  const [officers, setOfficers] = useState<any[]>([])
  const [reason, setReason] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  const load = async () => {
    const q = supabase.from('job_applications').select('*, position:career_positions(title)').order('created_at', { ascending: false }).limit(100)
    if (statusFilter !== 'all') q.eq('status', statusFilter)
    const [{ data: a }, { data: o }] = await Promise.all([
      q,
      supabase.from('user_profiles').select('id, username, is_troll_officer, is_lead_officer, is_officer_active').or('is_troll_officer.eq.true,is_lead_officer.eq.true').neq('role', 'admin'),
    ])
    setApps((a as any[]) || [])
    setOfficers((o as any[]) || [])
  }
  useEffect(() => { if (canHire) load() }, [canHire, user, statusFilter])

  // Set a user's role via the designated SECURITY DEFINER RPCs. Direct writes to
  // the protected `role` column are blocked by the protect_sensitive_columns trigger.
  const grantRole = async (userId: string, role: string, appId?: string) => {
    if (role === 'troll_officer') {
      const { error } = await supabase.rpc('approve_officer_application', { p_user_id: userId })
      if (error) throw error
    } else if (role === 'lead_troll_officer') {
      const { error } = await supabase.rpc('approve_lead_officer_application', { p_app_id: appId, p_reviewer_id: user?.id })
      if (error) throw error
    } else {
      const { error } = await supabase.rpc('set_user_role', {
        target_user: userId, new_role: role, reason: reason || 'Hired', acting_admin_id: user?.id,
      })
      if (error) throw error
    }
    await supabase.from('employee_records').upsert({ user_id: userId, employment_status: 'active', department: role, hire_date: new Date().toISOString(), updated_at: new Date().toISOString() })
    await supabase.from('employee_tasks').insert({ title: 'Employee Onboarding', description: 'Complete onboarding for your new role.', assigned_by: user?.id, assigned_to: userId, status: 'assigned' })
    await supabase.rpc('log_employee_audit', { p_actor: user?.id, p_action: 'hire', p_target: userId, p_new: { role }, p_reason: reason || 'Hired', p_department: role })
  }

  const approveApp = async (app: any) => {
    if (!reason) { import('sonner').then((s) => s.toast.error('Add a reason')); return }
    await supabase.from('job_applications').update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', app.id)
    try {
      await grantRole(app.user_id, app.position_id || 'troll_officer', app.id)
    } catch (e: any) {
      import('sonner').then((s) => s.toast.error(e?.message || 'Failed to assign role'))
      return
    }
    setReason(''); load()
    import('sonner').then((s) => s.toast.success('Applicant hired & added to payroll'))
  }

  const rejectApp = async (id: string) => {
    await supabase.from('job_applications').update({ status: 'rejected', reviewed_by: user?.id }).eq('id', id)
    load()
  }

  const act = async (officerId: string, kind: 'fire' | 'suspend' | 'promote' | 'revoke') => {
    if (!reason && kind !== 'promote' && kind !== 'revoke') { import('sonner').then((s) => s.toast.error('Add a reason')); return }
    if (kind === 'fire') {
      await supabase.from('user_profiles').update({ is_officer_active: false, is_troll_officer: false, updated_at: new Date().toISOString() }).eq('id', officerId)
      await supabase.from('employee_records').update({ employment_status: 'terminated', updated_at: new Date().toISOString() }).eq('user_id', officerId)
    } else if (kind === 'suspend') {
      await supabase.from('employee_records').update({ employment_status: 'suspended', updated_at: new Date().toISOString() }).eq('user_id', officerId)
    } else if (kind === 'promote' || kind === 'revoke') {
      const { error } = await supabase.rpc('set_lead_officer_status', { p_user_id: officerId, p_make_lead: kind === 'promote' })
      if (error) throw error
    }
    await supabase.rpc('log_employee_audit', { p_actor: user?.id, p_action: kind, p_target: officerId, p_reason: reason, p_department: 'officer' })
    setReason(''); load()
    import('sonner').then((s) => s.toast.success(`Action: ${kind}`))
  }

  return (
    <PermissionGate profile={realProfile} action="hire" fallback={<div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-slate-400">You do not have hiring permissions.</div>}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="mb-3 text-lg font-bold">Applications</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold capitalize ${statusFilter === s ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-200' : 'border-white/10 text-slate-300'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {apps.length === 0 && <p className="text-sm text-slate-400">No applications.</p>}
            {apps.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-white">{(a.position as any)?.title ?? a.position_id}</p>
                  <p className="text-xs text-slate-400">applied {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${a.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : a.status === 'rejected' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>{a.status}</span>
                <div className="flex gap-2">
                  <button onClick={() => approveApp(a)} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">Hire</button>
                  <button onClick={() => rejectApp(a.id)} className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-200">Reject</button>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="mb-3 text-lg font-bold">Officer Management (Troll Officers only)</h2>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason required for fire/suspend (recorded + notified)"
            className="mb-3 min-h-[60px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none" />
          <div className="space-y-2">
            {officers.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <span className="font-medium text-white">{o.username} {o.is_lead_officer ? '(Lead)' : ''} {!o.is_officer_active ? '(inactive)' : ''}</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => act(o.id, 'promote')} className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-200">Promote</button>
                  <button onClick={() => act(o.id, 'revoke')} className="rounded-lg border border-yellow-400/20 bg-yellow-500/10 px-2.5 py-1 text-xs font-bold text-yellow-200">Revoke</button>
                  <button onClick={() => act(o.id, 'suspend')} className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200">Suspend</button>
                  <button onClick={() => act(o.id, 'fire')} className="rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-200">Fire</button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Leads may only hire/fire/suspend Troll Officers. Admins/CEO/exec roles are protected. Records are preserved (deactivated, never hard-deleted).</p>
        </div>
      </div>
    </PermissionGate>
  )
}
