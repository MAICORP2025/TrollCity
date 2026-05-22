import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle,
  Clock,
  Coins,
  Flag,
  Gavel,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Shield,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

type AuctionShowStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
type AuctionLotStatus =
  | 'draft'
  | 'upcoming'
  | 'queued'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'show'
  | 'up'
  | 'down'
  | 'pass'
  | 'sold'
  | 'unsold'
  | 'cancelled'
  | 'ended'
  | 'removed'
  | 'remove'

interface AuctionShow {
  id: string
  title: string
  description?: string | null
  category?: string | null
  thumbnail_url?: string | null
  status: AuctionShowStatus
  scheduled_for?: string | null
  live_started_at?: string | null
  ended_at?: string | null
  livekit_room_name?: string | null
  auctioneer_id: string
  current_lot_id?: string | null
}

interface AuctionLot {
  id: string
  auction_show_id: string
  title: string
  description?: string | null
  image_url?: string | null
  starting_bid: number
  bid_increment: number
  current_highest_bid?: number | null
  current_highest_bidder_id?: string | null
  status: AuctionLotStatus
  countdown_end_at?: string | null
  order_index?: number | null
  queue_position?: number | null
  reserve_price?: number | null
  buy_now_price?: number | null
  condition?: string | null
  quantity?: number | null
}

interface AuctionBid {
  id: string
  lot_id?: string | null
  bidder_id: string
  bid_amount: number
  created_at: string
  bidder?: {
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
}

interface UserProfile {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  troll_coins: number
  role?: string | null
  is_admin?: boolean | null
  is_superadmin?: boolean | null
}

interface LiveAuctionStateRpc {
  current_lot?: AuctionLot | null
  recent_bids?: AuctionBid[]
  viewer_count?: number
}

interface PlaceBidResult {
  accepted?: boolean
  reason?: string
  bid_id?: string
  new_highest_bid?: number
}

const MIN_COINS_TO_BID = 100

// Keeps React dev StrictMode from double-joining the same Agora channel/UID.
// StrictMode can mount, start join, cleanup, then mount again before Agora finishes leaving.
const GLOBAL_AGORA_JOIN_LOCKS = new Set<string>()

function formatCoins(value?: number | null) {
  return Number(value || 0).toLocaleString()
}

function getDisplayName(profile?: UserProfile | null) {
  return profile?.username || profile?.display_name || 'Troll Citizen'
}

// DB still has livekit_room_name from the old system; auctions now reuse it only as the Agora channel name.
function getAgoraChannelName(show: AuctionShow) {
  return show.livekit_room_name || `auction-${show.id}`
}

function makeAgoraUid(userId: string, role: 'viewer' | 'auctioneer') {
  let hash = role === 'auctioneer' ? 900000000 : 100000000

  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 2147483647
  }

  return Math.max(1, Math.abs(hash))
}

function getAgoraErrorMessage(error: any) {
  if (!error) return 'Unknown Agora error'

  const parts = [
    error?.name,
    error?.code,
    error?.message,
    error?.data ? JSON.stringify(error.data) : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' | ') : String(error)
}

function logAgoraError(scope: string, error: any) {
  const message = getAgoraErrorMessage(error)

  console.error(`[LiveAuctionRoom] ${scope}:`, {
    message,
    name: error?.name,
    code: error?.code,
    data: error?.data,
    stack: error?.stack,
  })

  return message
}

