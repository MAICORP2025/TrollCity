import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Crown,
  Gift,
  Heart,
  LogOut,
  MessageSquare,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from 'lucide-react'
import type { RemoteParticipant, RemoteTrackPublication, RemoteVideoTrack } from 'livekit-client'
import { Track } from 'livekit-client'

import type { Stream } from '../../types/broadcast'
import type { BroadcastGift } from '../../hooks/useBroadcastRealtime'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

import BroadcastChat from '../../components/broadcast/BroadcastChat'
import BroadcastNeonHeader from '../../components/broadcast/BroadcastNeonHeader'
import ErrorBoundary from '../../components/ErrorBoundary'
import GiftBoxModal from '../../components/broadcast/GiftBoxModal'
import GiftVideoOverlay from '../../components/broadcast/GiftVideoOverlay'
import UserActionModal from '../../components/broadcast/UserActionModal'
import UserStatsOrb from '../../components/broadcast/UserStatsOrb'
import HypeCoinPopup from '../../components/HypeCoinPopup'
import { getGiftVisualConfig } from '../../lib/giftVisuals'


import { GiftSystemProvider } from '../../lib/hooks/useGiftSystem'
import { useBoxCount } from '../../hooks/useBoxCount'
import { useHypeCoins } from '../../lib/hooks/useHypeCoins'
import { useIsMobile } from '../../hooks/useIsMobile'
import useLiveKitRoom from '../../hooks/useLiveKitRoom'
import { useStreamRealtime } from '../../hooks/useStreamRealtime'
import { useStreamSeats } from '../../hooks/useStreamSeats'
import { useStagePasses } from '../../hooks/useStagePasses'
import { useStreamTopGifters } from '../../hooks/useStreamTopGifters'
import { FloatingChatOverlay } from '../../components/broadcast/FloatingChatOverlay'
import { Message } from '../../hooks/useStreamChat'

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
    identity.endsWith(`-${userId}`) ||
    metadata.user_id === userId ||
    metadata.userId === userId ||
    participant?.user_id === userId ||
    participant?.userId === userId
  )
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

