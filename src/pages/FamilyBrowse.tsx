import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Users, Crown, Search } from 'lucide-react'

interface FamilyRow {
  id: string
  name: string
  description?: string | null
  icon_emoji?: string | null
  emoji?: string | null
  banner_url?: string | null
  level?: number | null
  total_points?: number | null
  total_coins?: number | null
  created_at?: string | null
}

export default function FamilyBrowse() {
  const navigate = useNavigate()
  const [families, setFamilies] = useState<FamilyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const loadFamilies = async () => {
      setLoading(true)
      try {
        // Query family_stats to get coin counts, joining troll_families for details
        const { data, error } = await supabase
          .from('family_stats')
          .select(`
            total_coins,
            family_xp,
            troll_families!inner (
              id,
              name,
              description,
              icon_emoji,
              emoji,
              banner_url,
              created_at
            )
          `)
          .order('total_coins', { ascending: false })

        if (error) throw error
        
        // Map the result to FamilyRow structure
        const rows: FamilyRow[] = (data || []).map((item: any) => ({
          id: item.troll_families.id,
          name: item.troll_families.name,
          description: item.troll_families.description,
          icon_emoji: item.troll_families.icon_emoji,
          emoji: item.troll_families.emoji,
          banner_url: item.troll_families.banner_url,
          created_at: item.troll_families.created_at,
          total_coins: item.total_coins || 0,
          total_points: item.family_xp || 0,
          level: 1 // Placeholder as level calculation is complex/not available in this view
        }))
        
        setFamilies(rows)

        if (rows.length > 0) {
          const { data: members } = await supabase
            .from('troll_family_members')
            .select('family_id')
            .in('family_id', rows.map((f) => f.id))

          const counts: Record<string, number> = {}
          ;(members || []).forEach((m: { family_id: string }) => {
            counts[m.family_id] = (counts[m.family_id] || 0) + 1
          })
          setMemberCounts(counts)
        } else {
          setMemberCounts({})
        }
      } catch (err) {
        console.error('Failed to load families', err)
      } finally {
        setLoading(false)
      }
    }

    loadFamilies()
  }, [])

  const filteredFamilies = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return families
    return families.filter((family) => {
      const name = family.name?.toLowerCase() || ''
      const description = family.description?.toLowerCase() || ''
      return name.includes(q) || description.includes(q)
    })
  }, [families, query])

  return (
    <div className="min-h-screen tc-cosmic-bg text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Browse Troll Families</h1>
            <p className="text-sm text-gray-400">Explore every active family across Troll City.</p>
          </div>
          <div className="flex items-center gap-2 bg-[#0D0D0D] border border-purple-500/30 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-purple-300" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search families..."
              className="bg-transparent text-sm text-white outline-none w-56"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400">Loading families...</div>
        ) : filteredFamilies.length === 0 ? (
          <div className="troll-card p-6 text-center text-gray-400">No families found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFamilies.map((family) => {
              const badgeEmoji = family.icon_emoji || family.emoji || '👑'
              const members = memberCounts[family.id] || 0
              return (
                <div key={family.id} className="troll-card p-4 border border-purple-500/20">
                  {family.banner_url ? (
                    <img
                      src={family.banner_url}
                      alt={`${family.name} banner`}
                      className="h-28 w-full rounded-lg object-cover mb-3"
                    />
                  ) : (
                    <div className="h-28 w-full rounded-lg bg-black/40 mb-3 flex items-center justify-center text-xs text-gray-500">
                      No banner
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{badgeEmoji}</span>
                        <h3 className="text-lg font-semibold">{family.name}</h3>
                      </div>
                      {family.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{family.description}</p>
                      )}
                    </div>
                    <div className="text-xs text-purple-200 flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Lv {family.level || 1}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-gray-300">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-purple-300" />
                      {members} members
                    </div>
                    <div className="text-yellow-300">{(family.total_coins || 0).toLocaleString()} coins</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/family/profile/${family.id}`)}
                    className="mt-4 w-full py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors"
                  >
                    View Family
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
