import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Link,
  useParams,
  useNavigate,
} from 'react-router-dom'
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, LocalParticipant, VideoPresets, AudioPresets, Track, createLocalTracks } from 'livekit-client'

import { isStaffUser } from '../../lib/userUtils'

import { supabase, UserProfile } from '../../lib/supabase'

import { useAuthStore } from '../../lib/store'
import { useStreamStore } from '../../lib/streamStore'
import { cn } from '../../lib/utils'

import { useIsMobile } from '../../hooks/useIsMobile'

import { Stream, StagePass } from '../../types/broadcast'
import BroadcastControls from '../../components/broadcast/BroadcastControls'
import BroadcastBottomBar from '../../components/broadcast/BroadcastBottomBar'
import BroadcastNeonHeader from '../../components/broadcast/BroadcastNeonHeader'
import MoreControlsDrawer from '../../components/broadcast/MoreControlsDrawer'
import { BadgeCheck, Gift } from 'lucide-react'
import DraggableWrapper from '@/components/broadcast/DraggableWrapper'

import { trollCityBroadcastTheme as theme } from '../../styles/broadcastTheme'

// Reusable label classes from broadcastTheme
const guestLabel = 'rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[11px] font-black text-cyan-300 shadow-[0_0_12px_rgba(45,212,191,0.25)]'
const sectionLabel = 'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm font-bold text-white/70 backdrop-blur'


import BroadcastStageLayout from '../../components/broadcast/BroadcastStageLayout'
import StagePassRequestsPanel from '@/components/broadcast/StagePassRequestsPanel'

import ShareModal from '@/components/broadcast/ShareModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import { GlassCrackEffect } from '@/components/GlassCrackEffect'
import { getCategoryConfig } from '@/config/broadcastCategories'
import { useBattleState } from '@/hooks/useBattleState'
import { useBroadcastAbilities } from '@/hooks/useBroadcastAbilities'
import { useBroadcastPinnedProducts } from '@/hooks/useBroadcastPinnedProducts'
import { BroadcastGift } from '@/hooks/useBroadcastRealtime'
import { useBroadcastTicker } from '@/hooks/useBroadcastTicker'
import { useRandomBattleQueueController } from '@/hooks/useRandomBattleQueueController'
import { useStreamRealtime } from '@/hooks/useStreamRealtime'
import { useStagePasses } from '@/hooks/useStagePasses'
import { DEFAULT_BATTLE_THEME_ID, normalizeBattleTheme } from '@/lib/battleThemes'
import { emitEvent } from '@/lib/events'
import { GiftItem } from '@/lib/giftConstants'
import { getGiftVisualConfig } from '@/lib/giftVisuals'