function RemoteVideoSurface({
  participant,
  mirror = false,
  className,
  fallback,
  onTap,
}: {
  participant: any
  mirror?: boolean
  className?: string
  fallback: React.ReactNode
  onTap?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const videoTrack = useMemo(() => getVideoTrackFromParticipant(participant), [participant])
  const audioTrack = useMemo(() => getAudioTrackFromParticipant(participant), [participant])

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !videoTrack) return

    try {
      videoTrack.attach(videoEl)
      videoEl.play().catch(() => {})
    } catch (err) {
      console.warn('[ViewerPage] Failed to attach remote video track:', err)
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
      console.warn('[ViewerPage] Failed to attach remote audio track:', err)
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
    <div
      onClick={() => onTap && onTap()}
      className={cn('relative h-full w-full overflow-hidden bg-black', onTap && 'cursor-pointer', className)}
    >
      {videoTrack ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={false}
            className={cn(
              'h-full w-full object-cover',
              mirror && '-scale-x-100',
            )}
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
  const streamId = params.id || params.streamId || ''

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobileWidth, hasMounted } = useIsMobile()
  const isMobileViewer = hasMounted && isMobileWidth

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [streamLoaded, setStreamLoaded] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [chatTab, setChatTab] = useState<'chat' | 'gifts' | 'top-fans'>('chat')
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
  const [floatingChatMessages, setFloatingChatMessages] = useState<Message[]>([])
  const [streamMods, setStreamMods] = useState<string[]>([])
  const processedGiftIdsRef = useRef<Set<string>>(new Set())
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
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [showHypeCoinPopup, setShowHypeCoinPopup] = useState(false)
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

  const resolveFloatingChatProfile = useCallback(async (message: Message) => {
    const existingProfile = (message as any).user_profiles;

    const existingUsername =
      existingProfile?.username ||
      (message as any).username ||
      (message as any).user_name ||
      (message as any).display_name ||
      '';

    const badNames = new Set(['', 'unknown', 'unknown:', 'guest', 'user']);

    const hasGoodUsername =
      typeof existingUsername === 'string' &&
      existingUsername.trim() &&
      !badNames.has(existingUsername.trim().toLowerCase());

    if (hasGoodUsername && existingProfile?.username) {
      return message;
    }

    if (!message.user_id) {
      return message;
    }

    const { data: profileRow, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        username,
        display_name,
        email,
        avatar_url,
        role,
        troll_role,
        created_at,
        rgb_username_expires_at,
        glowing_username_color
      `)
      .eq('id', message.user_id)
      .maybeSingle();

    if (error) {
      console.warn('[FloatingChat] Failed to hydrate user profile:', error);
    }

    const username =
      profileRow?.username ||
      profileRow?.display_name ||
      profileRow?.email?.split('@')?.[0] ||
      existingUsername ||
      'Troll Citizen';

    return {
      ...message,
      username,
      user_name: username,
      user_avatar:
        profileRow?.avatar_url ||
        (message as any).user_avatar ||
        existingProfile?.avatar_url ||
        '',
      user_role:
        profileRow?.role ||
        (message as any).user_role ||
        existingProfile?.role ||
        null,
      user_troll_role:
        profileRow?.troll_role ||
        (message as any).user_troll_role ||
        existingProfile?.troll_role ||
        null,
      user_created_at:
        profileRow?.created_at ||
        (message as any).user_created_at ||
        existingProfile?.created_at ||
        null,
      user_rgb_expires_at:
        profileRow?.rgb_username_expires_at ||
        (message as any).user_rgb_expires_at ||
        existingProfile?.rgb_username_expires_at ||
        null,
      user_glowing_username_color:
        profileRow?.glowing_username_color ||
        (message as any).user_glowing_username_color ||
        existingProfile?.glowing_username_color ||
        null,
      user_profiles: {
        ...(existingProfile || {}),
        username,
        display_name: profileRow?.display_name || existingProfile?.display_name || null,
        email: profileRow?.email || existingProfile?.email || null,
        avatar_url: profileRow?.avatar_url || existingProfile?.avatar_url || '',
        role: profileRow?.role || existingProfile?.role || null,
        troll_role: profileRow?.troll_role || existingProfile?.troll_role || null,
        created_at: profileRow?.created_at || existingProfile?.created_at || null,
        rgb_username_expires_at:
          profileRow?.rgb_username_expires_at ||
          existingProfile?.rgb_username_expires_at ||
          null,
        glowing_username_color:
          profileRow?.glowing_username_color ||
          existingProfile?.glowing_username_color ||
          null,
      },
    } as Message;
  }, []);

  const pushFloatingChatMessage = useCallback(async (message: Message) => {
    if (!message?.id || !message?.content) return;

    const hydratedMessage = await resolveFloatingChatProfile(message);

    setFloatingChatMessages(prev => {
      if (prev.some(existing => existing.id === hydratedMessage.id)) return prev;
      return [...prev, hydratedMessage].slice(-6);
    });

    window.setTimeout(() => {
      setFloatingChatMessages(prev =>
        prev.filter(existing => existing.id !== hydratedMessage.id)
      );
    }, 9000);
  }, [resolveFloatingChatProfile]);

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
  const currentRoomKeyRef = useRef<string | null>(null)
  const viewerIdentityRef = useRef<string>(
    `viewer-${streamId}-${user?.id || Math.random().toString(36).slice(2, 9)}`,
  )
  const watchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEarnTimeRef = useRef<number>(0)
  const clickTimesRef = useRef<number[]>([])
  const blockedUntilRef = useRef<number | null>(null)
  const manualStageLeaveRef = useRef(false)

  const defaultSeatCount = Array.isArray((stream as any)?.seat_prices)
    ? (stream as any).seat_prices.length
    : 1

  const { boxCount: hookBoxCount } = useBoxCount({
    streamId: streamId || '',
    initialBoxCount: (stream as any)?.box_count || defaultSeatCount || 1,
    isHost: false,
  })

  const stagePassesHook = useStagePasses(streamId || undefined)
  const currentUserStagePass = stagePassesHook.currentUserStagePass

  const effectiveBoxCount = useMemo(() => {
    const seatCountFromPrices = Array.isArray((stream as any)?.seat_prices)
      ? (stream as any).seat_prices.length
      : 0
    const rawBoxCount = (stream as any)?.box_count ?? hookBoxCount ?? seatCountFromPrices ?? 1
    const computedBoxCount = Number(rawBoxCount) || seatCountFromPrices || 1
    const stagePassMaxIndex = stagePassesHook.stagePasses.reduce(
      (max, pass) => Math.max(max, pass.stage_index || 0),
      0,
    )
    const inferredSeatCount = stagePassMaxIndex > 0 ? stagePassMaxIndex + 1 : 0
    return Math.max(1, Math.min(Math.max(computedBoxCount, inferredSeatCount), 6))
  }, [stream, hookBoxCount, stagePassesHook.stagePasses])

  const {
    seats,
    mySession: userSeat,
    seatJoinTransition,
    joinSeat,
    leaveSeat,
  } = useStreamSeats(streamId || '', user?.id, broadcasterProfile, stream as any)

  const isUserOnStage = Boolean(
    userSeat?.status === 'active' && (userSeat?.user_id || userSeat?.guest_id),
  )

  useEffect(() => {
    if (!streamId || !user?.id) return;
    if (!currentUserStagePass) return;
    if (isUserOnStage) return;
    if (manualStageLeaveRef.current) return;
    if (!['approved', 'live'].includes(currentUserStagePass.status)) return;
    if (currentUserStagePass.stage_index == null) return;

    console.debug('[ViewerPage] auto-joining approved stage pass', {
      streamId,
      userId: user.id,
      stagePass: currentUserStagePass,
      existingSeat: userSeat,
    });

    void joinSeat(currentUserStagePass.stage_index, 0);
  }, [streamId, user?.id, currentUserStagePass, isUserOnStage, joinSeat, userSeat]);

  useEffect(() => {
    if (isUserOnStage) {
      manualStageLeaveRef.current = false;
    }
  }, [isUserOnStage]);

  useEffect(() => {
    if (!currentUserStagePass || !['approved', 'live'].includes(currentUserStagePass.status)) {
      manualStageLeaveRef.current = false;
    }
  }, [currentUserStagePass?.status]);

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

  const roomId = useMemo(() => {
    return String((stream as any)?.livekit_room_name || `stream-${streamId}` || '')
  }, [stream, streamId])

   useEffect(() => {
     if (!streamId || !user?.id) return;
     if (isUserOnStage) {
       viewerIdentityRef.current = String(user.id);
     } else {
       viewerIdentityRef.current = `viewer-${streamId}-${user.id}`;
     }
   }, [streamId, user?.id, isUserOnStage])

  const audienceName = useMemo(() => {
    return user
      ? ((user as any).username || (user as any).display_name || user.email || 'Viewer')
      : 'Viewer'
  }, [user])

  const handleLiveKitError = useCallback((err: any) => {
    const errorDetail = err?.message || err?.statusText || String(err) || 'Unknown LiveKit audience error'
    console.error('[ViewerPage] LiveKit audience error:', err, { errorDetail })
    setViewerError(errorDetail)
  }, [])

  const noopCallback = useCallback(() => {}, [])

const {
  remoteUsers,
  joinAsAudience,
  leaveRoom: leaveLiveKitRoom,
} = useLiveKitRoom({
  roomId,
  roomType: 'broadcast',
  role: isUserOnStage ? 'publisher' : 'viewer',
  publish: isUserOnStage,
  audioOnly: false,
  userName: audienceName,
  onUserJoined: noopCallback,
  onUserLeft: noopCallback,
  onError: handleLiveKitError,
})

  const remoteParticipants = useMemo(() => {
    return Array.isArray(remoteUsers) ? remoteUsers : []
  }, [remoteUsers])

  const hostParticipant = useMemo(() => {
    const exactHost = remoteParticipants.find((participant: any) => participantMatchesUser(participant, hostId))
    if (exactHost) return exactHost

    const participantWithCamera = remoteParticipants.find((participant: any) => !!getVideoTrackFromParticipant(participant))
    return participantWithCamera || null
  }, [remoteParticipants, hostId])

  const isOfficer = Boolean(
    profile?.role === 'admin' ||
      (profile as any)?.is_admin ||
      profile?.role === 'officer' ||
      (profile as any)?.is_troll_officer ||
      (profile as any)?.is_lead_officer,
  )

  const activeSeats = useMemo(() => {
    return Object.values(seats || {}).filter(
      (seat: any) => seat?.status === 'active' && (seat?.user_id || seat?.guest_id),
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

  const { earnHypeCoinFromWatch, hypeCoins } = useHypeCoins()

  const onGift = useCallback((userId?: string | null) => {
    setGiftRecipientId(userId || hostId || null)
    setIsGiftModalOpen(true)
  }, [hostId])

  const handleOpenUserAction = useCallback((info: { userId: string; username?: string; role?: string; createdAt?: string }) => {
    setUserActionTarget(info)
  }, [])

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

    if (isStreamEnded(data as Stream)) {
      navigate(`/broadcast/summary/${streamId}`, { replace: true })
      return
    }

    setStream(data as Stream)
    setViewerCount(Number((data as any).current_viewers || 0))
  }, [streamId, navigate])

  const handleLeaveSeat = useCallback(async () => {
    manualStageLeaveRef.current = true
    await leaveSeat()
    navigate(location.pathname, { replace: true })
  }, [leaveSeat, navigate, location.pathname])

  const handleToggleChat = useCallback(() => setIsChatOpen((prev) => !prev), [])

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

    // record this tap and check rate
    const times = clickTimesRef.current
    times.push(now)
    const cutoff = now - 1000
    while (times.length && times[0] < cutoff) times.shift()

    const tapsPerSec = times.length
    if (tapsPerSec >= 20) {
      // suspected auto-clicking: block for 1 minute
      blockedUntilRef.current = now + 60 * 1000
      clickTimesRef.current = []
      toast.error('Rate limited for 1 minute due to suspected auto-clicking')
      return
    }

    const likeIncrement = 2 // allow 2 likes per tap

    setStream((prev: any) =>
      prev
        ? {
            ...prev,
            total_likes: Number(prev.total_likes || 0) + likeIncrement,
          }
        : prev,
    )

    try {
      await supabase
        .from('streams')
        .update({ total_likes: Number((stream as any)?.total_likes || 0) + likeIncrement })
        .eq('id', streamId)
    } catch (err) {
      console.warn('[ViewerPage] like update failed:', err)
    }
  }, [streamId, user?.id, stream])

  const handleLeave = useCallback(async () => {
    await leaveLiveKitRoom().catch(() => {})
    hasJoinedAudienceRef.current = false
    joiningAudienceRef.current = false
    currentRoomKeyRef.current = null
    navigate('/')
  }, [leaveLiveKitRoom, navigate])

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

  useEffect(() => {
    if (!streamId || !user?.id || !stream || !isActive || hostId === user.id) {
      if (watchTimerRef.current) {
        clearTimeout(watchTimerRef.current)
        watchTimerRef.current = null
      }
      return
    }

    const startWatchTimer = () => {
      const now = Date.now()
      const timeSinceLastEarn = now - lastEarnTimeRef.current
      const timeUntilNextEarn = Math.max(0, 300000 - timeSinceLastEarn)

      watchTimerRef.current = setTimeout(() => {
        earnHypeCoinFromWatch(streamId).then((result) => {
          if (result?.success && result.earned_amount > 0) {
            setShowHypeCoinPopup(true)
            lastEarnTimeRef.current = Date.now()
          }
        })
        startWatchTimer()
      }, Math.min(300000, timeUntilNextEarn))
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (watchTimerRef.current) {
          clearTimeout(watchTimerRef.current)
          watchTimerRef.current = null
        }
      } else if (!watchTimerRef.current) {
        startWatchTimer()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    if (!document.hidden) startWatchTimer()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (watchTimerRef.current) {
        clearTimeout(watchTimerRef.current)
        watchTimerRef.current = null
      }
    }
  }, [streamId, user?.id, stream, isActive, hostId, earnHypeCoinFromWatch])

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

      if (isStreamEnded(data as Stream)) {
        navigate(`/broadcast/summary/${streamId}`, { replace: true })
        return
      }

      setStream(data as Stream)
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

  useEffect(() => {
    if (!streamId) return
    const interval = window.setInterval(() => void refreshStream(), 2500)
    return () => window.clearInterval(interval)
  }, [streamId, refreshStream])

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
      onViewerCount: (count: number) => setViewerCount(count),
      onParticipant: (event: any) => {
        if (event.eventType !== 'UPDATE' || !event.new || !user?.id) return
        const participant = event.new
        if (participant.user_id !== user.id || participant.removed !== true || participant.stream_id !== streamId) return

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
        toast.error(`You were kicked from this broadcast: ${kickData.reason}`)
        navigate('/', { replace: true })
      },
      onStream: (event: any) => {
        const next = event?.new || event
        if (!next) return

        if (isStreamEnded(next as Stream)) {
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
      onStreamUpdate: (next: any) => {
        if (!next) return

        if (isStreamEnded(next as Stream)) {
          navigate(`/broadcast/summary/${streamId}`, { replace: true })
          return
        }

        setStream((prev) =>
          prev
            ? ({
                ...(prev as any),
                ...(next as any),
                total_likes: typeof next.total_likes !== 'undefined' ? next.total_likes : (prev as any).total_likes,
              } as Stream)
            : (next as Stream),
        )

        if (typeof next.current_viewers !== 'undefined') {
          setViewerCount(Number(next.current_viewers || 0))
        }
      },
    } as any,
  )

  useEffect(() => {
    return () => {
      console.log('[ViewerPage] unmount cleanup: leaving LiveKit audience')
      leaveLiveKitRoom().catch(() => {})
    }
  }, [leaveLiveKitRoom])

  useEffect(() => {
    if (seatJoinTransition && user?.id) {
      viewerIdentityRef.current = user.id
    }
  }, [seatJoinTransition, user?.id])

   useEffect(() => {
     if (!streamId || !roomId || !isActive) return

     if (user?.id) {
       const kickKey = getKickStorageKey(streamId, user.id)
       const kickRaw = localStorage.getItem(kickKey)
       const kickData = parseKickData(kickRaw)

       if (isKickBanActive(kickData)) {
         const timeSinceKick = Date.now() - kickData.timestamp
         const remainingMs = Math.max(KICK_BAN_DURATION_MS - timeSinceKick, 0)
         const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))

         toast.error(
           `You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${
             hoursRemaining === 1 ? '' : 's'
           }.`,
         )

         leaveLiveKitRoom().catch(() => {})
         hasJoinedAudienceRef.current = false
         joiningAudienceRef.current = false
         currentRoomKeyRef.current = null
         navigate('/', { replace: true })
         return
       }

       if (kickRaw && !isKickBanActive(kickData)) {
         localStorage.removeItem(kickKey)
       }
     }

     // When user is on stage, we don't join as audience
     // The LiveKit connection should be handled by the hook with publisher role
     if (isUserOnStage) {
       // If we were previously joined as audience, we should leave
       if (hasJoinedAudienceRef.current) {
         leaveLiveKitRoom().catch(() => {})
         hasJoinedAudienceRef.current = false
         joiningAudienceRef.current = false
         currentRoomKeyRef.current = null
       }
       return
     }

     const audienceRoomKey = `${streamId}:${roomId}`
     if (hasJoinedAudienceRef.current && currentRoomKeyRef.current === audienceRoomKey) return
     if (joiningAudienceRef.current) return

     joiningAudienceRef.current = true
     currentRoomKeyRef.current = audienceRoomKey

     const identity = viewerIdentityRef.current

     joinAsAudience(identity)
       .then(() => {
         hasJoinedAudienceRef.current = true
         setViewerError(null)
         console.log('[ViewerPage] LiveKit audience joined:', { streamId, roomId, identity })
       })
       .catch((err: any) => {
         const errorDetail = err?.message || err?.statusText || String(err) || 'LiveKit connection failed'
         console.warn('[ViewerPage] joinAsAudience failed:', err, { errorDetail })
         setViewerError(errorDetail)
       })
       .finally(() => {
         joiningAudienceRef.current = false
       })
   }, [streamId, roomId, isActive, isUserOnStage, joinAsAudience, leaveLiveKitRoom, user?.id, navigate])

  const stageSlots = useMemo(() => {
    const liveSeats = activeSeats.slice(0, Math.max(0, effectiveBoxCount - 1))
    const emptyCount = Math.max(1, effectiveBoxCount - 1 - liveSeats.length)
    return { liveSeats, emptyCount }
  }, [activeSeats, effectiveBoxCount])

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

  return (
    <GiftSystemProvider streamId={streamId} defaultReceiverId={hostId}>
      <ErrorBoundary>
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
            <BroadcastNeonHeader
              stream={stream}
              broadcasterProfile={
                broadcasterProfile
                  ? {
                      username: broadcasterProfile.username,
                      avatar_url: broadcasterProfile.avatar_url,
                      display_name: broadcasterProfile.display_name,
                    }
                  : null
              }
              isHost={false}
              liveViewerCount={viewerCount}
              handleLike={handleLike}
              onGift={() => onGift(hostId)}
              onShare={handleShare}
              onEndStream={handleLeave}
              coinBalance={(profile as any)?.troll_coins ?? 0}
              onOpenCoinStore={() => toast.info('Coin Store opens from the viewer action bar.')}
              isLive={isActive}
              streamStartedAt={(stream as any).started_at}
            />
          )}

          <main
            className={cn(
              'relative z-10 grid flex-1 min-h-0 gap-4 px-5 py-4',
              isMobileViewer ? 'grid-cols-1 overflow-y-auto pb-28' : 'overflow-hidden',
            )}
            style={
              isMobileViewer
                ? undefined
                : { gridTemplateColumns: 'minmax(520px, 1.2fr) minmax(380px, 0.82fr) 360px' }
            }
          >
            <section className={cn('relative min-h-[520px] overflow-hidden', theme.hostVideoPanel)}>

                <RemoteVideoSurface
                  participant={hostParticipant}
                  mirror={false}
                  className="absolute inset-0"
                  onTap={handleLike}
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_42%),#030611]">
                    <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-6 text-center shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
                      {broadcasterProfile?.avatar_url ? (
                        <img
                          src={broadcasterProfile.avatar_url}
                          alt={hostName}
                          className="mx-auto h-24 w-24 rounded-full border-2 border-cyan-300/60 object-cover shadow-[0_0_28px_rgba(34,211,238,0.45)]"
                        />
                      ) : (
                        <Video className="mx-auto h-12 w-12 text-cyan-200/70" />
                      )}
                      <div className="mt-4 text-lg font-black">{hostName}</div>
                      <div className="mt-2 text-sm text-slate-300">
                        {isActive ? 'Camera starting…' : 'Waiting for broadcast…'}
                      </div>
                    </div>
                  </div>
                }
              />

              {/* Floating Chat Overlay (Stage/Video anchor) */}
              <FloatingChatOverlay
                messages={floatingChatMessages}
                streamMods={streamMods}
                hostId={hostId}
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />

              <div className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)] backdrop-blur-xl">
                <Crown className="h-4 w-4" />
                Host
              </div>

              <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-black shadow-inner backdrop-blur-xl',
                    isActive
                      ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-emerald-500/10'
                      : 'border-yellow-400/30 bg-yellow-500/15 text-yellow-200 shadow-yellow-500/10',
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
                  {isActive ? 'LIVE' : 'STARTING'}
                </span>
              </div>

              {viewerError && (
                <div className="absolute inset-x-4 top-16 z-30 rounded-2xl border border-red-400/35 bg-gradient-to-r from-red-950/90 to-red-900/80 px-4 py-3 text-sm font-bold text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.25)] backdrop-blur-2xl">
                  {viewerError}
                </div>
              )}

              <div className="absolute bottom-28 left-6 z-20 flex items-center gap-2">
                {broadcasterProfile?.avatar_url ? (
                  <img
                    src={broadcasterProfile.avatar_url}
                    alt={hostName}
                    className="h-9 w-9 rounded-md border border-white/20 object-cover shadow-[0_0_18px_rgba(45,212,191,0.28)]"
                  />
                ) : (
                  <div className="grid h-9 w-9 place-items-center rounded-md border border-white/20 bg-white/10">
                    <Crown className="h-5 w-5 text-cyan-200" />
                  </div>
                )}
                <span className="text-base font-black text-white">{hostName}</span>
                {broadcasterProfile?.is_verified && <BadgeCheck className="h-5 w-5 text-purple-400" />}
              </div>

              <div className="absolute bottom-6 left-6 z-20 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onGift(hostId)}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black backdrop-blur-xl', theme.purpleButton)}
                >
                  <Gift className="h-4 w-4" />
                  Gift
                </button>
                <button
                  onClick={handleShare}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black backdrop-blur-xl', theme.cyanButton)}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            </section>

            <section className={cn('flex min-h-[520px] flex-col overflow-hidden', theme.guestsPanel)}>
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                  <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm font-bold text-white/70 backdrop-blur">
                    <Users className="h-4 w-4 text-white/45" />
                    Stage Guests
                  </span>
                  <span className="flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  On Stage {activeSeats.length}/{Math.max(1, effectiveBoxCount - 1)}
                </span>
              </div>

                <div className="grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2">
                  {stageSlots.liveSeats.map((seat: any, index: number) => {
                  const seatUserId = seat?.user_id || seat?.guest_id
                  const seatProfile = seat?.user_profile || seat?.profile || {}
                  const username = getDisplayName(seatProfile, `Stage Guest ${index + 1}`)
                  const avatar = seatProfile?.avatar_url
                  const stageParticipant = remoteParticipants.find((participant: any) =>
                    participantMatchesUser(participant, seatUserId),
                  )

                  return (
                    <div
                      key={seat?.id || seatUserId || `seat-${index}`}
                      className="relative min-h-[210px] overflow-hidden rounded-2xl border border-purple-400/40 bg-gradient-to-b from-[#160d2b] to-[#070711] shadow-[0_0_24px_rgba(168,85,247,0.25)]"
                    >
                      <RemoteVideoSurface
                        participant={stageParticipant}
                        className="absolute inset-0"
                        onTap={handleLike}
                        fallback={
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#160d2b] to-[#070711] p-4">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={username}
                                className="h-20 w-20 rounded-full border-2 border-purple-400 object-cover shadow-[0_0_22px_rgba(168,85,247,0.45)]"
                              />
                            ) : (
                              <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-purple-400/50 bg-black/50 text-cyan-200">
                                <Users className="h-9 w-9" />
                              </div>
                            )}
                            <p className="mt-3 max-w-full truncate text-sm font-black text-cyan-100">{username}</p>
                            <p className="mt-1 text-xs text-slate-400">Camera starting…</p>
                          </div>
                        }
                      />

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

                      <div className="absolute left-3 top-3 z-10">
                        <span className="rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[11px] font-black text-cyan-300 shadow-[0_0_12px_rgba(45,212,191,0.25)]">
                          Stage Guest
                        </span>
                        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-black text-emerald-400">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                          On Stage
                        </p>
                      </div>

                      <button
                        onClick={() => onGift(seatUserId)}
                        className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-purple-500/20 hover:text-purple-200"
                        aria-label="Gift stage guest"
                      >
                        <Gift className="h-4 w-4" />
                      </button>

                      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[15]">
                        <UserStatsOrb
                          userId={seatUserId}
                          username={username}
                          streamId={streamId}
                          isSeatUser={isUserOnStage}
                        />
                      </p>

                      <p className="absolute bottom-3 left-3 right-3 z-10 truncate text-sm font-black text-cyan-100 drop-shadow">
                        {username}
                      </p>
                    </div>
                  )
                })}

                {Array.from({ length: stageSlots.emptyCount }).map((_, index) => {
                  const slotIndex = stageSlots.liveSeats.length + index + 1
                  const openPass = stagePassesHook.stagePasses.find(
                    (p) => p.status === 'open' && p.stage_index === slotIndex,
                  ) || stagePassesHook.stagePasses.find((p) => p.status === 'open')
                  const canJoinAfterApproval = currentUserStagePass?.status === 'approved' || currentUserStagePass?.status === 'live'
                  const isPendingRequest = currentUserStagePass?.status === 'requested'
                  const isDisabled = (stream as any)?.are_seats_locked || isUserOnStage || isPendingRequest

                  return (
                    <button
                      key={`empty-${index}`}
                      onClick={async () => {
                        if (!user?.id) {
                          toast.error('Login to request a stage spot')
                          return
                        }
                        if ((stream as any)?.are_seats_locked) {
                          toast.error('Stage is locked right now')
                          return
                        }
                        if (isUserOnStage) return

                        if (canJoinAfterApproval && currentUserStagePass?.stage_index) {
                          manualStageLeaveRef.current = false
                          await joinSeat(currentUserStagePass.stage_index, 0)
                          return
                        }

                        if (isPendingRequest) {
                          toast('Stage pass request pending')
                          return
                        }

                        if (!openPass) {
                          console.debug('[ViewerPage] no open stage pass found', { streamId, userId: user?.id, availablePasses: stagePassesHook.stagePasses })
                          toast.error('Seats Are Temp Disabled Until 5-25-2025')
                          return
                        }

                        console.debug('[ViewerPage] requesting stage pass', { streamId, userId: user?.id, stagePassId: openPass.id, stageIndex: openPass.stage_index })
                        const result = await stagePassesHook.requestStagePass(openPass.id)
                        if (!result.success) {
                          toast.error(result.error || 'Failed to request stage pass')
                        } else {
                          toast.success('Stage pass request sent')
                        }
                      }}
                      disabled={isDisabled}
                      className={cn('min-h-[210px] rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40', theme.emptySlot)}
                    >
                      <div className="mx-auto mt-10 grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-white/5">
                        <Plus className="h-8 w-8" />
                      </div>
                      <p className="mt-5 text-base font-bold text-slate-300">
                        {isUserOnStage
                          ? 'You are on stage'
                          : canJoinAfterApproval
                            ? 'Join Stage Spot'
                            : isPendingRequest
                              ? 'Request Pending'
                              : 'Seats Are Temp Disabled Until 5-25-2026'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {isUserOnStage
                          ? 'Leave first to switch spots'
                          : canJoinAfterApproval
                            ? 'Approved — join now'
                            : isPendingRequest
                              ? 'Your request is waiting for approval'
                              : 'ask to join the broadcast'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            {(!isMobileViewer || isChatOpen) && (
              <aside className={theme.chatPanel}>
                <div className="grid grid-cols-3 border-b border-white/10">
                  {['Chat', 'Gifts', 'Top Fans'].map((tab, tabIndex) => {
                    const tabKey = tab.toLowerCase().replace(/\s+/g, '-') as 'chat' | 'gifts' | 'top-fans'
                    const active = chatTab === tabKey
                    return (
                      <button
                        key={tab}
                        onClick={() => setChatTab(tabKey)}
                        className={cn(
                          'relative h-16 text-sm font-black transition-colors',
                          active ? 'text-white' : 'text-white/60 hover:text-white/80',
                        )}
                        type="button"
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
                    <BroadcastChat
                      streamId={streamId}
                      hostId={hostId}
                      isHost={false}
                      isViewer={true}
                      isGuest={!user}
                      isBattleActive={(stream as any).is_battle}
                      isChatOpen={isChatOpen}
                      seats={seats}
                      broadcasterProfile={broadcasterProfile}
                      onFloatingMessage={pushFloatingChatMessage}
                      onMessageSent={() => {}}
                    />
                  ) : chatTab === 'gifts' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 text-sm text-slate-200">
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
                                  <div className="text-sm font-bold text-white truncate">
                                    {gift.sender_username || 'Anonymous'}
                                  </div>
                                  <div className="text-xs text-slate-400 truncate">
                                    Sent {gift.quantity || 1} {gift.gift_name || 'gift'}
                                  </div>
                                </div>
                                <div className="text-xs font-semibold text-cyan-300">
                                  {gift.coins_amount?.toLocaleString() || gift.amount?.toLocaleString() || '0'} coins
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 text-sm text-slate-200">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Top Fans</div>
                      {isTopFansLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">Loading top fans...</div>
                      ) : topGifters.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">No fan activity yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {topGifters.map((fan) => (
                            <div key={fan.sender_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold">
                                    {fan.sender_username?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-white">{fan.sender_username || 'Troll Citizen'}</div>
                                    <div className="truncate text-xs text-slate-400">Last gift: {new Date(fan.last_gift_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                                  </div>
                                </div>
                                <div className="text-xs font-semibold text-cyan-300">{fan.total_gift_coins.toLocaleString()} coins</div>
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

          <div className={cn('relative z-20 shrink-0 border-t border-white/10 px-4 py-3', theme.bottomBar)}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(168,85,247,0.12),transparent)]" />
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
              <div className="hidden items-center gap-5 text-sm font-semibold text-slate-400 md:flex">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Viewer mode
                </span>
                <span className="text-white/15">•</span>
                <span>{viewerCount.toLocaleString()} watching</span>
                <span className="text-white/15">•</span>
                <span className="font-bold text-emerald-400">{Number(hypeCoins || 0).toLocaleString()} Hype Coins</span>
              </div>

              <div className="flex w-full items-center justify-end gap-2 md:w-auto">
                <button
                  onClick={handleToggleChat}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black', theme.glassButton)}
                >
                  <MessageSquare className="h-4 w-4" />
                  {isChatOpen ? 'Hide Chat' : 'Chat'}
                </button>
                <button
                  onClick={handleLike}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black', theme.pinkButton)}
                >
                  <Heart className="h-4 w-4" />
                  Like
                </button>
                <button
                  onClick={() => onGift(hostId)}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black', theme.purpleButton)}
                >
                  <Gift className="h-4 w-4" />
                  Gift
                </button>
                <button
                  onClick={isUserOnStage ? handleLeaveSeat : handleLeave}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black', theme.danger)}
                >
                  <LogOut className="h-4 w-4" />
                  {isUserOnStage ? 'Leave Stage' : 'Leave'}
                </button>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 z-30">
            <div className="pointer-events-auto">
              <GiftBoxModal
                isOpen={isGiftModalOpen}
                onClose={() => {
                  setIsGiftModalOpen(false)
                  setGiftRecipientId(null)
                }}
                recipientId={giftRecipientId || hostId}
                streamId={streamId}
                broadcasterId={hostId}
                activeUserIds={activeUserIds}
                userProfiles={userProfiles}
              />

              {userActionTarget && (
                <UserActionModal
                  onClose={() => setUserActionTarget(null)}
                  userId={userActionTarget.userId}
                  streamId={streamId || ''}
                  username={userActionTarget.username}
                  role={userActionTarget.role}
                  createdAt={userActionTarget.createdAt}
                  isHost={false}
                  isModerator={false}
                  isOfficer={isOfficer}
                  onGift={() => onGift(userActionTarget.userId)}
                />
              )}
            </div>
          </div>
        </div>
      </ErrorBoundary>

      <HypeCoinPopup
        isVisible={showHypeCoinPopup}
        onDismiss={() => setShowHypeCoinPopup(false)}
      />
    </GiftSystemProvider>
  )
}

export default ViewerPage
