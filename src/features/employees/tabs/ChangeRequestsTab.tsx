import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'

export default function ChangeRequestsTab({ profile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [items, setItems] = useState<any[]>([])
  const [voted, setVoted] = useState<Record<string, boolean>>({})
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('platform_change')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('employee_change_requests').select('*').order('created_at', { ascending: false }).limit(50)
    setItems((data as any[]) || [])
    if (user) {
      const { data: v } = await supabase.from('employee_change_request_votes').select('request_id').eq('user_id', user.id)
      const map: Record<string, boolean> = {}
      ;(v as any[])?.forEach((x) => { map[x.request_id] = true })
      setVoted(map)
    }
  }
  useEffect(() => { load() }, [user])

  const vote = async (id: string) => {
    if (!user) return
    if (voted[id]) {
      await supabase.from('employee_change_request_votes').delete().eq('request_id', id).eq('user_id', user.id)
      await supabase.from('employee_change_requests').update({ votes: Math.max(0, (items.find((i) => i.id === id)?.votes || 1) - 1) }).eq('id', id)
      setVoted((p) => ({ ...p, [id]: false }))
    } else {
      await supabase.from('employee_change_request_votes').insert({ request_id: id, user_id: user.id })
      await supabase.from('employee_change_requests').update({ votes: (items.find((i) => i.id === id)?.votes || 0) + 1 }).eq('id', id)
      setVoted((p) => ({ ...p, [id]: true }))
    }
    load()
  }

  const create = async () => {
    if (!title || !body || !user) return
    setBusy(true)
    try {
      const { error } = await supabase.from('employee_change_requests').insert({ title, body, type, author_id: user.id, status: 'open' })
      if (error) throw error
      setTitle(''); setBody(''); load()
      import('sonner').then((s) => s.toast.success('Request submitted (votes do not auto-approve)'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-400">No change requests.</p>}
        {items.map((i) => (
          <div key={i.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{i.title}</h2>
              <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-bold uppercase text-slate-300">{i.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{i.body}</p>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => vote(i.id)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${voted[i.id] ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-200' : 'border-white/10 text-slate-300'}`}>
                ▲ {i.votes} votes
              </button>
              <span className="text-xs text-slate-500">{i.type}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h2 className="mb-3 text-lg font-bold">New Request</h2>
        <div className="space-y-2">
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
            <option value="platform_change">Platform Change</option>
            <option value="workflow">Workflow</option>
            <option value="employee_tool">Employee Tool</option>
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe the change…"
            className="min-h-[100px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none" />
          <button disabled={busy || !title || !body} onClick={create}
            className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">Submit</button>
        </div>
      </div>
    </div>
  )
}
