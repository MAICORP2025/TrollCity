import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Gift,
  Gauge,
  Heart,
  Home,
  LogOut,
  Mic,
  Music,
  Play,
  PlusCircle,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  UsersRound,
  Wallet,
  Zap,
} from 'lucide-react'
import CoinStoreModal from '@/components/broadcast/CoinStoreModal'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useCoins } from '@/lib/hooks/useCoins'
import { useSidebarStore } from '@/stores/useSidebarStore'

const TC = {
  bg: '#030712',
  panel: '#07111f',
  panel2: '#0b1020',
  cyan: '#22d3ee',
  blue: '#2563eb',
  purple: '#9333ea',
  pink: '#ec4899',
  gold: '#facc15',
  green: '#34d399',
  red: '#fb7185',
}

type TalentCategory = 'Singing' | 'Dance' | 'Comedy' | 'Music' | 'Rap' | 'Other'

interface Season {
  id: string
  name: string
  status: string
  start_date?: string
  end_date?: string
  created_at?: string
}

interface Show {
  id: string
  title: string
  status: string
  start_time?: string
  host_id?: string
  judge_slots?: number
  category?: string
  created_at?: string
}

interface Performer {
  id: string
  username: string
  avatar_url?: string
  role?: string
  bio?: string
  level?: number
}

interface Audition {
  id: string
  user_id: string
  show_id?: string
  title?: string
  category?: TalentCategory | string
  status?: string
  vote_count?: number
  created_at?: string
  user_profiles?: {
    id: string
    username: string
    avatar_url?: string
    role?: string
  }
}

const TALENT_CATEGORIES: Array<{ icon: JSX.Element; name: TalentCategory; description: string }> = [
  { icon: <Mic className="h-4 w-4" />, name: 'Singing', description: 'Vocals, covers, original songs' },
  { icon: <Music className="h-4 w-4" />, name: 'Dance', description: 'Solo, group, freestyle routines' },
  { icon: <Zap className="h-4 w-4" />, name: 'Comedy', description: 'Stand-up, skits, character bits' },
  { icon: <Music className="h-4 w-4" />, name: 'Music', description: 'Instruments, beats, production' },
  { icon: <Mic className="h-4 w-4" />, name: 'Rap', description: 'Freestyle, written verses, battles' },
  { icon: <Sparkles className="h-4 w-4" />, name: 'Other', description: 'Magic, art, acting, unique talent' },
]

const ADMIN_ROLES = ['admin', 'ceo', 'staff', 'secretary']
const ALL_VALID_ROLES = [
  'user',
  'staff',
  'officer',
  'broadofficer',
  'secretary',
  'president',
  'admin',
  'ceo',
  'student',
  'org_student',
  'org_admin',
]

const cn = (...classes: Array<string | false | undefined | null>) => classes.filter(Boolean).join(' ')

const formatNumber = (value?: number | null) => Number(value || 0).toLocaleString()

function roleCanAdmin(role?: string | null, isAdmin?: boolean) {
  return Boolean(isAdmin || ADMIN_ROLES.includes(String(role || '').toLowerCase()))
}

function isValidTalentRole(role?: string | null) {
  if (!role) return true
  return ALL_VALID_ROLES.includes(String(role).toLowerCase()) || true
}

