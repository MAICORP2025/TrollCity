import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import type { Stream } from '../../types/broadcast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

import { Room, RoomEvent, LocalAudioTrack, LocalVideoTrack } from 'livekit-client'

import StreamLayout from '../../components/broadcast/StreamLayout'
import BroadcastChat from '../../components/broadcast/BroadcastChat'
import BroadcastHeader from '../../components/broadcast/BroadcastHeader'
import BroadcastControls from '../../components/broadcast/BroadcastControls'
import BroadcastGrid from '../../components/broadcast/BroadcastGrid'
import ErrorBoundary from '../../components/ErrorBoundary'
import UserActionModal from '../../components/broadcast/UserActionModal'
import GiftBoxModal from '../../components/broadcast/GiftBoxModal'

import { GiftSystemProvider } from '../../lib/hooks/useGiftSystem'
import { useStreamSeats } from '../../hooks/useStreamSeats'
import { useStreamRealtime } from '../../hooks/useStreamRealtime'
import { useBoxCount } from '../../hooks/useBoxCount'
import { useIsMobile } from '../../hooks/useIsMobile'
import useLiveKitRoom from '../../hooks/useLiveKitRoom'


function getDisplayName(profile: any, fallback = 'Troll City') {
  return (
    profile?.username ||
    profile?.display_name ||
    profile?.email?.split?.('@')?.[0] ||
    fallback
  )
}

function isStreamActive(stream: Stream | null): boolean {
  if (!stream) return false

  const status = (stream as any).status
  const isLive = (stream as any).is_live

  return status === 'starting' || status === 'live' || isLive === true
}

