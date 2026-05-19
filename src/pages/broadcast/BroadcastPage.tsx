import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Link,
  useParams,
  useNavigate,
} from 'react-router-dom'
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, LocalParticipant, VideoPresets, AudioPresets, Track, createLocalTracks } from 'livekit-client'

import { isStaffUser } from '../../lib/userUtils'

import { supabase, UserProfile } from '../../lib/supabase'

import { useIsMobile } from '../../hooks/useIsMobile'

import { Stream } from '../../types/broadcast'
import StreamLayout from '../../components/broadcast/StreamLayout'
import BroadcastGrid from '../../components/broadcast/BroadcastGrid'
import BroadcastChat from '../../components/broadcast/BroadcastChat'
import BroadcastControls from '../../components/broadcast/BroadcastControls'
import BattleView from '../../components/broadcast/BattleView'
import BroadcastHeader from '../../components/broadcast/BroadcastHeader'
import { CapacityStatus } from '../../components/CapacityStatus'
import { useAuthStore } from '../../lib/store'
import { useStreamStore } from '../../lib/streamStore'
import AbilityBox from '@/components/broadcast/AbilityBox'
import BroadcastAbilityEffects from '@/components/broadcast/BroadcastAbilityEffects'
import BroadcasterStatsModal from '@/components/broadcast/BroadcasterStatsModal'
import CoinStoreModal from '@/components/broadcast/CoinStoreModal'
import DraggableWrapper from '@/components/broadcast/DraggableWrapper'
import GamePicker from '@/components/broadcast/GamePicker'
import GiftAnimationOverlay from '@/components/broadcast/GiftAnimationOverlay'
import GiftBoxModal, { GiftTarget } from '@/components/broadcast/GiftBoxModal'
import PinProductModal from '@/components/broadcast/PinProductModal'

import ShareModal from '@/components/broadcast/ShareModal'
import TCPSMessageBubble from '@/components/broadcast/TCPSMessageBubble'
import TickerControlPanel from '@/components/broadcast/TickerControlPanel'
import TrollopolyController from '@/components/broadcast/TrollopolyController'
import TrollopolyLobby from '@/components/broadcast/TrollopolyLobby'
import TrollopolyViewerUI from '@/components/broadcast/TrollopolyViewerUI'
import TrollToeController from '@/components/broadcast/TrollToeController'
import TrollToeViewerUI from '@/components/broadcast/TrollToeViewerUI'
import TrollUsGameController from '@/components/broadcast/TrollUsGameController'
import UserActionModal from '@/components/broadcast/UserActionModal'
import UserStatsModal from '@/components/broadcast/UserStatsModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import TrollopolyCityBoard from '@/components/games/TrollopolyCityBoard'
import { GlassCrackEffect } from '@/components/GlassCrackEffect'
import { getCategoryConfig } from '@/config/broadcastCategories'
import { useBattleState } from '@/hooks/useBattleState'
import { useBroadcastAbilities } from '@/hooks/useBroadcastAbilities'
import { useBroadcastPinnedProducts } from '@/hooks/useBroadcastPinnedProducts'
import { BroadcastGift } from '@/hooks/useBroadcastRealtime'
import { useBroadcastTicker } from '@/hooks/useBroadcastTicker'
import { useRandomBattleQueueController } from '@/hooks/useRandomBattleQueueController'
import { useStreamRealtime } from '@/hooks/useStreamRealtime'

