import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { DollarSign, Gift, Calendar, User, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

interface FridayBattleBonus {
  id: string
  user_id: string
  username: string
  display_name: string
  amount: number
  created_at: string
  battle_id: string
  gift_total_coins: number
  gift_tx_id: string
  stream_id: string
  sender_id: string
  sender_username: string
  sender_display_name: string
}

export default function FridayBattlesDashboard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [bonuses, setBonuses] = useState<FridayBattleBonus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const allowed =
      profile.is_admin === true ||
      ['admin', 'ceo'].includes(profile.role ?? '')
    if (!allowed) {
      toast.error('Access denied')
      navigate('/')
    }
  }, [profile, navigate])

  useEffect(() => {
    const load = async () => {
      if (!profile?.is_admin && !['admin', 'ceo'].includes(profile?.role ?? '')) return

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('coin_transactions')
          .select(`
            id,
            user_id,
            amount,
            created_at,
            metadata,
            profiles:user_id (username, display_name)
          `)
          .eq('type', 'friday_battle_bonus')
          .order('created_at', { ascending: false })

        if (error) throw error

        const formatted = (data || []).map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          username: row.profiles?.username || 'Unknown',
          display_name: row.profiles?.display_name || row.profiles?.username || 'Unknown',
          amount: row.amount,
          created_at: row.created_at,
          battle_id: row.metadata?.battle_id,
          gift_total_coins: row.metadata?.gift_total_coins || 0,
          gift_tx_id: row.metadata?.gift_tx_id,
          stream_id: row.metadata?.stream_id,
          sender_id: row.metadata?.sender_id,
          sender_username: row.metadata?.sender_username || 'Unknown',
          sender_display_name: row.metadata?.sender_display_name || 'Unknown'
        }))

        setBonuses(formatted)
      } catch (error: any) {
        console.error('Error loading Friday battle bonuses:', error)
        toast.error('Failed to load Friday battle bonuses')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [profile])

  const userBonuses = selectedUser
    ? bonuses.filter(b => b.user_id === selectedUser)
    : []

  const uniqueUsers = Array.from(
    bonuses.reduce((map, b) => {
      map.set(b.user_id, { username: b.username, display_name: b.display_name })
      return map
    }, new Map<string, { username: string; display_name: string }>())
  ).map(([user_id, info]) => ({ user_id, ...info }))

  if (loading) {
    return (
      <div className="p-6 text-slate-300 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p>Loading Friday battle bonuses…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0A0814] text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10">
            <Gift className="w-6 h-6 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text">
            Friday Battle Bonuses
          </h1>
        </div>
        <button
          onClick={() => setSelectedUser(null)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
        >
          Back to All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Total Distributed</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {bonuses.reduce((s, b) => s + b.amount, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Calendar className="w-4 h-4" />
            <span>Total Transactions</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{bonuses.length}</div>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <User className="w-4 h-4" />
            <span>Unique Recipients</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{uniqueUsers.length}</div>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Gift className="w-4 h-4" />
            <span>Avg Bonus</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {bonuses.length > 0 ? Math.round(bonuses.reduce((s, b) => s + b.amount, 0) / bonuses.length).toLocaleString() : 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {!selectedUser ? (
          <div className="lg:col-span-1">
            <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-3">Recipients</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {uniqueUsers.map((u) => {
                  const userBonuses = bonuses.filter(b => b.user_id === u.user_id)
                  const total = userBonuses.reduce((s, b) => s + b.amount, 0)
                  return (
                    <button
                      key={u.user_id}
                      onClick={() => setSelectedUser(u.user_id)}
                      className="w-full text-left p-3 bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded-lg flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">@{u.username}</div>
                        <div className="text-xs text-gray-400">{userBonuses.length} gifts</div>
                      </div>
                      <div className="text-green-400 font-semibold">{total.toLocaleString()}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}

        <div className={`${selectedUser ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#2C2C2C]">
              <h3 className="text-lg font-semibold">
                {selectedUser 
                  ? `Bonuses for @${uniqueUsers.find(u => u.user_id === selectedUser)?.username || 'Unknown'}`
                  : 'All Friday Battle Bonuses'
                }
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1A1A1A]">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-300 font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-gray-300 font-semibold">Sender</th>
                    <th className="px-4 py-3 text-left text-gray-300 font-semibold">Gift Value</th>
                    <th className="px-4 py-3 text-right text-gray-300 font-semibold">Bonus</th>
                    <th className="px-4 py-3 text-right text-gray-300 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2C]">
                  {(selectedUser ? userBonuses : bonuses).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        No Friday battle bonuses found
                      </td>
                    </tr>
                  ) : (selectedUser ? userBonuses : bonuses).map((b) => (
                    <tr key={b.id} className="hover:bg-[#1A1A1A]">
                      <td className="px-4 py-3 text-gray-300">
                        {new Date(b.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-purple-400">@{b.sender_username}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {b.gift_total_coins.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-semibold">
                        {b.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {b.stream_id && (
                          <a
                            href={`/live?stream=${b.stream_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                          >
                            View Stream
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}