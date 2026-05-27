import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import CoinStoreModal from '@/components/broadcast/CoinStoreModal'
import { Play, Clock, Trophy, Star, Music, Mic, Zap, Gift, Users, Calendar, Sparkles, Home, Crown, Gauge, Wallet, UsersRound, Shield, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useSidebarStore } from '@/stores/useSidebarStore'
import { useCoins } from '@/lib/hooks/useCoins'

const COLORS = {
  black: '#050505',
  darkBlack: '#0d0d0d',
  gold: '#FFD54A',
  red: '#FF2D2D',
  orange: '#FF7A00',
  purple: '#9333ea',
}

interface Season {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
}

interface Show {
  id: string
  title: string
  status: string
  start_time: string
  host_id: string
}

interface Performer {
  id: string
  username: string
  avatar_url: string
  role?: string
}

const TALENT_CATEGORIES = [
  { icon: <Mic className="w-4 h-4" />, name: 'Sing' },
  { icon: <Music className="w-4 h-4" />, name: 'Dance' },
  { icon: <Zap className="w-4 h-4" />, name: 'Comedy' },
  { icon: <Music className="w-4 h-4" />, name: 'Music' },
]

const MT_ADMIN_ROLES = ['admin', 'lead_troll_officer', 'troll_officer', 'secretary', 'moderator']

function MaiTalentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore()
  const { balances } = useCoins()
  const navigate = useNavigate()
  const location = useLocation()
  const { setCollapsed } = useSidebarStore()
  
  const [mtSidebarCollapsed, setMtSidebarCollapsed] = useState(false)
  
  const isAdmin = profile?.role === 'admin' || profile?.is_admin || profile?.role === 'lead_troll_officer' || profile?.is_lead_officer
  const isHost = profile?.role === 'broadcaster' || profile?.is_broadcaster
  const isModerator = profile?.role === 'moderator' || MT_ADMIN_ROLES.includes(profile?.role || '')
  
  useEffect(() => {
    setCollapsed(true)
  }, [])
  
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')
  
  const mtPaths = ['/mai-talent']
  if (isAdmin) mtPaths.push('/mai-talent/admin')
  if (isHost) mtPaths.push('/mai-talent/host')
  mtPaths.push('/mai-talent/wallet')
  mtPaths.push('/mai-talent/shows')
  mtPaths.push('/mai-talent/leaderboard')
  