import { useTrollopoly } from '@/hooks/useTrollopoly'
import { useTrollToe } from '@/hooks/useTrollToe'
import { DEFAULT_BATTLE_THEME_ID, normalizeBattleTheme } from '@/lib/battleThemes'
import { emitEvent } from '@/lib/events'
import { useBroadcastEffects } from '@/contexts/BroadcastEffectsContext'
import { GameAction } from '@/lib/game/InternetGameTypes'
import { TrollopolyGameState, VehicleType, TROLLOPOLY_PROPERTIES } from '@/lib/game/types/TrollopolyTypes'
import { GiftItem } from '@/lib/giftConstants'
import { GiftSystemProvider } from '@/lib/hooks/useGiftSystem'
import { PreflightStore } from '@/lib/preflightStore'
import { useTickerStore } from '@/stores/tickerStore'
import { AnimatePresence } from 'framer-motion'
import { LogOut, Dice5, Shield, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { div } from 'three/src/nodes/math/OperatorNode.js'

// Debug counters for broadcast stability verification
const DEBUG_COUNTERS = {

  broadcastPageMountCount: 0,

  broadcastPageUnmountCount: 0,
  broadcastRouterRouteDecisionCount: 0,
  livekitRoomCreatedCount: 0,
  livekitRoomDisconnectedCount: 0,
  hostAudioTrackCreatedCount: 0,
  hostVideoTrackCreatedCount: 0,
  hostAudioVideoPublishedCount: 0,
  broadcastGridRenderCount: 0,
  participantTileRenderCount: new Map<string, number>(),
  supabaseChannelCreatedCount: 0,
  supabaseChannelRemovedCount: 0,
  supabaseChannelActiveCount: 0,
  supabaseChannelCreatedMap: new Map<string, number>(),
  supabaseChannelCleanupMap: new Map<string, number>(),
  useGiftSystemInitCount: 0,
  trackSubscribedCount: 0,
  trackUnsubscribedCount: 0,
};

// Global debug counter access
if (typeof window !== 'undefined') {
  ;(window as any).DEBUG_COUNTERS = DEBUG_COUNTERS;
}

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * This file stops broadcast egress and MUST call /api/broadcasts/stop-streaming.
 * DO NOT change the API endpoint without updating:
 *   - server/index.js (route mapping)
 *   - server/api/broadcasts.js (handler)
 *   - SetupPage.tsx (start endpoint)
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

/**
 * BroadcastPage
 *
 * Broadcaster publishes via LiveKit RTC.
 * Participants join through LiveKit as audience members.
 */
export function BroadcastPage() {
  const params = useParams()
  const streamId = params.id || params.streamId

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const { clearTracks, screenTrack, screenAudioTrack, cameraTrack } = useStreamStore()
  const { isMobileWidth, hasMounted } = useIsMobile()

  // Add render counter for debugging
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  if (renderCountRef.current % 10 === 1 && import.meta.env.DEV) {
    console.debug(`[BroadcastPage] Render #${renderCountRef.current} for streamId: ${streamId}`)
  }

  useEffect(() => {
    DEBUG_COUNTERS.broadcastPageMountCount++
    console.log(`[BroadcastPage] MOUNT COUNT: ${DEBUG_COUNTERS.broadcastPageMountCount} for streamId: ${streamId}`)

    return () => {
      DEBUG_COUNTERS.broadcastPageUnmountCount++
      console.log(`[BroadcastPage] UNMOUNT COUNT: ${DEBUG_COUNTERS.broadcastPageUnmountCount} for streamId: ${streamId}`)
    }
  }, [])

  // Determine if user is admin for video quality (1080p admin, 720p regular)
  const isStreamAdmin = !!(profile && (
    profile.role === 'admin' || profile.is_admin ||
    profile.role === 'superadmin' || profile.is_superadmin ||
    profile.role === 'owner'
  ))
  
   const isOfficer = isStaffProfile(profile)
   const isModerator = isStaffProfile(profile) // Treat all staff as moderators

   const videoPreset = isStreamAdmin ? VideoPresets.h1080 : VideoPresets.h720

   const [stream, setStream] = useState<Stream | null>(null)
   const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null);
   // Accumulate gift amounts received while broadcasterProfile is still loading (null);
   // applied once the profile arrives via @see applyPendingGiftsEffect
   const pendingBroadcasterGiftsRef = useRef(0);

  const applyPendingGiftsEffect = useCallback((
    loadedProfile: Record<string, any>,
  ): Record<string, any> | null => {
    const pending = pendingBroadcasterGiftsRef.current;
    if (pending > 0) {
      pendingBroadcasterGiftsRef.current = 0;
      const currentCoins = Number(loadedProfile?.troll_coins ?? 0);
      return { ...loadedProfile, troll_coins: currentCoins + pending };
    }
    return loadedProfile;
  }, []);

  // Apply any gifts that arrived while the profile was still loading
  useEffect(() => {
    if (broadcasterProfile && pendingBroadcasterGiftsRef.current > 0) {
      setBroadcasterProfile((prev: any) => ({
        ...prev,
        troll_coins: Number(prev.troll_coins ?? 0) + pendingBroadcasterGiftsRef.current,
      }));
      pendingBroadcasterGiftsRef.current = 0;
    }
  }, [broadcasterProfile]);

  const isHost = stream?.user_id === user?.id
  const isBroadcaster = isHost;

  const roomName = useMemo(() => {
    if (stream?.agora_channel) return stream.agora_channel;
    if (stream?.room_name) return stream.room_name;
    return streamId || ''; 
  }, [stream?.agora_channel, stream?.room_name, streamId]);

  const hasValidStreamId = !!streamId && typeof streamId === 'string' && streamId.trim() !== '';
  const sessionReady = !!user && !!profile && hasValidStreamId && !!roomName;

  // INSTANT JOIN: Set isLoading to false initially to show content immediately
  // Stream data will load in background while user sees the page
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // INSTANT JOIN: Track if initial stream fetch is complete but don't block UI
  const [streamLoaded, setStreamLoaded] = useState(false)
  const [isCurrentUserBroadofficer, setIsCurrentUserBroadofficer] = useState(false)
  // Track battle start time to show accurate timer
  const [battleStartTime, setBattleStartTime] = useState<Date | null>(null)
  
  const audioTrackRef = useRef<LocalAudioTrack | null>(null)
  const videoTrackRef = useRef<LocalVideoTrack | null>(null)
  const [localTracksVersion, setLocalTracksVersion] = useState(0)
  const localTracksRef = useRef<[LocalAudioTrack | null, LocalVideoTrack | null] | null>(null)
  const localTracks = useMemo<[LocalAudioTrack | null, LocalVideoTrack | null] | null>(() => {
    const audioTrack = audioTrackRef.current
    const videoTrack = videoTrackRef.current
    return audioTrack || videoTrack ? [audioTrack, videoTrack] : null
  }, [localTracksVersion])
  // Host users publish through this local track state.
  const combinedLocalTracks = localTracks
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
  const mountCountRef = useRef(0)
  const livekitRoomCreatedCountRef = useRef(0)
  const livekitRoomDisconnectedCountRef = useRef(0)
  const localTrackCreatedCountRef = useRef(0)
  const localTrackPublishedCountRef = useRef(0)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user')
  // Track if user is going live (starting stream) vs exiting page
  const isGoingLiveRef = useRef(false)

  useEffect(() => {
    mountCountRef.current += 1
    console.debug('[BroadcastPage] mount count', mountCountRef.current, 'render count', renderCountRef.current, 'streamId', streamId)
    console.debug('[BroadcastPage] LiveKit debug counts', {
      livekitRoomCreated: livekitRoomCreatedCountRef.current,
      livekitRoomDisconnected: livekitRoomDisconnectedCountRef.current,
      localTrackCreated: localTrackCreatedCountRef.current,
      localTrackPublished: localTrackPublishedCountRef.current,
    })
    return () => {
      console.debug('[BroadcastPage] BroadcastPage unmounted for streamId', streamId)
    }
  }, [streamId])

  const getLiveKitUrl = () => {
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL
    if (!livekitUrl) {
      console.error('[BroadcastPage] Missing LiveKit URL - check VITE_LIVEKIT_URL')
      toast.error('LiveKit server URL is not configured')
    }
    return livekitUrl
  }

  const connectRoom = async (room: Room, token: string) => {
    const livekitUrl = getLiveKitUrl()
    if (!livekitUrl) {
      throw new Error('LiveKit URL not configured')
    }
    console.log('[BroadcastPage] Connecting to LiveKit URL:', livekitUrl)
    await room.connect(livekitUrl, token)
  }

  // Broadcast Effects Engine
  const { triggerGiftEffect, boostCityHeat } = useBroadcastEffects()

  useEffect(() => {
    localTracksRef.current = localTracks
  }, [localTracks])

  useEffect(() => {
    if (sessionStorage.getItem('tc_starting_stream') === 'true') {
      console.log('[BroadcastPage] Clearing starting stream marker');
      sessionStorage.removeItem('tc_starting_stream');
    }
  }, [])

  // Guard cleanup on unmount - don't clear tracks when going live
  useEffect(() => {
    return () => {
      if (!isGoingLiveRef.current) {
        console.log('[BroadcastPage] ✅ Real unmount, clearing tracks');
        clearTracks();
      } else {
        console.log('[BroadcastPage] ⏭️ Skipping clearTracks on unmount during live transition');
      }
    };
  }, [clearTracks]);

  // Check if user is jailed before allowing broadcast
  useEffect(() => {
    if (!user?.id) return;

    const checkJailStatus = async () => {
      try {
        const { data } = await supabase
          .from('jail')
          .select('id, release_time')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const releaseTime = new Date(data.release_time);
          if (releaseTime > new Date()) {
            console.log('[BroadcastPage] User is jailed - redirecting to /jail');
            toast.error('🚔 You are in jail and cannot broadcast');
            navigate('/jail', { replace: true });
            return;
          }
        }
      } catch (error) {
        console.error('[BroadcastPage] Error checking jail status:', error);
      }
    };

    checkJailStatus();
  }, [user?.id, navigate]);

  const publishTrackOrClone = async <T extends LocalAudioTrack | LocalVideoTrack>(
    track: T | undefined,
    room: Room,
    kind: 'audio' | 'video'
  ): Promise<T | undefined> => {
    if (!track) return undefined

    const tryPublish = async (candidate: T): Promise<T | undefined> => {
      try {
        await room.localParticipant.publishTrack(candidate)
        localTrackPublishedCountRef.current += 1
        return candidate
      } catch (err) {
        console.warn(
          `[BroadcastPage] Failed to publish ${kind} track`,
          err,
          { trackId: candidate.getTrackId?.(), kind }
        )
        return undefined
      }
    }

    const published = await tryPublish(track)
    if (published) return published

    // If direct publication fails, attempt to recreate the LiveKit track from the native MediaStreamTrack
    try {
      const mediaTrack = track.mediaStreamTrack()
      if (!mediaTrack) {
        console.warn('[BroadcastPage] No native media track available for clone publish', { kind })
        return undefined
      }

      console.log('[BroadcastPage] Cloning preflight track from native MediaStreamTrack', {
        kind,
        label: mediaTrack.label,
        enabled: mediaTrack.enabled
      })

      const clonedTrack = kind === 'video'
        ? (new LocalVideoTrack(mediaTrack) as T)
        : (new LocalAudioTrack(mediaTrack) as T)

      localTrackCreatedCountRef.current += 1
      return await tryPublish(clonedTrack)
    } catch (err) {
      console.warn('[BroadcastPage] Failed to clone and publish preflight track', err)
      return undefined
    }
  }

  // Cleanup handler for page unload - ensures camera is turned off immediately when user closes browser
  useEffect(() => {
    const handleBeforeUnload = () => {
      const room = roomRef.current
      
      // Only disconnect if we're actually ending the stream/unloading
      // Don't stop tracks here as that could interfere with normal operation
      if (room && !isGoingLiveRef.current) {
        try {
          DEBUG_COUNTERS.livekitRoomDisconnectedCount++
          console.log(`[BroadcastPage] LiveKit room disconnected: ${DEBUG_COUNTERS.livekitRoomDisconnectedCount}`)
          livekitRoomDisconnectedCountRef.current += 1
          room.disconnect().catch(() => {})
        } catch (e) {
          // Ignore
        }
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Check if screen share mode from sessionStorage (set by SetupPage for gaming category)
  const { storedScreenMode: initialScreenMode, storedCameraOverlay: initialCameraOverlay } = useMemo(() => {
    const storedScreenMode = sessionStorage.getItem('tc_broadcast_screen_mode') === 'true'
    const storedCameraOverlay = sessionStorage.getItem('tc_camera_overlay_enabled') === 'true'
    console.log('[BroadcastPage] Initial screen state:', { storedScreenMode, storedCameraOverlay })
    return { storedScreenMode, storedCameraOverlay }
  }, []) // Empty deps - only run once
  const [isScreenSharing, setIsScreenSharing] = useState(initialScreenMode)
  const [cameraOverlayEnabled, setCameraOverlayEnabled] = useState(initialCameraOverlay)
  const [cameraOverlayTrackState, setCameraOverlayTrackState] = useState<LocalVideoTrack | null>(null)
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
  const remoteUsers = useMemo(() => Array.from(remoteParticipants.values()), [remoteParticipants])
  // Helper to safely get array from RemoteParticipants Map
  const getRemoteParticipantsArray = () => {
    if (!remoteParticipants || typeof remoteParticipants.values !== 'function') return []
    return Array.from(remoteParticipants.values()) as RemoteParticipant[]
  }
  const [isJoining, setIsJoining] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [canSwipe, setCanSwipe] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [activeViewerProfiles, setActiveViewerProfiles] = useState<Array<{
    user_id: string;
    username: string;
    avatar_url: string | null;
    role?: string;
    troll_role?: string;
    is_admin?: boolean;
    is_troll_officer?: boolean;
    is_lead_officer?: boolean;
    created_at: string;
    joined_at: string;
  }>>([])
  const [hostMicMutedByOfficer, setHostMicMutedByOfficer] = useState(false)
  const [isBattleMode, setIsBattleMode] = useState(stream?.broadcast_mode === 'battle')
  const [selectedBattleTheme, setSelectedBattleTheme] = useState<string>(DEFAULT_BATTLE_THEME_ID);
  
  // Auto-end stream if no viewers and no messages for 10 minutes
  const [hasReceivedChatMessage, setHasReceivedChatMessage] = useState(false)
  const streamStartTimeRef = useRef<Date | null>(null)
  const autoEndCheckedRef = useRef(false)
  
  const hasJoinedRef = useRef(false)
  const roomRef = useRef<Room | null>(null)
  const liveKitConnectionKeyRef = useRef<string | null>(null)
  const anonymousViewerIdRef = useRef(`anon-viewer-${Math.random().toString(36).slice(2, 10)}`)
  const viewerCountUpdateRef = useRef(0)
  const stageTouchStartYRef = useRef<number | null>(null)
  const stageTouchCurrentYRef = useRef<number | null>(null)
  
  // Debug: Log when remoteParticipants changes
  useEffect(() => {
    console.log('[BroadcastPage] remoteParticipants changed:', {
      count: remoteParticipants.size,
      participants: Array.from(remoteParticipants.keys())
    })
  }, [remoteParticipants])
  
   const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
   const [isShareModalOpen, setIsShareModalOpen] = useState(false)
   const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
   const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
   const [giftNameMap, setGiftNameMap] = useState<Record<string, string>>({})
   const [giftUserPositions, setGiftUserPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({})
    const getGiftUserPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}))
    const giftNameMapRef = useRef<Record<string, string>>({})

    // Modal state lifted from BroadcastGrid
    const [userActionTarget, setUserActionTarget] = useState<{
      userId: string;
      username?: string;
      role?: string;
      createdAt?: string;
    } | null>(null)
    const [showHostStats, setShowHostStats] = useState(false)
    const [showUserStats, setShowUserStats] = useState<{
      userId: string;
      username: string;
      trollCoins: number;
      trollmonds: number;
      licensePlate: string | null;
      isSeatUser: boolean;
    } | null>(null)
    // const playGiftAnimation = useAnimationStore((state) => state.playGiftAnimation)

  // Broadcast Abilities
  const {
    abilities: userAbilities,
    activeEffects: abilityActiveEffects,
    loading: abilityLoading,
    useAbility: activateAbility,
    isEffectActive,
    getCooldownRemaining,
    getEffectRemaining,
  } = useBroadcastAbilities(streamId)
  const [isAbilityBoxOpen, setIsAbilityBoxOpen] = useState(false)

  const handleGetUserPositions = useCallback((getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => {
    getGiftUserPositionsRef.current = getPositions;
  }, []);

  useEffect(() => {
    giftNameMapRef.current = giftNameMap;
  }, [giftNameMap]);

  const processedGiftIdsRef = useRef<Set<string>>(new Set())

  // Acquire camera overlay stream when enabled for gaming mode
  useEffect(() => {
    let overlayStream: MediaStream | null = null;
    let overlayTrack: LocalVideoTrack | null = null;

    const setupCameraOverlay = async () => {
      if (cameraOverlayEnabled && isScreenSharing) {
        try {
          console.log('[BroadcastPage] Setting up camera overlay for gaming screen share');

          const preflightVideoTrack = PreflightStore.getLivekitTracks()?.[1];
          if (preflightVideoTrack) {
            const mediaTrack = preflightVideoTrack.mediaStreamTrack?.();
            const isLiveTrack = mediaTrack && mediaTrack.readyState === 'live';

            console.log('[BroadcastPage] Preflight camera overlay candidate:', {
              hasTrack: !!preflightVideoTrack,
              readyState: mediaTrack?.readyState,
              enabled: mediaTrack?.enabled,
              muted: mediaTrack?.muted,
            });

            if (isLiveTrack) {
              console.log('[BroadcastPage] Reusing live preflight camera track for overlay');
              setCameraOverlayTrackState(preflightVideoTrack);
              return;
            }

            console.log('[BroadcastPage] Preflight camera track is not live; falling back to fresh camera capture');
          }

          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera/microphone access is not available in this browser or context.');
          }
          overlayStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            },
            audio: false,
          });

          overlayTrack = new LocalVideoTrack(overlayStream.getVideoTracks()[0], {
            name: 'camera-overlay'
          });
          setCameraOverlayTrackState(overlayTrack);
          console.log('[BroadcastPage] Camera overlay track created successfully');
        } catch (err) {
          console.error('[BroadcastPage] Failed to acquire camera overlay:', err);
          toast.error('Failed to access camera for overlay');
          setCameraOverlayEnabled(false);
        }
      }
    };

    const cleanupCameraOverlay = () => {
      if (overlayTrack) {
        overlayTrack.stop();
        overlayTrack = null;
      }
      setCameraOverlayTrackState(null);
    };

    if (cameraOverlayEnabled && isScreenSharing) {
      setupCameraOverlay();
    } else {
      cleanupCameraOverlay();
    }

    return () => {
      // Cleanup on unmount or dependency change
      if (overlayStream) {
        overlayStream.getTracks().forEach(t => t.stop());
      }
      if (overlayTrack) {
        overlayTrack.stop();
      }
    };
   
  }, [cameraOverlayEnabled, isScreenSharing]);

  const resolveGiftAmount = useCallback((giftData: any): number => {
    const metadata = giftData?.metadata || {};
    const quantity = Math.max(1, Number(giftData?.quantity ?? metadata.quantity ?? 1) || 1);

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
    ];

    for (const candidate of directAmountCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
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
    ];

    for (const candidate of unitAmountCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value * quantity;
    }

    return quantity;
  }, []);

  const resolveGiftName = useCallback((giftData: any): string => {
    const metadata = giftData?.metadata || {};
    return (
      giftData?.gift_name ||
      giftData?.name ||
      giftData?.title ||
      metadata.gift_name ||
      metadata.name ||
      metadata.title ||
      'Gift'
    );
  }, []);

  const processGiftEvent = useCallback((giftData: any) => {
    if (!giftData) {
      if (import.meta.env.DEV) console.log('[BroadcastPage] ⚠️ processGiftEvent: giftData is null/undefined');
      return;
    }

    const giftId = giftData.id || `gift-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (processedGiftIdsRef.current.has(giftId)) {
      if (import.meta.env.DEV) console.log('[BroadcastPage] Duplicate gift event skipped', giftId);
      return;
    }
    processedGiftIdsRef.current.add(giftId);
    window.setTimeout(() => processedGiftIdsRef.current.delete(giftId), 12_000);

    const incomingStreamId = giftData.streamId || giftData.stream_id || giftData.metadata?.streamId || giftData.metadata?.stream_id;
    const receiverId = giftData.receiver_id || giftData.recipient_id || giftData.receiverId || giftData.recipientId || giftData.metadata?.receiver_id || giftData.metadata?.recipient_id;
    console.log('[BroadcastPage] ✅ Processing gift', { giftId, incomingStreamId, currentStreamId: streamId, receiverId });
    
    if (incomingStreamId && incomingStreamId !== streamId) {
      console.log('[BroadcastPage] ⚠️ Stream ID mismatch, skipping gift:', { incomingStreamId, currentStreamId: streamId });
      return;
    }

    const resolvedGiftAmount = resolveGiftAmount(giftData);
    const resolvedGiftName = resolveGiftName(giftData);

    const newGift: BroadcastGift = {
      id: giftId,
      gift_id: giftData.gift_id,
      gift_name: resolvedGiftName,
      gift_icon: giftData.gift_icon || giftData.metadata?.gift_icon || '🎁',
      gift_slug: giftData.gift_slug || giftData.metadata?.gift_slug,
      animation_key: giftData.animation_key || giftData.metadata?.animation_key,
      animation_type: giftData.animation_type || giftData.metadata?.animation_type,
      animation_url: giftData.animation_url || giftData.metadata?.animation_url,
      animation_duration_ms: giftData.animation_duration_ms || giftData.metadata?.animation_duration_ms,
      sound_url: giftData.sound_url || giftData.metadata?.sound_url,
      is_fullscreen: giftData.is_fullscreen ?? giftData.metadata?.is_fullscreen,
      rarity: giftData.rarity || giftData.metadata?.rarity,
      tray_visual_url: giftData.tray_visual_url || giftData.metadata?.tray_visual_url,
      tray_gradient: giftData.tray_gradient || giftData.metadata?.tray_gradient,
      amount: resolvedGiftAmount || giftData.quantity || 1,
      quantity: giftData.quantity || 1,
      sender_id: giftData.sender_id,
      sender_name: giftData.sender_name || 'Someone',
      receiver_id: receiverId,
      receiver_name: giftData.receiver_name || giftData.metadata?.receiver_name,
      created_at: giftData.timestamp || giftData.created_at || new Date().toISOString(),
    };

    // Show gift banner for ALL gifts to broadcaster
    setRecentGifts((prev) => {
      if (prev.some((g) => g.id === giftId)) {
        console.log('[BroadcastPage] 📌 Gift already in queue (dedupe), skipping:', giftId);
        return prev;
      }
      const updated = [...prev, newGift].slice(-20);
      console.log('[BroadcastPage] ✅ Added gift to queue, now:', updated.length, 'gifts');
      return updated;
    });

    // Auto-remove gift from recentGifts after 2 seconds to ensure banner disappears
    setTimeout(() => {
      setRecentGifts(prev => prev.filter(g => g.id !== giftId));
    }, 2000);

    const missingIds = [giftData.sender_id, receiverId].filter(
      (id): id is string => !!id && !giftNameMapRef.current[id]
    );

    if (missingIds.length > 0) {
      supabase
        .from('user_profiles')
        .select('id, username, display_name, email')
        .in('id', Array.from(new Set(missingIds)))
        .then(({ data }) => {
          if (!data || data.length === 0) return;

          const resolved = Object.fromEntries(
            data
              .filter((row: any) => row?.id)
              .map((row: any) => [
                row.id,
                row.username || row.display_name || row.email?.split('@')?.[0] || 'Troll Citizen'
              ])
          );

          if (Object.keys(resolved).length === 0) return;

          setGiftNameMap((prev) => ({ ...prev, ...resolved }));
          setRecentGifts((prev) =>
            prev.map((gift) =>
              gift.id === giftId
                ? {
                    ...gift,
                    sender_name: gift.sender_name === 'Someone' ? (resolved[gift.sender_id] || gift.sender_name) : gift.sender_name,
                    receiver_name: !gift.receiver_name ? resolved[gift.receiver_id] : gift.receiver_name,
                  }
                : gift
            )
          );
        })
        .catch((err) => {
          console.warn('[BroadcastPage] Failed to resolve gift usernames:', err);
        });
    }

    // Start animation via centralized store; all participants should see this.
    try {
      // Temporarily comment out to debug hook error
      // const broadcastGiftType: GiftType = (giftData.gift_name || '').toLowerCase().includes('rose') ? 'rose' :
      //   (giftData.gift_name || '').toLowerCase().includes('heart') ? 'heart' :
      //   (giftData.gift_name || '').toLowerCase().includes('diamond') ? 'diamond' :
      //   (giftData.gift_name || '').toLowerCase().includes('crown') ? 'crown' :
      //   (giftData.gift_name || '').toLowerCase().includes('car') ? 'car' :
      //   (giftData.gift_name || '').toLowerCase().includes('house') ? 'house' :
      //   (giftData.gift_name || '').toLowerCase().includes('rocket') ? 'rocket' :
      //   (giftData.gift_name || '').toLowerCase().includes('dragon') ? 'dragon' :
      //   (giftData.gift_name || '').toLowerCase().includes('star') ? 'star' :
      //   (giftData.gift_name || '').toLowerCase().includes('trophy') ? 'trophy' :
      //   (giftData.gift_name || '').toLowerCase().includes('coffee') ? 'coffee' :
      //   (giftData.gift_name || '').toLowerCase().includes('pizza') ? 'pizza' : 'heart';

      // playGiftAnimation({
      //   type: broadcastGiftType,
      //   senderName: giftData.sender_name || 'Someone',
      //   senderAvatar: undefined,
      //   receiverName: giftData.receiver_name || 'Broadcast',
      //   amount: giftData.quantity || 1,
      // });
    } catch (err) {
      console.error('[BroadcastPage] playGiftAnimation failed:', err);
    }

     // Update broadcaster profile optimistically
    if (receiverId === streamRef.current?.user_id && resolvedGiftAmount > 0) {
      const giftAmount = Math.floor(resolvedGiftAmount);
      
      setBroadcasterProfile((prev: any) => {
        if (!prev) {
          pendingBroadcasterGiftsRef.current += giftAmount;
          return prev;
        }
        return { ...prev, troll_coins: Number(prev.troll_coins || 0) + giftAmount };
      });

      // Also update the stream's total_gifts_coins
      setStream((prev) => prev ? {
        ...prev,
        total_gifts_coins: (prev.total_gifts_coins || 0) + giftAmount,
      } : prev);
    }

    const levelGiftAmount = resolvedGiftAmount;

    if (levelGiftAmount > 0 && receiverId === streamRef.current?.user_id) {
      window.dispatchEvent(new CustomEvent('broadcast-gift-level', {
        detail: {
          giftId,
          broadcasterId: streamRef.current?.user_id,
          receiverId,
          streamId,
          amount: levelGiftAmount,
          timestamp: Date.now(),
        }
      }));
    }

    // Dispatch balance update event for UserStatsModal and auth store
    // Use consistent snake_case field names
    window.dispatchEvent(new CustomEvent('broadcast-balance-update', {
      detail: {
        senderId: giftData.sender_id,
        receiverId: receiverId,
        amount: resolvedGiftAmount,
        timestamp: Date.now(),
      }
    }));
  }, [streamId, resolveGiftAmount, resolveGiftName, supabase]);

  const stopLocalTracks = useCallback(() => {
    if (localTracks) {
      localTracks.forEach((track) => {
        if (track) {
          try {
            track.stop()
          } catch (e) {
            console.warn('Error stopping track:', e)
          }
        }
      })
      setLocalTracks(null)
    }

    const room = roomRef.current
    if (room) {
      room.disconnect().catch(console.error)
    }

    // Only clear tracks if we're actually exiting, not going live
    if (!isGoingLiveRef.current) {
      console.log('[BroadcastPage] ✅ Real exit in stopLocalTracks, clearing tracks')
      clearTracks()
    } else {
      console.log('[BroadcastPage] ⏭️ Skipping clearTracks in stopLocalTracks during live transition')
    }
  }, [localTracks, clearTracks])

  const stopLocalTracksRef = useRef(stopLocalTracks)
  useEffect(() => {
    stopLocalTracksRef.current = stopLocalTracks
  }, [stopLocalTracks])

  const refreshStream = useCallback(async () => {
    if (!streamId) return
    const { data, error } = await supabase
      .from('streams')
      .select('*, total_likes')
      .eq('id', streamId)
      .maybeSingle()
    
    if (error) {
      console.error('Refresh error:', error)
      return
    }
    
    setStream(data)
  }, [streamId, supabase])
 
  const [isPinProductModalOpen, setIsPinProductModalOpen] = useState(false)

// Auto-end stream if broadcaster has been live for 10 minutes with no viewers and no chat messages
useEffect(() => {
  if (!stream || !isHost || stream.status !== 'live' || stream.is_live !== true) return
  if (autoEndCheckedRef.current) return // Only check once per stream

  // Set stream start time on first check
  if (!streamStartTimeRef.current) {
    streamStartTimeRef.current = stream.started_at ? new Date(stream.started_at) : new Date()
    console.log('[BroadcastPage] Stream started at:', streamStartTimeRef.current)
  }

  const checkInterval = setInterval(() => {
    if (!streamStartTimeRef.current) return

    const now = new Date()
    const streamDurationMs = now.getTime() - streamStartTimeRef.current.getTime()
    const streamDurationMinutes = streamDurationMs / 1000 / 60

    // Check if stream has been live for 10+ minutes, no viewers, and no messages
    if (streamDurationMinutes >= 10 && viewerCount === 0 && !hasReceivedChatMessage) {
      console.log('[BroadcastPage] Auto-ending stream - 10 minutes with no viewers/messages')
      autoEndCheckedRef.current = true
      clearInterval(checkInterval)
      
      // Show warning toast
      toast.warning('Go make some friends before going back live!')
      
      // End the stream after a short delay to ensure toast is visible
      // We'll call the stream end API directly instead of using handleStreamEnd to avoid dependency issues
      setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('broadcasts')
            .update({
              status: 'ended',
              is_live: false,
              ended_at: new Date().toISOString()
            })
            .eq('id', stream.id)

          if (error) {
            console.error('[BroadcastPage] Error ending stream:', error)
          }
        } catch (err) {
          console.error('[BroadcastPage] Failed to auto-end stream:', err)
        }
      }, 500)
    }
  }, 30000) // Check every 30 seconds

  return () => clearInterval(checkInterval)
}, [stream, isHost, viewerCount, hasReceivedChatMessage])

  // Broadcast Global Ticker
  const {
    sendMessage: tickerSendMessage,
    sendPriority: tickerSendPriority,
    clearPriority: tickerClearPriority,
    deleteMessage: tickerDeleteMessage,
    broadcastSettings: tickerBroadcastSettings,
    generateSystemMessage: tickerGenerateSystemMessage,
  } = useBroadcastTicker({
    streamId: streamId || '',
    userId: user?.id || '',
    isHost,
    enabled: !!streamId && !!user,
  })
  const [isTickerPanelOpen, setIsTickerPanelOpen] = useState(false)
  const tickerSettings = useTickerStore((s) => s.settings)

  // Troll Toe (Live Tic-Tac-Toe) game
  const trollToe = useTrollToe({
    streamId: streamId || '',
    isHost,
    enabled: !!streamId && !!(user || anonymousViewerIdRef.current),
  })

  // Trollopoly game
  const trollopoly = useTrollopoly({
    streamId: streamId || '',
    isHost,
    enabled: !!streamId && !!(user || anonymousViewerIdRef.current),
  })

  // Game picker state
  const [gamePickerOpen, setGamePickerOpen] = useState(false)
  const [trollUsGameOpen, setTrollUsGameOpen] = useState(false)
  const [activeGame, setActiveGame] = useState<'troll_toe' | 'troll_us' | 'trollopoly' | null>(null)
  const [isTrollopolyDiceRolling, setIsTrollopolyDiceRolling] = useState(false)
  const [isTrollopolyControllerOpen, setIsTrollopolyControllerOpen] = useState(false)
  const [isTrollopolyViewerPanelDismissed, setIsTrollopolyViewerPanelDismissed] = useState(false)
  
  // Quick Coin Store
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false)

  useEffect(() => {
    if (trollopoly.match && activeGame !== 'trollopoly') {
      setActiveGame('trollopoly');
    }
    if (!trollopoly.match && activeGame === 'trollopoly') {
      setActiveGame(null);
      setIsTrollopolyControllerOpen(false);
    }
  }, [trollopoly.match?.id, activeGame]);

  useEffect(() => {
    setIsTrollopolyViewerPanelDismissed(false);
  }, [trollopoly.match?.id, trollopoly.match?.status]);

  // getTrackForUser - maps userId to LiveKit video/audio tracks for Troll Toe board
  const getTrackForUser = useCallback((userId: string) => {
    const isLocal = userId === user?.id;
    if (isLocal) {
      return {
        videoTrack: localTracks?.[1] || undefined,
        audioTrack: localTracks?.[0] || undefined,
        isLocal: true,
        hasVideo: !!localTracks?.[1],
        hasAudio: !!localTracks?.[0],
      };
    }
    // Find remote participant by identity
    const participant = getRemoteParticipantsArray().find(
      (p) => p.identity === userId || p.identity.substring(0, 8) === userId.replace(/-/g, '').substring(0, 8)
    );
    if (!participant) {
      return { videoTrack: undefined, audioTrack: undefined, isLocal: false, hasVideo: false, hasAudio: false };
    }
    const videoPubs = Array.from((participant.videoTrackPublications as any)?.values() || []);
    const audioPubs = Array.from((participant.audioTrackPublications as any)?.values() || []);
    const videoPub = videoPubs.find((p: any) => p.track && p.isSubscribed) || videoPubs.find((p: any) => p.track);
    const audioPub = audioPubs.find((p: any) => p.track && p.isSubscribed) || audioPubs.find((p: any) => p.track);
    return {
      videoTrack: videoPub?.track,
      audioTrack: audioPub?.track,
      isLocal: false,
      hasVideo: !!videoPub?.track,
      hasAudio: !!audioPub?.track,
    };
  }, [user?.id, localTracks, remoteParticipants])

  // Get video tracks for all participants for trollopoly
  const getVideoTracksForParticipants = useCallback(() => {
    const tracks: { [userId: string]: any } = {};

    // Add local user track
    if (user?.id && localTracks?.[1]) {
      tracks[user.id] = localTracks[1];
    }

    // Add remote participant tracks
    getRemoteParticipantsArray().forEach(participant => {
      const videoPubs = Array.from((participant.videoTrackPublications as any)?.values() || []);
      const videoPub = videoPubs.find((p: any) => p.track && p.isSubscribed) || videoPubs.find((p: any) => p.track);
      if (videoPub?.track) {
        tracks[participant.identity] = videoPub.track;
      }
    });

    return tracks;
  }, [user?.id, localTracks, remoteParticipants]);

  const trollopolyCityState = useMemo<TrollopolyGameState | null>(() => {
    const match = trollopoly.match;
    if (!match) return null;

    const die1 = match.lastDiceRoll ? Math.min(6, Math.max(1, match.lastDiceRoll - 1)) : 1;
    const die2 = match.lastDiceRoll ? Math.max(1, match.lastDiceRoll - die1) : 1;
    const ownedPropertiesByPlayer = new Map<string, number[]>();

    match.properties.forEach((property) => {
      if (!property.ownerId) return;
      const owned = ownedPropertiesByPlayer.get(property.ownerId) || [];
      owned.push(property.id);
      ownedPropertiesByPlayer.set(property.ownerId, owned);
    });

    const vehicleTypes: VehicleType[] = ['sports_car', 'limousine', 'taxi', 'police_car', 'hover_car'];
    const currentPlayer = match.players[match.currentTurnIndex];
    const currentLanding = currentPlayer ? match.properties.find((property) => property.id === currentPlayer.position) : null;

    return {
      matchId: match.id,
      gameType: 'trollopoly',
      status: match.status === 'finished' ? 'finished' : 'active',
      phase: match.status === 'finished'
        ? 'finished'
        : currentLanding && currentLanding.price > 0 && !currentLanding.ownerId
          ? 'property_action'
          : 'waiting_for_roll',
      players: match.players.map((player, index) => ({
        id: player.id,
        username: player.username,
        score: player.balance,
        isHost: player.id === stream?.user_id || index === 0,
        isConnected: player.isConnected,
        position: player.position % TROLLOPOLY_PROPERTIES.length,
        coins: player.balance,
        properties: ownedPropertiesByPlayer.get(player.id) || [],
        isInJail: false,
        jailTurns: 0,
        hasGetOutOfJailFree: false,
        isBankrupt: player.isBankrupt,
        vehicleType: vehicleTypes[index % vehicleTypes.length],
        vehicleColor: ['#ff4444', '#4444ff', '#44ff44', '#ffff44'][index % 4],
        cameraEnabled: true,
        microphoneEnabled: true,
        doublesCount: 0,
      })),
      properties: TROLLOPOLY_PROPERTIES.map((property) => {
        const legacyProperty = match.properties.find((item) => item.id === property.id);
        return {
          ...property,
          name: legacyProperty?.name ?? property.name,
          price: legacyProperty?.price ?? property.price,
          baseRent: legacyProperty?.rent ?? property.baseRent,
          ownerId: legacyProperty?.ownerId || undefined,
          houseCount: legacyProperty?.buildingLevel ?? 0,
          hasHotel: false,
          isMortgaged: false,
        };
      }),
      currentPlayerIndex: match.currentTurnIndex,
      timerRemaining: 0,
      winnerId: match.winnerId || undefined,
      dice: {
        die1,
        die2,
        isRolling: isTrollopolyDiceRolling,
        animationProgress: 0,
      },
      cards: {
        chance: [],
        community: [],
        chanceIndex: 0,
        communityIndex: 0,
      },
      spectators: [],
      spectatorCount: Math.max(0, remoteParticipants.size - match.players.length),
      streamId: streamId || '',
      chatChannelId: streamId || match.id,
      gameLog: [],
      freeParkingCoins: 0,
      gameBalance: match.gameBalance || 0,
      turnCount: 0,
      startTime: new Date(match.createdAt).getTime(),
    };
  }, [trollopoly.match, stream?.user_id, streamId, remoteParticipants.size, isTrollopolyDiceRolling]);

  const handleTrollopolyCityAction = useCallback(async (action: GameAction) => {
    if (action.type === 'roll_dice') {
      if (isTrollopolyDiceRolling) return;

      setIsTrollopolyDiceRolling(true);
      const rollPromise = trollopoly.rollDice().catch((err) => {
        console.error('[BroadcastPage] Trollopoly roll failed:', err);
        toast.error('Dice roll failed');
        return 0;
      });

      try {
        await new Promise(resolve => setTimeout(resolve, 3000));
      } finally {
        setIsTrollopolyDiceRolling(false);
      }
      void rollPromise;
      return;
    }

    if (action.type === 'buy_property') {
      const currentPlayer = trollopoly.match?.players[trollopoly.match.currentTurnIndex];
      if (currentPlayer) {
        trollopoly.buyProperty(currentPlayer.position);
      }
      return;
    }

    if (action.type === 'end_turn') {
      trollopoly.endTurn();
    }
  }, [isTrollopolyDiceRolling, trollopoly]);

  // Set broadcast mode to disable TrollEngine while this route is active.
  useEffect(() => {
    PreflightStore.setInBroadcast(true);
    if (import.meta.env.DEV) console.log('[BroadcastPage] Broadcast mode enabled - TrollEngine disabled');
    
    return () => {
      window.setTimeout(() => {
        if (!/^\/(broadcast|watch|live)(\/|$)/.test(window.location.pathname)) {
          PreflightStore.setInBroadcast(false);
          if (import.meta.env.DEV) console.log('[BroadcastPage] Broadcast mode disabled - TrollEngine enabled');
        }
      }, 0);
    };
  }, []);

  const { pinnedProducts, pinProduct } = useBroadcastPinnedProducts({
    streamId: streamId || '',
    userId: user?.id,
    isHost,
  })

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const streamRef = useRef(stream)
  const broadcasterProfileRef = useRef(broadcasterProfile)
  const profileRef = useRef(profile)

  useEffect(() => {
    streamRef.current = stream
  }, [stream])

  useEffect(() => {
    broadcasterProfileRef.current = broadcasterProfile
  }, [broadcasterProfile])

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

const canPublish = isHost

  const updateStreamPatch = useCallback((patch: Partial<Stream>) => {
    setStream((prev) => prev ? { ...prev, ...patch } : prev);
  }, []);

  const randomBattleQueue = useRandomBattleQueueController({
    stream,
    userId: user?.id,
    isBroadcaster: isHost,
    onStreamUpdate: updateStreamPatch,
  });

  const trollopolyPlayerMedia = useMemo(() => {
    const media: Record<string, { videoTrack?: any; audioTrack?: any; isLocal?: boolean }> = {};
    const localIdentity = user?.id || anonymousViewerIdRef.current;

    if (localIdentity && combinedLocalTracks) {
      media[localIdentity] = {
        audioTrack: combinedLocalTracks[0] || undefined,
        videoTrack: combinedLocalTracks[1] || undefined,
        isLocal: true,
      };
    }

    if (isHost && stream?.user_id && localTracks) {
      media[stream.user_id] = {
        audioTrack: localTracks[0] || undefined,
        videoTrack: localTracks[1] || undefined, // Use original localTracks for host
        isLocal: true, // Host is always local
      };
    }

    const assignParticipantMedia = (userId: string | undefined, participant: RemoteParticipant) => {
      if (!userId) return;
      const videoPubs = Array.from((participant.videoTrackPublications as any)?.values() || []);
      const audioPubs = Array.from((participant.audioTrackPublications as any)?.values() || []);
      const videoPub = videoPubs.find((p: any) => p.track && p.isSubscribed) || videoPubs.find((p: any) => p.track);
      const audioPub = audioPubs.find((p: any) => p.track && p.isSubscribed) || audioPubs.find((p: any) => p.track);

      media[userId] = {
        videoTrack: videoPub?.track,
        audioTrack: audioPub?.track,
        isLocal: false,
      };
    };

    getRemoteParticipantsArray().forEach((participant) => {
      assignParticipantMedia(participant.identity, participant);
    });

    return media;
  }, [user?.id, combinedLocalTracks, localTracks, isHost, stream?.user_id, remoteParticipants]);

// Battle State
   const { 
    battleState: rawBattleState,
    pickSide,
    supporters,
    userTeam,
    joinWindowOpen,
    remainingTime,
    shouldShowSidePicker,
    sendBattleGift,
  } = useBattleState({
    streamId: streamId || '',
    localUserId: user?.id || anonymousViewerIdRef.current || '',
    isHost,
    hostId: stream?.user_id,
  })

  // Transform battleState to match BroadcastGrid's expected interface
  const battleState = useMemo(() => ({
    active: rawBattleState.active,
    battleId: rawBattleState.battleId,
    hostId: rawBattleState.teamACaptain,
    challengerId: rawBattleState.teamBCaptain,
    broadcasterScore: rawBattleState.teamAScore,
    challengerScore: rawBattleState.teamBScore,
    startedAt: rawBattleState.startedAt,
    endsAt: rawBattleState.endsAt,
    suddenDeath: rawBattleState.suddenDeath,
  }), [rawBattleState])


   const cleanupLocalMedia = () => {
    const room = roomRef.current

    if (cameraOverlayTrackState) {
      try {
        cameraOverlayTrackState.stop()
      } catch (e) {
        console.warn('[BroadcastPage] Error stopping camera overlay track:', e)
      }
      setCameraOverlayTrackState(null)
    }

    if (combinedLocalTracks) { // Use combined tracks for cleanup
      combinedLocalTracks.forEach((track) => {
        if (track) {
          try {
            track.stop()
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping local track:', e)
          }
        }
      })
      setLocalTracks(null) // Clear original localTracks
    }

    if (room?.localParticipant) {
      for (const pub of room.localParticipant.videoTrackPublications.values()) {
        if (pub.track) {
          try {
            pub.track.stop()
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping published video track:', e)
          }
        }
      }
      for (const pub of room.localParticipant.audioTrackPublications.values()) {
        if (pub.track) {
          try {
            pub.track.stop()
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping published audio track:', e)
          }
        }
      }
    }

    if (screenTrack) {
      try {
        screenTrack.stop()
      } catch (e) {
        console.warn('[BroadcastPage] Error stopping screen share track:', e)
      }
    }

    if (cameraTrack) {
      try {
        cameraTrack.stop()
      } catch (e) {
        console.warn('[BroadcastPage] Error stopping stored camera track:', e)
      }
    }

    // Only clear tracks if we're actually exiting, not going live
    if (!isGoingLiveRef.current) {
      console.log('[BroadcastPage] ✅ Real exit, clearing tracks')
      clearTracks()
    } else {
      console.log('[BroadcastPage] ⏭️ Skipping clearTracks during live transition')
   }
  };

   // Handle leaving seat with instant track cleanup
   const handleLeaveSeat = useCallback(async () => {
     const room = roomRef.current
     
     // Instantly stop publishing tracks before clearing seat
     if (room && room.localParticipant) {
       try {
         // Unpublish all tracks instantly - this removes them from other participants immediately
         for (const pub of room.localParticipant.videoTrackPublications.values()) {
           if (pub.track) {
             room.localParticipant.unpublishTrack(pub.track).catch(console.warn)
           }
         }
         for (const pub of room.localParticipant.audioTrackPublications.values()) {
           if (pub.track) {
             room.localParticipant.unpublishTrack(pub.track).catch(console.warn)
           }
         }
         console.log('[BroadcastPage] Unpublished all tracks for leaving seat')
       } catch (e) {
         console.warn('Error unpublishing tracks on leave:', e)
       }
     }
     
     // Stop local and published media immediately
     cleanupLocalMedia()

     console.log('[BroadcastPage] Left seat with instant track cleanup')
   }, [localTracks, user?.id]) 

   // Handle leaving the broadcast (for host ending stream or viewer leaving)
  const handleLeave = useCallback(async () => {
    const confirmed = confirm(isHost ? 'End this broadcast?' : 'Leave this broadcast?')
    if (!confirmed) return

    const room = roomRef.current
    
    // Stop publishing tracks
    if (room && room.localParticipant) {
      try {
        for (const pub of room.localParticipant.videoTrackPublications.values()) {
          if (pub.track) {
            room.localParticipant.unpublishTrack(pub.track).catch(console.warn)
          }
        }
        for (const pub of room.localParticipant.audioTrackPublications.values()) {
          if (pub.track) {
            room.localParticipant.unpublishTrack(pub.track).catch(console.warn)
          }
        }
        console.log('[BroadcastPage] Unpublished all tracks on leave')
      } catch (e) {
        console.warn('Error unpublishing tracks on leave:', e)
      }
    }
    
    // Stop local and published media
    cleanupLocalMedia()

    // Disconnect from room
    if (room) {
      room.disconnect().catch(console.error)
    }
    
    // Clear PreflightStore
    PreflightStore.clear()
    
    // Navigate away
    navigate('/')
  }, [isHost, localTracks, navigate])
  const handleToggleChat = useCallback(() => setIsChatOpen((prev) => !prev), [])
  const handleOpenShareModal = useCallback(() => setIsShareModalOpen(true), [])
  const handlePinProduct = useCallback(() => setIsPinProductModalOpen(true), [])

  const fetchHostStreamFallback = async () => {
    if (!user?.id) return null

    try {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('streams')
        .select('*, total_likes, is_battle, battle_id, battle_mode, battle_format, battle_status, battle_start_time, battle_end_time, side_a_score, side_b_score')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fallbackError || !fallbackData) {
        console.warn('[BroadcastPage] Host fallback stream not found', { userId: user.id, fallbackError })
        return null
      }

      return fallbackData
    } catch (fallbackError) {
      console.error('[BroadcastPage] Host fallback stream fetch failed:', fallbackError)
      return null
    }
  }

  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setStreamLoaded(true)
      return
    }

    const fetchStream = async () => {
      // INSTANT JOIN: Set streamLoaded to false temporarily to show loading in header only
      setStreamLoaded(false)
      
      // OPTIMIZED: Fetch stream and profile in PARALLEL for faster loading
      const [streamResult, profileResult] = await Promise.all([
        supabase
          .from('streams')
          .select('*, total_likes, is_battle, battle_id, battle_mode, battle_format, battle_status, battle_start_time, battle_end_time, side_a_score, side_b_score')
          .eq('id', streamId)
          .maybeSingle(),
        // We'll get profile after we know the stream's user_id
        Promise.resolve(null)
      ])

      const { data, error } = streamResult

      if (error || !data) {
        console.warn('[BroadcastPage] Stream fetch by ID failed, trying host fallback', { error, streamId, userId: user?.id })
        const fallbackStream = await fetchHostStreamFallback()

        if (fallbackStream) {
          console.log('[BroadcastPage] Using fallback stream (host stream):', {
            id: fallbackStream.id,
            title: fallbackStream.title,
            livekit_room_name: fallbackStream.livekit_room_name,
            egress_id: fallbackStream.egress_id,
          });
          setStream(fallbackStream)
          setStreamLoaded(true)

          if (fallbackStream.id !== streamId) {
            navigate(`/broadcast/${fallbackStream.id}`, { replace: true })
          }
          return
        }

        setError('Stream not found.')
        toast.error('Stream not found.')
        setStreamLoaded(true)
        return
      }

      // DEBUG: Log stream fields from DB
      console.log('[BroadcastPage] Stream data loaded from Supabase:', {
        id: data.id,
        title: data.title,
        status: data.status,
        is_live: data.is_live,
        livekit_room_name: data.livekit_room_name,
        egress_id: data.egress_id,
        started_at: data.started_at,
      });



      setStream(data)
      
      // Set battle start time if battle is already active
      if (data.is_battle && data.battle_id) {
        setBattleStartTime(data.battle_start_time ? new Date(data.battle_start_time) : new Date())
      }
      
      // Fetch profile in parallel with other operations
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user_id)
        .maybeSingle()
      
      if (profileData) {
        setBroadcasterProfile(profileData)
        if (data.user_id === user?.id) {
          setHostMicMutedByOfficer(!!profileData.broadcast_mic_muted)
        }
      }

      setStreamLoaded(true)

      if (data.status === 'ended') {
        stopLocalTracks()
        navigate(`/broadcast/summary/${streamId}`)
      }

      // INSTANT JOIN: Don't set isLoading - let page render immediately
      // Only use isLoading for critical errors, not for data fetching
    }

    fetchStream()
  }, [streamId, navigate, user?.id]);

  // Check if current user is broadofficer
  useEffect(() => {
    if (!stream?.user_id || !user?.id) return;
    if (isHost) {
        setIsCurrentUserBroadofficer(true);
        return;
    }
    supabase.rpc('is_broadofficer', {
        p_broadcaster_id: stream.user_id,
        p_user_id: user.id
    }).then(({ data }) => {
        setIsCurrentUserBroadofficer(!!data);
    });
  }, [stream?.user_id, user?.id, isHost]);

  // Handle tab visibility changes - reconnect LiveKit room if needed
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && roomRef.current) {
        const room = roomRef.current
        // Check if room is disconnected and needs reconnection
        if ((room as any).state !== 'connected') {
          console.log('[BroadcastPage] Tab became visible - attempting to reconnect LiveKit room')
          // Re-fetch stream data and reconnect
          const streamIdParam = streamId
          if (streamIdParam) {
            supabase
              .from('streams')
              .select('*, total_likes, is_battle, battle_id, battle_mode, battle_format, battle_status, battle_start_time, battle_end_time, side_a_score, side_b_score')
              .eq('id', streamIdParam)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setStream(data)
                  setStreamLoaded(true)
                }
              })
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [streamId])

  // Emit stream_watch_time events for troll system
  useEffect(() => {
    if (!streamId || !user?.id) return;

    // Emit initial watch event
    emitEvent('stream_watch_time', user.id, { streamId, watchTime: 0 });

    // Track watch time and emit events periodically
    let watchTime = 0;
    const watchInterval = setInterval(() => {
      watchTime += 30; // Increment by 30 seconds
      emitEvent('stream_watch_time', user.id, { streamId, watchTime });
    }, 30000); // Every 30 seconds

    return () => clearInterval(watchInterval);
  }, [streamId, user?.id]);

  // Combined host profile changes. Timed mic moderation is enforced by stream_mutes below.
  useEffect(() => {
    if (!isHost || !stream?.user_id) return;

    const hostChannel = supabase
      .channel(`host-updates:${stream.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${stream.user_id}`
        },
        async (payload: any) => {
          setHostMicMutedByOfficer(!!payload?.new?.broadcast_mic_muted);

          // Also update broadcaster profile without full reload
          setBroadcasterProfile((prev: any) => prev ? { ...prev, ...payload.new } : payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hostChannel);
    };
  }, [isHost, stream?.user_id]);

  useEffect(() => {
    if (!streamId || !stream) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('streams')
        .select('status, box_count, is_battle, battle_id, has_rgb_effect, are_seats_locked, total_likes, seat_price, current_viewers, total_gifts_coins, battle_mode, battle_format, battle_status, battle_start_time, battle_end_time, random_battle_queue_enabled, random_battle_queued_at, random_battle_cooldown_until, side_a_score, side_b_score')
          .eq('id', streamId)
          .maybeSingle()

        if (error || !data) {
          console.warn('[BroadcastPage] Poll stream fetch failed', { error, streamId })
          return
        }

        // Handle battle mode transitions
        if (stream.is_battle === true && data.is_battle === false) {
          // Battle ended - fully sync battle flags so controls don't stay in stale active state
          setStream((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data.status,
              is_battle: data.is_battle,
              battle_id: data.battle_id,
              battle_mode: data.battle_mode,
              battle_format: data.battle_format,
              battle_status: data.battle_status,
              battle_start_time: data.battle_start_time,
              battle_end_time: data.battle_end_time,
              random_battle_queue_enabled: (data as any).random_battle_queue_enabled,
              random_battle_queued_at: (data as any).random_battle_queued_at,
              random_battle_cooldown_until: (data as any).random_battle_cooldown_until,
              side_a_score: data.side_a_score,
              side_b_score: data.side_b_score,
            };
          });
          return;
        }
        
        if (data?.box_count !== undefined && data.box_count !== streamRef.current?.box_count) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, box_count: data.box_count };
          });
        }
        
        if (data?.has_rgb_effect !== undefined && data.has_rgb_effect !== streamRef.current?.has_rgb_effect) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, has_rgb_effect: data.has_rgb_effect };
          });
        }
        
        if (data?.are_seats_locked !== undefined && data.are_seats_locked !== streamRef.current?.are_seats_locked) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, are_seats_locked: data.are_seats_locked };
          });
        }
        
        if (data?.total_likes !== undefined && data.total_likes !== streamRef.current?.total_likes) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_likes: data.total_likes };
          });
        }
        
        if (data?.seat_price !== undefined && data.seat_price !== streamRef.current?.seat_price) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, seat_price: data.seat_price };
          });
        }
        
        if (data?.current_viewers !== undefined && data.current_viewers !== streamRef.current?.current_viewers) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, current_viewers: data.current_viewers };
          });
        }
        
        if (data?.total_gifts_coins !== undefined && data.total_gifts_coins !== streamRef.current?.total_gifts_coins) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_gifts_coins: data.total_gifts_coins };
          });
        }

        if (data) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
                battle_mode: data.battle_mode,
                battle_format: data.battle_format,
                battle_status: data.battle_status,
                random_battle_queue_enabled: (data as any).random_battle_queue_enabled,
                random_battle_queued_at: (data as any).random_battle_queued_at,
                random_battle_cooldown_until: (data as any).random_battle_cooldown_until,
                side_a_score: data.side_a_score,
                side_b_score: data.side_b_score,
            };
          });
        }
        
        // Handle stream ended - redirect ALL users (host, guests, viewers) to summary
        if (data?.status === 'ended') {
          console.log('[BroadcastPage] Poll detected stream ended, redirecting to summary');
          clearInterval(pollInterval);
          stopLocalTracks();
          navigate(`/broadcast/summary/${streamId}`);
          return;
        }
      } catch (err) {
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [streamId, isHost, supabase, navigate, stopLocalTracks]);

  const areStreamRealtimeUpdatesEqual = useCallback((current: any, next: any) => {
    if (!current || !next) return false;
    const trackedKeys = [
      'box_count',
      'has_rgb_effect',
      'are_seats_locked',
      'total_likes',
      'seat_price',
      'current_viewers',
      'total_gifts_coins',
      'is_battle',
      'battle_id',
      'battle_mode',
      'battle_format',
      'battle_status',
      'battle_start_time',
      'battle_end_time',
      'battle_end_reason',
      'battle_winner_id',
      'random_battle_queue_enabled',
      'random_battle_queued_at',
      'random_battle_cooldown_until',
      'status',
      'is_live',
    ];
    return trackedKeys.every((key) => current[key] === next[key]);
  }, []);

  const handleStreamRealtimeUpdate = useCallback((nextStream: any) => {
    if (!nextStream) return;

    if (streamRef.current && areStreamRealtimeUpdatesEqual(streamRef.current, nextStream)) {
      return;
    }

    const wasInBattleMode = streamRef.current?.is_battle;
    const isNowInBattleMode = nextStream.is_battle;
    const battleIdChanged = streamRef.current?.battle_id !== nextStream.battle_id;

    setStream((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        box_count: nextStream.box_count,
        has_rgb_effect: nextStream.has_rgb_effect,
        are_seats_locked: nextStream.are_seats_locked,
        total_likes: nextStream.total_likes,
        seat_price: nextStream.seat_price,
        status: nextStream.status,
        is_live: nextStream.is_live,
        current_viewers: nextStream.current_viewers,
        total_gifts_coins: nextStream.total_gifts_coins,
        is_battle: nextStream.is_battle,
        battle_id: nextStream.battle_id,
        battle_mode: nextStream.battle_mode,
        battle_format: nextStream.battle_format,
        battle_status: nextStream.battle_status,
        battle_start_time: nextStream.battle_start_time,
        battle_end_time: nextStream.battle_end_time,
        random_battle_queue_enabled: nextStream.random_battle_queue_enabled,
        random_battle_queued_at: nextStream.random_battle_queued_at,
        random_battle_cooldown_until: nextStream.random_battle_cooldown_until,
        battle_end_reason: nextStream.battle_end_reason,
        battle_winner_id: nextStream.battle_winner_id,
        battle_forfeited_by: nextStream.battle_forfeited_by,
        side_a_score: nextStream.side_a_score,
        side_b_score: nextStream.side_b_score,
      };
    });

    if (((!wasInBattleMode && isNowInBattleMode) || (battleIdChanged && isNowInBattleMode))) {
      if (import.meta.env.DEV) console.debug('[BroadcastPage] Battle mode activated via stream realtime', {
        is_battle: nextStream.is_battle,
        battle_id: nextStream.battle_id
      });
      setBattleStartTime(nextStream.battle_start_time ? new Date(nextStream.battle_start_time) : new Date());
    }

    if (nextStream.status === 'ended') {
      stopLocalTracksRef.current();
      setTimeout(() => {
        navigate(`/broadcast/summary/${streamId}`);
      }, 100);
    }
  }, [navigate, streamId]);

  useStreamRealtime(streamId, {
    onStream: (event) => {
      // During live battle, only update critical properties to prevent remounts
      if (stream?.is_battle && stream?.battle_status === 'active') {
        const nextStream = event.new;
        // Only update battle-related properties during active battle
        if (nextStream.battle_status !== stream.battle_status ||
            nextStream.battle_end_time !== stream.battle_end_time) {
          setStream((prev: any) => prev ? { ...prev, 
            battle_status: nextStream.battle_status,
            battle_end_time: nextStream.battle_end_time
          } : prev);
        }
        return;
      }
      // Normal stream updates for non-battle state
      handleStreamRealtimeUpdate(event.new);
    },
    onGift: (event) => {
      processGiftEvent(event.new);
    },
  }, stream?.battle_id);

  useEffect(() => {
    console.log('[BroadcastPage] gift effect deps changed', {
      streamId,
      isHost,
      hasProfile: !!broadcasterProfile,
      remoteParticipantsCount: remoteParticipants.size,
      localTracksLength: localTracks?.length || 0,
    });

    if (!streamId) return;

    const presenceKey = user?.id || anonymousViewerIdRef.current;
    const channel = supabase.channel(`stream:${streamId}`, {
      config: { presence: { key: presenceKey } },
    });

    const mergeActiveViewerRows = async (viewerMap: Map<string, any>, broadcasterId?: string) => {
      if (!streamId) return viewerMap;

      try {
        const since = new Date(Date.now() - 90_000).toISOString();
        const { data } = await supabase
          .from('stream_viewers')
          .select('user_id, last_seen, joined_at, user:user_profiles(username, display_name, email, avatar_url, role, troll_role, is_admin, created_at)')
          .eq('stream_id', streamId)
          .gte('last_seen', since)
          .limit(75);

        (data || []).forEach((row: any) => {
          const id = String(row.user_id || '');
          if (!id || id === broadcasterId || viewerMap.has(id)) return;
          const userProfile = Array.isArray(row.user) ? row.user[0] : row.user;
          viewerMap.set(id, {
            user_id: id,
            username: userProfile?.username || userProfile?.display_name || userProfile?.email?.split('@')?.[0] || 'Troll Citizen',
            avatar_url: userProfile?.avatar_url || null,
            role: userProfile?.role,
            troll_role: userProfile?.troll_role,
            is_admin: !!userProfile?.is_admin,
            is_troll_officer: !!userProfile?.is_troll_officer,
            is_lead_officer: !!userProfile?.is_lead_officer,
            created_at: userProfile?.created_at || '',
            joined_at: row.joined_at || row.last_seen || new Date().toISOString(),
          });
        });
      } catch (err) {
        console.warn('[BroadcastPage] Failed to merge active viewer rows:', err);
      }

      return viewerMap;
    };

    const updateViewerCountFromPresence = async () => {
      const state = channel.presenceState();
      const broadcasterId = streamRef.current?.user_id;
      const viewerIds = new Set<string>();
      const viewerMap = new Map<string, any>();

      Object.values(state).forEach((presences) => {
        (presences as any[]).forEach((presence) => {
          const id = String(presence?.user_id || presenceKey);
          if (!id || id === broadcasterId) return;
          viewerIds.add(id);
          viewerMap.set(id, {
            user_id: id,
            username: presence?.username || presence?.display_name || presence?.email?.split('@')?.[0] || 'Troll Citizen',
            avatar_url: presence?.avatar_url || null,
            role: presence?.role,
            troll_role: presence?.troll_role,
            is_admin: !!presence?.is_admin,
            is_troll_officer: !!presence?.is_troll_officer,
            is_lead_officer: !!presence?.is_lead_officer,
            created_at: presence?.created_at || '',
            joined_at: presence?.online_at || new Date().toISOString(),
          });
        });
      });

      await mergeActiveViewerRows(viewerMap, broadcasterId);
      viewerMap.forEach((_viewer, id) => viewerIds.add(id));

      const totalUsers = viewerIds.size;
      setViewerCount(totalUsers);
      setActiveViewerProfiles(Array.from(viewerMap.values()));
      window.dispatchEvent(new CustomEvent('broadcast-active-viewers', {
        detail: { streamId, viewers: Array.from(viewerMap.values()) },
      }));

      const now = Date.now();
      if (now - viewerCountUpdateRef.current > 5000) {
        viewerCountUpdateRef.current = now;
        supabase
          .rpc('update_stream_viewer_count', { p_stream_id: streamId, p_count: totalUsers })
          .then(({ error }) => {
            if (error) console.warn('[BroadcastPage] Failed to update viewer count:', error);
          });
      }
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        void updateViewerCountFromPresence();
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        void updateViewerCountFromPresence();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        void updateViewerCountFromPresence();
      });

    channel
      .on(
        'broadcast',
        { event: 'box_count_changed' },
        (payload) => {
          try {
            const boxData = payload.payload;
            if (boxData && boxData.box_count !== undefined) {
              setStream((prev: any) => {
                if (!prev) return prev;
                return { ...prev, box_count: boxData.box_count };
              });
            }
          } catch (err) {
            console.error('Error processing box_count_changed:', err);
          }
        }
      )
      // Gift events are handled by the dedicated stream-gifts channel below
      .on(
        'broadcast',
        { event: 'like_sent' },
        (payload) => {
          try {
            const likeData = payload.payload;
            // Ignore likes from self (sender already updated optimistically)
            if (likeData.user_id === user?.id) {
              return;
            }
            setStream((prev: any) => {
              if (!prev) return prev;
              const newTotal = likeData.total_likes !== undefined
                ? likeData.total_likes
                : (prev.total_likes || 0) + 10;
              return { ...prev, total_likes: newTotal };
            });
          } catch (err) {
            console.error('Error processing like:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
          
          supabase
            .from('user_profiles')
            .select('active_entrance_effect')
            .eq('id', user?.id)
            .maybeSingle()
            .then(({ data: effectData }) => {
          const currentProfile = profileRef.current;
           channel.track({
                user_id: user?.id || 'viewer',
                username: currentProfile?.username || (currentProfile as any)?.display_name || user?.email?.split('@')?.[0] || 'Troll Citizen',
                display_name: (currentProfile as any)?.display_name,
                email: user?.email,
                is_host: isHost,
                online_at: new Date().toISOString(),
                avatar_url: currentProfile?.avatar_url || '',
                role: currentProfile?.role,
                troll_role: currentProfile?.troll_role,
                is_admin: !!currentProfile?.is_admin,
                is_troll_officer: !!(currentProfile as any)?.is_troll_officer,
                is_lead_officer: !!(currentProfile as any)?.is_lead_officer,
                created_at: currentProfile?.created_at || '',
                entrance_effect: effectData?.active_entrance_effect || null
              }).catch(console.error);
            });
        }
      });

    const heartbeatInterval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ping',
          payload: { timestamp: Date.now(), user_id: user?.id }
        }).catch(() => {});
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
    };
  }, [streamId, navigate, user?.id, isHost]);

  // Stable gift channel subscription - depends only on streamId
  useEffect(() => {
    if (!streamId) return;

    const giftChannel = supabase.channel(`stream-gifts:${streamId}`, {
      config: { presence: { key: null } },
    });

    giftChannel
      .on('broadcast', { event: 'gift_sent' }, (payload) => {
        if (import.meta.env.DEV) {
          console.log('[BroadcastPage] 🎁 Received gift_sent broadcast event:', payload.payload);
        }
        processGiftEvent(payload.payload);
      })
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log('[BroadcastPage] Gift channel status:', status, { streamId });
        }
      });

    return () => {
      supabase.removeChannel(giftChannel);
    };
  }, [streamId]);

  useEffect(() => {
    if (recentGifts.length > 0) {
      console.log('[BroadcastPage] recentGifts state:', recentGifts.map((g) => ({ id: g.id, gift_name: g.gift_name, sender_id: g.sender_id, receiver_id: g.receiver_id })));
    }
  }, [recentGifts]);

  // Listen for broadcast-balance-update events to update both broadcaster profile and auth store
  useEffect(() => {
    const handleBroadcastBalanceUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const senderId = detail.sender_id || detail.senderId;
      const receiverId = detail.receiver_id || detail.receiverId;
      const amount = Number(detail.amount || detail.coins || detail.value || 0);

      if (!amount || !senderId || !receiverId) return;

      console.log('[BroadcastPage] Balance update received:', { senderId, receiverId, amount });

      const broadcasterId = streamRef.current?.user_id;
      const currentUserId = user?.id;

      // Update broadcaster profile if the receiver is the broadcaster
      if (receiverId === broadcasterId && broadcasterId) {
        setBroadcasterProfile((prev: any) => {
          if (!prev) return prev;
          return { ...prev, troll_coins: Number(prev.troll_coins ?? 0) + amount };
        });
      }

      // Update auth store profile for sender if it's the current user
      if (senderId === currentUserId && currentUserId) {
        const currentProfile = useAuthStore.getState().profile;
        if (currentProfile) {
          useAuthStore.getState().setProfile({
            ...currentProfile,
            troll_coins: Number(currentProfile.troll_coins || 0) - amount
          });
        }
      }

      // Update auth store profile for receiver if it's the current user
      if (receiverId === currentUserId && currentUserId) {
        const currentProfile = useAuthStore.getState().profile;
        if (currentProfile) {
          useAuthStore.getState().setProfile({
            ...currentProfile,
            troll_coins: Number(currentProfile.troll_coins || 0) + amount
          });
        }
      }
    };

    window.addEventListener('broadcast-balance-update', handleBroadcastBalanceUpdate as EventListener);
    return () => {
      window.removeEventListener('broadcast-balance-update', handleBroadcastBalanceUpdate as EventListener);
    };
  }, [user?.id]);

  const handleLiveKitParticipantConnected = useCallback((participant: RemoteParticipant) => {
    console.log('[BroadcastPage] Participant connected:', participant.identity)
    setRemoteParticipants(prev => new Map(prev).set(participant.identity, participant))
  }, [])

  const handleLiveKitParticipantDisconnected = useCallback((participant: RemoteParticipant) => {
    const identity = participant.identity
    console.log('[BroadcastPage] Participant disconnected:', identity)
    setRemoteParticipants(prev => {
      const next = new Map(prev)
      next.delete(identity)
      return next
    })
  }, [])

  const handleLiveKitTrackSubscribed = useCallback((track: any, _publication: any, participant: RemoteParticipant) => {
    console.log('[BroadcastPage] Track subscribed:', track.kind, 'from', participant.identity)
    DEBUG_COUNTERS.trackSubscribedCount++
    setRemoteParticipants(prev => {
      const next = new Map(prev)
      next.set(participant.identity, participant)
      return next
    })
  }, [])

  const handleLiveKitTrackUnsubscribed = useCallback((track: any, _publication: any, participant: RemoteParticipant) => {
    console.log('[BroadcastPage] Track unsubscribed:', track.kind, 'from', participant.identity)
    DEBUG_COUNTERS.trackUnsubscribedCount++
    const remainingVideo = Array.from((participant.videoTrackPublications as any)?.values?.() || []).some((p: any) => p.track)
    const remainingAudio = Array.from((participant.audioTrackPublications as any)?.values?.() || []).some((p: any) => p.track)

    if (!remainingVideo && !remainingAudio) {
      setRemoteParticipants(prev => {
        const next = new Map(prev)
        next.delete(participant.identity)
        return next
      })
    }
  }, [])

  const attachLiveKitHandlers = useCallback((room: Room) => {
    room.off(RoomEvent.ParticipantConnected, handleLiveKitParticipantConnected)
    room.off(RoomEvent.ParticipantDisconnected, handleLiveKitParticipantDisconnected)
    room.off(RoomEvent.TrackSubscribed, handleLiveKitTrackSubscribed)
    room.off(RoomEvent.TrackUnsubscribed, handleLiveKitTrackUnsubscribed)

    room.on(RoomEvent.ParticipantConnected, handleLiveKitParticipantConnected)
    room.on(RoomEvent.ParticipantDisconnected, handleLiveKitParticipantDisconnected)
    room.on(RoomEvent.TrackSubscribed, handleLiveKitTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, handleLiveKitTrackUnsubscribed)
  }, [
    handleLiveKitParticipantConnected,
    handleLiveKitParticipantDisconnected,
    handleLiveKitTrackSubscribed,
    handleLiveKitTrackUnsubscribed,
  ])

  const detachLiveKitHandlers = useCallback((room: Room) => {
    room.off(RoomEvent.ParticipantConnected, handleLiveKitParticipantConnected)
    room.off(RoomEvent.ParticipantDisconnected, handleLiveKitParticipantDisconnected)
    room.off(RoomEvent.TrackSubscribed, handleLiveKitTrackSubscribed)
    room.off(RoomEvent.TrackUnsubscribed, handleLiveKitTrackUnsubscribed)
  }, [
    handleLiveKitParticipantConnected,
    handleLiveKitParticipantDisconnected,
    handleLiveKitTrackSubscribed,
    handleLiveKitTrackUnsubscribed,
  ])

  useEffect(() => {
    // Allow anonymous viewers to watch without authentication.
    // Only publishers still require a real user or guest seat identity.
    const hasUserIdentity = !isHost || !!user?.id;
    
    if (!stream || !stream.id || !hasUserIdentity) {
      return;
    }

    // Only connect to LiveKit if the stream is actually live
    // This prevents RTC session minutes from accumulating when there's no broadcast
    const isBroadcastActive = (s: any) => {
      if (!s) return false
      if (s.is_live === true) return true
      const status = String(s.status || '').toLowerCase()
      return status === 'starting' || status === 'live'
    }

    const isBroadcastActiveResult = isBroadcastActive(stream)

    // Host/broadcaster must keep their LiveKit room through non-ended stream state transitions.
    // We only suppress LiveKit for ended/failed broadcasts where is_live is explicitly false.
    const isHostEndedOrFailed =
      isHost && (stream?.is_live === false) &&
      (String(stream?.status || '').toLowerCase() === 'ended' || String(stream?.status || '').toLowerCase() === 'failed')

    console.log('[BroadcastStatusGuard] active check result', {
      streamId,
      isHost,
      streamStatus: stream?.status,
      streamIsLive: stream?.is_live,
      isBroadcastActive: isBroadcastActiveResult,
      isHostEndedOrFailed,
    })

    if (!isBroadcastActiveResult && !isHostEndedOrFailed) {
      console.log('[BroadcastStatusGuard] ignored non-ended transitional status for active stream')
    }

    if (!isBroadcastActiveResult && isHostEndedOrFailed) {
      console.log('[BroadcastPage] Stream is not live, skipping LiveKit connection')
      return
    }

     const shouldPublish = isHost
    
    // Determine the user identity for LiveKit
    // Use user.id for logged-in users, or anonymous viewer for guests
    const userIdentity = user?.id || anonymousViewerIdRef.current;
    const connectionRole = shouldPublish ? 'publisher' : 'audience';
    const connectionKey = `${stream.id}:${userIdentity}:${connectionRole}`;

    if (hasJoinedRef.current && liveKitConnectionKeyRef.current === connectionKey) {
      return;
    }

    if (hasJoinedRef.current && liveKitConnectionKeyRef.current !== connectionKey) {
      const existingRoom = roomRef.current;
      if (existingRoom) {
        detachLiveKitHandlers(existingRoom);
        livekitRoomDisconnectedCountRef.current += 1
        DEBUG_COUNTERS.livekitRoomDisconnectedCount++
        console.log(`[BroadcastPage] LiveKit room disconnected due to connection key change: ${DEBUG_COUNTERS.livekitRoomDisconnectedCount}`)
        existingRoom.disconnect().catch(console.error);
      }
      setRemoteParticipants(new Map());
      hasJoinedRef.current = false;
      liveKitConnectionKeyRef.current = null;
    }
    
    let mounted = true

    const initLiveKit = async () => {
      if (!shouldPublish) {
        // OPTIMIZED: Don't block UI - connect in background without isJoining state
        try {
          const viewerIdentity = `viewer-${userIdentity.substring(0, 12)}`
          // OPTIMIZED: Use parallel fetch for faster token get
          console.log('[BroadcastPage] 📡 Fetching LiveKit token from Supabase Edge Function...', {
            streamId: stream.id,
            viewerIdentity,
            role: 'audience',
            room: stream.livekit_room_name || stream.id,
          });
          
          const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: {
              room: stream.id,
              identity: viewerIdentity, // Use viewerIdentity for audience
              name: profile?.username || user?.email || 'Guest Viewer',
              role: 'audience',
              isHost: false
            }
          })

          if (error) {
            console.error('[BroadcastPage] ❌ LiveKit token fetch error:', error);
            throw error
          }

          if (!data?.token) {
            console.error('[BroadcastPage] ❌ LiveKit token response missing token:', data);
            throw new Error('LiveKit token response missing token')
          }

          console.log('[BroadcastPage] ✅ LiveKit token received:', {
            hasToken: !!data?.token,
            tokenLength: data?.token?.length || 0,
            room: data?.room,
            identity: data?.identity,
          });

          const room = new Room()
          livekitRoomCreatedCountRef.current += 1
          DEBUG_COUNTERS.livekitRoomCreatedCount++
          console.log(`[BroadcastPage] LiveKit room created: ${DEBUG_COUNTERS.livekitRoomCreatedCount}`)
          roomRef.current = room

          attachLiveKitHandlers(room)

          await connectRoom(room, data.token)

          // Get existing participants who were already in the room (LiveKit v2.x uses remoteParticipants)
          const existingParticipants = room.remoteParticipants
            ? Array.from(room.remoteParticipants?.values?.() || []) as RemoteParticipant[]
            : []
          if (existingParticipants.length > 0) {
            console.log('[BroadcastPage] Viewer: Found existing participants:', existingParticipants.length, existingParticipants.map((p: RemoteParticipant) => p.identity))
            // Build a new Map with all existing participants
            const newParticipantsMap = new Map<string, RemoteParticipant>()
            existingParticipants.forEach((participant: RemoteParticipant) => {
              newParticipantsMap.set(participant.identity, participant)
              console.log('[BroadcastPage] Viewer: Adding existing participant:', participant.identity)
            })
            // Set the Map in one go to avoid batching issues
            setRemoteParticipants(newParticipantsMap)
          } else {
            console.log('[BroadcastPage] Viewer: No existing participants in room')
          }

          hasJoinedRef.current = true
          liveKitConnectionKeyRef.current = connectionKey
        } catch (err) {
          console.error('Viewer join error:', err)
        }
        // OPTIMIZED: Removed isJoining state update - no blocking UI
        return
      }

      // OPTIMIZED: Don't block UI - connect in background
      try {
        const hostIdentity = userIdentity
        // OPTIMIZED: Fetch token without waiting for UI
        console.log('[BroadcastPage] 📡 Fetching LiveKit token for publisher from Supabase Edge Function...', {
          streamId: stream.id,
          hostIdentity,
          room: stream.livekit_room_name || stream.id,
          egress_id: stream.egress_id,
        });

        const { data, error } = await supabase.functions.invoke('livekit-token', {
          body: {
            room: stream.id,
            identity: hostIdentity, // Use hostIdentity for publisher
            name: profile?.username || user?.email || 'Guest',
            role: 'publisher',
            isHost
          }
        })

        if (error) {
          console.error('[BroadcastPage] ❌ LiveKit token fetch error:', error);
          throw error
        }

        if (!data?.token) {
          console.error('[BroadcastPage] ❌ LiveKit token response missing token:', data);
          throw new Error('LiveKit token response missing token')
        }

        console.log('[BroadcastPage] ✅ LiveKit token received for publisher:', {
          hasToken: !!data?.token,
          tokenLength: data?.token?.length || 0,
          room: data?.room,
          identity: data?.identity,
        });

        // Mark that we're going live so cleanup doesn't clear tracks prematurely
        isGoingLiveRef.current = true

        // Check for preflight room and tracks FIRST
        const existingRoom = PreflightStore.getLivekitRoom()
        const preflightTracks = PreflightStore.getTracks()
        const isScreenShareExisting = PreflightStore.getScreenShareMode()
        const screenTrackExisting = PreflightStore.getScreenTrack() || screenTrack
        
        console.log('[BroadcastPage] 🔍 PreflightStore state:', {
          hasExistingRoom: !!existingRoom,
          hasPreflightTracks: !!(preflightTracks?.videoTrack || preflightTracks?.audioTrack),
          isScreenShareExisting,
          hasScreenTrack: !!screenTrackExisting,
        })

        let roomToUse: Room
        let activeAudioTrack: LocalAudioTrack | null = null
        let activeVideoTrack: LocalVideoTrack | null = null

        if (existingRoom) {
          // ✅ Use existing room from SetupPage - DO NOT create new room
          console.log('[BroadcastPage] 🔥 Using EXISTING LiveKit room from SetupPage')
          roomToUse = existingRoom
          roomRef.current = existingRoom
          attachLiveKitHandlers(existingRoom)
        } else {
          // Create new room if no existing room
          console.log('[BroadcastPage] 🔧 Creating NEW LiveKit room')
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
              ...videoPreset,
              facingMode: 'user'
            },
            audioCaptureDefaults: {
              ...AudioPresets.audio,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          })
          livekitRoomCreatedCountRef.current += 1
          DEBUG_COUNTERS.livekitRoomCreatedCount++
          console.log(`[BroadcastPage] LiveKit room created: ${DEBUG_COUNTERS.livekitRoomCreatedCount}`)
          roomToUse = room
          roomRef.current = room
          attachLiveKitHandlers(room)
        }

        const existingMicPublication =
          roomToUse.localParticipant.getTrackPublication(Track.Source.Microphone) ||
          Array.from(roomToUse.localParticipant.audioTrackPublications.values()).find((pub: any) =>
            pub?.track?.kind === 'audio'
          )

        const existingCameraPublication =
          roomToUse.localParticipant.getTrackPublication(Track.Source.Camera) ||
          Array.from(roomToUse.localParticipant.videoTrackPublications.values()).find((pub: any) =>
            pub?.source === Track.Source.Camera ||
            pub?.track?.source === Track.Source.Camera ||
            pub?.track?.kind === 'video'
          )

        if (preflightTracks?.videoTrack || preflightTracks?.audioTrack) {
          // ✅ Use preflight tracks from SetupPage
          console.log('[BroadcastPage] ✅ Using preflight tracks from SetupPage')
          activeAudioTrack = (existingMicPublication?.track as LocalAudioTrack | null) || preflightTracks.audioTrack
          activeVideoTrack = (existingCameraPublication?.track as LocalVideoTrack | null) || preflightTracks.videoTrack
        } else {
          // Create new tracks only if no preflight tracks
          console.log('[BroadcastPage] ⚠️ No preflight tracks - creating new tracks')
          const shouldCreateAudio = !existingMicPublication
          const shouldCreateVideo = !existingCameraPublication
          const tracks = await createLocalTracks({
            audio: shouldCreateAudio,
            video: shouldCreateVideo
              ? {
                  resolution: isScreenShareExisting ? VideoPresets.h720.resolution : videoPreset.resolution,
                }
              : false,
          })

          if (tracks.length > 0) {
            localTrackCreatedCountRef.current += tracks.length
            tracks.forEach((track) => {
              if (track.kind === 'video') {
                DEBUG_COUNTERS.hostVideoTrackCreatedCount++
              } else if (track.kind === 'audio') {
                DEBUG_COUNTERS.hostAudioTrackCreatedCount++
              }
            })
          }

          activeAudioTrack = (existingMicPublication?.track as LocalAudioTrack | null) || (tracks.find((t) => t.kind === 'audio') as LocalAudioTrack | undefined) || null
          activeVideoTrack = (existingCameraPublication?.track as LocalVideoTrack | null) || (tracks.find((t) => t.kind === 'video') as LocalVideoTrack | undefined) || null
        }

        if (!activeVideoTrack) {
          console.error('[BroadcastPage] ❌ NO VIDEO TRACK AVAILABLE')
          return
        }

        // 🔥 PUBLISH TRACKS TO ROOM
        console.log('[BroadcastPage] 📡 Publishing tracks to room...')
        
        if (activeVideoTrack) {
          // Check if already published to avoid duplicate
          const existingVideoPub =
            roomToUse.localParticipant.getTrackPublication(Track.Source.Camera) ||
            Array.from(roomToUse.localParticipant.videoTrackPublications.values())
              .find((pub: any) =>
                pub.trackName === (activeVideoTrack as any)?.name ||
                pub?.track === activeVideoTrack ||
                pub?.track?.source === Track.Source.Camera
              )
          if (!existingVideoPub) {
            await roomToUse.localParticipant.publishTrack(activeVideoTrack)
            localTrackPublishedCountRef.current += 1
            DEBUG_COUNTERS.hostAudioVideoPublishedCount += 1
            console.log('[BroadcastPage] ✅ Video track published')
          } else {
            console.log('[BroadcastPage] ℹ️ Video track already published')
          }
        }

        if (activeAudioTrack) {
          // Check if already published to avoid duplicate
          const existingAudioPub =
            roomToUse.localParticipant.getTrackPublication(Track.Source.Microphone) ||
            Array.from(roomToUse.localParticipant.audioTrackPublications.values())
              .find((pub: any) =>
                pub.trackName === (activeAudioTrack as any)?.name ||
                pub?.track === activeAudioTrack ||
                pub?.track?.source === Track.Source.Microphone ||
                pub?.track?.kind === 'audio'
              )
          if (!existingAudioPub) {
            await roomToUse.localParticipant.publishTrack(activeAudioTrack)
            localTrackPublishedCountRef.current += 1
            DEBUG_COUNTERS.hostAudioVideoPublishedCount += 1
            console.log('[BroadcastPage] ✅ Audio track published')
          } else {
            console.log('[BroadcastPage] ℹ️ Audio track already published')
          }
        }

        // 🔥 CRITICAL: SYNC TO STATE IMMEDIATELY
        setLocalTracks([
          activeAudioTrack || null,
          activeVideoTrack || null,
        ])
        setCameraEnabled(Boolean(activeVideoTrack?.mediaStreamTrack?.enabled ?? activeVideoTrack))
        setMicEnabled(Boolean(activeAudioTrack?.mediaStreamTrack?.enabled ?? activeAudioTrack))

        console.log('[BroadcastPage] 🔥 Tracks synced to state:', {
          hasVideo: !!activeVideoTrack,
          hasAudio: !!activeAudioTrack,
        })

        // Handle screen share mode: replace camera with screen track
        if (isScreenShareExisting && screenTrackExisting && activeVideoTrack) {
          try {
            // Unpublish camera track
            for (const pub of roomRef.current.localParticipant.videoTrackPublications.values()) {
              if (pub.track && pub.track.kind === 'video') {
                await roomRef.current.localParticipant.unpublishTrack(pub.track)
                console.log('[BroadcastPage] Camera track unpublished (screen share mode)')
                break
              }
            }
            // Publish screen track
            await roomRef.current.localParticipant.publishTrack(screenTrackExisting)
            localTrackPublishedCountRef.current += 1
            activeVideoTrack = screenTrackExisting
            setIsScreenSharing(true)
            setLocalTracks([activeAudioTrack || null, activeVideoTrack])
            setCameraEnabled(Boolean(activeVideoTrack?.mediaStreamTrack?.enabled ?? activeVideoTrack))
            console.log('[BroadcastPage] Screen track published (screen share mode)')
          } catch (err) {
            console.error('[BroadcastPage] Failed to publish screen track:', err)
          }
        }

        hasJoinedRef.current = true
        liveKitConnectionKeyRef.current = connectionKey

        } catch (err) {
          console.error('LiveKit init error:', err)
        }
        // OPTIMIZED: Removed finally block - no UI blocking
      }

      initLiveKit()

         return () => {
           mounted = false
           const room = roomRef.current
           if (room) {
             detachLiveKitHandlers(room)
           }
         }
       }, [
         stream?.id,
         stream?.status,
         stream?.is_live,
user?.id, // user.id is used for identity
         isHost,
         attachLiveKitHandlers,
         detachLiveKitHandlers,
       ])

  const toggleCamera = useCallback(async () => {
    if (!roomRef.current || !roomRef.current.localParticipant) return
    
    const isEnabled = roomRef.current.localParticipant.isCameraEnabled
    if (isEnabled) {
      await roomRef.current.localParticipant.setCameraEnabled(false)
      setCameraEnabled(false)
    } else {
      await roomRef.current.localParticipant.setCameraEnabled(true, { facingMode: cameraFacingMode } as any)
      setCameraEnabled(true)
    }
    
    const tracks = roomRef.current.localParticipant.videoTrackPublications.values()
    let nextVideoTrack: LocalVideoTrack | null = null
    for (const pub of tracks) {
      if (pub.track && pub.track.kind === 'video') {
        nextVideoTrack = pub.track as LocalVideoTrack
        break
      }
    }
    setLocalTracks(prev => prev ? [prev[0], isEnabled ? null : nextVideoTrack || prev[1]] : prev) // Update original localTracks
  }, [cameraFacingMode])

  const flipCamera = useCallback(async () => {
    const participant = roomRef.current?.localParticipant
    if (!participant) return

    const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user'
    try {
      await participant.setCameraEnabled(false)
      await participant.setCameraEnabled(true, { facingMode: nextMode } as any)
      setCameraFacingMode(nextMode)
      setCameraEnabled(true)

      const videoPub = Array.from(participant.videoTrackPublications.values())
        .find((pub) => pub.track && pub.track.kind === 'video')
      setLocalTracks(prev => prev ? [prev[0], (videoPub?.track as LocalVideoTrack) || prev[1]] : prev) // Update original localTracks
      toast.success(nextMode === 'environment' ? 'Rear camera enabled' : 'Front camera enabled')
    } catch (error) {
      console.error('[BroadcastPage] Failed to flip camera:', error)
      toast.error('Could not switch camera')
      try {
        await participant.setCameraEnabled(true, { facingMode: cameraFacingMode } as any)
        setCameraEnabled(true)
      } catch (restoreError) {
        console.error('[BroadcastPage] Failed to restore camera after flip:', restoreError)
      }
    }
  }, [cameraFacingMode])

  const toggleMicrophone = useCallback(async () => {
    if (!roomRef.current || !roomRef.current.localParticipant) return
    
    const isEnabled = roomRef.current.localParticipant.isMicrophoneEnabled
    if (isEnabled) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(false)
      setMicEnabled(false)
    } else {
      if (stream?.id && user?.id) {
        const { data: activeMute } = await supabase
          .from('stream_mutes')
          .select('expires_at')
          .eq('stream_id', stream.id)
          .eq('user_id', user.id)
          .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
          .maybeSingle();

        if (activeMute) {
          const remaining = activeMute.expires_at
            ? Math.max(1, Math.ceil((new Date(activeMute.expires_at).getTime() - Date.now()) / 60000))
            : null;
          toast.error(`You are muted by a moderator.${remaining ? ` Try again in ${remaining} minute(s).` : ''}`);
          return;
        }
      }
      await roomRef.current.localParticipant.setMicrophoneEnabled(true)
      setMicEnabled(true)
    }
  }, [stream?.id, user?.id])

  useEffect(() => {
    if (!isHost || !hostMicMutedByOfficer || !roomRef.current?.localParticipant) return;
    
    console.log('[BroadcastPage] useEffect: hostMicMutedByOfficer is true - forcing mic disabled')
    roomRef.current.localParticipant.setMicrophoneEnabled(false).catch((err) => {
      console.error('Failed to force-disable host mic:', err);
    });
  }, [isHost, hostMicMutedByOfficer]);

  useEffect(() => {
    if (!stream?.id || !user?.id) return;
    let muteExpiryTimer: ReturnType<typeof setTimeout> | null = null;
    let lastMuteState = false;

    const applyMuteState = async (isMuted: boolean) => {
      const participant = roomRef.current?.localParticipant;
      if (!participant) return;

      try {
        await participant.setMicrophoneEnabled(!isMuted);
        setMicEnabled(!isMuted);
        if (isMuted && !lastMuteState) {
          toast.error('You have been muted by a moderator.');
        }
        lastMuteState = isMuted;
      } catch (err) {
        console.error('[BroadcastPage] Failed to apply moderator mute state:', err);
      }
    };

    const clearMuteExpiryTimer = () => {
      if (muteExpiryTimer) {
        clearTimeout(muteExpiryTimer);
        muteExpiryTimer = null;
      }
    };

    const scheduleUnmute = (expiresAt?: string | null) => {
      clearMuteExpiryTimer();
      if (!expiresAt) return;

      const delay = new Date(expiresAt).getTime() - Date.now();
      if (delay <= 0) {
        void applyMuteState(false);
        return;
      }

      muteExpiryTimer = setTimeout(() => {
        void applyMuteState(false);
      }, delay + 250);
    };

    const checkMuteState = async () => {
      const { data } = await supabase
        .from('stream_mutes')
        .select('id, expires_at')
        .eq('stream_id', stream.id)
        .eq('user_id', user.id)
        .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
        .maybeSingle();

      if (data) {
        await applyMuteState(true);
        scheduleUnmute(data.expires_at);
      } else {
        await applyMuteState(false);
      }
    };

    void checkMuteState();

    const channel = supabase
      .channel(`moderator-mute:${stream.id}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_mutes',
          filter: `stream_id=eq.${stream.id}`,
        },
        (payload: any) => {
          if (payload.new?.user_id === user.id) {
            void applyMuteState(true);
            scheduleUnmute(payload.new?.expires_at);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stream_mutes',
          filter: `stream_id=eq.${stream.id}`,
        },
        (payload: any) => {
          if (payload.new?.user_id === user.id) {
            const expiresAt = payload.new?.expires_at;
            if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
              void applyMuteState(false);
              clearMuteExpiryTimer();
            } else {
              void applyMuteState(true);
              scheduleUnmute(expiresAt);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'stream_mutes',
          filter: `stream_id=eq.${stream.id}`,
        },
        (payload: any) => {
          if (payload.old?.user_id === user.id) {
            clearMuteExpiryTimer();
            void applyMuteState(false);
          }
        }
      )
      .subscribe();

    return () => {
      clearMuteExpiryTimer();
      supabase.removeChannel(channel);
    };
  }, [stream?.id, user?.id]);

  // Listen for balance update events from gift system
  // This ensures all participants see updated balances in real-time without full page reloads
  useEffect(() => {
    const handleBalanceUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        senderId: string;
        receiverId: string;
        amount: number;
        timestamp: number;
      }>;
      
      const { senderId, receiverId } = customEvent.detail || {};
      console.log('[BroadcastPage] 💰 Balance update received:', { senderId, receiverId });
      
      // Only update broadcaster profile if broadcaster is involved - no refreshProfile calls
      // to avoid unnecessary state updates that could cause page refresh appearance
      const isBroadcasterInvolved = receiverId === stream?.user_id || senderId === stream?.user_id;
      if (isBroadcasterInvolved && stream?.user_id) {
        console.log('[BroadcastPage] 🔄 Broadcaster involved - updating profile');
        const { data: updatedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', stream.user_id)
          .maybeSingle();
        
        if (updatedProfile) {
          setBroadcasterProfile(updatedProfile);
        }
      }
    };
    
    window.addEventListener('broadcast-balance-update', handleBalanceUpdate);
    return () => window.removeEventListener('broadcast-balance-update', handleBalanceUpdate);
  }, [user?.id, stream?.user_id, supabase]);

   // Broadcaster profile updates are now handled in the combined host channel above



   const onGift = useCallback((userId: string) => {
     setGiftRecipientId(userId)
     setIsGiftModalOpen(true)
   }, [])

   const onGiftAll = useCallback((ids: string[]) => {
     toast.info(`Gift sent to ${ids.length} users`)
   }, [])

   const handleGiftHost = useCallback(() => onGift(stream?.user_id || ''), [onGift, stream?.user_id])

   const handleOpenUserAction = useCallback((info: { userId: string; username?: string; role?: string; createdAt?: string }) => {
     setUserActionTarget(info)
   }, [])

   const handleCloseUserAction = useCallback(() => {
     setUserActionTarget(null)
   }, [])

   const handleOpenUserStats = useCallback((statsInfo: {
     userId: string;
     username: string;
     trollCoins: number;
     trollmonds: number;
     licensePlate: string | null;
     isSeatUser: boolean;
   }) => {
     setShowUserStats(statsInfo)
   }, [])

   const handleCloseUserStats = useCallback(() => {
     setShowUserStats(null)
   }, [])

   const handleOpenHostStats = useCallback(() => {
     setShowHostStats(true)
   }, [])

   const handleCloseHostStats = useCallback(() => {
     setShowHostStats(false)
   }, [])

   // Mod actions (for officers) - use same UserActionModal
   const handleOpenModActions = useCallback((_target: any) => {
     // For now, officers use the same UserActionModal
     // In the future, a dedicated mod actions popup could be shown
   }, [])

   const handleCloseModActions = useCallback(() => {
     // No-op
   }, [])

  const clickHistoryRef = useRef<number[]>([]);
  const [isClickBlocked, setIsClickBlocked] = useState(false);

  const checkClickRate = useCallback(() => {
    const now = Date.now();
    clickHistoryRef.current = clickHistoryRef.current.filter(
      timestamp => now - timestamp < 1000
    );
    clickHistoryRef.current.push(now);
    // Allow 10 clicks per second for rapid spam clicking
    if (clickHistoryRef.current.length > 10) {
      return false;
    }
    return true;
  }, []);

