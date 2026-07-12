import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface OnlineEmployee {
  user_id: string
  username: string
  role: string
}

/**
 * Shared realtime presence list for the Employees workspace.
 * Uses a single presence channel so we don't create one per component.
 */
export function OnlineEmployees({ currentUserId }: { currentUserId?: string | null }) {
  const [online, setOnline] = useState<OnlineEmployee[]>([])
  const channelRef = useRef<any>(null)

  useEffect(() => {
    const channel = supabase.channel('employees:presence', {
      config: { presence: { key: currentUserId ?? 'anon' } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const list: OnlineEmployee[] = []
        Object.values(state).forEach((entries: any) => {
          entries.forEach((e: any) => {
            if (e.user_id) list.push({ user_id: e.user_id, username: e.username, role: e.role })
          })
        })
        setOnline(list)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED' && currentUserId) {
          await channel.track({
            user_id: currentUserId,
            username: '', // filled by caller via presence only; kept minimal
            role: '',
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-200">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Online ({online.length})
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
        {online.length === 0 && <li className="text-xs text-slate-500">No one online</li>}
        {online.map((o) => (
          <li key={o.user_id} className="flex items-center gap-2 text-sm text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {o.username || 'Employee'}
          </li>
        ))}
      </ul>
    </div>
  )
}
