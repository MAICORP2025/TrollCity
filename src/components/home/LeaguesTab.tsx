import React, { useMemo, useState } from 'react'
import {
  ArrowRight,
  Crown,
  Eye,
  Flame,
  Gift,
  Medal,
  Radio,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDistanceToNowStrict, isAfter, isBefore } from 'date-fns'
import { trollCityTheme } from '@/styles/trollCityTheme'
import { useLeagueSnapshot } from '@/hooks/useLeagueSnapshot'

interface LeaguesTabProps {
  streamId?: string | null
  category?: string | null
}

type LeaderboardRow = {
  supporter_id?: string | null
  supporter_username?: string | null
  supporter_display_name?: string | null
  supporter_avatar_url?: string | null
  broadcaster_id?: string | null
  broadcaster_username?: string | null
  broadcaster_display_name?: string | null
  stream_id?: string | null
  gift_coins?: number | null
  total_gifts?: number | null
  score?: number | null
  rank?: number | null
}

type LeagueEventLike = {
  id?: string
  name?: string
  slug?: string
  type?: string
  status?: string
  starts_at?: string
  ends_at?: string
  metadata?: Record<string, unknown> | null
}

const formatCompactNumber = (value?: number | null) => {
  const number = Number(value || 0)

  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`

  return number.toLocaleString()
}

const getDisplayName = (row: LeaderboardRow) => {
  return (
    row.supporter_display_name ||
    row.supporter_username ||
    row.broadcaster_display_name ||
    row.broadcaster_username ||
    'Troll Citizen'
  )
}

const getInitials = (name: string) => {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

const getRankStyle = (rank: number) => {
  if (rank === 1) {
    return {
      shell:
        'border-yellow-300/40 bg-yellow-300/15 text-yellow-100 shadow-[0_0_30px_rgba(250,204,21,0.16)]',
      badge: 'bg-yellow-300 text-yellow-950',
      icon: <Crown className="h-4 w-4" />,
      label: 'City Crown',
    }
  }

  if (rank === 2) {
    return {
      shell:
        'border-cyan-200/30 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)]',
      badge: 'bg-cyan-200 text-slate-950',
      icon: <Medal className="h-4 w-4" />,
      label: 'Neon Runner-Up',
    }
  }

  if (rank === 3) {
    return {
      shell:
        'border-pink-300/30 bg-pink-400/10 text-pink-100 shadow-[0_0_24px_rgba(236,72,153,0.12)]',
      badge: 'bg-pink-300 text-slate-950',
      icon: <Medal className="h-4 w-4" />,
      label: 'Pulse Champion',
    }
  }

  return {
    shell: 'border-white/10 bg-white/[0.04] text-white/85',
    badge: 'bg-white/10 text-white',
    icon: <Trophy className="h-4 w-4" />,
    label: 'Ranked',
  }
}

const getEventTypeLabel = (event?: LeagueEventLike | null) => {
  const type = String(event?.type || '').replace(/_/g, ' ')

  if (!type) return 'Live League'

  return type
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

const getTimeStatus = (event?: LeagueEventLike | null) => {
  if (!event?.starts_at || !event?.ends_at) {
    return {
      label: 'Open now',
      tone: 'text-cyan-100',
      isActive: !!event,
    }
  }

  try {
    const now = new Date()
    const starts = new Date(event.starts_at)
    const ends = new Date(event.ends_at)

    if (isBefore(now, starts)) {
      return {
        label: `Starts in ${formatDistanceToNowStrict(starts)}`,
        tone: 'text-purple-100',
        isActive: false,
      }
    }

    if (isAfter(now, ends)) {
      return {
        label: 'Recently ended',
        tone: 'text-slate-300',
        isActive: false,
      }
    }

    return {
      label: `${formatDistanceToNowStrict(ends)} left`,
      tone: 'text-emerald-100',
      isActive: true,
    }
  } catch {
    return {
      label: 'Ending soon',
      tone: 'text-cyan-100',
      isActive: true,
    }
  }
}

function PodiumCard({
  row,
  rank,
}: {
  row: LeaderboardRow
  rank: number
}) {
  const name = getDisplayName(row)
  const rankStyle = getRankStyle(rank)
  const score = Number(row.gift_coins ?? row.score ?? 0)
  const totalGifts = Number(row.total_gifts || 0)

  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border p-4 ${rankStyle.shell}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-cyan-400/25 via-purple-500/25 to-pink-500/25 text-sm font-black text-white shadow-[0_0_24px_rgba(34,211,238,0.16)]">
            {row.supporter_avatar_url ? (
              <img
                src={row.supporter_avatar_url}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(name) || '?'
            )}
            {rank === 1 && (
              <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-yellow-300 text-yellow-950 shadow-lg">
                <Crown className="h-3.5 w-3.5" />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{name}</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
              {rankStyle.label}
            </p>
          </div>
        </div>

        <div
          className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-black ${rankStyle.badge}`}
        >
          #{rank}
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
            Points
          </p>
          <p className="mt-1 text-lg font-black text-white">
            {formatCompactNumber(score)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
            Gifts
          </p>
          <p className="mt-1 text-lg font-black text-white">
            {formatCompactNumber(totalGifts)}
          </p>
        </div>
      </div>
    </div>
  )
}

