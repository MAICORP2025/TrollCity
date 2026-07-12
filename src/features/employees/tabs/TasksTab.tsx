import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

const STATUSES = ['assigned', 'in_progress', 'blocked', 'awaiting_review', 'completed', 'cancelled']

export default function TasksTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState('normal')
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!user) return
    let { data } = await supabase
      .from('employee_tasks')
      .select('*')
      .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50)
    let tasks = (data as any[]) || []
    const ids = [...new Set(tasks.flatMap(t => [t.assigned_to, t.assigned_by]).filter(Boolean))]
    if (ids.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, username').in('id', ids)
      const map = new Map((profiles || []).map((p: any) => [p.id, p]))
      tasks = tasks.map(t => ({ ...t, assignee: map.get(t.assigned_to) || null, assigner: map.get(t.assigned_by) || null }))
    }
    setTasks(tasks)
  }
  useEffect(() => { load() }, [user])

  const setStatus = async (id: string, status: string) => {
    await supabase.from('employee_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const create = async () => {
    if (!title || !user) return
    setBusy(true)
    try {
      const { error } = await supabase.from('employee_tasks').insert({
        title, description: desc, priority, assigned_by: user.id,
        assigned_to: assignee ? assignee : user.id, status: 'assigned',
      })
      if (error) throw error
      setTitle(''); setDesc(''); setAssignee(''); load()
      import('sonner').then((s) => s.toast.success('Task created'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {tasks.length === 0 && <p className="text-sm text-slate-400">No tasks.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t.title}</h2>
              <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-bold uppercase text-slate-300">{t.status}</span>
            </div>
            {t.description && <p className="mt-2 text-sm text-slate-300">{t.description}</p>}
            <p className="mt-2 text-xs text-slate-500">
              Assigned by {t.assigner?.username ?? '?'} → {t.assignee?.username ?? '?'} · {t.priority}
            </p>
            {t.assigned_to === user?.id && t.status !== 'completed' && t.status !== 'cancelled' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUSES.filter((s) => s !== t.status).map((s) => (
                  <button key={s} onClick={() => setStatus(t.id, s)}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-bold capitalize text-slate-300">{s.replace(/_/g, ' ')}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <PermissionGate profile={realProfile} action="assign_tasks">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="mb-3 text-lg font-bold">Assign Task</h2>
          <div className="space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description"
              className="min-h-[80px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none" />
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
              {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assignee user id (blank = me)"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
            <button disabled={busy || !title} onClick={create}
              className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">Create</button>
          </div>
        </div>
      </PermissionGate>
    </div>
  )
}
