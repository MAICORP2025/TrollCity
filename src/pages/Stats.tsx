import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { useCoins } from '../lib/hooks/useCoins'
import { supabase } from '../lib/supabase'
import { getFamilySeasonStats } from '../lib/familySeasons'
import { useXPStore } from '../stores/useXPStore'
import { useCreditScore } from '../lib/hooks/useCreditScore'
import CreditScoreBadge from '../components/CreditScoreBadge'
import { CreatorSeasonalGoals } from '../components/CreatorSeasonalGoals'
import EmpirePartnerSection from '../components/empire/EmpirePartnerSection'
import {
  Crown,
  Sword,
  Trophy,
  Coins,
  Star,
  Shield,
  Zap,
  ShoppingBag,
  Store,
  Package,
  DollarSign,
  TrendingUp,
  Loader2,
  Activity,
} from 'lucide-react'
import { STORE_USD_PER_COIN } from '../lib/coinMath'

interface UserStats {
  level: number
  xp: number
  totalXp: number
  nextLevelXp: number
  troll_coins: number
  paid_coins: number
  cashout_coins: number
  cashout_reserved_coins: number
  familyName?: string
  familyLevel?: number
  familyXp?: number
  seasonScore?: number
  warWins?: number
  warLosses?: number
  warStreak?: string
  warTier?: string
  badges: string[]
}

const pageShell =
  'min-h-screen overflow-hidden bg-slate-950 text-white relative'

const cityPanel =
  'rounded-[2rem] border border-cyan-400/20 bg-slate-950/70 shadow-[0_0_48px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl'

const cityCard =
  'rounded-3xl border border-white/10 bg-white/[0.035] shadow-[0_0_30px_rgba(45,212,191,0.08)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-300/35 hover:shadow-[0_0_34px_rgba(45,212,191,0.14)]'

const cyanTitle =
  'bg-gradient-to-r from-white via-cyan-100 to-pink-200 bg-clip-text text-transparent'

function StatHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_22px_rgba(45,212,191,0.18)]">
        <Icon className="h-5 w-5 text-cyan-200" />
      </div>
      <div>
        <h3 className="text-lg font-black uppercase tracking-wide text-cyan-100">
          {title}
        </h3>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
  )
}

function MetricBox({
  label,
  value,
  tone = 'cyan',
}: {
  label: string
  value: React.ReactNode
  tone?: 'cyan' | 'pink' | 'purple' | 'green' | 'red' | 'yellow' | 'orange'
}) {
  const toneClass = {
    cyan: 'text-cyan-300 border-cyan-400/20 bg-cyan-400/5',
    pink: 'text-pink-300 border-pink-400/20 bg-pink-400/5',
    purple: 'text-purple-300 border-purple-400/20 bg-purple-400/5',
    green: 'text-emerald-300 border-emerald-400/20 bg-emerald-400/5',
    red: 'text-red-300 border-red-400/20 bg-red-400/5',
    yellow: 'text-yellow-300 border-yellow-400/20 bg-yellow-400/5',
    orange: 'text-orange-300 border-orange-400/20 bg-orange-400/5',
  }[tone]

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  )
}

