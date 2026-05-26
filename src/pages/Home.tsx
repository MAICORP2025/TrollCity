
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { trollCityTheme } from '@/styles/trollCityTheme'
import TrollWallFeed from '@/components/home/TrollWallFeed'
import CityLawsFeesTab from '@/components/home/CityLawsFeesTab'
import LeaguesTab from '@/components/home/LeaguesTab'
import PresidentCandidatesTab from '@/components/home/PresidentCandidatesTab'
import LiveAuctionMiniWindow from '@/components/home/LiveAuctionMiniWindow'
import SupportGoalReminderModal from '@/components/SupportGoalReminderModal'
import { useSupportGoalReminder } from '@/hooks/useSupportGoalReminder'
import { Radio, Users, Play, Eye, X, ChevronRight, Link2, Sparkles, FileText, Trophy, Vote } from 'lucide-react'
import LevelSystemShowcase from '@/components/home/LevelSystemShowcase'

interface AuctionShow {
  id: string
  title: string
  description?: string | null
  category?: string | null
  thumbnail_url?: string | null
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_for?: string | null
  live_started_at?: string | null
  ended_at?: string | null
  livekit_room_name?: string | null
  auctioneer_id: string
  current_lot_id?: string | null
  hls_url?: string | null
  egress_id?: string | null
}

const PWAInstallPrompt = lazy(() => import('../components/PWAInstallPrompt'))
const TCNNPopupWidget = lazy(() => import('@/components/tcnn/TCNNPopupWidget'))
const FeaturedBroadcasts = lazy(() => import('@/components/broadcast/FeaturedBroadcasts'))
const PromoSlot = lazy(() => import('@/components/promo/PromoSlot'))

