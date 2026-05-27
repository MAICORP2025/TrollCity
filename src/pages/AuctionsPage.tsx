import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Clock,
  Coins,
  Eye,
  Gavel,
  Play,
  Search,
  Trophy,
  Users,
  Video,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

interface AuctionShow {
  id: string
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_for: string | null
  live_started_at: string | null
  ended_at: string | null
  livekit_room_name: string | null
  is_featured: boolean
  auctioneer_id: string
  current_lot_id: string | null
  created_at: string
  current_lot?: {
    id: string
    title: string
    current_highest_bid: number
    starting_bid: number
    status: string
    countdown_end_at: string
  }
}

type TabType = 'live' | 'upcoming' | 'ended'

const panel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'

const card =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'

const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200'

const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white'

export default function AuctionsPage() {
  const navigate = useNavigate()

  const [auctions, setAuctions] = useState<AuctionShow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('live')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const fetchAuctions = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('auction_shows')
        .select('*')
        .not('status', 'eq', 'draft')
        .not('status', 'eq', 'cancelled')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(75)

      if (error) throw error

      setAuctions(data || [])
    } catch (error) {
      console.error('Error fetching auctions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAuctions()

    const interval = window.setInterval(fetchAuctions, 15000)
    return () => window.clearInterval(interval)
  }, [])

  const visibleAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      if (activeTab === 'live' && auction.status !== 'live') return false
      if (activeTab === 'upcoming' && auction.status !== 'scheduled') return false
      if (activeTab === 'ended' && auction.status !== 'ended') return false

      if (
        searchQuery.trim() &&
        !auction.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false
      }

      if (categoryFilter !== 'all' && auction.category !== categoryFilter) return false

      return true
    })
  }, [auctions, activeTab, searchQuery, categoryFilter])

  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(auctions.map((auction) => auction.category).filter(Boolean)))]
  }, [auctions])

  const liveCount = auctions.filter((auction) => auction.status === 'live').length
  const upcomingCount = auctions.filter((auction) => auction.status === 'scheduled').length
  const endedCount = auctions.filter((auction) => auction.status === 'ended').length
  const featured = auctions.find((auction) => auction.status === 'live' && auction.is_featured) || auctions.find((auction) => auction.status === 'live')

  return (
    <div className="relative min-h-screen bg-[#050714] px-4 pb-10 pt-24 text-white md:px-6 overflow-y-auto">
      <BackgroundFX />

      <main className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className={cn(panel, 'overflow-hidden')}>
          <div className="border-b border-cyan-300/15 bg-gradient-to-r from-cyan-950/30 via-slate-950 to-slate-950 p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <Gavel className="h-8 w-8 text-cyan-200" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                    Troll City Auction House
                  </p>
                  <h1 className="bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-100 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-5xl">
                    Live Auctions
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Official 24/7 auction floor powered by Troll City coins.
                  </p>
                </div>
              </div>

              <button onClick={() => navigate('/auctions/studio')} className={primary}>
                <Video className="h-4 w-4" />
                Auctioneer Studio
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3">
            <StatCard label="Live Now" value={liveCount} tone="red" />
            <StatCard label="Upcoming" value={upcomingCount} tone="cyan" />
            <StatCard label="Recently Ended" value={endedCount} tone="green" />
          </div>
        </header>

        {featured && activeTab === 'live' && (
          <section className={cn(panel, 'overflow-hidden p-4')}>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="relative aspect-video overflow-hidden rounded-[1.5rem] border border-cyan-300/15 bg-slate-900">
                {featured.thumbnail_url ? (
                  <img src={featured.thumbnail_url} alt={featured.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Gavel className="h-20 w-20 text-slate-600" />
                  </div>
                )}

                <div className="absolute left-4 top-4 rounded-xl bg-red-500 px-3 py-1.5 text-sm font-black uppercase text-white shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                  Live Featured
                </div>
              </div>

              <div className="flex flex-col justify-center p-2">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  Featured Auction
                </p>
                <h2 className="text-3xl font-black text-white">{featured.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-400">
                  {featured.description || 'Join this live auction and place bids in real time.'}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MiniMetric label="Category" value={featured.category || 'General'} />
                  <MiniMetric
                    label="Started"
                    value={
                      featured.live_started_at
                        ? new Date(featured.live_started_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Live'
                    }
                  />
                </div>

                <button onClick={() => navigate(`/auctions/${featured.id}`)} className={cn(primary, 'mt-5 w-fit')}>
                  <Play className="h-4 w-4" />
                  Enter Auction
                </button>
              </div>
            </div>
          </section>
        )}

        <section className={cn(panel, 'p-4')}>
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <TabButton active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Play className="h-4 w-4" />} label="Live Now" />
              <TabButton active={activeTab === 'upcoming'} onClick={() => setActiveTab('upcoming')} icon={<Calendar className="h-4 w-4" />} label="Upcoming" />
              <TabButton active={activeTab === 'ended'} onClick={() => setActiveTab('ended')} icon={<Trophy className="h-4 w-4" />} label="Recently Ended" />
            </div>

            <button onClick={() => void fetchAuctions()} className={secondary}>
              Refresh
            </button>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search official auction shows..."
                className="w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 py-3 pl-10 pr-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-cyan-300/20 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300/45"
            >
              {categories.map((category) => (
                <option key={category || 'all'} value={category || 'all'} className="bg-slate-950">
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <LoadingState />
          ) : visibleAuctions.length === 0 ? (
            <EmptyState activeTab={activeTab} setActiveTab={setActiveTab} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleAuctions.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  onOpen={() => navigate(`/auctions/${auction.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Minimum <span className="text-amber-200">5,000 coins</span> required to place bids.
              Review the item, current bid, and auctioneer terms before bidding.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function AuctionCard({ auction, onOpen }: { auction: AuctionShow; onOpen: () => void }) {
  const isLive = auction.status === 'live'
  const isScheduled = auction.status === 'scheduled'

  return (
    <article className={cn(card, 'group overflow-hidden transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:shadow-[0_0_34px_rgba(34,211,238,0.15)]')}>
      <div className="relative aspect-video bg-slate-900">
        {auction.thumbnail_url ? (
          <img src={auction.thumbnail_url} alt={auction.title} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gavel className="h-14 w-14 text-slate-600" />
          </div>
        )}

        <div className="absolute left-3 top-3">
          <StatusBadge status={auction.status} />
        </div>

        {auction.category && (
          <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur-xl">
            {auction.category}
          </div>
        )}

        {auction.is_featured && (
          <div className="absolute right-3 top-3 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100 backdrop-blur-xl">
            Featured
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="line-clamp-1 text-xl font-black text-white group-hover:text-cyan-200">
          {auction.title}
        </h3>

        {auction.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
            {auction.description}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {isLive && (
            <InfoLine
              icon={<Clock className="h-4 w-4" />}
              text={
                auction.live_started_at
                  ? `Started ${new Date(auction.live_started_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Live now'
              }
            />
          )}

          {isScheduled && auction.scheduled_for && (
            <InfoLine
              icon={<Calendar className="h-4 w-4" />}
              text={new Date(auction.scheduled_for).toLocaleString()}
            />
          )}

          {auction.ended_at && (
            <InfoLine
              icon={<Trophy className="h-4 w-4" />}
              text={`Ended ${new Date(auction.ended_at).toLocaleDateString()}`}
            />
          )}

          {auction.current_lot && (
            <InfoLine
              icon={<Coins className="h-4 w-4" />}
              text={`Current lot: ${auction.current_lot.title}`}
            />
          )}
        </div>

        <button onClick={onOpen} className={cn(isLive ? primary : secondary, 'mt-5 w-full')}>
          {isLive ? (
            <>
              <Play className="h-4 w-4" />
              Join Live Auction
            </>
          ) : (
            <>
              View Auction
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </article>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-red-500 px-3 py-1.5 text-xs font-black uppercase text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        Live
      </span>
    )
  }

  if (status === 'scheduled') {
    return (
      <span className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-black uppercase text-slate-950">
        Upcoming
      </span>
    )
  }

  return (
    <span className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-black uppercase text-slate-200">
      Ended
    </span>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'red' | 'cyan' | 'green' }) {
  return (
    <div className={cn(card, 'p-5 text-center')}>
      <p
        className={cn(
          'text-3xl font-black',
          tone === 'red' && 'text-red-300',
          tone === 'cyan' && 'text-cyan-200',
          tone === 'green' && 'text-emerald-300'
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  )
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition',
        active
          ? 'border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
          : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-cyan-300/25 hover:text-white'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function InfoLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="text-cyan-300">{icon}</span>
      <span className="line-clamp-1">{text}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center text-center">
      <div>
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/70">
          Loading Auctions
        </p>
      </div>
    </div>
  )
}

function EmptyState({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center text-center">
      <div>
        <Gavel className="mx-auto mb-4 h-16 w-16 text-slate-600" />
        <h3 className="text-xl font-black text-white">No auctions found</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          {activeTab === 'live'
            ? 'No live auctions are running right now. Check upcoming auctions.'
            : activeTab === 'upcoming'
              ? 'No auctions are scheduled yet.'
              : 'No ended auctions are available.'}
        </p>

        {activeTab === 'live' && (
          <button onClick={() => setActiveTab('upcoming')} className={cn(primary, 'mt-5')}>
            View Upcoming
          </button>
        )}
      </div>
    </div>
  )
}