export default function LiveAuctionRoom() {
  const { showId } = useParams<{ showId: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [show, setShow] = useState<AuctionShow | null>(null)
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [currentLot, setCurrentLot] = useState<AuctionLot | null>(null)
  const [bids, setBids] = useState<AuctionBid[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  const [loading, setLoading] = useState(true)
  const [viewerCount, setViewerCount] = useState(0)
  const [selectedTab, setSelectedTab] = useState<'bids' | 'info' | 'lot'>('bids')

  const [bidAmount, setBidAmount] = useState('')
  const [bidStatus, setBidStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [bidError, setBidError] = useState('')

  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [auctioneerMicOn, setAuctioneerMicOn] = useState(true)
  const [auctioneerCamOn, setAuctioneerCamOn] = useState(true)
  const [auctioneerConnecting, setAuctioneerConnecting] = useState(false)
  const [agoraConnected, setAgoraConnected] = useState(false)
  const [remoteReady, setRemoteReady] = useState(false)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const localVideoRef = useRef<HTMLDivElement | null>(null)
  const remoteVideoRef = useRef<HTMLDivElement | null>(null)
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null)
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null)
  const agoraJoinedRef = useRef(false)
  const agoraConnectingRef = useRef(false)
  const activeAgoraKeyRef = useRef<string | null>(null)
  const retryTimerRef = useRef<number | null>(null)

  const presenceKey = user?.id || `anon-auction-${showId || 'unknown'}`

  const isAuctioneer = useMemo(() => {
    if (!user?.id || !show) return false
    return show.auctioneer_id === user.id
  }, [show, user?.id])

  const minimumBid = useMemo(() => {
    if (!currentLot) return 0
    const current = Number(currentLot.current_highest_bid || 0)
    return current > 0 ? current + Number(currentLot.bid_increment || 100) : Number(currentLot.starting_bid || 0)
  }, [currentLot])

  const canBid = Boolean(
    user &&
      currentLot &&
      currentLot.status === 'live' &&
      Number(userProfile?.troll_coins || 0) >= MIN_COINS_TO_BID
  )

  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, troll_coins, role, is_admin, is_superadmin')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('[LiveAuctionRoom] Failed to fetch user profile:', error)
      return
    }

    if (data) setUserProfile({ ...data, troll_coins: Number(data.troll_coins || 0) })
  }, [user?.id])

  const fetchLots = useCallback(async (auctionShowId: string) => {
    const { data, error } = await supabase
      .from('auction_lots')
      .select(`
        id,
        auction_show_id,
        title,
        description,
        image_url,
        starting_bid,
        bid_increment,
        current_highest_bid,
        current_highest_bidder_id,
        status,
        countdown_end_at,
        order_index,
        queue_position,
        reserve_price,
        buy_now_price,
        condition,
        quantity
      `)
      .eq('auction_show_id', auctionShowId)
      .neq('status', 'removed')
      .neq('status', 'remove')
      .order('queue_position', { ascending: true })

    if (error) {
      console.error('[LiveAuctionRoom] Failed to fetch lots:', error)
      return
    }

    setLots((data || []) as AuctionLot[])
  }, [])

  const cleanupAgora = useCallback(async () => {
    const keyToRelease = activeAgoraKeyRef.current

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    try {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop()
        localAudioTrackRef.current.close()
        localAudioTrackRef.current = null
      }

      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop()
        localVideoTrackRef.current.close()
        localVideoTrackRef.current = null
      }

      if (agoraClientRef.current && agoraJoinedRef.current) {
        await agoraClientRef.current.leave()
      }
    } catch (error) {
      console.warn('[LiveAuctionRoom] Agora cleanup warning:', error)
    } finally {
      if (keyToRelease) GLOBAL_AGORA_JOIN_LOCKS.delete(keyToRelease)
      agoraClientRef.current = null
      agoraJoinedRef.current = false
      agoraConnectingRef.current = false
      activeAgoraKeyRef.current = null
      setAgoraConnected(false)
      setRemoteReady(false)
    }
  }, [])

  const fetchLiveState = useCallback(async () => {
    if (!showId) return

    try {
      const { data, error } = await supabase.rpc('get_live_auction_state', {
        p_show_id: showId,
      })

      if (error) throw error

      const state = data as LiveAuctionStateRpc | null

      if (state?.current_lot) setCurrentLot(state.current_lot)
      if (Array.isArray(state?.recent_bids)) setBids(state.recent_bids)
      if (typeof state?.viewer_count === 'number') setViewerCount(state.viewer_count)
    } catch (error) {
      console.warn('[LiveAuctionRoom] get_live_auction_state failed:', error)
    }
  }, [showId])

  const fetchShow = useCallback(async () => {
    if (!showId) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('auction_shows')
        .select(`
          id,
          title,
          description,
          category,
          thumbnail_url,
          status,
          scheduled_for,
          live_started_at,
          ended_at,
          livekit_room_name,
          auctioneer_id,
          current_lot_id
        `)
        .eq('id', showId)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        setShow(null)
        toast.error('Auction not found')
        return
      }

      const nextShow = data as AuctionShow
      setShow(nextShow)

      if (nextShow.status !== 'live') {
        toast.error('This auction is not currently live')
        navigate('/auctions')
        return
      }

      await Promise.all([fetchLots(nextShow.id), fetchLiveState(), fetchUserProfile()])
    } catch (error) {
      console.error('[LiveAuctionRoom] Error fetching show:', error)
      toast.error('Failed to load auction room')
    } finally {
      setLoading(false)
    }
  }, [fetchLiveState, fetchLots, fetchUserProfile, navigate, showId])

  const markPresenceInactive = useCallback(async () => {
    if (!showId || !user?.id) return

    await supabase
      .from('auction_presence')
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq('auction_show_id', showId)
      .eq('user_id', user.id)
  }, [showId, user?.id])

  const trackPresence = useCallback(async () => {
    if (!showId || !user?.id) return

    await supabase.from('auction_presence').upsert(
      {
        auction_show_id: showId,
        user_id: user.id,
        presence_role: isAuctioneer ? 'auctioneer' : 'bidder',
        is_active: true,
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'auction_show_id,user_id' }
    )
  }, [isAuctioneer, showId, user?.id])

  const getAgoraToken = useCallback(
    async (channelName: string, uid: number, role: 'publisher' | 'audience') => {
      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: {
          channelName,
          channel: channelName,
          uid,
          role,
          isPublisher: role === 'publisher',
        },
      })

      if (error) throw error
      if (!data?.token) throw new Error('No Agora token returned')

      return data.token as string
    },
    []
  )

  const buildAgoraClient = useCallback(() => {
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })

    client.on('user-published', async (remoteUser: IAgoraRTCRemoteUser, mediaType) => {
      await client.subscribe(remoteUser, mediaType)

      if (mediaType === 'video' && remoteUser.videoTrack && remoteVideoRef.current) {
        remoteUser.videoTrack.play(remoteVideoRef.current)
        setRemoteReady(true)
      }

      if (mediaType === 'audio' && remoteUser.audioTrack) {
        remoteUser.audioTrack.play()
      }
    })

    client.on('user-unpublished', (_remoteUser, mediaType) => {
      if (mediaType === 'video') setRemoteReady(false)
    })

    client.on('user-left', () => setRemoteReady(false))

    return client
  }, [])

  const scheduleViewerReconnect = useCallback(() => {
    if (retryTimerRef.current) return

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      if (!agoraClientRef.current && !agoraJoinedRef.current && !agoraConnectingRef.current) {
        void connectViewerAgoraRef.current?.()
      }
    }, 900)
  }, [])

  const connectViewerAgoraRef = useRef<null | (() => Promise<void>)>(null)

  const connectViewerAgora = useCallback(async () => {
    if (!show || !user?.id || isAuctioneer) return

    const appId = import.meta.env.VITE_AGORA_APP_ID
    if (!appId) {
      toast.error('Agora App ID is not configured')
      return
    }

    const channelName = getAgoraChannelName(show)
    const uid = makeAgoraUid(user.id, 'viewer')
    const agoraKey = `${channelName}:${uid}:viewer`

    if (activeAgoraKeyRef.current === agoraKey || agoraConnectingRef.current || agoraJoinedRef.current || agoraClientRef.current) return

    if (GLOBAL_AGORA_JOIN_LOCKS.has(agoraKey)) {
      scheduleViewerReconnect()
      return
    }

    GLOBAL_AGORA_JOIN_LOCKS.add(agoraKey)
    activeAgoraKeyRef.current = agoraKey
    agoraConnectingRef.current = true

    try {
      const client = buildAgoraClient()
      agoraClientRef.current = client
      await client.setClientRole('audience')

      const token = await getAgoraToken(channelName, uid, 'audience')
      await client.join(appId, channelName, token, uid)

      agoraJoinedRef.current = true
      setAgoraConnected(true)
    } catch (error: any) {
      const agoraErrorMessage = logAgoraError('Viewer Agora connection failed', error)
      toast.error(agoraErrorMessage || 'Failed to connect to Agora auction stream')
      GLOBAL_AGORA_JOIN_LOCKS.delete(agoraKey)
      activeAgoraKeyRef.current = null
      await cleanupAgora()
    } finally {
      agoraConnectingRef.current = false
    }
  }, [buildAgoraClient, cleanupAgora, getAgoraToken, isAuctioneer, scheduleViewerReconnect, show, user?.id])

  useEffect(() => {
    connectViewerAgoraRef.current = connectViewerAgora
  }, [connectViewerAgora])

  const connectAuctioneerAgora = useCallback(async () => {
    if (!show || !showId || !user?.id || !isAuctioneer) return

    const appId = import.meta.env.VITE_AGORA_APP_ID
    if (!appId) {
      toast.error('Agora App ID is not configured')
      return
    }

    const channelName = getAgoraChannelName(show)
    const uid = makeAgoraUid(user.id, 'auctioneer')
    const agoraKey = `${channelName}:${uid}:auctioneer`

    if (activeAgoraKeyRef.current === agoraKey || agoraConnectingRef.current || agoraJoinedRef.current || agoraClientRef.current) return

    if (GLOBAL_AGORA_JOIN_LOCKS.has(agoraKey)) return

    GLOBAL_AGORA_JOIN_LOCKS.add(agoraKey)
    activeAgoraKeyRef.current = agoraKey
    agoraConnectingRef.current = true
    setAuctioneerConnecting(true)

    try {
      const client = buildAgoraClient()
      agoraClientRef.current = client
      await client.setClientRole('host')

      const token = await getAgoraToken(channelName, uid, 'publisher')
      await client.join(appId, channelName, token, uid)

      const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        { AEC: true, ANS: true, AGC: true },
        { encoderConfig: '720p_2', facingMode: 'user' }
      )

      localAudioTrackRef.current = micTrack
      localVideoTrackRef.current = camTrack

      if (localVideoRef.current) camTrack.play(localVideoRef.current)

      await client.publish([micTrack, camTrack])

      agoraJoinedRef.current = true
      setAgoraConnected(true)
      setAuctioneerMicOn(true)
      setAuctioneerCamOn(true)
      toast.success('Auctioneer camera connected with Agora')
    } catch (error: any) {
      const agoraErrorMessage = logAgoraError('Auctioneer Agora connection failed', error)
      toast.error(agoraErrorMessage || 'Failed to connect auctioneer camera')
      GLOBAL_AGORA_JOIN_LOCKS.delete(agoraKey)
      activeAgoraKeyRef.current = null
      await cleanupAgora()
    } finally {
      setAuctioneerConnecting(false)
      agoraConnectingRef.current = false
    }
  }, [buildAgoraClient, cleanupAgora, getAgoraToken, isAuctioneer, show, showId, user?.id])

  const toggleAuctioneerMic = useCallback(async () => {
    const track = localAudioTrackRef.current
    if (!track) return

    await track.setEnabled(!auctioneerMicOn)
    setAuctioneerMicOn((prev) => !prev)
  }, [auctioneerMicOn])

  const toggleAuctioneerCam = useCallback(async () => {
    const track = localVideoTrackRef.current
    if (!track) return

    await track.setEnabled(!auctioneerCamOn)
    setAuctioneerCamOn((prev) => !prev)
  }, [auctioneerCamOn])

  const toggleViewerAudio = useCallback(async () => {
    const client = agoraClientRef.current
    if (!client) {
      setIsMuted((prev) => !prev)
      return
    }

    const nextMuted = !isMuted

    client.remoteUsers.forEach((remoteUser) => {
      if (remoteUser.audioTrack) {
        if (nextMuted) remoteUser.audioTrack.stop()
        else remoteUser.audioTrack.play()
      }
    })

    setIsMuted(nextMuted)
  }, [isMuted])

  const placeBid = useCallback(async () => {
    if (!showId || !currentLot || !user?.id) {
      toast.error('You must be logged in to bid')
      return
    }

    const bidValue = Number.parseInt(bidAmount, 10)

    if (!Number.isFinite(bidValue) || bidValue <= 0) {
      setBidStatus('error')
      setBidError('Enter a valid bid amount')
      window.setTimeout(() => setBidStatus('idle'), 3000)
      return
    }

    if (currentLot.status !== 'live') {
      setBidStatus('error')
      setBidError('This lot is not accepting bids')
      window.setTimeout(() => setBidStatus('idle'), 3000)
      return
    }

    if (bidValue < minimumBid) {
      setBidStatus('error')
      setBidError(`Minimum bid is ${formatCoins(minimumBid)} coins`)
      window.setTimeout(() => setBidStatus('idle'), 3000)
      return
    }

    if (Number(userProfile?.troll_coins || 0) < MIN_COINS_TO_BID) {
      setBidStatus('error')
      setBidError(`Minimum ${formatCoins(MIN_COINS_TO_BID)} coins required to bid`)
      window.setTimeout(() => setBidStatus('idle'), 3000)
      return
    }

    try {
      const { data, error } = await supabase.rpc('place_bid', {
        p_show_id: showId,
        p_lot_id: currentLot.id,
        p_bid_amount: bidValue,
      })

      if (error) throw error

      const result = data as PlaceBidResult

      if (result && result.accepted === false) {
        setBidStatus('error')
        setBidError(result.reason || 'Bid failed')
        window.setTimeout(() => setBidStatus('idle'), 3000)
        return
      }

      setBidStatus('success')
      setBidAmount('')
      await Promise.all([fetchLiveState(), fetchUserProfile()])
      window.setTimeout(() => setBidStatus('idle'), 2000)
    } catch (error: any) {
      console.error('[LiveAuctionRoom] Bid failed:', error)
      setBidStatus('error')
      setBidError(error?.message || 'Failed to place bid')
      window.setTimeout(() => setBidStatus('idle'), 3000)
    }
  }, [bidAmount, currentLot, fetchLiveState, fetchUserProfile, minimumBid, showId, user?.id, userProfile?.troll_coins])

  const quickBid = useCallback((extra: number) => setBidAmount(String(minimumBid + extra)), [minimumBid])

  const formatCountdown = useCallback((countdownEnd?: string | null) => {
    if (!countdownEnd) return '0:00'

    const diff = Math.max(0, new Date(countdownEnd).getTime() - Date.now())
    const mins = Math.floor(diff / 60000)
    const secs = Math.floor((diff % 60000) / 1000)

    return `${mins}:${String(secs).padStart(2, '0')}`
  }, [])

  const handleFullscreen = useCallback(async () => {
    const container = stageRef.current
    if (!container) return

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      setIsFullscreen((prev) => !prev)
    }
  }, [])

  useEffect(() => {
    void fetchShow()
  }, [fetchShow])

  useEffect(() => {
    if (!showId) return

    const channel = supabase
      .channel(`auction-room:${showId}`, { config: { presence: { key: presenceKey } } })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_lots', filter: `auction_show_id=eq.${showId}` },
        async () => {
          await Promise.all([fetchLots(showId), fetchLiveState()])
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_bids' },
        async () => {
          await fetchLiveState()
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        let count = 0

        Object.values(state).forEach((items) => {
          count += Array.isArray(items) ? items.length : 0
        })

        setViewerCount(count)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user?.id || presenceKey,
            username: profile?.username || user?.email || 'Guest Bidder',
            role: isAuctioneer ? 'auctioneer' : 'bidder',
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack().catch(() => {})
      supabase.removeChannel(channel)
    }
  }, [fetchLiveState, fetchLots, isAuctioneer, presenceKey, profile?.username, showId, user?.email, user?.id])

  useEffect(() => {
    void trackPresence()

    const interval = window.setInterval(() => void trackPresence(), 30000)

    return () => {
      window.clearInterval(interval)
      void markPresenceInactive()
    }
  }, [markPresenceInactive, trackPresence])

  useEffect(() => {
    if (show && user?.id && !isAuctioneer) void connectViewerAgora()

    return () => {
      void cleanupAgora()
    }
  }, [cleanupAgora, connectViewerAgora, isAuctioneer, show, user?.id])

  const upcomingLots = lots.filter((lot) => lot.status === 'upcoming' || lot.status === 'queued' || lot.status === 'scheduled')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#02030a] text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-300" />
          <p className="mt-4 text-slate-400">Loading auction room...</p>
        </div>
      </div>
    )
  }

  if (!show) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#02030a] text-white">
        <div className="text-center">
          <Gavel className="mx-auto mb-4 h-16 w-16 text-slate-600" />
          <p className="text-slate-400">Auction not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02030a] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(8,13,30,0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />
      </div>

      <div className="relative z-10 border-b border-cyan-400/20 bg-black/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/auctions')} className="rounded-xl border border-cyan-400/20 bg-white/5 p-2 transition hover:bg-cyan-400/10">
              <ArrowLeft className="h-5 w-5 text-cyan-300" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="animate-pulse rounded-md bg-red-500 px-2 py-1 text-xs font-black tracking-wide">LIVE AUCTION</span>
                <span className="flex items-center gap-1 text-sm font-bold text-cyan-300">
                  <Users className="h-4 w-4" />
                  {viewerCount} watching
                </span>
              </div>
              <h1 className="text-lg font-black sm:text-xl">{show.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-cyan-400/20 bg-white/5 p-2 transition hover:bg-cyan-400/10">
              <Bell className="h-5 w-5 text-cyan-200" />
            </button>
            <button className="rounded-xl border border-purple-400/20 bg-white/5 p-2 transition hover:bg-purple-400/10">
              <Shield className="h-5 w-5 text-purple-200" />
            </button>
          </div>
        </div>
      </div>

      <main className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div ref={stageRef} className="relative aspect-video overflow-hidden rounded-3xl border border-cyan-400/25 bg-black shadow-[0_0_45px_rgba(34,211,238,0.16)]">
            {isAuctioneer ? (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-cyan-950/25 to-purple-950/25">
                <div ref={localVideoRef} className="absolute inset-0 h-full w-full bg-black" />
                {!agoraConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950/25 to-purple-950/25">
                    <Gavel className="h-16 w-16 animate-pulse text-cyan-300" />
                    <p className="mt-4 text-xl font-black text-cyan-100">Auctioneer Agora Control Room</p>
                    <p className="mt-1 text-sm text-slate-400">Your camera and microphone broadcast directly through Agora.</p>
                  </div>
                )}

                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={connectAuctioneerAgora}
                    disabled={auctioneerConnecting || agoraConnected}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 py-3 font-bold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
                  >
                    {auctioneerConnecting ? 'Connecting...' : agoraConnected ? 'Agora Connected' : 'Connect Camera'}
                  </button>

                  <button onClick={toggleAuctioneerMic} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
                    {auctioneerMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    {auctioneerMicOn ? 'Mic On' : 'Mic Off'}
                  </button>

                  <button onClick={toggleAuctioneerCam} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
                    {auctioneerCamOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    {auctioneerCamOn ? 'Camera On' : 'Camera Off'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-black">
                <div ref={remoteVideoRef} className="absolute inset-0 h-full w-full bg-black [&>div]:!h-full [&>div]:!w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover" />
                {!remoteReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950/20 to-purple-950/20">
                    <Gavel className="h-16 w-16 animate-pulse text-cyan-300" />
                    <p className="mt-4 text-xl font-black text-cyan-100">Waiting for Agora stream</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {agoraConnected ? 'Connected to the room. Waiting for auctioneer video.' : 'Connecting to Agora auction room...'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-xl bg-red-500 px-3 py-1.5 text-sm font-black text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                LIVE
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-black/70 px-3 py-1.5 text-sm text-cyan-100">
                <Users className="h-4 w-4" />
                {viewerCount}
              </span>
            </div>

            {currentLot?.countdown_end_at && (
              <div className="absolute bottom-4 left-4">
                <div
                  className={`rounded-2xl border px-4 py-2 font-mono text-2xl font-black ${
                    new Date(currentLot.countdown_end_at).getTime() - Date.now() < 10000
                      ? 'animate-pulse border-red-300 bg-red-500 text-white'
                      : 'border-cyan-300/25 bg-black/75 text-cyan-200'
                  }`}
                >
                  <Clock className="mr-2 inline h-5 w-5" />
                  {formatCountdown(currentLot.countdown_end_at)}
                </div>
              </div>
            )}

            {!isAuctioneer && (
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button onClick={toggleViewerAudio} className="rounded-xl border border-white/10 bg-black/70 p-3 hover:bg-black/50">
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <button onClick={handleFullscreen} className="rounded-xl border border-white/10 bg-black/70 p-3 hover:bg-black/50">
                  <Maximize2 className="h-5 w-5" />
                  <span className="sr-only">{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</span>
                </button>
              </div>
            )}
          </div>

          {currentLot ? (
            <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5 shadow-[0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Current Lot</p>
                  <h2 className="mt-1 text-2xl font-black">{currentLot.title}</h2>
                  {currentLot.description && <p className="mt-2 line-clamp-3 text-sm text-slate-300">{currentLot.description}</p>}
                </div>
                <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
                  {currentLot.status.toUpperCase()}
                </span>
              </div>

              {currentLot.image_url && (
                <img src={currentLot.image_url} alt={currentLot.title} className="mb-4 h-56 w-full rounded-2xl border border-white/10 object-cover" />
              )}

              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Starting Bid" value={`${formatCoins(currentLot.starting_bid)} TC`} />
                <Stat label="Bid Increment" value={`${formatCoins(currentLot.bid_increment)} TC`} />
                <Stat label="Reserve" value={currentLot.reserve_price ? `${formatCoins(currentLot.reserve_price)} TC` : 'None'} />
                <Stat label="Quantity" value={currentLot.quantity || 1} />
              </div>

              <div className="rounded-3xl border border-yellow-300/30 bg-gradient-to-r from-yellow-500/15 via-cyan-500/10 to-purple-500/15 p-5 text-center">
                <p className="text-sm font-bold text-cyan-200">Current Highest Bid</p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <Coins className="h-9 w-9 text-yellow-300" />
                  <span className="text-5xl font-black">{formatCoins(currentLot.current_highest_bid || currentLot.starting_bid)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Next minimum bid: {formatCoins(minimumBid)} coins</p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
              <Gavel className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-slate-400">No lot currently active</p>
            </div>
          )}

          {currentLot?.status === 'live' && !isAuctioneer && (
            <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <Coins className="h-6 w-6 text-yellow-300" />
                  <span className="font-bold">Your Balance: {formatCoins(userProfile?.troll_coins)} coins</span>
                </div>

                {canBid ? (
                  <span className="flex items-center gap-1 text-sm font-bold text-cyan-300">
                    <CheckCircle className="h-4 w-4" /> Eligible to bid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-bold text-red-300">
                    <XCircle className="h-4 w-4" /> Need {formatCoins(MIN_COINS_TO_BID)}+ coins
                  </span>
                )}
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2">
                {[100, 500, 1000].map((amount) => (
                  <button key={amount} onClick={() => quickBid(amount)} className="rounded-2xl border border-cyan-400/15 bg-black/35 py-3 font-black hover:bg-cyan-400/10">
                    +{formatCoins(amount)}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    placeholder={`Min: ${formatCoins(minimumBid)}`}
                    className="w-full rounded-2xl border border-cyan-400/20 bg-black/45 px-4 py-4 pr-16 text-lg text-white outline-none focus:border-cyan-300"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">coins</span>
                </div>
                <button
                  onClick={placeBid}
                  disabled={!bidAmount || !canBid}
                  className="rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-4 font-black shadow-[0_0_25px_rgba(34,211,238,0.25)] hover:from-cyan-400 hover:to-purple-400 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 sm:px-8"
                >
                  Place Bid
                </button>
              </div>

              {bidStatus === 'success' && (
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-cyan-200">
                  <CheckCircle className="h-5 w-5" />
                  Bid accepted!
                </div>
              )}

              {bidStatus === 'error' && (
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-red-200">
                  <AlertCircle className="h-5 w-5" />
                  {bidError}
                </div>
              )}
            </div>
          )}

          {upcomingLots.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-3 text-lg font-black">Upcoming Lots</h3>
              <div className="space-y-2">
                {upcomingLots.map((lot, index) => (
                  <div key={lot.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-sm font-black text-cyan-200">
                        {index + 1}
                      </span>
                      <span className="font-bold">{lot.title}</span>
                    </div>
                    <span className="text-sm font-bold text-yellow-300">Starting: {formatCoins(lot.starting_bid)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5 backdrop-blur-xl">
            <h3 className="mb-3 text-lg font-black">Auction Details</h3>
            <div className="space-y-3">
              <Info label="Show Title" value={show.title} />
              {show.category && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Gavel className="h-4 w-4 text-cyan-300" />
                  <span>{show.category}</span>
                </div>
              )}
              <Info label="Video Route" value={isAuctioneer ? 'Agora Publisher' : 'Agora Viewer'} />
              <Info label="Agora Channel" value={getAgoraChannelName(show)} />
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
            <div className="flex border-b border-white/10">
              {(['bids', 'info', 'lot'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`flex-1 py-3 text-sm font-black capitalize ${
                    selectedTab === tab ? 'border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'lot' ? 'Lots' : tab}
                </button>
              ))}
            </div>

            {selectedTab === 'bids' && (
              <div className="max-h-96 space-y-2 overflow-y-auto p-3">
                {bids.length === 0 ? (
                  <p className="py-6 text-center text-slate-500">No bids yet</p>
                ) : (
                  bids.map((bid) => {
                    const name = bid.bidder?.username || bid.bidder?.display_name || 'Anonymous'
                    return (
                      <div key={bid.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 font-black">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{name}</p>
                            <p className="text-xs text-slate-500">{new Date(bid.created_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <span className="font-black text-yellow-300">{formatCoins(bid.bid_amount)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {selectedTab === 'info' && (
              <div className="space-y-3 p-4">
                <Info label="Current Lot" value={currentLot?.title || 'None'} />
                <Info label="Minimum Increment" value={`${formatCoins(currentLot?.bid_increment)} coins`} />
                <Info label="Total Lots" value={lots.length} />
                <Info label="Logged In As" value={getDisplayName(userProfile)} />
              </div>
            )}

            {selectedTab === 'lot' && (
              <div className="max-h-96 space-y-2 overflow-y-auto p-3">
                {lots.map((lot, index) => (
                  <div key={lot.id} className={`rounded-2xl border p-3 ${lot.id === currentLot?.id ? 'border-cyan-300/30 bg-cyan-400/10' : 'border-white/10 bg-black/30'}`}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-xs font-black">{index + 1}</span>
                      <span className={`text-sm font-bold ${lot.id === currentLot?.id ? 'text-cyan-200' : 'text-white'}`}>{lot.title}</span>
                    </div>
                    <p className="ml-8 mt-1 text-xs text-slate-500">
                      {lot.status === 'sold'
                        ? `Sold: ${formatCoins(lot.current_highest_bid)}`
                        : lot.status === 'live'
                          ? `Current: ${formatCoins(lot.current_highest_bid || lot.starting_bid)}`
                          : `Starting: ${formatCoins(lot.starting_bid)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => toast.info('Report feature coming soon')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/20"
          >
            <Flag className="h-4 w-4" />
            Report Issue
          </button>
        </aside>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-black text-white">{value}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="break-words font-bold">{value}</p>
    </div>
  )
}