function isStreamEnded(stream: Stream | null): boolean {
  if (!stream) return true

  const status = (stream as any).status
  const endedAt = (stream as any).ended_at

  return status === 'ended' || endedAt != null
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
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [userActionTarget, setUserActionTarget] = useState<{ userId: string; username?: string; role?: string; createdAt?: string } | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)

  const defaultSeatCount = Array.isArray((stream as any)?.seat_prices)
    ? (stream as any).seat_prices.length
    : 1

  const previousRoomKeyRef = useRef<string | null>(null)

  const { boxCount: hookBoxCount } = useBoxCount({
    streamId: streamId || '',
    initialBoxCount: (stream as any)?.box_count || defaultSeatCount || 1,
    isHost: false,
  })

  const effectiveBoxCount = useMemo(() => {
    const seatCountFromPrices = Array.isArray((stream as any)?.seat_prices)
      ? (stream as any).seat_prices.length
      : 0

    const rawBoxCount =
      (stream as any)?.box_count ?? hookBoxCount ?? seatCountFromPrices ?? 1

    const computedBoxCount = Number(rawBoxCount) || seatCountFromPrices || 1

    return Math.max(1, Math.min(computedBoxCount, 6))
  }, [stream, hookBoxCount])

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

  const isActive = isStreamActive(stream)

  const onGift = useCallback((userId: string) => {
    setGiftRecipientId(userId)
    setIsGiftModalOpen(true)
  }, [])

  const handleOpenUserAction = useCallback((info: { userId: string; username?: string; role?: string; createdAt?: string }) => {
    setUserActionTarget(info)
  }, [])

  const roomId = useMemo(() => {
    return String((stream as any)?.livekit_room_name || streamId || '')
  }, [stream, streamId])

  const viewerIdentityRef = useRef<string>(
    `viewer-${streamId}-${user?.id || Math.random().toString(36).slice(2, 9)}`,
  )

  useEffect(() => {
    viewerIdentityRef.current = `viewer-${streamId}-${
      user?.id || Math.random().toString(36).slice(2, 9)
    }`
  }, [streamId, user?.id])

  const audienceName = useMemo(() => {
    return user
      ? ((user as any).username || (user as any).display_name || user.email || 'Viewer')
      : 'Viewer'
  }, [user])

  const handleLiveKitError = useCallback((err: any) => {
    const errorDetail = err?.message || err?.statusText || String(err) || 'Unknown LiveKit audience error';
    console.error('[ViewerPage] LiveKit audience error:', err, { errorDetail });
    setViewerError(errorDetail);
  }, [])

  const noopCallback = useCallback(() => {}, [])

  const {
    remoteUsers,
    joinAsAudience,
    leaveRoom: leaveLiveKitRoom,
  } = useLiveKitRoom({
    roomId,
    roomType: 'broadcast',
    role: 'viewer',
    publish: false,
    audioOnly: false,
    userName: audienceName,
    onUserJoined: noopCallback,
    onUserLeft: noopCallback,
    onError: handleLiveKitError,
  })

  const viewerLocalTracks = useMemo(() => [null, null] as [null, null], [])

   const isOfficer = !!(profile?.role === 'admin' || profile?.is_admin || profile?.role === 'officer' || (profile as any)?.is_troll_officer || (profile as any)?.is_lead_officer);

  const activeUserIds = useMemo(() => {
    if (!stream || !seats) return [];
    const ids: string[] = [];

    Object.values(seats).forEach((seat: any) => {
      if (seat?.user_id && seat.user_id !== (stream as any).user_id) {
        ids.push(seat.user_id);
      }
      if (seat?.guest_id && seat.guest_id !== (stream as any).user_id) {
        ids.push(seat.guest_id);
      }
    });

    return ids;
  }, [seats, stream]);

  const userProfiles = useMemo(() => {
    if (!stream || !seats) return {};
    const profiles: Record<string, { username: string; avatar_url?: string }> = {};
    
    if (broadcasterProfile) {
      profiles[(stream as any).user_id] = {
        username: broadcasterProfile.username || 'Broadcaster',
        avatar_url: broadcasterProfile.avatar_url,
      };
    }
    
    Object.values(seats).forEach((seat: any) => {
      const userId = seat?.user_id || seat?.guest_id;
      if (userId && seat.user_profile) {
        profiles[userId] = {
          username: seat.user_profile.username || 'User',
          avatar_url: seat.user_profile.avatar_url,
        };
      }
    });
    
    return profiles;
  }, [seats, broadcasterProfile, stream]);

  const hasJoinedAudienceRef = useRef(false)
  const joiningAudienceRef = useRef(false)
  const currentRoomKeyRef = useRef<string | null>(null)
  const wasStreamEndedRef = useRef(false)

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

    if (data) {
      if (isStreamEnded(data as Stream)) {
        navigate(`/broadcast/summary/${streamId}`, { replace: true })
        return
      }

      setStream(data as Stream)
      setViewerCount(Number((data as any).current_viewers || 0))
    }
  }, [streamId, navigate])

  const handleLeaveSeat = useCallback(async () => {
    await leaveSeat()
    navigate(location.pathname, { replace: true })
  }, [leaveSeat, navigate, location.pathname])

  const handleToggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev)
  }, [])

  const handleLike = useCallback(async () => {
    if (!streamId || !user?.id) {
      toast.success('Login to like this broadcast')
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

    try {
      await supabase
        .from('streams')
        .update({
          total_likes: Number((stream as any)?.total_likes || 0) + 1,
        })
        .eq('id', streamId)
    } catch (err) {
      console.warn('[ViewerPage] like update failed:', err)
    }
  }, [streamId, user?.id, stream])

  const handleLeave = useCallback(async () => {
    navigate('/')
  }, [navigate])

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
          .select(
            'id, username, display_name, email, avatar_url, troll_coins, paid_coin_balance, free_coin_balance, total_earned_coins',
          )
          .eq('id', (data as any).user_id)
          .maybeSingle()

        if (hostProfileError) {
          console.warn('[ViewerPage] host profile fetch failed:', hostProfileError)
        }

        if (!cancelled && hostProfile) {
          setBroadcasterProfile(hostProfile)
        }
      }

      if (!cancelled) {
        setStreamLoaded(true)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [streamId, navigate])

  useEffect(() => {
    if (!streamId) return

    const interval = window.setInterval(() => {
      void refreshStream()
    }, 2500)

    return () => window.clearInterval(interval)
  }, [streamId, refreshStream])

  useStreamRealtime(
    streamId || '',
    {
      onGift: () => {},
      onViewerCount: (count: number) => setViewerCount(count),
      onParticipant: (event: any) => {
        // Check if current user was kicked from this stream
        if (event.eventType === 'UPDATE' && event.new && user?.id) {
          const participant = event.new
          if (participant.user_id === user.id && participant.removed === true && participant.stream_id === streamId) {
            // User was kicked - store kick timestamp and redirect
            const kickKey = `kick_${streamId}_${user.id}`
            const kickData = {
              timestamp: Date.now(),
              streamId: streamId,
              reason: participant.removed_reason || 'Kicked by broadcaster'
            }
            localStorage.setItem(kickKey, JSON.stringify(kickData))

            // Leave the stream immediately
            leaveLiveKitRoom().catch(() => {})
            hasJoinedAudienceRef.current = false
            joiningAudienceRef.current = false
            currentRoomKeyRef.current = null

            // Show kick message and redirect to home
            toast.error(`You were kicked from this broadcast: ${kickData.reason}`)
            navigate('/', { replace: true })
          }
        }
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
                    box_count:
                        typeof next.box_count !== 'undefined'
                            ? next.box_count
                            : (prev as any).box_count,
                    seat_price:
                        typeof next.seat_price !== 'undefined'
                            ? next.seat_price
                            : (prev as any).seat_price,
                    seat_prices:
                        typeof next.seat_prices !== 'undefined'
                            ? next.seat_prices
                            : (prev as any).seat_prices,
                    total_likes:
                        typeof next.total_likes !== 'undefined'
                            ? next.total_likes
                            : (prev as any).total_likes,
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
                        total_likes:
                            typeof next.total_likes !== 'undefined'
                                ? next.total_likes
                                : (prev as any).total_likes,
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
  }, [])

  // Seat join handoff: audience disconnects once → publisher reconnects with user.id
  const isSeatTransitioningRef = useRef(false)

  // When a seat transition is active, use real user.id as LiveKit identity
  useEffect(() => {
    if (seatJoinTransition && user?.id) {
      viewerIdentityRef.current = user.id
    }
  }, [seatJoinTransition, user?.id])

  const fetchPublisherToken = useCallback(async (publisherUserId: string) => {
    const tokenResponse = await fetch('/api/livekit-token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantType: 'seat',
          streamId,
          roomName: `stream-${streamId}`,
          userId: publisherUserId,
          seatIndex: seatJoinTransition?.seatIndex ?? userSeat?.seat_index ?? 0,
          requestId: seatJoinTransition?.requestId ?? '',
        })
      }
     )
    if (!tokenResponse.ok) throw new Error('Failed to get LiveKit publisher token')
    const { token, url } = await tokenResponse.json()
    return { token, url }
  }, [streamId])

   // Note: disconnectAudienceAndStartPublisher removed - seat queue system no longer supported

   // ── Audience join ───
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
        console.log('[ViewerPage] LiveKit audience joined:', {
          streamId,
          roomId,
          identity,
        })
      })
      .catch((err: any) => {
        const errorDetail = err?.message || err?.statusText || String(err) || 'LiveKit connection failed';
        console.warn('[ViewerPage] joinAsAudience failed:', err, { errorDetail });
        setViewerError(errorDetail);
      })
      .finally(() => {
        joiningAudienceRef.current = false
      })
  }, [
    streamId,
    roomId,
    isActive,
    joinAsAudience,
    user?.id,
    navigate,
    leaveLiveKitRoom,
  ])
  const streamLayoutStats = useMemo(() => {
    return {
      viewers: viewerCount,
      likes: Number((stream as any)?.total_likes || 0),
      coinsEarned: Number((stream as any)?.total_gifts_coins || 0),
      onStage: Object.values(seats || {}).filter(
        (seat: any) => seat?.status === 'active' && (seat?.user_id || seat?.guest_id),
      ).length,
      userOnStage: isUserOnStage,
    }
  }, [viewerCount, stream, seats, isUserOnStage])

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-black text-white">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  if (!stream || !streamLoaded) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="text-center text-white">Loading...</div>
      </div>
    )
  }

  return (
    <GiftSystemProvider streamId={streamId} defaultReceiverId={(stream as any).user_id}>
      <ErrorBoundary>
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
              isHost={false}
              liveViewerCount={viewerCount}
              handleLike={handleLike}
              boxCount={effectiveBoxCount}
              onAddBox={undefined}
              onRemoveBox={undefined}
              onClose={handleLeave}
              broadcasterProfile={broadcasterProfile}
            />
          }
          video={
            <div className="relative min-h-0 h-full w-full flex-1 overflow-hidden bg-black">
              {viewerError && (
                <div className="absolute inset-x-4 top-4 z-40 rounded-2xl border border-red-400/30 bg-red-950/80 px-4 py-3 text-sm font-bold text-red-100 shadow-2xl backdrop-blur">
                  {viewerError}
                </div>
              )}

              <BroadcastGrid
                stream={stream}
                seats={seats}
                isHost={false}
                isModerator={false}
                maxItems={effectiveBoxCount}
                boxCount={effectiveBoxCount}
                onGift={onGift}
                onGiftAll={() => {}}
                onJoinSeat={undefined}
                broadcasterProfile={broadcasterProfile}
                remoteUsers={remoteUsers}
                localUserId={user?.id || ''}
                onOpenUserAction={handleOpenUserAction}
                localTracks={viewerLocalTracks as any}
                toggleCamera={() => {}}
                toggleMicrophone={() => {}}
                streamStatus={(stream as any).status}
              />

              {isActive && (!remoteUsers || remoteUsers.length === 0) && !viewerError && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20 text-white">
                  <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/60 p-5 text-center shadow-2xl shadow-cyan-500/10 backdrop-blur">
                    <div className="text-lg font-black">Connecting to LiveKit broadcast...</div>
                    <div className="mt-2 text-sm text-slate-300">
                      Waiting for the broadcaster track to arrive.
                    </div>
                  </div>
                </div>
              )}

              {!isActive && !viewerError && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black text-white">
                  <div className="rounded-3xl border border-cyan-400/20 bg-white/5 p-6 text-center shadow-2xl shadow-cyan-500/10">
                    <div className="text-lg font-black">Waiting for broadcaster</div>
                    <div className="mt-2 text-sm text-slate-300">
                      The stream has not started yet.
                    </div>
                  </div>
                </div>
              )}
            </div>
          }
          controls={
            <BroadcastControls
              stream={stream}
              isHost={false}
              isModerator={false}
              isOnStage={isUserOnStage}
              chatOpen={isChatOpen}
              toggleChat={handleToggleChat}
              onGiftHost={() => setIsGiftModalOpen(true)}
              onLeave={isUserOnStage ? handleLeaveSeat : handleLeave}
              onShare={handleShare}
              requiredBoxes={effectiveBoxCount}
              onBoxCountUpdate={undefined}
              onStreamEnd={undefined}
              handleLike={handleLike}
              toggleBattleMode={() => {}}
              liveViewerCount={viewerCount}
              localTracks={null}
              toggleCamera={() => {}}
              toggleMicrophone={() => {}}
              onPinProduct={undefined}
              onRgbToggle={undefined}
              isMicOn={false}
              isCamOn={false}
              boxCount={effectiveBoxCount}
              setBoxCount={undefined}
              onRefreshStream={refreshStream}
              onStartBattle={undefined}
              isBattleActive={Boolean((stream as any).is_battle)}
              isLive={isActive}
              activeViewers={[]}
            />
          }
          overlays={
            null
          }
          chat={
            <BroadcastChat
              streamId={streamId}
              hostId={(stream as any).user_id}
              isHost={false}
              isViewer={true}
              isGuest={!user}
              isBattleActive={(stream as any).is_battle}
              isChatOpen={isChatOpen}
              seats={seats}
              broadcasterProfile={broadcasterProfile}
              onMessageSent={() => {}}
            />
          }
          modals={
            <>
              <GiftBoxModal
                isOpen={isGiftModalOpen}
                onClose={() => {
                  setIsGiftModalOpen(false)
                  setGiftRecipientId(null)
                }}
                recipientId={giftRecipientId || (stream as any).user_id}
                streamId={streamId}
                broadcasterId={(stream as any).user_id}
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
            </>
          }
        />
      </ErrorBoundary>
    </GiftSystemProvider>
  )
}

export default ViewerPage