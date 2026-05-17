import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Crown, RefreshCw, Trophy, Users } from 'lucide-react'
import { toast } from 'sonner'

type FamilyLeaderboardRow = {
  family_id: string
  family_name: string
  task_count: number
}

export default function WeeklyFamilyChallenge() {
  const [loading, setLoading] = useState(true)
  const [rewardingFamilyId, setRewardingFamilyId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<FamilyLeaderboardRow[]>([])

  const rewardPool = 10000
  const winner = leaderboard[0]

  const totalTasks = useMemo(
    () => leaderboard.reduce((sum, family) => sum + Number(family.task_count || 0), 0),
    [leaderboard],
  )

  const loadLeaderboard = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('get_weekly_family_task_counts')

      if (error) throw error

      setLeaderboard((data || []) as FamilyLeaderboardRow[])
    } catch (error) {
      console.error('[WeeklyFamilyChallenge] loadLeaderboard failed:', error)
      toast.error('Failed to load weekly challenge')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const distributeRewards = async (family: FamilyLeaderboardRow) => {
    if (!family?.family_id) return

    const confirmed = window.confirm(
      `Crown ${family.family_name} as Family of the Week and add ${rewardPool.toLocaleString()} family tokens?`,
    )

    if (!confirmed) return

    setRewardingFamilyId(family.family_id)

    try {
      const { error: statsError } = await supabase.rpc('increment_family_stats', {
        p_family_id: family.family_id,
        p_coin_bonus: rewardPool,
        p_xp_bonus: 0,
      })

      if (statsError) throw statsError

      const { error: crownError } = await supabase.rpc('grant_family_crown', {
        p_family_id: family.family_id,
      })

      if (crownError) throw crownError

      toast.success(`👑 ${family.family_name} is now Family of the Week!`)
      await loadLeaderboard()
    } catch (error) {
      console.error('[WeeklyFamilyChallenge] distributeRewards failed:', error)
      toast.error('Failed to distribute rewards')
    } finally {
      setRewardingFamilyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#07050d] p-4 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-950/50 via-black/60 to-emerald-950/30 p-6 shadow-[0_0_40px_rgba(147,51,234,0.15)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300">
                <Crown size={14} />
                Family of the Week
              </div>

              <h1 className="flex items-center gap-3 text-3xl font-black md:text-4xl">
                🏁 Weekly Troll Family Challenge
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-slate-300">
                Every Sunday at midnight, the family with the most completed tasks wins{' '}
                <span className="font-black text-emerald-300">
                  {rewardPool.toLocaleString()} Family Tokens
                </span>{' '}
                added to the family vault.
              </p>
            </div>

            <button
              type="button"
              onClick={loadLeaderboard}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-600/20 px-4 py-3 text-sm font-bold text-purple-100 hover:bg-purple-600/30 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase text-slate-400">Reward Pool</div>
              <div className="mt-1 text-2xl font-black text-emerald-300">
                {rewardPool.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase text-slate-400">Total Tasks</div>
              <div className="mt-1 text-2xl font-black text-white">{totalTasks}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase text-slate-400">Current Leader</div>
              <div className="mt-1 truncate text-2xl font-black text-yellow-300">
                {winner?.family_name || 'None yet'}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/45 p-4 shadow-xl backdrop-blur">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center text-slate-400">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Loading weekly leaderboard...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <Trophy className="mb-3 h-12 w-12 text-slate-600" />
              <p className="text-lg font-bold text-white">No completed tasks yet this week</p>
              <p className="mt-1 text-sm text-slate-400">
                Families will appear here once weekly tasks are completed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((family, index) => {
                const isWinner = index === 0
                const taskCount = Number(family.task_count || 0)

                return (
                  <div
                    key={family.family_id}
                    className={`flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between ${
                      isWinner
                        ? 'border-yellow-400/40 bg-gradient-to-r from-purple-900/60 to-yellow-900/20 shadow-[0_0_28px_rgba(250,204,21,0.12)]'
                        : 'border-slate-700 bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black ${
                          isWinner ? 'bg-yellow-400 text-black' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {isWinner ? <Trophy size={24} /> : `#${index + 1}`}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-lg font-black text-white">
                          {family.family_name}
                          {isWinner && (
                            <span className="rounded-full bg-yellow-400/15 px-2 py-1 text-xs font-bold text-yellow-300">
                              Current Winner
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-1 text-sm text-slate-300">
                          <Users size={14} />
                          {taskCount.toLocaleString()} tasks completed
                        </div>
                      </div>
                    </div>

                    {isWinner && (
                      <button
                        type="button"
                        onClick={() => distributeRewards(family)}
                        disabled={rewardingFamilyId === family.family_id}
                        className="rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-5 py-3 text-sm font-black text-white shadow-lg hover:from-pink-500 hover:to-purple-500 disabled:opacity-50"
                      >
                        {rewardingFamilyId === family.family_id
                          ? 'Distributing...'
                          : 'Distribute Reward'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Winner resets every week. Tasks auto-refresh Friday 00:00.
        </p>
      </div>
    </div>
  )
}