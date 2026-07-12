import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { isSecretary } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

const LEAD_EDITABLE_ROLES = [
  'troll_officer', 'lead_troll_officer', 'pastor', 'attorney', 'prosecutor',
  'journalist', 'auctioneer', 'troller', 'agency_hr_manager', 'agency_leader',
  'agency_hr', 'hr_admin', 'hr_manager', 'president', 'vice_president',
  'troll_city_secretary', 'troll_city_treasurer', 'executive_secretary',
  'academy_teacher', 'admissions_officer',
]

export default function ManagementTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  return (
    <div className="space-y-4">
      <PermissionGate profile={realProfile} action="view_management">
        <AssistantWorkspace profile={profile} />
        <PerkPay />
        <DisciplinaryActions profile={realProfile} />
        <AuditHistory />
      </PermissionGate>
    </div>
  )
}

function AssistantWorkspace({ profile }: { profile?: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <h2 className="mb-3 text-lg font-bold">Assistant Workspace</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {['Executive Messages', 'Meeting Notes', 'Documents', 'Follow-ups', 'Escalations', 'Shared Assistant Workspace'].map((t) => (
          <div key={t} className="rounded-xl border border-white/5 bg-white/5 p-3 text-sm text-slate-300">{t}</div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Executive/CEO private admin systems are not exposed here. Only assistant-facing logic is shown.
      </p>
    </div>
  )
}

function PerkPay() {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const isSec = isSecretary(user as any)

  const load = async () => {
    const { data } = await supabase.from('employee_perk_pay').select('*').order('role')
    setRows((data as any[]) || [])
  }
  useEffect(() => { load() }, [])

  const edit = async (role: string, amount: number) => {
    setBusy(true)
    try {
      const { error } = await supabase.from('employee_perk_pay').upsert({ role, amount, updated_by: user?.id, updated_at: new Date().toISOString() })
      if (error) throw error
      await supabase.rpc('log_employee_audit', { p_actor: user?.id, p_action: 'perk_pay_update', p_new: { role, amount }, p_department: 'payroll' })
      load()
      import('sonner').then((s) => s.toast.success('Perk pay updated'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  const runPayroll = async () => {
    setBusy(true)
    try {
      const start = new Date(); start.setDate(1); start.setMonth(start.getMonth() - 1)
      const end = new Date(); end.setDate(0); end.setMonth(end.getMonth() - 1)
      const { error } = await supabase.rpc('run_employee_payroll', {
        p_period_start: start.toISOString().slice(0, 10),
        p_period_end: end.toISOString().slice(0, 10),
        p_actor: user?.id,
      })
      if (error) throw error
      import('sonner').then((s) => s.toast.success('Payroll run created'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Perk Pay (per role)</h2>
        <button onClick={runPayroll} disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50">Run Payroll</button>
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const locked = isSec ? false : !LEAD_EDITABLE_ROLES.includes(r.role)
          return (
            <div key={r.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
              <span className="flex-1 text-sm capitalize text-slate-200">{r.role.replace(/_/g, ' ')}</span>
              <input type="number" defaultValue={r.amount} disabled={locked} onBlur={(e) => edit(r.role, Number(e.target.value))}
                className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm disabled:opacity-50" />
              {locked && <span className="text-xs text-amber-300">🔒 sec-only</span>}
            </div>
          )
        })}
      </div>
      {!isSec && <p className="mt-2 text-xs text-slate-500">Leads set perk pay for operational roles (not executive/secretary). Secretary can set and bypass Lead pay.</p>}
    </div>
  )
}

function DisciplinaryActions({ profile }: { profile?: any }) {
  const { user } = useAuthStore()
  const [items, setItems] = useState<any[]>([])
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [type, setType] = useState('warning')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    let { data } = await supabase.from('employee_disciplinary_actions').select('*').order('created_at', { ascending: false }).limit(50)
    let items = (data as any[]) || []
    const ids = [...new Set(items.flatMap(i => [i.user_id, i.issued_by]).filter(Boolean))]
    if (ids.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, username').in('id', ids)
      const map = new Map((profiles || []).map((p: any) => [p.id, p]))
      items = items.map(i => ({ ...i, user: map.get(i.user_id) || null, issuer: map.get(i.issued_by) || null }))
    }
    setItems(items)
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!target || !reason || !user) return
    setBusy(true)
    try {
      const { error } = await supabase.from('employee_disciplinary_actions').insert({ user_id: target, action_type: type, reason, issued_by: user.id })
      if (error) throw error
      await supabase.rpc('log_employee_audit', { p_actor: user.id, p_action: 'disciplinary', p_target: target, p_new: { type }, p_reason: reason, p_department: 'disciplinary' })
      setTarget(''); setReason(''); load()
      import('sonner').then((s) => s.toast.success('Disciplinary action recorded'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <h2 className="mb-3 text-lg font-bold">Disciplinary Actions</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Employee user id"
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
          {['warning', 'reprimand', 'suspension', 'termination'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
        <button disabled={busy || !target || !reason} onClick={add} className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Record</button>
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {items.map((i) => (
          <div key={i.id} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
            <p className="font-medium text-white">{i.user?.username} · {i.action_type}</p>
            <p className="text-xs text-slate-400">{i.reason} — by {i.issuer?.username}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AuditHistory() {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('employee_audit_log').select('*').order('created_at', { ascending: false }).limit(60)
      setItems((data as any[]) || [])
    })()
  }, [])
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <h2 className="mb-3 text-lg font-bold">Audit History</h2>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {items.length === 0 && <p className="text-sm text-slate-400">No audit entries.</p>}
        {items.map((a) => (
          <div key={a.id} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
            <p className="font-medium text-white">{a.action}</p>
            <p className="text-xs text-slate-400">{a.reason || ''} · {new Date(a.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