// Animated gradient background — multi-layer atmosphere for desktop
const AnimatedGradient = React.memo(() => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* ── LAYER 0: Deep base gradient ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

      {/* ── LAYER 1: Large animated colour blobs ── */}
      {/* Left-side purple / cyan drift */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-[140px] animate-bg-drift-1"
        style={{
          left: '-8%',
          top: '5%',
          background: 'radial-gradient(circle, rgba(147,51,234,0.28) 0%, rgba(34,211,238,0.10) 50%, transparent 70%)',
        }}
      />
      {/* Right-top blue / pink drift */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[130px] animate-bg-drift-2"
        style={{
          right: '-4%',
          top: '-2%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.22) 0%, rgba(236,72,153,0.12) 50%, transparent 70%)',
        }}
      />
      {/* Bottom-right pink / purple drift */}
      <div
        className="absolute w-[550px] h-[550px] rounded-full blur-[150px] animate-bg-drift-3"
        style={{
          right: '-6%',
          bottom: '-8%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.20) 0%, rgba(147,51,234,0.15) 50%, transparent 70%)',
        }}
      />
      {/* Bottom-left cyan accent */}
      <div
        className="absolute w-[450px] h-[450px] rounded-full blur-[120px] animate-bg-drift-4"
        style={{
          left: '15%',
          bottom: '-5%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.14) 0%, rgba(109,40,217,0.08) 50%, transparent 70%)',
        }}
      />

      {/* ── LAYER 2: Static radial glow under key content zones ── */}
      {/* Glow behind the left / main content feed */}
      <div
        className="absolute bg-[radial-gradient(ellipse_at_60%_50%,rgba(109,40,217,0.10)_0%,transparent_60%)]"
        style={{ top: '18%', left: '8%', width: '80%', height: '72%' }}
      />
      {/* Glow behind the sidebar / right-side area */}
      <div
        className="absolute bg-[radial-gradient(ellipse_at_50%_30%,rgba(6,182,212,0.07)_0%,transparent_55%)]"
        style={{ top: '16%', left: '55%', width: '48%', height: '68%' }}
      />
      {/* Glow behind the top tab bar / ad band */}
      <div
        className="absolute bg-[radial-gradient(ellipse_at_50%_10%,rgba(147,51,234,0.14)_0%,transparent_55%)]"
        style={{ top: '0%', left: '10%', width: '80%', height: '30%' }}
      />

      {/* ── LAYER 3: Vignette — soft edge darkening at all four corners ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,6,23,0.55)_100%)]" />
      {/* Per-corner vignette patches for a more organic fade */}
      <div className="absolute -top-32 -left-32 w-[440px] h-[440px] bg-[radial-gradient(circle,rgba(0,0,0,0.45),transparent_65%)] pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-[360px] h-[360px] bg-[radial-gradient(circle,rgba(0,0,0,0.40),transparent_65%)] pointer-events-none" />
      <div className="absolute -bottom-36 -left-36 w-[480px] h-[480px] bg-[radial-gradient(circle,rgba(0,0,0,0.50),transparent_65%)] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[440px] h-[440px] bg-[radial-gradient(circle,rgba(0,0,0,0.45),transparent_65%)] pointer-events-none" />

      {/* ── LAYER 4: Low-opacity grid texture ── */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(109,40,217,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,0.055)_1px,transparent_1px)] bg-[length:56px_56px]"
        style={{ maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.35), transparent 75%)', WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.35), transparent 75%)' }}
      />

      {/* ── LAYER 5: Atmospheric digital haze ── */}
      {/* A thin, barely-there vertical shimmer across the upper-left */}
      <div
        className="absolute w-px left-[22%] top-0 h-full opacity-[0.12]"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(147,51,234,0.35) 25%, rgba(6,182,212,0.25) 60%, transparent 100%)',
        }}
      />
      <div
        className="absolute w-px left-[78%] top-0 h-full opacity-[0.08]"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(236,72,153,0.30) 35%, rgba(109,40,217,0.20) 65%, transparent 100%)',
        }}
      />
      {/* Very faint diagonal digital haze */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          background:
            'linear-gradient(138deg, rgba(6,182,212,0.12) 0%, transparent 35%), linear-gradient(248deg, rgba(147,51,234,0.10) 0%, transparent 40%), linear-gradient(58deg, rgba(236,72,153,0.08) 0%, transparent 45%)',
        }}
      />

      {/* ── LAYER 6: Glass-panel stage — sits under the main content area ── */}
      {/* Provides the "anchor glass" feel behind the feed without competing with posts */}
      <div className="absolute left-0 right-0 top-[15%] mx-auto w-full max-w-[1300px] h-[78%] pointer-events-none" style={{ zIndex: 1 }}>
        <div className="glass-panel h-full rounded-3xl" />
      </div>

      {/* ── LAYER 7: Content-zone glow cushions ── */}
      {/* Soft coloured orb that sits behind central feed for depth */}
      <div
        className="absolute rounded-full blur-[90px] opacity-[0.12]"
        style={{
          width: '420px',
          height: '420px',
          left: '6%',
          top: '32%',
          background: 'radial-gradient(circle, rgba(147,51,234,0.6) 0%, transparent 70%)',
        }}
      />
      {/* Soft orb behind sidebar / right column */}
      <div
        className="absolute rounded-full blur-[100px] opacity-[0.10]"
        style={{
          width: '380px',
          height: '380px',
          left: '58%',
          top: '20%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.55) 0%, transparent 70%)',
        }}
      />

      {/* ── LAYER 8: Falling coin sprites ── */}
      {/* Gold TC coins — top-right cluster */}
      {Array.from({ length: 6 }).map((_, i) => (
        <CoinSprite
          key={`gc-${i}`}
          color="gold"
          delayMs={i * 1400}
          startX={62 + i * 4.8}
          size={8 + (i % 3)}
        />
      ))}
      {/* Green jail-free coins — bottom-left cluster */}
      {Array.from({ length: 5 }).map((_, i) => (
        <CoinSprite
          key={`jc-${i}`}
          color="green"
          delayMs={i * 1600 + 700}
          startX={10 + i * 7}
          size={7 + (i % 3)}
        />
      ))}
    </div>
  );
});
AnimatedGradient.displayName = 'AnimatedGradient'

// ─── falling coin sprite component ───
function CoinSprite({
  color,
  delayMs,
  startX,
  size,
}: {
  color: 'gold' | 'green'
  delayMs: number
  startX: number
  size: number
}) {
  const goldBase =
    'radial-gradient(circle at 35% 35%, #fff8c4 0%, #fde68a 30%, #f59e0b 65%, #b45309 100%)'
  const greenBase =
    'radial-gradient(circle at 35% 35%, #d1fae5 0%, #6ee7b7 30%, #10b981 65%, #065f46 100%)'
  return (
    <div
      className="absolute rounded-full opacity-0"
      style={{
        left: `${startX}%`,
        top: '-16px',
        width: `${size}px`,
        height: `${size}px`,
        background: color === 'gold' ? goldBase : greenBase,
        boxShadow:
          color === 'gold'
            ? '0 0 6px rgba(245,158,11,0.55), 0 0 14px rgba(245,158,11,0.25)'
            : '0 0 6px rgba(16,185,129,0.55), 0 0 14px rgba(16,185,129,0.25)',
        animation: `coin-fall${color === 'gold' ? '-gold' : '-green'} ${14 + Math.random() * 6}s ease-in ${delayMs}ms infinite`,
      }}
    />
  );
}



