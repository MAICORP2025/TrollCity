import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { lazyWithRetry } from '@/utils/lazyImport'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BookOpen,
  FileText,
  Flame,
  Gavel,
  Gift,
  Heart,
  MessageCircle,
  Play,
  Radio,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import useSEO from '@/hooks/useSEO'
import { websiteSchema, organizationSchema } from '@/utils/seoSchemas'
import { useIsPwa } from '@/lib/hooks/useIsPwa'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLiveContent, type AuctionShow, type LiveItem } from '@/contexts/LiveContentContext'
import TrollWallFeed from '@/components/home/TrollWallFeed'
import CityLawsFeesTab from '@/components/home/CityLawsFeesTab'
import LeaguesTab from '@/components/home/LeaguesTab'
import PresidentCandidatesTab from '@/components/home/PresidentCandidatesTab'
import AcademyTab from '@/components/home/AcademyTab'
import LiveAuctionMiniWindow from '@/components/home/LiveAuctionMiniWindow'
import SupportGoalReminderModal from '@/components/SupportGoalReminderModal'
import { useSupportGoalReminder } from '@/hooks/useSupportGoalReminder'
import { usePresidentSystem } from '@/hooks/usePresidentSystem'
import LeftNavSidebar from '@/components/home/LeftNavSidebar'
import FeaturedBroadcastersRow from '@/components/home/FeaturedBroadcastersRow'
import HyTroGamingRow from '@/components/home/HyTroGamingRow'
import PodcastRow from '@/components/home/PodcastRow'
import NewStreamersRow from '@/components/home/NewStreamersRow'
import BestTrollersRow from '@/components/home/BestTrollersRow'
import PromoSlot from '@/components/promo/PromoSlot'
import PodcastCentral from '@/pages/PodcastCentral'

type TabType = 'wall' | 'live' | 'universe' | 'podcast' | 'laws-fees' | 'leagues' | 'president' | 'academy'

const PWAInstallPrompt = lazyWithRetry(() => import('../components/PWAInstallPrompt'))
const TCNNPopupWidget = lazyWithRetry(() => import('@/components/tcnn/TCNNPopupWidget'))
const FeaturedBroadcasts = lazyWithRetry(() => import('@/components/broadcast/FeaturedBroadcasts'))

const glass =
  'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]'
const neonCard =
  'border border-cyan-400/20 bg-[#071020]/80 backdrop-blur-2xl shadow-[0_0_28px_rgba(34,211,238,0.08)]'

const OriginalBackground = React.memo(() => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#050715]" />
      <div className="absolute inset-0 opacity-[0.20] [background:radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.25),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(14,165,233,0.20),transparent_30%),radial-gradient(circle_at_50%_92%,rgba(99,102,241,0.18),transparent_36%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.055)_1px,transparent_1px)] bg-[length:58px_58px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_26%,rgba(3,7,18,0.72)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#050715] via-[#050715]/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050715] via-[#050715]/70 to-transparent" />
    </div>
  )
})
OriginalBackground.displayName = 'OriginalBackground'

