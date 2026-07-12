import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

export default function FrontendStudioTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const canPublish = canEmployee(realProfile, 'publish_frontend')
  const [drafts, setDrafts] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [config, setConfig] = useState('{\n  "theme": "dark"\n}')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('frontend_studio_drafts').select('*').order('created_at', { ascending: false }).limit(50)
    setDrafts((data as any[]) || [])
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!title || !user) return
    let parsed: any = null
    try { parsed = JSON.parse(config) } catch { import('sonner').then((s) => s.toast.error('Config must be valid JSON')); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('frontend_studio_drafts').insert({ title, config: parsed, author_id: user.id, status: 'draft' })
      if (error) throw error
      setTitle(''); setConfig('{\n  "theme": "dark"\n}'); load()
      import('sonner').then((s) => s.toast.success('Draft saved'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  const setStatus = async (id: string, status: 'approved' | 'published' | 'rolled_back') => {
    await supabase.from('frontend_studio_drafts').update({
      status, approved_by: status === 'approved' ? user?.id : undefined,
      published_at: status === 'published' ? new Date().toISOString() : undefined,
    }).eq('id', id)
    await supabase.rpc('log_employee_audit', {
      p_actor: user?.id, p_action: `frontend_${status}`, p_target: id, p_department: 'frontend_studio',
    })
    load()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {drafts.length === 0 && <p className="text-sm text-slate-400">No drafts.</p>}
        {drafts.map((d) => (
          <div key={d.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{d.title}</h2>
              <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-bold uppercase text-slate-300">{d.status}</span>
            </div>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/5 bg-black/40 p-3 text-xs text-slate-300">{JSON.stringify(d.config, null, 2)}</pre>
            <PermissionGate profile={realProfile} action="publish_frontend">
              <div className="mt-3 flex flex-wrap gap-2">
                {d.status === 'draft' && <button onClick={() => setStatus(d.id, 'approved')} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">Approve</button>}
                {d.status === 'approved' && <button onClick={() => setStatus(d.id, 'published')} className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-200">Publish</button>}
                {d.status === 'published' && <button onClick={() => setStatus(d.id, 'rolled_back')} className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-200">Rollback</button>}
              </div>
            </PermissionGate>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h2 className="mb-1 text-lg font-bold">New Draft</h2>
        <p className="mb-3 text-xs text-slate-500">Config-only. No source code, SQL, terminal, or env access.</p>
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Draft name"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
          <textarea value={config} onChange={(e) => setConfig(e.target.value)} spellCheck={false}
            className="min-h-[140px] w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs outline-none" />
          <button disabled={busy || !title} onClick={create}
            className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">Save Draft</button>
          {!canPublish && <p className="text-xs text-amber-300">Only authorized design/dev/management roles can approve or publish.</p>}
        </div>
      </div>
    </div>
  )
}
