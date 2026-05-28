import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mic, MicOff, Play, Pause, Volume2, VolumeX, X, Maximize2, Lock, Users, Clock, Radio, ChevronRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/useIsMobile'
import { trollCityBroadcastTheme as theme } from '@/styles/broadcastTheme'
import { usePodcastStore } from '@/stores/podcastStore'
import { usePodcastAgora } from '@/hooks/usePodcastAgora'
import { RTCAdminMonitor } from '@/components/admin'
import { cn } from '@/lib/utils'

interface Podcast {
  id: string
  host_user_id: string
  title: string
  description: string | null
  status: 'scheduled' | 'live' | 'active' | 'ended' | 'archived'
  agora_channel_name: string
  started_at: string | null
  ended_at: string | null
  listener_count: number
  peak_listener_count: number
  created_at: string
  updated_at: string
}

interface PodcastEpisode {
  id: string
  podcast_id: string
  title: string
  description: string | null
  duration_seconds: number | null
  recorded_at: string
  audio_url: string | null
  listener_count: number
}

interface PodcastParticipant {
  id: string
  podcast_id: string
  user_id: string
  role: 'host' | 'speaker' | 'listener'
  is_muted: boolean
  joined_at: string
  left_at: string | null
}

// Staff roles that require level 10 to start podcasts
const STAFF_ROLES = ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary', 'officer', 'hr_admin', 'agency_hr_manager']

// Roles exempt from level 10 requirement (all non-staff roles can start)
const EXEMPT_ROLES = ['creator', 'broadcaster', 'troll_family', 'president', 'pastor']