const LiveGrid = React.memo(function LiveGrid({
  liveItems,
  loadingLive,
  totalViewers,
  showLiveGrid,
  setShowLiveGrid,
  onClickItem,
}: {
  liveItems: LiveItem[]
  loadingLive: boolean
  totalViewers: number
  showLiveGrid: boolean | null
  setShowLiveGrid: (value: boolean | null) => void
  onClickItem: (item: LiveItem) => void
}) {
  const visible = showLiveGrid ?? true

  return (
    <div className="space-y-4">
      <div className={`${glass} rounded-2xl p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white">
              <Radio className="h-5 w-5 text-red-400" />
              Live Now
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {liveItems.length} broadcasting • {totalViewers.toLocaleString()} watching now
            </p>
          </div>
          {liveItems.length > 0 && (
            <button
              onClick={() => setShowLiveGrid(visible ? false : true)}
              className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-100"
            >
              {visible ? 'Hide Broadcasts' : 'Show Broadcasts'}
            </button>
          )}
        </div>

        <Suspense fallback={<div className="mt-4 aspect-video rounded-xl bg-white/5" />}>
          {liveItems.some((item) => item.isFeatured) && (
            <div className="mt-4">
              <FeaturedBroadcasts />
            </div>
          )}
        </Suspense>

        {visible && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {loadingLive ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/5" />
              ))
            ) : liveItems.length === 0 ? (
              <button
                onClick={() => {
                  if (user) {
                    navigate('/broadcast/setup')
                  } else {
                    toast.info('Sign in to start broadcasting.')
                    navigate('/auth')
                  }
                }}
                className="col-span-full rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/[0.04] py-12 text-center transition hover:border-cyan-400/50 hover:bg-cyan-500/[0.08] cursor-pointer"
              >
                <Radio className="mx-auto h-10 w-10 text-cyan-500/50" />
                <p className="mt-3 text-sm font-bold text-cyan-300/70">No one is live right now</p>
                <p className="mt-1 text-xs text-cyan-400/50">Click here to start your broadcast!</p>
              </button>
            ) : (
              liveItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onClickItem(item)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-left transition hover:border-cyan-300/60"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 via-slate-950 to-cyan-900/50" />
                  {item.type === 'auction' ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Gavel className="h-16 w-16 text-cyan-300/40" />
                    </div>
                  ) : item.streamerAvatar ? (
                    <img src={item.streamerAvatar} alt={item.streamerName} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                  ) : (
                    <Play className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-white/20" />
                  )}
                  <div className="absolute left-2 top-2 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white">LIVE</div>
                  <div className="absolute right-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-black text-white">
                    👁 {item.viewerCount}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-3">
                    <p className="truncate text-sm font-black text-white">{item.title}</p>
                    <p className="truncate text-xs font-bold text-slate-300">{item.streamerName}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
})

const BattleGrid = React.memo(function BattleGrid({ items, onClickItem }: { items: LiveItem[]; onClickItem: (item: LiveItem) => void }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <h2 className="flex items-center gap-2 text-xl font-black text-white">
        <Sparkles className="h-5 w-5 text-yellow-300" />
        Universal Battles
      </h2>
      <p className="mt-1 text-xs font-bold text-slate-400">{items.length} active battle streams</p>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-yellow-600" />
          <p className="mt-3 text-sm font-bold text-slate-400">No Universal Battles active</p>
          <p className="mt-1 text-xs text-slate-500">Start a battle from your live stream.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onClickItem(item)}
              className="rounded-2xl border border-yellow-300/20 bg-gradient-to-br from-yellow-900/35 to-orange-950/45 p-4 text-left transition hover:border-yellow-300/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-yellow-500 px-2 py-1 text-[10px] font-black text-black">
                  {item.battleFormat?.toUpperCase() || 'BATTLE'}
                </span>
                <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                  {item.battleStatus || 'active'}
                </span>
              </div>
              <p className="mt-3 truncate text-base font-black text-white">{item.title}</p>
              <p className="mt-1 text-xs font-bold text-yellow-200">
                {item.streamerName} • {item.viewerCount} viewers
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const isPwa = useIsPwa()
  const isMobile = useIsMobile()

  useSEO({
    title: 'Troll City | Social Streaming Platform - Livestream, Create, Connect',
    description: 'Troll City (Mai Troll City) is a social streaming platform for creators, streamers, gamers, and online communities. Watch live streams, go live, join creator battles, spin the Troll Wheel, and connect with a global community.',
    keywords: [
      'Troll City', 'Mai Troll City', 'social streaming platform', 'live streaming',
      'go live', 'content creator', 'stream games online', 'watch live streams',
      'creator economy', 'livestream', 'gaming community', 'online entertainment',
      'social platform', 'streaming app', 'live broadcast', 'creator battles',
      'online games', 'virtual community', 'trending streams', 'FYP'
    ],
    structuredData: [websiteSchema(), organizationSchema()]
  })

  const [activeTab, setActiveTab] = useState<TabType>('wall')
  const [showLiveGrid, setShowLiveGrid] = useState<boolean | null>(null)
  const [kickedReason, setKickedReason] = useState<string | null>(null)
  // Read tab query param on mount (e.g. from More panel navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam && ['wall', 'live', 'universe', 'laws-fees', 'leagues', 'president', 'academy'].includes(tabParam)) {
      setActiveTab(tabParam as TabType)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const kicked = params.get('kicked')
    if (kicked) {
      setKickedReason(kicked)
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const { liveItems, liveAuctions, totalViewers, loadingLive } = useLiveContent()
  const [supportGoalReminder, setSupportGoalReminder] = useState<any>(null)
  const [reminderLoading, setReminderLoading] = useState(false)

  const {
    reminder: supportReminder,
    loading: reminderLoadingState,
    refetch: fetchSupportReminder,
  } = useSupportGoalReminder()
  const { currentElection, currentPresident } = usePresidentSystem()

  const presidentTabLabel = currentElection?.status === 'open'
    ? 'President Candidates'
    : currentPresident
      ? 'President'
      : 'President Office'

  const battleItems = useMemo(() => liveItems.filter((item) => item.isBattle), [liveItems])

  const auctionItems = useMemo(() => liveAuctions.map((auction) => ({
    id: auction.id,
    title: auction.title || 'Untitled Auction',
    type: 'auction' as const,
    viewerCount: 0,
    streamerName: 'Auction',
    streamerAvatar: null,
    isFeatured: false,
    isBattle: false,
  })), [liveAuctions])

  const allLiveItems = useMemo(() => [...liveItems, ...auctionItems], [liveItems, auctionItems])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    setSupportGoalReminder(supportReminder)
    setReminderLoading(reminderLoadingState)
  }, [supportReminder, reminderLoadingState])

  useEffect(() => {
    if (isPwa && ['laws-fees', 'leagues', 'president', 'academy'].includes(activeTab)) {
      setActiveTab('wall')
    }
  }, [isPwa, activeTab])

  useEffect(() => {
    if (activeTab === 'president' && currentElection?.status !== 'open') {
      setActiveTab('wall')
    }
  }, [activeTab, currentElection?.status])

  const requireAuth = useCallback(
    (intent?: string) => {
      if (user) return true
      toast.info(`Sign in to ${intent || 'continue'}.`)
      navigate('/auth')
      return false
    },
    [navigate, user],
  )

const handleScrollItemClick = useCallback((id: string) => {
     navigate(`/watch/${id}`)
   }, [navigate])

   const showPresidentTab = currentElection?.status === 'open'

  return (
    <div className="relative min-h-full w-full overflow-hidden text-white">
      <OriginalBackground />

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050715]/85 backdrop-blur-md">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-purple-500/30 border-t-cyan-300" />
            <p className="text-sm font-bold text-slate-300">Loading Troll City...</p>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <TCNNPopupWidget onRequireAuth={requireAuth} />
      </Suspense>

      <Suspense fallback={null}>
        <PWAInstallPrompt />
      </Suspense>

      <main className="relative z-10 mx-auto flex w-full max-w-[1520px] flex-col gap-3 px-3 pb-8 pt-3 md:px-5">
        {kickedReason && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/60 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <X className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-300">You&apos;ve been kicked</p>
                <p className="text-xs text-red-400/80">{kickedReason}</p>
              </div>
            </div>
            <button
              onClick={() => setKickedReason(null)}
              className="shrink-0 rounded-lg p-1 text-red-400/60 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Sign In / Sign Up prompt for non-authenticated mobile/PWA users */}
        {!user && isMobile && (
          <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-purple-900/40 via-slate-900/60 to-cyan-900/40 backdrop-blur-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-bold text-white">Welcome to Troll City!</h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Sign in to join the community, go live, send gifts, and more.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate('/auth?mode=login')}
                  className="px-4 py-2 text-sm font-semibold text-slate-200 border border-white/15 rounded-xl hover:bg-white/10 transition-all duration-200"
                  type="button"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/auth?mode=signup')}
                  className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.25)] hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] transition-all duration-300 hover:scale-[1.03] active:scale-95 text-white"
                  type="button"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        )}

{activeTab === 'wall' && (
           <section className="flex gap-4">
             <LeftNavSidebar
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               liveCount={allLiveItems.length}
               battleCount={battleItems.length}
               followersLiveCount={0}
               presidentTabLabel={presidentTabLabel}
               showPresidentTab={showPresidentTab}
             />
             <div className="min-w-0 flex-1 space-y-4">
                <TrollWallFeed onRequireAuth={requireAuth} feedClassName="w-full" />
               <FeaturedBroadcastersRow onItemClick={handleScrollItemClick} />
               <PodcastRow />
               <HyTroGamingRow onItemClick={handleScrollItemClick} />
             </div>
             <aside className="hidden xl:flex xl:flex-col xl:gap-3 xl:w-[320px] xl:shrink-0 xl:sticky xl:top-3 xl:self-start">
               <PromoSlot placement="home_right_upper" variant="featured" />
               <PromoSlot placement="home_right_lower" variant="featured" />
             </aside>
           </section>
         )}

         {activeTab === 'live' && (
           <div className="flex gap-4">
             <LeftNavSidebar
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               liveCount={allLiveItems.length}
               battleCount={battleItems.length}
               followersLiveCount={0}
               presidentTabLabel={presidentTabLabel}
               showPresidentTab={showPresidentTab}
             />
             <div className="min-w-0 flex-1 space-y-4">
               <NewStreamersRow onClickItem={handleScrollItemClick} />
               <BestTrollersRow onClickItem={handleScrollItemClick} />
               <HyTroGamingRow onItemClick={handleScrollItemClick} />
             </div>
           </div>
         )}

{activeTab === 'universe' && (
            <div className="flex gap-4">
              <LeftNavSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                liveCount={allLiveItems.length}
                battleCount={battleItems.length}
                followersLiveCount={battleItems.length}
                presidentTabLabel={presidentTabLabel}
                showPresidentTab={showPresidentTab}
              />
              <div className="min-w-0 flex-1">
                <BattleGrid items={battleItems} onClickItem={handleScrollItemClick} />
              </div>
            </div>
          )}

         {activeTab === 'podcast' && (
           <div className="flex gap-4">
             <LeftNavSidebar
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               liveCount={allLiveItems.length}
               battleCount={battleItems.length}
               followersLiveCount={0}
               presidentTabLabel={presidentTabLabel}
               showPresidentTab={showPresidentTab}
             />
             <div className="min-w-0 flex-1">
               <section className={`${glass} rounded-2xl p-4`}>
                 <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" /></div>}>
                   <PodcastCentral />
                 </Suspense>
               </section>
             </div>
           </div>
         )}

         {activeTab === 'laws-fees' && (
           <div className="flex gap-4">
             <LeftNavSidebar
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               liveCount={allLiveItems.length}
               battleCount={battleItems.length}
               followersLiveCount={0}
               presidentTabLabel={presidentTabLabel}
               showPresidentTab={showPresidentTab}
             />
             <div className="min-w-0 flex-1">
               <section className={`${glass} rounded-2xl p-4`}>
                 <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" /></div>}>
                   <CityLawsFeesTab />
                 </Suspense>
               </section>
             </div>
           </div>
         )}

         {activeTab === 'leagues' && (
           <div className="flex gap-4">
             <LeftNavSidebar
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               liveCount={allLiveItems.length}
               battleCount={battleItems.length}
               followersLiveCount={0}
               presidentTabLabel={presidentTabLabel}
               showPresidentTab={showPresidentTab}
             />
             <div className="min-w-0 flex-1">
               <section className={`${glass} rounded-2xl p-4`}>
                 <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" /></div>}>
                   <LeaguesTab />
                 </Suspense>
               </section>
             </div>
           </div>
         )}

         {activeTab === 'president' && showPresidentTab && (
           <div className="flex gap-4">
             <LeftNavSidebar
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               liveCount={allLiveItems.length}
               battleCount={battleItems.length}
               followersLiveCount={0}
               presidentTabLabel={presidentTabLabel}
               showPresidentTab={showPresidentTab}
             />
             <div className="min-w-0 flex-1">
               <section className={`${glass} rounded-2xl p-4`}>
                 <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>}>
                   <PresidentCandidatesTab />
                 </Suspense>
               </section>
             </div>
           </div>
         )}

         {activeTab === 'academy' && (
           <div className="flex gap-4">
             <LeftNavSidebar
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               liveCount={allLiveItems.length}
               battleCount={battleItems.length}
               followersLiveCount={0}
               presidentTabLabel={presidentTabLabel}
               showPresidentTab={showPresidentTab}
             />
             <div className="min-w-0 flex-1">
               <AcademyTab />
             </div>
           </div>
         )}
      </main>

      {supportGoalReminder && !reminderLoading && (
        <SupportGoalReminderModal
          isOpen={true}
          onClose={() => setSupportGoalReminder(null)}
          broadcaster={supportGoalReminder}
        />
      )}
    </div>
  )
}