function LeaderboardRowCard({
  row,
  index,
}: {
  row: LeaderboardRow
  index: number
}) {
  const rank = Number(row.rank || index + 1)
  const name = getDisplayName(row)
  const score = Number(row.gift_coins ?? row.score ?? 0)
  const totalGifts = Number(row.total_gifts || 0)
  const rankStyle = getRankStyle(rank)

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black ${rankStyle.badge}`}
        >
          {rank}
        </div>

        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/20 via-purple-500/20 to-pink-500/20 text-xs font-black text-white">
          {row.supporter_avatar_url ? (
            <img
              src={row.supporter_avatar_url}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(name) || '?'
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{name}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
            <span className="inline-flex items-center gap-1">
              <Gift className="h-3 w-3" />
              {formatCompactNumber(totalGifts)} gifts
            </span>
            <span>•</span>
            <span>Supporter</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-black text-cyan-100">
            {formatCompactNumber(score)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            pts
          </p>
        </div>
      </div>
    </div>
  )
}

function LeagueSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  )
}

/**
 * Premium Troll City league panel for live broadcasts/home surfaces.
 * Real-data first. No fake production usernames.
 */
export default function LeaguesTab({ streamId, category }: LeaguesTabProps) {
  const {
    activeEvent,
    leaderboard,
    isLoading,
    userRank,
    userLeagueProgress,
    missions,
    claimMission,
    isClaimingMission,
    claimingMissionId,
    refreshLeague,
  } = useLeagueSnapshot({
    streamId: streamId || null,
    category,
    limit: 10,
  })

  const [selectedFilter, setSelectedFilter] = useState<'Weekly' | 'Monthly' | 'All-Time'>('Weekly')

  const event = activeEvent as LeagueEventLike | null
  const timeStatus = getTimeStatus(event)

  const activeMissions = useMemo(
    () => (missions || []).filter((mission) => mission.status === 'active'),
    [missions]
  )

  const claimableMissions = useMemo(
    () => (missions || []).filter((mission) => mission.status === 'completed'),
    [missions]
  )

  const rankLabel = userRank ? `#${userRank}` : '—'
  const userTier = userLeagueProgress?.tier || 'Rookie Citizen League'
  const userXpProgress = userLeagueProgress?.xpProgress ?? 0
  const xpToNext = userLeagueProgress?.xpToNext ?? 0
  const nextReward = userLeagueProgress?.nextReward || 'Rookie Bonus Pack'

  const normalizedLeaderboard = useMemo(() => {
    return (leaderboard || [])
      .filter(Boolean)
      .map((row: LeaderboardRow, index: number) => ({
        ...row,
        rank: row.rank || index + 1,
        gift_coins: Number(row.gift_coins ?? row.score ?? 0),
        total_gifts: Number(row.total_gifts || 0),
      }))
      .sort((a: LeaderboardRow, b: LeaderboardRow) => {
        const aRank = Number(a.rank || 999)
        const bRank = Number(b.rank || 999)
        if (aRank !== bRank) return aRank - bRank

        return Number(b.gift_coins || b.score || 0) - Number(a.gift_coins || a.score || 0)
      })
  }, [leaderboard])

  const topThree = normalizedLeaderboard.slice(0, 3)
  const rest = normalizedLeaderboard.slice(3)
  const eventTitle = event?.name || 'Troll City Clash'
  const eventType = getEventTypeLabel(event)

  const hasLeaderboard = normalizedLeaderboard.length > 0

  const totalPoints = useMemo(() => {
    return normalizedLeaderboard.reduce(
      (sum: number, row: LeaderboardRow) => sum + Number(row.gift_coins ?? row.score ?? 0),
      0
    )
  }, [normalizedLeaderboard])

  const totalGifts = useMemo(() => {
    return normalizedLeaderboard.reduce(
      (sum: number, row: LeaderboardRow) => sum + Number(row.total_gifts || 0),
      0
    )
  }, [normalizedLeaderboard])

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/80 text-white shadow-[0_0_60px_rgba(34,211,238,0.10)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.20),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(168,85,247,0.16),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.12),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />

      <div className="relative space-y-5 p-4 sm:p-5">
        <div className="overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-black/35 p-4 shadow-[0_0_34px_rgba(34,211,238,0.10)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-yellow-300/30 bg-yellow-300/10 text-yellow-100 shadow-[0_0_24px_rgba(250,204,21,0.14)]">
                <Trophy className="h-7 w-7" />
                {timeStatus.isActive && (
                  <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-black bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                    {eventType}
                  </p>

                  <p
                    className={`rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${timeStatus.tone}`}
                  >
                    {timeStatus.isActive ? 'Live' : 'Standby'}
                  </p>
                </div>

                <h3 className="mt-2 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {eventTitle}
                </h3>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                  Send gifts in live broadcasts to push supporters, creators, and neighborhoods up the city leaderboard.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 lg:w-[360px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                <Timer className="mx-auto h-4 w-4 text-cyan-200" />
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                  Time
                </p>
                <p className="mt-1 text-xs font-black text-white">
                  {timeStatus.label}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                <Zap className="mx-auto h-4 w-4 text-yellow-200" />
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                  Points
                </p>
                <p className="mt-1 text-xs font-black text-white">
                  {formatCompactNumber(totalPoints)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                <Gift className="mx-auto h-4 w-4 text-pink-200" />
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                  Gifts
                </p>
                <p className="mt-1 text-xs font-black text-white">
                  {formatCompactNumber(totalGifts)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
                  League Progress
                </p>
                <h4 className="mt-2 text-2xl font-black text-white">{userTier}</h4>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                {rankLabel}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              Level {userLeagueProgress?.level ?? 1} • {userLeagueProgress?.paidChatUnlock ? 'Paid chat ready' : `Level ${userLeagueProgress?.paidChatTargetLevel ?? 420} unlock`}
            </p>

            <div className="mt-4 rounded-3xl bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
                <span>{formatCompactNumber(userLeagueProgress?.xpTotal ?? 0)} XP</span>
                <span>{xpToNext} to next</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${userXpProgress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Level</p>
                <p className="mt-2 text-lg font-black text-white">{userLeagueProgress?.level ?? 1}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Progress</p>
                <p className="mt-2 text-lg font-black text-white">{userXpProgress}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Paid Chat</p>
                <p className="mt-2 text-lg font-black text-white">{userLeagueProgress?.paidChatUnlock ? 'Unlocked' : 'Locked'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-sm text-slate-200">
              <p className="font-black text-white">Next league reward</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{nextReward}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.75rem] border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-cyan-200" />
                <div>
                  <p className="font-black text-white">League Creator Status</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Auto-generated Troll City league events refresh as the current event closes. Stay active to maintain rank and unlock the next system event.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-black text-white">{timeStatus.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Event type</span>
                  <span className="font-black text-white">{eventType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Multiplier</span>
                  <span className="font-black text-white">x{activeEvent?.points_multiplier ?? 1}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-pink-300/10 bg-pink-500/5 p-4">
              <div className="flex items-center gap-3">
                <Gift className="h-5 w-5 text-pink-200" />
                <div>
                  <p className="font-black text-white">Top Rewards Preview</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    What the top supporters can expect this round.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Top 1</span>
                  <span className="font-black text-white">Crown + 5,000 coins</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Top 2–3</span>
                  <span className="font-black text-white">Medal + 2,500 coins</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Top 4–10</span>
                  <span className="font-black text-white">Badge + 1,000 coins</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                League Missions
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Complete daily league goals to earn rewards, experience, and league momentum.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {['Weekly', 'Monthly', 'All-Time'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedFilter(option as 'Weekly' | 'Monthly' | 'All-Time')}
                  className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                    selectedFilter === option
                      ? 'border-cyan-300 bg-cyan-300/10 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {missions && missions.length > 0 ? (
              missions.map((mission) => {
                const progress = mission.target_value
                  ? Math.min(100, Math.round((mission.current_value / mission.target_value) * 100))
                  : 0

                return (
                  <div
                    key={mission.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{mission.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {mission.description}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${
                        mission.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-200'
                          : mission.status === 'claimed'
                          ? 'bg-slate-700/60 text-slate-200'
                          : 'bg-cyan-500/10 text-cyan-200'
                      }`}>
                        {mission.status}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-white/45">
                        <span>{mission.current_value}/{mission.target_value}</span>
                        <span>{mission.reward_points} pts</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 text-[12px] text-slate-300">
                      <span>{mission.reward_xp} XP</span>
                      <span>{mission.reward_coins} coins</span>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (mission.status !== 'completed') return
                        await claimMission(mission.id)
                        refreshLeague()
                      }}
                      disabled={mission.status !== 'completed' || isClaimingMission}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-black text-white transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {claimingMissionId === mission.id && isClaimingMission ? 'Claiming...' : 'Claim'}
                    </button>
                  </div>
                )
              })
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                No league missions are available yet. Stay active to receive mission assignments for the current event.
              </div>
            )}
          </div>
        </div>

        {!event && (
          <div className="rounded-[1.5rem] border border-purple-300/20 bg-purple-400/10 p-4">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-purple-200" />
              <div>
                <p className="font-black text-white">No active league event is connected yet.</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  This panel is ready for real league data. Once a league event is active, the live leaderboard will appear here automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <LeagueSkeleton />
        ) : hasLeaderboard ? (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {topThree.map((row: LeaderboardRow, index: number) => (
                <PodiumCard
                  key={`${row.supporter_id || row.supporter_username || index}-podium`}
                  row={row}
                  rank={Number(row.rank || index + 1)}
                />
              ))}
            </div>

            {rest.length > 0 && (
              <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-200" />
                    <h4 className="text-sm font-black text-white">City Leaderboard</h4>
                  </div>
                  <p className="text-xs font-bold text-white/45">
                    Top {normalizedLeaderboard.length}
                  </p>
                </div>

                <div className="space-y-2">
                  {rest.map((row: LeaderboardRow, index: number) => (
                    <LeaderboardRowCard
                      key={`${row.supporter_id || row.supporter_username || index}-row`}
                      row={row}
                      index={index + 3}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-cyan-300/15 bg-black/30 p-6 text-center backdrop-blur-xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
              <Radio className="h-8 w-8" />
            </div>

            <h4 className="mt-4 text-xl font-black text-white">No supporters ranked yet</h4>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
              Rankings will populate from real gift activity. Send gifts during live broadcasts to climb the leaderboard.
            </p>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
              <div>
                <p className="font-black text-white">How league points work</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Gifts sent during eligible live broadcasts count toward league score. Bigger gifts, streaks, and event multipliers can push supporters higher.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-pink-300/15 bg-pink-400/[0.06] p-4">
            <div className="flex items-start gap-3">
              <Flame className="mt-1 h-5 w-5 shrink-0 text-pink-200" />
              <div>
                <p className="font-black text-white">Live recognition</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Top supporters can appear in broadcast overlays, City Pulse, rankings, and future reward drops.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/live"
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.22)] transition hover:scale-[1.01]"
          >
            <Eye className="h-4 w-4" />
            Watch Live Broadcasts
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>

          <Link
            to="/store"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-purple-300/25 bg-purple-400/15 px-4 py-3 text-sm font-black text-purple-100 transition hover:bg-purple-400/20"
          >
            <Gift className="h-4 w-4" />
            Get Coins for Gifts
          </Link>
        </div>
      </div>
    </section>
  )
}