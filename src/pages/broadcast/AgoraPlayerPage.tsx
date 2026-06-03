/**
 * AgoraPlayerPage — Standalone Agora RTC viewer
 *
 * URL: /agora-player?channel=STREAM_ID
 *
 * Uses the same layout as GamingViewerPage:
 *   - Main video area (Agora RTC remote video)
 *   - Right sidebar (chat, battle, top fans, actions)
 *   - Mobile action stack
 *
 * Architecture:
 *   OBS → Agora channel → This React viewer page (maitrollcity.com)
 *
 * The actual Agora video is rendered in the main video area.
 * Everything else (chat, sidebar, actions) uses the GamingViewerPage layout.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import AgoraRTC, {
  IAgoraRTCClient,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng'
import {
  ArrowLeft,
  Crown,
  Eye,
  Flag,
  Gamepad2,
  Gift,
  Heart,
  Loader2,
  MessageCircle,
  MonitorPlay,
  MoreVertical,
  Plus,
  Radio,
  Send,
  Share2,
  ShieldCheck,
  Smile,
  Swords,
  Trophy,
  UserPlus,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GamingStream {
  id: string
  title: string
  broadcaster_id: string
  broadcaster_name: string
  broadcaster_avatar: string | null
  category: string | null
  is_live: boolean
  status: string | null
  current_viewers: number
  viewer_count: number
  total_likes?: number
  started_at: string | null
  thumbnail_url: string | null
  agora_channel: string | null
  hls_url?: string | null
  playback_url?: string | null
  obs_playback_url?: string | null
  stream_url?: string | null
  layout_mode?: string | null
}

interface ChatMessage {
  id: string
  user_id: string | null
  username: string
  avatar_url: string | null
  message: string
  created_at: string
}

interface AgoraViewerState {
  isConnecting: boolean
  isConnected: boolean
  remoteVideoTrack: IRemoteVideoTrack | null
  remoteAudioTrack: IRemoteAudioTrack | null
  error: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCompactNumber(value: number | null | undefined) {
  const safe = Number(value || 0)
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}K`
  return safe.toLocaleString()
}

function getViewerUid(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 4_294_967_295
}

function isStreamWatchable(stream: GamingStream | null): boolean {
  if (!stream) return false
  return (
    stream.is_live === true ||
    stream.status === 'live' ||
    stream.status === 'starting' ||
    stream.status === 'connected'
  )
}

// ─── Agora Video Surface ─────────────────────────────────────────────────────

function AgoraVideoSurface({ track }: { track: IRemoteVideoTrack }) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node || !track) return
    try {
      track.play(node)
    } catch (error) {
      console.warn('[AgoraPlayer] Failed to play Agora video:', error)
    }
    return () => {
      try { track.stop() } catch { /* ignore */ }
    }
  }, [track])

  return <div ref={containerRef} className="h-full w-full bg-black" />
}

// ─── Center Status ───────────────────────────────────────────────────────────

function CenterStatus({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.14),transparent_30%),#02040a] px-6 text-center">
      <div>
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-cyan-300/20 bg-cyan-400/10 shadow-[0_0_45px_rgba(34,211,238,0.16)]">
          {icon}
        </div>
        <h2 className="mt-5 text-2xl font-black text-white">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{detail}</p>
      </div>
    </div>
  )
}

// ─── Small UI Components ─────────────────────────────────────────────────────

function ViewerAction({ icon, label, onClick, muted }: { icon: React.ReactNode; label: string; onClick?: () => void; muted?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={cn('grid h-14 w-14 place-items-center rounded-full border bg-black/55 shadow-2xl backdrop-blur-xl', muted ? 'border-white/10 text-slate-300' : 'border-cyan-300/30 text-white shadow-cyan-500/10')}>
        {icon}
      </div>
      <span className="text-[11px] font-black text-white drop-shadow">{label}</span>
    </button>
  )
}

function SideAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100">
      <div className="grid place-items-center">{icon}</div>
      <p className="mt-1 text-[10px] font-black">{label}</p>
    </button>
  )
}