import { GiftSystemProvider } from '@/lib/hooks/useGiftSystem'
import { PreflightStore } from '@/lib/preflightStore'
import { useTickerStore } from '@/stores/tickerStore'
import { AnimatePresence } from 'framer-motion'
import { LogOut, Coins, Maximize2, MessageSquare, Mic, MicOff, Video, VideoOff, Crown, X, Ticket, Plus, ShieldCheck, Sparkles, Skull } from 'lucide-react'
import { toast } from 'sonner'
import TCPSMessageBubble from '@/components/broadcast/TCPSMessageBubble'
import AbilityBox from '@/components/broadcast/AbilityBox'
import BattleView from '@/components/broadcast/BattleView'
import BroadcastAbilityEffects from '@/components/broadcast/BroadcastAbilityEffects'
import BroadcasterStatsModal from '@/components/broadcast/BroadcasterStatsModal'
import CoinStoreModal from '@/components/broadcast/CoinStoreModal'
import GiftBoxModal from '@/components/broadcast/GiftBoxModal'
import GiftVideoOverlay from '@/components/broadcast/GiftVideoOverlay'
import OpenStagePassModal from '@/components/broadcast/OpenStagePassModal'
import PinProductModal from '@/components/broadcast/PinProductModal'
import TickerControlPanel from '@/components/broadcast/TickerControlPanel'
import UserActionModal from '@/components/broadcast/UserActionModal'
import UserStatsModal from '@/components/broadcast/UserStatsModal'

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
  const navigate = useNavigate()
  const streamId = params.id || params.streamId

  const { user, profile } = useAuthStore()
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
    profile.is_superadmin || profile.role === 'owner'
  ))
  
   const isOfficer = isStaffProfile(profile)
   const isModerator = isStaffProfile(profile) // Treat all staff as moderators

   const videoPreset = isStreamAdmin ? VideoPresets.h1080 : VideoPresets.h720

   const [stream, setStream] = useState<Stream | null>(null)
   const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null);
   const [streamMods, setStreamMods] = useState<string[]>([]);
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

  // Stage Pass System
  const stagePassesHook = useStagePasses(streamId)
  const { stagePasses, requests, approveStagePass, denyStagePass } = stagePassesHook

  console.debug('[BroadcastPage StagePass Requests]', { streamId, requests, stagePasses })

  const roomName = useMemo(() => {
  return (
    stream?.livekit_room_name ||
    stream?.room_name ||
    streamId ||
    ''
  );
}, [stream?.livekit_room_name, stream?.room_name, streamId]);

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
        const trackIdentifier = (candidate as any).trackId || (candidate as any).sid || 'unknown'
        console.warn(
          `[BroadcastPage] Failed to publish ${kind} track`,
          err,
          { trackId: trackIdentifier, kind }
        )
        return undefined
      }
    }

    const published = await tryPublish(track)
    if (published) return published

    // If direct publication fails, attempt to recreate the LiveKit track from the native MediaStreamTrack
    try {
      const mediaTrack =
        (track as any).getMediaStreamTrack?.() ||
        (track as any).mediaStreamTrack?.();
      if (!mediaTrack) {
        console.warn('[BroadcastPage] No native media track available for clone publish', { kind })
        return undefined
      }

      console.log('[BroadcastPage] Cloning preflight track from native MediaStreamTrack', {
        kind,
        label: mediaTrack.label,
        enabled: mediaTrack.enabled,
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
   const [isStagePassModalOpen, setIsStagePassModalOpen] = useState(false)
   const [isMoreControlsOpen, setIsMoreControlsOpen] = useState(false)
   const [chatTab, setChatTab] = useState<'chat' | 'gifts' | 'top-fans' | 'settings'>('chat')
   const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
   const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
   const [giftNameMap, setGiftNameMap] = useState<Record<string, string>>({})
   const [giftUserPositions, setGiftUserPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({})
    const getGiftUserPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}))
    const giftNameMapRef = useRef<Record<string, string>>({})
   const [allTimeTopGifters, setAllTimeTopGifters] = useState<Array<{user_id: string; sender_username: string; sender_avatar_url: string | null; total_gift_coins: number; last_gift_at: string | null}>>([])
   const [isAllTimeTopGiftersLoading, setIsAllTimeTopGiftersLoading] = useState(false)

   // ── Floating Chat ─────────────────────────────────────────────────────────
   interface FloatingMessage {
     id: string
     username: string
     content: string
     createdAt: number
   }

    const [floatingMessages, setFloatingMessages] = useState<FloatingMessage[]>([])
    const [messages, setMessages] = useState<Array<{id: string; username: string; content: string; createdAt: number}>>([])
    const [chatInput, setChatInput] = useState('')
    const floatingChatContainerRef = useRef<HTMLDivElement>(null)
    const chatContainerRef = useRef<HTMLDivElement>(null)

   useEffect(() => {
     const broadcasterId = stream?.user_id;
     if (!broadcasterId) {
       setAllTimeTopGifters([]);
       return;
     }

     let cancelled = false;

     const loadAllTimeTopGifters = async () => {
       setIsAllTimeTopGiftersLoading(true);

       try {
         const { data: giftRows, error: giftError } = await supabase
           .from('stream_gifts')
           .select('*')
           .eq('receiver_id', broadcasterId)
           .limit(5000);

         if (giftError) {
           console.warn('[BroadcastPage] Failed to load all-time top gifters:', giftError);
           if (!cancelled) setAllTimeTopGifters([]);
           return;
         }

         const totals = new Map<string, { total: number; lastGiftAt: string | null }>();

         (giftRows || []).forEach((row: any) => {
           const senderId = String(row.sender_id || row.user_id || row.senderId || '');
           if (!senderId || senderId === broadcasterId) return;

           const amount = Number(
             row.coins_amount ??
             row.coins_spent ??
             row.total_coins ??
             row.total_amount ??
             row.amount ??
             row.coin_value ??
             0
           );

           if (!Number.isFinite(amount) || amount <= 0) return;

           const current = totals.get(senderId) || { total: 0, lastGiftAt: null };
           const rowCreatedAt = row.created_at || row.timestamp || null;

           totals.set(senderId, {
             total: current.total + amount,
             lastGiftAt:
               rowCreatedAt && (!current.lastGiftAt || new Date(rowCreatedAt).getTime() > new Date(current.lastGiftAt).getTime())
                 ? rowCreatedAt
                 : current.lastGiftAt,
           });
         });

         const senderIds = Array.from(totals.keys());

         if (senderIds.length === 0) {
           if (!cancelled) setAllTimeTopGifters([]);
           return;
         }

         const { data: profileRows, error: profileError } = await supabase
           .from('user_profiles')
           .select('id, username, display_name, email, avatar_url')
           .in('id', senderIds);

         if (profileError) {
           console.warn('[BroadcastPage] Failed to load top gifter profiles:', profileError);
         }

         const profileMap = new Map<string, any>();
         (profileRows || []).forEach((row: any) => {
           if (row?.id) profileMap.set(row.id, row);
         });

         const ranked = senderIds
           .map((senderId) => {
             const profileRow = profileMap.get(senderId);
             const total = totals.get(senderId)!;

             return {
               user_id: senderId,
               sender_username:
                 profileRow?.username ||
                 profileRow?.display_name ||
                 profileRow?.email?.split('@')?.[0] ||
                 'Troll Citizen',
               sender_avatar_url: profileRow?.avatar_url || null,
               total_gift_coins: Math.floor(total.total),
               last_gift_at: total.lastGiftAt,
             };
           })
           .sort((a, b) => b.total_gift_coins - a.total_gift_coins)
           .slice(0, 10);

         if (!cancelled) setAllTimeTopGifters(ranked);
       } catch (err) {
         console.warn('[BroadcastPage] Unexpected error loading all-time top gifters:', err);
         if (!cancelled) setAllTimeTopGifters([]);
       } finally {
         if (!cancelled) setIsAllTimeTopGiftersLoading(false);
       }
     };

     void loadAllTimeTopGifters();

     return () => {
       cancelled = true;
     };
   }, [stream?.user_id])

  const handleRemoveGiftOverlay = useCallback((giftId: string) => {
    setRecentGifts((current) => current.filter((gift) => gift.id !== giftId))
  }, [])

  // Determine if current user can publish based on Stage Pass status
  const canPublish = isHost
    || stagePassesHook.currentUserStagePass?.status === 'live'
    || stagePassesHook.currentUserStagePass?.status === 'approved';

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
   // Per-page dedupe of gift animations used by processGiftEvent.
   // Normalised animationId is always the stream_gifts row UUID, so whether the
   // source is postgres_changes or the broadcast channel, the second arrival is
   // caught here and skipped.
   const seenGiftAnimationIdsRef = useRef<Set<string>>(new Set())

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
            const mediaTrack = preflightVideoTrack.mediaStreamTrack;
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

          overlayTrack = new LocalVideoTrack(overlayStream.getVideoTracks()[0]);
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

  const enrichGiftForOverlay = useCallback(async (incomingGift: any) => {
    const giftItemId =
      incomingGift?.gift_id ||
      incomingGift?.gift_item_id ||
      incomingGift?.giftId ||
      incomingGift?.giftItemId ||
      null;

    if (!giftItemId) {
      return incomingGift;
    }

    const { data: giftItem, error } = await supabase
      .from('gift_items')
      .select('id,name,slug,gift_slug,icon,icon_url,animation_url,animation_type,coin_cost')
      .eq('id', giftItemId)
      .maybeSingle();

    if (error || !giftItem) {
      console.warn('[BroadcastPage] Could not enrich gift overlay payload', {
        giftItemId,
        error,
        incomingGift,
      });
      return incomingGift;
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
    };

    if (import.meta.env.DEV) {
      console.info('[BroadcastPage] Enriched gift overlay payload', {
        gift_id: giftItemId,
        gift_name: enrichedGift.gift_name,
        slug: enrichedGift.slug,
        gift_slug: enrichedGift.gift_slug,
        animation_url: enrichedGift.animation_url,
      });
    }

    return enrichedGift;
  }, []);

   const processGiftEvent = useCallback(async (giftData: any) => {
     if (!giftData) {
       if (import.meta.env.DEV) console.log('[BroadcastPage] ⚠️ processGiftEvent: giftData is null/undefined');
       return;
     }

     // ── Stable animation-id ─────────────────────────────────────────────────
     const animationId = String(giftData.id || giftData.stream_gift_id || giftData.gift_transaction_id || '');
     if (!animationId) return // noise: skip entirely
     const giftId = animationId;

     if (seenGiftAnimationIdsRef.current.has(animationId)) {
       if (import.meta.env.DEV) console.log('[BroadcastPage] Duplicate animation skipped', animationId);
       return;
     }
     seenGiftAnimationIdsRef.current.add(animationId);

     // ── Enrich / validate ───────────────────────────────────────────────────
     const enrichedGiftData = await enrichGiftForOverlay(giftData);

     const incomingStreamId = enrichedGiftData.streamId || enrichedGiftData.stream_id || enrichedGiftData.metadata?.streamId || enrichedGiftData.metadata?.stream_id;
     const receiverId = enrichedGiftData.receiver_id || enrichedGiftData.recipient_id || enrichedGiftData.receiverId || enrichedGiftData.recipientId || enrichedGiftData.metadata?.receiver_id || enrichedGiftData.metadata?.recipient_id;
     console.log('[BroadcastPage] ✅ Processing gift', { animationId, incomingStreamId, currentStreamId: streamId, receiverId });

     if (incomingStreamId && incomingStreamId !== streamId) {
       console.log('[BroadcastPage] ⚠️ Stream ID mismatch, skipping gift:', { incomingStreamId, currentStreamId: streamId });
       return;
     }

     const resolvedGiftAmount = resolveGiftAmount(enrichedGiftData);
     const resolvedGiftName = resolveGiftName(enrichedGiftData);

     // ── Build state entry ──────────────────────────────────────────────────
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
    } as BroadcastGift;

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

    // Auto-remove gift from recentGifts after the gift's animation duration so overlays play fully
    const giftDurationMs = newGift.animation_duration_ms ?? getGiftVisualConfig(newGift).durationMs;
    setTimeout(() => {
      setRecentGifts(prev => prev.filter(g => g.id !== giftId));
    }, giftDurationMs + 150);

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
        },
        (err) => {
          console.warn('[BroadcastPage] Failed to resolve gift usernames:', err);
        }
      );
    }