interface LiveItem {
  id: string
  title: string
  type: 'stream' | 'podcast'
  viewerCount: number
  streamerName: string
  streamerAvatar: string | null
  isFeatured?: boolean
  isBattle?: boolean
  battleFormat?: string
  battleStatus?: string
}

type TabType = 'live' | 'wall' | 'universe' | 'laws-fees' | 'leagues' | 'president'

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const [activeTab, setActiveTab] = useState<TabType>('wall')
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [totalViewers, setTotalViewers] = useState(0)
  const [loadingLive, setLoadingLive] = useState(true)
  const [showLiveGrid, setShowLiveGrid] = useState<boolean | null>(null)
  const [liveAuctions, setLiveAuctions] = useState<AuctionShow[]>([])
  const [loadingLiveAuctions, setLoadingLiveAuctions] = useState(false)
  const [supportGoalReminder, setSupportGoalReminder] = useState<any>(null)
  const [reminderLoading, setReminderLoading] = useState(false)

  // Support goal reminder hook
  const { reminder: supportReminder, loading: reminderLoadingState, error: reminderError, refetch: fetchSupportReminder } = useSupportGoalReminder()

  // Wait for auth to load before rendering
  // Auto-scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Fetch support goal reminder when user loads
  useEffect(() => {
    if (user?.id) {
      // The hook already fetches on mount, but we can refetch if needed
      // fetchSupportReminder() // Already called by hook
    }
  }, [user?.id, fetchSupportReminder])

  // Update local state from hook
  useEffect(() => {
    setSupportGoalReminder(supportReminder);
    setReminderLoading(reminderLoadingState);
  }, [supportReminder, reminderLoadingState])

    // Fetch live streams and podcasts
    useEffect(() => {
      let mounted = true

      const fetchLiveContent = async () => {
        try {
          // Fetch live streams with featured status
          // Note: Fetch without broadcaster_id join due to ambiguous relationship in DB schema
          const { data: streamsData, error: streamsError } = await supabase
            .from('streams')
            .select(`
              id,
              title,
              current_viewers,
              viewer_count,
              is_featured,
              battle_mode,
              battle_format,
              battle_status,
              broadcaster_id
            `)
            .eq('is_live', true)
            .order('is_featured', { ascending: false })
            .order('current_viewers', { ascending: false })
            .limit(100)

          if (streamsError) throw streamsError

          // Fetch broadcaster info separately
          const broadcasterIds = Array.from(new Set((streamsData || []).map((s: any) => s.broadcaster_id).filter(Boolean)))
          let broadcasterMap = new Map<string, any>()
          
          if (broadcasterIds.length > 0) {
            const { data: broadcasters, error: broadcasterError } = await supabase
              .from('user_profiles')
              .select('id, username, avatar_url')
              .in('id', broadcasterIds)
            
            if (!broadcasterError && broadcasters) {
              broadcasterMap = new Map(broadcasters.map((b: any) => [b.id, b]))
            }
          }

          if (mounted) {
            const streams: LiveItem[] = (streamsData || []).map((stream: any) => {
              const broadcaster = broadcasterMap.get(stream.broadcaster_id)
              return {
                id: stream.id,
                title: stream.title || 'Untitled Stream',
                type: 'stream',
                viewerCount: stream.current_viewers || stream.viewer_count || 0,
                streamerName: broadcaster?.username || 'Unknown',
                streamerAvatar: broadcaster?.avatar_url || null,
                isFeatured: stream.is_featured || false,
                isBattle: stream.battle_mode === 'universal',
                battleFormat: stream.battle_format,
                battleStatus: stream.battle_status,
              }
            })

            setLiveItems(streams)
            setTotalViewers(streams.reduce((sum, item) => sum + item.viewerCount, 0))
          }
        } catch (err) {
          console.error('Error fetching live content:', err)
        } finally {
          if (mounted) setLoadingLive(false)
        }
      }

      fetchLiveContent()
      
      // Poll every 60 seconds (reduced from 30s to lower server load)
      const interval = setInterval(fetchLiveContent, 60000)

      return () => {
        mounted = false
        clearInterval(interval)
      }
    }, [])

    // Fetch live auctions
    useEffect(() => {
      let mounted = true

      const fetchLiveAuctions = async () => {
        setLoadingLiveAuctions(true)
        try {
          const { data, error } = await supabase
            .from('auction_shows')
            .select('*')
            .eq('status', 'live')
            .order('live_started_at', { ascending: false })
            .limit(1)

          if (error) throw error
          if (mounted) {
            setLiveAuctions(data || [])
          }
        } catch (err) {
          console.error('Error fetching live auctions:', err)
        } finally {
          if (mounted) setLoadingLiveAuctions(false)
        }
      }

      fetchLiveAuctions()

      // Poll every 30 seconds for live auction updates
      const interval = setInterval(fetchLiveAuctions, 30000)

      return () => {
        mounted = false
        clearInterval(interval)
      }
    }, [])

  const requireAuth = useCallback(
    (intent?: string) => {
      if (user) return true
      toast.info(`Sign in to ${intent || 'continue'}.`)
      navigate('/auth')
      return false
    },
    [navigate, user]
  )

  const handleLiveItemClick = (item: LiveItem) => {
    navigate(`/watch/${item.id}`)
  }

   return (
     <div className={`relative h-dvh flex flex-col overflow-hidden ${trollCityTheme.backgrounds.primary}`}>
       {/* Loading Overlay — appears during auth init without unmounting content */}
       {isLoading && (
         <div className="fixed inset-0 flex items-center justify-center bg-[#0A0814]/80 backdrop-blur-sm z-50">
           <div className="text-center">
             <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
             <p className="text-slate-400">Loading Troll City...</p>
           </div>
         </div>
       )}

      {/* TCNN Popup - Only shows when TCNN is live */}
      <Suspense fallback={null}>
        <TCNNPopupWidget onRequireAuth={requireAuth} />
      </Suspense>

      {/* Animated Background */}
      <AnimatedGradient />

      {/* PWA Install Prompt - Only on Landing Page */}
      <Suspense fallback={null}>
        <PWAInstallPrompt />
      </Suspense>

{/* Content */}
        {/* Content-stage wrapper — glass panel that sits behind the centred content to reinforce the "dashboard" depth */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0 px-3 md:px-5 pt-2 pb-1 safe-top home-content-stage">
          <div
            className="max-w-7xl mx-auto flex flex-col flex-1 min-h-0 w-full home-inner-stage"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
              borderRadius: '1.5rem',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 48px rgba(0,0,0,0.25), 0 2px 12px rgba(147,51,234,0.04)',
            }}
          >
          {/* Header with Tabs */}
          <section 
            className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-2 flex-shrink-0`}
          >
            {/* Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              <button
                onClick={() => setActiveTab('wall')}
                className={`px-2 py-1 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                  activeTab === 'wall'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Troll Feed
              </button>
              <button
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                  activeTab === 'live'
                    ? 'bg-red-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                Live Now
                {liveItems.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
                    {liveItems.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('universe')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                  activeTab === 'universe'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Universe
                {liveItems.filter(i => i.isBattle).length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-yellow-500 text-white text-[10px] rounded-full">
                    {liveItems.filter(i => i.isBattle).length}
                  </span>
                )}
              </button>
                <button
                 onClick={() => setActiveTab('laws-fees')}
                 className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                   activeTab === 'laws-fees'
                     ? 'bg-cyan-600 text-white'
                     : 'bg-white/5 text-slate-400 hover:bg-white/10'
                 }`}
               >
                 <FileText className="w-3.5 h-3.5" />
                 City Laws & Fees
               </button>
               <button
                 onClick={() => setActiveTab('leagues')}
                 className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                   activeTab === 'leagues'
                     ? 'bg-purple-600 text-white'
                     : 'bg-white/5 text-slate-400 hover:bg-white/10'
                 }`}
               >
                 <Trophy className="w-3.5 h-3.5" />
                 Leagues
               </button>
               <button
                 onClick={() => setActiveTab('president')}
                 className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                   activeTab === 'president'
                     ? 'bg-amber-600 text-white'
                     : 'bg-white/5 text-slate-400 hover:bg-white/10'
                 }`}
               >
                 <Vote className="w-3.5 h-3.5" />
                 President Candidates
               </button>
            </div>

            {/* Tab Content - Live */}
            {activeTab === 'live' && (
              <div className="mt-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-white">{liveItems.length} Broadcasting</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Eye className="w-3 h-3" />
                    <span>{totalViewers.toLocaleString()} watching now</span>
                  </div>
                </div>

                {liveItems.filter(item => item.isFeatured).length > 0 && (
                  <div className="mb-2">
                    <Suspense fallback={<div className="aspect-video bg-white/5 rounded-xl animate-pulse" />}>
                      <FeaturedBroadcasts />
                    </Suspense>
                  </div>
                )}

                {liveItems.length > 0 && (
                  <button
                    onClick={() => setShowLiveGrid(showLiveGrid === null ? false : !showLiveGrid)}
                    className={`w-full py-2 ${trollCityTheme.gradients.primary} rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity`}
                  >
                    {(showLiveGrid ?? true) ? 'Hide Broadcasts' : 'Show Broadcasts'}
                    <ChevronRight className={`w-4 h-4 transition-transform ${(showLiveGrid ?? true) ? 'rotate-90' : ''}`} />
                  </button>
                )}

                {(showLiveGrid ?? true) && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {loadingLive ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-[4/3] bg-white/5 rounded-xl animate-pulse" />
                      ))
                    ) : liveItems.length === 0 ? (
                      <div className="col-span-full text-center py-4">
                        <Radio className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                        <p className="text-slate-400 text-xs">No one is live right now</p>
                      </div>
                    ) : (
                      liveItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleLiveItemClick(item)}
                          className="relative aspect-[4/3] bg-slate-800 rounded-xl overflow-hidden cursor-pointer group hover:ring-2 hover:ring-cyan-400/50 transition-all"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 to-pink-900/30 flex items-center justify-center">
                            {item.streamerAvatar ? (
                              <img src={item.streamerAvatar} alt={item.streamerName} className="w-full h-full object-cover" />
                            ) : (
                              <Play className="w-10 h-10 text-white/30" />
                            )}
                          </div>
                          {item.isFeatured && (
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded flex items-center gap-1">
                              FEATURED
                            </div>
                          )}
                          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-red-600 rounded">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-white">LIVE</span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-white font-medium text-xs truncate">{item.title}</p>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-slate-300 text-[10px] truncate">{item.streamerName}</p>
                              <div className="flex items-center gap-1 text-slate-300 text-[10px]">
                                <Users className="w-2.5 h-2.5" />
                                {item.viewerCount}
                              </div>
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center">
                              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab Content - Universe (Universal Battle) */}
            {activeTab === 'universe' && (
              <div className="mt-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-white">
                      {liveItems.filter(i => i.isBattle).length} Universal Battles
                    </span>
                  </div>
                </div>

{liveItems.filter(i => i.isBattle).length === 0 ? (
                   <div className="text-center py-8">
                     <Sparkles className="w-12 h-12 text-yellow-600 mx-auto mb-2" />
                     <p className="text-slate-400 text-sm">No Universal Battles active</p>
                     <p className="text-slate-500 text-xs mt-1">Start a battle from your live stream!</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                     {liveItems.filter(i => i.isBattle).map((item) => (
                       <div
                         key={item.id}
                         onClick={() => handleLiveItemClick(item)}
                         className="relative bg-gradient-to-br from-yellow-900/40 to-orange-900/40 rounded-xl overflow-hidden cursor-pointer group hover:ring-2 hover:ring-yellow-400/50 transition-all p-3"
                       >
                           <div className="flex items-center gap-2 mb-1">
                             <span className="px-2 py-0.5 bg-yellow-600 text-white text-[10px] font-bold rounded-full">
                               {item.battleFormat?.toUpperCase() || 'BATTLE'}
                             </span>
                             <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                               item.battleStatus === 'active' ? 'bg-red-600 text-white animate-pulse' :
                               item.battleStatus === 'ready' ? 'bg-green-600 text-white' :
                               'bg-yellow-600 text-white'
                             }`}>
                               {item.battleStatus === 'waiting' ? 'Waiting' :
                                item.battleStatus === 'ready' ? 'Ready' :
                                item.battleStatus === 'active' ? 'In Battle' : 'Ended'}
                             </span>
                           </div>
                           <p className="text-white font-medium text-sm truncate">{item.title}</p>
                           <div className="flex items-center gap-2 mt-1">
                             <span className="text-yellow-400 text-xs">{item.streamerName}</span>
                             <span className="text-slate-400 text-xs">•</span>
                             <Eye className="w-3 h-3 text-slate-400" />
                             <span className="text-slate-400 text-xs">{item.viewerCount}</span>
                           </div>
                          </div>
                      ))}
                   </div>
                 )}
               </div>
             )}

              {/* Tab Content - City Laws & Fees */}
              {activeTab === 'laws-fees' && (
                <div className="mt-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                    </div>
                  }>
                    <CityLawsFeesTab />
                  </Suspense>
                </div>
              )}
              
              {/* Tab Content - Leagues */}
              {activeTab === 'leagues' && (
                <div className="mt-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" />
                    </div>
                  }>
                    <LeaguesTab />
                  </Suspense>
                </div>
              )}
              
              {/* Tab Content - President Candidates */}
              {activeTab === 'president' && (
                <div className="mt-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                    </div>
                  }>
                    <PresidentCandidatesTab />
                  </Suspense>
                </div>
              )}
           </section>

           {/* Ad Banner - compact, hidden on mobile to save space */}
           <div className="hidden lg:block flex-shrink-0 mt-1">
             <Suspense fallback={null}>
               <PromoSlot placement="home_horizontal_banner" variant="horizontal" />
             </Suspense>
           </div>
           
             {/* Main Content Area */}
             <div className={`flex-1 min-h-0 mt-1 ${activeTab === 'wall' ? '' : 'hidden'}`}>
               <div className="grid grid-cols-1 md:grid-cols-12 lg:grid-cols-12 gap-3 h-full">
                 {liveAuctions.length > 0 ? (
                   <>
                     <div className="col-span-1 md:col-span-6 lg:col-span-8">
                       <TrollWallFeed onRequireAuth={requireAuth} feedClassName="md:col-span-12 lg:col-span-12" />
                     </div>
                     <div className="col-span-1 md:col-span-4 lg:col-span-2">
                       <LiveAuctionMiniWindow auction={liveAuctions[0]} onRequireAuth={requireAuth} />
                     </div>
                     <div className="hidden md:block md:col-span-2 lg:col-span-2 space-y-2">
                       <LevelSystemShowcase className="mb-4" />
                       <Suspense fallback={null}>
                         <PromoSlot placement="right_panel_featured" variant="featured" />
                       </Suspense>
                     </div>
                   </>
                 ) : (
                   <>
                     <div className="col-span-1 md:col-span-8 lg:col-span-10 min-h-0">
                       <TrollWallFeed onRequireAuth={requireAuth} feedClassName="md:col-span-12 lg:col-span-12" />
                     </div>
                     <div className="hidden md:block md:col-span-4 lg:col-span-2 space-y-2">
                       <LevelSystemShowcase className="mb-4" />
                       <Suspense fallback={null}>
                         <PromoSlot placement="right_panel_featured" variant="featured" />
                       </Suspense>
                     </div>
                   </>
                 )}
               </div>
             </div>
         </div>
         <div className="safe-bottom flex-shrink-0" />

           {/* Footer Links */}
         <div className="flex-shrink-0 px-4 py-6 bg-slate-950/80 border-t border-slate-800">
           <div className="max-w-7xl mx-auto">
             <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
               <Link to="/legal/terms" className="text-slate-400 hover:text-purple-400 transition-colors">Terms of Service</Link>
               <span className="text-slate-600">•</span>
               <Link to="/legal/privacy" className="text-slate-400 hover:text-purple-400 transition-colors">Privacy Policy</Link>
               <span className="text-slate-600">•</span>
               <Link to="/legal/safety" className="text-slate-400 hover:text-purple-400 transition-colors">Safety Guidelines</Link>
               <span className="text-slate-600">•</span>
               <Link to="/support" className="text-slate-400 hover:text-purple-400 transition-colors">Support</Link>
             </div>
             <div className="text-center mt-3 text-slate-500 text-xs">
               © 2026 Mai Troll City. All rights reserved.
             </div>
           </div>
         </div>
         
         {/* Support Goal Reminder Modal */}
         {supportGoalReminder && (
           <SupportGoalReminderModal
             isOpen={true}
             onClose={() => setSupportGoalReminder(null)}
             broadcaster={supportGoalReminder}
           />
         )}
       </div>
     </div>
   )
 }