function Panel({ title, icon, className, children }: { title: string; icon: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-3xl border border-cyan-400/15 bg-black/25 p-4 shadow-2xl shadow-black/20', className)}>
      <div className="mb-3 flex items-center gap-2 text-cyan-300">
        {icon}
        <h3 className="text-xs font-black uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function ChatInput({ value, disabled, onChange, onSend }: { value: string; disabled?: boolean; onChange: (v: string) => void; onSend: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/45 p-2 backdrop-blur-xl">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
        placeholder="Say something in chat..."
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-500"
      />
      <Smile className="h-5 w-5 text-slate-500" />
      <button type="button" onClick={onSend} disabled={disabled} className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white transition hover:bg-purple-500 disabled:opacity-50">
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-cyan-400/10">
          {message.avatar_url ? (
            <img src={message.avatar_url} alt={message.username} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center"><Gamepad2 className="h-4 w-4 text-cyan-200" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-cyan-200">{message.username}</p>
          <p className="mt-1 text-sm leading-5 text-slate-200">{message.message}</p>
        </div>
      </div>
    </div>
  )
}

function TopFan({ rank, name, score }: { rank: string; name: string; score: string }) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-3 last:mb-0">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 text-xs font-black">{rank}</div>
        <span className="text-sm font-black text-white">{name}</span>
      </div>
      <span className="text-xs font-black text-purple-300">◈ {score}</span>
    </div>
  )
}

// ─── Agora Hook ──────────────────────────────────────────────────────────────