return (
    <div className="flex min-h-screen" style={{ backgroundColor: COLORS.black }}>
      <div className={`flex flex-col h-full max-h-screen bg-gradient-to-b from-[#1a0a1f] to-[#0d0510] backdrop-blur-2xl border-r border-pink-500/40 shadow transition-all duration-300 ${mtSidebarCollapsed ? 'w-20' : 'w-64'} fixed left-0 top-0 z-50`}>
         <div className="p-3 flex items-center justify-between border-b border-pink-500/20 bg-white/[0.02]">
           {!mtSidebarCollapsed && (
             <Link to="/mai-talent" className="flex items-center gap-2.5">
               <div className="w-9 h-9 bg-gradient-to-tr from-pink-600 via-purple-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                 <span className="text-xl font-bold text-white">M</span>
               </div>
               <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-white via-pink-200 to-pink-400">
                 Mai Talent
               </span>
             </Link>
           }
           <button
             onClick={() => setMtSidebarCollapsed(!mtSidebarCollapsed)}
             className={`p-2 hover:bg-white/[0.06] rounded-lg text-pink-300 hover:text-white transition-all duration-200 ${mtSidebarCollapsed ? 'mx-auto' : ''}`}
           >
             {mtSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
           </button>
         </div>
        
        <div className="flex-1 overflow-y-auto py-3 space-y-4 custom-scrollbar min-h-0">
          <div className={`px-4 mb-2 mt-2 ${mtSidebarCollapsed ? 'flex justify-center' : ''}`}>
            <Link
              to="/mai-talent/show"
              className={`relative group flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 via-pink-400 to-pink-600 hover:from-pink-500 hover:via-pink-300 hover:to-pink-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.5)] transition-all duration-300 hover:scale-[1.02] border border-pink-300/50 ${mtSidebarCollapsed ? 'w-10 h-10 p-0' : 'w-full py-3 px-4'}`}
            >
              <Play size={mtSidebarCollapsed ? 20 : 20} className="text-white" />
              {!mtSidebarCollapsed && <span className="uppercase tracking-wide text-sm">Go Live</span>}
            </Link>
          </div>
          
          <div className="px-4">
            <div className="text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-2">Main</div>
            <div className="space-y-1">
              <Link to="/mai-talent" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive('/mai-talent') && !location.pathname.includes('/admin') && !location.pathname.includes('/wallet') && !location.pathname.includes('/shows') ? 'bg-pink-500/20 text-pink-300' : 'text-pink-200 hover:bg-white/[0.04]'}`}>
                <Home size={18} />
                {!mtSidebarCollapsed && <span className="text-[13px]">Home</span>}
              </Link>
              <Link to="/mai-talent/shows" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive('/mai-talent/shows') ? 'bg-pink-500/20 text-pink-300' : 'text-pink-200 hover:bg-white/[0.04]'}`}>
                <Calendar size={18} />
                {!mtSidebarCollapsed && <span className="text-[13px]">Shows</span>}
              </Link>
              <Link to="/mai-talent/leaderboard" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive('/mai-talent/leaderboard') ? 'bg-pink-500/20 text-pink-300' : 'text-pink-200 hover:bg-white/[0.04]'}`}>
                <Trophy size={18} />
                {!mtSidebarCollapsed && <span className="text-[13px]">Leaderboard</span>}
              </Link>
            </div>
          </div>
          
          <div className="px-4">
            <div className="text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-2">Account</div>
            <div className="space-y-1">
              <Link to="/mai-talent/wallet" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive('/mai-talent/wallet') ? 'bg-pink-500/20 text-pink-300' : 'text-pink-200 hover:bg-white/[0.04]'}`}>
                <Wallet size={18} />
                {!mtSidebarCollapsed && <span className="text-[13px]">Wallet</span>}
              </Link>
              <Link to="/mai-talent/profile" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive('/mai-talent/profile') ? 'bg-pink-500/20 text-pink-300' : 'text-pink-200 hover:bg-white/[0.04]'}`}>
                <UsersRound size={18} />
                {!mtSidebarCollapsed && <span className="text-[13px]">Profile</span>}
              </Link>
            </div>
          </div>
          
          {(isAdmin || isModerator) && (
            <div className="px-4">
              <div className="text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-2">Admin</div>
              <div className="space-y-1">
                <Link to="/mai-talent/admin" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive('/mai-talent/admin') ? 'bg-pink-500/20 text-pink-300' : 'text-pink-200 hover:bg-white/[0.04]'}`}>
                  <Shield size={18} />
                  {!mtSidebarCollapsed && <span className="text-[13px]">Dashboard</span>}
                </Link>
                <Link to="/mai-talent/admin/users" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive('/mai-talent/admin/users') ? 'bg-pink-500/20 text-pink-300' : 'text-pink-200 hover:bg-white/[0.04]'}`}>
                  <Gauge size={18} />
                  {!mtSidebarCollapsed && <span className="text-[13px]">Manage Users</span>}
                </Link>
              </div>
            </div>
          )}
          
          {isHost && (
            <div className="px-4">
              <div className="text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-2">Broadcaster</div>
              <div className="space-y-1">
                <Link to="/mai-talent/host" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive('/mai-talent/host') ? 'bg-pink-500/20 text-pink-300' : 'text-pink-200 hover:bg-white/[0.04]'}`}>
                  <Crown size={18} />
                  {!mtSidebarCollapsed && <span className="text-[13px]">Host Console</span>}
                </Link>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-3 border-t border-pink-500/20">
          {!mtSidebarCollapsed && (
            <div className="flex items-center gap-2 px-2 py-2 bg-pink-500/10 rounded-lg mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{(profile?.username || 'U').substring(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{profile?.username || 'User'}</p>
                <p className="text-pink-300 text-xs">{balances?.trollCoins?.toLocaleString() || 0} Coins</p>
              </div>
            </div>
          )}
          <Link
            to="/"
            className={`flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-white/[0.04] text-pink-300 hover:text-white transition-all duration-200 ${mtSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} />
            {!mtSidebarCollapsed && <span className="text-[13px] font-medium">Exit to TrollCity</span>}
          </Link>
        </div>
      </div>
      
<div className={`flex-1 overflow-y-auto ${mtSidebarCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300`}>
         {children}
       </div>
    </div>
  )
}

export default function MaiTalent() {
  const { profile } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [liveShows, setLiveShows] = useState<Show[]>([])
  const [upcomingShows, setUpcomingShows] = useState<Show[]>([])
  const [performers, setPerformers] = useState<Performer[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningQueue, setJoiningQueue] = useState(false)
  const [showCoinStore, setShowCoinStore] = useState(false)
  const { balances } = useCoins()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [seasonsRes, showsRes, performersRes] = await Promise.all([
        supabase.from('mt_seasons').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('mt_shows').select('*').order('start_time', { ascending: true }).limit(5),
        supabase.from('user_profiles').select('id, username, avatar_url, role').limit(10)
      ])

      if (seasonsRes.data) {
        const activeSeason = seasonsRes.data.find(s => s.status === 'active')
        setSeasons(activeSeason ? [activeSeason] : seasonsRes.data.slice(0, 1))
      }

      if (showsRes.data) {
        const live = showsRes.data.filter(s => s.status === 'live')
        const upcoming = showsRes.data.filter(s => s.status === 'scheduled')
        setLiveShows(live)
        setUpcomingShows(upcoming)
      }

      if (performersRes.data) {
        setPerformers(performersRes.data)
      }
    } catch (err) {
      console.error('Error loading MaiTalent data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinQueue = async () => {
    if (!profile?.id) {
      navigate('/auth')
      return
    }

    setJoiningQueue(true)
    try {
      const liveShowId = liveShows[0]?.id
      
      if (!liveShowId) {
        alert('No live shows available. Check back soon!')
        setJoiningQueue(false)
        return
      }

      const { data: existingQueue } = await supabase
        .from('mt_show_queue')
        .select('*')
        .eq('show_id', liveShowId)
        .eq('user_id', profile.id)
        .maybeSingle()

      if (existingQueue) {
        alert('You are already in the queue!')
        setJoiningQueue(false)
        return
      }

      const { data: queueData } = await supabase
        .from('mt_show_queue')
        .select('position')
        .eq('show_id', liveShowId)
        .order('position', { ascending: false })
        .limit(1)

      const nextPosition = queueData && queueData.length > 0 ? queueData[0].position + 1 : 1

      const { error } = await supabase
        .from('mt_show_queue')
        .insert({
          show_id: liveShowId,
          user_id: profile.id,
          position: nextPosition,
          status: 'waiting'
        })

      if (error) throw error

      alert('You have been added to the queue! Wait for your turn to perform.')
    } catch (err) {
      console.error('Error joining queue:', err)
      alert('Failed to join queue. Please try again.')
    } finally {
      setJoiningQueue(false)
    }
  }

  const nextShow = upcomingShows[0]
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    if (!nextShow?.start_time) return
    
    const targetDate = new Date(nextShow.start_time).getTime()
    
    const updateCountdown = () => {
      const now = Date.now()
      const diff = targetDate - now
      
      if (diff > 0) {
        setCountdown({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        })
      }
    }
    
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [nextShow?.start_time])

  const renderContent = () => {
    const path = location.pathname
    
    if (path.includes('/admin')) {
      return (
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white mb-4">Admin Dashboard</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <h3 className="text-pink-400 font-bold mb-2">Total Users</h3>
              <p className="text-4xl font-bold text-white">--</p>
            </div>
            <div className="p-6 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <h3 className="text-pink-400 font-bold mb-2">Active Shows</h3>
              <p className="text-4xl font-bold text-white">{liveShows.length}</p>
            </div>
            <div className="p-6 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <h3 className="text-pink-400 font-bold mb-2">Total Gifts</h3>
              <p className="text-4xl font-bold text-white">--</p>
            </div>
          </div>
        </div>
      )
    }
    
    if (path.includes('/wallet')) {
      return (
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Wallet</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-6 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <p className="text-gray-400 mb-1">Available Coins</p>
              <p className="text-3xl font-bold text-yellow-400">{balances?.trollCoins?.toLocaleString() || 0}</p>
            </div>
            <div className="p-6 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <p className="text-gray-400 mb-1">Paid Coins</p>
              <p className="text-3xl font-bold text-green-400">{(balances as any)?.paid_coins?.toLocaleString() || 0}</p>
            </div>
            <div className="p-6 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <p className="text-gray-400 mb-1">Total Earned</p>
              <p className="text-3xl font-bold text-blue-400">{(balances as any)?.total_earned_coins?.toLocaleString() || 0}</p>
            </div>
            <div className="p-6 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <p className="text-gray-400 mb-1">Battle Crowns</p>
              <p className="text-3xl font-bold text-purple-400">{(balances as any)?.battle_crowns?.toLocaleString() || 0}</p>
            </div>
          </div>
          
          <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
            <p className="text-gray-400 mb-2">Spending History</p>
            <p className="text-sm text-gray-500">Total Spent: {(balances as any)?.total_spent_coins?.toLocaleString() || 0} coins</p>
          </div>
          
          <button onClick={() => setShowCoinStore(true)} className="w-full py-3 rounded-lg font-bold mt-6" style={{ backgroundColor: COLORS.purple, color: 'white' }}>Add Coins</button>
        </div>
      )
    }
    
    if (path.includes('/leaderboard')) {
      return (
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white mb-4">Leaderboard</h1>
          <div className="space-y-2">
            {performers.slice(0, 10).map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 p-4 rounded-lg" style={{ backgroundColor: COLORS.darkBlack }}>
                <span className="text-2xl font-bold text-pink-400 w-8">#{i + 1}</span>
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <img src={p.avatar_url || `https://i.pravatar.cc/150?u=${p.id}`} alt={p.username} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{p.username}</p>
                  <p className="text-sm text-gray-400">Points</p>
                </div>
                <span className="text-yellow-400 font-bold">--</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    
    if (path.includes('/profile')) {
      return (
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Profile</h1>
          
          <div className="flex items-center gap-6 mb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden" style={{ border: `3px solid ${COLORS.pink}` }}>
              <img src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${profile?.id}`} alt={profile?.username} className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{profile?.username || 'User'}</h2>
              <p className="text-pink-400">{profile?.role || 'user'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <p className="text-gray-400 text-sm">Coins</p>
              <p className="text-xl font-bold text-yellow-400">{balances?.trollCoins?.toLocaleString() || 0}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <p className="text-gray-400 text-sm">XP</p>
              <p className="text-xl font-bold text-blue-400">{(profile as any)?.xp || 0}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <p className="text-gray-400 text-sm">Tier</p>
              <p className="text-xl font-bold text-purple-400">{profile?.tier || 'Bronze'}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
              <p className="text-gray-400 text-sm">Badge</p>
              <p className="text-xl font-bold text-green-400">{profile?.badge || 'None'}</p>
            </div>
          </div>
          
          <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: COLORS.darkBlack }}>
            <p className="text-gray-400 mb-2">Bio</p>
            <p className="text-white">{profile?.bio || 'No bio yet'}</p>
          </div>
          
          <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.darkBlack }}>
            <p className="text-gray-400 mb-2">Stats</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">Total Earned</p>
                <p className="text-green-400">{((profile as any)?.total_earned_coins || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Total Spent</p>
                <p className="text-red-400">{((profile as any)?.total_spent_coins || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    if (path.includes('/shows')) {
      return (
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white mb-4">Shows</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveShows.concat(upcomingShows).map(show => (
              <div key={show.id} className="p-4 rounded-xl" style={{ backgroundColor: COLORS.darkBlack, border: `1px solid ${show.status === 'live' ? COLORS.red : COLORS.gold}` }}>
                <h3 className="font-bold text-white">{show.title || 'Show'}</h3>
                <p className="text-sm text-gray-400">{show.start_time ? new Date(show.start_time).toLocaleString() : 'TBD'}</p>
                <span className={`text-xs px-2 py-1 rounded ${show.status === 'live' ? 'bg-red-500' : 'bg-yellow-500'}`}>{show.status}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    
    return null
  }

  const renderHome = () => (
    <section 
      className="relative overflow-hidden"
      style={{ 
        paddingTop: '60px', 
        paddingBottom: '60px',
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(255, 122, 0, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 30% 20%, rgba(255, 213, 74, 0.1) 0%, transparent 40%),
          radial-gradient(ellipse at 70% 20%, rgba(255, 213, 74, 0.1) 0%, transparent 40%),
          ${COLORS.black}
        `
      }}
    >
      <div className="absolute top-0 left-1/4 w-64 h-full pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255, 213, 74, 0.15) 0%, transparent 100%)', filter: 'blur(20px)' }} />
      <div className="absolute top-0 right-1/4 w-64 h-full pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255, 213, 74, 0.15) 0%, transparent 100%)', filter: 'blur(20px)' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-full pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255, 122, 0, 0.2) 0%, transparent 100%)', filter: 'blur(30px)' }} />

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 
          className="text-5xl sm:text-6xl lg:text-7xl font-black mb-6 tracking-wider"
          style={{
            color: COLORS.gold,
            textShadow: `0 0 20px ${COLORS.gold}, 0 0 40px rgba(255, 213, 74, 0.5), 0 0 60px rgba(255, 213, 74, 0.3)`
          }}
        >
          MAITALENT
        </h1>

        <p className="text-xl sm:text-2xl text-gray-300 mb-6 max-w-2xl mx-auto">
          {`The World's First Live Interactive Talent Show`}
        </p>
        
        <div className="flex items-center justify-center gap-4 text-lg mb-6">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" style={{ color: COLORS.gold }} fill={COLORS.gold} />
            <span style={{ color: COLORS.gold }} className="font-bold">{balances?.trollCoins?.toLocaleString() || 0}</span>
            <span className="text-gray-400">Coins</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          <button
            onClick={handleJoinQueue}
            disabled={joiningQueue}
            className="group relative px-8 py-4 rounded-full text-lg font-bold flex items-center gap-3 transition-all duration-300 hover:scale-105 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${COLORS.red} 0%, #cc0000 100%)`,
              color: 'white',
              boxShadow: `0 0 20px rgba(255, 45, 45, 0.5), 0 0 40px rgba(255, 45, 45, 0.3)`
            }}
          >
            {joiningQueue ? <Play className="w-5 h-5 animate-pulse" /> : <Play className="w-5 h-5" fill="white" />}
            {joiningQueue ? 'JOINING...' : 'AUDITION NOW'}
          </button>

          <Link
            to={liveShows[0] ? `/mai-talent/show/${liveShows[0].id}` : '#'}
            className="group relative px-8 py-4 rounded-full text-lg font-bold flex items-center gap-3 transition-all duration-300 hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${COLORS.purple} 0%, #7c3aed 100%)`,
              color: 'white',
              boxShadow: `0 0 15px rgba(147, 51, 234, 0.4), 0 0 30px rgba(147, 51, 234, 0.2)`
            }}
          >
            <Play className="w-5 h-5" fill="white" />
            WATCH LIVE
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 text-lg mt-4">
          <Star className="w-5 h-5" style={{ color: COLORS.gold }} fill={COLORS.gold} />
          <span style={{ color: COLORS.gold }} className="font-bold">
            {loading ? '...' : liveShows.length > 0 ? liveShows.length : '0'}
          </span>
          <span className="text-gray-400">Live Shows Now</span>
        </div>
      </div>
    </section>
  )

  return (
<MaiTalentLayout>
       <div className="min-h-screen overflow-y-auto" style={{ backgroundColor: COLORS.black }}>
         {renderContent() || renderHome()}

        <section className="py-12 px-4" style={{ backgroundColor: COLORS.black }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3" style={{ color: 'white' }}>
              <span style={{ color: COLORS.orange }}>🔥</span>
              LIVE SHOWS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {liveShows.length === 0 && upcomingShows.length === 0 && !loading && (
                <div 
                  className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03]"
                  style={{
                    backgroundColor: COLORS.darkBlack,
                    border: `1px solid ${COLORS.gold}`,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <div className="relative h-40 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)' }}>
                    <span className="text-6xl">🎪</span>
                    <div className="absolute top-3 right-3 px-3 py-1 rounded text-xs font-bold flex items-center gap-1" style={{ backgroundColor: COLORS.orange, color: 'white' }}>
                      <Calendar className="w-3 h-3" />
                      COMING UP
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white mb-2">Next Show</h3>
                    <p className="text-sm text-gray-400 mb-2">Be the first to join!</p>
                    <Link to="/mai-talent/show" className="block w-full py-2 rounded-lg text-center font-bold transition-all duration-300 hover:scale-[1.02]" style={{ backgroundColor: COLORS.orange, color: 'white' }}>Join Show</Link>
                  </div>
                </div>
              )}

              {liveShows.map((show, index) => (
                <div key={show.id || index} className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03]" style={{ backgroundColor: COLORS.darkBlack, border: `1px solid ${COLORS.gold}`, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)' }}>
                  <div className="relative h-40 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)' }}>
                    <span className="text-6xl">🎭</span>
                    <div className="absolute top-3 right-3 px-3 py-1 rounded text-xs font-bold flex items-center gap-1" style={{ backgroundColor: COLORS.red, color: 'white', animation: 'pulse-live 2s infinite' }}>
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white mb-2">{show.title || 'Live Show'}</h3>
                    <p className="text-sm text-gray-400 mb-4">Tune in now!</p>
                    <Link to={`/mai-talent/show/${show.id}`} className="block w-full py-2 rounded-lg text-center font-bold transition-all duration-300 hover:scale-[1.02]" style={{ backgroundColor: COLORS.red, color: 'white' }}>Watch Live</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4" style={{ backgroundColor: COLORS.black }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3" style={{ color: 'white' }}>
                  <span style={{ color: COLORS.gold }}>⭐</span>
                  TRENDING PERFORMERS
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                  {performers.slice(0, 3).map((performer, index) => (
                    <Link key={performer.id || index} to={`/mai-talent/profile/${performer.id}`} className="group block">
                      <div className="rounded-xl p-6 text-center transition-all duration-300 hover:scale-[1.03]" style={{ backgroundColor: COLORS.darkBlack, border: `1px solid rgba(255, 213, 74, 0.3)`, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)' }}>
                        <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden" style={{ border: `3px solid ${COLORS.gold}`, boxShadow: `0 0 15px rgba(255, 213, 74, 0.3)` }}>
                          <img src={performer.avatar_url || `https://i.pravatar.cc/150?u=${performer.id}`} alt={performer.username} className="w-full h-full object-cover" />
                        </div>
                        <h3 className="text-lg font-bold text-white group-hover:text-gold transition-colors" style={{ color: COLORS.gold }}>{performer.username}</h3>
                        <p className="text-sm text-gray-400">Performer</p>
                      </div>
                    </Link>
                  ))}
                  {performers.length === 0 && !loading && (
                    <div className="col-span-3 text-center py-10 text-gray-400">
                      <Sparkles className="w-12 h-12 mx-auto mb-4" style={{ color: COLORS.gold }} />
                      <p>No performers yet. Be the first!</p>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <Link to="/mai-talent/show" className="inline-block px-8 py-3 rounded-full font-bold transition-all duration-300 hover:scale-105" style={{ backgroundColor: COLORS.red, color: 'white', boxShadow: `0 0 20px rgba(255, 45, 45, 0.4)` }}>
                    Audition Now
                  </Link>
                </div>
              </div>

              <div className="lg:w-80 flex-shrink-0 space-y-6">
                <div className="rounded-xl p-5" style={{ backgroundColor: COLORS.darkBlack, border: `1px solid rgba(255, 213, 74, 0.3)`, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)' }}>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: COLORS.gold }}>
                    <Clock className="w-5 h-5" />
                    UPCOMING SHOWS
                  </h3>
                  <div className="space-y-3">
                    {upcomingShows.slice(0, 3).map((show, index) => (
                      <div key={show.id || index}>
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-bold text-white">{show.title || 'Upcoming Show'}</p>
                            <p className="text-sm text-gray-400">{show.start_time ? new Date(show.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</p>
                          </div>
                        </div>
                        {index < Math.min(upcomingShows.length, 3) - 1 && <div className="h-px" style={{ backgroundColor: 'rgba(255, 213, 74, 0.2)' }} />}
                      </div>
                    ))}
                    {upcomingShows.length === 0 && <p className="text-gray-400 text-sm py-2">No upcoming shows scheduled</p>}
                  </div>
                </div>

                <div className="rounded-xl p-5" style={{ backgroundColor: COLORS.darkBlack, border: `1px solid rgba(255, 213, 74, 0.3)`, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)' }}>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: COLORS.gold }}>
                    <Trophy className="w-5 h-5" />
                    SEASON {seasons[0]?.name || '1'} AUDITIONS OPEN
                  </h3>
                  <div className="space-y-2">
                    {TALENT_CATEGORIES.map((category, index) => (
                      <div key={index} className="flex items-center gap-3 py-2">
                        <span style={{ color: COLORS.orange }}>{category.icon}</span>
                        <span className="text-gray-300">{category.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4" style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(255, 45, 45, 0.15) 0%, transparent 60%), ${COLORS.black}` }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-black mb-8" style={{ color: COLORS.gold, textShadow: `0 0 20px ${COLORS.gold}` }}>
              SUPPORT YOUR FAVORITE TALENT
            </h2>
            <div className="flex flex-wrap justify-center gap-8 mb-10">
              <div className="flex items-center gap-2">
                <Gift className="w-6 h-6" style={{ color: COLORS.red }} />
                <span className="text-gray-300 text-lg">Send Gifts</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6" style={{ color: COLORS.gold }} />
                <span className="text-gray-300 text-lg">Vote Live</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6" style={{ color: COLORS.orange }} />
                <span className="text-gray-300 text-lg">Earn Coins</span>
              </div>
            </div>
            <Link to="/mai-talent/show" className="inline-block px-12 py-5 rounded-full text-xl font-bold transition-all duration-300 hover:scale-105" style={{ backgroundColor: COLORS.red, color: 'white', boxShadow: `0 0 30px rgba(255, 45, 45, 0.5)` }}>
              JOIN LIVE SHOWS
            </Link>
          </div>
        </section>

        <style>{`
          @keyframes pulse-live {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>

      {showCoinStore && (
        <CoinStoreModal
          isOpen={showCoinStore}
          onClose={() => setShowCoinStore(false)}
        />
      )}
    </MaiTalentLayout>
  )
}