const handleLike = useCallback(async () => {
    if (!user) {
        navigate('/auth?mode=signup');
        return;
    }
    if (isHost) {
        toast.error("Broadcasters cannot like their own broadcast");
        return;
    }

    if (isClickBlocked) {
        return; // Silent fail for rapid clicking
    }

    if (!checkClickRate()) {
        return; // Silent fail for rapid clicking
    }

    // Track this click for optimistic reconciliation
    const clickTimestamp = Date.now();
    const expectedLikes = 10;

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error('[handleLike] Session error:', sessionError);
        }
        if (!session) {
            navigate('/auth?mode=signup');
            return;
        }

        if (!stream?.id) {
            return;
        }

        const edgeUrl = `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-like`;
        
        // Send 10 likes in batch
        const response = await fetch(edgeUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stream_id: stream.id,
                count: 10
            })
        }).catch((err) => {
            console.error('[handleLike] Network error:', err);
            throw err;
        });

        if (response.status === 404) {
            toast.error('Like feature temporarily unavailable.');
            return;
        }

        let result;
        try {
            const text = await response.text();
            if (!text) {
                toast.error('Failed to process like - no response.');
                return;
            }
            result = JSON.parse(text);
        } catch {
            toast.error('Failed to process like.');
            return;
        }

        if (!response.ok) {
            // If server fails, don't update UI (the 10 optimistic was never sent)
            toast.error(result?.error || 'Failed to send like');
            return;
        }

        // Only update UI with server response (source of truth)
        const serverTotal = result.total_likes;
        setStream((prev: any) => {
            if (!prev) return prev;
            // Use server total as source of truth
            return { ...prev, total_likes: serverTotal };
        });

        // Broadcast to other users
        const channel = channelRef.current;
        if (channel) {
            await channel.send({
                type: 'broadcast',
                event: 'like_sent',
                payload: {
                    user_id: user.id,
                    stream_id: stream.id,
                    total_likes: serverTotal,
                    timestamp: Date.now()
                }
            });
        }

        if (result.coins_awarded > 0) {
            toast.success(
                `🎉 You earned ${result.coins_awarded} Troll Coin${result.coins_awarded !== 1 ? 's' : ''}! ` +
                `(${result.user_like_count.toLocaleString()} likes)`,
                { duration: 5000 }
            );
        }

    } catch (e) {
        console.error('Like error:', e);
        // Don't show error toast for network issues - could be temporary
    }
  }, [checkClickRate, isClickBlocked, isHost, navigate, stream?.id, user]);

  const toggleStreamRgb = useCallback(async () => {
    if (!isHost || !stream) return;
    const enabling = !stream.has_rgb_effect;
    try {
      const { data, error } = await supabase.rpc('purchase_rgb_broadcast', {
        p_stream_id: stream.id,
        p_enable: enabling
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || !result.success) throw new Error(result?.error || "Failed to update RGB");
      if (result.message === 'Purchased and Enabled') {
        toast.success("RGB Unlocked! (-10 Coins)");
      } else {
        toast.success(enabling ? "RGB Effect Enabled" : "RGB Effect Disabled");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to update RGB setting");
    }
  }, [isHost, stream?.id, stream?.has_rgb_effect]);

  const isStaff = useMemo(() => isStaffProfile(profile), [profile])

  const handleStreamEnd = useCallback(async () => {
    // For staff, skip confirmation and skip summary page
    if (isStaff || stream?.status === 'ended') {
      // Allow immediate end without confirmation
    } else {
      // For regular hosts, show confirmation
      const confirmed = window.confirm('Are you sure you want to end this stream? This cannot be undone.');
      if (!confirmed) return;
    }
    // Stop local and published media first
    cleanupLocalMedia()
    
    // Clear remote participants immediately
    setRemoteParticipants(new Map())
    
    // Disconnect from room
    const room = roomRef.current
    if (room) {
      livekitRoomDisconnectedCountRef.current += 1
      room.disconnect().catch(console.error)
      roomRef.current = null
    }

    // Clear PreflightStore to reset state for next broadcast
    // This ensures clean state when starting a new stream (especially for gaming screen share)
    PreflightStore.clear()
    
    let backendStopped = false

    // Stop LiveKit egress through the backend. The endpoint is responsible for
    // marking the stream ended after cleanup.
    try {
      console.log('[BroadcastPage] Stopping stream and egress...');
      const stopResponse = await fetch('/api/broadcasts/stop-streaming', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId: stream.id
        })
      });

      if (stopResponse.ok) {
        backendStopped = true
        console.log('[BroadcastPage] Stream and LiveKit egress stopped successfully');
      } else {
        const errorText = await stopResponse.text();
        console.warn('[BroadcastPage] Stop endpoint failed:', stopResponse.status, errorText);
      }
    } catch (stopErr: any) {
      console.warn('[BroadcastPage] Failed to call stop endpoint:', stopErr.message);
    }

    if (!backendStopped) {
      try {
        const { error: updateError } = await supabase
          .from('streams')
          .update({
            is_live: false,
            status: 'ended',
            ended_at: new Date().toISOString()
          })
          .eq('id', stream.id);

        if (updateError) {
          console.error('Failed to mark stream as ended:', updateError.message);
          toast.error('Failed to end stream properly.');
          return;
        }
      } catch (fallbackErr) {
        console.error('Exception marking stream as ended:', fallbackErr);
      }
    }

    try {
      // End RTC session
      const endTime = new Date().toISOString();
      const { data: session } = await supabase
        .from('rtc_sessions')
        .select('id, started_at')
        .eq('room_name', `stream-${stream.id}`)
        .eq('is_active', true)
        .maybeSingle();

      if (session) {
        const startTime = new Date(session.started_at);
        const durationSeconds = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000);
        
        await supabase
          .from('rtc_sessions')
          .update({
            is_active: false,
            ended_at: endTime,
            duration_seconds: durationSeconds
          })
          .eq('id', session.id);
        console.log('[BroadcastPage] RTC session ended, duration:', durationSeconds, 'seconds');
      }
    } catch (endErr) {
      console.error('Exception ending RTC session:', endErr);
    }
    
    setStream((prev: any) => prev ? { ...prev, status: 'ended', is_live: false } : null);
    
    // For staff, don't show summary page - go to government streams instead
    if (isStaff) {
      navigate('/government/streams');
    } else {
      navigate(`/broadcast/summary/${stream?.id}`);
    }
  }, [cleanupLocalMedia, isStaff, navigate, stream?.id, stream?.status]);

  const handleStartBattle = useCallback(async () => {
    if (!stream || !isHost) return
    
    try {
      if (stream.is_battle) {
        // End battle
        const { error } = await supabase
          .from('streams')
          .update({ 
            is_battle: false, 
            battle_id: null,
            battle_status: 'ended',
            battle_end_time: new Date().toISOString()
          })
          .eq('id', stream.id)
        
        if (error) throw error
        toast.success('Battle ended')
        setBattleStartTime(null)
      } else {
        const battleTheme = normalizeBattleTheme(selectedBattleTheme);
        // Start battle - create a battle record with challenger_stream_id
        let battleData: any = null;
        let battleError: any = null;
        ({ data: battleData, error: battleError } = await supabase
          .from('battles')
          .insert({
            challenger_stream_id: stream.id,
            status: 'active',
            started_at: new Date().toISOString(),
            battle_theme: battleTheme,
          })
          .select()
          .single());

        if (battleError && String(battleError.message || '').toLowerCase().includes('battle_theme')) {
          ({ data: battleData, error: battleError } = await supabase
            .from('battles')
            .insert({
              challenger_stream_id: stream.id,
              status: 'active',
              started_at: new Date().toISOString(),
            })
            .select()
            .single());
        }
        
        if (battleError) throw battleError
        
        // Then update the stream
        if (battleData?.id) {
          const { error: streamError } = await supabase
            .from('streams')
            .update({ 
              is_battle: true, 
              battle_id: battleData.id,
              broadcast_mode: 'battle',
              battle_status: 'active',
              battle_start_time: new Date().toISOString(),
              battle_end_time: new Date(Date.now() + 3 * 60 * 1000).toISOString()
            })
            .eq('id', stream.id)
          
          if (streamError) throw streamError
          toast.success('Battle started!')
          // Set battle start time for timer display
          setBattleStartTime(new Date())
          // Refresh stream to get updated state with is_battle: true
          refreshStream()
        }
      }
    } catch (err) {
      console.error('Error with battle:', err)
      toast.error('Failed to toggle battle')
    }
  }, [isHost, refreshStream, selectedBattleTheme, stream?.id, stream?.is_battle]);

  const swipeNavigateLockRef = useRef(false);

  // Check if there are adjacent streams to swipe to
  useEffect(() => {
    if (!stream?.id) {
      setCanSwipe(false);
      return;
    }

    // Enable swipe only for mobile viewers (not host, not on seat)
    const shouldEnableSwipe = !isHost && isMobileWidth;
    
    if (!shouldEnableSwipe) {
      setCanSwipe(false);
      return;
    }

     const checkAdjacentStreams = async () => {
       try {
         const currentCategory = stream.category || 'general';
         const { data } = await supabase
           .from('streams')
           .select('id')
           .or('is_live.eq.true,status.eq.live')
           .eq('category', currentCategory)
           .limit(2);

        const liveStreams = (data || []).filter((item) => item?.id);
        setCanSwipe(liveStreams.length > 1);
      } catch {
        setCanSwipe(false);
      }
    };

    checkAdjacentStreams();

    const swipeTimer = window.setInterval(checkAdjacentStreams, 30000);

    return () => {
      window.clearInterval(swipeTimer);
    };
  }, [stream?.id, stream?.category, isHost, isMobileWidth]);

  const navigateToAdjacentStream = useCallback(async (direction: 'up' | 'down') => {
    if (!stream?.id || swipeNavigateLockRef.current) return;

    swipeNavigateLockRef.current = true;

    try {
      const currentCategory = stream.category || 'general';
      const { data, error } = await supabase
        .from('streams')
        .select('id, category, current_viewers, created_at')
        .or('is_live.eq.true,status.eq.live')
        .eq('category', currentCategory)
        .order('current_viewers', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[BroadcastPage] Failed to fetch swipe stream list:', error);
        return;
      }

      let liveStreams = (data || []).filter((item) => item?.id);
      if (liveStreams.length <= 1) {
        const fallback = await supabase
          .from('streams')
          .select('id, category, current_viewers, created_at')
          .or('is_live.eq.true,status.eq.live')
          .order('current_viewers', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(50);

        if (fallback.error) {
          console.error('[BroadcastPage] Failed to fetch fallback swipe stream list:', fallback.error);
          return;
        }
        liveStreams = (fallback.data || []).filter((item) => item?.id);
      }
      if (liveStreams.length <= 1) return;

      const currentIndex = liveStreams.findIndex((item) => item.id === stream?.id);
      if (currentIndex === -1) return;

      const nextIndex = direction === 'up'
        ? (currentIndex + 1) % liveStreams.length
        : (currentIndex - 1 + liveStreams.length) % liveStreams.length;
      const targetStream = liveStreams[nextIndex];

      if (!targetStream?.id) return;

      navigate(`/watch/${targetStream.id}`);
    } catch (err) {
      console.error('[BroadcastPage] Swipe navigation failed:', err);
    } finally {
      window.setTimeout(() => {
        swipeNavigateLockRef.current = false;
      }, 400);
    }
  }, [navigate, stream?.category, stream?.id]);

  const handleStageTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isHost || e.touches.length !== 1) return;
    stageTouchStartYRef.current = e.touches[0].clientY;
    stageTouchCurrentYRef.current = e.touches[0].clientY;
  }, [isHost]);

  const handleStageTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // If stageTouchStartYRef is null, the touch started on an interactive element, so don't handle it
    if (isHost || stageTouchStartYRef.current === null) return;
    
    stageTouchCurrentYRef.current = e.touches[0].clientY;
    const diffY = stageTouchStartYRef.current - stageTouchCurrentYRef.current;
    
    // Only preventDefault if it's a significant swipe (>20px)
    // Small movements are likely taps/clicks on interactive elements
    if (Math.abs(diffY) > 20) {
      e.preventDefault();
    }
  }, [isHost]);

  const handleStageTouchEnd = useCallback(() => {
    if (isHost || stageTouchStartYRef.current === null || stageTouchCurrentYRef.current === null) {
      stageTouchStartYRef.current = null;
      stageTouchCurrentYRef.current = null;
      return;
    }

    const diffY = stageTouchStartYRef.current - stageTouchCurrentYRef.current;
    const threshold = 90;

    if (Math.abs(diffY) >= threshold) {
      navigateToAdjacentStream(diffY > 0 ? 'up' : 'down');
    }

    stageTouchStartYRef.current = null;
    stageTouchCurrentYRef.current = null;
  }, [isHost, navigateToAdjacentStream]);

  const memoizedViewerId = useMemo(() => 
    user?.id || anonymousViewerIdRef.current || undefined,
    [user?.id, anonymousViewerIdRef.current]
  );

  const activeUserIds = useMemo(() => {
    const ids: string[] = [];

    return ids;
  }, [stream?.user_id]);

  const userProfiles = useMemo(() => {
    if (!stream) return {};
    const profiles: Record<string, { username: string; avatar_url?: string }> = {};
    
    if (broadcasterProfile) {
      profiles[stream.user_id] = {
        username: broadcasterProfile.username || 'Broadcaster',
        avatar_url: broadcasterProfile.avatar_url,
      };
    }
    
    return profiles;
  }, [broadcasterProfile, stream?.user_id]);

  // INSTANT JOIN: Show minimal loading state inline instead of blocking entire page
  // This allows users to see the page immediately while data loads in background
  const categoryConfig = useMemo(() => getCategoryConfig(stream?.category || 'general'), [stream?.category])

  // INSTANT JOIN: Show broadcast content immediately

  // Only treat as mobile viewer after mount and when actually on mobile width
  const isMobileViewer = hasMounted && isMobileWidth && !isHost;

  // Check if game is active that should hide add/remove box buttons
  const isTrollopolyInProgress = Boolean(trollopoly.match && trollopoly.match.phase !== 'finished' && trollopoly.match.status !== 'finished');
  const isGameActive = Boolean(
    isTrollopolyInProgress ||
    (activeGame === 'troll_toe' && trollToe.match && trollToe.match.phase !== 'ended') ||
    activeGame === 'troll_us'
  );
  const streamLayoutStats = useMemo(() => ({
    viewers: viewerCount > 0 ? viewerCount : Number(stream?.current_viewers ?? stream?.viewer_count ?? remoteParticipants.size ?? 0),
    likes: Number((stream as any)?.total_likes ?? (stream as any)?.like_count ?? 0),
    coinsEarned: Number((stream as any)?.total_gifts_coins ?? (stream as any)?.coin_earnings ?? 0),
    onStage: 0,
  }), [
    viewerCount,
    stream?.current_viewers,
    stream?.viewer_count,
    stream?.total_likes,
    (stream as any)?.like_count,
    (stream as any)?.total_gifts_coins,
    (stream as any)?.coin_earnings,
    remoteParticipants.size,
  ])
  const liveViewerCount = viewerCount > 0 ? viewerCount : remoteParticipants.size
  const visibleViewerCount = Math.max(viewerCount, activeViewerProfiles.length)
  const viewerBubbleProfiles = useMemo(() => activeViewerProfiles.map((viewer) => ({
    id: viewer.user_id,
    username: viewer.username,
    avatar_url: viewer.avatar_url,
  })), [activeViewerProfiles])
  const broadcastGridRemoteUsers = remoteUsers
  const handleToggleBattleMode = useCallback(() => setIsBattleMode((active) => !active), [])
  const handleToggleGamePicker = useCallback(() => setGamePickerOpen((open) => !open), [])
  const handleGameSelect = useCallback((game: 'troll_toe' | 'troll_us') => {
    console.log('[BroadcastPage] Game selected:', game)
    setActiveGame(game)
  }, [])
  const handleSwipeUp = useCallback(() => navigateToAdjacentStream('up'), [navigateToAdjacentStream])
  const handleSwipeDown = useCallback(() => navigateToAdjacentStream('down'), [navigateToAdjacentStream])
  const handleTrollToeFog = useMemo(
    () => (!isHost && trollToe.match?.fogEnabled && trollToe.match?.phase === 'live' ? trollToe.useFog : undefined),
    [isHost, trollToe.match?.fogEnabled, trollToe.match?.phase, trollToe.useFog]
  )
  const shouldShowRandomBattleArena =
    stream?.battle_mode === 'random_queue' &&
    !!stream?.battle_id &&
    stream?.is_battle === true &&
    (stream?.battle_status === 'starting' || stream?.battle_status === 'active');

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-black text-white">
        <p className="text-red-500">{error}</p>
        <Link to="/">Go Home</Link>
      </div>
    )
  }

  // INSTANT JOIN: Show instant content while stream loads in background
  // Use skeleton/placeholder instead of blocking with spinner
  if (!stream) {
    return (
      <div className="flex items-center justify-center h-dvh bg-black">
        <div className="text-white text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-48 mb-4"></div>
            <div className="h-3 bg-gray-600 rounded w-32"></div>
          </div>
        </div>
      </div>
    )
  }

  if (shouldShowRandomBattleArena) {
    const battleLocalTracks =
      localTracks?.[0] && localTracks?.[1]
        ? ([localTracks[0], localTracks[1]] as [LocalAudioTrack, LocalVideoTrack])
        : null;

    return (
      <ErrorBoundary>
        <BattleView
          battleId={stream.battle_id!}
          currentStreamId={streamId || stream.id}
          viewerId={memoizedViewerId}
          localTracks={battleLocalTracks}
           remoteUsers={remoteUsers}
          onReturnToStream={() => {
            setStream((prev) =>
              prev
                ? {
                    ...prev,
                    is_battle: false,
                    battle_id: null,
                    battle_mode: 'none' as any,
                    battle_status: 'waiting' as any,
                  }
                : prev
            );
          }}
        />
      </ErrorBoundary>
    );
  }

   function handleMute(userId: string, reason?: string) {
   }

   function handleGeneralKick() {
   }

   function handleArrest(userId: string, reason?: string) {
   }

   function handleBlock(userId: string, reason?: string) {
   }

  return (
    <GiftSystemProvider streamId={streamId} defaultReceiverId={stream?.user_id}>
      <ErrorBoundary>
        {/* Fullscreen screenshare overlay - disabled, using BroadcastGrid instead */}
        {/* Screen share now displays through BroadcastGrid with object-fit: cover */}
        <StreamLayout
        isChatOpen={isChatOpen}
        onToggleChat={handleToggleChat}
        onLike={handleLike}
        hideHeader={true}
        forceViewMode={isMobileViewer ? 'vertical' : 'fullscreen'}
        stats={streamLayoutStats}
        
          header={
          <BroadcastHeader
            stream={stream}
            isHost={isHost}
            liveViewerCount={liveViewerCount}
            handleLike={handleLike}
            boxCount={(stream as any).box_count || 1}
                  onAddBox={undefined}
                  onRemoveBox={undefined}
            onClose={handleLeave}
            isMobile={isMobileViewer}
          />
        }
        
        video={
          <div
            className="flex flex-col h-full"
            style={!isHost ? { touchAction: 'pan-y' } : undefined}
          >
            {/* Always show BroadcastGrid - battle mode is integrated into the grid */}
<>
<BroadcastGrid
                stream={stream}
                showTicker={tickerSettings.is_enabled && !isMobileViewer}
                isMobileViewer={isMobileViewer}
                isHost={isHost}
                isOfficer={isOfficer}
                localTracks={localTracks}
                cameraOverlayTrack={cameraOverlayTrackState}
                room={roomRef.current}
                remoteUsers={broadcastGridRemoteUsers}
                localUserId={user?.id || ''}
                onGift={onGift}
                onGiftAll={onGiftAll}
              toggleCamera={toggleCamera}
              toggleMicrophone={toggleMicrophone}
              streamStatus={stream.status}
              boxCount={(stream as any).box_count || 1}
                 broadcastMode={stream.broadcast_mode as 'normal' | 'game' | 'battle' | undefined}
                 battleState={battleState}
                 isBattleActive={stream.is_battle}
                 battleStartedAt={stream.is_battle ? battleStartTime : null}
                 supporters={supporters}
                 onPickSide={pickSide}
                 joinWindowOpen={joinWindowOpen}
                 userTeam={userTeam}
                 remainingTime={remainingTime}
                 shouldShowSidePicker={shouldShowSidePicker}
                 onBattleGift={sendBattleGift}
                 enableStreamSwipe={isMobileViewer}
                 canSwipe={canSwipe}
                 onSwipeUp={handleSwipeUp}
                 onSwipeDown={handleSwipeDown}
                 onAddBox={undefined} // Hide manual seat addition
                 onRemoveBox={undefined} // Hide manual seat removal
                 onToggleRgb={isHost ? toggleStreamRgb : undefined}
                 hasRgbEffect={stream.has_rgb_effect}
                 canEditBoxes={false}
                 trollToeMatch={trollToe.match}
                 onTrollToeFog={handleTrollToeFog}
                 battleFormat={stream.broadcast_format as '1v1' | '2v2' | '3v3' | '4v4' | '5v5' | undefined}
                 isUniversalBattle={(stream as any).battle_mode === 'universal'}
                 onOpenUserAction={handleOpenUserAction}
                 onOpenUserStats={handleOpenUserStats}
                 onOpenHostStats={handleOpenHostStats}
                 onOpenModActions={handleOpenModActions}
                 onCloseModActions={handleCloseModActions}
                />
            </>
            
            {/* Troll Toe game lives on the broadcast grid tiles - no separate overlay needed */}
          </div>
        }

        controls={
          <>
            <BroadcastControls
              stream={stream}
              isHost={isHost}
              isOnStage={false}
              liveViewerCount={liveViewerCount}
              chatOpen={isChatOpen}
              toggleChat={handleToggleChat}
              onGiftHost={handleGiftHost}
              onShare={handleOpenShareModal}
              onLeave={handleLeaveSeat}
              onBoxCountUpdate={undefined}
              onStreamEnd={handleStreamEnd}
              handleLike={handleLike}
              toggleBattleMode={handleToggleBattleMode}
              localTracks={localTracks}
              toggleCamera={toggleCamera}
              toggleMicrophone={toggleMicrophone}
              onPinProduct={handlePinProduct}
              isMicOn={micEnabled}
              isCamOn={cameraEnabled}
              boxCount={(stream as any).box_count || 1}
              setBoxCount={undefined}
              onRefreshStream={refreshStream}
              isBattleActive={stream.is_battle}
              onStartBattle={isHost ? handleStartBattle : undefined}
              isLive={stream.status === 'live'}
              onTrollToeController={isHost && stream.status === 'live' ? handleToggleGamePicker : undefined}
              trollToeActive={gamePickerOpen || trollToe.isControllerOpen}
              onGameSelect={handleGameSelect}
              activeGame={activeGame}
              activeViewers={activeViewerProfiles}
              selectedBattleTheme={selectedBattleTheme}
              onBattleThemeChange={setSelectedBattleTheme}
            />
          </>
        }
        
        overlays={
          <>
            <AnimatePresence>
              {isHost && trollToe.isControllerOpen && (
                <div className="absolute top-16 right-3 z-[70] pointer-events-auto">
                  <TrollToeController
                    streamId={streamId!}
                    match={trollToe.match}
                    onResetBoard={trollToe.resetGame}
                    onOpenSideSelection={trollToe.openSideSelection}
                    onCloseSideSelection={trollToe.closeSideSelection}
                    onToggleFog={trollToe.toggleFog}
                    onSetFogCost={trollToe.setFogCost}
                    onSetRewardAmount={trollToe.setRewardAmount}
                    onAssignPlayers={trollToe.assignQueuedPlayers}
                    onClose={() => { trollToe.setControllerOpen(false); setActiveGame(null); }}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Troll Us Game Controller (host only) */}
            <AnimatePresence>
              {isHost && trollUsGameOpen && (
                <div className="absolute top-16 right-3 z-[70] pointer-events-auto">
                  <TrollUsGameController
                    streamId={streamId!}
                    onClose={() => { setTrollUsGameOpen(false); setActiveGame(null); }}
                  />
                </div>
              )}
            </AnimatePresence>
            {/* Game Picker Dropdown */}
            <AnimatePresence>
              {false && (
                <div className="absolute top-16 right-3 z-[65] pointer-events-auto">
                  <GamePicker
                    activeGame={activeGame}
                    category={stream?.category}
                    onSelectGame={(game) => {
                      setActiveGame(game)
                      setGamePickerOpen(false)
                      if (game === 'troll_toe') {
                        trollToe.setControllerOpen(true)
                      }
                      if (game === 'trollopoly') {
                        trollopoly.createGame()
                        setIsTrollopolyControllerOpen(true)
                      }
                    }}
                    onClose={() => setGamePickerOpen(false)}
                  />
                </div>
              )}
            </AnimatePresence>

           {/* Troll Toe Viewer UI */}
           <AnimatePresence>
             {!isHost && trollToe.match && trollToe.match.phase !== 'waiting' && (
               <TrollToeViewerUI
                 match={trollToe.match}
                 viewerStatus={trollToe.viewerStatus}
                 viewerTeam={trollToe.viewerTeam}
                 currentUserId={user?.id || anonymousViewerIdRef.current}
                 trollCoins={profile?.troll_coins || 0}
                 onJoinSide={trollToe.joinSide}
                 onUseFog={trollToe.useFog}
                 canUseFog={trollToe.canUseFog(user?.id || anonymousViewerIdRef.current)}
               />
             )}
           </AnimatePresence>

           {/* Trollopoly Lobby Overlay */}
           <AnimatePresence>
             {trollopoly.match && (trollopoly.match.phase === 'lobby' || trollopoly.match.phase === 'piece_selection') && (
               <TrollopolyLobby
                 match={trollopoly.match}
                 isHost={isHost}
                 currentUserId={user?.id}
                 availablePieces={trollopoly.availablePieces}
                 onJoin={trollopoly.joinGame}
                 onLeave={trollopoly.leaveGame}
                 onSelectPiece={trollopoly.selectPiece}
                 onStartGame={trollopoly.startGame}
                 onClose={() => { trollopoly.resetGame(); setActiveGame(null); }}
               />
             )}
           </AnimatePresence>

           {/* Trollopoly Board (Game View) */}
           <AnimatePresence>
             {trollopoly.match && trollopoly.match.phase === 'playing' && trollopolyCityState && (
               <div className="fixed inset-0 z-40 bg-black overflow-hidden">
                 <TrollopolyCityBoard
                   gameState={trollopolyCityState}
                   playerId={user?.id || ''}
                   onAction={handleTrollopolyCityAction}
                   isHost={isHost}
                   isSpectator={!trollopoly.match.players.some((player) => player.id === user?.id)}
                   streamId={streamId || trollopoly.match.streamId}
                   playerMedia={trollopolyPlayerMedia}
                 />
                 {!isHost && trollopoly.match.players.some((player) => player.id === user?.id) && (
                   <button
                     type="button"
                     onClick={() => trollopoly.leaveGame()}
                     className="absolute right-3 top-3 z-[80] flex items-center gap-2 rounded-full border border-red-400/40 bg-red-950/90 px-4 py-2 text-xs font-black uppercase tracking-wide text-red-100 shadow-2xl backdrop-blur hover:bg-red-900"
                     title="Leave Trollopoly"
                   >
                     <LogOut size={14} />
                     Leave Game
                   </button>
                 )}
               </div>
             )}
           </AnimatePresence>

           {/* Trollopoly Controller (Host Only) */}
           <AnimatePresence>
             {isHost && trollopoly.match && trollopoly.match.status !== 'finished' && !isTrollopolyControllerOpen && (
               <DraggableWrapper
                 initialPos={{
                   x: Math.max(20, Math.floor(window.innerWidth / 2) - 92),
                   y: Math.max(20, window.innerHeight - 88),
                 }}
                 bounds={{
                   left: 8,
                   right: Math.max(8, window.innerWidth - 220),
                   top: 8,
                   bottom: Math.max(8, window.innerHeight - 56),
                 }}
               >
                 <button
                   onClick={() => setIsTrollopolyControllerOpen(true)}
                   className="flex cursor-move items-center gap-2 rounded-full border border-amber-400/40 bg-slate-950/95 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-2xl shadow-amber-500/20 backdrop-blur hover:bg-slate-900"
                   title="Drag to move. Click to open game controls."
                 >
                   <Dice5 size={18} className="text-amber-300" />
                   Game Controls
                 </button>
               </DraggableWrapper>
             )}

             {isHost && trollopoly.match && trollopoly.match.status !== 'finished' && isTrollopolyControllerOpen && (
               <DraggableWrapper
                 initialPos={{
                   x: Math.max(20, window.innerWidth - 320),
                   y: 112,
                 }}
                 bounds={{
                   left: 8,
                   right: Math.max(8, window.innerWidth - 300),
                   top: 8,
                   bottom: Math.max(8, window.innerHeight - 440),
                 }}
               >
                 <TrollopolyController
                   match={trollopoly.match}
                   onStartGame={trollopoly.startGame}
                   onEndGame={trollopoly.endGame}
                   onResetGame={trollopoly.resetGame}
                   onClose={() => setIsTrollopolyControllerOpen(false)}
                 />
               </DraggableWrapper>
             )}
           </AnimatePresence>

           {/* Trollopoly Viewer UI */}
           <AnimatePresence>
             {!isHost && !isTrollopolyViewerPanelDismissed && trollopoly.match && (trollopoly.match.phase === 'playing' || trollopoly.match.status === 'finished') && (
               <TrollopolyViewerUI
                 match={trollopoly.match}
                 currentUserId={user?.id}
                 userBalance={profile?.troll_coins}
                 onClose={() => setIsTrollopolyViewerPanelDismissed(true)}
               />
             )}
           </AnimatePresence>

           {/* Gift Animation Overlay */}
           <GiftAnimationOverlay
             gifts={recentGifts}
             participantNames={Object.fromEntries(
               [
                 ...Object.entries(userProfiles).map(([id, profile]) => [id, profile.username || 'User'] as const),
                 ...Object.entries(giftNameMap),
               ]
             )}
             onAnimationComplete={(giftId) => {
               setRecentGifts(prev => prev.filter(g => g.id !== giftId));
             }}
           />

           {/* Glass Crack Full Page Effect */}
           <GlassCrackEffect />

           {/* TCPS Private Message Bubble */}
           {stream && <TCPSMessageBubble broadcasterId={stream.user_id} />}

           {/* Broadcast Ability Effects Overlay */}
           <BroadcastAbilityEffects activeEffects={abilityActiveEffects} />

           {/* Ability Box Floating Button */}
           {userAbilities.length > 0 && (
             <div className="absolute bottom-20 right-3 z-[50] pointer-events-auto">
               <button
                 onClick={() => setIsAbilityBoxOpen(true)}
                 className="relative bg-purple-600/90 hover:bg-purple-500 text-white p-3 rounded-full shadow-lg shadow-purple-500/30 transition-all hover:scale-110"
                 title="Open Ability Box - Use abilities during broadcast"
               >
                 <Shield className="w-5 h-5" />
                 <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                   {userAbilities.reduce((sum, a) => sum + a.quantity, 0)}
                 </span>
               </button>
             </div>
           )}

           {/* Ticker Control Button + Panel (host only) - hide during active game */}
           {isHost && !isGameActive && (
             <>
               <DraggableWrapper
                 initialPos={{ x: 20, y: window.innerHeight - 180 }}
               >
                 <button
                   onClick={() => setIsTickerPanelOpen(!isTickerPanelOpen)}
                   className="relative bg-cyan-600/90 hover:bg-cyan-500 text-white p-3 rounded-full shadow-lg shadow-cyan-500/30 transition-all hover:scale-110"
                   title="Open Ticker Control - Send scrolling announcements"
                 >
                   <Zap className="w-5 h-5" />
                   {tickerSettings.is_enabled && (
                     <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                   )}
                 </button>
               </DraggableWrapper>

               <AnimatePresence>
                 {isTickerPanelOpen && (
                     <DraggableWrapper
                     initialPos={{ x: 12, y: Math.min(window.innerHeight - 420, window.innerHeight * 0.3) }}
                   >
                     <TickerControlPanel
                       onSendMessage={(content, category, isPriority, tags) => {
                         if (isPriority) {
                           tickerSendPriority(content, category, tags);
                         } else {
                           tickerSendMessage(content, category, false, tags);
                         }
                       }}
                       onBroadcastSettings={tickerBroadcastSettings}
                       onDeleteMessage={tickerDeleteMessage}
                       onClose={() => setIsTickerPanelOpen(false)}
                       disableClose={activeGame === 'trollopoly'}
                     />
                   </DraggableWrapper>
                 )}
</AnimatePresence>
              </>
            )}
          </>
        }

        chat={
            <BroadcastChat
              streamId={streamId!}
              hostId={stream.user_id}
              isHost={isHost}
              isViewer={true}
              isGuest={!user}
              isBattleActive={stream.is_battle}
              isChatOpen={isChatOpen}
              broadcasterProfile={broadcasterProfile}
              onMessageSent={() => setHasReceivedChatMessage(true)}
            />
          }

          modals={
            <>
              <CoinStoreModal
               isOpen={isCoinStoreOpen}
               onClose={() => setIsCoinStoreOpen(false)}
             />
             <GiftBoxModal
               isOpen={isGiftModalOpen}
               onClose={() => {
                 setIsGiftModalOpen(false);
                 setGiftRecipientId(null);
               }}
               recipientId={giftRecipientId || ''}
               streamId={streamId || ''}
               broadcasterId={stream.user_id}
               activeUserIds={activeUserIds}
               userProfiles={userProfiles}
                onGiftSent={async (giftData: GiftItem, target: GiftTarget) => {
                 // This callback is for UI effects only.
                 // DB insertion and coin deduction are handled server-side by send_gift_in_stream RPC.
                 console.log('[BroadcastPage] 🎁 Gift effect trigger:', { giftData, target });

                 // Trigger broadcast effects based on gift
                 const giftId = giftData.id?.toLowerCase() || giftData.name?.toLowerCase() || '';
                 const totalAmount = Number(giftData.coin_cost || 0);
                 if (giftId.includes('glass') || giftId.includes('breaker')) {
                   triggerGiftEffect('glass_breaker');
                 } else if (giftId.includes('flame') || giftId.includes('fire')) {
                   triggerGiftEffect('troll_flame');
                 } else if (giftId.includes('surge') || giftId.includes('city')) {
                   triggerGiftEffect('city_surge');
                 } else if (giftId.includes('glitch')) {
                   triggerGiftEffect('glitch_king');
                 } else {
                   // Default: boost heat bar for any gift
                   boostCityHeat(Math.ceil(totalAmount / 100));
                 }
               }}
             />
             
             <PinProductModal
               isOpen={isPinProductModalOpen}
               onClose={() => setIsPinProductModalOpen(false)}
               onProductPinned={async (productId) => {
                 const result = await pinProduct(productId);
                 if (!result.success) {
                   toast.error('Failed to pin product');
                 }
               }}
             />

             {/* User Action Modal (for gifts, mod actions, etc.) */}
             {userActionTarget && (
               <UserActionModal
                 onClose={handleCloseUserAction}
                 userId={userActionTarget.userId}
                 streamId={streamId || ''}
                 username={userActionTarget.username}
                 role={userActionTarget.role}
                 createdAt={userActionTarget.createdAt}
                 isHost={isHost}
                 isModerator={isModerator || isCurrentUserBroadofficer}
                 isOfficer={isOfficer}
                 onGift={() => onGift(userActionTarget.userId)}
                 onMute={() => handleMute(userActionTarget.userId, userActionTarget.username || '')}
                 onKick={() => handleGeneralKick()}
                 onArrest={() => handleArrest(userActionTarget.userId, userActionTarget.username || '')}
                 onBlock={() => handleBlock(userActionTarget.userId, userActionTarget.username || '')}
               />
             )}

{/* Broadcaster Stats Modal */}
             {showHostStats && isHost && (
               <BroadcasterStatsModal
                 stream={stream}
                 onClose={handleCloseHostStats}
                 broadcasterProfile={broadcasterProfile}
                 isCameraOn={cameraEnabled}
                 isMicOn={micEnabled}
                 onToggleCamera={toggleCamera}
                 onToggleMic={toggleMicrophone}
                 onFlipCamera={flipCamera}
                 cameraFacingMode={cameraFacingMode}
               />
             )}

             {/* User Stats Modal */}
             {showUserStats && (
               <UserStatsModal
                 isOpen={true}
                 onClose={handleCloseUserStats}
                 userId={showUserStats.userId}
                 username={showUserStats.username}
                trollCoins={showUserStats.trollCoins}
                trollmonds={showUserStats.trollmonds}
                licensePlate={showUserStats.licensePlate}
                 streamId={streamId || ''}
                 isSeatUser={showUserStats.isSeatUser}
               />
             )}

             {/* Ability Box Modal */}
             <AbilityBox
               isOpen={isAbilityBoxOpen}
               onClose={() => setIsAbilityBoxOpen(false)}
               abilities={userAbilities}
               activeEffects={abilityActiveEffects}
               onActivate={async (abilityId, targetUserId, targetUsername) => {
                 const success = await activateAbility(abilityId, targetUserId, targetUsername);
                 if (success) setIsAbilityBoxOpen(false);
                 return success;
               }}
               getCooldownRemaining={getCooldownRemaining}
               isEffectActive={isEffectActive}
               getEffectRemaining={getEffectRemaining}
               isInBroadcast={true}
               loading={abilityLoading}
             />
           </>
         }
      />

         <ShareModal
           isOpen={isShareModalOpen}
           onClose={() => setIsShareModalOpen(false)}
           streamTitle={stream?.title}
           streamUrl={`${window.location.origin}/watch/${stream?.id}`}
           broadcasterName={broadcasterProfile?.username}
         />
         
         {/* 🔧 DEBUG PANEL - Only show in development or when ?debug=1 */}
         {import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug') && stream && (
           <div style={{
             position: 'fixed',
             bottom: 20,
             right: 20,
             background: 'rgba(0,0,0,0.9)',
             color: '#0f0',
             fontFamily: 'monospace',
             fontSize: 11,
             padding: 12,
             borderRadius: 8,
             zIndex: 999999,
             maxWidth: 400,
             maxHeight: 300,
             overflow: 'auto',
             border: '1px solid #0f0'
           }}>
             <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#0ff' }}>
               🛠️ BROADCAST DEBUG PANEL
             </div>
             <div>Stream ID: {stream.id?.substring(0, 8)}...</div>
             <div>Status: {stream.status} | Live: {String(stream.is_live)}</div>
             <div>LiveKit Room: {stream.livekit_room_name?.substring(0, 12)}...</div>
           </div>
         )}
      </ErrorBoundary>
    </GiftSystemProvider>
  )
}

function isStaffProfile(profile: UserProfile | null) {
  if (!profile) return false
  return isStaffUser(profile)
}