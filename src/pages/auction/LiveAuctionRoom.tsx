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
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  Flag,
  Gavel,
  Heart,
  Loader2,
  Lock,
  Maximize2,
  Megaphone,
  MessageCircle,
  Mic,
  MicOff,
  Package,
  Send,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
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
const GLOBAL_AGORA_JOIN_LOCKS = new Set<string>()

const CATEGORY_CHIPS = [
  'All',
  'Collectibles',
  'Trading Cards',
  'Art & Toys',
  'Streetwear',
  'Memes',
  'Gaming',
  'Tech',
  'Sport Cards',
  'Electronics',
]

function formatCoins(value?: number | null) {
  return Number(value || 0).toLocaleString()
}

function getDisplayName(profile?: UserProfile | null) {
  return profile?.username || profile?.display_name || 'Troll Citizen'
}

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

function getBidderName(bid?: AuctionBid | null) {
  return bid?.bidder?.username || bid?.bidder?.display_name || 'Anonymous'
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function timeAgo(value?: string | null) {
  if (!value) return 'now'
  const diff = Math.max(0, Date.now() - new Date(value).getTime())
  const seconds = Math.floor(diff / 1000)
  if (seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
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
  const [selectedTab, setSelectedTab] = useState<'chat' | 'bids' | 'info' | 'lot'>('chat')

  const [bidAmount, setBidAmount] = useState('')
  const [bidStatus, setBidStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [bidError, setBidError] = useState('')
  const [chatDraft, setChatDraft] = useState('')

  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [auctioneerMicOn, setAuctioneerMicOn] = useState(true)
  const [auctioneerCamOn, setAuctioneerCamOn] = useState(true)
  const [auctioneerConnecting, setAuctioneerConnecting] = useState(false)
  const [agoraConnected, setAgoraConnected] = useState(false)
  const [remoteReady, setRemoteReady] = useState(false)

  // Display text (announcement from auctioneer)
  const [displayText, setDisplayText] = useState<string>('')

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

  const currentBid = useMemo(() => {
    if (!currentLot) return 0
    return Number(currentLot.current_highest_bid || currentLot.starting_bid || 0)
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
          current_lot_id,
          display_text
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
      setDisplayText((data as any).display_text || '')

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

  const sendChatPlaceholder = useCallback(() => {
    if (!chatDraft.trim()) return
    toast.info('Auction chat wiring comes next. Bid system is already live.')
    setChatDraft('')
  }, [chatDraft])

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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auction_shows',
          filter: `id=eq.${showId}`,
        },
        (payload: any) => {
          if (payload.new?.display_text !== undefined) {
            setDisplayText(payload.new.display_text || '')
          }
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
  const visibleNextLots = upcomingLots.length > 0 ? upcomingLots : lots.filter((lot) => lot.id !== currentLot?.id).slice(0, 6)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07091a] text-white">
        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.04] px-10 py-8 text-center shadow-[0_0_60px_rgba(34,211,238,0.18)] backdrop-blur-xl">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-300" />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.25em] text-cyan-100">Loading auction room</p>
        </div>
      </div>
    )
  }

  if (!show) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07091a] text-white">
        <div className="text-center">
          <Gavel className="mx-auto mb-4 h-16 w-16 text-slate-600" />
          <p className="text-slate-400">Auction not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08091c] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.20),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.16),transparent_36%),linear-gradient(135deg,#08091c,#11122b_48%,#0b1024)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.07)_1px,transparent_1px)] bg-[size:44px_44px] opacity-25" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
      </div>

      <header className="relative z-20 border-b border-cyan-300/15 bg-[#07091a]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between px-4 py-3 lg:px-7">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/auctions')}
              className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-100 transition hover:bg-cyan-400/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <button
              onClick={() => navigate('/')}
              className="group flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_25px_rgba(34,211,238,0.18)]">
                <Gavel className="h-5 w-5 text-cyan-200" />
              </div>
              <div>
                <p className="bg-gradient-to-r from-cyan-200 via-sky-200 to-purple-200 bg-clip-text text-xl font-black uppercase tracking-[0.25em] text-transparent">
                  Troll City
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Live Auctions</p>
              </div>
            </button>

            <nav className="hidden items-center gap-1 xl:flex">
              {['Live Auction', 'Marketplace', 'Troll Coins', 'How It Works', 'Community'].map((item) => (
                <button
                  key={item}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                    item === 'Live Auction'
                      ? 'bg-cyan-400/10 text-cyan-100 shadow-[inset_0_-2px_0_rgba(34,211,238,0.7)]'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-2xl border border-cyan-300/15 bg-black/35 px-4 py-2 md:flex">
              <Coins className="h-5 w-5 text-yellow-300" />
              <div>
                <p className="text-sm font-black">{formatCoins(userProfile?.troll_coins || 0)}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Troll Coins</p>
              </div>
            </div>

            <button className="rounded-2xl border border-cyan-400/20 bg-white/[0.04] p-2.5 text-cyan-100 hover:bg-cyan-400/10">
              <Bell className="h-5 w-5" />
            </button>

            <button className="rounded-2xl border border-purple-400/20 bg-white/[0.04] p-2.5 text-purple-100 hover:bg-purple-400/10">
              <Shield className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 lg:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-black">
                {getInitials(profile?.username || user?.email || 'TC')}
              </div>
              <div>
                <p className="text-sm font-black">{profile?.username || user?.email || 'Guest'}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-200">Viewer</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-4 overflow-x-auto px-4 pb-3 lg:px-7">
          <div className="flex min-w-max items-center gap-3">
            {CATEGORY_CHIPS.map((category) => (
              <button
                key={category}
                className={`rounded-2xl border px-5 py-2 text-xs font-black transition ${
                  category === 'All' || category === show.category
                    ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.16)]'
                    : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <button className="hidden min-w-max items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300/30 lg:flex">
            <CalendarDays className="h-4 w-4 text-cyan-200" />
            Calendar
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1920px] grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.72fr)] xl:grid-cols-[minmax(0,1.05fr)_560px_510px] lg:p-7">
        <section className="space-y-5">
          <div
            ref={stageRef}
            className="relative aspect-video overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-black shadow-[0_0_50px_rgba(34,211,238,0.16)]"
          >
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
              <span className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-black/70 px-3 py-1.5 text-sm font-bold text-cyan-100">
                <Eye className="h-4 w-4" />
                {formatCoins(viewerCount)}
              </span>
            </div>

            <div className="absolute left-4 top-16 max-w-[70%]">
              <p className="rounded-2xl border border-white/10 bg-black/65 px-4 py-2 text-sm font-black text-white backdrop-blur-md">
                {show.title}
              </p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4">
              <div className="h-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-pink-500" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm font-bold">
                  <Volume2 className="h-4 w-4 text-cyan-200" />
                  <span className="text-white">LIVE</span>
                </div>

                {!isAuctioneer && (
                  <div className="flex gap-2">
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
            </div>
          </div>

          {/* Display Text / Announcement Panel — visible to all viewers */}
          {displayText && (
            <div className="rounded-[1.75rem] border border-cyan-300/20 bg-gradient-to-br from-[#0c1a32]/90 to-[#0a1628]/90 p-5 shadow-[0_0_35px_rgba(34,211,238,0.1)] backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10">
                  <Megaphone className="h-4 w-4 text-cyan-300" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">Auctioneer Announcement</h3>
                <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                {displayText}
              </div>
            </div>
          )}

          <CurrentLotCard currentLot={currentLot} show={show} />

          <HostCard show={show} bids={bids} />

          {visibleNextLots.length > 0 && (
            <div className="rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.04] p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100">Next Lots</h3>
                <button className="flex items-center gap-1 text-sm font-bold text-cyan-300 hover:text-cyan-100">
                  View All Lots
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {visibleNextLots.slice(0, 5).map((lot) => (
                  <div key={lot.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:border-cyan-300/30">
                    <div className="aspect-square bg-slate-900">
                      {lot.image_url ? (
                        <img src={lot.image_url} alt={lot.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-950/40 to-purple-950/40">
                          <Package className="h-10 w-10 text-cyan-200/50" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-xs font-black text-white">{lot.title}</p>
                      <p className="mt-1 text-xs font-bold text-cyan-300">Starts in {formatCoins(lot.starting_bid)} TC</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-5 xl:block">
          <div className="rounded-[1.75rem] border border-cyan-300/20 bg-[#0c1329]/80 p-5 shadow-[0_0_45px_rgba(34,211,238,0.14)] backdrop-blur-2xl">
            <div className="rounded-[1.35rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-400/10 via-blue-500/10 to-purple-500/10 p-5">
              <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-slate-300">Current Bid</p>

              <div className="mt-4 flex items-center justify-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-yellow-300/25 bg-yellow-400/10">
                  <Coins className="h-8 w-8 text-yellow-300" />
                </div>
                <div>
                  <p className="bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-300 bg-clip-text text-6xl font-black leading-none text-transparent">
                    {formatCoins(currentBid)}
                  </p>
                  <p className="mt-1 text-center text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Troll Coins</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 px-4 py-4 text-center">
                <div className="flex items-center justify-center gap-4 font-mono text-3xl font-black text-slate-200">
                  <Clock className="h-7 w-7 text-cyan-300" />
                  <span>{currentLot?.countdown_end_at ? formatCountdown(currentLot.countdown_end_at) : '0:00'}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-400">Auction ends soon. Stay in it to win it.</p>
              </div>

              <div className="mt-5 text-center">
                <p className="text-xs font-bold text-slate-400">Minimum Next Bid</p>
                <p className="mt-1 text-2xl font-black text-white">
                  <Coins className="mr-2 inline h-5 w-5 text-yellow-300" />
                  {formatCoins(minimumBid)}
                </p>
              </div>

              {!isAuctioneer && (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[100, 250, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => quickBid(amount)}
                        disabled={!canBid}
                        className="rounded-2xl border border-cyan-300/20 bg-black/35 px-3 py-3 text-left transition hover:border-cyan-300/45 hover:bg-cyan-400/10 disabled:opacity-50"
                      >
                        <p className="text-lg font-black text-cyan-100">+{formatCoins(amount)}</p>
                        <p className="text-xs text-slate-400">{formatCoins(minimumBid + amount)}</p>
                      </button>
                    ))}

                    <div className="rounded-2xl border border-purple-300/20 bg-black/35 px-3 py-3">
                      <input
                        type="number"
                        value={bidAmount}
                        onChange={(event) => setBidAmount(event.target.value)}
                        placeholder="Custom"
                        className="w-full bg-transparent text-sm font-black text-white outline-none placeholder:text-slate-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">coins</p>
                    </div>
                  </div>

                  <button
                    onClick={placeBid}
                    disabled={!bidAmount || !canBid}
                    className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 px-6 py-4 text-lg font-black uppercase tracking-[0.18em] text-white shadow-[0_0_30px_rgba(34,211,238,0.22)] transition hover:scale-[1.01] hover:from-purple-500 hover:to-cyan-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400"
                  >
                    Place Bid
                    <ChevronRight className="h-6 w-6" />
                  </button>

                  <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-cyan-200">
                    <Coins className="h-4 w-4 text-yellow-300" />
                    Bid with Troll Coins
                  </div>

                  <p className="mt-3 text-center text-sm text-slate-400">
                    You have <span className="font-black text-white">{formatCoins(userProfile?.troll_coins || 0)}</span> Troll Coins.
                  </p>

                  {bidStatus === 'success' && (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-cyan-200">
                      <CheckCircle className="h-5 w-5" />
                      Bid accepted!
                    </div>
                  )}

                  {bidStatus === 'error' && (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-red-200">
                      <AlertCircle className="h-5 w-5" />
                      {bidError}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <ActionButton icon={<Heart className="h-4 w-4" />} label="Watchlist" value="245" />
              <ActionButton icon={<Share2 className="h-4 w-4" />} label="Share" />
              <ActionButton icon={<Flag className="h-4 w-4" />} label="Report" danger />
            </div>
          </div>
        </section>

        <aside className="space-y-5 lg:col-span-2 xl:col-span-1">
          <div className="overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.04] shadow-[0_0_35px_rgba(34,211,238,0.10)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-cyan-200" />
                <h3 className="font-black">Live Chat</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {formatCoins(viewerCount)} online
                </span>
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              </div>
            </div>

            <div className="max-h-[280px] space-y-3 overflow-y-auto p-4">
              {bids.slice(0, 5).map((bid) => {
                const name = getBidderName(bid)
                return (
                  <div key={`chat-${bid.id}`} className="flex gap-3">
                    <BidAvatar name={name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-black text-white">{name}</p>
                        <p className="text-xs text-slate-500">{new Date(bid.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                      <p className="text-sm text-slate-300">
                        Bid <span className="font-black text-yellow-300">{formatCoins(bid.bid_amount)}</span> coins 🔥
                      </p>
                    </div>
                  </div>
                )
              })}

              {bids.length === 0 && (
                <div className="py-8 text-center">
                  <MessageCircle className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-sm text-slate-500">No live messages yet.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-white/10 p-4">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendChatPlaceholder()
                }}
                placeholder="Say something..."
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
              />
              <button
                onClick={sendChatPlaceholder}
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-black text-white"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.04] shadow-[0_0_35px_rgba(34,211,238,0.10)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="font-black">Bid History</h3>
              <button onClick={() => setSelectedTab('bids')} className="text-sm font-bold text-cyan-300 hover:text-cyan-100">
                View All
              </button>
            </div>

            <div className="max-h-[280px] space-y-2 overflow-y-auto p-4">
              {bids.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No bids yet</p>
              ) : (
                bids.slice(0, 7).map((bid) => {
                  const name = getBidderName(bid)
                  return (
                    <div key={bid.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center gap-3">
                        <BidAvatar name={name} />
                        <p className="text-sm font-black text-white">{name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-yellow-300">
                          <Coins className="mr-1 inline h-4 w-4" />
                          {formatCoins(bid.bid_amount)}
                        </p>
                        <p className="text-xs text-slate-500">{timeAgo(bid.created_at)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <TrustSafetyPanel />

          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl">
            <div className="flex border-b border-white/10">
              {(['chat', 'bids', 'info', 'lot'] as const).map((tab) => (
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

            {selectedTab === 'info' && (
              <div className="space-y-3 p-4">
                <InfoRow label="Show Title" value={show.title} />
                <InfoRow label="Category" value={show.category || 'Live Auction'} />
                <InfoRow label="Video Route" value={isAuctioneer ? 'Agora Publisher' : 'Agora Viewer'} />
                <InfoRow label="Agora Channel" value={getAgoraChannelName(show)} />
                <InfoRow label="Logged In As" value={getDisplayName(userProfile)} />
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

            {(selectedTab === 'chat' || selectedTab === 'bids') && (
              <div className="p-4 text-center text-sm text-slate-500">
                Use the main {selectedTab === 'chat' ? 'Live Chat' : 'Bid History'} panel above.
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}

function CurrentLotCard({ currentLot, show }: { currentLot: AuctionLot | null; show: AuctionShow }) {
  if (!currentLot) {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-10 text-center backdrop-blur-xl">
        <Gavel className="mx-auto mb-4 h-12 w-12 text-slate-600" />
        <p className="text-slate-400">No lot currently active</p>
      </div>
    )
  }

  return (
    <div className="rounded-[1.75rem] border border-cyan-400/20 bg-white/[0.04] p-4 shadow-[0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-[270px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/35">
          {currentLot.image_url ? (
            <img src={currentLot.image_url} alt={currentLot.title} className="h-full min-h-[220px] w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[220px] w-full items-center justify-center bg-gradient-to-br from-cyan-950/40 to-purple-950/40">
              <Package className="h-16 w-16 text-cyan-200/50" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-purple-300/30 bg-purple-400/15 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-purple-100">
                Featured Lot
              </span>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                {currentLot.status}
              </span>
            </div>

            <h2 className="text-2xl font-black text-white">{currentLot.title}</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">{show.category || 'Live Auction'}</p>

            {currentLot.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
                {currentLot.description}
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Condition" value={currentLot.condition || 'Verified'} />
            <Stat label="Starting Bid" value={`${formatCoins(currentLot.starting_bid)} TC`} />
            <Stat label="Increment" value={`${formatCoins(currentLot.bid_increment)} TC`} />
            <Stat label="Quantity" value={currentLot.quantity || 1} />
          </div>
        </div>
      </div>
    </div>
  )
}

function HostCard({ show, bids }: { show: AuctionShow; bids: AuctionBid[] }) {
  return (
    <div className="rounded-[1.75rem] border border-purple-300/20 bg-white/[0.04] p-4 backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/30 bg-gradient-to-br from-cyan-500 to-purple-600 text-lg font-black shadow-[0_0_25px_rgba(34,211,238,0.18)]">
            TC
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Host / Auctioneer</p>
            <h3 className="text-xl font-black">Troll City Auctioneer</h3>
            <p className="text-sm text-slate-400">{show.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniMetric icon={<Sparkles className="h-4 w-4 text-yellow-300" />} label="Rating" value="4.9" />
          <MiniMetric icon={<Store className="h-4 w-4 text-cyan-300" />} label="Lots" value={bids.length || 0} />
          <MiniMetric icon={<Zap className="h-4 w-4 text-purple-300" />} label="Live" value="Now" />
        </div>
      </div>
    </div>
  )
}

function TrustSafetyPanel() {
  const items = [
    {
      icon: <Lock className="h-7 w-7 text-cyan-300" />,
      title: 'Secure Payments',
      text: 'Protected by Troll Coins',
    },
    {
      icon: <BadgeCheck className="h-7 w-7 text-cyan-300" />,
      title: 'Verified Sellers',
      text: 'Identity and item reviewed',
    },
    {
      icon: <Sparkles className="h-7 w-7 text-cyan-300" />,
      title: 'Fair Auctions',
      text: 'Real-time transparent bidding',
    },
    {
      icon: <Truck className="h-7 w-7 text-cyan-300" />,
      title: 'Fast Delivery',
      text: 'Shipping handled by seller',
    },
  ]

  return (
    <div className="rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.04] p-5 backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">Trust & Safety</p>
      <h3 className="mt-1 font-black text-white">Our Promise to You</h3>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10">
              {item.icon}
            </div>
            <p className="text-sm font-black text-white">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  danger?: boolean
}) {
  return (
    <button
      onClick={() => toast.info(`${label} feature coming soon`)}
      className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition ${
        danger
          ? 'border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/20'
          : 'border-white/10 bg-black/30 text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-400/10'
      }`}
    >
      {icon}
      <span>{label}</span>
      {value && <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-slate-300">{value}</span>}
    </button>
  )
}

function BidAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-gradient-to-br from-cyan-400 to-purple-600 text-xs font-black text-white">
      {getInitials(name)}
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

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3 text-center">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white/5">
        {icon}
      </div>
      <p className="font-black text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="break-words font-bold text-white">{value}</p>
    </div>
  )
}