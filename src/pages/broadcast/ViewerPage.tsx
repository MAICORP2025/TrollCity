import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Crown,
  Gift,
  Loader2,
  LogOut,
  MessageSquare,
  Pin,
  Plus,
  Share2,
  Users,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorPlay,
  Shield,
  X,
} from 'lucide-react'
import type { LocalAudioTrack, LocalVideoTrack, RemoteParticipant, RemoteTrackPublication, RemoteVideoTrack } from 'livekit-client'
import { RoomEvent, Track } from 'livekit-client'
import { motion, AnimatePresence } from 'framer-motion'

import type { Stream } from '../../types/broadcast'
import type { BroadcastGift } from '../../hooks/useBroadcastRealtime'
import { supabase, getBlockedUserIds } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import { getLiveKitRoomName } from '../../lib/liveUtils'
import { isStaffProfile } from '../../lib/staff'
import {
  getAnonymousDisplayName,
  isAnonymousDisplayName,
  reserveAnonymousChatSlot,
} from '../../lib/anonymousIdentity'

import BroadcastNeonHeader from '../../components/broadcast/BroadcastNeonHeader'
import ErrorBoundary from '../../components/ErrorBoundary'
import GiftBoxModal from '../../components/broadcast/GiftBoxModal'
import GiftVideoOverlay from '../../components/broadcast/GiftVideoOverlay'
import UserActionModal from '../../components/broadcast/UserActionModal'
import { getGiftVisualConfig } from '../../lib/giftVisuals'


import { GiftSystemProvider } from '../../lib/hooks/useGiftSystem'
import BattleView from '../../pages/broadcast/BattleView'
import { useBoxCount } from '../../hooks/useBoxCount'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { useBroadcastFrame } from '@/hooks/useBroadcastFrame'
import BroadcastFrame from '@/components/broadcast/BroadcastFrame'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useUserLeagues } from '../../hooks/useUserLeagues'
import LeagueProgressPanel from '../../components/broadcast/LeagueProgressPanel'
import useLiveKitRoom from '../../hooks/useLiveKitRoom'
import { useStreamRealtime } from '../../hooks/useStreamRealtime'
import { useStreamSeats } from '../../hooks/useStreamSeats'
import { useStreamAudiencePresence } from '../../hooks/useStreamAudiencePresence'
import { AudienceBubbleTicker } from '../../components/broadcast/AudienceBubbleTicker'
import { TopSubscribersBar } from '../../components/broadcast/TopSubscribersBar'
import { useSubscriberUsernames, useCreatorSubscription } from '../../hooks/useCreatorSubscription'
import SubscriptionTierSelector from '../../components/user/SubscriptionTierSelector'
import { useStreamTopGifters } from '../../hooks/useStreamTopGifters'
import { resolveUsername, DEFAULT_USERNAME } from '../../lib/chatUtils'
import { getBroadcastChatLockRemainingMs, isBroadcastChatLockActive } from '../../lib/broadcastModeration'
import { useTrollFamilyActivity } from '../../hooks/useTrollFamilyActivity'
import { useBroadcastTextPopup } from '../../hooks/useBroadcastTextPopup'
import { useBroadcastViewerCap } from '../../hooks/useBroadcastViewerCap'
import { logActiveChannels } from '../../lib/realtimeChannelDiagnostics'
import BroadcastTextPopupOverlay from '../../components/broadcast/BroadcastTextPopupOverlay'
import PaidChatViewerModal from '../../components/broadcast/PaidChatViewerModal'
import RandomBattleBanner from '../../components/broadcast/RandomBattleBanner'
import CityStatusPanel from '../../components/city/CityStatusPanel'
import CityStatusOrb from '../../components/city/CityStatusOrb'
import { useCityStatusOrb } from '../../lib/hooks/useCityStatusOrb'
import SeatCityStatusOrb from '../../components/broadcast/SeatCityStatusOrb'
import { useGhostMode } from '../../hooks/useGhostMode'
import { useChatBlockStatus } from '../../hooks/useChatBlockStatus'
import { useBroadcastRecorder } from '../../hooks/useBroadcastRecorder'

// Import theme constants
import { trollCityBroadcastTheme } from '../../styles/broadcastTheme'

const theme = trollCityBroadcastTheme

function getDisplayName(profile: any, fallback = 'Troll City') {
  return (
    profile?.display_name ||
    profile?.username ||
    profile?.email?.split?.('@')?.[0] ||
    fallback
  )
}

function isStreamActive(stream: Stream | null): boolean {
  if (!stream) return false
  const status = String((stream as any).status || '').toLowerCase()
  return status === 'starting' || status === 'live' || (stream as any).is_live === true
}

function isStreamEnded(stream: Stream | null): boolean {
  if (!stream) return true
  const status = String((stream as any).status || '').toLowerCase()
  return status === 'ended' || (stream as any).ended_at != null
}

const KICK_BAN_DURATION_MS = 24 * 60 * 60 * 1000
const MAX_TOTAL_BOXES = 8

function getKickStorageKey(streamId: string, userId: string) {
  return `kick_${streamId}_${userId}`
}

function parseKickData(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isKickBanActive(kickData: any) {
  if (!kickData || typeof kickData.timestamp !== 'number') return false
  return Date.now() - kickData.timestamp < KICK_BAN_DURATION_MS
}

function getSeatPriceForIndex(stream: Stream | null, seatIndex: number) {
  if (!stream) return 0

  if (Array.isArray((stream as any)?.seat_prices) && typeof (stream as any).seat_prices[seatIndex] === 'number') {
    return Number((stream as any).seat_prices[seatIndex])
  }

  return Number((stream as any)?.seat_price ?? 0)
}

/**
 * ViewerPage must NOT render BroadcastGrid.
 *
 * BroadcastGrid is a broadcaster/stage composition component. On the watch page it
 * was creating the extra profile-card box plus the real camera box underneath it.
 * This page renders the host video and stage video surfaces directly instead.
 */
function getParticipantIdentity(participant: any): string {
  return String(
    participant?.identity ||
      participant?.participantIdentity ||
      participant?.name ||
      participant?.metadata?.user_id ||
      participant?.metadata?.userId ||
      '',
  )
}

function getParticipantMetadata(participant: any): any {
  const raw = participant?.metadata

  if (!raw) return {}
  if (typeof raw === 'object') return raw

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function participantMatchesUser(participant: any, userId?: string | null) {
  if (!participant || !userId) return false

  const identity = getParticipantIdentity(participant)
  const metadata = getParticipantMetadata(participant)

  return (
    identity === userId ||
    identity.includes(userId) ||
    identity.endsWith(`-${userId}`) ||
    identity.startsWith(`${userId}-`) ||
    metadata.user_id === userId ||
    metadata.userId === userId
  )
}

// Interfaces for isolated track state management
interface SeatState {
  participant: any
  videoTrack: any
  audioTrack: any
  isLoading: boolean
  userId: string | null
}

interface BroadcasterState {
  participant: any
  videoTrack: any
  audioTrack: any
}

function getVideoTrackFromParticipant(participant: any): RemoteVideoTrack | null {
  if (!participant) return null

  const directCandidates = [
    participant.videoTrack,
    participant.cameraTrack,
    participant.track,
    participant.video,
  ]

  for (const candidate of directCandidates) {
    if (candidate?.attach && candidate?.kind === Track.Kind.Video) {
      return candidate as RemoteVideoTrack
    }

    if (candidate?.attach && candidate?.mediaStreamTrack?.kind === 'video') {
      return candidate as RemoteVideoTrack
    }
  }

  const publications: RemoteTrackPublication[] = []

  const collectFromMap = (maybeMap: any) => {
    if (!maybeMap) return

    if (typeof maybeMap.values === 'function') {
      publications.push(...Array.from(maybeMap.values()) as RemoteTrackPublication[])
      return
    }

    if (Array.isArray(maybeMap)) {
      publications.push(...maybeMap)
    }
  }

  collectFromMap(participant.videoTrackPublications)
  collectFromMap(participant.trackPublications)
  collectFromMap(participant.tracks)
  collectFromMap(participant.publications)

  const cameraPub =
    publications.find((pub: any) => pub?.source === Track.Source.Camera && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.source !== Track.Source.Microphone && pub?.kind === Track.Kind.Video && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.kind === Track.Kind.Video && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.track?.kind === Track.Kind.Video && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.track?.mediaStreamTrack?.kind === 'video' && pub?.track?.attach)

  return (cameraPub?.track as RemoteVideoTrack) || null
}

function getAudioTrackFromParticipant(participant: any): any {
  if (!participant) return null

  const publications: any[] = []

  const collectFromMap = (maybeMap: any) => {
    if (!maybeMap) return

    if (typeof maybeMap.values === 'function') {
      publications.push(...Array.from(maybeMap.values()))
      return
    }

    if (Array.isArray(maybeMap)) {
      publications.push(...maybeMap)
    }
  }

  collectFromMap(participant.audioTrackPublications)
  collectFromMap(participant.trackPublications)
  collectFromMap(participant.tracks)
  collectFromMap(participant.publications)

  const audioPub =
    publications.find((pub: any) => pub?.source === Track.Source.Microphone && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.kind === Track.Kind.Audio && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.track?.kind === Track.Kind.Audio && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.track?.mediaStreamTrack?.kind === 'audio' && pub?.track?.attach)

  return audioPub?.track || null
}

const RemoteVideoSurface = memo(function RemoteVideoSurface({
  participant,
  mirror = true,
  className,
  fallback,
  onTap,
  room,
  objectFit = 'cover',
}: {
  participant: any
  mirror?: boolean
  className?: string
  fallback: React.ReactNode
  onTap?: () => void
  room?: any
  objectFit?: 'cover' | 'contain'
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Track version tick — incremented on room events only.
  // LiveKit mutates RemoteParticipant objects in place, so the videoTrack
  // dependency alone won't trigger re-attach when a track is subscribed.
  const [trackTick, setTrackTick] = useState(0)

  // Listen to room events to force re-evaluation when tracks change.
  useEffect(() => {
    if (!room) return
    const bump = () => setTrackTick(t => t + 1)
    room.on(RoomEvent.TrackSubscribed, bump)
    room.on(RoomEvent.TrackUnsubscribed, bump)
    room.on(RoomEvent.ParticipantConnected, bump)
    room.on(RoomEvent.ParticipantDisconnected, bump)
    return () => {
      room.off(RoomEvent.TrackSubscribed, bump)
      room.off(RoomEvent.TrackUnsubscribed, bump)
      room.off(RoomEvent.ParticipantConnected, bump)
      room.off(RoomEvent.ParticipantDisconnected, bump)
    }
  }, [room])

  // Recompute tracks on every render + tick change.
  // Do NOT memoize by participant reference — LiveKit mutates in place.
  const videoTrack = getVideoTrackFromParticipant(participant)
  const audioTrack = getAudioTrackFromParticipant(participant)

  const shouldMirror = useMemo(() => {
    if (!mirror) return false
    const stream = videoTrack?.mediaStreamTrack || (videoTrack as any)?._mediaStreamTrack
    const settings = stream?.getSettings?.() || {}
    const facing = (settings as any).facingMode
    if (facing && facing !== 'environment') return false
    return true
  }, [videoTrack, mirror])

  // Dev logging for track detection on mobile/PWA
  if (import.meta.env.DEV && trackTick > 0 && trackTick % 5 === 0) {
    console.debug('[RemoteVideoSurface] track check:', {
      participantIdentity: getParticipantIdentity(participant),
      hasVideo: !!videoTrack,
      hasAudio: !!audioTrack,
      shouldMirror,
      trackTick,
    })
  }

// Stable identity for the underlying media stream track.
   // This prevents unnecessary detach/attach when trackTick bumps due to
   // unrelated room events (e.g. another participant joining a seat).
   const videoTrackId = videoTrack?.mediaStreamTrack?.id || videoTrack?.sid || null
   const audioTrackId = audioTrack?.mediaStreamTrack?.id || audioTrack?.sid || null

  // Use refs to track what we actually attached, so we only detach/reattach
  // when the underlying track identity truly changes.
  const attachedVideoIdRef = useRef<string | null>(null)
  const attachedAudioIdRef = useRef<string | null>(null)

   useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return

    // Only (re-)attach if the track identity actually changed.
    // When videoTrack temporarily goes null (brief renegotiation), we keep the
    // last attached track on the element so the stream stays visible.
    if (videoTrackId !== attachedVideoIdRef.current) {
      // Detach previous track if we had one attached and are replacing it
      if (attachedVideoIdRef.current !== null && videoTrack) {
        try {
          videoTrack?.detach?.(videoEl)
        } catch {
          // ignore
        }
      }

      if (videoTrack) {
        try {
          videoTrack.attach(videoEl)
          videoEl.style.transform = shouldMirror ? 'scaleX(-1)' : 'none'
          videoEl.play().catch(() => {})
        } catch (err) {
          console.warn('[ViewerPage] Failed to attach remote video track:', err)
        }
        attachedVideoIdRef.current = videoTrackId
      }
      // If videoTrack is null, intentionally do NOT update attachedVideoIdRef.
      // This preserves the previous track on the video element and prevents
      // flicker to fallback during brief track unsubscriptions.
    }
  }, [videoTrack, videoTrackId, trackTick, shouldMirror])

  useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl) return

    // Only (re-)attach if the track identity actually changed
    if (audioTrackId !== attachedAudioIdRef.current) {
      // Detach previous track if we had one attached
      if (attachedAudioIdRef.current !== null) {
        try {
          audioTrack?.detach?.(audioEl)
        } catch {
          // ignore
        }
      }

      if (audioTrack) {
        try {
          audioTrack.attach(audioEl)
          audioEl.play().catch(() => {})
        } catch (err) {
          console.warn('[ViewerPage] Failed to attach remote audio track:', err)
        }
      }
      attachedAudioIdRef.current = audioTrackId
    }
  }, [audioTrack, audioTrackId, trackTick])

   return (
    <div
      onClick={() => onTap && onTap()}
      className={cn('relative h-full w-full overflow-hidden bg-black', onTap && 'cursor-pointer', className)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={cn(
          'h-full w-full',
          objectFit === 'contain' ? 'object-contain' : 'object-cover',
          shouldMirror && '-scale-x-100',
        )}
      />
      <audio ref={audioRef} autoPlay />
      {!videoTrack && !attachedVideoIdRef.current && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback}
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparator for React.memo — returns true to SKIP re-render.
  // Only re-render when the participant's actual track identity changes.

  const prevVideo = getVideoTrackFromParticipant(prevProps.participant)
  const nextVideo = getVideoTrackFromParticipant(nextProps.participant)
  const prevAudio = getAudioTrackFromParticipant(prevProps.participant)
  const nextAudio = getAudioTrackFromParticipant(nextProps.participant)

  // Compare MediaStreamTrack IDs — the actual browser-level track identity
  const prevVideoId = prevVideo?.mediaStreamTrack?.id || null
  const nextVideoId = nextVideo?.mediaStreamTrack?.id || null
  const prevAudioId = prevAudio?.mediaStreamTrack?.id || null
  const nextAudioId = nextAudio?.mediaStreamTrack?.id || null

  // Also compare the track SID (LiveKit-level identity) as fallback
  const prevVideoSid = prevVideo?.sid || null
  const nextVideoSid = nextVideo?.sid || null
  const prevAudioSid = prevAudio?.sid || null
  const nextAudioSid = nextAudio?.sid || null

  const tracksUnchanged =
    prevVideoId === nextVideoId &&
    prevAudioId === nextAudioId &&
    prevVideoSid === nextVideoSid &&
    prevAudioSid === nextAudioSid

  // Also check non-track props
  const otherPropsUnchanged =
    prevProps.mirror === nextProps.mirror &&
    prevProps.className === nextProps.className &&
    prevProps.onTap === nextProps.onTap &&
    prevProps.room === nextProps.room

  // Return true = skip re-render (props are "equal")
  return tracksUnchanged && otherPropsUnchanged
})

function LocalVideoSurface({
  videoTrack,
  audioTrack,
  mirror = true,
  className,
  fallback,
}: {
  videoTrack: LocalVideoTrack | null
  audioTrack: LocalAudioTrack | null
  mirror?: boolean
  className?: string
  fallback: React.ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !videoTrack) return

    try {
      videoTrack.attach(videoEl)
      videoEl.style.transform = mirror ? 'scaleX(-1)' : 'none'
      videoEl.play().catch(() => {})
    } catch (err) {
      console.warn('[ViewerPage] Failed to attach local video track:', err)
    }

    return () => {
      try {
        videoTrack.detach(videoEl)
      } catch {
        // ignore detach errors
      }
    }
  }, [videoTrack])

  useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl || !audioTrack) return

    try {
      audioTrack.attach(audioEl)
      audioEl.play().catch(() => {})
    } catch (err) {
      console.warn('[ViewerPage] Failed to attach local audio track:', err)
    }

    return () => {
      try {
        audioTrack.detach(audioEl)
      } catch {
        // ignore detach errors
      }
    }
  }, [audioTrack])

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      {videoTrack ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={true}
            className={cn('h-full w-full object-cover', mirror && '-scale-x-100')}
          />
          <audio ref={audioRef} autoPlay />
        </>
      ) : (
        fallback
      )}
    </div>
  )
}