export default function PodcastCentral() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { isMobileWidth } = useIsMobile()
  
  // Podcast state
  const [livePodcasts, setLivePodcasts] = useState<Podcast[]>([])
  const [trendingPodcasts, setTrendingPodcasts] = useState<Podcast[]>([])
  const [recentEpisodes, setRecentEpisodes] = useState<PodcastEpisode[]>([])
  const [userHistory, setUserHistory] = useState<PodcastEpisode[]>([])
  const [loading, setLoading] = useState(true)
  
  // New podcast form state
  const [showStartForm, setShowStartForm] = useState(false)
  const [podcastTitle, setPodcastTitle] = useState('')
  const [podcastDescription, setPodcastDescription] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  {/* Podcast state - connected to global store */}
  const globalActivePodcast = usePodcastStore(state => state.activePodcast)
  const showMiniPlayer = usePodcastStore(state => state.showMiniPlayer)
  const globalSetActivePodcast = usePodcastStore(state => state.setActivePodcast)
  const globalSetShowMiniPlayer = usePodcastStore(state => state.setShowMiniPlayer)
  const isPlaying = usePodcastStore(state => state.isPlaying)
  const isMuted = usePodcastStore(state => state.isMuted)
  const volume = usePodcastStore(state => state.volume)
  const elapsedTime = usePodcastStore(state => state.elapsedTime)
  const globalSetPlaying = usePodcastStore(state => state.setPlaying)
  const globalSetMuted = usePodcastStore(state => state.setMuted)
  const globalSetVolume = usePodcastStore(state => state.setVolume)

  // Agora hook for podcast audio
  const {
    isConnected,
    joinPodcast,
    leavePodcast,
    error: agoraError
  } = usePodcastAgora({
    channelName: globalActivePodcast?.agora_channel_name || '',
    enabled: !!globalActivePodcast
  })

  // Check if user can start a podcast
  const canStartPodcast = useMemo(() => {
    if (!user || !profile) return false
    
    const level = profile.level || 1
    const role = profile.role || ''
    
    // Admin and CEO always have access
    if (role === 'admin' || (profile as any).is_admin || (profile as any).troll_role === 'superadmin') {
      return true
    }
    
    // If level >= 10, they can start
    if (level >= 10) return true
    
    // Staff under level 10 cannot start
    if (STAFF_ROLES.includes(role)) return false
    
    // All other roles can start regardless of level
    return true
  }, [user, profile])

  const getLockedMessage = useMemo(() => {
    if (!profile) return ''
    
    const level = profile.level || 1
    const role = profile.role || ''
    
    if (STAFF_ROLES.includes(role) && level < 10) {
      return 'Staff accounts need Level 10 to start podcasts.'
    }
    return 'Podcast Central unlocks at Level 10.'
  }, [profile])

  // Fetch live podcasts
  const fetchLivePodcasts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('podcasts')
        .select('*')
        .in('status', ['live', 'active'])
        .order('started_at', { ascending: false })
        .limit(5)

      if (error) throw error

      setLivePodcasts(data || [])
    } catch (err) {
      console.error('[PodcastCentral] Error fetching live podcasts:', err)
    }
  }, [])

  // Fetch trending podcasts
  const fetchTrendingPodcasts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('podcasts')
        .select('*')
        .eq('status', 'ended')
        .order('peak_listener_count', { ascending: false })
        .limit(10)

      if (error) throw error

      setTrendingPodcasts(data || [])
    } catch (err) {
      console.error('[PodcastCentral] Error fetching trending podcasts:', err)
    }
  }, [])

  // Fetch recent episodes
  const fetchRecentEpisodes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('podcast_episodes')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentEpisodes(data || [])
    } catch (err) {
      console.error('[PodcastCentral] Error fetching recent episodes:', err)
    }
  }, [])

  // Fetch user podcast history
  const fetchUserHistory = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const { data, error } = await supabase
        .from('podcast_episodes')
        .select(`
          *,
          podcasts!inner(host_user_id)
        `)
        .eq('podcasts.host_user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setUserHistory(data || [])
    } catch (err) {
      console.error('[PodcastCentral] Error fetching user history:', err)
    }
  }, [user?.id])

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      await Promise.all([
        fetchLivePodcasts(),
        fetchTrendingPodcasts(),
        fetchRecentEpisodes(),
        fetchUserHistory()
      ])
      setLoading(false)
    }
    
    loadInitialData()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadInitialData, 30000)
    return () => clearInterval(interval)
  }, [fetchLivePodcasts, fetchTrendingPodcasts, fetchRecentEpisodes, fetchUserHistory])

  // Handle joining a podcast
  const handleJoinPodcast = useCallback(async (podcast: Podcast) => {
    try {
      // Check if user is jailed/banned before joining
      const { data: jailData } = await supabase
        .from('jail')
        .select('release_time')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (jailData && new Date(jailData.release_time) > new Date()) {
        toast.error('You are in jail and cannot join podcasts')
        return
      }

      globalSetActivePodcast(podcast)
      globalSetShowMiniPlayer(true)
      toast.success(`Joining "${podcast.title}"`)
    } catch (err) {
      console.error('[PodcastCentral] Error joining podcast:', err)
      toast.error('Failed to join podcast')
    }
  }, [user?.id, globalSetActivePodcast, globalSetShowMiniPlayer])

  // Handle starting a podcast
  const handleStartPodcast = useCallback(async () => {
    if (!canStartPodcast || !user) return
    
    setIsStarting(true)
    try {
      const channelName = `podcast_${user.id}_${Date.now()}`
      const statuses: Array<'live' | 'active' | 'scheduled'> = ['live', 'active', 'scheduled']
      let podcast = null
      let lastError: any = null

      for (const status of statuses) {
        const { data, error } = await supabase
          .from('podcasts')
          .insert({
            host_user_id: user.id,
            title: podcastTitle.trim() || 'Untitled Podcast',
            description: podcastDescription.trim() || null,
            status,
            agora_channel_name: channelName,
            started_at: new Date().toISOString(),
            listener_count: 0,
            peak_listener_count: 0
          })
          .select()
          .single()

        if (!error) {
          podcast = data
          break
        }

        lastError = error
        const isStatusConstraint =
          error?.code === '23514' &&
          String(error?.message).includes('podcasts_status_check')

        if (!isStatusConstraint) {
          throw error
        }
      }

      if (!podcast) {
        throw lastError || new Error('Unable to create podcast')
      }

      // Log to RTCAdmin Monitor
      await supabase.from('podcast_rtc_logs').insert({
        podcast_id: podcast.id,
        user_id: user.id,
        username: profile?.username || '',
        role: profile?.role || '',
        level: profile?.level || 1,
        event_type: 'podcast_started',
        message: `User started podcast: ${podcast.title}`,
        metadata: { title: podcast.title, channelName, status: podcast.status }
      })

      // Navigate to the podcast room
      navigate(`/podcast/${podcast.id}`)
      toast.success('Podcast started!')
    } catch (err: any) {
      console.error('[PodcastCentral] Error starting podcast:', err)
      toast.error(err?.message || 'Failed to start podcast')
    } finally {
      setIsStarting(false)
      setShowStartForm(false)
    }
  }, [canStartPodcast, user, profile, podcastTitle, podcastDescription, navigate])

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Agora error handling
  useEffect(() => {
    if (agoraError) {
      toast.error(agoraError)
    }
  }, [agoraError])

  return (
    <div className="relative min-h-full w-full bg-slate-950">
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.18),transparent_42%)] inset-0" />
        <div className="absolute bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.14),transparent_46%)] inset-0" />
        <div className="absolute bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.10),transparent_44%)] inset-0" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
      </div>

      <div className="relative z-10 flex flex-col min-h-0 px-3 md:px-5 pt-2 pb-6 safe-top">
        <div className="max-w-7xl mx-auto flex flex-col min-h-0 w-full">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-cyan-500 to-pink-500 flex items-center justify-center">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Podcast Central</h1>
                <p className="text-sm text-slate-400">Troll City's Audio Hub</p>
              </div>
            </div>
            
            {/* Feature chips */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300">
                <Mic className="w-3 h-3" />
                Mute Supported
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-300">
                <Volume2 className="w-3 h-3" />
                Background Listening
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 px-3 py-1 text-xs font-bold text-white">
                Powered by Agora Audio
              </span>
            </div>
          </div>

          {/* Start Podcast Card */}
          <div className={`${theme.panelStrong} p-5 mb-4`}>
            {canStartPodcast ? (
              showStartForm ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={podcastTitle}
                    onChange={(e) => setPodcastTitle(e.target.value)}
                    placeholder="Podcast title..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-cyan-400/50"
                    maxLength={100}
                  />
                  <textarea
                    value={podcastDescription}
                    onChange={(e) => setPodcastDescription(e.target.value)}
                    placeholder="Description (optional)..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-cyan-400/50 resize-none"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowStartForm(false)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStartPodcast}
                      disabled={isStarting}
                      className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 via-cyan-500 to-pink-500 px-4 py-3 font-semibold text-white shadow-lg hover:from-purple-500 hover:via-cyan-400 hover:to-pink-500 disabled:opacity-50"
                    >
                      {isStarting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Starting...
                        </span>
                      ) : (
                        'Start Podcast'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowStartForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-cyan-500 to-pink-500 px-6 py-4 font-semibold text-white shadow-lg hover:from-purple-500 hover:via-cyan-400 hover:to-pink-500 transition-all"
                >
                  <Radio className="w-5 h-5" />
                  Start Podcast
                </button>
              )
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="font-semibold text-red-300">Access Locked</p>
                    <p className="text-sm text-red-400/80">{getLockedMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Podcast Access Card */}
          <div className={`${theme.panel} p-4 mb-4`}>
            <h3 className="mb-3 text-sm font-bold text-cyan-300 uppercase tracking-wide">Podcast Access Rules</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-white"><strong>Level 10+</strong> can start and host podcasts</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-white"><strong>All users</strong> can listen to live podcasts</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-white"><strong>Staff roles</strong> under Level 10 cannot start</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-white"><strong>Admin/CEO</strong> always have access</span>
              </div>
            </div>
          </div>

          {/* Featured Live Podcast */}
          <div className={`${theme.panelStrong} p-5 mb-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Featured Live Podcast</h2>
              <Link to="/podcast/explore" className="flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : livePodcasts.length === 0 ? (
              <div className="text-center py-8">
                <Radio className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No live podcasts right now</p>
              </div>
            ) : (
              <div className="space-y-3">
                {livePodcasts.slice(0, 1).map((podcast) => (
                  <div key={podcast.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-600/30 to-cyan-500/30 flex-shrink-0 flex items-center justify-center">
                        <Mic className="w-8 h-8 text-cyan-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{podcast.title}</h3>
                        <p className="text-sm text-slate-300 mt-1 line-clamp-2">{podcast.description || 'No description'}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {podcast.listener_count || 0} listeners
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Started {podcast.started_at ? new Date(podcast.started_at).toLocaleTimeString() : 'recently'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoinPodcast(podcast)}
                        className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-2 font-semibold text-white hover:from-purple-500 hover:to-cyan-400"
                      >
                        Listen Live
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trending Podcasts */}
          <div className={`${theme.panel} p-5 mb-4`}>
            <h2 className="mb-3 text-lg font-bold text-white">Trending Podcasts</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : trendingPodcasts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">No trending podcasts yet</p>
              </div>
            ) : (
              <div className={`grid gap-3 ${isMobileWidth ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3'}`}>
                {trendingPodcasts.map((podcast) => (
                  <div key={podcast.id} className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-all cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600/30 to-pink-500/30 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-purple-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate text-sm">{podcast.title}</p>
                        <p className="text-xs text-slate-400">Podcast</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{podcast.peak_listener_count || 0} peak listeners</span>
                      <button
                        onClick={() => handleJoinPodcast(podcast)}
                        className="text-cyan-300 hover:text-cyan-200 font-medium"
                      >
                        Replay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Episodes */}
          <div className={`${theme.panel} p-5 mb-4`}>
            <h2 className="mb-3 text-lg font-bold text-white">Recent Episodes</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
              </div>
            ) : recentEpisodes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">No episodes recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentEpisodes.map((episode) => (
                  <div key={episode.id} className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600/30 to-purple-500/30 flex items-center justify-center">
                        <Volume2 className="w-5 h-5 text-cyan-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">{episode.title}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{episode.duration_seconds ? formatTime(episode.duration_seconds) : 'Recorded'}</span>
                          <span>•</span>
                          <span>{episode.listener_count || 0} plays</span>
                        </div>
                      </div>
                      <button
onClick={() => navigate(`/podcast/${episode.podcast_id}`)}
                         className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                      >
                        Play
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Podcast History */}
          {user && (
            <div className={`${theme.panel} p-5 mb-4`}>
              <h2 className="mb-3 text-lg font-bold text-white">My Podcast History</h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : userHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">No podcast history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userHistory.map((episode) => (
                    <div key={episode.id} className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600/30 to-pink-500/30 flex items-center justify-center">
                          <Mic className="w-5 h-5 text-purple-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{episode.title}</p>
                          <p className="text-xs text-slate-400">Recorded {episode.recorded_at ? new Date(episode.recorded_at).toLocaleDateString() : 'recently'}</p>
                        </div>
                        <button
onClick={() => navigate(`/podcast/${episode.podcast_id}`)}
                           className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                         >
                           Replay
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

{/* RTCAdmin Monitor Status Card */}
           <div className={`${theme.panel} p-5`}>
             <h2 className="mb-3 text-lg font-bold text-white">RTCAdmin Monitor</h2>
             <RTCAdminMonitor />
           </div>
         </div>
       </div>
     </div>
   )
}