export default function Stats() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { balances, loading: coinsLoading } = useCoins()
  const { xpTotal, level, xpToNext, progress, fetchXP, subscribeToXP, unsubscribe } = useXPStore()
  const { data: creditData, loading: creditLoading, refresh: refreshCredit } = useCreditScore()

  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  const isInitialized = useRef(false)
  const prevCreditScore = useRef<number | null>(null)

  useEffect(() => {
    if (profile?.credit_score !== undefined && profile.credit_score !== prevCreditScore.current) {
      prevCreditScore.current = profile.credit_score
      refreshCredit()
    }
  }, [profile?.credit_score, refreshCredit])

  const loadStatsInternal = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)

      let familyData = null

      const { data: familyMember } = await supabase
        .from('family_members')
        .select('family_id, role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (familyMember?.family_id) {
        const familyStats = await getFamilySeasonStats(familyMember.family_id)
        const { data: family } = await supabase
          .from('troll_families')
          .select('name')
          .eq('id', familyMember.family_id)
          .maybeSingle()

        if (family) {
          familyData = {
            familyName: family.name,
            familyLevel: familyStats.seasonRank || 1,
            familyXp: familyStats.weeklyCoins || 0,
            seasonScore: familyStats.seasonCoins || 0,
          }
        }
      }

      const { data: battleProfile, error: battleProfileError } = await supabase
        .from('user_profiles')
        .select('total_battle_wins,battle_crown_streak,battle_crowns,total_battle_matches')
        .eq('id', user.id)
        .maybeSingle()

      if (battleProfileError) {
        console.warn('[Stats] Failed to load battle profile stats:', battleProfileError)
      }

      const battleWins = battleProfile?.total_battle_wins ?? (profile as any)?.total_battle_wins ?? 0
      const battleStreak = battleProfile?.battle_crown_streak ?? (profile as any)?.battle_crown_streak ?? 0
      const battleCrowns = battleProfile?.battle_crowns ?? (profile as any)?.battle_crowns ?? 0
      const totalBattleMatches = battleProfile?.total_battle_matches ?? (profile as any)?.total_battle_matches

      const battleLosses =
        typeof totalBattleMatches === 'number'
          ? Math.max(totalBattleMatches - battleWins, 0)
          : 0

      const warTier =
        battleCrowns >= 50
          ? 'Diamond'
          : battleCrowns >= 25
            ? 'Platinum'
            : battleCrowns >= 10
              ? 'Gold'
              : battleCrowns >= 5
                ? 'Silver'
                : 'Bronze'

      const badges = []
      if (profile?.role === 'admin' || profile?.troll_role === 'admin') badges.push('🛡️ Admin')
      if (familyMember) badges.push('⚔️ Family War')
      if (level >= 10) badges.push('👑 Top Rank')
      if (balances.paid_coins > 1000) badges.push('💰 Big Spender')

      setStats({
        level,
        xp: xpTotal,
        totalXp: xpTotal,
        nextLevelXp: xpToNext + xpTotal,
        troll_coins: balances.troll_coins || 0,
        paid_coins: balances.paid_coins || 0,
        cashout_coins: balances.cashout_coins || 0,
        cashout_reserved_coins: balances.cashout_reserved_coins || 0,
        ...familyData,
        warWins: battleWins,
        warLosses: battleLosses,
        warStreak: String(battleStreak),
        warTier,
        badges,
      })
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
  }, [
    user?.id,
    level,
    xpTotal,
    xpToNext,
    profile,
    balances.troll_coins,
    balances.paid_coins,
    balances.cashout_coins,
    balances.cashout_reserved_coins,
  ])

  useEffect(() => {
    if (!user?.id || isInitialized.current) return

    const initXP = async () => {
      try {
        await fetchXP(user.id)
        subscribeToXP(user.id)
        isInitialized.current = true
        loadStatsInternal()
      } catch (err) {
        console.error('Error initializing XP:', err)
        isInitialized.current = true
        loadStatsInternal()
      }
    }

    initXP()

    return () => {
      unsubscribe()
      isInitialized.current = false
    }
  }, [user?.id, fetchXP, subscribeToXP, unsubscribe, loadStatsInternal])

  useEffect(() => {
    if (user?.id && isInitialized.current) {
      loadStatsInternal()
    }
  }, [level, xpTotal, xpToNext, loadStatsInternal, user?.id])

  const computedProgress =
    progress !== undefined && progress !== null ? (progress > 0 ? progress : 0) : 0

  const levelProgress = Math.min(computedProgress, 99)
  const familyXpProgress = stats?.familyXp ? Math.min((stats.familyXp / 1000) * 100, 100) : 0

  return (
    <div className={pageShell}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className={`${cityPanel} mb-8 overflow-hidden p-6 md:p-8`}>
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <Activity className="h-4 w-4" />
                City OS Stats
              </div>

              <h1 className={`text-4xl font-black md:text-5xl ${cyanTitle}`}>
                Player Stats
              </h1>

              <p className="mt-3 max-w-2xl text-slate-400">
                Track your level, coins, battle rank, credit score, family activity, and city achievements.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="Level" value={level || 1} tone="cyan" />
              <MetricBox label="Coins" value={(balances.troll_coins || 0).toLocaleString()} tone="green" />
              <MetricBox label="XP" value={(xpTotal || 0).toLocaleString()} tone="purple" />
            </div>
          </div>
        </div>

        <div className={`${cityPanel} mb-8 p-6`}>
          <StatHeader icon={Zap} title="Quick Shortcuts" subtitle="Jump into your main city actions" />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Coin Store', icon: ShoppingBag, path: '/store', tone: 'yellow' as const },
              { label: 'Shop', icon: Store, path: '/marketplace', tone: 'cyan' as const },
              { label: 'Inventory', icon: Package, path: '/inventory', tone: 'purple' as const },
              { label: 'Earnings', icon: DollarSign, path: '/my-earnings', tone: 'green' as const },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`${cityCard} group flex flex-col items-center gap-3 p-5 hover:-translate-y-1`}
              >
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3 transition group-hover:border-cyan-300/40 group-hover:shadow-[0_0_22px_rgba(45,212,191,0.18)]">
                  <item.icon className="h-6 w-6 text-cyan-200" />
                </div>
                <span className="font-bold text-slate-100">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <CreatorSeasonalGoals />
        </div>

        {loading || coinsLoading ? (
          <div className={`${cityPanel} p-12 text-center`}>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-cyan-300" />
            <div className="text-xl font-black text-cyan-100">Loading Stats</div>
            <p className="mt-2 text-slate-400">Syncing your Troll City data...</p>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={`${cityCard} p-6`}>
              <StatHeader icon={Star} title="Level & XP" subtitle="Real-time progression sync" />

              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-white">Level {stats.level}</span>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-200">
                  {stats.level} → {stats.level + 1}
                </span>
              </div>

              <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-pink-500 shadow-[0_0_18px_rgba(45,212,191,0.42)] transition-all duration-500"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>

              <div className="mt-3 text-center text-sm text-slate-400">
                {Math.round(levelProgress)}% to next level
              </div>

              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Current Level</span>
                  <span className="font-bold text-cyan-200">{stats.level} / 2000</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                  <TrendingUp className="h-3 w-3" />
                  Real-time sync enabled
                </div>
              </div>
            </div>

            <div className={`${cityCard} p-6`}>
              <StatHeader icon={Shield} title="Credit Score" subtitle="Reliability, loans, and city behavior" />
              <CreditScoreBadge
                score={creditData?.score}
                tier={creditData?.tier}
                trend7d={creditData?.trend_7d}
                loading={creditLoading}
              />
            </div>

            {stats.familyName && (
              <div className={`${cityCard} p-6`}>
                <StatHeader icon={Crown} title="Family Status" subtitle="Family season rank and XP" />

                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-white">🔥 {stats.familyName}</span>
                  <span className="font-bold text-cyan-200">Level {stats.familyLevel}</span>
                </div>

                <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-slate-950/60 p-4">
                  <div className="mb-2 text-sm text-slate-300">
                    Family XP:{' '}
                    <span className="font-bold text-cyan-300">
                      {stats.familyXp?.toLocaleString() || 0}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-black/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      style={{ width: `${familyXpProgress}%` }}
                    />
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-3 text-sm text-slate-300">
                    Season Score:{' '}
                    <span className="font-bold text-cyan-300">
                      {stats.seasonScore?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className={`${cityCard} p-6`}>
              <StatHeader icon={Sword} title="Battle / War Stats" subtitle="Crowns, streaks, wins, and tier" />

              <div className="grid grid-cols-2 gap-4">
                <MetricBox label="Wins" value={stats.warWins} tone="green" />
                <MetricBox label="Losses" value={stats.warLosses} tone="red" />
                <MetricBox
                  label="Streak"
                  value={
                    <span className="flex items-center gap-2">
                      {stats.warStreak}
                      {Number(stats.warStreak) > 0 && <span>🔥</span>}
                    </span>
                  }
                  tone="orange"
                />
                <MetricBox label="Tier" value={stats.warTier} tone="yellow" />
              </div>
            </div>

            <div className={`${cityCard} p-6`}>
              <StatHeader icon={Coins} title="Currency & Assets" subtitle="Coins, value, and cashout status" />

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-cyan-300/10 bg-slate-950/60 p-4">
                  <span className="font-bold text-slate-100">🎫 Troll Coins</span>
                  <span className="text-xl font-black text-cyan-300">
                    {stats.troll_coins.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-emerald-300/10 bg-slate-950/60 p-4">
                  <span className="font-bold text-slate-100">💰 Gifted Coins</span>
                  <span className="text-xl font-black text-emerald-300">
                    {stats.paid_coins.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-2xl border border-purple-300/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Total Coins Value</span>
                    <span className="text-lg font-black text-purple-300">
                      ${((stats.troll_coins + stats.paid_coins) * STORE_USD_PER_COIN).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">100 coins = $1.00</div>
                </div>

                {(stats.cashout_coins > 0 || stats.cashout_reserved_coins > 0) && (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold text-emerald-300">
                        <DollarSign className="h-4 w-4" />
                        Cashout Available
                      </span>
                      <span className="text-lg font-black text-emerald-300">
                        ${(Math.min(stats.cashout_coins, stats.troll_coins + stats.paid_coins) * STORE_USD_PER_COIN).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              <EmpirePartnerSection />
            </div>

            <div className={`${cityCard} p-6 lg:col-span-2`}>
              <StatHeader icon={Trophy} title="Badges & Achievements" subtitle="Unlocked rank markers and city achievements" />

              <div className="flex flex-wrap gap-3">
                {stats.badges.length > 0 ? (
                  stats.badges.map((badge, index) => (
                    <span
                      key={index}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-bold text-cyan-100"
                    >
                      {badge}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">
                    No badges earned yet. Keep playing to unlock achievements.
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={`${cityPanel} p-12 text-center text-slate-400`}>
            Failed to load stats.
          </div>
        )}
      </div>
    </div>
  )
}