function ViewerPage() {
  const params = useParams()
  const streamId = params.streamId || params.id || ''

  // Startup log to confirm route resolution (important for PWA/mobile)
  useEffect(() => {
    try {
      console.log('[ViewerPage] route streamId resolved', {
        pathname: typeof window !== 'undefined' ? window.location.pathname : null,
        streamId,
        params,
      })
    } catch (e) {
      console.warn('[ViewerPage] route streamId log failed', e)
    }
  }, [streamId])

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobileWidth, hasMounted } = useIsMobile()
  const isMobileViewer = hasMounted && isMobileWidth
  const { recordWatchTime } = useTrollFamilyActivity()

  // Ghost drop-in mode: detect ?ghost=true from URL (set by GhostDropInRouter)
  const [isGhostDropIn, setIsGhostDropIn] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('ghost') === 'true' && !user) {
      setIsGhostDropIn(true)
    }
  }, [location.search, user])

  // Broadcast Text Popup (viewers can only receive, not send)
  const {
    activePopup: activeTextPopup,
  } = useBroadcastTextPopup({
    streamId: streamId || '',
    currentUserId: user?.id,
    currentUsername: profile?.username,
    canSend: false, // Viewers cannot send popups
  })

  // Broadcast viewer cap
  const {
    viewerCapEnabled,
    viewerCapMax,
    allRestrictionsDisabled,
    isStreamViewerCapped,
  } = useBroadcastViewerCap()

  // Broadofficer appointment popup state
  const [broadofficerPopup, setBroadofficerPopup] = useState<{ visible: boolean; message: string; streamId: string } | null>(null)

  // Refresh current user profile without full logout/login
  const refreshCurrentUserProfile = useCallback(async () => {
    const { user: currentUser } = useAuthStore.getState()
    if (!currentUser?.id) return
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()
      if (data) {
        useAuthStore.getState().setProfile(data as any, { force: true })
      }
    } catch {
      // silent
    }
  }, [])

  // Listen for realtime broadofficer_assigned notifications
  useEffect(() => {
    const { user: currentUser } = useAuthStore.getState()
    if (!currentUser?.id) return

    const channel = supabase
      .channel(`notifications:user:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const newNotification = payload.new as any
          if (newNotification?.type === 'broadofficer_assigned') {
            setBroadofficerPopup({
              visible: true,
              message: newNotification.message || 'Broadcaster has made you a Broadofficer.',
              streamId: newNotification.data?.stream_id || '',
            })
            refreshCurrentUserProfile()
          }
        }
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [refreshCurrentUserProfile])

  // Dismiss broadofficer popup and optionally navigate to stream
  const dismissBroadofficerPopup = useCallback(() => {
    setBroadofficerPopup(null)
  }, [])

  // Mobile layout constants
  const MOBILE_CONTROL_BAR_HEIGHT = 76
  const MOBILE_CHAT_INPUT_HEIGHT = 68
  const MOBILE_SAFE_BOTTOM = 'env(safe-area-inset-bottom)'
  const CHAT_FLOAT_MS = isMobileViewer ? 10000 : 20000

   const [stream, setStream] = useState<Stream | null>(null)

   // Broadcaster's equipped profile frame
   const broadcasterFrame = useUserFrame((stream as any)?.user_id)

   // Random battle phase (derived from stream state for viewers)
  const randomBattlePhase = useMemo((): 'regular' | 'queue' | 'starting' | 'active' | 'ended' => {
    if (!stream) return 'regular';
    if (stream.status === 'ended') return 'ended';
    const isRandomBattle = stream.battle_mode === 'random_queue' && !!stream.battle_id && !!stream.is_battle;
    if (isRandomBattle && stream.battle_status === 'starting') return 'starting';
    if (isRandomBattle && (stream.battle_status === 'active' || !stream.battle_status)) return 'active';
    if (stream.random_battle_queue_enabled) return 'queue';
    return 'regular';
  }, [stream, stream?.battle_mode, stream?.battle_id, stream?.is_battle, stream?.battle_status, stream?.random_battle_queue_enabled, stream?.status]);

const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [streamLoaded, setStreamLoaded] = useState(false)
    const [viewerCount, setViewerCount] = useState(0)
    // Broadcast frame - decorative border for viewer page
    const broadcastFrame = useBroadcastFrame(stream?.user_id)
    // Local tracks for publishing when in a seat
   const audioTrackRef = useRef<LocalAudioTrack | null>(null)
   const videoTrackRef = useRef<LocalVideoTrack | null>(null)
   const [localTracksVersion, setLocalTracksVersion] = useState(0)
   const localTracksRef = useRef<[LocalAudioTrack | null, LocalVideoTrack | null] | null>(null)

   const setLocalTracks = useCallback((
     next:
       | [LocalAudioTrack | null, LocalVideoTrack | null]
       | null
       | ((prev: [LocalAudioTrack | null, LocalVideoTrack | null] | null) => [LocalAudioTrack | null, LocalVideoTrack | null] | null)
   ) => {
     const previous: [LocalAudioTrack | null, LocalVideoTrack | null] | null =
       audioTrackRef.current || videoTrackRef.current
         ? [audioTrackRef.current, videoTrackRef.current]
         : null
     const resolved = typeof next === 'function' ? next(previous) : next
     const nextAudioTrack = resolved?.[0] || null
     const nextVideoTrack = resolved?.[1] || null

     if (audioTrackRef.current === nextAudioTrack && videoTrackRef.current === nextVideoTrack) {
       return
     }

     audioTrackRef.current = nextAudioTrack
     videoTrackRef.current = nextVideoTrack
     localTracksRef.current = resolved
     setLocalTracksVersion((version) => version + 1)
   }, [])
   const [isChatOpen, setIsChatOpen] = useState(true)
    const [chatTab, setChatTab] = useState<'chat' | 'progress' | 'league' | 'gifts' | 'top-fans'>('chat')
   const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
   const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
   const { myLeagues, myMemberships, leagueMissions, isLoading: isUserLeaguesLoading } = useUserLeagues()
   const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
   const [streamMods, setStreamMods] = useState<string[]>([])
   const processedGiftIdsRef = useRef<Set<string>>(new Set())
   // Floating chat
   interface FloatingMessage {
     id: string
     username: string
     content: string
     createdAt: number
   }
   const [floatingMessages, setFloatingMessages] = useState<FloatingMessage[]>([])
   const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set())
   const [chatInput, setChatInput] = useState('')
   const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
   const [hostChatDisabledByOfficerState, setHostChatDisabledByOfficerState] = useState(false)
   const [hostChatDisabledUntil, setHostChatDisabledUntil] = useState<string | null>(null)
   const [hostChatDisabledStreamId, setHostChatDisabledStreamId] = useState<string | null>(null)
   const [hostChatDisableRemainingMs, setHostChatDisableRemainingMs] = useState(0)
    const floatingChatContainerRef = useRef<HTMLDivElement>(null)
    const [blockedUsernames, setBlockedUsernames] = useState<Set<string>>(new Set())
    const { userChatDisabled, chatDisabledRemainingMinutes } = useChatBlockStatus(user?.id, streamId);

    const hostChatDisabledByOfficer = useMemo(
      () => isBroadcastChatLockActive({
        disabled: hostChatDisabledByOfficerState,
        until: hostChatDisabledUntil,
        streamId,
        lockedStreamId: hostChatDisabledStreamId,
      }),
      [hostChatDisabledByOfficerState, hostChatDisabledUntil, hostChatDisabledStreamId, streamId],
    )

    // Use the same recorder as BroadcastPage — captures HLS playback if available, otherwise entire screen
    const recorder = useBroadcastRecorder({
      sourceUrl: stream?.hls_url || stream?.hls_path || null,
      replaySource: 'broadcast',
      replayTitlePrefix: 'Broadcast',
    })

    // Load blocked usernames for chat filtering
    useEffect(() => {
      if (!user?.id) {
        setBlockedUsernames(new Set())
        return
      }
      getBlockedUserIds().then(async (ids) => {
        if (ids.length === 0) {
          setBlockedUsernames(new Set())
          return
        }
        // Resolve blocked user IDs to usernames
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('username, display_name')
          .in('id', ids)
        const names = new Set<string>()
        profiles?.forEach((p: any) => {
          if (p.username) names.add(p.username.toLowerCase())
          if (p.display_name) names.add(p.display_name.toLowerCase())
        })
        setBlockedUsernames(names)
      }).catch(() => {})
    }, [user?.id])

    useEffect(() => {
      const broadcasterId = stream?.user_id
      if (!streamId || !broadcasterId) {
        setHostChatDisabledByOfficerState(false)
        setHostChatDisabledUntil(null)
        setHostChatDisabledStreamId(null)
        return
      }

      let mounted = true
      const fetchHostChatLock = async () => {
        const { data } = await supabase
          .from('user_profiles')
          .select('broadcast_chat_disabled, broadcast_chat_disabled_until, broadcast_chat_disabled_stream_id')
          .eq('id', broadcasterId)
          .maybeSingle()

        if (!mounted) return

        setHostChatDisabledByOfficerState(!!data?.broadcast_chat_disabled)
        setHostChatDisabledUntil(data?.broadcast_chat_disabled_until ?? null)
        setHostChatDisabledStreamId(data?.broadcast_chat_disabled_stream_id ?? null)
      }

      void fetchHostChatLock()
      const interval = window.setInterval(fetchHostChatLock, 30_000)

      return () => {
        mounted = false
        window.clearInterval(interval)
      }
    }, [streamId, stream?.user_id])

    useEffect(() => {
      const updateRemaining = () => {
        setHostChatDisableRemainingMs(getBroadcastChatLockRemainingMs(hostChatDisabledUntil))
      }

      updateRemaining()
      const interval = window.setInterval(updateRemaining, 1000)

      return () => window.clearInterval(interval)
    }, [hostChatDisabledUntil])

  // Desktop floating chat: always scroll to top so newest messages are visible
  useEffect(() => {
    const el = floatingChatContainerRef.current
    if (el) {
      el.scrollTop = 0
    }
  }, [floatingMessages.length])
  // Global per-page dedupe of gift animations.  The same stream_gifts row can
  // arrive via postgres_changes and via the broadcast channel; both resolve to
  // the same animationId (row UUID) so this Set catches the second arrival.
  const seenGiftAnimationIdsRef = useRef<Set<string>>(new Set())
  const [userActionTarget, setUserActionTarget] = useState<{
    userId: string
    username?: string
    role?: string
    createdAt?: string
  } | null>(null)
  const [selectedSeatUserId, setSelectedSeatUserId] = useState<string | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const { topGifters, isLoading: isTopFansLoading } = useStreamTopGifters({ streamId: streamId || null, limit: 10 })

  const resolveGiftAmount = useCallback((giftData: any): number => {
    const metadata = giftData?.metadata || {}
    const quantity = Math.max(1, Number(giftData?.quantity ?? metadata.quantity ?? 1) || 1)

    const directAmountCandidates = [
      giftData?.coins_spent,
      giftData?.coins_amount,
      giftData?.total_amount,
      giftData?.total_coins,
      metadata.coins_spent,
      metadata.coins_amount,
      metadata.total_amount,
      metadata.total_coins,
      giftData?.amount,
      metadata.amount,
    ]

    for (const candidate of directAmountCandidates) {
      const value = Number(candidate)
      if (Number.isFinite(value) && value > 0) return value
    }

    const unitAmountCandidates = [
      giftData?.coin_value,
      giftData?.gift_value,
      giftData?.gift_price,
      giftData?.price,
      metadata.coin_value,
      metadata.gift_value,
      metadata.gift_price,
      metadata.price,
    ]

    for (const candidate of unitAmountCandidates) {
      const value = Number(candidate)
      if (Number.isFinite(value) && value > 0) return value * quantity
    }

    return quantity
  }, [])

  const resolveGiftName = useCallback((giftData: any): string => {
    const metadata = giftData?.metadata || {}
    return (
      giftData?.gift_name ||
      giftData?.name ||
      giftData?.title ||
      metadata.gift_name ||
      metadata.name ||
      metadata.title ||
      'Gift'
    )
  }, [])

  const enrichGiftForOverlay = useCallback(async (incomingGift: any) => {
    const giftItemId =
      incomingGift?.gift_id ||
      incomingGift?.gift_item_id ||
      incomingGift?.giftId ||
      incomingGift?.giftItemId ||
      null

    if (!giftItemId) {
      return incomingGift
    }

    const { data: giftItem, error } = await supabase
      .from('gift_items')
      .select('id,name,slug,gift_slug,icon,icon_url,animation_url,animation_type,coin_cost')
      .eq('id', giftItemId)
      .maybeSingle()

    if (error || !giftItem) {
      console.warn('[ViewerPage] Could not enrich gift overlay payload', {
        giftItemId,
        error,
        incomingGift,
      })
      return incomingGift
    }

    const enrichedGift = {
      ...incomingGift,
      gift_name:
        incomingGift.gift_name && incomingGift.gift_name !== 'Gift'
          ? incomingGift.gift_name
          : giftItem.name,
      slug:
        giftItem.slug ||
        giftItem.gift_slug ||
        incomingGift.slug ||
        incomingGift.gift_slug ||
        null,
      gift_slug:
        giftItem.gift_slug ||
        giftItem.slug ||
        incomingGift.gift_slug ||
        incomingGift.slug ||
        null,
      gift_icon: incomingGift.gift_icon || giftItem.icon || null,
      icon: incomingGift.icon || giftItem.icon || null,
      icon_url: giftItem.icon_url || incomingGift.icon_url || null,
      animation_url: giftItem.animation_url || incomingGift.animation_url || null,
      animation_type: giftItem.animation_type || incomingGift.animation_type || 'video',
      coin_cost:
        giftItem.coin_cost || incomingGift.coin_cost || incomingGift.amount || null,
    }

    if (import.meta.env.DEV) {
      console.info('[ViewerPage] Enriched gift overlay payload', {
        gift_id: giftItemId,
        gift_name: enrichedGift.gift_name,
        slug: enrichedGift.slug,
        gift_slug: enrichedGift.gift_slug,
        animation_url: enrichedGift.animation_url,
      })
    }

    return enrichedGift
  }, [])

   const handleRemoveGiftOverlay = useCallback((giftId: string) => {
     setRecentGifts((current) => current.filter((gift) => gift.id !== giftId))
   }, [])

   const processGiftEvent = useCallback(async (giftData: any) => {
    if (!giftData) return

    // Normalise to a stable animationId that is the same whether the event
    // came from postgres_changes (event.new.id = row UUID) or from the
    // broadcast channel (payload.id = same row UUID via transaction_id).
    const animationId = String(giftData.id || giftData.stream_gift_id || giftData.gift_transaction_id || '')
    if (!animationId) return

    if (seenGiftAnimationIdsRef.current.has(animationId)) {
      if (import.meta.env.DEV) console.log('[ViewerPage] Duplicate animation skipped', { animationId })
      return
    }
    seenGiftAnimationIdsRef.current.add(animationId)
    window.setTimeout(() => seenGiftAnimationIdsRef.current.delete(animationId), 12_000)

    // Existing quick-dedupe (12 s window) for old-format giftIds too
    const giftId = animationId
    if (processedGiftIdsRef.current.has(giftId)) {
      if (import.meta.env.DEV) console.log('[ViewerPage] Duplicate gift event skipped', giftId)
      return
    }
    processedGiftIdsRef.current.add(giftId)
    window.setTimeout(() => processedGiftIdsRef.current.delete(giftId), 12_000)

    const enrichedGiftData = await enrichGiftForOverlay(giftData)
    const incomingStreamId = enrichedGiftData.streamId || enrichedGiftData.stream_id || enrichedGiftData.metadata?.streamId || enrichedGiftData.metadata?.stream_id
    const receiverId = enrichedGiftData.receiver_id || enrichedGiftData.recipient_id || enrichedGiftData.receiverId || enrichedGiftData.recipientId || enrichedGiftData.metadata?.receiver_id || enrichedGiftData.metadata?.recipient_id

    if (incomingStreamId && incomingStreamId !== streamId) {
      if (import.meta.env.DEV) console.log('[ViewerPage] ⚠️ Stream ID mismatch, skipping gift:', { incomingStreamId, currentStreamId: streamId })
      return
    }

    const resolvedGiftAmount = resolveGiftAmount(enrichedGiftData)
    const resolvedGiftName = resolveGiftName(enrichedGiftData)

    const newGift = {
      id: giftId,
      gift_id: enrichedGiftData.gift_id,
      gift_name: resolvedGiftName,
      gift_icon: enrichedGiftData.gift_icon || enrichedGiftData.metadata?.gift_icon || '🎁',
      gift_slug: enrichedGiftData.gift_slug || enrichedGiftData.metadata?.gift_slug,
      animation_key: enrichedGiftData.animation_key || enrichedGiftData.metadata?.animation_key,
      animation_type: enrichedGiftData.animation_type || enrichedGiftData.metadata?.animation_type,
      animation_url:
        enrichedGiftData.animation_url ||
        enrichedGiftData.video_url ||
        enrichedGiftData.metadata?.animation_url ||
        enrichedGiftData.metadata?.video_url ||
        undefined,
      video_url:
        enrichedGiftData.video_url ||
        enrichedGiftData.animation_url ||
        enrichedGiftData.metadata?.video_url ||
        enrichedGiftData.metadata?.animation_url ||
        undefined,
      animation_duration_ms: enrichedGiftData.animation_duration_ms || enrichedGiftData.metadata?.animation_duration_ms,
      sound_url: enrichedGiftData.sound_url || enrichedGiftData.metadata?.sound_url,
      is_fullscreen: enrichedGiftData.is_fullscreen ?? enrichedGiftData.metadata?.is_fullscreen,
      rarity: enrichedGiftData.rarity || enrichedGiftData.metadata?.rarity,
      tray_visual_url: enrichedGiftData.tray_visual_url || enrichedGiftData.metadata?.tray_visual_url,
      tray_gradient: enrichedGiftData.tray_gradient || enrichedGiftData.metadata?.tray_gradient,
      amount: resolvedGiftAmount || enrichedGiftData.quantity || 1,
      quantity: enrichedGiftData.quantity || 1,
      sender_id: enrichedGiftData.sender_id,
      sender_name: enrichedGiftData.sender_name || enrichedGiftData.metadata?.sender_name || 'Someone',
      receiver_id: receiverId,
      receiver_name: enrichedGiftData.receiver_name || enrichedGiftData.metadata?.receiver_name,
      created_at: enrichedGiftData.timestamp || enrichedGiftData.created_at || new Date().toISOString(),
    } as BroadcastGift

    setRecentGifts((prev) => {
      if (prev.some((gift) => gift.id === giftId)) return prev
      return [...prev, newGift].slice(-20)
    })

    const giftDurationMs = newGift.animation_duration_ms ?? getGiftVisualConfig(newGift).durationMs
    window.setTimeout(() => {
      setRecentGifts((prev) => prev.filter((gift) => gift.id !== giftId))
    }, giftDurationMs + 150)
  }, [enrichGiftForOverlay, resolveGiftAmount, resolveGiftName, streamId])

   const hasJoinedAudienceRef = useRef(false)
   const joiningAudienceRef = useRef(false)
   const audienceFailedUntilRef = useRef<number>(0)
   const audienceJoinAttemptedKeyRef = useRef<string | null>(null)
   const joiningPublisherRef = useRef(false)
   const currentRoomKeyRef = useRef<string | null>(null)
   const viewerIdentityRef = useRef<string>(
     `viewer-${streamId}-${user?.id || Math.random().toString(36).slice(2, 9)}`,
   )
    const joinAudienceRef = useRef<(options?: any) => Promise<any>>(null as any)
    const heartbeatAudienceRef = useRef<() => Promise<void>>(null as any)
    const leaveAudienceRef = useRef<() => Promise<void>>(null as any)
    const audienceStreamIdRef = useRef<string>('')
    const hasJoinedStreamAudienceRef = useRef(false)

    const watchTimeIntervalRef = useRef<number | null>(null)
    const clickTimesRef = useRef<number[]>([])
    const blockedUntilRef = useRef<number | null>(null)

   // Paid chat state for viewers
   const [isPaidChatModalOpen, setIsPaidChatModalOpen] = useState(false)
   const [paidChatPricePerUser, setPaidChatPricePerUser] = useState<number>(0)
   const [paidChatPricePerChat, setPaidChatPricePerChat] = useState<number>(0)
    const [isPaidChatEnabled, setIsPaidChatEnabled] = useState(false)

    // Load paid chat settings from stream
    useEffect(() => {
      if (!streamId) return;
      const fetchPaidChatSettings = async () => {
        try {
          const { data } = await supabase
            .from('stream_settings')
            .select('paid_chat_enabled, paid_chat_type, paid_chat_price')
            .eq('stream_id', streamId)
            .maybeSingle();
          if (data?.paid_chat_enabled) {
            const price = Number(data.paid_chat_price ?? 0);
            const type = data.paid_chat_type || 'per_user';
            if (type === 'per_chat') {
              setPaidChatPricePerUser(0);
              setPaidChatPricePerChat(price);
            } else {
              setPaidChatPricePerUser(price);
              setPaidChatPricePerChat(0);
            }
            setIsPaidChatEnabled(price > 0);
          } else {
            setIsPaidChatEnabled(false);
          }
        } catch {
          setIsPaidChatEnabled(false);
        }
      };
      void fetchPaidChatSettings();
    }, [streamId]);

  const defaultSeatCount = Array.isArray((stream as any)?.seat_prices)
    ? (stream as any).seat_prices.length
    : 1

  const { boxCount: hookBoxCount } = useBoxCount({
    streamId: streamId || '',
    initialBoxCount: (stream as any)?.seat_count || (stream as any)?.box_count || defaultSeatCount || 1,
    isHost: false,
  })

  const effectiveBoxCount = useMemo(() => {
    // Prefer seat_count (new field), fall back to box_count, then seat_prices.
    // The broadcaster occupies the first box, so we cap the total at 8 boxes (7 seats + host).
    const seatCount = (stream as any)?.seat_count !== undefined ? Number((stream as any).seat_count) : undefined
    if (seatCount !== undefined) {
      if (seatCount === 0) return 1 // broadcaster only, 1 box
      return Math.max(1, Math.min(MAX_TOTAL_BOXES, seatCount))
    }

    const boxCount = Number((stream as any)?.box_count ?? 0)
    if (boxCount > 0) {
      return Math.max(1, Math.min(MAX_TOTAL_BOXES, boxCount))
    }

    const seatCountFromPrices = Array.isArray((stream as any)?.seat_prices)
      ? Math.max(1, (stream as any).seat_prices.length)
      : 0

    if (seatCountFromPrices > 0) {
      return Math.max(1, Math.min(MAX_TOTAL_BOXES, seatCountFromPrices))
    }

    return 1 // default: broadcaster only
  }, [stream, hookBoxCount])

  // Layout mode: 'split' for <=6 total boxes, 'grid' for >6
  const layoutMode = useMemo(() => {
    return effectiveBoxCount <= 6 ? 'split' : 'grid'
  }, [effectiveBoxCount])

   const {
     seats,
     mySeat,
     joiningSeatId,
     leavingSeatId,
     joinSeat,
     leaveSeat,
     markSeatLive,
     refreshSeats,
     removeSeat,
   } = useStreamSeats(streamId || '', user?.id, broadcasterProfile, stream as any)
   const { audience, activeAudience, topAudience, myPresence, joinAudience, leaveAudience, heartbeatAudience, incrementGiftTotal } = useStreamAudiencePresence(streamId || '', user?.id)

   useEffect(() => {
     joinAudienceRef.current = joinAudience
   }, [joinAudience])

   useEffect(() => {
     heartbeatAudienceRef.current = heartbeatAudience
   }, [heartbeatAudience])

   useEffect(() => {
     leaveAudienceRef.current = leaveAudience
   }, [leaveAudience])

    // Refs to hold LiveKit functions populated after useLiveKitRoom hook runs
    const unpublishLocalTracksRef = useRef<(() => Promise<void>) | null>(null)
    const leaveLiveKitRoomRef = useRef<(() => Promise<void>) | null>(null)

    // Track whether we already processed a kick for this user to avoid double-processing
    const kickProcessedRef = useRef(false)

     // Listen for seat_left broadcast events from broadcaster/officer removes
     // When the kicked user is the current viewer, run the same client-side
     // cleanup they would get if they clicked "Leave seat" themselves.
     // Non-kick seat_left events are already handled by useStreamSeats via
     // postgres_changes and broadcast events, so this handler only acts on
     // the current-user-kicked case to avoid duplicate state updates.
     useEffect(() => {
       if (!streamId) return
       kickProcessedRef.current = false
       const channel = supabase.channel(`stream-seat-events-kick:${streamId}`)
       channel
         .on('broadcast', { event: 'seat_left' }, (payload) => {
           if (kickProcessedRef.current) return

           const payloadUserId = payload?.payload?.user_id
           const payloadSessionId = payload?.payload?.session_id

           const isCurrentUserKicked =
             (payloadUserId && payloadUserId === user?.id) ||
             (payloadSessionId && payloadSessionId === mySeat?.id) ||
             (payloadUserId && (payloadUserId === mySeat?.user_id || payloadUserId === mySeat?.guest_id))

           if (!isCurrentUserKicked) return

            kickProcessedRef.current = true
            void (async () => {
              try {
                await unpublishLocalTracksRef.current?.()
              } catch (err) {
                // ignore
              }
              hasJoinedAudienceRef.current = false
              joiningAudienceRef.current = false
              currentRoomKeyRef.current = null
              navigate('/?kicked=Removed%20from%20stage', { replace: true })
            })()
         })
         .subscribe()
       return () => {
         if (channel) {
           supabase.removeChannel(channel)
         }
         kickProcessedRef.current = false
       }
     }, [streamId, user?.id, mySeat?.id, mySeat?.user_id, mySeat?.guest_id])

   const normalizeSeatStatus = (status?: string | null) => String(status || '').trim().toLowerCase()
   const isSeatActiveStatus = (status?: string | null) => {
     const normalized = normalizeSeatStatus(status)
     return ['reserved', 'camera_starting', 'active', 'live'].includes(normalized)
   }
   const isSeatOpenStatus = (status?: string | null) => {
     const normalized = normalizeSeatStatus(status)
     return ['empty', 'failed', 'left', 'cancelled', 'expired'].includes(normalized)
   }

   const isUserOnStage = Boolean(
     mySeat &&
       isSeatActiveStatus(mySeat.status) &&
       (mySeat.user_id === user?.id || mySeat.guest_id === user?.id),
   )

  const [isBattleButtonBusy, setIsBattleButtonBusy] = useState(false)

  const [seatMicOn, setSeatMicOn] = useState(true)
  const [seatCamOn, setSeatCamOn] = useState(true)

  const handleStartSeatBattle = useCallback(async () => {
    if (!stream?.id || !user?.id || !isUserOnStage) return

    setIsBattleButtonBusy(true)
    try {
      const { data, error } = await supabase.rpc('captain_click_battle', {
        p_stream_id: stream.id,
        p_captain_id: user.id,
      })

      if (error) {
        console.error('[ViewerPage] captain_click_battle error:', error)
        toast.error('Failed to start battle')
        return
      }

      if (data?.matched) {
        toast.success('Battle matched!')
      } else if (data?.status === 'waiting_for_opponent') {
        toast.success('Searching for opponent...')
      } else {
        toast.success('Battle search started')
      }
    } catch (err) {
      console.error('[ViewerPage] start stage battle failed:', err)
      toast.error('Failed to start battle')
    } finally {
      setIsBattleButtonBusy(false)
    }
  }, [isUserOnStage, stream?.id, user?.id])

  const availableSeatIndex = useMemo(() => {
    if (effectiveBoxCount <= 1) return null

    for (let seatIndex = 1; seatIndex <= effectiveBoxCount; seatIndex += 1) {
      const seat = seats?.[seatIndex]
      const seatStatus = normalizeSeatStatus(seat?.status)
      const isOccupied = Boolean(
        isSeatActiveStatus(seatStatus) &&
        (seat?.user_id || seat?.guest_id),
      )
      if (!isOccupied) {
        return seatIndex
      }
    }

    return null
  }, [effectiveBoxCount, seats])

  const userIdToLiveKitIdentity = useMemo(() => {
    const mapping: Record<string, string> = {};
    if (!seats) return mapping;
    Object.entries(seats).forEach(([seatIndex, seat]) => {
      const seatData = seat as any;
      const userId = seatData?.user_id || seatData?.guest_id;
      const identity = seatData?.livekit_participant_identity || seatData?.participant_identity || seatData?.livekit_identity;
      if (userId && identity) {
        mapping[userId] = identity;
      }
    });
    return mapping;
  }, [seats]);

  const availableSeatPrice = useMemo(() => {
    if (typeof availableSeatIndex !== 'number') return 0

    return Array.isArray((stream as any)?.seat_prices)
      ? (stream as any).seat_prices[availableSeatIndex]
      : (stream as any)?.seat_price ?? 0
  }, [availableSeatIndex, stream])

  const handleJoinAvailableSeat = useCallback(async () => {
    if (typeof availableSeatIndex !== 'number') return
    await joinSeat(availableSeatIndex, availableSeatPrice)
  }, [availableSeatIndex, availableSeatPrice, joinSeat])

  const joinSeatThrottleRef = useRef<{ lastTime: number; count: number }>({ lastTime: 0, count: 0 })

  const handleJoinSeatByIndex = useCallback(async (seatIndex: number) => {
    if (typeof seatIndex !== 'number') return
    const now = Date.now()
    const throttle = joinSeatThrottleRef.current
    if (now - throttle.lastTime > 1000) {
      throttle.lastTime = now
      throttle.count = 0
    }
    throttle.count += 1
    if (throttle.count > 5) {
      toast.error('Please slow down — you are joining seats too quickly.')
      return
    }
    const seatPrice = getSeatPriceForIndex(stream as Stream | null, seatIndex)
    await joinSeat(seatIndex, seatPrice)
  }, [joinSeat, stream])

  const handleAddSeat = useCallback(async () => {
    if (!streamId || !user?.id) {
      toast.error('Not connected to a live stream')
      return
    }
    try {
      const currentBoxCount = Number((stream as any)?.box_count ?? effectiveBoxCount ?? 1)
      const currentSeatPrices = Array.isArray((stream as any)?.seat_prices)
        ? (stream as any).seat_prices
        : []
      const desiredBoxCount = Math.min(MAX_TOTAL_BOXES, currentBoxCount + 1)
      const newSeatPrices = [...currentSeatPrices]
      while (newSeatPrices.length < desiredBoxCount) {
        newSeatPrices.push(0)
      }
      const { error: updateError } = await supabase
        .from('streams')
        .update({
          box_count: desiredBoxCount,
          seat_count: desiredBoxCount,
          seat_prices: newSeatPrices,
        })
        .eq('id', streamId)
      if (updateError) throw updateError
      setStream((current) => current ? {
        ...current,
        box_count: desiredBoxCount,
        seat_count: desiredBoxCount,
        seat_prices: newSeatPrices,
      } : current)
      toast.success('Seat added to stage')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add seat')
    }
  }, [streamId, user?.id, stream, effectiveBoxCount])

  // Fetch stream mods for the floating overlay badges
  useEffect(() => {
    const fetchMods = async () => {
      const targetHostId = (stream as any)?.user_id;
      if (!targetHostId) return;
      const { data } = await supabase
        .from('stream_moderators')
        .select('user_id')
        .eq('broadcaster_id', targetHostId);
      if (data) setStreamMods(data.map((d: any) => d.user_id));
    };
    if ((stream as any)?.user_id) fetchMods();
  }, [(stream as any)?.user_id]);

const isActive = isStreamActive(stream)
   const hostId = (stream as any)?.user_id || ''
   const hostName = getDisplayName(broadcasterProfile, 'Broadcaster')
   const { subscriberUsernames } = useSubscriberUsernames(hostId)

    const roomId = useMemo(() => {
     return String(getLiveKitRoomName(stream as Stream | null, streamId) || '')
   }, [stream?.livekit_room_name, stream?.id, streamId])

    // Stable anonymous viewer identity — never use "undefined" in identity.
    // Uses sessionStorage so the same guest gets the same identity for the
    // browser session and stream. Format: guest-viewer:<streamId>:<uuid>
    const stableAnonId = useMemo(() => {
      if (typeof window === 'undefined') return '';
      const storageKey = streamId ? `guest-viewer:${streamId}` : '';
      if (!storageKey) return '';

      try {
        let anonId = sessionStorage.getItem(storageKey);
        if (anonId) return anonId;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cryptoObj = (window as any).crypto;
        if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
          anonId = `guest-viewer:${streamId}:${cryptoObj.randomUUID()}`;
        } else {
          // Fallback UUID v4 for non-secure contexts (HTTP, older browsers)
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
          anonId = `guest-viewer:${streamId}:${uuid}`;
        }
        sessionStorage.setItem(storageKey, anonId);
        return anonId;
      } catch {
        // sessionStorage may be unavailable in some PWA/iframe contexts
        return `guest-viewer:${streamId}:${Math.random().toString(36).slice(2, 10)}`;
      }
    }, [streamId]);

    const viewerIdentity = useMemo(() => {
      const effectiveUserId = user?.id || stableAnonId;
      if (!streamId || !effectiveUserId) return '';
      return `viewer-${streamId}-${effectiveUserId}`;
    }, [streamId, user?.id, stableAnonId])

    useEffect(() => {
      viewerIdentityRef.current = viewerIdentity
    }, [viewerIdentity])

  const audienceName = useMemo(() => {
    return user
      ? ((user as any).username || (user as any).display_name || user.email || 'Viewer')
      : 'Viewer'
  }, [user])

  const handleLiveKitError = useCallback((err: any) => {
    const errorDetail = err?.message || err?.statusText || String(err) || 'Unknown LiveKit audience error'
    console.warn('[ViewerPage] LiveKit audience join failed; showing fallback viewer state', err)
    setViewerError(errorDetail)
  }, [])

  const noopCallback = useCallback(() => {}, [])

    const {
      remoteUsers,
      localVideoTrack,
      localAudioTrack,
      isPublishing,
      joinAsAudience,
      leaveRoom: leaveLiveKitRoom,
      publishLocalTracks,
      unpublishLocalTracks,
      setMicEnabled,
      setCameraEnabled,
      room: liveKitRoom,
      lastJoinDebug,
    } = useLiveKitRoom({
      roomId,
      roomType: 'broadcast',
      role: 'viewer',
      publish: false,
      audioOnly: false,
      userName: audienceName,
      identity: viewerIdentity,
      onUserJoined: noopCallback,
      onUserLeft: noopCallback,
      onError: handleLiveKitError,
    })

    // Populate refs so the seat_left handler (defined before this hook) can call them
    unpublishLocalTracksRef.current = unpublishLocalTracks
    leaveLiveKitRoomRef.current = leaveLiveKitRoom

  // Expose dev-only join debug overlay for mobile PWA troubleshooting
    const [showJoinDebug, setShowJoinDebug] = useState(true);
    const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const remoteParticipants = useMemo(() => {
    return Array.isArray(remoteUsers) ? remoteUsers : []
  }, [remoteUsers])

// ─── ISOLATED HOST PARTICIPANT STATE ───────────────────────────────────────
  // Host participant is tracked in a stable ref to prevent seat joins/leaves from
  // disrupting the broadcaster track. This state is ONLY updated when the host's
  // own tracks change, never when other participants (seats) come/go.
  
  interface SeatState {
    participant: any
    videoTrack: any
    audioTrack: any
    isLoading: boolean
    userId: string | null
  }

  interface BroadcasterState {
    participant: any
    videoTrack: any
    audioTrack: any
  }

  const hostParticipantRef = useRef<any>(null)
  const [seatTracks, setSeatTracks] = useState<Record<number, SeatState>>({})
  const [broadcasterState, setBroadcasterState] = useState<BroadcasterState>({
    participant: null,
    videoTrack: null,
    audioTrack: null,
  })
  
  // Sync broadcaster state — only touches host, never seats
  // Protects against stale participant objects during reconnect
  const updateBroadcasterState = useCallback((participant: any) => {
    const videoTrack = getVideoTrackFromParticipant(participant)
    const audioTrack = getAudioTrackFromParticipant(participant)
    setBroadcasterState(prev => {
      const prevVideoId = prev.videoTrack?.mediaStreamTrack?.id || prev.videoTrack?.sid || null
      const nextVideoId = videoTrack?.mediaStreamTrack?.id || videoTrack?.sid || null
      const prevAudioId = prev.audioTrack?.mediaStreamTrack?.id || prev.audioTrack?.sid || null
      const nextAudioId = audioTrack?.mediaStreamTrack?.id || audioTrack?.sid || null
      const prevIdentity = prev.participant?.identity || null
      const nextIdentity = participant?.identity || null

      if (
        prevVideoId === nextVideoId &&
        prevAudioId === nextAudioId &&
        prevIdentity === nextIdentity
      ) {
        return prev
      }

      if (prevVideoId && !nextVideoId) {
        return prev
      }

      if (prevAudioId && !nextAudioId) {
        return prev
      }

      return { participant, videoTrack, audioTrack }
    })
  }, [])

  // Sync broadcaster state from remoteParticipants — stable, only reacts to host changes
  // Never clears host state due to seat joins/leaves or temporary lookup failures
  useEffect(() => {
    let exactHost = remoteParticipants.find((p: any) => participantMatchesUser(p, hostId))
    if (!exactHost && liveKitRoom?.remoteParticipants) {
      exactHost = Array.from(liveKitRoom.remoteParticipants.values()).find((p: any) => participantMatchesUser(p, hostId))
    }
    if (exactHost) {
      updateBroadcasterState(exactHost)
      hostParticipantRef.current = exactHost
    } else if (hostParticipantRef.current) {
      // Keep using the last known good host participant.
      // Do NOT clear broadcasterState — host may be temporarily missing from
      // remoteParticipants during reconnect/subscribe. Only clear on stream end.
    }
  }, [remoteParticipants, hostId, updateBroadcasterState, liveKitRoom])

// Mic mute callbacks for walkie-talkie integration (for users on stage)
  const handleToggleMic = useCallback(async () => {
    if (!isUserOnStage) return
    const nextMicOn = !seatMicOn
    const ok = await setMicEnabled(nextMicOn)
    if (ok) setSeatMicOn(nextMicOn)
    console.log('[ViewerPage] seat mic toggled', nextMicOn)
  }, [isUserOnStage, seatMicOn, setMicEnabled])

  const handleToggleCamera = useCallback(async () => {
    if (!isUserOnStage) return
    const nextCamOn = !seatCamOn
    const ok = await setCameraEnabled(nextCamOn)
    if (ok) setSeatCamOn(nextCamOn)
    console.log('[ViewerPage] seat camera toggled', nextCamOn)
  }, [isUserOnStage, seatCamOn, setCameraEnabled])

  // ─── SEAT STATE MANAGEMENT (isolated from host) ───────────────────────────────
  // Guard: verify seatId is a valid seat index (not broadcaster/box 0)
  const isValidSeatId = useCallback((seatId: number): boolean => {
    return Number.isInteger(seatId) && seatId >= 1
  }, [])

  // Update a specific seat's state — guarded to only affect the target seat
  const updateSeatState = useCallback((seatId: number, participant: any, loading: boolean) => {
    if (!isValidSeatId(seatId)) {
      console.warn('[ViewerPage] updateSeatState: invalid seatId', seatId, 'ignoring')
      return
    }
    const videoTrack = getVideoTrackFromParticipant(participant)
    const audioTrack = getAudioTrackFromParticipant(participant)
    const userId = participant ? (participant.identity || participant.name || null) : null

    setSeatTracks(prev => {
      const prevSeat = prev[seatId]
      const prevVideoId = prevSeat?.videoTrack?.mediaStreamTrack?.id || prevSeat?.videoTrack?.sid || null
      const nextVideoId = videoTrack?.mediaStreamTrack?.id || videoTrack?.sid || null
      const prevAudioId = prevSeat?.audioTrack?.mediaStreamTrack?.id || prevSeat?.audioTrack?.sid || null
      const nextAudioId = audioTrack?.mediaStreamTrack?.id || audioTrack?.sid || null
      if (
        prevVideoId === nextVideoId &&
        prevAudioId === nextAudioId &&
        prevSeat?.participant === participant &&
        prevSeat?.isLoading === loading &&
        prevSeat?.userId === userId
      ) {
        return prev // No change
      }
      return {
        ...prev,
        [seatId]: { participant, videoTrack, audioTrack, isLoading: loading, userId },
      }
    })
  }, [isValidSeatId])

  // Clear a specific seat's state — only clears the target seat
  const clearSeatState = useCallback((seatId: number) => {
    if (!isValidSeatId(seatId)) {
      console.warn('[ViewerPage] clearSeatState: invalid seatId', seatId, 'ignoring')
      return
    }
    setSeatTracks(prev => {
      if (!prev[seatId]) return prev // Already empty
      const next = { ...prev }
      delete next[seatId]
      return next
    })
  }, [isValidSeatId])

  // Sync seat states from remoteParticipants — each seat only updates itself
  useEffect(() => {
    if (!seats) return

    Object.entries(seats).forEach(([seatIndexStr, seat]: [string, any]) => {
      const seatId = Number(seatIndexStr)
      if (!isValidSeatId(seatId)) return

      const seatUserId = seat?.user_id || seat?.guest_id || null
      const seatIdentity = seat?.livekit_participant_identity || seatUserId
      const isActive = isSeatActiveStatus(seat?.status)

      if (!isActive || !seatUserId) {
        clearSeatState(seatId)
        return
      }

      const participant = remoteParticipants.find((p: any) => {
        const pIdentity = String(p?.identity || '')
        return (
          participantMatchesUser(p, seatUserId) ||
          participantMatchesUser(p, seatIdentity) ||
          pIdentity === String(seatIdentity) ||
          pIdentity.endsWith(`-${seatIdentity}`) ||
          String(seatIdentity).endsWith(pIdentity)
        )
      }) || null

      if (participant && !participantMatchesUser(participant, seatUserId) && !participantMatchesUser(participant, seatIdentity)) {
        return // Participant doesn't match — don't update
      }

      const isLoading = normalizeSeatStatus(seat?.status) === 'camera_starting'
      updateSeatState(seatId, participant, isLoading)
    })

    // Clear seats that no longer exist in the seats data
    setSeatTracks(prev => {
      const validSeatIds = new Set(Object.keys(seats).map(Number).filter(isValidSeatId))
      let changed = false
      const next: Record<number, SeatState> = {}
      for (const [id, state] of Object.entries(prev)) {
        if (validSeatIds.has(Number(id))) {
          next[Number(id)] = state
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [seats, remoteParticipants, isValidSeatId, updateSeatState, clearSeatState])
  

  // Check if current user is CEO
  const isCEO = Boolean(
    profile?.role === 'ceo' ||
      (profile as any)?.is_ceo ||
      profile?.role === 'admin' ||
      profile?.is_admin
  )

  const isOfficer = Boolean(
    profile?.role === 'admin' ||
      (profile as any)?.is_admin ||
      (profile?.role as string) === 'officer' ||
      (profile as any)?.is_troll_officer ||
      (profile as any)?.is_lead_officer ||
      profile?.role === 'ceo' ||
      (profile as any)?.is_ceo,
  )

  // Staff/CEO/admin/roles can add seats to any broadcast
  const canManageSeats = Boolean(
    user?.id === hostId ||
    isOfficer ||
    isStaffProfile(profile) ||
    isCEO ||
    profile?.role === 'ceo' ||
    profile?.role === 'admin' ||
    profile?.role === 'secretary' ||
    profile?.role === 'troll_officer' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.role === 'moderator' ||
    profile?.role === 'owner' ||
    profile?.role === 'president' ||
    profile?.role === 'vice_president' ||
    (profile as any)?.is_admin ||
    (profile as any)?.is_troll_officer ||
    (profile as any)?.is_lead_officer ||
    (profile as any)?.is_ceo ||
    profile?.troll_role === 'ceo' ||
    profile?.troll_role === 'admin' ||
    profile?.troll_role === 'lead_officer' ||
    profile?.troll_role === 'secretary' ||
    profile?.troll_role === 'pastor' ||
    profile?.troll_role === 'troll_officer'
  )

  // Debug panel: show last join debug when in dev and user toggles overlay
  const JoinDebugOverlay = () => {
    if (!import.meta.env.DEV) return null;
    if (!lastJoinDebug) return null;
    return (
      <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 9999, background: 'rgba(0,0,0,0.85)', color: 'white', padding: 8, borderRadius: 8, maxWidth: '90vw', maxHeight: '40vh', overflow: 'auto', fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>LiveKit Join Debug</strong>
          <button onClick={() => setShowJoinDebug(s => !s)} style={{ marginLeft: 8 }}>{showJoinDebug ? 'Hide' : 'Show'}</button>
        </div>
        {showJoinDebug ? <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{JSON.stringify(lastJoinDebug, null, 2)}</pre> : null}
      </div>
    )
  }

   const isModerator = Boolean(
     isStaffProfile(profile) ||
       profile?.role === 'moderator' ||
       profile?.troll_role === 'moderator' ||
       profile?.role === 'admin' ||
       profile?.troll_role === 'admin'
   )

   const isModOrHigher = Boolean(isOfficer || isModerator || isCEO || isStaffProfile(profile))

   // Ghost Mode hook for CEOs
  const {
    ghostSession,
    isJoiningGhost,
    isLeavingGhost,
    isMicEnabled: isGhostMicEnabled,
    isCameraEnabled: isGhostCameraEnabled,
    joinGhostMode,
    leaveGhostMode,
    toggleMic: toggleGhostMic,
    toggleCamera: toggleGhostCamera,
  } = useGhostMode({
    streamId: streamId || '',
    userId: user?.id,
    isCEO,
  })

   // CityStatusOrb for broadcaster display
   const broadcasterCityStatus = useCityStatusOrb({
     userId: hostId,
     broadcasterId: user?.id,
     isBroadcaster: false,
     isBroadOfficer: isOfficer,
   })

   const activeSeats = useMemo(() => {
     return Object.values(seats || {}).filter(
       (seat: any) =>
         isSeatActiveStatus(seat?.status) &&
         (seat?.user_id || seat?.guest_id),
     )
   }, [seats])

  const activeUserIds = useMemo(() => {
    const ids: string[] = []
    activeSeats.forEach((seat: any) => {
      const id = seat?.user_id || seat?.guest_id
      if (id && id !== hostId) ids.push(id)
    })
    if (hostId) ids.unshift(hostId)
    return Array.from(new Set(ids))
  }, [activeSeats, hostId])

  const userProfiles = useMemo(() => {
    const profiles: Record<string, { username: string; avatar_url?: string }> = {}

    if (hostId && broadcasterProfile) {
      profiles[hostId] = {
        username: getDisplayName(broadcasterProfile, 'Broadcaster'),
        avatar_url: broadcasterProfile.avatar_url,
      }
    }

    activeSeats.forEach((seat: any) => {
      const userId = seat?.user_id || seat?.guest_id
      const seatProfile = seat?.user_profile || seat?.profile
      if (userId && seatProfile) {
        profiles[userId] = {
          username: getDisplayName(seatProfile, 'Stage Guest'),
          avatar_url: seatProfile.avatar_url,
        }
      }
    })

    return profiles
  }, [activeSeats, broadcasterProfile, hostId])

  const onGift = useCallback((userId?: string | null) => {
    setGiftRecipientId(userId || hostId || null)
    setIsGiftModalOpen(true)
  }, [hostId])

  const handleOpenUserAction = useCallback((info: { userId: string; username?: string; role?: string; createdAt?: string }) => {
    setUserActionTarget(info)
  }, [])

  const pushFloatingSystemMessage = useCallback((content: string) => {
    const activeUsername = profile?.username || (profile as any)?.display_name || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    setFloatingMessages((prev) => [{ id: msgId, username: activeUsername, content, createdAt: Date.now() }, ...prev].slice(0, 50))

    window.setTimeout(() => {
      setFloatingMessages((prev) => prev.filter((message) => message.id !== msgId))
    }, CHAT_FLOAT_MS)

    const chatChannel = floatingChatChannelRef.current
    chatChannel?.send({
      type: 'broadcast',
      event: 'floating_chat',
      payload: { username: activeUsername, content },
    }).catch(() => {})
  }, [profile?.username, profile?.display_name, user?.email])

  const handleFollowBroadcaster = useCallback((targetLabel: string) => {
    const broadcasterLabel = targetLabel || hostName || 'the broadcaster'
    pushFloatingSystemMessage(`${profile?.username || (profile as any)?.display_name || 'A viewer'} followed ${broadcasterLabel}`)
  }, [hostName, profile?.display_name, profile?.username, pushFloatingSystemMessage])

   const handleOpenFloatingChatUsername = useCallback(async (username: string) => {
     if (!username) return

     // For anonymous users: only mods/officers can click, open arrest dialog directly
     if (isAnonymousDisplayName(username)) {
       if (!isModOrHigher) return
       handleOpenUserAction({
         userId: `anon-${username}`,
         username,
         role: 'anonymous',
         createdAt: null,
       })
       return
     }

     try {
       const { data, error } = await supabase
         .from('user_profiles')
         .select('id, username, created_at, role, troll_role')
         .eq('username', username)
         .maybeSingle()
       
       if (error || !data?.id) {
         toast.error('User not found')
         return
       }
       
       handleOpenUserAction({
         userId: data.id,
         username: data.username || username,
         role: data.role || data.troll_role,
         createdAt: data.created_at,
       })
     } catch (err) {
       console.error('[ViewerPage] Error opening user action:', err)
       toast.error('Failed to open user profile')
     }
   }, [isModOrHigher])

  const refreshStream = useCallback(async () => {
    if (!streamId) return

    const { data, error } = await supabase
      .from('streams')
      .select(
        [
          'id',
          'status',
          'is_live',
          'started_at',
          'ended_at',
          'title',
          'category',
          'user_id',
          'are_seats_locked',
          'is_battle',
          'total_likes',
          'total_gifts_coins',
          'box_count',
          'seat_price',
          'seat_prices',
          'current_viewers',
          'livekit_room_name',
          'battle_id',
          'battle_mode',
          'battle_format',
          'battle_status',
          'battle_start_time',
          'battle_end_time',
            'side_a_score',
            'side_b_score',
          ].join(','),
      )
      .eq('id', streamId)
      .maybeSingle()

    if (error) {
      console.warn('[ViewerPage] refreshStream failed:', error)
      return
    }

    if (!data) return

    if (isStreamEnded(data as unknown as Stream)) {
      // Hard disconnect from LiveKit before navigating
      leaveLiveKitRoom().catch(() => {})
      hasJoinedAudienceRef.current = false
      joiningAudienceRef.current = false
      currentRoomKeyRef.current = null
      navigate(`/broadcast/summary/${streamId}`, { replace: true })
      return
    }

    setStream(data as unknown as Stream)
    setViewerCount(Number((data as any).current_viewers || 0))
  }, [streamId, navigate])

const handleLeaveSeat = useCallback(async () => {
    try {
      await unpublishLocalTracks()
    } catch (err) {
      console.warn('[ViewerPage] unpublishLocalTracks on leave seat failed:', err)
    }
    try {
      await leaveSeat()
    } catch (err) {
      console.warn('[ViewerPage] leaveSeat failed:', err)
    }
  }, [leaveSeat, unpublishLocalTracks])

   const handleToggleChat = useCallback(() => setIsChatOpen((prev) => !prev), [])

   const pendingLikesRef = useRef(0);
   const flushInProgressRef = useRef(false);

   const flushLikes = useCallback(async () => {
     if (flushInProgressRef.current) return;
     const batch = pendingLikesRef.current;
     if (batch <= 0 || !streamId) return;

     pendingLikesRef.current = 0;
     flushInProgressRef.current = true;

     try {
       const { data, error } = await supabase.rpc('increment_stream_likes', {
         p_stream_id: streamId,
         p_like_count: batch,
       });

       if (error) throw error;

       if (typeof data === 'number') {
         setStream((prev: any) => {
           if (!prev) return prev;
           return { ...prev, total_likes: data };
         });
       }
     } catch (error) {
       pendingLikesRef.current += batch;
       console.error('Failed to flush likes:', error);
     } finally {
       flushInProgressRef.current = false;
     }
   }, [streamId]);

   useEffect(() => {
     const interval = window.setInterval(() => {
       flushLikes();
     }, 2500);

     const handleVisibilityChange = () => {
       if (document.visibilityState === 'hidden') {
         void flushLikes();
       }
     };

     document.addEventListener('visibilitychange', handleVisibilityChange);

     return () => {
       window.clearInterval(interval);
       document.removeEventListener('visibilitychange', handleVisibilityChange);
       void flushLikes();
     };
   }, [flushLikes]);

  const handleLike = useCallback(async () => {
    if (!streamId || !user?.id) {
      toast.success('Login to like this broadcast')
      return
    }

    const now = Date.now()

    if (blockedUntilRef.current && now < blockedUntilRef.current) {
      const secondsLeft = Math.ceil((blockedUntilRef.current - now) / 1000)
      toast.error(`You're temporarily blocked from liking (${secondsLeft}s)`)
      return
    }

    const times = clickTimesRef.current
    times.push(now)
    const cutoff = now - 1000
    while (times.length && times[0] < cutoff) times.shift()

    const tapsPerSec = times.length
    if (tapsPerSec >= 20) {
      blockedUntilRef.current = now + 60 * 1000
      clickTimesRef.current = []
      toast.error('Rate limited for 1 minute due to suspected auto-clicking')
      return
    }

    setStream((prev: any) =>
      prev
        ? {
            ...prev,
            total_likes: Number(prev.total_likes || 0) + 1,
          }
        : prev,
    )

    pendingLikesRef.current += 1;
    if (pendingLikesRef.current >= 25) {
      flushLikes();
    }
  }, [streamId, user?.id, stream])

  const handleLeave = useCallback(async () => {
    try {
      if (mySeat) {
        await unpublishLocalTracks()
        await leaveSeat()
      }
      await leaveAudience()
    } catch (err) {
      console.warn('[ViewerPage] leave cleanup failed:', err)
    }

    await leaveLiveKitRoom().catch(() => {})
    hasJoinedAudienceRef.current = false
    joiningAudienceRef.current = false
    currentRoomKeyRef.current = null
    navigate('/')
  }, [leaveAudience, leaveLiveKitRoom, leaveSeat, mySeat, navigate, unpublishLocalTracks])

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/broadcast/${streamId}`
    const shareTitle = (stream as any)?.title || 'Watch me live on Troll City'

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: 'Join this Troll City broadcast',
          url: shareUrl,
        })
        return
      }

      await navigator.clipboard.writeText(shareUrl)
      toast.success('Broadcast link copied')
    } catch (err) {
      console.warn('[ViewerPage] share failed:', err)
    }
  }, [streamId, stream])

  const isStreamLive = isActive

  useEffect(() => {
    if (!streamId || !user?.id || !isStreamLive || hostId === user.id) {
      if (watchTimeIntervalRef.current) {
        window.clearInterval(watchTimeIntervalRef.current)
        watchTimeIntervalRef.current = null
      }
      return
    }

    const recordWatchActivity = async () => {
      try {
        await recordWatchTime(60, streamId)
      } catch (recordErr) {
        console.warn('[ViewerPage] Failed to record watch time:', recordErr)
      }
    }

    watchTimeIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void recordWatchActivity()
    }, 60 * 1000)

    return () => {
      if (watchTimeIntervalRef.current) {
        window.clearInterval(watchTimeIntervalRef.current)
        watchTimeIntervalRef.current = null
      }
    }
  }, [streamId, user?.id, isStreamLive, hostId, recordWatchTime])

  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setStreamLoaded(true)
      return
    }

    let cancelled = false

    const run = async () => {
      setStreamLoaded(false)
      setError(null)

      const { data, error: streamError } = await supabase
        .from('streams')
        .select(
          [
            'id',
            'status',
            'is_live',
            'started_at',
            'ended_at',
            'title',
            'category',
            'user_id',
            'are_seats_locked',
            'is_battle',
            'total_likes',
            'total_gifts_coins',
            'box_count',
            'seat_price',
            'seat_prices',
            'current_viewers',
            'livekit_room_name',
            'battle_id',
            'battle_mode',
            'battle_format',
            'battle_status',
            'battle_start_time',
            'battle_end_time',
             'side_a_score',
             'side_b_score',
           ].join(','),
        )
        .eq('id', streamId)
        .maybeSingle()

      if (cancelled) return

      if (streamError || !data) {
        setError('Stream not found.')
        setStreamLoaded(true)
        return
      }

      if (isStreamEnded(data as unknown as Stream)) {
        navigate(`/broadcast/summary/${streamId}`, { replace: true })
        return
      }

      setStream(data as unknown as Stream)
      setViewerCount(Number((data as any).current_viewers || 0))

      if ((data as any).user_id) {
        const { data: hostProfile, error: hostProfileError } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, email, avatar_url, troll_coins, paid_coin_balance, free_coin_balance, total_earned_coins, is_verified')
          .eq('id', (data as any).user_id)
          .maybeSingle()

        if (hostProfileError) {
          console.warn('[ViewerPage] host profile fetch failed:', hostProfileError)
        }

        if (!cancelled && hostProfile) {
          setBroadcasterProfile(hostProfile)
        }
      }

      if (!cancelled) setStreamLoaded(true)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [streamId, navigate])

  // TEMP DISABLED — replaced by useStreamRealtime subscription below
  // useEffect(() => {
  //   if (!streamId) return
  //   const interval = window.setInterval(() => void refreshStream(), 30000)
  //   return () => window.clearInterval(interval)
  // }, [streamId, refreshStream])

  // Canonical gift-animation source: stream_gifts postgres_changes received
  // via useStreamRealtime. event.new.id is the stream_gifts row UUID — the
  // same value that useGiftSystem uses as broadcast payload.id — so both
  // postgres and broadcast paths resolve to the same animationId and the
  // seenGiftAnimationIdsRef Set catches the second arrival without double-
  // playing the <video>.
useStreamRealtime(
      streamId || '',
      {
        onGift: (event) => {
          const rawGift = event?.new ?? event
          if (rawGift) {
            void processGiftEvent(rawGift)
          }
        },
       onParticipant: (event: any) => {
         if (event.eventType !== 'UPDATE' || !event.new || !user?.id) return
         const participant = event.new
         if (participant.user_id !== user.id || participant.removed !== true || participant.stream_id !== streamId) return

         kickProcessedRef.current = true

         const kickData = {
           timestamp: Date.now(),
           streamId,
           reason: participant.removed_reason || 'Kicked by broadcaster',
         }

         localStorage.setItem(getKickStorageKey(streamId, user.id), JSON.stringify(kickData))
         leaveLiveKitRoom().catch(() => {})
         hasJoinedAudienceRef.current = false
         joiningAudienceRef.current = false
         currentRoomKeyRef.current = null
         navigate(`/?kicked=${encodeURIComponent(kickData.reason)}`, { replace: true })
       },
       onStream: (event: any) => {
         const next = event?.new || event
         if (!next) return

         const prev = event?.old;
         const wasInActiveBattle = prev?.is_battle && !!prev?.battle_id && prev?.battle_status === 'active';
         
         if (isStreamEnded(next as Stream) && !wasInActiveBattle) {
           // Hard disconnect from LiveKit before navigating
           leaveLiveKitRoom().catch(() => {})
           hasJoinedAudienceRef.current = false
           joiningAudienceRef.current = false
           currentRoomKeyRef.current = null
           navigate(`/broadcast/summary/${streamId}`, { replace: true })
           return
         }

         setStream((prev) => {
           if (!prev) return next as Stream
           return {
             ...(prev as any),
             ...(next as any),
             box_count: typeof next.box_count !== 'undefined' ? next.box_count : (prev as any).box_count,
             seat_price: typeof next.seat_price !== 'undefined' ? next.seat_price : (prev as any).seat_price,
             seat_prices: typeof next.seat_prices !== 'undefined' ? next.seat_prices : (prev as any).seat_prices,
             total_likes: typeof next.total_likes !== 'undefined' ? next.total_likes : (prev as any).total_likes,
           } as Stream
         })

         if (typeof next.current_viewers !== 'undefined') {
           setViewerCount(Number(next.current_viewers || 0))
         }
       },
     } as any,
     stream?.battle_id ?? null,
   )

  // Kick guard: check on page load if user was kicked from this broadcast
  useEffect(() => {
    if (!streamId || !user?.id) return

    const checkKickGuard = async () => {
      try {
        // Check localStorage for recent kick
        const kickData = parseKickData(localStorage.getItem(getKickStorageKey(streamId, user.id)))
        if (isKickBanActive(kickData)) {
          const remainingMs = KICK_BAN_DURATION_MS - (Date.now() - kickData.timestamp)
          const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
          toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
          navigate('/', { replace: true })
          return
        }

        // Also check stream_kicks table for permanent kick
        const { data: kickRecord } = await supabase
          .from('stream_kicks')
          .select('id, created_at')
          .eq('stream_id', streamId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (kickRecord) {
          const kickTimestamp = new Date(kickRecord.created_at).getTime()
          const timeSinceKick = Date.now() - kickTimestamp
          if (timeSinceKick < KICK_BAN_DURATION_MS) {
            const remainingMs = KICK_BAN_DURATION_MS - timeSinceKick
            const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
            toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
            localStorage.setItem(getKickStorageKey(streamId, user.id), JSON.stringify({
              timestamp: kickTimestamp,
              streamId,
              reason: 'Kicked by moderator'
            }))
            navigate('/', { replace: true })
          }
        }
      } catch (err) {
        console.warn('[ViewerPage] Kick guard check failed:', err)
      }
    }

    void checkKickGuard()
  }, [streamId, user?.id, navigate])

  // Pin/unpin messages (staff/broadcaster/broadofficer/admin/CEO only)
  const canPinMessages = Boolean(
    profile && (
      String(profile.role).toLowerCase() === 'admin' ||
      String(profile.role).toLowerCase() === 'superadmin' ||
      String(profile.role).toLowerCase() === 'owner' ||
      String(profile.role).toLowerCase() === 'ceo' ||
      String(profile.role).toLowerCase() === 'staff' ||
      profile.is_admin ||
      profile.is_troll_officer ||
      profile.is_lead_officer ||
      String(profile.troll_role).toLowerCase() === 'lead_troll_officer' ||
      String(profile.troll_role).toLowerCase() === 'troll_officer'
    )
  )

  const handlePinMessage = useCallback((messageId: string) => {
    setPinnedMessageIds(prev => new Set(prev).add(messageId))
    toast.success('Message pinned')
  }, [])

  const handleUnpinMessage = useCallback((messageId: string) => {
    setPinnedMessageIds(prev => {
      const next = new Set(prev)
      next.delete(messageId)
      return next
    })
    toast.success('Message unpinned')
  }, [])

  const floatingChatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Floating Chat: receive broadcasts ────────────────────────────────────
  useEffect(() => {
    if (!streamId) return

    const channel = supabase.channel(`floating-chat:${streamId}`)
    floatingChatChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'floating_chat' }, (payload: any) => {
        const { username, content } = payload.payload || {}
        if (!username || !content) return
        // Filter out messages from blocked users
        if (blockedUsernames.has(username.toLowerCase())) return
        const msgId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        setFloatingMessages(prev => [{ id: msgId, username, content, createdAt: Date.now() }, ...prev].slice(-50))

        setTimeout(() => {
          setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
        }, CHAT_FLOAT_MS)
      })
      .subscribe()

    return () => {
      floatingChatChannelRef.current = null;
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [streamId])

   useEffect(() => {
     return () => {
       void leaveAudienceRef.current?.()
       leaveLiveKitRoomRef.current?.().catch(() => {})
     }
   }, [])

   // Mute/chat detection: subscribe to stream_mutes for current user
   useEffect(() => {
     if (!streamId || !user?.id) return

     const checkMuteState = async () => {
       try {
         const { data } = await supabase
           .from('stream_mutes')
           .select('id, expires_at')
           .eq('stream_id', streamId)
           .eq('user_id', user.id)
           .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
           .maybeSingle()

         if (data) {
           toast.error('You have been muted by a moderator.')
           if (isUserOnStage && isPublishing) {
             try { await unpublishLocalTracks() } catch {}
           }
         }
       } catch {}
     }

     void checkMuteState()

     const muteChannel = supabase
       .channel(`viewer-mute:${streamId}:${user.id}`)
       .on(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'stream_mutes',
           filter: `stream_id=eq.${streamId}`,
         },
         (payload) => {
           const newMute = payload.new as any
           if (newMute?.user_id === user.id) {
             toast.error('You have been muted by a moderator.')
             if (isUserOnStage && isPublishing) {
               void (async () => {
                 try { await unpublishLocalTracks() } catch {}
               })()
             }
           }
         },
       )
       .on(
         'postgres_changes',
         {
           event: 'DELETE',
           schema: 'public',
           table: 'stream_mutes',
           filter: `stream_id=eq.${streamId}`,
         },
         (payload) => {
           const oldMute = payload.old as any
           if (oldMute?.user_id === user.id) {
             toast.success('You have been unmuted.')
           }
         },
       )
       .subscribe()

      return () => {
        if (muteChannel) {
          supabase.removeChannel(muteChannel)
        }
      }
   }, [streamId, user?.id, isUserOnStage, isPublishing, unpublishLocalTracks])

    useEffect(() => {
      if (!streamId || !user?.id) return

      const previousStreamId = audienceStreamIdRef.current
      if (previousStreamId && previousStreamId !== streamId) {
        void leaveAudienceRef.current?.()
        hasJoinedStreamAudienceRef.current = false
        void leaveLiveKitRoomRef.current?.().catch(() => {})
        hasJoinedAudienceRef.current = false
        joiningAudienceRef.current = false
        currentRoomKeyRef.current = null
      }
      audienceStreamIdRef.current = streamId

     // Don't join audience presence if user has ghost mode enabled
     if (!profile?.is_ghost_mode && !hasJoinedStreamAudienceRef.current) {
       void joinAudienceRef.current?.()
       hasJoinedStreamAudienceRef.current = true
     }

const heartbeat = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return
        void heartbeatAudienceRef.current?.()
      }, 90_000) // 90 second heartbeat to reduce Supabase load for likes

     return () => {
       window.clearInterval(heartbeat)
       void leaveAudienceRef.current?.()
       hasJoinedStreamAudienceRef.current = false
     }
   }, [streamId, user?.id, profile?.is_ghost_mode])

  useEffect(() => {

     if (user?.id) {
       const kickKey = getKickStorageKey(streamId, user.id)
       const kickRaw = localStorage.getItem(kickKey)
       const kickData = parseKickData(kickRaw)

       if (isKickBanActive(kickData)) {
         const timeSinceKick = Date.now() - kickData.timestamp
          const remainingMs = Math.max(KICK_BAN_DURATION_MS - timeSinceKick, 0)
          const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))

          leaveLiveKitRoom().catch(() => {})
          hasJoinedAudienceRef.current = false
          joiningAudienceRef.current = false
          currentRoomKeyRef.current = null
          toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
        }

        if (kickRaw && !isKickBanActive(kickData)) {
          localStorage.removeItem(kickKey)
        }
      }

      const audienceRoomKey = `${streamId}:${roomId}`

      if (isUserOnStage && !isPublishing) {
        if (joiningPublisherRef.current || joiningAudienceRef.current) return

        joiningPublisherRef.current = true
        currentRoomKeyRef.current = audienceRoomKey

        publishLocalTracks()
          .then(async () => {
            setViewerError(null)
            if (mySeat?.seat_index != null) {
              await markSeatLive(mySeat.seat_index, viewerIdentityRef.current || viewerIdentity)
            }
          })
          .catch(async (err: any) => {
            const errorDetail = err?.message || err?.statusText || String(err) || 'Failed to publish seat tracks'
            setViewerError(errorDetail)
            if (mySeat?.id) {
              await leaveSeat()
            }
          })
          .finally(() => {
            joiningPublisherRef.current = false
          })
        return
      }

      if (!isUserOnStage && isPublishing) {
        joiningPublisherRef.current = true
        unpublishLocalTracks()
          .catch(() => {})
          .finally(() => {
            joiningPublisherRef.current = false
          })
        leaveLiveKitRoom().catch(() => {})
        hasJoinedAudienceRef.current = false
        joiningAudienceRef.current = false
        currentRoomKeyRef.current = null
        return
      }

     if (isPublishing && !isUserOnStage) {
       return
     }

    // Audience join flow moved to a focused effect below (primitive deps only)
   }, [streamId, roomId, isActive, isUserOnStage, isPublishing, joinAsAudience, publishLocalTracks, unpublishLocalTracks, leaveLiveKitRoom, user?.id, navigate, viewerIdentity])

  // Reset audience join refs when changing streams so we can re-attempt on new stream
  useEffect(() => {
    audienceJoinAttemptedKeyRef.current = null
    audienceFailedUntilRef.current = 0
    hasJoinedAudienceRef.current = false
    joiningAudienceRef.current = false
  }, [streamId])

  // Focused effect for audience join — keep dependencies primitive to avoid
  // re-running due to object identity changes.
  useEffect(() => {
    if (!streamId) return
    const isActiveLocal = isStreamActive(stream)
    if (!isActiveLocal) return

    const identityToUse = viewerIdentityRef.current || viewerIdentity
    if (!identityToUse) return

    if (!streamId) {
      console.warn('[ViewerPage] Missing streamId from route before joinAsAudience', {
        pathname: typeof window !== 'undefined' ? window.location.pathname : null,
        params,
      })
      return
    }

    // Determine attempt key and cooldown
    const now = Date.now()
    const attemptKey = `${streamId}:${identityToUse}`
    if (audienceJoinAttemptedKeyRef.current === attemptKey) return
    if (audienceFailedUntilRef.current > now) {
      if (import.meta.env.DEV) console.warn('[ViewerPage] Skipping audience join due to recent failure cooldown', { retryAfterMs: audienceFailedUntilRef.current - now })
      return
    }

    // Don't start if we already joined or are joining, or already have a room key
    if (hasJoinedAudienceRef.current || joiningAudienceRef.current || currentRoomKeyRef.current) return

    joiningAudienceRef.current = true
    audienceJoinAttemptedKeyRef.current = attemptKey

    if (import.meta.env.DEV) console.log('[ViewerPage] triggering audience join (focused effect):', { streamId, roomId, identity: identityToUse })

    let cancelled = false

     Promise.resolve()
       .then(() => joinAsAudience({ userId: identityToUse, streamId, roomName: roomId, viewerIdentity: identityToUse, publishCapable: true }))
      .then((res: any) => {
        if (cancelled) return
        if (res && typeof res !== 'string') {
          hasJoinedAudienceRef.current = true
          setViewerError(null)
          console.log('[ViewerPage] LiveKit audience joined:', { streamId, roomId })
        } else {
          const errorDetail = typeof res === 'string'
            ? res
            : 'LiveKit audience join failed'
          console.warn(`[ViewerPage] joinAsAudience failed for stream ${streamId}: ${errorDetail}`)
          setViewerError(errorDetail)
          audienceFailedUntilRef.current = Date.now() + 60000
        }
      })
      .catch((err: any) => {
        const errorDetail = err?.message || err?.statusText || String(err) || 'LiveKit connection failed'
        console.warn(`[ViewerPage] joinAsAudience threw for stream ${streamId}: ${errorDetail}`)
        setViewerError(errorDetail)
        audienceFailedUntilRef.current = Date.now() + 60000
      })
      .finally(() => {
        joiningAudienceRef.current = false
      })

    return () => { cancelled = true }
  }, [streamId, stream?.id, stream?.status, stream?.is_live, roomId, user?.id, joinAsAudience])

  const stageSlots = useMemo(() => {
    const liveSeats = activeSeats.slice(0, Math.max(0, effectiveBoxCount - 1))
    const emptyCount = Math.max(1, effectiveBoxCount - 1 - liveSeats.length)
    return { liveSeats, emptyCount }
  }, [activeSeats, effectiveBoxCount])

  const seatCards = useMemo(() => {
    if (effectiveBoxCount <= 1) return []

    return Array.from({ length: effectiveBoxCount - 1 }, (_, offset) => {
      const seatIndex = offset + 1
      const seat = seats?.[seatIndex]
      const seatStatus = normalizeSeatStatus(seat?.status)
      const isMine = Boolean(user?.id && (seat?.user_id === user.id || seat?.guest_id === user.id))
      const isOccupied = Boolean(
        seat &&
          (seat?.user_id || seat?.guest_id) &&
          isSeatActiveStatus(seatStatus),
      )
      const isLocked = Boolean((stream as any)?.are_seats_locked)
      const seatPrice = getSeatPriceForIndex(stream as Stream | null, seatIndex)
      const displayName = getDisplayName(seat?.user_profile || null, 'Viewer')
      // A user already seated in any seat cannot join another seat until they leave it.
      const amAlreadySeated = Boolean(
        mySeat &&
          isSeatActiveStatus(normalizeSeatStatus(mySeat.status)) &&
          (mySeat.user_id === user?.id || mySeat.guest_id === user?.id),
      )
      const canJoin = !isLocked && !isOccupied && !isMine && !amAlreadySeated

      return {
        seatIndex,
        seat,
        isMine,
        isOccupied,
        isLocked,
        canJoin,
        seatPrice,
        displayName,
      }
    })
  }, [effectiveBoxCount, seats, stream, user?.id, mySeat])

    // Mobile seat grid: square cards, scrollable below broadcaster
     const mobileSeatGridHeight = useMemo(() => {
       if (!isMobileViewer || seatCards.length === 0) return 0
       const count = seatCards.length
       if (count <= 3) return 180
       if (count <= 6) return 240
       if (count <= 9) return 320
       return 380
     }, [isMobileViewer, seatCards.length])
 
    // Mobile seat grids use a tighter 3-column layout so all seats remain visible.
     const mobileSeatGridCols = useMemo(() => {
       if (!isMobileViewer || seatCards.length === 0) return 'grid-cols-3'
       return 'grid-cols-3'
     }, [isMobileViewer, seatCards.length])

  // Broadcaster video: fixed height that does NOT shrink when seats are added.
  // Seats scroll below in the remaining space.
  const mobileHostVideoHeight = useMemo(() => {
    if (!isMobileViewer) return undefined
    // Fixed broadcaster area: reserve control bar + chat input + safe area only
    const reserved = MOBILE_CONTROL_BAR_HEIGHT + MOBILE_CHAT_INPUT_HEIGHT
    return `calc(100dvh - ${reserved}px - env(safe-area-inset-bottom))`
  }, [isMobileViewer])

  // ── Channel diagnostics (dev only, admin only) ──
  const isStreamAdmin = !!(profile && (
    String(profile.role).toLowerCase() === 'admin' || profile.is_admin ||
    profile.is_superadmin || String(profile.role).toLowerCase() === 'owner'
  ));
  useEffect(() => {
    if (!isStreamAdmin) return;
    logActiveChannels(`ViewerPage:mount:${streamId}`);
    return () => logActiveChannels(`ViewerPage:unmount:${streamId}`);
  }, [streamId]);

  useEffect(() => {
    if (!isStreamAdmin) return;
    if (stream?.is_battle && stream?.battle_id) {
      logActiveChannels(`ViewerPage:battle-active:${stream.battle_id}`);
    } else {
      logActiveChannels(`ViewerPage:no-battle:${streamId}`);
    }
  }, [stream?.is_battle, stream?.battle_id, streamId]);

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-dvh text-white', theme.pageBg)}>
        <div className="rounded-3xl border border-red-400/30 bg-red-950/30 px-8 py-6 text-center shadow-[0_0_35px_rgba(239,68,68,0.2)] backdrop-blur-2xl">
          <p className="text-red-300 font-bold">{error}</p>
        </div>
      </div>
    ) 
  }

  if (!stream || !streamLoaded) {
    return (
      <div className={cn('flex h-dvh items-center justify-center text-white', theme.pageBg)}>
        <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.035] px-8 py-6 text-center shadow-[0_0_35px_rgba(45,212,191,0.2)] backdrop-blur-2xl">
          <div className="text-lg font-black">Loading broadcast…</div>
          <div className="mt-2 text-sm text-cyan-100/60">Connecting to Troll City LiveKit.</div>
        </div>
      </div>
    )
  }

  const shouldShowRandomBattleArena =
    stream?.battle_mode === 'random_queue' &&
    !!stream?.battle_id &&
    stream?.is_battle === true &&
    (stream?.battle_status === 'ready' || stream?.battle_status === 'starting' || stream?.battle_status === 'active');

  // PHASE 2: Derive stable battleId for BattleView key — prevents remount on stream state updates
  const activeBattleId = shouldShowRandomBattleArena ? stream?.battle_id ?? null : null;

  if (shouldShowRandomBattleArena) {
    return (
      <ErrorBoundary>
        <GiftSystemProvider streamId={streamId} defaultReceiverId={hostId}>
          <BattleView
            key={activeBattleId}
            battleId={stream.battle_id!}
            currentStreamId={streamId}
            viewerId={user?.id || stableAnonId}
            remoteUsers={remoteUsers}
            userIdToLiveKitIdentity={userIdToLiveKitIdentity}
            onReturnToStream={() => {
              refreshStream();
            }}
            onToggleCamera={handleToggleCamera}
            onToggleMic={handleToggleMic}
          />
        </GiftSystemProvider>
      </ErrorBoundary>
    );
  }

  function onLiveKitMicMute(): void {
    throw new Error('Function not implemented.')
  }

  function onLiveKitMicUnmute(): void {
    throw new Error('Function not implemented.')
  }

  // Broadofficer appointment popup (realtime)
  const broadofficerPopupVisible = broadofficerPopup?.visible && !!streamId

  return (
    <GiftSystemProvider streamId={streamId} defaultReceiverId={hostId}>
      <ErrorBoundary>
        {/* Broadofficer appointment notification popup */}
        {broadofficerPopupVisible && (
          <div
            className="fixed inset-x-0 top-4 z-[200] flex justify-center pointer-events-none"
            onClick={dismissBroadofficerPopup}
          >
            <div
              className="pointer-events-auto max-w-md w-[calc(100%-2rem)] rounded-2xl border border-blue-400/30 bg-slate-950/95 px-5 py-4 shadow-[0_0_40px_rgba(59,130,246,0.25)] backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15">
                  <Shield className="h-5 w-5 text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">Broadofficer Assigned</p>
                  <p className="mt-1 text-xs text-blue-200/80">{broadofficerPopup.message}</p>
                  <p className="mt-1 text-[10px] text-blue-300/60">Your account permissions have been updated.</p>
                </div>
                <button
                  onClick={dismissBroadofficerPopup}
                  className="shrink-0 rounded-lg p-1 text-blue-300/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={cn('relative flex h-dvh w-full flex-col overflow-hidden', theme.pageShell)}>

          {/* Background layers — identical to Sidebar ShellBackdrop */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-25" />

          <GiftVideoOverlay gifts={recentGifts} onFinish={handleRemoveGiftOverlay} />

           {!isMobileViewer && (
             <>
               <BroadcastNeonHeader
                 stream={stream}
                 broadcasterProfile={broadcasterProfile
                   ? {
                     username: broadcasterProfile.username,
                     avatar_url: broadcasterProfile.avatar_url,
                     display_name: broadcasterProfile.display_name,
                   }
                   : null}
                 isHost={false}
                 liveViewerCount={viewerCount}
                 handleLike={handleLike}
                 onGift={() => onGift(hostId)}
                 onShare={handleShare}
                 onEndStream={handleLeave}
                 coinBalance={(profile as any)?.troll_coins ?? 0}
                 onOpenCoinStore={user?.id ? () => toast.info('Coin Store opens from the viewer action bar.') : undefined}
                 isLive={isActive}
                 streamStartedAt={(stream as any).started_at} />
{/* Audience Bubble Ticker and Top Subscribers Bar */}
                <div className="w-full z-20 px-0 pt-1 pb-2 flex items-center justify-center bg-gradient-to-r from-slate-950/80 via-black/60 to-slate-950/80 backdrop-blur-xl border-b border-cyan-400/10 shadow-[0_2px_32px_0_rgba(34,211,238,0.10)]">
                  <div className="w-full max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-0">
                    <AudienceBubbleTicker
                      streamId={streamId}
                      audience={audience}
                      currentUserId={user?.id}
                      hostUserId={hostId || undefined}
                      maxVisible={8}
                      className="relative z-0 hidden sm:flex pointer-events-none"
                      onGiftUser={onGift}
                    />
                    {hostId && (
                      <TopSubscribersBar broadcasterId={hostId} />
                    )}
                  </div>
                </div>

                {myLeagues.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-3xl border border-cyan-500/10 bg-slate-950/90 p-4 text-sm text-slate-200 shadow-[0_0_30px_rgba(45,212,191,0.08)] sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">
                          {myLeagues[0].icon_emoji || '🏆'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">League: {myLeagues[0].name}</p>
                          <p className="text-xs text-slate-400">
                            {myLeagues.length === 1 ? 'League membership active' : `${myLeagues.length} leagues joined`} • {myLeagues[0].member_count}/{myLeagues[0].max_members} members
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
                        Open League tab for your status, missions, and leaderboard.
                      </div>
                    </div>
                  </div>
                )}
             </>
           )}

           {/* Random Battle Banner — prominent notice for queue/active battle */}
           {stream && (
             <RandomBattleBanner
               phase={randomBattlePhase}
               delayUntil={null}
               isBroadcaster={false}
               mobileSafe={isMobileViewer}
             />
           )}

  <main
               className={cn(
                 'relative z-10 flex flex-1 min-h-0',
                 isMobileViewer
                   ? layoutMode === 'grid'
                     ? 'grid overflow-hidden pr-12'
                     : 'flex-col overflow-hidden px-0 pt-0'
                   : 'grid gap-4 px-5 py-4',
                   !isMobileViewer && layoutMode === 'grid' ? 'grid-rows-[1fr_1fr]' : '',
               )}
                style={
                 isMobileViewer && layoutMode === 'grid'
                   ? {
                       gridTemplateColumns: 'repeat(2, 1fr)',
                       gridAutoRows: '1fr',
                       gap: '4px',
                       maxHeight: `calc(100dvh - ${MOBILE_CHAT_INPUT_HEIGHT + 8}px - env(safe-area-inset-bottom))`,
                     }
                  : !isMobileViewer
                    ? layoutMode === 'grid'
                      ? {
                          gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, Math.min(effectiveBoxCount, 8)))}, minmax(0, 1fr))`,
                          gridAutoRows: 'minmax(0, 1fr)',
                          gap: '12px',
                        }
                      : {
                          gridTemplateColumns:
                            seatCards.length > 0
                              ? 'minmax(430px, 1.05fr) minmax(360px, 1fr) 360px'
                              : 'minmax(560px, 1fr) 360px',
                        }
                    : undefined
              }
            >
             {/* Broadcast Frame as border decoration */}
             {broadcastFrame && (
               <BroadcastFrame frame={broadcastFrame} className="absolute inset-0 z-0 rounded-3xl pointer-events-none">
                 <div className="absolute inset-0" />
               </BroadcastFrame>
             )}
             
             {/* ── LEFT: Host Video Card / Mobile Watch Surface ─────────────── */}
            {layoutMode === 'grid' ? (
              /* ===== GRID MODE: Broadcaster tile (same size as seat tiles) ===== */
              <div
               className={cn(
                   'relative min-h-0 overflow-hidden border border-cyan-400/30 bg-transparent',
                   'aspect-square',
                   isMobileViewer ? 'rounded-lg' : 'rounded-2xl shadow-[0_0_20px_rgba(45,212,191,0.15)]'
                 )}
              >
                <RemoteVideoSurface
                  participant={broadcasterState.participant}
                  mirror={true}
                  className="absolute inset-0"
                  onTap={handleLike}
                  room={liveKitRoom}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_42%),#030611]">
                      <div className={cn(
                        'border border-cyan-400/20 bg-slate-950/70 text-center shadow-2xl shadow-cyan-500/10 backdrop-blur-xl',
                        isMobileViewer ? 'rounded-xl p-2' : 'rounded-3xl p-4'
                      )} style={{ overflow: 'visible' }}>
                        {broadcasterProfile?.avatar_url ? (
                          <div className={cn(
                            isMobileViewer ? 'mx-auto h-10 w-10' : 'mx-auto h-20 w-20'
                          )} style={{ overflow: 'visible' }}>
                            <ProfileFrame
                              frame={broadcasterFrame}
                              avatarUrl={broadcasterProfile.avatar_url}
                              username={hostName}
                              size={isMobileViewer ? 'sm' : 'md'}
                            />
                          </div>
                        ) : (
                          <Video className={cn(
                            'mx-auto text-cyan-200/70',
                            isMobileViewer ? 'h-6 w-6' : 'h-10 w-10'
                          )} />
                        )}
                        <div className={cn(
                          'font-black',
                          isMobileViewer ? 'mt-1 text-[10px]' : 'mt-3 text-sm'
                        )}>{hostName}</div>
                        <div className={cn(
                          'text-slate-300',
                          isMobileViewer ? 'text-[8px]' : 'mt-1 text-xs'
                        )}>
                          {isActive ? 'Camera Off' : 'Waiting for broadcast…'}
                        </div>
                      </div>
                    </div>
                  }
                />

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />

                {/* Host badge */}
                <div className={cn(
                  'absolute z-10 flex items-center',
                  isMobileViewer ? 'left-1 top-1' : 'left-3 top-3 gap-1.5'
                )}>
                  <div className={cn(
                    'border border-cyan-400/40 bg-cyan-500/15 font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)] backdrop-blur-xl',
                    isMobileViewer ? 'rounded px-1 py-0.5 text-[7px]' : 'rounded-lg px-2.5 py-1 text-xs gap-1.5 flex items-center'
                  )}>
                    {!isMobileViewer && <Crown className="h-3 w-3" />}
                    Host
                  </div>
                </div>

                {/* LIVE / STARTING badge */}
                <div className={cn(
                  'absolute z-20 flex items-center',
                  isMobileViewer ? 'right-1 top-1' : 'right-3 top-3 gap-1.5'
                )}>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border font-black shadow-inner backdrop-blur-xl',
                      isMobileViewer ? 'h-4 gap-0.5 px-1 text-[7px]' : 'h-6 gap-1.5 px-2 text-[10px]',
                      isActive
                        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                        : 'border-yellow-400/30 bg-yellow-500/15 text-yellow-200'
                    )}
                  >
                    <span className={cn(
                      'rounded-full bg-current shadow-[0_0_10px_currentColor]',
                      isMobileViewer ? 'h-1 w-1' : 'h-1.5 w-1.5'
                    )} />
                    {isActive ? 'LIVE' : 'STARTING'}
                  </span>
                </div>

                {/* Seat number badge */}
                <div className={cn(
                  'absolute z-10 rounded-full border border-cyan-300/20 bg-black/15 font-black text-white/90 backdrop-blur-sm',
                  isMobileViewer ? 'left-1 bottom-1 px-1 py-0.5 text-[7px]' : 'left-3 bottom-3 px-2.5 py-1 text-[10px]'
                )}>
                  S1
                </div>

                <div className={cn(
                  'absolute z-10 flex items-center',
                  isMobileViewer ? 'right-1 bottom-1 gap-0.5' : 'right-3 bottom-3 gap-2'
                )}>
                  {broadcasterCityStatus.data && (
                    <CityStatusOrb
                      data={broadcasterCityStatus.data}
                      permissions={{ isSelf: false, canCheckLicense: false, canRaid: false, canRepair: false, canEnforce: false, canRemoveFromSeat: false, canAccessAll: false }}
                      compact
                      onHouseClick={() => setSelectedSeatUserId(hostId)}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* ===== SPLIT MODE: Large broadcaster panel ===== */
            <section
              className={cn(
                'relative min-h-0 overflow-hidden',
                theme.hostVideoPanel,
                isMobileViewer
                  ? 'flex-none rounded-xl border-2 border-cyan-400/40'
                  : 'rounded-2xl border border-cyan-400/30'
              )}
              style={
                isMobileViewer
                  ? {
                      height: mobileHostVideoHeight,
                      maxHeight: mobileHostVideoHeight,
                    }
                  : undefined
              }
            >
              <RemoteVideoSurface
                participant={broadcasterState.participant}
                mirror={true}
                className="absolute inset-0"
                onTap={handleLike}
                room={liveKitRoom}
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_42%),#030611]">
                    <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-6 text-center shadow-2xl shadow-cyan-500/10 backdrop-blur-xl" style={{ overflow: 'visible' }}>
                      {broadcasterProfile?.avatar_url ? (
                        <div className="mx-auto h-28 w-28" style={{ overflow: 'visible' }}>
                          <ProfileFrame
                            frame={broadcasterFrame}
                            avatarUrl={broadcasterProfile.avatar_url}
                            username={hostName}
                            size="md"
                          />
                        </div>
                      ) : (
                        <Video className="mx-auto h-12 w-12 text-cyan-200/70" />
                      )}
                      <div className="mt-4 text-lg font-black">{hostName}</div>
                      <div className="mt-2 text-sm text-slate-300">
                        {isActive ? 'Camera Off' : 'Waiting for broadcast…'}
                      </div>
                    </div>
                  </div>
                }
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />

              {/* Desktop-only overlays */}
              {!isMobileViewer && (
                <>
                  <div className="absolute left-5 top-5 z-20 flex flex-col gap-2">
                    {/* City Status Orb — compact inline (clickable) */}
                    {broadcasterCityStatus.data && (
                      <div className="pointer-events-auto">
                        <CityStatusOrb
                          data={broadcasterCityStatus.data}
                          permissions={{ isSelf: false, canCheckLicense: false, canRaid: false, canRepair: false, canEnforce: false, canRemoveFromSeat: false, canAccessAll: false }}
                          compact
                          onHouseClick={() => setSelectedSeatUserId(hostId)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-black shadow-inner backdrop-blur-xl',
                        isActive
                          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-emerald-500/10'
                          : 'border-yellow-400/30 bg-yellow-500/15 text-yellow-200 shadow-yellow-500/10'
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
                      {isActive ? 'LIVE' : 'STARTING'}
                    </span>
                  </div>
                </>
              )}

              {viewerError && (
                <div className="absolute inset-x-4 top-16 z-30 rounded-2xl border border-red-400/35 bg-gradient-to-r from-red-950/90 to-red-900/80 px-4 py-3 text-sm font-bold text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.25)] backdrop-blur-2xl">
                  {viewerError}
                </div>
              )}

              {!isMobileViewer && (
                <div className="absolute bottom-6 left-6 z-20 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onGift(hostId)}
                    className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black backdrop-blur-xl', theme.purpleButton)}
                  >
                    <Gift className="h-4 w-4" />
                    Gift
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        navigate('/auth?mode=login');
                        return;
                      }
                      setShowSubscribeModal(true);
                    }}
                    className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black backdrop-blur-xl', theme.cyanButton)}
                  >
                    <Crown className="h-4 w-4" />
                    Subscribe
                  </button>
                </div>
              )}


             </section>
             )}

            {/* ── CENTER: Seats belong beside the broadcaster, never over it ── */}
            {hasMounted && !isMobileViewer && layoutMode === 'split' && seatCards.length > 0 && (
              <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-cyan-300/25 bg-black/20 p-4 shadow-[0_0_28px_rgba(45,212,191,0.18)] backdrop-blur-xl">
                <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/80">Live Seats</p>
                    <p className="mt-1 text-xs font-semibold text-slate-300">
                      Seat coins deduct automatically when a viewer joins.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageSeats && (
                      <button
                        type="button"
                        onClick={handleAddSeat}
                        className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/25"
                      >
                        + Add Seat
                      </button>
                    )}
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-slate-200">
                      {seatCards.filter((seat) => !seat.isOccupied).length} open
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-2 gap-5 auto-rows-fr">
                  {seatCards.map((seat) => {
                    const seatStatus = String(seat.seat?.status || '').toLowerCase()
                    const seatUserId = seat.seat?.user_id || seat.seat?.guest_id || null
                    const isMine = Boolean(user?.id && (seat.seat?.user_id === user.id || seat.seat?.guest_id === user.id))

                    // Use isolated seat state — each seat only accesses its own track
                    const seatState = seatTracks[seat.seatIndex] || null
                    const seatParticipant = !isMine && seatState ? seatState.participant : null
                    const seatIsLoading = seatState?.isLoading || false

                    const statusLabel = isMine
                      ? 'You'
                      : seat.isOccupied
                        ? seat.displayName
                        : seat.isLocked
                          ? 'Locked'
                          : seat.seatPrice === 0
                            ? 'Free Seat'
                            : `${seat.seatPrice} Coins`

                    // Any occupied seat is clickable to open CityStatusPanel
                    const canClickSeat = seat.isOccupied && seatUserId;

                    const seatClickProps = canClickSeat
                      ? {
                          role: 'button' as const,
                          tabIndex: 0,
                          onClick: () => setSelectedSeatUserId(seatUserId),
                          onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedSeatUserId(seatUserId);
                            }
                          },
                        }
                      : undefined;

                    return (
                      <div
                        key={seat.seatIndex}
                        className={cn(
                          'relative min-h-0 overflow-hidden rounded-2xl border bg-transparent shadow-[inset_0_0_18px_rgba(15,23,42,0.78)] transition-all',
                          isMine
                            ? 'border-emerald-300/60 shadow-[0_0_24px_rgba(16,185,129,0.18)]'
                            : seat.isOccupied
                              ? 'border-purple-300/45 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_45%),rgba(2,6,23,0.82)] shadow-[0_0_24px_rgba(168,85,247,0.16)]'
                              : seat.isLocked
                                ? 'border-white/10 bg-transparent opacity-70'
                                : 'border-white/10 bg-transparent hover:border-white/20 hover:shadow-[0_0_24px_rgba(15,23,42,0.18)]',
                          canClickSeat ? 'cursor-pointer hover:-translate-y-0.5' : ''
                        )}
                        {...seatClickProps}
                      >
                        {isMine ? (
                          <LocalVideoSurface
                            videoTrack={localVideoTrack}
                            audioTrack={localAudioTrack}
                            mirror={false}
                            className="absolute inset-0"
                            fallback={
                              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/30 bg-emerald-500/10">
                                  <Users className="h-6 w-6 text-emerald-100/80" />
                                </div>
                                <div className="px-3 text-sm font-black text-white">Your camera</div>
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Camera starting</div>
                              </div>
                            }
                          />
                        ) : seat.isOccupied ? (
                          <RemoteVideoSurface
                            participant={seatParticipant}
                            mirror={true}
                            className="absolute inset-0"
                            room={liveKitRoom}
                            fallback={
                              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-purple-300/30 bg-purple-500/10">
                                  <Users className="h-6 w-6 text-purple-200/80" />
                                </div>
                                <div className="px-3 text-sm font-black text-white">{seat.displayName}</div>
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-200/70">Camera starting</div>
                              </div>
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={!seat.canJoin}
                            onClick={() => seat.canJoin && handleJoinSeatByIndex(seat.seatIndex)}
                            className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center disabled:cursor-not-allowed"
                          >
                            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-500/40 bg-transparent">
                              <Users className="h-6 w-6 text-slate-200" />
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-black text-white">
                              Seat {seat.seatIndex}
                            </div>
                            <div className={cn('text-xs font-bold', seat.canJoin ? 'text-slate-200' : 'text-slate-500')}>
                              {statusLabel}
                            </div>
                          </button>
                        )}

                        {seat.isOccupied && (
                          <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md">
                            <div className="min-w-0 flex-1">
                              {seatUserId ? (
                                <SeatCityStatusOrb
                                  userId={seatUserId}
                                  broadcasterId={hostId}
                                  isBroadOfficer={isOfficer}
                                  onClick={() => setSelectedSeatUserId(seatUserId)}
                                />
                              ) : (
                                <>
                                  <p className="truncate text-xs font-black text-white">Seat {seat.seatIndex}</p>
                                  <p className="truncate text-[11px] font-bold text-cyan-100/70">{statusLabel}</p>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {seat.isMine && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleLeaveSeat(); }}
                                  className="rounded-lg border border-red-300/25 bg-red-500/15 px-2 py-1 text-[11px] font-black text-red-100"
                                >
                                  Leave
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </aside>
            )}

            {/* ── GRID MODE: Individual seat tiles rendered as direct grid children -- */}
            {hasMounted && layoutMode === 'grid' && seatCards.map((seat) => {
              const seatStatus = String(seat.seat?.status || '').toLowerCase()
              const seatUserId = seat.seat?.user_id || seat.seat?.guest_id || null
              const seatIdentity = seat.seat?.livekit_participant_identity || seatUserId
              const isMine = Boolean(user?.id && (seat.seat?.user_id === user.id || seat.seat?.guest_id === user.id))
              const seatParticipant = !isMine && seatIdentity
                ? remoteParticipants.find((participant: any) => {
                    const participantIdentity = String(participant?.identity || '')
                    return (
                      participantMatchesUser(participant, seatIdentity) ||
                      participantMatchesUser(participant, seatUserId) ||
                      participantIdentity === String(seatIdentity) ||
                      participantIdentity.endsWith(`-${seatIdentity}`) ||
                      String(seatIdentity).endsWith(participantIdentity)
                    )
                  })
                : null

              const statusLabel = isMine
                ? 'You'
                : seat.isOccupied
                  ? seat.displayName
                  : seat.isLocked
                    ? 'Locked'
                    : seat.seatPrice === 0
                      ? 'Free Seat'
                      : `${seat.seatPrice} Coins`

              const canClickSeat = seat.isOccupied && seatUserId;
              const seatClickProps = canClickSeat
                ? {
                    role: 'button' as const,
                    tabIndex: 0,
                    onClick: () => setSelectedSeatUserId(seatUserId),
                    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedSeatUserId(seatUserId);
                      }
                    },
                  }
                : undefined;

              return (
                <div
                  key={`grid-seat-${seat.seatIndex}`}
                  className={cn(
                    'relative min-h-0 overflow-hidden border bg-transparent transition-all',
                    isMobileViewer ? 'aspect-square rounded-lg' : 'rounded-2xl shadow-[inset_0_0_18px_rgba(15,23,42,0.78)]',
                    isMine
                      ? 'border-emerald-300/60'
                      : seat.isOccupied
                        ? 'border-purple-300/45 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_45%),rgba(2,6,23,0.82)]'
                        : seat.isLocked
                          ? 'border-white/10 bg-transparent opacity-70'
                          : 'border-white/10 bg-transparent',
                    canClickSeat ? 'cursor-pointer' : ''
                  )}
                  {...seatClickProps}
                >
                  {isMine ? (
                    <LocalVideoSurface
                      videoTrack={localVideoTrack}
                      audioTrack={localAudioTrack}
                      mirror={false}
                      className="absolute inset-0"
                      fallback={
                        <div className={cn(
                          'flex h-full w-full flex-col items-center justify-center text-center',
                          isMobileViewer ? 'gap-0.5' : 'gap-3'
                        )}>
                          <div className={cn(
                            'grid place-items-center rounded-xl border border-emerald-300/30 bg-emerald-500/10',
                            isMobileViewer ? 'h-6 w-6' : 'h-12 w-12'
                          )}>
                            <Users className={cn(isMobileViewer ? 'h-3 w-3' : 'h-6 w-6', 'text-emerald-100/80')} />
                          </div>
                          <div className={cn('px-1 font-black text-white', isMobileViewer ? 'text-[8px]' : 'text-sm')}>You</div>
                        </div>
                      }
                    />
                  ) : seat.isOccupied ? (
                    <RemoteVideoSurface
                      participant={seatParticipant}
                      mirror={true}
                      className="absolute inset-0"
                      room={liveKitRoom}
                      fallback={
                        <div className={cn(
                          'flex h-full w-full flex-col items-center justify-center text-center',
                          isMobileViewer ? 'gap-0.5' : 'gap-3'
                        )}>
                          <div className={cn(
                            'grid place-items-center rounded-xl border border-purple-300/30 bg-purple-500/10',
                            isMobileViewer ? 'h-6 w-6' : 'h-12 w-12'
                          )}>
                            <Users className={cn(isMobileViewer ? 'h-3 w-3' : 'h-6 w-6', 'text-purple-200/80')} />
                          </div>
                          <div className={cn('px-1 font-black text-white truncate', isMobileViewer ? 'text-[8px]' : 'text-sm')}>{seat.displayName}</div>
                        </div>
                      }
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!seat.canJoin}
                      onClick={() => seat.canJoin && handleJoinSeatByIndex(seat.seatIndex)}
                      className={cn(
                        'flex h-full w-full flex-col items-center justify-center text-center disabled:cursor-not-allowed',
                        isMobileViewer ? 'gap-0.5 p-1' : 'gap-3 p-4'
                      )}
                    >
                      <div className={cn(
                        'grid place-items-center rounded-lg border border-slate-500/40 bg-transparent',
                        isMobileViewer ? 'h-5 w-5' : 'h-12 w-12'
                      )}>
                        <Plus className={cn(isMobileViewer ? 'h-2.5 w-2.5' : 'h-6 w-6', 'text-slate-200')} />
                      </div>
                      <div className={cn(
                        'border border-white/10 bg-black/20 font-black text-white',
                        isMobileViewer ? 'rounded px-1 py-0.5 text-[7px]' : 'rounded-xl px-4 py-2 text-sm'
                      )}>
                        S{seat.seatIndex}
                      </div>
                      <div className={cn(
                        isMobileViewer ? 'text-[7px]' : 'text-xs',
                        'font-bold',
                        seat.canJoin ? 'text-slate-200' : 'text-slate-500'
                      )}>
                        {seat.isLocked ? 'Locked' : seat.seatPrice === 0 ? 'Free' : `${seat.seatPrice}◈`}
                      </div>
                    </button>
                  )}

                  {seat.isOccupied && (
                    <div className={cn(
                      'absolute z-20 flex items-center justify-between border border-white/10 bg-black/55 backdrop-blur-md',
                      isMobileViewer
                        ? 'inset-x-0.5 bottom-0.5 gap-0.5 rounded px-1 py-0.5'
                        : 'inset-x-3 bottom-3 gap-2 rounded-xl px-3 py-2'
                    )}>
                      <div className="min-w-0 flex-1">
                        {seatUserId ? (
                          <SeatCityStatusOrb
                            userId={seatUserId}
                            broadcasterId={hostId}
                            isBroadOfficer={isOfficer}
                            onClick={() => setSelectedSeatUserId(seatUserId)}
                          />
                        ) : (
                          <>
                            <p className={cn('truncate font-black text-white', isMobileViewer ? 'text-[7px]' : 'text-xs')}>Seat {seat.seatIndex}</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center shrink-0">
                        {seat.isMine && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleLeaveSeat(); }}
                            className={cn(
                              'border border-red-300/25 bg-red-500/15 font-black text-red-100',
                              isMobileViewer ? 'rounded px-1 py-0.5 text-[7px]' : 'rounded-lg px-2 py-1 text-[11px]'
                            )}
                          >
                            Leave
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

           {/* ── MOBILE PWA: Seats overlay on broadcaster video (split mode only) ── */}
           {hasMounted && isMobileViewer && layoutMode === 'split' && seatCards.length > 0 && (
             <div
               className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col"
               style={{
                 bottom: `calc(${MOBILE_CHAT_INPUT_HEIGHT}px + 8px + env(safe-area-inset-bottom))`,
                 maxHeight: mobileSeatGridHeight,
               }}
             >
               <div className="pointer-events-auto overflow-y-auto px-2 pb-1 scrollbar-hide">
                 <div
                   className={cn(
                     'grid gap-2',
                     mobileSeatGridCols
                   )}
                 >
                   {seatCards.map((seat) => {
                     const seatStatus = String(seat.seat?.status || '').toLowerCase()
                     const seatUserId = seat.seat?.user_id || seat.seat?.guest_id || null
                     const seatIdentity = seat.seat?.livekit_participant_identity || seatUserId
                     const isMine = Boolean(user?.id && (seat.seat?.user_id === user.id || seat.seat?.guest_id === user.id))
                     const seatParticipant = !isMine && seatIdentity
                       ? remoteParticipants.find((participant: any) => {
                           const participantIdentity = String(participant?.identity || '')
                           return (
                             participantMatchesUser(participant, seatIdentity) ||
                             participantMatchesUser(participant, seatUserId) ||
                             participantIdentity === String(seatIdentity) ||
                             participantIdentity.endsWith(`-${seatIdentity}`) ||
                             String(seatIdentity).endsWith(participantIdentity)
                           )
                         })
                       : null

                     return (
                          <div
                          key={seat.seatIndex}
                          className={cn(
                            'relative overflow-hidden rounded-lg border',
                           isMine
                             ? 'border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                             : seat.isOccupied
                               ? 'border-purple-400/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                               : 'border-white/20',
                           'bg-transparent h-[68px] w-full'
                         )}
                      >
                        {isMine ? (
                          <LocalVideoSurface
                            videoTrack={localVideoTrack}
                            audioTrack={localAudioTrack}
                            mirror={false}
                            className="absolute inset-0"
                            fallback={
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
                                <Users className="h-5 w-5 text-emerald-300/70" />
                                <div className="text-[10px] font-black text-white">You</div>
                                <div className="text-[9px] text-emerald-200/60">Starting</div>
                              </div>
                            }
                          />
                        ) : seat.isOccupied ? (
                          <RemoteVideoSurface
                            participant={seatParticipant}
                            mirror={true}
                            className="absolute inset-0"
                            room={liveKitRoom}
                            fallback={
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
                                <Users className="h-5 w-5 text-purple-300/70" />
                                <div className="max-w-full truncate px-1 text-[10px] font-black text-white">{seat.displayName}</div>
                                <div className="text-[9px] text-purple-200/60">Starting</div>
                              </div>
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={!seat.canJoin}
                            onClick={() => seat.canJoin && handleJoinSeatByIndex(seat.seatIndex)}
                            className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-1.5 text-center bg-transparent disabled:cursor-not-allowed"
                          >
                            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-transparent">
                              <Plus className="h-5 w-5 text-white/70" />
                            </div>
                            <div className="text-[11px] font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Seat {seat.seatIndex}</div>
                            <div className="text-[10px] font-bold text-white/60 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                              {seat.isLocked ? 'Locked' : seat.seatPrice === 0 ? 'Free' : `${seat.seatPrice} ◈`}
                            </div>
                          </button>
                        )}

                        {/* Seat label overlay */}
                        {seat.isOccupied && (
                          <div className="absolute inset-x-0 bottom-0 px-1.5 py-0.5">
                            <p className="truncate text-[9px] font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">{seat.displayName}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── RIGHT: Desktop Chat Panel — same flow layout style as BroadcastPage ── */}
          {!isMobileViewer && layoutMode === 'split' && (
            <aside
              className={cn(
                theme.chatPanel,
                'flex h-full min-h-0 flex-col overflow-hidden bg-black/20 border border-white/10 backdrop-blur-xl shadow-[0_0_28px_rgba(45,212,191,0.12)]'
              )}
            >
              <div className="grid shrink-0 grid-cols-5 border-b border-white/10 bg-black/10">
                 {['Chat', 'Progress', 'League', 'Gifts', 'Top Fans'].map((tab) => {
                   const tabKey = tab.toLowerCase().replace(/\s+/g, '-') as 'chat' | 'progress' | 'league' | 'gifts' | 'top-fans'
                  const active = chatTab === tabKey
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setChatTab(tabKey)}
                      className={cn(
                        'relative h-16 text-sm font-black transition-colors',
                        active ? 'text-white' : 'text-white/60 hover:text-white/80'
                      )}
                      data-active={active}
                    >
                      {tab}
                      {active && (
                        <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_12px_rgba(45,212,191,0.7)]" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {chatTab === 'progress' ? (
                  <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                    <LeagueProgressPanel streamId={streamId} />
                  </div>
                ) : chatTab === 'chat' ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
                    <div
                      ref={floatingChatContainerRef}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 scrollbar-hide"
                    >
                      {floatingMessages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm font-bold text-white/25">
                          No messages yet say something!
                        </div>
                      ) : (
<div className="flex flex-col gap-1.5">
                           <AnimatePresence initial={false}>
                             {floatingMessages.map((msg) => {
                               const isPinned = pinnedMessageIds.has(msg.id)
                               return (
                               <motion.div
                                 key={msg.id}
                                 initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                 animate={{ opacity: 1, y: 0, scale: 1 }}
                                 exit={{ opacity: 0, y: -40, scale: 0.96 }}
                                 transition={{ duration: 0.4, ease: 'easeOut' }}
                                 className="text-sm leading-relaxed break-words"
                               >
<div className="flex items-start gap-1">
                                   {isPinned && (
                                     <Pin className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" />
                                   )}
                                   <div className="flex-1 min-w-0">
                                     <button
                                       type="button"
                                       onClick={() => handleOpenFloatingChatUsername(msg.username)}
                                       className="cursor-pointer font-black text-cyan-300 transition-colors hover:text-cyan-100 inline-flex items-center gap-1"
                                       title={`View ${msg.username}'s profile`}
                                     >
                                       {msg.username}
                                       {subscriberUsernames?.has(msg.username) && (
                                         <Crown className="w-3 h-3 text-yellow-400" />
                                       )}
                                     </button>
                                     <span className="mx-1 text-white/40">:</span>
                                     <span className="text-white/90">{msg.content}</span>
                                   </div>
                                   {canPinMessages && (
                                     <button
                                       type="button"
                                       onClick={() => isPinned ? handleUnpinMessage(msg.id) : handlePinMessage(msg.id)}
                                       className="flex-shrink-0 p-0.5 rounded text-yellow-400/60 hover:text-yellow-300 hover:bg-yellow-400/10 transition-colors"
                                       title={isPinned ? 'Unpin message' : 'Pin message'}
                                     >
                                       <Pin className="w-3 h-3" fill={isPinned ? 'currentColor' : 'none'} />
                                     </button>
                                   )}
                                  </div>
                                </motion.div>
                            )})
                            }
                            </AnimatePresence>
                        </div>
                      )}
                    </div>

             <form
               onSubmit={async (e) => {
                 e.preventDefault()
                 const text = chatInput.trim()
                 if (!text) return

                 if (hostChatDisabledByOfficer) {
                   toast.error(
                     hostChatDisableRemainingMs
                       ? `Chat is disabled by officer control. Try again in ${Math.ceil(hostChatDisableRemainingMs / 60000)} minute(s).`
                       : 'Chat is disabled by officer control'
                   )
                   return
                 }

                 if (userChatDisabled) {
                   toast.error(
                     chatDisabledRemainingMinutes
                       ? `Your chat is disabled. Try again in ${chatDisabledRemainingMinutes} minute${chatDisabledRemainingMinutes === 1 ? '' : 's'}.`
                       : 'Your chat has been permanently disabled in this stream.'
                   )
                   return
                 }

                 if (!user && !reserveAnonymousChatSlot()) {
                          toast.error('You’ve used your 5 anonymous chats. Sign in to keep chatting.')
                          navigate('/auth?mode=login')
                          return
                        }

                        const username = profile?.username || (profile as any)?.display_name || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
                        const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

                        setFloatingMessages(prev => [{ id: msgId, username, content: text, createdAt: Date.now() }, ...prev].slice(0, 50))
                        setChatInput('')

                        window.setTimeout(() => {
                          setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                        }, CHAT_FLOAT_MS)

                        try {
                          const chatChannel = floatingChatChannelRef.current;
                          if (chatChannel) {
                            chatChannel.send({
                              type: 'broadcast',
                              event: 'floating_chat',
                              payload: { username, content: text },
                            }).catch(() => { })
                          }
                        } catch (err) {
                          console.warn('[ViewerPage] floating chat broadcast failed:', err)
                        }
                      } }
                      className="shrink-0 border-t border-white/10 bg-black/15 px-3 py-2 backdrop-blur-md"
                    >
                      <input
                        type="text"
                         value={chatInput}
                         onChange={(e) => setChatInput(e.target.value)}
                         placeholder={
                           hostChatDisabledByOfficer
                             ? 'Chat disabled by officer control'
                             : userChatDisabled
                               ? 'Chat disabled'
                               : 'Say something�'
                         }
                         disabled={hostChatDisabledByOfficer || userChatDisabled}
                         readOnly={hostChatDisabledByOfficer || userChatDisabled}
                         className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50" maxLength={280} />
                    </form>
                  </div>
                ) : chatTab === 'league' ? (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">League Status</div>
                    {isUserLeaguesLoading ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading league data...</div>
                    ) : myLeagues.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">
                        You are not currently in a league.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {myLeagues.map((league) => {
                          const membership = myMemberships[league.id]
                          const leagueMissionsForLeague = leagueMissions.filter((mission) => mission.league_id === league.id)
                          return (
                            <div key={league.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">
                                  {league.icon_emoji || '🏆'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white truncate">{league.name}</p>
                                  <p className="text-xs text-slate-400 truncate">{league.description || 'League membership active'}</p>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Status</p>
                                  <p className="mt-2 text-sm font-black text-white">{membership?.role || membership?.status || 'Member'}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Score</p>
                                  <p className="mt-2 text-sm font-black text-white">{league.league_score.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Members</p>
                                  <p className="mt-2 text-sm font-black text-white">{league.member_count}/{league.max_members}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Missions</p>
                                  <p className="mt-2 text-sm font-black text-white">{leagueMissionsForLeague.length} active</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : chatTab === 'gifts' ? (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Recent Gifts</div>
                    {recentGifts.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">
                        No gifts have been received yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentGifts.slice(0, 12).map((gift) => (
                          <div key={gift.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-white">
                                  {gift.sender_name || (gift as any).sender_username || 'Anonymous'}
                                </div>
                                <div className="truncate text-xs text-slate-400">
                                  Sent {gift.quantity || 1} {gift.gift_name || 'gift'}
                                </div>
                              </div>
                              <div className="whitespace-nowrap text-xs font-semibold text-cyan-300">
                                {Number((gift as any).coins_amount || gift.amount || 0).toLocaleString()} coins
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Top Fans</div>
                    {isTopFansLoading ? (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">Loading top fans...</div>
                    ) : topGifters.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">No fan activity yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {topGifters.map((fan) => (
                          <div key={fan.sender_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-white">
                                {fan.sender_username?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-white">{fan.sender_username || 'Troll Citizen'}</div>
                                <div className="truncate text-xs text-slate-400">
                                  Last gift: {fan.last_gift_at ? new Date(fan.last_gift_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}
                                </div>
                              </div>
                              <div className="whitespace-nowrap text-xs font-semibold text-cyan-300">{fan.total_gift_coins.toLocaleString()} coins</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </main>

        {/* ===== GRID MODE: Chat panel below the seat grid (desktop only) ===== */}
        {!isMobileViewer && layoutMode === 'grid' && (
          <aside
            className={cn(
              theme.chatPanel,
              'flex flex-col overflow-hidden bg-black/20 border border-white/10 backdrop-blur-xl shadow-[0_0_28px_rgba(45,212,191,0.12)]',
              'h-[280px] shrink-0'
            )}
          >
            {/* Chat tabs */}
            <div className="grid shrink-0 grid-cols-5 border-b border-white/10 bg-black/10">
              {['Chat', 'Progress', 'League', 'Gifts', 'Top Fans'].map((tab) => {
                const tabKey = tab.toLowerCase().replace(/\s+/g, '-') as 'chat' | 'progress' | 'league' | 'gifts' | 'top-fans'
                const active = chatTab === tabKey
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setChatTab(tabKey)}
                    className={cn(
                      'relative h-16 text-sm font-black transition-colors',
                      active ? 'text-white' : 'text-white/60 hover:text-white/80'
                    )}
                    data-active={active}
                  >
                    {tab}
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_12px_rgba(45,212,191,0.7)]" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {chatTab === 'progress' ? (
                <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                  <LeagueProgressPanel streamId={streamId} />
                </div>
              ) : chatTab === 'chat' ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
                  <div
                    ref={floatingChatContainerRef}
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide overscroll-contain"
                  >
                    {floatingMessages.length === 0 && (
                      <div className="flex h-full items-center justify-center text-white/25 text-sm font-bold">
                        No messages yet — say something!
                      </div>
                    )}
                    {floatingMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="text-sm leading-relaxed break-words animate-in fade-in duration-200"
                        style={{ animation: 'slideInFromTop 0.3s ease-out' }}
                      >
                        <button
                          onClick={() => handleOpenFloatingChatUsername(msg.username)}
                          className="font-black text-cyan-300 hover:text-cyan-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                          title={`View ${msg.username}'s profile`}
                        >
                          {msg.username}
                          {subscriberUsernames?.has(msg.username) && (
                            <Crown className="w-3 h-3 text-yellow-400" />
                          )}
                        </button>
                        <span className="text-white/40 mx-1">:</span>
                        <span className="text-white/90">{msg.content}</span>
                      </div>
                    ))}
                  </div>
                  {/* Chat input */}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const text = chatInput.trim()
                      if (!text) return

                      if (hostChatDisabledByOfficer) {
                        toast.error(
                          hostChatDisableRemainingMs
                            ? `Chat is disabled by officer control. Try again in ${Math.ceil(hostChatDisableRemainingMs / 60000)} minute(s).`
                            : 'Chat is disabled by officer control'
                        )
                        return
                      }

                      if (userChatDisabled) {
                        toast.error(
                          chatDisabledRemainingMinutes
                            ? `Your chat is disabled. Try again in ${chatDisabledRemainingMinutes} minute${chatDisabledRemainingMinutes === 1 ? '' : 's'}.`
                            : 'Your chat has been permanently disabled in this stream.'
                        )
                        return
                      }

                      if (!user && !reserveAnonymousChatSlot()) {
                        toast.error("You've used your 5 anonymous chats. Sign in to keep chatting.")
                        navigate('/auth?mode=login')
                        return
                      }

                      const username = profile?.username || (profile as any)?.display_name || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
                      const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

                      setFloatingMessages(prev => [{ id: msgId, username, content: text, createdAt: Date.now() }, ...prev].slice(0, 50))
                      setChatInput('')

                      setTimeout(() => {
                        setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                      }, CHAT_FLOAT_MS)

                      try {
                        const chatChannel = floatingChatChannelRef.current;
                        if (chatChannel) {
                          chatChannel.send({
                            type: 'broadcast',
                            event: 'floating_chat',
                            payload: { username, content: text },
                          }).catch(() => {})
                        }
                      } catch (err) {
                        console.warn('[ViewerPage] floating chat broadcast failed:', err)
                      }
                    }}
                    className="mt-auto border-t border-white/10 bg-black/15 px-3 py-2 backdrop-blur-md"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={
                        hostChatDisabledByOfficer
                          ? 'Chat disabled by officer control'
                          : 'Say something…'
                      }
                      disabled={hostChatDisabledByOfficer}
                      readOnly={hostChatDisabledByOfficer}
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      maxLength={280}
                    />
                  </form>
                </div>
              ) : chatTab === 'league' ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200">
                  <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">League Status</div>
                  {isUserLeaguesLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading leagues...</div>
                  ) : myLeagues.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">
                      You are not in any league yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myLeagues.map((league) => {
                        const membership = myMemberships[league.id]
                        const leagueMissionsForLeague = leagueMissions.filter((mission) => mission.league_id === league.id)
                        return (
                          <div key={league.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">
                                {league.icon_emoji || '🏆'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-white truncate">{league.name}</p>
                                <p className="text-xs text-slate-400 truncate">{league.description || 'League membership active'}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Status</p>
                                <p className="mt-2 text-sm font-black text-white">{membership?.role || membership?.status || 'Member'}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Score</p>
                                <p className="mt-2 text-sm font-black text-white">{league.league_score.toLocaleString()}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Members</p>
                                <p className="mt-2 text-sm font-black text-white">{league.member_count}/{league.max_members}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Missions</p>
                                <p className="mt-2 text-sm font-black text-white">{leagueMissionsForLeague.length} active</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : chatTab === 'gifts' ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                  <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Recent Gifts</div>
                  {recentGifts.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">No gifts yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {recentGifts.slice(-20).reverse().map((gift) => (
                        <div key={gift.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-white">
                                {gift.sender_name || (gift as any).sender_username || 'Anonymous'}
                              </div>
                              <div className="truncate text-xs text-slate-400">
                                Sent {gift.quantity || 1} {gift.gift_name || 'gift'}
                              </div>
                            </div>
                            <div className="whitespace-nowrap text-xs font-semibold text-cyan-300">
                              {Number((gift as any).coins_amount || gift.amount || 0).toLocaleString()} coins
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                  <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Top Fans</div>
                  {isTopFansLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading top fans...</div>
                  ) : topGifters.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">No top fans yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {topGifters.map((fan, index) => (
                        <div key={fan.sender_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-200">
                                #{index + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-white">{fan.sender_username || 'Troll Citizen'}</div>
                                <div className="truncate text-xs text-slate-400">
                                  {fan.last_gift_at
                                    ? `Last gift: ${new Date(fan.last_gift_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                                    : 'All-time supporter'}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-black text-cyan-300">{fan.total_gift_coins.toLocaleString()}</div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">coins gifted</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── MOBILE CHAT INPUT AT BOTTOM — fixed overlay, not document flow ── */}
        {isMobileViewer && (
          <div
            className="fixed inset-x-3 z-40 pointer-events-auto"
            style={{ bottom: `env(safe-area-inset-bottom)` }}
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const text = chatInput.trim()
                if (!text) return

                if (hostChatDisabledByOfficer) {
                  toast.error(
                    hostChatDisableRemainingMs
                      ? `Chat is disabled by officer control. Try again in ${Math.ceil(hostChatDisableRemainingMs / 60000)} minute(s).`
                      : 'Chat is disabled by officer control'
                  )
                  return
                }

                if (!user && !reserveAnonymousChatSlot()) {
                  toast.error('You’ve used your 5 anonymous chats. Sign in to keep chatting.')
                  navigate('/auth?mode=login')
                  return
                }

                const username = profile?.username || (profile as any)?.display_name || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
                const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

                setFloatingMessages(prev => [{ id: msgId, username, content: text, createdAt: Date.now() }, ...prev].slice(0, 50))
                setChatInput('')

                window.setTimeout(() => {
                  setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                }, 20000)

                try {
                  const chatChannel = floatingChatChannelRef.current;
                  if (chatChannel) {
                    chatChannel.send({
                      type: 'broadcast',
                      event: 'floating_chat',
                      payload: { username, content: text },
                    }).catch(() => { })
                  }
                } catch {
                  // keep local optimistic message visible
                }
              } }
              className="flex gap-2 rounded-2xl border border-white/10 bg-black/45 p-2 shadow-[0_0_24px_rgba(34,211,238,0.16)] backdrop-blur-xl"
            >
               <input
                 type="text"
                 value={chatInput}
                 onChange={(e) => setChatInput(e.target.value)}
                 placeholder={
                   hostChatDisabledByOfficer
                     ? 'Chat disabled by officer control'
                     : userChatDisabled
                       ? 'Chat disabled'
                       : 'Say something�'
                 }
                 disabled={hostChatDisabledByOfficer || userChatDisabled}
                 readOnly={hostChatDisabledByOfficer || userChatDisabled}
                 className={cn(
                   "h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50",
                   (hostChatDisabledByOfficer || userChatDisabled) && "opacity-50 cursor-not-allowed"
                 )}
                 maxLength={280} />
               <button
                 type="submit"
                 disabled={!chatInput.trim() || hostChatDisabledByOfficer || userChatDisabled}
                 className={cn(
                   'inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50',
                   chatInput.trim() && !hostChatDisabledByOfficer && !userChatDisabled
                     ? 'border border-cyan-400/30 bg-cyan-500/20 text-cyan-300'
                     : 'border border-white/10 bg-white/5 text-white/30'
                 )}
               >
                Send
              </button>
            </form>
           </div>
         )}

         {/* ── MOBILE: Chat ticker in center of screen ── */}
         {isMobileViewer && floatingMessages.length > 0 && !isMobileChatOpen && (
           <div
             className="fixed inset-x-0 z-30 pointer-events-none flex flex-col items-center"
             style={{
               top: '35%',
               left: 0,
               right: '48px',
             }}
           >
             <AnimatePresence initial={false}>
               {floatingMessages.slice(0, 3).map((message, idx) => (
                 <motion.div
                   key={message.id}
                   initial={{ opacity: 0, y: 20, scale: 0.9 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   exit={{ opacity: 0, y: -15, scale: 0.95 }}
                   transition={{ duration: 0.4, ease: 'easeOut' }}
                   className={cn(
                     'pointer-events-auto mb-2 max-w-[85%] rounded-xl border-2 border-black px-3 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)]',
                     idx === 0 ? 'bg-purple-700/95' : 'bg-purple-700/70'
                   )}
                 >
                   {isModOrHigher ? (
                     <button
                       type="button"
                       onClick={(e) => { e.stopPropagation(); handleOpenFloatingChatUsername(message.username) }}
                       className="font-black text-[11px] inline-flex items-center gap-1 cursor-pointer"
                       style={{
                         color: '#39ff14',
                         textShadow: '0 0 4px #39ff14, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
                       }}
                     >
                       {message.username}
                     </button>
                   ) : (
                     <span
                       className="font-black text-[11px] inline-flex items-center gap-1"
                       style={{
                         color: '#39ff14',
                         textShadow: '0 0 4px #39ff14, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
                       }}
                     >
                       {message.username}
                     </span>
                   )}
                   {' '}
                   <span
                     className="text-[11px]"
                     style={{
                       color: '#39ff14',
                       textShadow: '0 0 3px #39ff14, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
                     }}
                   >
                     {message.content}
                   </span>
                 </motion.div>
               ))}
             </AnimatePresence>
           </div>
         )}

         {/* ── MOBILE: Toggleable chat box ── */}
         {isMobileViewer && isMobileChatOpen && (
           <div
             className="fixed inset-x-0 z-40 pointer-events-auto flex flex-col"
             style={{
               top: '10%',
               bottom: `calc(${MOBILE_CHAT_INPUT_HEIGHT}px + 8px + env(safe-area-inset-bottom))`,
               right: '48px',
             }}
           >
             <div className="flex items-center justify-between border-b border-white/10 bg-zinc-900/95 px-3 py-2 backdrop-blur-xl">
               <span className="text-xs font-black text-white uppercase tracking-wider">Chat</span>
               <button
                 type="button"
                 onClick={() => setIsMobileChatOpen(false)}
                 className="text-zinc-400 hover:text-white transition-colors"
               >
                 <X size={16} />
               </button>
             </div>
             <div className="flex-1 overflow-y-auto bg-black/80 backdrop-blur-xl px-2 py-2 scrollbar-hide">
               {floatingMessages.length === 0 ? (
                 <div className="flex h-full items-center justify-center text-sm font-bold text-white/25">
                   No messages yet
                 </div>
               ) : (
                 <div className="flex flex-col gap-1">
                   <AnimatePresence initial={false}>
                     {floatingMessages.map((msg) => (
                       <motion.div
                         key={msg.id}
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: -10 }}
                         transition={{ duration: 0.25 }}
                         className="rounded-lg border border-black/60 bg-purple-700/80 px-2 py-1"
                       >
                         <button
                           onClick={() => handleOpenFloatingChatUsername(msg.username)}
                           className="font-black text-[11px] cursor-pointer inline-flex items-center gap-1"
                           style={{
                             color: '#39ff14',
                             textShadow: '0 0 3px #39ff14, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
                           }}
                         >
                           {msg.username}
                         </button>
                         <span className="mx-0.5 text-white/30">:</span>
                         <span
                           className="text-[11px]"
                           style={{
                             color: '#39ff14',
                             textShadow: '0 0 2px #39ff14, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
                           }}
                         >
                           {msg.content}
                         </span>
                       </motion.div>
                     ))}
                   </AnimatePresence>
                 </div>
               )}
             </div>
           </div>
         )}

         {/* ── MOBILE: Right-side vertical control bar ── */}
         {isMobileViewer && (
           <div
             className="fixed right-0 z-20 flex flex-col items-center justify-center gap-2 pointer-events-auto"
             style={{
               top: '50%',
               transform: 'translateY(-50%)',
               paddingRight: '4px',
             }}
           >
              {isPaidChatEnabled && (
                <button
                  onClick={() => setIsPaidChatModalOpen(true)}
                   className="inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                 >
                    <MessageSquare className="h-10 w-10" />
                 </button>
               )}
               <button
                 onClick={() => setIsMobileChatOpen(v => !v)}
                 className={cn(
                    'inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold border transition',
                    isMobileChatOpen
                      ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-300'
                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  )}
                >
                  <MessageSquare className="h-10 w-10" />
               </button>
              <button
                onClick={() => onGift(hostId)}
className={cn('inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold', theme.purpleButton)}
               >
                 <Gift className="h-10 w-10" />
              </button>
               <button
                 onClick={handleShare}
                 className={cn('inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold', theme.cyanButton)}
                >
                  <Share2 className="h-10 w-10" />
               </button>
               {isUserOnStage && (
                 <>
                   <button
                     onClick={handleToggleMic}
                     className={cn(
                       'inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold transition',
                       seatMicOn
                         ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                         : 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                     )}
                     title={seatMicOn ? 'Mute mic' : 'Unmute mic'}
                   >
                     {seatMicOn ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />}
                   </button>
                   <button
                     onClick={handleToggleCamera}
                     className={cn(
                       'inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold transition',
                       seatCamOn
                         ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                         : 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                     )}
                     title={seatCamOn ? 'Turn off camera' : 'Turn on camera'}
                   >
                     {seatCamOn ? <Video className="h-10 w-10" /> : <VideoOff className="h-10 w-10" />}
                   </button>
                 </>
               )}
              <button
                onClick={async () => {
                  if (recorder.isRecording) {
                    void recorder.stopRecording()
                  } else if (streamId) {
                    if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
                      toast.error('Screen recording not supported on mobile.', { duration: 5000 })
                      return
                    }
                    try {
                      await recorder.startRecording(streamId)
                    } catch (err: any) {
                      if (err?.message?.includes('getDisplayMedia') || err?.name === 'NotSupportedError' || err?.message?.includes('not a function')) {
                        toast.error('Screen recording not supported on this device.', { duration: 5000 })
                      } else if (err?.name === 'NotAllowedError' || err?.message?.includes('cancelled')) {
                        toast.error('Screen recording was cancelled.')
                      } else {
                        toast.error(`Recording failed: ${err?.message || 'Unknown error'}`)
                      }
                    }
                  }
                }}
                disabled={recorder.isUploading}
                className={cn(
                  'inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold transition',
                  recorder.isRecording
                    ? 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                    : recorder.isUploading
                      ? 'border border-amber-400/30 bg-amber-500/10 text-amber-200'
                      : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                )}
              >
                {recorder.isUploading ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : recorder.isRecording ? (
                  <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" /></span>
                ) : (
                  <MonitorPlay className="h-10 w-10" />
                )}
              </button>
           </div>
         )}

         {/* ── DESKTOP: Bottom control bar ── */}
         {!isMobileViewer && (
          <div
    className={cn(
      'relative z-20 shrink-0 px-4 py-3',
      theme.bottomBar,
      'border-t border-white/10'
    )}
  >
     <div className="flex items-center justify-center gap-3 mx-auto max-w-7xl">
       {isPaidChatEnabled && (
         <button
           onClick={() => setIsPaidChatModalOpen(true)}
           className={cn('inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold', 'border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20')}
         >
            <MessageSquare className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={() => onGift(hostId)}
          className={cn('inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold', theme.purpleButton)}
        >
          <Gift className="h-5 w-5" />
        </button>
        <button
          onClick={handleShare}
          className={cn('inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold', theme.cyanButton)}
        >
          <Share2 className="h-5 w-5" />
        </button>
        {isUserOnStage && (
          <>
            <button
              onClick={handleToggleMic}
              className={cn(
                'inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold transition',
                seatMicOn
                  ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  : 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
              )}
              title={seatMicOn ? 'Mute mic' : 'Unmute mic'}
            >
              {seatMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              onClick={handleToggleCamera}
              className={cn(
                'inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold transition',
                seatCamOn
                  ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  : 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
              )}
              title={seatCamOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {seatCamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          </>
        )}
        <button
          onClick={async () => {
            if (recorder.isRecording) {
              void recorder.stopRecording()
            } else if (streamId) {
              try {
                await recorder.startRecording(streamId)
              } catch (err: any) {
                if (err?.message?.includes('getDisplayMedia') || err?.name === 'NotSupportedError' || err?.message?.includes('not a function')) {
                  toast.error('Screen recording is not supported on this device. Please use the desktop site.', { duration: 5000 })
                } else if (err?.name === 'NotAllowedError' || err?.message?.includes('cancelled')) {
                  toast.error('Screen recording was cancelled.')
                } else {
                  toast.error(`Recording failed: ${err?.message || 'Unknown error'}`)
                }
              }
            }
          }}
          disabled={recorder.isUploading}
          className={cn(
            'inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold transition',
            recorder.isRecording
              ? 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
              : recorder.isUploading
                ? 'border border-amber-400/30 bg-amber-500/10 text-amber-200'
                : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
          )}
        >
         {recorder.isUploading ? (
           <Loader2 className="h-5 w-5 animate-spin" />
         ) : recorder.isRecording ? (
           <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" /></span>
         ) : (
           <MonitorPlay className="h-5 w-5" />
         )}
       </button>
     </div>
   </div>
         )}

        <div className="pointer-events-none absolute inset-0 z-30">
          <div className="pointer-events-auto">
            <GiftBoxModal
              isOpen={isGiftModalOpen}
              onClose={() => {
                setIsGiftModalOpen(false)
                setGiftRecipientId(null)
              } }
              recipientId={giftRecipientId || hostId}
              streamId={streamId}
              broadcasterId={hostId}
              activeUserIds={activeUserIds}
              userProfiles={userProfiles} />

{userActionTarget && (
              <UserActionModal
                onClose={() => setUserActionTarget(null)}
                userId={userActionTarget.userId}
                streamId={streamId || ''}
                username={userActionTarget.username}
                role={userActionTarget.role}
                createdAt={userActionTarget.createdAt}
                isHost={false}
                isModerator={isModerator}
                isOfficer={isOfficer}
                onGift={() => onGift(userActionTarget.userId)}
              />
            )}

            {/* CityStatusPanel for clicking on broadcaster orb or seats */}
            {selectedSeatUserId && (
              <CityStatusPanel
                userId={selectedSeatUserId}
                onClose={() => setSelectedSeatUserId(null)}
                isBroadcaster={false}
                isBroadOfficer={isOfficer}
                broadcasterId={hostId}
                isSeatHolder={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Broadcast Text Popup Overlay */}
      <BroadcastTextPopupOverlay
        popup={activeTextPopup}
        isBattleActive={!!stream?.is_battle && !!stream?.battle_id}
        mobileSafe={isMobileViewer}
      />

      {showSubscribeModal && hostId && broadcasterProfile && (
        <SubscriptionTierSelector
          broadcasterId={hostId}
          broadcasterUsername={getDisplayName(broadcasterProfile, 'Broadcaster')}
          onClose={() => setShowSubscribeModal(false)}
          onSelect={() => setShowSubscribeModal(false)}
        />
      )}

      {isPaidChatModalOpen && (
        <PaidChatViewerModal
          isOpen={isPaidChatModalOpen}
          onClose={() => setIsPaidChatModalOpen(false)}
          streamId={streamId}
          hostId={hostId}
          pricePerUser={paidChatPricePerUser}
          pricePerChat={paidChatPricePerChat}
          isChatEnabled={isPaidChatEnabled}
        />
      )}

    </ErrorBoundary>
  </GiftSystemProvider>
)
}

export default ViewerPage
