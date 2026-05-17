import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { Phone, Video } from 'lucide-react'

type CallRow = {
  id: string
  caller_id: string
  receiver_id: string
  room_id: string
  type: 'audio' | 'video'
  duration_minutes: number
  created_at: string
  ended_at: string | null
}

type UserLite = {
  id: string
  username: string
}

export default function AdminCallsTab() {
  const { user } = useAuthStore()
  const [calls, setCalls] = useState<CallRow[]>([])
  const [users, setUsers] = useState<Record<string, UserLite>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadCalls = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('call_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)
        if (error) throw error
        const rows = (data || []) as CallRow[]
        setCalls(rows)
        const ids = Array.from(new Set(rows.flatMap(r => [r.caller_id, r.receiver_id])))
        if (ids.length) {
          const { data: profiles, error: pErr } = await supabase
            .from('user_profiles')
            .select('id, username')
            .in('id', ids)
          if (pErr) throw pErr
          const map: Record<string, UserLite> = {}
          ;(profiles || []).forEach((u: any) => { map[u.id] = { id: u.id, username: u.username } })
          setUsers(map)
        }
      } catch (err: any) {
        console.error('Failed to load calls:', err)
        toast.error('Failed to load calls')
      } finally {
        setLoading(false)
      }
    }
    loadCalls()
  }, [user?.id])

  const rows = useMemo(() => calls.map(c => ({
    ...c,
    callerName: users[c.caller_id]?.username || c.caller_id,
    receiverName: users[c.receiver_id]?.username || c.receiver_id,
    started: new Date(c.created_at).toLocaleString(),
    ended: c.ended_at ? new Date(c.ended_at).toLocaleString() : '—'
  })), [calls, users])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-3">
          <Phone className="w-6 h-6 text-yellow-400" />
          Calls
        </h1>
        <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl p-4">
          {loading ? (
            <div className="text-gray-300">Loading call history...</div>
          ) : rows.length === 0 ? (
            <div className="text-gray-400">No calls found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-300">
                    <th className="py-2 px-3">Started</th>
                    <th className="py-2 px-3">Caller</th>
                    <th className="py-2 px-3">Receiver</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Duration (min)</th>
                    <th className="py-2 px-3">Ended</th>
                    <th className="py-2 px-3">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-[#2C2C2C]">
                      <td className="py-2 px-3">{r.started}</td>
                      <td className="py-2 px-3">@{r.callerName}</td>
                      <td className="py-2 px-3">@{r.receiverName}</td>
                      <td className="py-2 px-3 flex items-center gap-2">
                        {r.type === 'video' ? <Video className="w-4 h-4 text-purple-400" /> : <Phone className="w-4 h-4 text-green-400" />}
                        {r.type}
                      </td>
                      <td className="py-2 px-3">{r.duration_minutes}</td>
                      <td className="py-2 px-3">{r.ended}</td>
                      <td className="py-2 px-3">{r.room_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
