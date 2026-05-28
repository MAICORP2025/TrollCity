import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, Users, Clock, Play, Pause, Volume2, VolumeX, X, Radio, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/useIsMobile'
import { trollCityBroadcastTheme as theme } from '@/styles/broadcastTheme'
import { usePodcastStore } from '@/stores/podcastStore'
import { usePodcastAgora } from '@/hooks/usePodcastAgora'
import { RTCAdminMonitor } from '@/components/admin'

interface Podcast {
  id: string
  host_user_id: string
  title: string
  description: string | null
  status: 'scheduled' | 'live' | 'active' | 'ended' | 'archived'
  agora_channel_name: string
  started_at: string | null
  listener_count: number
  peak_listener_count: number
}

export default function PodcastRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { isMobileWidth } = useIsMobile()

  const [podcast, setPodcast] = useState<Podcast | null>(null)
  const [loading, setLoading] = useState(true)
  const [isHost, setIsHost] = useState(false)

  // Global podcast store
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

  // Load podcast data
  useEffect(() => {
    if (!id) return

    const fetchPodcast = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('podcasts')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        setPodcast(data)
        setIsHost(data.host_user_id === user?.id)
      } catch (err) {
        console.error('[PodcastRoom] Error fetching podcast:', err)
        toast.error('Podcast not found')
        navigate('/podcast')
      } finally {
        setLoading(false)
      }
    }

    fetchPodcast()
  }, [id, user?.id, navigate])

  // Agora hook
  const {
    isConnected,
    joinPodcast,
    leavePodcast,
    error: agoraError
  } = usePodcastAgora({
    channelName: podcast?.agora_channel_name || '',
    enabled: !!podcast
  })

  // Auto-join when podcast loads
  useEffect(() => {
    if (podcast && !globalActivePodcast) {
      globalSetActivePodcast(podcast)
      globalSetShowMiniPlayer(true)
    }
  }, [podcast, globalActivePodcast, globalSetActivePodcast, globalSetShowMiniPlayer])

  const handleLeavePodcast = useCallback(() => {
    globalSetShowMiniPlayer(false)
    navigate('/podcast')
  }, [globalSetShowMiniPlayer, navigate])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  if (!podcast) return null

  return (
    <div className="min-h-full w-full bg-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.18),transparent_42%)] inset-0" />
        <div className="absolute bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.14),transparent_46%)] inset-0" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
      </div>

      <div className="relative z-10 flex flex-col min-h-0 px-3 md:px-5 pt-2 pb-6 safe-top">
        <div className="max-w-4xl mx-auto flex flex-col min-h-0 w-full">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/podcast')}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>

          <div className={`${theme.panelStrong} p-6 mb-4`}>
<div className="flex items-start gap-4 mb-4">
               <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600/30 to-cyan-500/30 flex-shrink-0 flex items-center justify-center">
                 <Mic className="w-10 h-10 text-cyan-300" />
               </div>
               <div className="flex-1 min-w-0">
                 <h1 className="text-2xl font-bold text-white">{podcast.title}</h1>
                 <p className="text-slate-300 mt-1">{podcast.description || 'No description'}</p>
                 <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                   <span className="flex items-center gap-1">
                     <Mic className="w-4 h-4" />
                     Host
                   </span>
                   <span className="flex items-center gap-1">
                     <Users className="w-4 h-4" />
                     {podcast.listener_count} listeners
                   </span>
                   {isHost && (
                     <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                       Host
                     </span>
                   )}
                 </div>
               </div>
             </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Status: {podcast.status}</span>
                <span className="text-sm text-cyan-300">{isConnected ? 'Connected' : 'Connecting...'}</span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => globalSetVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/20 rounded-full appearance-none"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => globalSetMuted(!isMuted)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-medium text-white hover:bg-white/10"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>

                <button
                  onClick={() => globalSetPlaying(!isPlaying)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-2 font-semibold text-white"
                >
                  {isPlaying ? <Pause className="w-4 h-4 inline mr-2" /> : <Play className="w-4 h-4 inline mr-2" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>

                <button
                  onClick={handleLeavePodcast}
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 font-medium text-red-300 hover:bg-red-500/20"
                >
                  <X className="w-4 h-4" />
                  Leave
                </button>
              </div>
            </div>
          </div>

          <div className={`${theme.panel} p-5`}>
            <h2 className="mb-3 text-lg font-bold text-white">RTCAdmin Monitor</h2>
            <RTCAdminMonitor />
          </div>
        </div>
      </div>
    </div>
  )
}