function NeonButton({
  children,
  to,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode
  to?: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition duration-200 disabled:cursor-not-allowed disabled:opacity-50'
  const styles = {
    primary:
      'border border-cyan-300/40 bg-cyan-400/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)] hover:bg-cyan-400/25 hover:shadow-[0_0_34px_rgba(34,211,238,0.3)]',
    secondary:
      'border border-purple-300/40 bg-purple-500/15 text-purple-100 shadow-[0_0_24px_rgba(147,51,234,0.18)] hover:bg-purple-500/25',
    ghost:
      'border border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-400/10',
    danger:
      'border border-pink-300/40 bg-pink-500/15 text-pink-100 shadow-[0_0_24px_rgba(236,72,153,0.18)] hover:bg-pink-500/25',
  }

  if (to) {
    return (
      <Link to={to} className={cn(base, styles[variant], className)}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn(base, styles[variant], className)}>
      {children}
    </button>
  )
}

function StatCard({
  label,
  value,
  icon,
  accent = 'cyan',
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent?: 'cyan' | 'purple' | 'pink' | 'gold' | 'green'
}) {
  const accentClass = {
    cyan: 'border-cyan-300/20 text-cyan-300 shadow-cyan-950/40',
    purple: 'border-purple-300/20 text-purple-300 shadow-purple-950/40',
    pink: 'border-pink-300/20 text-pink-300 shadow-pink-950/40',
    gold: 'border-yellow-300/20 text-yellow-300 shadow-yellow-950/40',
    green: 'border-emerald-300/20 text-emerald-300 shadow-emerald-950/40',
  }

  return (
    <div className={cn('rounded-3xl border bg-slate-950/70 p-5 shadow-xl backdrop-blur-xl', accentClass[accent])}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        {icon}
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-8 text-center shadow-2xl shadow-cyan-950/20">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-300">
        {icon}
      </div>
      <h3 className="text-xl font-black text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

function MaiTalentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore()
  const { balances } = useCoins()
  const location = useLocation()
  const { setCollapsed } = useSidebarStore()
  const [mtSidebarCollapsed, setMtSidebarCollapsed] = useState(false)

  const isAdmin = roleCanAdmin(profile?.role, profile?.is_admin)
  const allRolesCanStartShow = isValidTalentRole(profile?.role)
  const allRolesCanJudge = isValidTalentRole(profile?.role)

  useEffect(() => {
    setCollapsed(true)
  }, [setCollapsed])

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`)

  const navSections = [
    {
      title: 'Main',
      items: [
        { path: '/mai-talent', label: 'Home', icon: Home, show: true },
        { path: '/mai-talent/shows', label: 'Shows', icon: Calendar, show: true },
        { path: '/mai-talent/auditions', label: 'Auditions', icon: Mic, show: true },
        { path: '/mai-talent/leaderboard', label: 'Leaderboard', icon: Trophy, show: true },
      ],
    },
    {
      title: 'Create',
      items: [
        { path: '/mai-talent/show', label: 'Start Show', icon: Play, show: allRolesCanStartShow },
        { path: '/mai-talent/judge', label: 'Judge Panel', icon: Crown, show: allRolesCanJudge },
      ],
    },
    {
      title: 'Account',
      items: [
        { path: '/mai-talent/wallet', label: 'Wallet', icon: Wallet, show: true },
        { path: '/mai-talent/profile', label: 'Profile', icon: UsersRound, show: true },
      ],
    },
    {
      title: 'Admin',
      items: [
        { path: '/mai-talent/admin', label: 'Dashboard', icon: Shield, show: isAdmin },
        { path: '/mai-talent/admin/users', label: 'Manage Users', icon: Gauge, show: isAdmin },
      ],
    },
  ]

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">
      <div
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-cyan-400/20 bg-slate-950/90 shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl transition-all duration-300',
          mtSidebarCollapsed ? 'w-20' : 'w-72',
        )}
      >
        <div className="flex items-center justify-between border-b border-cyan-400/15 p-3">
          {!mtSidebarCollapsed && (
            <Link to="/mai-talent" className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-400/15 shadow-[0_0_22px_rgba(34,211,238,0.25)]">
                <Trophy className="h-5 w-5 text-cyan-200" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black tracking-tight text-white">MAI Talent</p>
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/80">
                  Troll City Arena
                </p>
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMtSidebarCollapsed((value) => !value)}
            className={cn(
              'rounded-xl border border-white/10 bg-white/[0.04] p-2 text-cyan-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-white',
              mtSidebarCollapsed && 'mx-auto',
            )}
          >
            {mtSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div className={cn('px-1', mtSidebarCollapsed && 'flex justify-center')}>
            <NeonButton to="/mai-talent/show" className={mtSidebarCollapsed ? 'h-12 w-12 p-0' : 'w-full'} variant="primary">
              <Play className="h-5 w-5" />
              {!mtSidebarCollapsed && <span>Start Show</span>}
            </NeonButton>
          </div>

          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => item.show)
            if (!visibleItems.length) return null

            return (
              <div key={section.title} className="px-1">
                {!mtSidebarCollapsed && (
                  <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400/70">
                    {section.title}
                  </p>
                )}

                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon
                    const active = item.path === '/mai-talent' ? location.pathname === item.path : isActive(item.path)

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition',
                          active
                            ? 'border-cyan-300/40 bg-cyan-400/15 text-white shadow-lg shadow-cyan-950/30'
                            : 'border-transparent text-slate-300 hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:text-white',
                          mtSidebarCollapsed && 'justify-center px-2',
                        )}
                      >
                        <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-cyan-200' : 'text-slate-400 group-hover:text-cyan-200')} />
                        {!mtSidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-cyan-400/15 p-3">
          {!mtSidebarCollapsed && (
            <div className="mb-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/30 bg-cyan-400/10">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile?.username || 'User'} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-black text-cyan-200">{(profile?.username || 'U').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{profile?.username || 'User'}</p>
                  <p className="truncate text-xs text-cyan-300">{formatNumber(balances?.troll_coins)} Troll Coins</p>
                </div>
              </div>
            </div>
          )}

          <Link
            to="/"
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-white',
              mtSidebarCollapsed && 'justify-center',
            )}
          >
            <LogOut className="h-5 w-5" />
            {!mtSidebarCollapsed && <span>Exit to Troll City</span>}
          </Link>
        </div>
      </div>

      <main className={cn('min-h-screen flex-1 transition-all duration-300', mtSidebarCollapsed ? 'ml-20' : 'ml-72')}>
        {children}
      </main>
    </div>
  )
}

export default function MaiTalent() {
  const { profile } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const { balances } = useCoins()

  const [seasons, setSeasons] = useState<Season[]>([])
  const [liveShows, setLiveShows] = useState<Show[]>([])
  const [upcomingShows, setUpcomingShows] = useState<Show[]>([])
  const [performers, setPerformers] = useState<Performer[]>([])
  const [auditions, setAuditions] = useState<Audition[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningQueue, setJoiningQueue] = useState(false)
  const [votingId, setVotingId] = useState<string | null>(null)
  const [showCoinStore, setShowCoinStore] = useState(false)

  const isAdmin = roleCanAdmin(profile?.role, profile?.is_admin)
  const nextShow = upcomingShows[0]

  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!nextShow?.start_time) return

    const targetDate = new Date(nextShow.start_time).getTime()

    const updateCountdown = () => {
      const diff = targetDate - Date.now()

      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 })
        return
      }

      setCountdown({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }

    updateCountdown()
    const interval = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(interval)
  }, [nextShow?.start_time])

  const loadData = async () => {
    setLoading(true)

    try {
      const [seasonsRes, showsRes, performersRes, auditionsRes] = await Promise.allSettled([
        supabase.from('mt_seasons').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('mt_shows').select('*').order('start_time', { ascending: true }).limit(20),
        supabase.from('user_profiles').select('id, username, avatar_url, role, bio, level').limit(12),
        supabase
          .from('mt_auditions')
          .select('*, user_profiles:user_id(id, username, avatar_url, role)')
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (seasonsRes.status === 'fulfilled' && seasonsRes.value.data) {
        const activeSeason = seasonsRes.value.data.find((season: Season) => season.status === 'active')
        setSeasons(activeSeason ? [activeSeason] : seasonsRes.value.data.slice(0, 1))
      }

      if (showsRes.status === 'fulfilled' && showsRes.value.data) {
        const shows = showsRes.value.data as Show[]
        setLiveShows(shows.filter((show) => show.status === 'live'))
        setUpcomingShows(shows.filter((show) => ['scheduled', 'upcoming'].includes(show.status)))
      }

      if (performersRes.status === 'fulfilled' && performersRes.value.data) {
        setPerformers(performersRes.value.data as Performer[])
      }

      if (auditionsRes.status === 'fulfilled' && auditionsRes.value.data) {
        setAuditions(auditionsRes.value.data as Audition[])
      }
    } catch (error) {
      console.error('[MaiTalent] Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const primaryLiveShowId = liveShows[0]?.id

  const handleJoinQueue = async () => {
    if (!profile?.id) {
      navigate('/auth')
      return
    }

    if (!primaryLiveShowId) {
      navigate('/mai-talent/show')
      return
    }

    setJoiningQueue(true)

    try {
      const { data: existingQueue } = await supabase
        .from('mt_show_queue')
        .select('id')
        .eq('show_id', primaryLiveShowId)
        .eq('user_id', profile.id)
        .maybeSingle()

      if (existingQueue) {
        alert('You are already in the audition queue.')
        return
      }

      const { data: queueData } = await supabase
        .from('mt_show_queue')
        .select('position')
        .eq('show_id', primaryLiveShowId)
        .order('position', { ascending: false })
        .limit(1)

      const nextPosition = queueData?.[0]?.position ? Number(queueData[0].position) + 1 : 1

      const { error } = await supabase.from('mt_show_queue').insert({
        show_id: primaryLiveShowId,
        user_id: profile.id,
        position: nextPosition,
        status: 'waiting',
      })

      if (error) throw error

      alert(`You joined the audition queue at position #${nextPosition}.`)
    } catch (error) {
      console.error('[MaiTalent] Failed to join audition queue:', error)
      alert('Failed to join the audition queue. Please try again.')
    } finally {
      setJoiningQueue(false)
    }
  }

  const handleVoteAudition = async (audition: Audition) => {
    if (!profile?.id) {
      navigate('/auth')
      return
    }

    if (audition.user_id === profile.id) {
      alert('You cannot vote for your own audition.')
      return
    }

    setVotingId(audition.id)

    try {
      const { data: existingVote } = await supabase
        .from('mt_audition_votes')
        .select('id')
        .eq('audition_id', audition.id)
        .eq('voter_id', profile.id)
        .maybeSingle()

      if (existingVote) {
        alert('You already voted for this audition.')
        return
      }

      const { error: voteError } = await supabase.from('mt_audition_votes').insert({
        audition_id: audition.id,
        voter_id: profile.id,
        contestant_id: audition.user_id,
      })

      if (voteError) throw voteError

      const newVoteCount = Number(audition.vote_count || 0) + 1

      await supabase
        .from('mt_auditions')
        .update({ vote_count: newVoteCount, updated_at: new Date().toISOString() })
        .eq('id', audition.id)

      setAuditions((current) => current.map((item) => (item.id === audition.id ? { ...item, vote_count: newVoteCount } : item)))
    } catch (error) {
      console.error('[MaiTalent] Failed to vote for audition:', error)
      alert('Vote failed. Please try again.')
    } finally {
      setVotingId(null)
    }
  }

  const topAuditions = useMemo(
    () => [...auditions].sort((a, b) => Number(b.vote_count || 0) - Number(a.vote_count || 0)).slice(0, 6),
    [auditions],
  )

  const renderAdmin = () => (
    <PageShell eyebrow="Admin" title="Talent Control Center" subtitle="Monitor shows, auditions, users, and voting activity.">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Live shows" value={liveShows.length} icon={<Play className="h-5 w-5" />} accent="cyan" />
        <StatCard label="Auditions" value={auditions.length} icon={<Mic className="h-5 w-5" />} accent="purple" />
        <StatCard label="Performers" value={performers.length} icon={<Users className="h-5 w-5" />} accent="pink" />
      </div>

      <div className="mt-6 rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-6">
        <h3 className="text-xl font-black text-white">Admin Notes</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          All normal Troll City roles can start a talent show, judge a show, and audition. Admin tools are only for platform
          oversight, abuse review, and managing show/user issues.
        </p>
      </div>
    </PageShell>
  )

  const renderWallet = () => (
    <PageShell eyebrow="Wallet" title="Talent Wallet" subtitle="Your Troll City coins carry into MAI Talent.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available coins" value={formatNumber(balances?.troll_coins)} icon={<Wallet className="h-5 w-5" />} accent="gold" />
        <StatCard label="Paid coins" value={formatNumber((balances as any)?.paid_coins)} icon={<Star className="h-5 w-5" />} accent="green" />
        <StatCard label="Total earned" value={formatNumber((balances as any)?.total_earned_coins)} icon={<Trophy className="h-5 w-5" />} accent="cyan" />
        <StatCard label="Total spent" value={formatNumber((balances as any)?.total_spent_coins)} icon={<Gift className="h-5 w-5" />} accent="pink" />
      </div>

      <div className="mt-6 rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-6">
        <h3 className="text-xl font-black text-white">Support Performers</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Use Troll Coins to gift talent, support shows, and boost your favorite auditions.
        </p>
        <div className="mt-5">
          <NeonButton onClick={() => setShowCoinStore(true)} variant="primary">
            <Wallet className="h-4 w-4" />
            Add Coins
          </NeonButton>
        </div>
      </div>
    </PageShell>
  )

  const renderLeaderboard = () => (
    <PageShell eyebrow="Leaderboard" title="Top Talent" subtitle="Ranked by audition votes and community momentum.">
      <div className="space-y-3">
        {topAuditions.length > 0 ? (
          topAuditions.map((audition, index) => {
            const user = audition.user_profiles
            return (
              <div
                key={audition.id}
                className="flex items-center gap-4 rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-300/30 bg-yellow-400/10 text-xl font-black text-yellow-300">
                  #{index + 1}
                </div>

                <Avatar userId={audition.user_id} username={user?.username} avatarUrl={user?.avatar_url} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-white">{user?.username || 'Performer'}</p>
                  <p className="truncate text-sm text-slate-400">{audition.title || audition.category || 'Audition'}</p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-black text-cyan-300">{formatNumber(audition.vote_count)}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">votes</p>
                </div>
              </div>
            )
          })
        ) : (
          <EmptyState
            icon={<Trophy className="h-8 w-8" />}
            title="No leaderboard yet"
            body="Once users submit auditions and the community starts voting, rankings will appear here."
          />
        )}
      </div>
    </PageShell>
  )

  const renderProfile = () => (
    <PageShell eyebrow="Profile" title={profile?.username || 'Talent Profile'} subtitle="Your Troll City profile powers your MAI Talent identity.">
      <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar userId={profile?.id} username={profile?.username} avatarUrl={profile?.avatar_url} size="lg" />
          <div>
            <h2 className="text-3xl font-black text-white">{profile?.username || 'User'}</h2>
            <p className="mt-1 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">{profile?.role || 'user'}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{profile?.bio || 'No bio yet. Add one on your Troll City profile.'}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Coins" value={formatNumber(balances?.troll_coins)} icon={<Wallet className="h-5 w-5" />} accent="gold" />
          <StatCard label="XP" value={formatNumber((profile as any)?.xp)} icon={<Zap className="h-5 w-5" />} accent="cyan" />
          <StatCard label="Tier" value={(profile as any)?.tier || 'Bronze'} icon={<Crown className="h-5 w-5" />} accent="purple" />
          <StatCard label="Badge" value={(profile as any)?.badge || 'None'} icon={<Shield className="h-5 w-5" />} accent="green" />
        </div>
      </div>
    </PageShell>
  )

  const renderShows = () => (
    <PageShell eyebrow="Shows" title="Talent Shows" subtitle="Watch live shows, join the audition queue, or start your own show.">
      <div className="mb-6 flex flex-wrap gap-3">
        <NeonButton to="/mai-talent/show" variant="primary">
          <Play className="h-4 w-4" />
          Start Show
        </NeonButton>
        <NeonButton onClick={handleJoinQueue} disabled={joiningQueue} variant="secondary">
          <Mic className="h-4 w-4" />
          {joiningQueue ? 'Joining Queue...' : 'Join Audition Queue'}
        </NeonButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[...liveShows, ...upcomingShows].map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>

      {!liveShows.length && !upcomingShows.length && !loading && (
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title="No shows scheduled"
          body="All roles can start a show. Create the next talent arena and let users audition."
          action={
            <NeonButton to="/mai-talent/show">
              <PlusCircle className="h-4 w-4" />
              Start First Show
            </NeonButton>
          }
        />
      )}
    </PageShell>
  )

  const renderAuditions = () => (
    <PageShell
      eyebrow="Auditions"
      title="Community Auditions"
      subtitle="All Troll City users can audition. The community votes to push talent up the leaderboard."
    >
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Open auditions" value={auditions.length} icon={<Mic className="h-5 w-5" />} accent="cyan" />
        <StatCard
          label="Total votes"
          value={formatNumber(auditions.reduce((sum, audition) => sum + Number(audition.vote_count || 0), 0))}
          icon={<Star className="h-5 w-5" />}
          accent="gold"
        />
        <StatCard label="Categories" value={TALENT_CATEGORIES.length} icon={<Sparkles className="h-5 w-5" />} accent="purple" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {auditions.map((audition) => (
          <AuditionCard
            key={audition.id}
            audition={audition}
            currentUserId={profile?.id}
            voting={votingId === audition.id}
            onVote={() => handleVoteAudition(audition)}
          />
        ))}
      </div>

      {!auditions.length && !loading && (
        <EmptyState
          icon={<Mic className="h-8 w-8" />}
          title="No auditions yet"
          body="Once users submit auditions, voting cards will appear here. Start a show to open the first audition queue."
          action={
            <NeonButton to="/mai-talent/show">
              <Play className="h-4 w-4" />
              Start Auditions
            </NeonButton>
          }
        />
      )}
    </PageShell>
  )

  const renderJudgePanel = () => (
    <PageShell eyebrow="Judge" title="Judge Panel" subtitle="Every Troll City role can judge. Score auditions and help discover winners.">
      <div className="grid gap-4 lg:grid-cols-2">
        {auditions.slice(0, 10).map((audition) => (
          <div key={audition.id} className="rounded-3xl border border-purple-300/15 bg-slate-950/60 p-5">
            <div className="flex items-center gap-4">
              <Avatar userId={audition.user_id} username={audition.user_profiles?.username} avatarUrl={audition.user_profiles?.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black text-white">{audition.title || `${audition.user_profiles?.username || 'User'} Audition`}</p>
                <p className="text-sm text-slate-400">{audition.category || 'Talent'} · {formatNumber(audition.vote_count)} votes</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <JudgeScoreButton label="Yes" />
              <JudgeScoreButton label="Maybe" />
              <JudgeScoreButton label="No" />
            </div>
          </div>
        ))}
      </div>

      {!auditions.length && (
        <EmptyState
          icon={<Crown className="h-8 w-8" />}
          title="No auditions to judge"
          body="When users audition, judges can review and score them here."
        />
      )}
    </PageShell>
  )

  const renderShowStudio = () => (
    <PageShell
      eyebrow="Studio"
      title="Start a Talent Show"
      subtitle="All Troll City roles can host a show, assign judges, invite contestants, and open auditions."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-6 lg:col-span-2">
          <h3 className="text-2xl font-black text-white">Show Studio</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This page should connect to your live show creation logic. Keep the route and wire the existing broadcast/live room
            starter here so every role can start a talent show.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {TALENT_CATEGORIES.map((category) => (
              <div key={category.name} className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-300">
                  {category.icon}
                </div>
                <p className="font-black text-white">{category.name}</p>
                <p className="mt-1 text-sm text-slate-400">{category.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <NeonButton to="/mai-talent/show/new" variant="primary">
              <PlusCircle className="h-4 w-4" />
              Create Show
            </NeonButton>
            <NeonButton onClick={handleJoinQueue} disabled={joiningQueue} variant="secondary">
              <Mic className="h-4 w-4" />
              {joiningQueue ? 'Joining...' : 'Join Live Audition Queue'}
            </NeonButton>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-purple-300/15 bg-slate-950/60 p-6">
            <h3 className="text-xl font-black text-white">Access Rules</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li className="flex gap-2"><CheckCircle className="h-5 w-5 text-emerald-300" /> All roles can start a show.</li>
              <li className="flex gap-2"><CheckCircle className="h-5 w-5 text-emerald-300" /> All roles can be judges.</li>
              <li className="flex gap-2"><CheckCircle className="h-5 w-5 text-emerald-300" /> All Troll City users can audition.</li>
              <li className="flex gap-2"><CheckCircle className="h-5 w-5 text-emerald-300" /> Community voting decides momentum.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-yellow-300/15 bg-slate-950/60 p-6">
            <h3 className="text-xl font-black text-white">Next Show Countdown</h3>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <CountdownBox label="Hours" value={countdown.hours} />
              <CountdownBox label="Minutes" value={countdown.minutes} />
              <CountdownBox label="Seconds" value={countdown.seconds} />
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )

  const renderHome = () => (
    <>
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-[120px]" />
          <div className="absolute right-[-10rem] top-[8rem] h-[28rem] w-[28rem] rounded-full bg-purple-500/15 blur-[120px]" />
          <div className="absolute bottom-[-14rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-pink-500/10 blur-[130px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Sparkles className="h-4 w-4" />
                Troll City Talent Arena
              </div>

              <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                MAI Talent is now{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                  Troll City themed.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Start a show, judge performers, audition live, and vote for the next winner. Every Troll City user can
                audition, and every role can host or judge.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <NeonButton to="/mai-talent/show" variant="primary">
                  <Play className="h-5 w-5" />
                  Start Show
                </NeonButton>
                <NeonButton onClick={handleJoinQueue} disabled={joiningQueue} variant="secondary">
                  <Mic className="h-5 w-5" />
                  {joiningQueue ? 'Joining...' : 'Audition Now'}
                </NeonButton>
                <NeonButton to="/mai-talent/auditions" variant="ghost">
                  <Star className="h-5 w-5" />
                  Vote Auditions
                </NeonButton>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                <MiniStat label="Live shows" value={liveShows.length} />
                <MiniStat label="Auditions" value={auditions.length} />
                <MiniStat label="Your coins" value={formatNumber(balances?.troll_coins)} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/60 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-cyan-400/10 via-purple-500/10 to-pink-500/10 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Tonight</p>
                    <h2 className="mt-1 text-2xl font-black text-white">{liveShows[0]?.title || 'Open Talent Arena'}</h2>
                  </div>
                  <div className="rounded-full border border-pink-300/30 bg-pink-500/15 px-3 py-1 text-xs font-black text-pink-200">
                    {liveShows.length ? 'LIVE' : 'OPEN'}
                  </div>
                </div>

                <div className="grid gap-3">
                  {TALENT_CATEGORIES.slice(0, 4).map((category) => (
                    <div key={category.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-300">
                        {category.icon}
                      </div>
                      <div>
                        <p className="font-black text-white">{category.name}</p>
                        <p className="text-xs text-slate-400">{category.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-yellow-300/20 bg-yellow-400/10 p-4">
                  <p className="text-sm font-black text-yellow-200">Community vote is open</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Users vote on auditions. Judges can score talent, but community votes drive the leaderboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeSection title="Live Shows" icon={<Play className="h-6 w-6" />} action={<NeonButton to="/mai-talent/shows" variant="ghost">View All</NeonButton>}>
        <div className="grid gap-5 md:grid-cols-3">
          {liveShows.length || upcomingShows.length ? (
            [...liveShows, ...upcomingShows].slice(0, 6).map((show) => <ShowCard key={show.id} show={show} />)
          ) : (
            <div className="md:col-span-3">
              <EmptyState
                icon={<Play className="h-8 w-8" />}
                title="No shows yet"
                body="Start the first Troll City talent show and open auditions for everyone."
                action={
                  <NeonButton to="/mai-talent/show">
                    <PlusCircle className="h-4 w-4" />
                    Start Show
                  </NeonButton>
                }
              />
            </div>
          )}
        </div>
      </HomeSection>

      <HomeSection
        title="Auditions Open"
        icon={<Mic className="h-6 w-6" />}
        action={<NeonButton to="/mai-talent/auditions" variant="ghost">Vote Now</NeonButton>}
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {topAuditions.length ? (
            topAuditions.map((audition) => (
              <AuditionCard
                key={audition.id}
                audition={audition}
                currentUserId={profile?.id}
                voting={votingId === audition.id}
                onVote={() => handleVoteAudition(audition)}
              />
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState
                icon={<Star className="h-8 w-8" />}
                title="Voting opens when auditions are submitted"
                body="All Troll City users can audition once a show is live or an audition room is open."
                action={
                  <NeonButton onClick={handleJoinQueue} disabled={joiningQueue}>
                    <Mic className="h-4 w-4" />
                    {joiningQueue ? 'Joining...' : 'Audition Now'}
                  </NeonButton>
                }
              />
            </div>
          )}
        </div>
      </HomeSection>

      <HomeSection title="Trending Performers" icon={<Trophy className="h-6 w-6" />}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {performers.slice(0, 8).map((performer) => (
            <Link
              key={performer.id}
              to={`/mai-talent/profile/${performer.id}`}
              className="rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-5 text-center shadow-xl shadow-cyan-950/20 transition hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-cyan-400/5"
            >
              <Avatar userId={performer.id} username={performer.username} avatarUrl={performer.avatar_url} size="lg" centered />
              <p className="mt-4 truncate text-lg font-black text-white">{performer.username}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{performer.role || 'Performer'}</p>
            </Link>
          ))}

          {!performers.length && !loading && (
            <div className="sm:col-span-2 lg:col-span-4">
              <EmptyState icon={<Users className="h-8 w-8" />} title="No performers yet" body="Be the first performer in the arena." />
            </div>
          )}
        </div>
      </HomeSection>
    </>
  )

  const renderContent = () => {
    const path = location.pathname

    if (path.includes('/admin')) return renderAdmin()
    if (path.includes('/wallet')) return renderWallet()
    if (path.includes('/leaderboard')) return renderLeaderboard()
    if (path.includes('/profile')) return renderProfile()
    if (path.includes('/shows')) return renderShows()
    if (path.includes('/auditions')) return renderAuditions()
    if (path.includes('/judge')) return renderJudgePanel()
    if (path.includes('/show')) return renderShowStudio()

    return renderHome()
  }

  return (
    <MaiTalentLayout>
      <div className="min-h-screen bg-[#030712]">
        {renderContent()}

        {showCoinStore && <CoinStoreModal isOpen={showCoinStore} onClose={() => setShowCoinStore(false)} />}
      </div>
    </MaiTalentLayout>
  )
}

function PageShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <BackgroundGlow />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 max-w-3xl text-base leading-7 text-slate-400">{subtitle}</p>}
        </div>

        {children}
      </div>
    </section>
  )
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-[-12rem] top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="absolute right-[-10rem] top-[10rem] h-[28rem] w-[28rem] rounded-full bg-purple-500/15 blur-[120px]" />
      <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-pink-500/10 blur-[120px]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
    </div>
  )
}

function HomeSection({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-3 text-3xl font-black text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-300">
              {icon}
            </span>
            {title}
          </h2>
          {action}
        </div>
        {children}
      </div>
    </section>
  )
}

function ShowCard({ show }: { show: Show }) {
  const isLive = show.status === 'live'

  return (
    <div className="group overflow-hidden rounded-3xl border border-cyan-300/15 bg-slate-950/70 shadow-xl shadow-cyan-950/20 transition hover:-translate-y-1 hover:border-cyan-300/35">
      <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10">
        <Sparkles className="h-16 w-16 text-cyan-300/70" />
        <div
          className={cn(
            'absolute right-4 top-4 rounded-full border px-3 py-1 text-xs font-black',
            isLive ? 'border-pink-300/40 bg-pink-500/20 text-pink-100' : 'border-yellow-300/40 bg-yellow-400/15 text-yellow-100',
          )}
        >
          {isLive ? 'LIVE' : show.status?.toUpperCase() || 'SHOW'}
        </div>
      </div>

      <div className="p-5">
        <h3 className="truncate text-xl font-black text-white">{show.title || 'Talent Show'}</h3>
        <p className="mt-2 text-sm text-slate-400">
          {show.start_time ? new Date(show.start_time).toLocaleString() : 'Time TBD'}
        </p>
        <div className="mt-5">
          <NeonButton to={`/mai-talent/show/${show.id}`} variant={isLive ? 'danger' : 'primary'} className="w-full">
            {isLive ? <Eye className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            {isLive ? 'Watch Live' : 'View Show'}
          </NeonButton>
        </div>
      </div>
    </div>
  )
}

function AuditionCard({
  audition,
  currentUserId,
  voting,
  onVote,
}: {
  audition: Audition
  currentUserId?: string
  voting?: boolean
  onVote: () => void
}) {
  const user = audition.user_profiles
  const ownAudition = currentUserId === audition.user_id

  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 shadow-xl shadow-cyan-950/20 transition hover:border-cyan-300/35 hover:bg-cyan-400/5">
      <div className="flex items-center gap-4">
        <Avatar userId={audition.user_id} username={user?.username} avatarUrl={user?.avatar_url} />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-black text-white">{audition.title || `${user?.username || 'User'} Audition`}</h3>
          <p className="truncate text-sm text-slate-400">{user?.username || 'Performer'} · {audition.category || 'Talent'}</p>
        </div>

        <div className="rounded-2xl border border-yellow-300/25 bg-yellow-400/10 px-3 py-2 text-center">
          <p className="text-xl font-black text-yellow-300">{formatNumber(audition.vote_count)}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-100/70">votes</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          <Clock className="h-4 w-4" />
          {audition.created_at ? new Date(audition.created_at).toLocaleDateString() : 'Open'}
        </div>

        <NeonButton onClick={onVote} disabled={voting || ownAudition} variant={ownAudition ? 'ghost' : 'primary'} className="px-4 py-2">
          <Heart className="h-4 w-4" />
          {ownAudition ? 'Your Audition' : voting ? 'Voting...' : 'Vote'}
        </NeonButton>
      </div>
    </div>
  )
}

function Avatar({
  userId,
  username,
  avatarUrl,
  size = 'md',
  centered,
}: {
  userId?: string
  username?: string
  avatarUrl?: string
  size?: 'md' | 'lg'
  centered?: boolean
}) {
  const sizeClass = size === 'lg' ? 'h-24 w-24 rounded-3xl' : 'h-14 w-14 rounded-2xl'
  const initials = (username || 'U').slice(0, 2).toUpperCase()

  return (
    <div className={cn('shrink-0 overflow-hidden border border-cyan-300/30 bg-cyan-400/10', sizeClass, centered && 'mx-auto')}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={username || 'User'} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg font-black text-cyan-200">
          {initials || userId?.slice(0, 2).toUpperCase() || 'U'}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/60 p-4">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/80">{label}</p>
    </div>
  )
}

function CountdownBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-yellow-300/20 bg-yellow-400/10 p-3 text-center">
      <p className="text-2xl font-black text-yellow-200">{String(value).padStart(2, '0')}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-100/70">{label}</p>
    </div>
  )
}

function JudgeScoreButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-black text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-white"
    >
      {label}
    </button>
  )
}