// Start animation via centralized store; all participants should see this.
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
          // Provide both snake_case and camelCase for consumers
          sender_id: giftData.sender_id,
          senderId: giftData.sender_id,
          receiver_id: receiverId,
          receiverId: receiverId,
          amount: resolvedGiftAmount,
          coins: resolvedGiftAmount,
          gift_id: giftId,
          giftId: giftId,
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
  const handleCloseTickerPanel = useCallback(() => setIsTickerPanelOpen(false), [])
  const tickerSettings = useTickerStore((s) => s.settings)

   // Quick Coin Store
   const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false)


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

  const updateStreamPatch = useCallback((patch: Partial<Stream>) => {
    setStream((prev) => prev ? { ...prev, ...patch } : prev);
  }, []);

  const randomBattleQueue = useRandomBattleQueueController({
    stream,
    userId: user?.id,
    isBroadcaster: isHost,
    onStreamUpdate: updateStreamPatch,
  });

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
   const handleClosePinProductModal = useCallback(() => setIsPinProductModalOpen(false), [])
   const handleOpenStagePassModal = useCallback(() => setIsStagePassModalOpen(true), [])
   const handleCloseStagePassModal = useCallback(() => setIsStagePassModalOpen(false), [])
   const handleOpenMoreMenu = useCallback(() => setIsMoreControlsOpen(true), [])
   const handleCloseMoreMenu = useCallback(() => setIsMoreControlsOpen(false), [])

  const handleOpenStagePassConfirm = useCallback(async (count: number, priceCoins: number) => {
    try {
      if (!streamId || !user?.id) {
        toast.error('Not connected to a live stream');
        return;
      }
      await stagePassesHook.openStagePasses(Math.min(count, 5), Math.max(0, priceCoins));
      await stagePassesHook.loadStagePasses();
      setIsStagePassModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to open Stage Passes');
    }
  }, [stagePassesHook, streamId, user?.id])
  const handleOpenCoinStore = useCallback(() => setIsCoinStoreOpen(true), [])
  const handleCloseCoinStore = useCallback(() => setIsCoinStoreOpen(false), [])
  const handleOpenAbilityBox = useCallback(() => setIsAbilityBoxOpen(true), [])
  const handleCloseAbilityBox = useCallback(() => setIsAbilityBoxOpen(false), [])

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
       const rawGift = event?.new ?? event
       if (rawGift) {
         void processGiftEvent(rawGift)
       }
     },
   });

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase.channel(`stream-presence:${streamId}`, {
      config: { presence: { key: user?.id || anonymousViewerIdRef.current } },
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
          const id = String(presence?.user_id || presence?.key || '');
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

   // ── Floating Chat: receive broadcasts ────────────────────────────────────
useEffect(() => {
  if (!streamId) return;

  const timers = new Set<number>();
  const channel = supabase.channel(`floating-chat:${streamId}`);

  channel
    .on('broadcast', { event: 'floating_chat' }, (payload: any) => {
      const { username, content } = payload.payload || {};
      if (!username || !content) return;

      const msgId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setFloatingMessages(prev =>
        [
          {
            id: msgId,
            username,
            content,
            createdAt: Date.now(),
          },
          ...prev,
        ].slice(0, 50)
      );

      const timer = window.setTimeout(() => {
        setFloatingMessages(prev => prev.filter(m => m.id !== msgId));
        timers.delete(timer);
      }, 60_000);

      timers.add(timer);
    })
    .subscribe();

  return () => {
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
    supabase.removeChannel(channel);
  };
}, [streamId, supabase]);

  // ★ Gift animations are now driven exclusively by useStreamRealtime.onGift
  // (stream_gifts postgres_changes).  The broadcast gift_sent channel is no
  // longer subscribed here — the postgres event fires once per INSERT and
  // both channels resolved to the same animationId (stream_gifts row UUID).
  // ★ If you are building a minimal overlay or chat overlay that only shows
  // the in-chat gift line, re-subscribe to `giftChannel` here instead.

  useEffect(() => {
    if (recentGifts.length > 0) {
      console.log('[BroadcastPage] recentGifts state:', recentGifts.map((g) => ({ id: g.id, gift_name: g.gift_name, sender_id: g.sender_id, receiver_id: g.receiver_id })));
    }
  }, [recentGifts]);

  // Listen for broadcast-balance-update events to update both broadcaster profile and auth store
  useEffect(() => {
    const processedGiftIdsRef = { current: new Set<string>() } as { current: Set<string> };

    const handleBroadcastBalanceUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const senderId = detail.sender_id || detail.senderId || detail.sender;
      const receiverId = detail.receiver_id || detail.receiverId || detail.receiver;
      const amount = Number(detail.amount || detail.coins || detail.value || 0);
      const giftId = detail.gift_id || detail.giftId || detail.id || null;

      if (!amount || !senderId || !receiverId) return;

      // If we have a giftId, dedupe repeated balance events to avoid double-application
      if (giftId) {
        if (processedGiftIdsRef.current.has(String(giftId))) {
          if (import.meta.env.DEV) console.debug('[BroadcastPage] Ignoring duplicate balance update for giftId', giftId);
          return;
        }
        processedGiftIdsRef.current.add(String(giftId));
      }

      if (import.meta.env.DEV) console.log('[BroadcastPage] Balance update received:', { senderId, receiverId, amount, giftId });

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

  // Fetch stream mods for the floating overlay badges
  useEffect(() => {
    const fetchMods = async () => {
      const targetHostId = stream?.user_id;
      if (!targetHostId) return;
      const { data } = await supabase
        .from('stream_moderators')
        .select('user_id')
        .eq('broadcaster_id', targetHostId);
      if (data) setStreamMods(data.map(d => d.user_id));
    };
    fetchMods();
  }, [stream?.user_id]);

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
     || stagePassesHook.currentUserStagePass?.status === 'live'
     || stagePassesHook.currentUserStagePass?.status === 'approved'
    
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
   const handleCloseGiftModal = useCallback(() => setIsGiftModalOpen(false), [])

   const onGiftAll = useCallback((ids: string[]) => {
     toast.info(`Gift sent to ${ids.length} users`)
   }, [])

   const handleGiftHost = useCallback(() => onGift(stream?.user_id || ''), [onGift, stream?.user_id])

   const handleOpenUserAction = useCallback((info: { userId: string; username?: string; role?: string; createdAt?: string }) => {
     setUserActionTarget(info)
   }, [])

   const handleOpenFloatingChatUsername = useCallback(async (username: string) => {
     if (!username || username === 'Anonymous') return
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
       console.error('[BroadcastPage] Error opening user action:', err)
       toast.error('Failed to open user profile')
     }
   }, [])

   const handleCloseUserAction = useCallback(() => {
     setUserActionTarget(null)
   }, [])
   const handleCloseShareModal = useCallback(() => setIsShareModalOpen(false), [])

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

   // ── Troll Button ───────────────────────────────────────────────────────
   // Viewers (non-host) can click once per broadcast to trigger a random
   // temporary prank effect.  The host can never be targeted by their own
   // broadcast's troll button.
   const [trollUsedThisBroadcast, setTrollUsedThisBroadcast] = useState(false)
   const trollEffectsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

   // Load whether the current user already used their troll this broadcast
   useEffect(() => {
     if (!streamId || !user?.id || isHost) return

     const channel = supabase
       .channel(`troll-usage:${streamId}:${user.id}`)
       .on(
         'broadcast',
         { event: 'troll_used' },
         (payload: any) => {
           if (payload?.payload?.user_id === user.id) {
             setTrollUsedThisBroadcast(true)
           }
         },
       )
       .subscribe()

     // Also pre-load from DB
     supabase
       .from('broadcast_troll_usages')
       .select('id')
       .eq('stream_id', streamId)
       .eq('user_id', user.id)
       .maybeSingle()
       .then(({ data }) => {
         if (data) setTrollUsedThisBroadcast(true)
       })

     trollEffectsChannelRef.current = channel
     return () => {
       supabase.removeChannel(channel)
       trollEffectsChannelRef.current = null
     }
   }, [streamId, user?.id, isHost, supabase])

   // ── Troll Prank Definitions ─────────────────────────────────────────────
   // Each prank is a temporary effect (±10 s) expressed as a broadcast_active_effects
   // entry so the existing BroadcastAbilityEffects overlay can render it.
   type TrollPrank = {
     name: string
     icon: string
     description: string
     ability_id: string            // matches a BroadcastAbilityEffects entry
     targetUserLabel?: string      // displayed in the system banner
     extraData: Record<string, any>
   }

   const TROLL_PRANKS: TrollPrank[] = [
     {
       name:      'Coin Vanish',
       icon:      '💸',
       description: 'Broadcaster Troll Coins drained for 10 seconds!',
       ability_id: 'troll_coin_drain',
       targetUserLabel: 'broadcaster_coins',
       extraData: { prankType: 'coin_drain', duration: 10 },
     },
     {
       name:      'Gift Lock',
       icon:      '🎁',
       description: 'Gifts disabled in battle mode for 10 seconds!',
       ability_id: 'troll_gift_lock',
       targetUserLabel: 'battle_gifts',
       extraData: { prankType: 'gift_lock', duration: 10 },
     },
     {
       name:      'Worthless Gifts',
       icon:      '😂',
       description: 'All gifts worth 1 coin for the next 10 seconds!',
       ability_id: 'troll_worthless_gifts',
       targetUserLabel: 'worthless_gifts',
       extraData: { prankType: 'worthless_gifts', duration: 10 },
     },
     {
       name:      'Troll Flash',
       icon:      '⚡',
       description: 'Broadcaster screen flashed for everyone to see!',
       ability_id: 'troll_flash',
       targetUserLabel: 'flash',
       extraData: { prankType: 'flash', duration: 10 },
     },
     {
       name:      'Chaos Audio',
       icon:      '🔊',
       description: "Can't hear the broadcaster for 10 seconds!",
       ability_id: 'troll_audio_gag',
       targetUserLabel: 'audio_gag',
       extraData: { prankType: 'audio_gag', duration: 10 },
     },
     {
       name:      'Liar Liar',
       icon:      '🪞',
       description: 'Broadcaster video gets a funhouse mirror effect!',
       ability_id: 'troll_mirror',
       targetUserLabel: 'mirror',
       extraData: { prankType: 'mirror', duration: 10 },
     },
   ]

   const handleTroll = useCallback(async () => {
     if (!user || !stream || isHost) {
       toast.error('Only viewers can troll during a broadcast!')
       return
     }
     if (trollUsedThisBroadcast) {
       toast.error("You've already used your Troll button this broadcast!")
       return
     }
     if (!streamId) return

     // Pick a random prank the user has NOT triggered yet in this session
     // (fall back to fully random once all have been used)
     const channel = trollEffectsChannelRef.current
     if (!channel) return

     const prank = TROLL_PRANKS[Math.floor(Math.random() * TROLL_PRANKS.length)]
     const now = new Date()
     const expiresAt = new Date(now.getTime() + 10_000) // 10 seconds

     try {
       // 1) Record troll usage (DB + local)
       await supabase
         .from('broadcast_troll_usages')
         .insert({ stream_id: streamId, user_id: user.id, prank_name: prank.name, created_at: now.toISOString() })
         .then(() => setTrollUsedThisBroadcast(true))

       // Inform all participants that this user has used their troll
       await channel.send({
         type: 'broadcast',
         event: 'troll_used',
         payload: { user_id: user.id, prank: prank.name },
       })

       // 2) Insert active effect so BroadcastAbilityEffects renders it
       const { data: effectData } = await supabase
         .from('broadcast_active_effects')
         .insert({
           stream_id:     streamId,
           ability_id:    prank.ability_id,
           activator_id:  user.id,
           activator_username: profile?.username || 'Anonymous',
           target_user_id:   null,
           target_username:   null,
           started_at:    now.toISOString(),
           expires_at:    expiresAt.toISOString(),
           data:          prank.extraData,
         })
         .select()
         .single()

       // 3) Log it
       await supabase.from('broadcast_ability_logs').insert({
         stream_id:       streamId,
         ability_id:      prank.ability_id,
         activator_id:    user.id,
         activator_username: profile?.username || 'Anonymous',
         target_user_id:  null,
         target_username:  null,
         amount:          null,
       })

       // 4) Auto-delete the effect after 10 s so the overlay disappears
       if (effectData?.id) {
         setTimeout(async () => {
           await supabase.from('broadcast_active_effects').delete().eq('id', effectData.id)
         }, 10_500)
       }

       toast.success(
         `😈 Troll used: ${prank.icon} ${prank.name}\n${prank.description}`,
         { duration: 5000 },
       )

// 5) Badge functionality has been removed
      } catch (err: any) {
        console.error('[handleTroll] Error:', err)
        toast.error(err.message || 'Troll failed. Try again!')
      }
    }, [user, stream, streamId, isHost, trollUsedThisBroadcast, profile?.username, supabase])

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
   const handleSwipeUp = useCallback(() => navigateToAdjacentStream('up'), [navigateToAdjacentStream])

  const shouldShowRandomBattleArena =
    stream?.battle_mode === 'random_queue' &&
    !!stream?.battle_id &&
    stream?.is_battle === true &&
    (stream?.battle_status === 'starting' || stream?.battle_status === 'active');

   function handleMute(userId: string, reason?: string) {
     toast.info(`Mute user ${userId}`);
   }

   function handleGeneralKick() {
     toast.info('Kick issued');
   }

   function handleArrest(userId: string, reason?: string) {
     toast.info(`Arrest user ${userId}`);
   }

   function handleBlock(userId: string, reason?: string) {
     toast.info(`Block user ${userId}`);
   }

  const handleAssignBroadofficer = useCallback(async () => {
    if (!isHost) {
      toast.error('Only the broadcaster can assign broadofficers');
      return;
    }
    const entry = window.prompt('Enter username of user to promote to Broadofficer (exact):');
    if (!entry) return;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, username')
        .ilike('username', entry)
        .limit(1)
        .maybeSingle();

      if (!profile || !profile.id) {
        toast.error('User not found');
        return;
      }

      const { error } = await supabase.rpc('assign_broadofficer', { p_user_id: profile.id });
      if (error) throw error;
      toast.success(`${profile.username} is now a Broadofficer`);
    } catch (err: any) {
      console.error('Assign broadofficer error:', err);
      toast.error(err?.message || 'Failed to assign broadofficer');
    }
  }, [isHost]);

  
  function startDrag(event: React.MouseEvent<HTMLDivElement>): void {
    // Start a horizontal resize for the desktop chat panel
    try {
      event.preventDefault();
      const divider = event.currentTarget as HTMLDivElement;
      const panel = divider.parentElement as HTMLElement | null;
      if (!panel) return;

      const startX = event.clientX;
      const startWidth = panel.getBoundingClientRect().width;

      const minWidth = 200;
      const maxWidth = 720;

      function onMouseMove(e: MouseEvent) {
        const dx = startX - e.clientX; // dragging left increases width
        let newWidth = startWidth + dx;
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        panel.style.width = `${Math.round(newWidth)}px`;
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    } catch (err) {
    }
  }

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-dvh', theme.pageBg + ' text-white')}>
        <p className="text-red-300">{error}</p>
        <Link to="/">Go Home</Link>
      </div>
    )
  }

  // INSTANT JOIN: Show instant content while stream loads in background
  // Use skeleton/placeholder instead of blocking with spinner
  if (!stream) {
    return (
      <div className={cn('flex items-center justify-center h-dvh', theme.pageBg + ' text-white')}>
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-white/10 rounded w-48 mb-4"></div>
            <div className="h-3 bg-white/[0.06] rounded w-32"></div>
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

  return (
      <GiftSystemProvider streamId={streamId} defaultReceiverId={stream?.user_id}>
          <ErrorBoundary>

          {/* ── Outer layout: header + 3-column grid + bottom bar + footer ── */}
          <div className={cn(theme.pageShell, 'relative flex h-screen max-h-screen min-h-0 flex-col overflow-hidden')}>

            {/* Background layers — identical to Sidebar ShellBackdrop */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-300/65 to-transparent" />

            {/* TOP HEADER */}
            {!isMobileViewer && (
              <BroadcastNeonHeader
                stream={stream}
                broadcasterProfile={broadcasterProfile ? {
                  username: broadcasterProfile.username,
                  avatar_url: broadcasterProfile.avatar_url,
                  display_name: broadcasterProfile.display_name,
                } : null}
                isHost={isHost}
                liveViewerCount={liveViewerCount}
                handleLike={handleLike}
                onGift={handleGiftHost}
                onShare={handleOpenShareModal}
                onEndStream={handleStreamEnd}
                coinBalance={profile?.troll_coins ?? broadcasterProfile?.troll_coins ?? 0}
                onOpenCoinStore={handleOpenCoinStore}
                isLive={stream.status === 'live'}
                streamStartedAt={stream.started_at}
              />
            )}

            {/* ── MAIN CONTENT GRID (2-column) ── */}
            <main
              className="grid flex-1 min-h-0 gap-4 px-5 py-4"
              style={{ gridTemplateColumns: 'minmax(430px, 1.2fr) 360px' }}
            >
              {/* ── LEFT: Host Video Card ── */}
              <section className={cn('relative min-h-0 overflow-hidden', theme.hostVideoPanel)}>

                {/* Camera starting fallback — shows when no video track is available */}
                {(() => {
                  const hostCamTrack = isHost
                    ? (localTracks?.[1] ?? null)
                    : (() => {
                        const broadcasterUserId = stream?.user_id;
                        if (!broadcasterUserId || !remoteParticipants) return null;
                        let vt: LocalVideoTrack | RemoteVideoTrack | undefined;
                        remoteParticipants.forEach((rp: RemoteParticipant) => {
                          if (rp.identity === broadcasterUserId) {
                            const pub = (rp as any).videoTrackPublications
                              ? Array.from((rp as any).videoTrackPublications.values()) as any[]
                              : [];
                            const found = pub.find((p: any) => p.track && typeof (p.track as any).attach === 'function');
                            if (found) vt = found.track;
                          }
                        });
                        return vt ?? null;
                      })();

                  if (hostCamTrack) return null;

                  return (
                    <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.15),transparent_38%)]">
                      {broadcasterProfile?.avatar_url ? (
                        <img
                          src={broadcasterProfile.avatar_url}
                          alt={broadcasterProfile.username || 'Broadcaster'}
                          className="h-28 w-28 rounded-full border-2 border-cyan-400/70 object-cover shadow-[0_0_28px_rgba(45,212,191,0.35)]"
                        />
                      ) : (
                        <Crown className="h-14 w-14 text-cyan-200/60" />
                      )}
                      <p className="mt-4 text-base font-black text-white">{broadcasterProfile?.username || 'Broadcaster'}</p>
                      <p className="mt-1 text-sm text-cyan-200/60">Camera starting…</p>
                    </div>
                  );
                })()}

                {/* Host video element — mounted via TrackAttach, covers card when track available */}
                <TrackAttach track={isHost ? (localTracks?.[1] ?? null) : (() => {
                  const broadcasterUserId = stream?.user_id;
                  if (!broadcasterUserId || !remoteParticipants) return null;
                  let vt: any = null;
                  remoteParticipants.forEach((rp: RemoteParticipant) => {
                    if (rp.identity === broadcasterUserId) {
                      const pubs = (rp as any).videoTrackPublications;
                      if (pubs) {
                        pubs.forEach((pub: any) => {
                          if (pub.track && typeof pub.track?.attach === 'function') vt = pub.track;
                        });
                      }
                    }
                  });
                  return vt;
                })()} />

                {/* Gradient overlay — sits above video/fallback */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Host badge — top-left */}
                <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/18 px-4 py-2 text-sm font-black text-cyan-300 shadow-[0_0_18px_rgba(45,212,191,0.25)] backdrop-blur-xl">
                  <Crown className="h-4 w-4" />
                  Host
                </div>

                {/* Mic / Camera media pills — top-right */}
                <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
                  <span className={cn(
                    theme.badge,
                    micEnabled ? theme.emeraldPill : theme.redPill,
                  )} title={`mic ${micEnabled ? 'on' : 'off'}`}>
                    {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  </span>
                  <span className={cn(
                    theme.badge,
                    cameraEnabled ? theme.emeraldPill : theme.redPill,
                  )} title={`camera ${cameraEnabled ? 'on' : 'off'}`}>
                    {cameraEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                  </span>
                </div>

                 

                 {/* Pinned product overlay */}
                 {(() => {
                   const pinned = pinnedProducts.find((p: any) => p.stream_id === stream.id);
                   if (!pinned) return null;
                   const imgSrc = (pinned as any).image_url || (pinned as any).imageUrl || (pinned as any)?.product?.image_url || null;
                   const title = (pinned as any).title || (pinned as any).name || (pinned as any)?.product?.name || 'Product';
                   const priceVal = (pinned as any).price_coins || (pinned as any).coin_price || (pinned as any).price || (pinned as any)?.product?.price || 0;
                   return (
                     <div className="absolute bottom-6 left-6 z-20 w-[min(310px,calc(100%-32px))] rounded-2xl border border-purple-400/30 bg-[#120b1f]/90 p-4 shadow-[0_0_30px_rgba(168,85,247,0.35)] backdrop-blur-xl">
                       <div className="mb-3 flex items-center justify-between">
                         <span className="rounded-lg bg-purple-500/40 px-2.5 py-1 text-[11px] font-black uppercase text-purple-100">
                           Pinned Product
                         </span>
                         {isHost && (
                           <button
                             onClick={() => pinProduct(pinned.id)}
                             className="rounded-md p-1 text-white/50 hover:text-white transition-colors"
                             aria-label="Remove pinned product"
                           >
                             <X className="h-4 w-4" />
                           </button>
                         )}
                       </div>
                       <div className="flex items-center gap-3">
                         <div className="h-16 w-16 shrink-0 rounded-xl bg-white/8 overflow-hidden">
                           {imgSrc ? (
                             <img src={imgSrc} alt={title} className="h-full w-full object-cover" />
                           ) : (
                             <div className="h-full w-full grid place-items-center text-violet-300">
                               <Ticket className="h-7 w-7" />
                             </div>
                           )}
                         </div>
                         <div className="min-w-0">
                           <p className="text-sm font-bold text-white truncate">{title}</p>
                           <p className="mt-1 text-xs text-white/60">{priceVal.toLocaleString()} coins</p>
                         </div>
                       </div>
                     </div>
                   )
                 })()}
               </section>

              {/* ── RIGHT: Chat Panel ── */}
              <aside className={cn(
    theme.chatPanel,
    'flex min-h-0 flex-col overflow-hidden bg-black/20 border border-white/10 backdrop-blur-xl shadow-[0_0_28px_rgba(45,212,191,0.12)]'
  )}>
                {/* Chat tabs */}
                <div className="grid grid-cols-3 border-b border-white/10 bg-black/10">
                  {['Chat',  'Top Fans', 'Settings'].map((tab) => {
                    const tabKey = tab.toLowerCase().replace(/\s+/g, '-') as 'chat' | 'gifts' | 'top-fans' | 'settings'
                    const active = chatTab === tabKey
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setChatTab(tabKey)}
                        className={cn(
                          'relative h-16 text-sm font-black transition-colors',
                          active ? 'text-white' : 'text-white/60 hover:text-white/80',
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

                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {chatTab === 'chat' ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
                      {/* Floating messages area — newest on top, scrollable */}
<div
  ref={floatingChatContainerRef}
  className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide overscroll-contain"
>
                        {floatingMessages.length === 0 && (
                          <div className="flex h-full items-center justify-center text-white/25 text-sm font-bold">
                            No messages yet – say something!
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
                              className="font-black text-cyan-300 hover:text-cyan-100 transition-colors cursor-pointer"
                              title={`View ${msg.username}'s profile`}
                            >
                              {msg.username}
                            </button>
                            <span className="text-white/40 mx-1">:</span>
                            <span className="text-white/90">{msg.content}</span>
                          </div>
                        ))}
                      </div>

                      {/* Input at the bottom */}
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          const text = chatInput.trim()
                          if (!text || !user) return

                          const username = profile?.username || (profile as any)?.display_name || user.email?.split('@')?.[0] || 'Anonymous'
                          const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

                          setFloatingMessages(prev => [{ id: msgId, username, content: text, createdAt: Date.now() }, ...prev].slice(-50))
                          setChatInput('')

                          // Auto-remove after 60 seconds
                          setTimeout(() => {
                            setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                          }, 60_000)

                          // Save to DB + broadcast to other viewers
                          try {
                            const { data: { session } } = await supabase.auth.getSession()
                            if (session) {
                              await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-message`, {
                                method: 'POST',
                                headers: {
                                  Authorization: `Bearer ${session.access_token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  type: 'chat',
                                  stream_id: streamId,
                                  data: { content: text },
                                }),
                              })
                            }
                            // Broadcast to other viewers via Supabase channel
                            const chatChannel = supabase.channel(`floating-chat:${streamId}`)
                            chatChannel.send({
                              type: 'broadcast',
                              event: 'floating_chat',
                              payload: { username, content: text },
                            }).catch(() => {})
                          } catch { /* silent */ }
                        }}
                        className="mt-auto border-t border-white/10 bg-black/15 px-3 py-2 backdrop-blur-md"
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Say something…"
                          className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
                          maxLength={280}
                        />
                      </form>
                    </div>
                  ) : chatTab === 'gifts' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 text-sm text-slate-200">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Recent Gifts</div>
                      {recentGifts.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">
                          No gifts yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {recentGifts.slice(0, 12).map((gift) => (
                            <div key={gift.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-white truncate">{gift.sender_username || 'Anonymous'}</div>
                                  <div className="text-xs text-slate-400 truncate">Sent {gift.quantity || 1} {gift.gift_name || 'gift'}</div>
                                </div>
                                <div className="text-xs font-semibold text-cyan-300">{gift.coins_amount?.toLocaleString() || gift.amount?.toLocaleString() || '0'} coins</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : chatTab === 'top-fans' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-transparent p-4 text-sm text-slate-200">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">All-Time Top Gifters</div>
                      {isAllTimeTopGiftersLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading top gifters...</div>
                      ) : allTimeTopGifters.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">No all-time gifters yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {allTimeTopGifters.map((fan, index) => (
                            <Link
                              key={fan.sender_id}
                              to={`/profile/${fan.sender_id}`}
                              className="block rounded-2xl border border-white/10 bg-black/20 p-3 transition-all hover:border-cyan-300/40 hover:bg-cyan-500/10"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-200">
                                    #{index + 1}
                                  </div>
                                  {fan.sender_avatar_url ? (
                                    <img
                                      src={fan.sender_avatar_url}
                                      alt={fan.sender_username}
                                      className="h-10 w-10 shrink-0 rounded-full border border-cyan-300/40 object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-black text-white">
                                      {fan.sender_username?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-black text-white hover:text-cyan-200">{fan.sender_username || 'Troll Citizen'}</div>
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
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center p-4 text-sm text-slate-500">
                      <p className="mb-2 font-bold text-white">Settings</p>
                      <p>Use broadcaster controls to update chat behavior and moderation.</p>
                    </div>
                  )}
                </div>
              </aside>
            </main>

              {/* ── BOTTOM CONTROL BAR ── */}
              <BroadcastBottomBar
                openPassCount={stagePassesHook.stagePasses.filter((p: StagePass) => p.status === 'open').length}
                isMicOn={micEnabled}
                isCamOn={cameraEnabled}
                isLive={stream.status === 'live'}
                isGiftTrayOpen={isGiftModalOpen}
                isOfficerModalOpen={!!(stagePassesHook as any)?.showOfficer}
                onToggleMic={toggleMicrophone}
                onToggleCam={toggleCamera}
                onGift={handleGiftHost}
                onShare={handleOpenShareModal}
                onOpenStagePass={() => {}}
                onManageStagePass={() => {}}
                onOpenMoreMenu={handleOpenMoreMenu}
                onEndStream={handleStreamEnd}
                onOpenCoinStore={handleOpenCoinStore}
                isHost={isHost}
              />

            {/* ── FOOTER STATUS STRIP ── */}
            <div className={theme.footerStrip}>
              <span className="flex items-center gap-2 text-slate-400">
                <Sparkles className="h-4 w-4 text-purple-400" />
                Your stream is protected
              </span>
              <span className="text-white/15">•</span>
              <span>Troll City Guidelines</span>
              <span className="text-white/15">•</span>
              <span className="text-emerald-400 font-bold">Secure Stream</span>
              <span className="text-white/15">•</span>
              <span className="text-emerald-400">Excellent Connection</span>
            </div>

            {/* View mode toggle — desktop */}
            {!isMobileViewer && (
              <div className="absolute top-3 right-3 z-50">
                <button
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className="rounded-lg bg-black/40 backdrop-blur border border-white/10 flex items-center gap-1.5 px-2.5 py-1.5 text-white/70 hover:text-white transition-all"
                  title="Toggle Chat"
                  aria-label="Toggle chat"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline text-[10px] font-bold">Chat</span>
                </button>
              </div>
            )}

            {/* View mode toggle — mobile */}
            {isMobileViewer && (
              <div className="absolute bottom-3 left-3 z-50">
                <button
                  onClick={() => setIsChatOpen((prev) => !prev)}
                  className="rounded-lg bg-black/40 backdrop-blur border border-white/10 flex items-center gap-1.5 px-2.5 py-1.5 text-white/70 hover:text-white transition-all"
                  title={isChatOpen ? 'Close Chat' : 'Open Chat'}
                  aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline text-[10px] font-bold">{isChatOpen ? 'Close' : 'Chat'}</span>
                </button>
              </div>
            )}
          </div>

            {/* OVERLAYS — absolutely positioned, renders above all grid content */}
            <div className="absolute inset-0 pointer-events-none">
              {isGiftModalOpen && (
                <GiftBoxModal
                  isOpen={isGiftModalOpen}
                  onClose={handleCloseGiftModal}
                  streamId={streamId}
                  recipientId={giftRecipientId}
                />
              )}

            </div>
              <GiftVideoOverlay gifts={recentGifts} onFinish={handleRemoveGiftOverlay} nameMap={giftNameMap} />
               {/* Stage pass requests panel for broadcasters - TEMPORARILY DISABLED */}
                   {/* <StagePassRequestsPanel
                     onApprove={(id) => void approveStagePass(id)}
                     onDeny={(id) => void denyStagePass(id)}
                   /> */}
              {isShareModalOpen && (
                <div className="pointer-events-auto">
                <ShareModal
                  isOpen={isShareModalOpen}
                  onClose={handleCloseShareModal}
                  streamTitle={stream?.title || 'Untitled Stream'}
                  streamUrl={`${window.location.origin}/broadcast/${streamId}`}
                  broadcasterName={(broadcasterProfile && (broadcasterProfile.display_name || broadcasterProfile.username)) || 'someone'}
                />
                </div>
              )}
              {isStagePassModalOpen && (
                <div className="pointer-events-auto">
                <OpenStagePassModal
                  isOpen={isStagePassModalOpen}
                  onClose={handleCloseStagePassModal}
                  onConfirm={handleOpenStagePassConfirm}
                />
                </div>
              )}
              {isPinProductModalOpen && (
                <div className="pointer-events-auto">
                <PinProductModal
                  isOpen={isPinProductModalOpen}
                  onClose={handleClosePinProductModal}
                  onProductPinned={async (productId) => {
                    const result = await pinProduct(productId);
                    if (!result.success) {
                      toast.error('Failed to pin product');
                    }
                  }}
                />
                </div>
              )}

              {/* User Action Modal (for gifts, mod actions, etc.) */}
              {userActionTarget && (
                <div className="pointer-events-auto">
                <UserActionModal
                  streamId={streamId}
                  onClose={handleCloseUserAction}
                  userId={userActionTarget.userId}
                  username={userActionTarget.username}
                  role={userActionTarget.role}
                  createdAt={userActionTarget.createdAt}
                  isHost={isHost}
                  isModerator={isModerator || isCurrentUserBroadofficer}
                  isOfficer={isOfficer}
                  onGift={() => onGift(userActionTarget.userId)}
                  onKickStage={() => handleGeneralKick()}
                />
                </div>
              )}

              {/* Broadcaster Stats Modal */}
              {showHostStats && isHost && (
                <div className="pointer-events-auto">
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
                </div>
              )}

              {/* User Stats Modal */}
              {showUserStats && (
                <div className="pointer-events-auto">
                <UserStatsModal
                  isOpen={true}
                  onClose={handleCloseUserStats}
                  userId={showUserStats.userId}
                  username={showUserStats.username}
                  trollCoins={showUserStats.trollCoins}
                  trollmonds={showUserStats.trollmonds}
                  licensePlate={showUserStats.licensePlate}
                  isSeatUser={showUserStats.isSeatUser}
                />
                </div>
              )}

              {/* Coin Store Modal */}
              {isCoinStoreOpen && (
                <div className="pointer-events-auto">
                <CoinStoreModal
                  isOpen={isCoinStoreOpen}
                  onClose={handleCloseCoinStore}
                />
                </div>
              )}

              {/* Ability Box Modal */}
              {isAbilityBoxOpen && (
                <div className="pointer-events-auto">
                <AbilityBox
                  isOpen={isAbilityBoxOpen}
                  onClose={handleCloseAbilityBox}
                  abilities={userAbilities}
                  activeEffects={abilityActiveEffects}
                  loading={abilityLoading}
                  onActivate={activateAbility}
                  isEffectActive={isEffectActive}
                  getCooldownRemaining={getCooldownRemaining}
                  getEffectRemaining={getEffectRemaining}
                  isInBroadcast={canPublish}
                />
                </div>
              )}

              {/* Broadcast Ability Effects */}
              <BroadcastAbilityEffects
                activeEffects={abilityActiveEffects}
              />

              {/* TCPS Message Bubble */}
              {stream?.user_id && (
                <TCPSMessageBubble
                  broadcasterId={stream.user_id}
                />
              )}

              {/* Ticker Control Panel */}
              {isTickerPanelOpen && (
                <TickerControlPanel
                  onClose={handleCloseTickerPanel}
                  onBroadcastSettings={tickerBroadcastSettings}
                  onSendMessage={tickerSendMessage}
                  onDeleteMessage={tickerDeleteMessage}
                />
              )}

              {/* More Controls Drawer */}
              {isMoreControlsOpen && (
                <div className="pointer-events-auto">
                  <MoreControlsDrawer
                    isOpen={isMoreControlsOpen}
                    onClose={handleCloseMoreMenu}
                    isMuted={!micEnabled}
                    isCameraOff={!cameraEnabled}
                    onToggleMic={toggleMicrophone}
                    onToggleCamera={toggleCamera}
                    onFlipCamera={flipCamera}
                    onLeave={handleLeave}
                    isHost={isHost}
                    isOfficer={isOfficer}
                    onGift={handleGiftHost}
                    onShare={handleOpenShareModal}
                    onEndStream={handleStreamEnd}
                    areSeatsLocked={!!stream?.are_seats_locked}
                    onManageStagePass={() => {}}
                    openStagePassCount={stagePassesHook.stagePasses.filter((p: StagePass) => p.status === 'open').length}
                    onAssignBroadofficer={handleAssignBroadofficer}
                    onMuteUser={handleMute}
                    onBanUser={handleBlock}
                    onRemoveFromStage={() => {}}
                    onModGift={handleGiftHost}
                    onToggleRGB={toggleStreamRgb}
                    hasRgbEffect={!!stream?.has_rgb_effect}
                  />
                </div>
              )}

        </ErrorBoundary>
      </GiftSystemProvider>
    );
  }

function isStaffProfile(profile: UserProfile | null) {
  if (!profile) return false
  return isStaffUser(profile)
}

/**
 * TrackAttach
 *
 * Inline LiveKit video renderer for the host camera card.
 * Attaches the video element to a permanent div via `track.attach()` in a useEffect.
 * Mirrors spin-off from BroadcastGrid.tsx LiveKitVideoPlayer for minimal standalone use.
 */
function TrackAttach({ track }: { track: LocalVideoTrack | RemoteVideoTrack | null }) {
  const divRef = React.useRef<HTMLDivElement>(null);
  const videoElRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    // If track is absent, detach and clear
    if (!track) {
      if (videoElRef.current) {
        try { track?.detach(videoElRef.current); } catch { /* ignore */ }
        videoElRef.current = null;
      }
      div.innerHTML = '';
      return;
    }

    let cancelled = false;
    const doAttach = () => {
      if (cancelled) return;
      try {
        const el = (track as any).attach();
        if (!el || !(el instanceof HTMLVideoElement)) return;
        el.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;display:block;';
        el.autoplay = true;
        el.muted = true;
        if (videoElRef.current && videoElRef.current !== el) {
          try { track.detach(videoElRef.current); } catch { /* ignore */ }
        }
        videoElRef.current = el;
        div.innerHTML = '';
        div.appendChild(el);
      } catch (err) {
        console.warn('[TrackAttach] attach failed, retrying in 100ms', err);
        setTimeout(doAttach, 100);
      }
    };

    doAttach();

    return () => {
      cancelled = true;
      if (videoElRef.current && track) {
        try { track.detach(videoElRef.current); } catch { /* ignore */ }
        videoElRef.current = null;
      }
    };
  }, [track]);

  if (!track) return null;

  return (
    <div
      ref={divRef}
      className="absolute inset-0 h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
    />
  );
}
