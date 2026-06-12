import React, { useMemo, useState } from 'react'
import {
  ArrowRight,
  Crown,
  Eye,
  Flame,
  Gift,
  Heart,
  Medal,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDistanceToNowStrict, isAfter, isBefore } from 'date-fns'
import { trollCityTheme } from '@/styles/trollCityTheme'
import { useLeagueSnapshot } from '@/hooks/useLeagueSnapshot'
import { useLeagueStandings, useMyFamilyLeagueStanding } from '@/hooks/useFamilyLeagues'
import { useUserLeagues } from '@/hooks/useUserLeagues'
import { useLeagues } from '@/hooks/useLeagues'
import { useAuthStore } from '@/lib/store'

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

function PrideChallengesLeaguesView() {
  const now = new Date()
  const currentWeek = Math.min(4, Math.max(1, Math.ceil(now.getDate() / 7)))
  const dayOfWeek = now.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek

  const allPrideChallenges: Array<{ week: number; title: string; description: string; xp: string; color: string }> = [
    // Week 1
    { week: 1, title: 'Show Your Pride', description: 'Update your profile frame to a Pride theme', xp: '500 XP', color: 'pink' },
    { week: 1, title: 'Rainbow Greeting', description: 'Send 10 positive chat messages today', xp: '750 XP', color: 'red' },
    { week: 1, title: 'Pride Profile', description: 'Add a Pride badge to your profile', xp: '300 XP', color: 'orange' },
    { week: 1, title: 'Spread Love', description: 'Like 20 posts on the Troll Wall', xp: '400 XP', color: 'yellow' },
    { week: 1, title: 'Community Spirit', description: 'Reply to 5 different wall posts', xp: '600 XP', color: 'green' },
    // Week 2
    { week: 2, title: 'Ally Actions', description: 'Support 5 different users with gifts', xp: '1,000 XP', color: 'cyan' },
    { week: 2, title: 'Wall Storyteller', description: 'Post 3 Pride-themed messages on the wall', xp: '800 XP', color: 'purple' },
    { week: 2, title: 'Gift of Pride', description: 'Send a Pride gift to 3 friends', xp: '900 XP', color: 'pink' },
    { week: 2, title: 'Pride Explorer', description: 'Visit 5 different neighborhoods', xp: '600 XP', color: 'red' },
    // Week 3
    { week: 3, title: 'Pride Champion', description: 'Win a battle with a Pride theme equipped', xp: '1,200 XP', color: 'orange' },
    { week: 3, title: 'Family Pride', description: 'Invite a friend to join your Troll Family', xp: '1,000 XP', color: 'yellow' },
    { week: 3, title: 'Pride Collector', description: 'Purchase a Pride item from the store', xp: '750 XP', color: 'green' },
    { week: 3, title: 'Voice of Pride', description: 'Spend 30 minutes in a voice room', xp: '500 XP', color: 'cyan' },
    { week: 3, title: 'Pride Shoutout', description: 'Give 10 compliments in chat', xp: '800 XP', color: 'blue' },
    // Week 4
    { week: 4, title: 'Pride Legend', description: 'Reach top 10 on any leaderboard', xp: '2,000 XP', color: 'purple' },
    { week: 4, title: 'Pride Marathon', description: 'Be active for 5 days this week', xp: '1,500 XP', color: 'pink' },
    { week: 4, title: 'Pride Connector', description: 'Add 5 new friends to your list', xp: '900 XP', color: 'red' },
    { week: 4, title: 'Pride Creator', description: 'Share a Pride moment on your wall', xp: '1,000 XP', color: 'orange' },
    { week: 4, title: 'Ultimate Pride', description: 'Complete all other Pride challenges', xp: '5,000 XP', color: 'yellow' },
  ]

  const colorMap: Record<string, string> = {
    pink: 'border-pink-400/25 bg-pink-500/[0.07]',
    red: 'border-red-400/25 bg-red-500/[0.07]',
    orange: 'border-orange-400/25 bg-orange-500/[0.07]',
    yellow: 'border-yellow-300/25 bg-yellow-300/[0.07]',
    green: 'border-green-400/25 bg-green-500/[0.07]',
    cyan: 'border-cyan-400/25 bg-cyan-500/[0.07]',
    blue: 'border-blue-400/25 bg-blue-500/[0.07]',
    purple: 'border-purple-400/25 bg-purple-500/[0.07]',
  }

  const xpColorMap: Record<string, string> = {
    pink: 'text-pink-300',
    red: 'text-red-300',
    orange: 'text-orange-300',
    yellow: 'text-yellow-300',
    green: 'text-green-300',
    cyan: 'text-cyan-300',
    blue: 'text-blue-300',
    purple: 'text-purple-300',
  }

  const visibleChallenges = allPrideChallenges.filter(c => c.week <= currentWeek)

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-black text-white">Week {currentWeek} of 4</p>
          <p className="text-xs text-slate-400">Updates every Sunday</p>
        </div>
        <span className="rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-3 py-1.5 text-[11px] font-black text-pink-200">
          {visibleChallenges.length}/{allPrideChallenges.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleChallenges.map((ch) => (
          <div key={ch.title} className={`rounded-2xl border p-4 ${colorMap[ch.color] || 'border-white/10 bg-white/[0.04]'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-white">{ch.title}</p>
                <p className="mt-2 text-sm text-slate-300">{ch.description}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${xpColorMap[ch.color] || 'text-yellow-300'}`}>
                {ch.xp}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-purple-400/20 bg-purple-500/10 p-4">
        <div className="flex gap-3">
          <Heart className="mt-0.5 h-5 w-5 shrink-0 text-purple-200" />
          <div>
            <p className="font-black text-white">Next update in {daysUntilSunday} day{daysUntilSunday !== 1 ? 's' : ''}</p>
            <p className="mt-1 text-sm text-slate-300">
              Check back Sunday for new challenges and updated rewards! 🏳️‍🌈
            </p>
          </div>
        </div>
      </div>
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

  const { standings, season: familySeason } = useLeagueStandings()
  const { standing: myFamilyStanding } = useMyFamilyLeagueStanding()
  const familyTopStandings = useMemo(
    () => (standings || []).slice(0, 4),
    [standings]
  )

  const {
    myLeagues,
    myMemberships,
    leagueMissions,
    isLoading: isUserLeaguesLoading,
    isCreating,
    isJoining,
    error: userLeaguesError,
    createLeague,
    joinLeague,
    leaveLeague,
    claimMission: claimLeagueMission,
    refreshLeagues: refreshUserLeagues,
  } = useUserLeagues()

  const { publicLeagues, isLoading: isPublicLeaguesLoading } = useLeagues()
  const { profile } = useAuthStore()

  const userLevel = profile?.level ?? 0
  const isAdmin = profile?.is_admin === true || String(profile?.role) === 'admin' || String(profile?.role) === 'ceo' || String(profile?.role) === 'superadmin'
  const hasRole = profile?.role != null && String(profile.role) !== '' && String(profile.role) !== 'user'
  const canCreateLeague = userLevel >= 10 || isAdmin || hasRole

  const [selectedFilter, setSelectedFilter] = useState<'Weekly' | 'Monthly' | 'All-Time'>('Weekly')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showBrowseLeagues, setShowBrowseLeagues] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [newLeagueDesc, setNewLeagueDesc] = useState('')
  const [newLeagueType, setNewLeagueType] = useState('standard')

  const handleCreateLeague = async () => {
    if (!newLeagueName.trim()) return
    const id = await createLeague({
      name: newLeagueName.trim(),
      description: newLeagueDesc.trim() || undefined,
      leagueType: newLeagueType,
    })
    if (id) {
      setShowCreateForm(false)
      setNewLeagueName('')
      setNewLeagueDesc('')
      setNewLeagueType('standard')
    }
  }

  const handleJoinLeague = async (leagueId: string) => {
    await joinLeague(leagueId)
  }

  const handleLeaveLeague = async (leagueId: string) => {
    await leaveLeague(leagueId)
  }

  const activeLeagueMissions = useMemo(
    () => leagueMissions.filter(m => m.status === 'active'),
    [leagueMissions]
  )

  const completedLeagueMissions = useMemo(
    () => leagueMissions.filter(m => m.status === 'completed'),
    [leagueMissions]
  )

  const seasonDateRange = familySeason
    ? `${new Date(familySeason.season_start_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} — ${new Date(familySeason.season_end_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`
    : ''

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
                  <span className="font-black text-white">Crown + 5,000 Trollmonds</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Top 2–3</span>
                  <span className="font-black text-white">Medal + 2,500 Trollmonds</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Top 4–10</span>
                  <span className="font-black text-white">Badge + 1,000 Trollmonds</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ MY LEAGUES SECTION ═══ */}
        <div className="rounded-[1.75rem] border border-purple-300/15 bg-purple-500/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                My Leagues
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {canCreateLeague
                  ? 'Create your own league or join existing ones to compete together.'
                  : 'Join a league to compete with others. Reach level 10 to create your own.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBrowseLeagues(!showBrowseLeagues)}
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-300/20"
              >
                Browse Leagues
              </button>
              {canCreateLeague && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="inline-flex items-center gap-1 rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-purple-100 transition hover:bg-purple-400/20"
                >
                  <Plus className="h-3 w-3" />
                  Create League
                </button>
              )}
            </div>
          </div>

          {/* Create League Form */}
          {showCreateForm && canCreateLeague && (
            <div className="mt-4 rounded-2xl border border-purple-300/20 bg-black/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-white">Create New League</p>
                <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="League name"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-400/50"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newLeagueDesc}
                  onChange={(e) => setNewLeagueDesc(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-400/50"
                />
                <div className="flex gap-2">
                  {['standard', 'competitive', 'casual', 'tournament'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewLeagueType(t)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                        newLeagueType === t
                          ? 'border-purple-400 bg-purple-400/20 text-purple-100'
                          : 'border-white/10 bg-white/5 text-slate-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {userLeaguesError && (
                  <p className="text-xs text-red-400">{userLeaguesError}</p>
                )}
                <button
                  type="button"
                  onClick={handleCreateLeague}
                  disabled={isCreating || !newLeagueName.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white transition hover:bg-purple-500 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create League'}
                </button>
              </div>
            </div>
          )}

          {/* Browse Public Leagues */}
          {showBrowseLeagues && (
            <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-black/30 p-4">
              <p className="text-sm font-black text-white mb-3">Public Leagues</p>
              {isPublicLeaguesLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : publicLeagues.length === 0 ? (
                <p className="text-sm text-slate-400">No public leagues available yet. Be the first to create one!</p>
              ) : (
                <div className="space-y-2">
                  {publicLeagues.map((league) => {
                    const isMember = !!myMemberships[league.id]
                    const isMyLeague = league.creator_id === profile?.id
                    return (
                      <div
                        key={league.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg">{league.icon_emoji || '🏆'}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{league.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {league.member_count}/{league.max_members} members • {league.league_type} • Score: {league.league_score.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isMyLeague ? (
                            <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-[10px] font-black text-yellow-300">Owner</span>
                          ) : isMember ? (
                            <button
                              type="button"
                              onClick={() => handleLeaveLeague(league.id)}
                              className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-[10px] font-black text-red-300 transition hover:bg-red-400/20"
                            >
                              Leave
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleJoinLeague(league.id)}
                              disabled={isJoining}
                              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-200 transition hover:bg-cyan-300/20 disabled:opacity-50"
                            >
                              Join
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* My Current Leagues */}
          {myLeagues.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-black text-white">Your Leagues</p>
              {myLeagues.map((league) => {
                const membership = myMemberships[league.id]
                return (
                  <div
                    key={league.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{league.icon_emoji || '🏆'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{league.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {league.member_count}/{league.max_members} members • Score: {league.league_score.toLocaleString()}
                            {membership && ` • Your pts: ${membership.contribution_score.toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                        membership?.role === 'creator'
                          ? 'bg-yellow-500/10 text-yellow-300'
                          : membership?.role === 'admin'
                          ? 'bg-purple-500/10 text-purple-300'
                          : 'bg-white/5 text-slate-400'
                      }`}>
                        {membership?.role || 'member'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* League Missions for User's Leagues */}
          {(activeLeagueMissions.length > 0 || completedLeagueMissions.length > 0) && (
            <div className="mt-4">
              <p className="text-sm font-black text-white mb-3">League Missions</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[...completedLeagueMissions, ...activeLeagueMissions].map((mission) => {
                  const progress = mission.target_value
                    ? Math.min(100, Math.round((mission.current_value / mission.target_value) * 100))
                    : 0
                  return (
                    <div
                      key={mission.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white truncate">{mission.title}</p>
                          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{mission.description}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          mission.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : mission.status === 'claimed'
                            ? 'bg-slate-700/60 text-slate-300'
                            : 'bg-cyan-500/10 text-cyan-300'
                        }`}>
                          {mission.status}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] text-white/45 mb-1">
                          <span>{mission.current_value}/{mission.target_value}</span>
                          <span>{mission.reward_points} pts</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-cyan-400 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>{mission.reward_xp} XP</span>
                        <span>{mission.reward_coins} coins</span>
                      </div>
                      {mission.status === 'completed' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await claimLeagueMission(mission.id)
                            refreshUserLeagues()
                          }}
                          className="mt-3 w-full rounded-xl border border-cyan-300/20 bg-cyan-300/10 py-1.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/20"
                        >
                          Claim Reward
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {myLeagues.length === 0 && !showCreateForm && !showBrowseLeagues && (
            <p className="mt-3 text-sm text-slate-400">
              You haven't joined any leagues yet. Browse public leagues or create your own!
            </p>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                🏳️‍🌈 Pride Challenges
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Complete Pride Month challenges to earn XP and celebrate with the community.
              </p>
            </div>
          </div>

          <PrideChallengesLeaguesView />
        </div>

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