function useAgoraGamingViewer(channelName: string | null, userId: string | undefined) {
  const [state, setState] = useState<AgoraViewerState>({
    isConnecting: false,
    isConnected: false,
    remoteVideoTrack: null,
    remoteAudioTrack: null,
    error: null,
  })

  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const joinedRef = useRef(false)
  const mountedRef = useRef(true)

  const leave = useCallback(async () => {
    try {
      if (clientRef.current && joinedRef.current) {
        await clientRef.current.leave()
      }
    } catch (error) {
      console.warn('[AgoraPlayer] Agora leave failed:', error)
    } finally {
      joinedRef.current = false
      clientRef.current = null
      if (mountedRef.current) {
        setState({ isConnecting: false, isConnected: false, remoteVideoTrack: null, remoteAudioTrack: null, error: null })
      }
    }
  }, [])

  const join = useCallback(async () => {
    if (!channelName || !userId || joinedRef.current) return

    setState((prev) => ({ ...prev, isConnecting: true, error: null }))

    try {
      const appId = import.meta.env.VITE_AGORA_APP_ID as string | undefined
      if (!appId) throw new Error('Agora App ID is missing')

      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
      clientRef.current = client

      client.on('user-published', async (remoteUser, mediaType) => {
        try {
          await client.subscribe(remoteUser, mediaType)
          if (mediaType === 'video') {
            setState((prev) => ({ ...prev, remoteVideoTrack: remoteUser.videoTrack || null }))
          }
          if (mediaType === 'audio') {
            const audioTrack = remoteUser.audioTrack || null
            setState((prev) => ({ ...prev, remoteAudioTrack: audioTrack }))
            audioTrack?.play()
          }
        } catch (error) {
          console.warn('[AgoraPlayer] Subscribe failed:', error)
        }
      })

      client.on('user-unpublished', (_remoteUser, mediaType) => {
        if (mediaType === 'video') setState((prev) => ({ ...prev, remoteVideoTrack: null }))
        if (mediaType === 'audio') setState((prev) => ({ ...prev, remoteAudioTrack: null }))
      })

      client.on('user-left', () => {
        setState((prev) => ({ ...prev, remoteVideoTrack: null, remoteAudioTrack: null }))
      })

      const uid = getViewerUid(userId)

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('agora-token', {
        body: {
          channelName,
          uid,
          role: 'subscriber',
        },
      })

      if (tokenError) throw new Error(tokenError.message)
      if (!tokenData?.token) throw new Error('No Agora token received')

      await client.join(appId, channelName, tokenData.token, uid)
      joinedRef.current = true
      await client.setClientRole('audience')

      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isConnecting: false, isConnected: true, error: null }))
      }
    } catch (error: any) {
      console.error('[AgoraPlayer] Join failed:', error)
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isConnecting: false, isConnected: false, error: error?.message || 'Failed to connect to stream' }))
      }
    }
  }, [channelName, userId])

  useEffect(() => {
    mountedRef.current = true
    if (channelName && userId) join()
    return () => {
      mountedRef.current = false
      leave()
    }
  }, [channelName, userId, join, leave])

  return { ...state, join, leave }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgoraPlayerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const channelName = searchParams.get('channel') || searchParams.get('streamId') || ''

  const [stream, setStream] = useState<GamingStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [sendingChat, setSendingChat] = useState(false)
  const [battleData, setBattleData] = useState<{
    sideAName: string; sideAScore: number; sideBName: string; sideBScore: number; timeRemaining: string
  } | null>(null)
  const [topFans, setTopFans] = useState<Array<{ rank: number; name: string; score: number }>>([])

  const shouldUseAgora = Boolean(stream?.agora_channel)

  const agoraViewer = useAgoraGamingViewer(
    shouldUseAgora ? stream?.agora_channel || null : null,
    user?.id || `anon-${channelName || 'agora-player'}`,
  )

  // Fetch stream data
  const fetchStream = useCallback(async () => {
    if (!channelName) return
    try {
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id, title, broadcaster_id, category, is_live, status,
          current_viewers, viewer_count, total_likes, started_at,
          thumbnail_url, agora_channel, hls_url, playback_url,
          obs_playback_url, stream_url, layout_mode, battle_id
        `)
        .eq('id', channelName)
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Stream not found')

      let broadcasterName = data.broadcaster_id || 'Broadcaster'
      let broadcasterAvatar: string | null = null

      if (data.broadcaster_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .eq('id', data.broadcaster_id)
          .maybeSingle()
        broadcasterName = profile?.username || broadcasterName
        broadcasterAvatar = profile?.avatar_url || null
      }

      const resolvedStream: GamingStream = {
        id: data.id,
        title: data.title || `${broadcasterName}'s live stream`,
        broadcaster_id: data.broadcaster_id,
        broadcaster_name: broadcasterName,
        broadcaster_avatar: broadcasterAvatar,
        category: data.category || 'gaming',
        is_live: Boolean(data.is_live),
        status: data.status || null,
        current_viewers: data.current_viewers || 0,
        viewer_count: data.viewer_count || 0,
        total_likes: data.total_likes || 0,
        started_at: data.started_at || null,
        thumbnail_url: data.thumbnail_url || null,
        agora_channel: data.agora_channel || null,
        hls_url: data.hls_url || null,
        playback_url: data.playback_url || null,
        obs_playback_url: data.obs_playback_url || null,
        stream_url: data.stream_url || null,
        layout_mode: data.layout_mode || null,
      }

      setStream(resolvedStream)
      setLikeCount(data.total_likes || 0)

      // Fetch battle data
      if (data.battle_id) {
        const { data: battle } = await supabase
          .from('stream_battles')
          .select('side_a_name, side_a_score, side_b_name, side_b_score, ends_at')
          .eq('id', data.battle_id)
          .maybeSingle()

        if (battle) {
          const endsAt = battle.ends_at ? new Date(battle.ends_at) : null
          const now = new Date()
          const timeRemaining = endsAt && endsAt > now
            ? `${Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 60000))}:${String(Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000) % 60)).padStart(2, '0')}`
            : '00:00'
          setBattleData({
            sideAName: battle.side_a_name || 'Side A',
            sideAScore: battle.side_a_score || 0,
            sideBName: battle.side_b_name || 'Side B',
            sideBScore: battle.side_b_score || 0,
            timeRemaining,
          })
        }
      } else {
        setBattleData(null)
      }

      // Fetch top fans
      const { data: topGifters } = await supabase
        .from('stream_gifts')
        .select('sender_id, total_amount')
        .eq('stream_id', channelName)
        .order('total_amount', { ascending: false })
        .limit(3)

      if (topGifters && topGifters.length > 0) {
        const senderIds = topGifters.map((g: any) => g.sender_id).filter(Boolean)
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', senderIds)
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.username]))
        setTopFans(
          topGifters.map((g: any, index: number) => ({
            rank: index + 1,
            name: profileMap.get(g.sender_id) || 'Viewer',
            score: g.total_amount || 0,
          }))
        )
      } else {
        setTopFans([])
      }
    } catch (error: any) {
      console.error('[AgoraPlayer] Failed to fetch stream:', error)
      toast.error(error?.message || 'Failed to load stream')
    } finally {
      setLoading(false)
    }
  }, [channelName])

  const fetchChatMessages = useCallback(async () => {
    if (!channelName) return
    try {
      const { data, error } = await supabase
        .from('stream_messages')
        .select('id, user_id, message, created_at')
        .eq('stream_id', channelName)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) return

      const rows = data || []
      const userIds = Array.from(new Set(rows.map((row: any) => row.user_id).filter(Boolean)))
      let profileMap = new Map<string, any>()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('user_profiles').select('id, username, avatar_url').in('id', userIds)
        if (profiles) profileMap = new Map(profiles.map((p: any) => [p.id, p.username]))
      }

      const normalized: ChatMessage[] = rows
        .map((row: any) => {
          const profile = row.user_id ? profileMap.get(row.user_id) : null
          return {
            id: row.id,
            user_id: row.user_id,
            username: profile || 'Viewer',
            avatar_url: null,
            message: row.message || '',
            created_at: row.created_at,
          }
        })
        .reverse()

      setChatMessages(normalized)
    } catch (error) {
      console.warn('[AgoraPlayer] Chat load failed:', error)
    }
  }, [channelName])

  useEffect(() => {
    fetchStream()
    fetchChatMessages()
  }, [fetchStream, fetchChatMessages])

  // Realtime subscriptions
  useEffect(() => {
    if (!channelName) return
    const streamChannel = supabase.channel(`agora-player-stream:${channelName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams', filter: `id=eq.${channelName}` }, () => fetchStream())
      .subscribe()
    const chatChannel = supabase.channel(`agora-player-chat:${channelName}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stream_messages', filter: `stream_id=eq.${channelName}` }, () => fetchChatMessages())
      .subscribe()
    return () => { supabase.removeChannel(streamChannel); supabase.removeChannel(chatChannel) }
  }, [channelName, fetchStream, fetchChatMessages])

  const handleLike = () => {
    setLiked((v) => !v)
    setLikeCount((v) => (liked ? Math.max(0, v - 1) : v + 1))
  }

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim()
    if (!trimmed || !user?.id || !channelName) return
    setSendingChat(true)
    try {
      const { error } = await supabase.from('stream_messages').insert({ stream_id: channelName, user_id: user.id, message: trimmed })
      if (error) throw error
      setChatInput('')
      fetchChatMessages()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send chat')
    } finally {
      setSendingChat(false)
    }
  }

  // ─── No channel specified ─────────────────────────────────────
  if (!channelName) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <MonitorPlay className="mb-4 h-16 w-16 text-zinc-600" />
        <h1 className="text-xl font-bold">No Channel Specified</h1>
        <p className="mt-2 text-sm text-zinc-400">Add ?channel=STREAM_ID to the URL</p>
        <button onClick={() => navigate(-1)} className="mt-6 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-300" />
          <p className="mt-4 text-sm font-black text-slate-300">Loading stream...</p>
        </div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
        <div>
          <WifiOff className="mx-auto h-14 w-14 text-red-300" />
          <h1 className="mt-4 text-2xl font-black">Stream not found</h1>
          <p className="mt-2 text-sm text-slate-400">This stream may have ended or the link is invalid.</p>
          <button onClick={() => navigate(-1)} className="mt-5 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950">Go Back</button>
        </div>
      </div>
    )
  }

  const watchable = isStreamWatchable(stream)
  const viewerCount = stream.current_viewers || stream.viewer_count || 0

  return (
    <div className="relative overflow-hidden bg-[#02040a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.16),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.10),transparent_34%)]" />

      <div className="relative z-10 grid lg:grid-cols-[minmax(0,1fr)_360px] min-h-screen">
        {/* ── Main video area ─────────────────────────────────────── */}
        <main className="relative min-h-screen bg-black">
          <div className="absolute inset-0">
            {watchable && shouldUseAgora && agoraViewer.remoteVideoTrack ? (
              <AgoraVideoSurface track={agoraViewer.remoteVideoTrack} />
            ) : watchable && shouldUseAgora && agoraViewer.isConnecting ? (
              <CenterStatus icon={<Loader2 className="h-10 w-10 animate-spin text-cyan-300" />} title="Connecting to stream..."} detail="Joining the Agora channel." />
            ) : watchable && shouldUseAgora && agoraViewer.isConnected ? (
              <CenterStatus icon={<MonitorPlay className="h-12 w-12 text-cyan-300" />} title="Waiting for video" detail="The broadcaster is connected, but video has not been published yet." />
            ) : watchable ? (
              <CenterStatus icon={<Radio className="h-12 w-12 text-cyan-300" />} title="Stream is live" detail="Waiting for the gaming feed to connect." />
            ) : (
              <CenterStatus icon={<WifiOff className="h-12 w-12 text-red-300" />} title="Stream is offline" detail="This broadcast is not currently live." />
            )}
          </div>

          {/* Top overlay */}
          <div className="absolute left-0 right-0 top-0 z-20 bg-gradient-to-b from-black/85 to-transparent p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => navigate(-1)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/45 text-white backdrop-blur-xl transition hover:bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-cyan-300/30 bg-cyan-400/10">
                  {stream.broadcaster_avatar ? (
                    <img src={stream.broadcaster_avatar} alt={stream.broadcaster_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center"><Gamepad2 className="h-5 w-5 text-cyan-200" /></div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-base font-black sm:text-lg">{stream.title}</h1>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
                    <span className="truncate font-bold text-cyan-200">{stream.broadcaster_name}</span>
                    <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
                    <span className="hidden sm:inline">Gaming</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs font-black backdrop-blur-xl sm:flex">
                  <Eye className="h-4 w-4 text-white/70" />
                  {formatCompactNumber(viewerCount)}
                </div>
                <div className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black backdrop-blur-xl', watchable ? 'bg-red-600 text-white shadow-[0_0_18px_rgba(239,68,68,0.22)]' : 'border border-white/10 bg-black/45 text-slate-300')}>
                  <span className={cn('h-2 w-2 rounded-full', watchable ? 'animate-pulse bg-white' : 'bg-slate-500')} />
                  {watchable ? 'LIVE' : 'OFFLINE'}
                </div>
                <button type="button" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/45 text-white backdrop-blur-xl transition hover:bg-white/10">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile action stack */}
          <div className="absolute bottom-32 right-4 z-20 flex flex-col items-center gap-4 lg:hidden">
            <ViewerAction icon={<Heart className={cn('h-7 w-7', liked && 'fill-pink-400 text-pink-400')} />} label={formatCompactNumber(likeCount)} onClick={handleLike} />
            <ViewerAction icon={<Gift className="h-7 w-7" />} label="Gift" />
            <ViewerAction icon={<Share2 className="h-7 w-7" />} label="Share" />
            <ViewerAction icon={<UserPlus className="h-7 w-7" />} label="Follow" />
            <ViewerAction icon={<Flag className="h-7 w-7" />} label="Report" muted />
          </div>

          {/* Floating gaming HUD */}
          <div className="absolute bottom-24 left-4 z-20 hidden max-w-md rounded-3xl border border-cyan-300/20 bg-black/55 p-4 shadow-2xl backdrop-blur-xl sm:block">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10">
                <Trophy className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <p className="text-sm font-black">{stream.title || 'Live gaming stream'}</p>
                <p className="text-xs text-slate-400">{stream.broadcaster_name ? `${stream.broadcaster_name} is live now.` : 'Join the live gaming stream.'}</p>
              </div>
            </div>
          </div>

          {/* Bottom chat input mobile */}
          <div className="absolute bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-black/80 p-3 backdrop-blur-2xl lg:hidden">
            <ChatInput value={chatInput} disabled={sendingChat} onChange={setChatInput} onSend={sendChatMessage} />
          </div>
        </main>

        {/* ── Desktop right panel ─────────────────────────────────── */}
        <aside className="relative z-20 hidden min-h-screen border-l border-cyan-400/15 bg-[#05101c]/92 p-4 backdrop-blur-2xl lg:flex lg:flex-col">
          <div className="mb-4 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/15">
                <Gamepad2 className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <p className="text-sm font-black">Live viewer</p>
                <p className="text-xs text-slate-300">{formatCompactNumber(viewerCount)} watching</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <SideAction icon={<Heart className={cn('h-5 w-5', liked && 'fill-pink-400 text-pink-400')} />} label="Like" onClick={handleLike} />
            <SideAction icon={<Gift className="h-5 w-5" />} label="Gift" />
            <SideAction icon={<Zap className="h-5 w-5" />} label="Hype" />
            <SideAction icon={<Share2 className="h-5 w-5" />} label="Share" />
            <SideAction icon={<UserPlus className="h-5 w-5" />} label="Follow" />
          </div>

          <Panel title="Battle Arena" icon={<Swords className="h-4 w-4" />} className="mt-4">
            {battleData ? (
              <>
                <div className="flex items-center justify-between text-sm font-black">
                  <div>
                    <p className="text-cyan-300">{battleData.sideAName}</p>
                    <p className="text-2xl text-cyan-300">{battleData.sideAScore.toLocaleString()}</p>
                  </div>
                  <span className="text-slate-500">VS</span>
                  <div className="text-right">
                    <p className="text-purple-300">{battleData.sideBName}</p>
                    <p className="text-2xl text-purple-300">{battleData.sideBScore.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{ width: `${battleData.sideAScore + battleData.sideBScore > 0 ? (battleData.sideAScore / (battleData.sideAScore + battleData.sideBScore)) * 100 : 50}%` }} />
                </div>
                <p className="mt-3 text-center text-xs font-black text-emerald-300">Battle ends in {battleData.timeRemaining}</p>
              </>
            ) : (
              <div className="py-4 text-center">
                <Swords className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-sm text-slate-400">No active battle</p>
              </div>
            )}
          </Panel>

          <Panel title="Top Fans" icon={<Crown className="h-4 w-4" />} className="mt-4">
            {topFans.length > 0 ? (
              topFans.map((fan) => <TopFan key={fan.rank} rank={fan.rank.toString()} name={fan.name} score={`${(fan.score / 1000).toFixed(1)}K`} />)
            ) : (
              <div className="py-4 text-center">
                <Crown className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-sm text-slate-400">No top fans yet</p>
              </div>
            )}
          </Panel>

          <Panel title="Request Seat" icon={<Users className="h-4 w-4" />} className="mt-4">
            <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-300/30 bg-purple-500/15 px-4 py-3 text-sm font-black text-purple-100 transition hover:bg-purple-500/20">
              <Plus className="h-4 w-4" /> Join Gaming Seats
            </button>
            <p className="mt-3 text-xs leading-5 text-slate-400">Request a seat to join the room when the broadcaster allows viewer guests.</p>
          </Panel>

          <Panel title="Live Chat" icon={<MessageCircle className="h-4 w-4" />} className="mt-4 min-h-0 flex-1">
            <div className="flex h-full min-h-[260px] flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {chatMessages.length === 0 ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <MessageCircle className="mx-auto h-10 w-10 text-slate-600" />
                      <p className="mt-2 text-sm font-black text-slate-300">No chat yet</p>
                      <p className="text-xs text-slate-500">Be the first to hype the stream.</p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((message) => <ChatBubble key={message.id} message={message} />)
                )}
              </div>
              <div className="mt-3">
                <ChatInput value={chatInput} disabled={sendingChat} onChange={setChatInput} onSend={sendChatMessage} />
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
