import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Crown,
  FileText,
  Gavel,
  LogOut,
  Mic,
  MicOff,
  Scale,
  Shield,
  User,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '../lib/store'
import { supabase, UserRole } from '../lib/supabase'
import RequireRole from '../components/RequireRole'
import CourtChat from '../components/CourtChat'
import CourtDocketModal from '../components/CourtDocketModal'
import GiftBoxModal from '../components/broadcast/GiftBoxModal'
import useLiveKitRoom from '../hooks/useLiveKitRoom'
import { Button } from '../components/ui/button'

type CourtRole =
  | 'admin'
  | 'ceo'
  | 'lead_troll_officer'
  | 'troll_officer'
  | 'secretary'
  | 'prosecutor'
  | 'judge'
  | 'attorney'
  | 'pastor'
  | 'moderator'
  | 'auctioneer'
  | 'lead_officer'
  | 'officer'
  | 'user'

type CourtStudioSpot =
  | 'judge'
  | 'prosecutor'
  | 'attorney'
  | 'defendant'
  | 'witness'
  | 'audience'

type CombinedUserTrack = {
  uid: string | number
  videoTrack?: any
  audioTrack?: any
  username?: string | null
  role?: string | null
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isValidUuid = (value?: string | null) => UUID_REGEX.test(value || '')

function cleanCourtUuid(value?: string | null): string | null {
  if (!value) return null

  const cleaned = String(value)
    .replace(/^court-/, '')
    .replace(/^troll-court-/, '')

  return isValidUuid(cleaned) ? cleaned : null
}

function makeCourtRoomName(courtId: string) {
  return `troll-court-${courtId}`
}

function normalizeCourtRole(profile: any): CourtRole {
  if (!profile) return 'user'
  if (profile?.is_admin || profile?.role === 'admin') return 'admin'
  if (profile?.is_ceo || profile?.role === 'ceo') return 'ceo'

  if (
    profile?.is_lead_officer ||
    profile?.role === 'lead_troll_officer' ||
    profile?.role === 'lead_officer'
  ) {
    return 'lead_troll_officer'
  }

  if (
    profile?.is_troll_officer ||
    profile?.role === 'troll_officer' ||
    profile?.role === 'officer'
  ) {
    return 'troll_officer'
  }

  if (profile?.is_secretary || profile?.role === 'secretary') return 'secretary'
  if (profile?.is_prosecutor || profile?.role === 'prosecutor') return 'prosecutor'
  if (profile?.is_judge || profile?.role === 'judge') return 'judge'
  if (profile?.is_attorney || profile?.role === 'attorney') return 'attorney'
  if (profile?.is_pastor || profile?.role === 'pastor') return 'pastor'
  if (profile?.is_moderator || profile?.role === 'moderator') return 'moderator'
  if (profile?.is_auctioneer || profile?.role === 'auctioneer') return 'auctioneer'

  return profile?.role || 'user'
}

function canJudge(role: CourtRole) {
  return role === 'admin' || role === 'ceo' || role === 'lead_troll_officer' || role === 'judge'
}

function canEndCourt(role: CourtRole) {
  return (
    role === 'admin' ||
    role === 'ceo' ||
    role === 'lead_troll_officer' ||
    role === 'troll_officer' ||
    role === 'officer' ||
    role === 'judge'
  )
}

function getAutoStudioSpot(role: CourtRole): CourtStudioSpot {
  if (canJudge(role)) return 'judge'
  if (role === 'prosecutor') return 'prosecutor'
  if (role === 'attorney') return 'attorney'
  return 'audience'
}

function spotLabel(spot: CourtStudioSpot) {
  switch (spot) {
    case 'judge':
      return 'Judge'
    case 'prosecutor':
      return 'Prosecutor'
    case 'attorney':
      return 'Defense Attorney'
    case 'defendant':
      return 'Defendant'
    case 'witness':
      return 'Witness'
    case 'audience':
      return 'Audience'
    default:
      return 'Court Member'
  }
}

function spotTone(spot: CourtStudioSpot) {
  switch (spot) {
    case 'judge':
      return 'border-amber-300/70 shadow-[0_0_36px_rgba(245,158,11,0.45)]'
    case 'prosecutor':
      return 'border-red-400/70 shadow-[0_0_30px_rgba(239,68,68,0.35)]'
    case 'attorney':
      return 'border-cyan-300/70 shadow-[0_0_30px_rgba(34,211,238,0.35)]'
    case 'defendant':
      return 'border-red-500/70 shadow-[0_0_26px_rgba(239,68,68,0.35)]'
    case 'witness':
      return 'border-purple-300/70 shadow-[0_0_26px_rgba(168,85,247,0.35)]'
    case 'audience':
      return 'border-amber-200/40 shadow-[0_0_18px_rgba(245,158,11,0.18)]'
    default:
      return 'border-white/30'
  }
}

function spotPosition(spot: CourtStudioSpot) {
  switch (spot) {
    case 'judge':
      return 'left-[50%] top-[25%] h-[18%] w-[18%] -translate-x-1/2'
    case 'prosecutor':
      return 'left-[11%] top-[55%] h-[19%] w-[18%]'
    case 'witness':
      return 'left-[35%] top-[58%] h-[16%] w-[15%]'
    case 'defendant':
      return 'left-[57%] top-[58%] h-[16%] w-[15%]'
    case 'attorney':
      return 'right-[9%] top-[55%] h-[19%] w-[19%]'
    case 'audience':
      return 'left-[50%] bottom-[8%] h-[13%] w-[24%] -translate-x-1/2'
    default:
      return 'left-[50%] top-[50%] h-[18%] w-[18%]'
  }
}

function CourtStudioTile({
  spot,
  userTrack,
  isLocal,
  localUserId,
  onGiftUser,
}: {
  spot: CourtStudioSpot
  userTrack?: CombinedUserTrack
  isLocal?: boolean
  localUserId: string
  onGiftUser?: (userId: string) => void
}) {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const attachedSidRef = useRef<string | null>(null)

  const videoTrack = userTrack?.videoTrack
  const audioTrack = userTrack?.audioTrack
  const uid = String(userTrack?.uid || '')
  const username = userTrack?.username || spotLabel(spot)
  const canGift = isValidUuid(uid) && uid !== localUserId

  useEffect(() => {
    const container = videoContainerRef.current
    if (!container) return

    if (!videoTrack) {
      attachedSidRef.current = null
      while (container.firstChild) container.removeChild(container.firstChild)
      return
    }

    const trackSid = videoTrack.sid || videoTrack.mediaStreamTrack?.id || 'track'

    if (attachedSidRef.current === trackSid) return

    attachedSidRef.current = trackSid

    while (container.firstChild) container.removeChild(container.firstChild)

    const videoElement = videoTrack.attach()
    videoElement.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 9999px;
      filter: saturate(1.12) contrast(1.05);
    `
    videoElement.playsInline = true
    videoElement.autoplay = true
    videoElement.muted = Boolean(isLocal)

    container.appendChild(videoElement)

    return () => {
      try {
        videoTrack.detach(videoElement)
      } catch {
        // no-op
      }

      attachedSidRef.current = null

      if (container.contains(videoElement)) {
        container.removeChild(videoElement)
      }
    }
  }, [videoTrack?.sid, videoTrack, isLocal])

  useEffect(() => {
    if (audioTrack && !isLocal) audioTrack.play?.()

    return () => {
      if (audioTrack && !isLocal) audioTrack.stop?.()
    }
  }, [audioTrack, isLocal])

  return (
    <button
      type="button"
      className={[
        'absolute z-20 overflow-hidden rounded-full border-2 bg-black/40 backdrop-blur-sm transition',
        spotPosition(spot),
        spotTone(spot),
        canGift ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-default',
      ].join(' ')}
      onClick={() => {
        if (canGift && onGiftUser) onGiftUser(uid)
      }}
    >
      {videoTrack ? (
        <div ref={videoContainerRef} className="h-full w-full rounded-full" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-black/45 text-white/70">
          {spot === 'judge' ? (
            <Crown className="mb-1 h-7 w-7 text-amber-200" />
          ) : (
            <User className="mb-1 h-6 w-6 text-white/70" />
          )}
          <span className="max-w-[80%] truncate text-[10px] font-black">
            {userTrack ? username : spotLabel(spot)}
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-1/2 w-[92%] -translate-x-1/2 rounded-full bg-black/80 px-2 py-1 text-center">
        <p className="truncate text-[10px] font-black text-white">
          {userTrack ? username : `Waiting for ${spotLabel(spot)}`}
        </p>
      </div>
    </button>
  )
}

function StudioControls({
  activeSpot,
  isConnected,
  isJoining,
  canUseMicCamera,
  micOn,
  cameraOn,
  autoSpot,
  onEnter,
  onLeave,
  onToggleMic,
  onToggleCamera,
  onEndCourt,
  canEnd,
  onDocket,
}: {
  activeSpot: CourtStudioSpot | null
  isConnected: boolean
  isJoining: boolean
  canUseMicCamera: boolean
  micOn: boolean
  cameraOn: boolean
  autoSpot: CourtStudioSpot
  onEnter: () => void
  onLeave: () => void
  onToggleMic: () => void
  onToggleCamera: () => void
  onEndCourt: () => void
  canEnd: boolean
  onDocket: () => void
}) {
  return (
    <div className="absolute bottom-4 left-1/2 z-40 flex w-[min(920px,calc(100%-32px))] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-black/75 p-3 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200/70">
          Virtual Court Studio
        </p>
        <p className="truncate text-sm font-black text-amber-50">
          {activeSpot ? `You are in the ${spotLabel(activeSpot)} spot` : `Your assigned spot: ${spotLabel(autoSpot)}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!activeSpot ? (
          <Button onClick={onEnter} disabled={isJoining}>
            {isJoining ? 'Entering...' : `Enter Courtroom as ${spotLabel(autoSpot)}`}
          </Button>
        ) : (
          <Button onClick={onLeave} variant="destructive">
            Leave Spot
          </Button>
        )}

        <Button onClick={onToggleMic} variant="outline" disabled={!canUseMicCamera}>
          {micOn ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
          {micOn ? 'Mute' : 'Unmute'}
        </Button>

        <Button onClick={onToggleCamera} variant="outline" disabled={!canUseMicCamera}>
          {cameraOn ? <Video className="mr-2 h-4 w-4" /> : <VideoOff className="mr-2 h-4 w-4" />}
          {cameraOn ? 'Camera Off' : 'Camera On'}
        </Button>

        <Button onClick={onDocket} variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Docket
        </Button>

        {canEnd && (
          <Button onClick={onEndCourt} variant="destructive">
            End Court
          </Button>
        )}
      </div>

      <div className="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-100 lg:flex">
        {isConnected ? '🟢 LIVE' : '⚫ OFFLINE'}
      </div>
    </div>
  )
}

export default function CourtRoom() {
  const { user, profile } = useAuthStore()
  const params = useParams()
  const navigate = useNavigate()

  const rawCourtId = params.courtId || params.id
  const courtId = cleanCourtUuid(rawCourtId)

  const [courtSession, setCourtSession] = useState<any>(null)
  const [courtParticipants, setCourtParticipants] = useState<any[]>([])
  const [activeSpot, setActiveSpot] = useState<CourtStudioSpot | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [showDocketModal, setShowDocketModal] = useState(false)
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [giftOpen, setGiftOpen] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const effectiveRole = useMemo(() => normalizeCourtRole(profile), [profile])
  const autoSpot = useMemo(() => getAutoStudioSpot(effectiveRole), [effectiveRole])

  const canPublish = activeSpot !== null && activeSpot !== 'audience'
  const canUseMicCamera = activeSpot !== null && activeSpot !== 'audience'
  const canEnd = canEndCourt(effectiveRole)

  const liveKitRoomId = courtId ? makeCourtRoomName(courtId) : ''

  const {
    isConnected: isLiveKitConnected,
    remoteUsers: liveKitRemoteUsers,
    localAudioTrack,
    localVideoTrack,
    joinAsPublisher,
    joinAsAudience,
    leaveRoom,
    toggleCamera,
    toggleMicrophone,
  } = useLiveKitRoom({
    roomId: liveKitRoomId,
    roomType: 'court',
    audioOnly: false,
    publish: canPublish,
    userName: profile?.username || user?.email || 'Court User',
    onUserJoined: () => {},
    onUserLeft: () => {},
    onError: (err) => {
      toast.error(`Audio/Video error: ${err.message}`)
    },
  })

  const micOn = Boolean(localAudioTrack?.isEnabled ?? localAudioTrack?.enabled)
  const cameraOn = Boolean(localVideoTrack?.isEnabled ?? localVideoTrack?.enabled)

  const fetchCourtSession = async () => {
    if (!courtId) return

    const { data, error } = await supabase
      .from('court_sessions')
      .select('*')
      .eq('id', courtId)
      .maybeSingle()

    if (error || !data) {
      toast.error('Court session not found.')
      navigate('/troll-court')
      return
    }

    setCourtSession(data)
  }

  const fetchCourtParticipants = async () => {
    if (!courtId) return

    const { data, error } = await supabase
      .from('court_participants')
      .select('*, user_profiles(username, avatar_url)')
      .eq('court_session_id', courtId)

    if (!error && data) {
      setCourtParticipants(data)
    }
  }

  useEffect(() => {
    if (!rawCourtId) return

    if (!courtId) {
      toast.error('Invalid court session ID.')
      navigate('/troll-court')
    }
  }, [rawCourtId, courtId, navigate])

  useEffect(() => {
    if (!courtId) return

    fetchCourtSession()
    fetchCourtParticipants()

    const sessionChannel = supabase
      .channel(`court_session_studio_${courtId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_sessions',
          filter: `id=eq.${courtId}`,
        },
        (payload) => {
          if (!payload.new) return

          const next = payload.new as any
          setCourtSession(next)

          if (next.status && !['active', 'live', 'waiting'].includes(next.status)) {
            toast.info('Court session ended.')
            navigate('/troll-court')
          }
        }
      )
      .subscribe()

    const participantChannel = supabase
      .channel(`court_participants_studio_${courtId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_participants',
          filter: `court_session_id=eq.${courtId}`,
        },
        () => {
          fetchCourtParticipants()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(participantChannel)
    }
  }, [courtId, navigate])

  const upsertParticipantRole = async (spot: CourtStudioSpot) => {
    if (!courtId || !user?.id) return

    const { data, error } = await supabase.rpc('join_court_session', {
      p_court_session_id: courtId,
      p_role: spot,
    })

    if (error) throw error

    if (!data?.success) {
      throw new Error(data?.message || 'Failed to join court session.')
    }

    await fetchCourtParticipants()
  }

  const enterCourtroom = async () => {
    if (!courtId || !user?.id) {
      toast.error('Court ID or user missing.')
      return
    }

    setIsJoining(true)

    try {
      const spot = autoSpot

      await upsertParticipantRole(spot)

      if (spot === 'audience') {
        await joinAsAudience(user.id)
      } else {
        await joinAsPublisher(user.id)
      }

      if (spot === 'judge') {
        await supabase
          .from('court_sessions')
          .update({
            judge_id: user.id,
            judge_username: profile?.username || user.email || 'Judge',
            status: courtSession?.status === 'waiting' ? 'active' : courtSession?.status || 'active',
            livekit_room_name: liveKitRoomId,
          })
          .eq('id', courtId)

        setCourtSession((prev: any) => ({
          ...prev,
          judge_id: user.id,
          judge_username: profile?.username || user.email || 'Judge',
          status: prev?.status === 'waiting' ? 'active' : prev?.status || 'active',
          livekit_room_name: liveKitRoomId,
        }))
      }

      setActiveSpot(spot)
      toast.success(`Entered courtroom as ${spotLabel(spot)}.`)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to enter courtroom.')
      try {
        await leaveRoom()
      } catch {
        // no-op
      }
    } finally {
      setIsJoining(false)
    }
  }

  const leaveCurrentSpot = async () => {
    try {
      await leaveRoom()

      if (courtId && user?.id) {
        await supabase
          .from('court_participants')
          .delete()
          .eq('court_session_id', courtId)
          .eq('user_id', user.id)
      }

      setActiveSpot(null)
      await fetchCourtParticipants()
      toast.info('Left courtroom spot.')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to leave courtroom spot.')
    }
  }

  const safeToggleMic = async () => {
    if (!canUseMicCamera) {
      toast.error('Enter a speaking spot before using mic.')
      return
    }

    try {
      await toggleMicrophone()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to toggle mic.')
    }
  }

  const safeToggleCamera = async () => {
    if (!canUseMicCamera) {
      toast.error('Enter a speaking spot before using camera.')
      return
    }

    try {
      await toggleCamera()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to toggle camera.')
    }
  }

  const handleEndCourt = async () => {
    if (!canEnd) {
      toast.error('Only court staff can end court.')
      return
    }

    if (!confirm('End this court session?')) return

    try {
      await supabase
        .from('court_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', courtId)

      await leaveRoom()
      setActiveSpot(null)
      toast.success('Court session ended.')
      navigate('/troll-court')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to end court.')
    }
  }

  const findParticipantBySpot = (spot: CourtStudioSpot) => {
    return courtParticipants.find(
      (participant) => String(participant.role || '').toLowerCase() === spot
    )
  }

  const findTrackUser = (
    id?: string | null,
    username?: string | null,
    role?: CourtStudioSpot
  ): CombinedUserTrack | undefined => {
    if (!id) return undefined

    const cleanId = cleanCourtUuid(id) || id

    const remote = liveKitRemoteUsers.find((remoteUser: any) => {
      const identity = String(remoteUser.uid || remoteUser.identity || '')
      return identity === String(cleanId) || identity.endsWith(String(cleanId))
    })

    if (remote) {
      return {
        uid: remote.uid || remote.identity,
        videoTrack: remote.videoTrack,
        audioTrack: remote.audioTrack,
        username: username || remote.name || remote.identity,
        role,
      }
    }

    if (cleanId === user?.id) {
      return {
        uid: user.id,
        videoTrack: localVideoTrack,
        audioTrack: localAudioTrack,
        username: username || profile?.username || 'You',
        role,
      }
    }

    return {
      uid: cleanId,
      username,
      role,
    }
  }

  const spotUsers = useMemo(() => {
    const judgeParticipant = findParticipantBySpot('judge')
    const prosecutorParticipant = findParticipantBySpot('prosecutor')
    const attorneyParticipant = findParticipantBySpot('attorney')
    const defendantParticipant = findParticipantBySpot('defendant')
    const witnessParticipant = findParticipantBySpot('witness')

    const judgeId = courtSession?.judge_id || judgeParticipant?.user_id

    return {
      judge: findTrackUser(
        judgeId,
        courtSession?.judge_username ||
          judgeParticipant?.user_profiles?.username ||
          'Judge',
        'judge'
      ),
      prosecutor: findTrackUser(
        prosecutorParticipant?.user_id,
        prosecutorParticipant?.user_profiles?.username || 'Prosecutor',
        'prosecutor'
      ),
      attorney: findTrackUser(
        attorneyParticipant?.user_id,
        attorneyParticipant?.user_profiles?.username || 'Defense Attorney',
        'attorney'
      ),
      defendant: findTrackUser(
        courtSession?.defendant_id || defendantParticipant?.user_id,
        courtSession?.defendant_username ||
          defendantParticipant?.user_profiles?.username ||
          'Defendant',
        'defendant'
      ),
      witness: findTrackUser(
        witnessParticipant?.user_id,
        witnessParticipant?.user_profiles?.username || 'Witness',
        'witness'
      ),
      audience:
        activeSpot === 'audience' && user?.id
          ? findTrackUser(user.id, profile?.username || 'You', 'audience')
          : undefined,
    }
  }, [
    courtParticipants,
    courtSession,
    liveKitRemoteUsers,
    user?.id,
    localVideoTrack,
    localAudioTrack,
    activeSpot,
    profile?.username,
  ])

  return (
    <RequireRole
      roles={[UserRole.ADMIN, UserRole.LEAD_TROLL_OFFICER, UserRole.TROLL_OFFICER, UserRole.USER]}
      fallbackPath="/access-denied"
    >
      <div className="relative h-[calc(100dvh-76px)] overflow-hidden bg-black text-white">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/images/troll-court-studio.png')",
          }}
        />

        <div className="absolute inset-0 bg-black/15" />

        <div className="absolute left-4 top-4 z-30 rounded-2xl border border-amber-300/25 bg-black/70 px-4 py-3 shadow-[0_0_26px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8 text-amber-200" />
            <div>
              <h1 className="text-xl font-black text-amber-50">Troll Court</h1>
              <p className="text-xs text-amber-100/70">
                Case #{courtId?.slice(0, 8) || 'invalid'} • {courtSession?.status || 'loading'}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-2xl border border-amber-300/25 bg-black/70 px-4 py-3 text-xs font-black text-amber-100 shadow-[0_0_26px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {isLiveKitConnected ? '🟢 LIVE COURTROOM' : '⚫ STUDIO OFFLINE'}
        </div>

        <CourtStudioTile
          spot="judge"
          userTrack={spotUsers.judge}
          isLocal={String(spotUsers.judge?.uid || '') === user?.id}
          localUserId={user?.id || ''}
          onGiftUser={(targetUserId) => {
            if (!user) {
              navigate('/auth?mode=signup')
              return
            }

            if (targetUserId === user.id) {
              toast.error('You cannot gift yourself')
              return
            }

            setGiftRecipientId(targetUserId)
            setGiftOpen(true)
          }}
        />

        <CourtStudioTile
          spot="prosecutor"
          userTrack={spotUsers.prosecutor}
          isLocal={String(spotUsers.prosecutor?.uid || '') === user?.id}
          localUserId={user?.id || ''}
          onGiftUser={(targetUserId) => {
            if (!user) return
            if (targetUserId === user.id) return toast.error('You cannot gift yourself')
            setGiftRecipientId(targetUserId)
            setGiftOpen(true)
          }}
        />

        <CourtStudioTile
          spot="attorney"
          userTrack={spotUsers.attorney}
          isLocal={String(spotUsers.attorney?.uid || '') === user?.id}
          localUserId={user?.id || ''}
          onGiftUser={(targetUserId) => {
            if (!user) return
            if (targetUserId === user.id) return toast.error('You cannot gift yourself')
            setGiftRecipientId(targetUserId)
            setGiftOpen(true)
          }}
        />

        <CourtStudioTile
          spot="witness"
          userTrack={spotUsers.witness}
          isLocal={String(spotUsers.witness?.uid || '') === user?.id}
          localUserId={user?.id || ''}
          onGiftUser={(targetUserId) => {
            if (!user) return
            if (targetUserId === user.id) return toast.error('You cannot gift yourself')
            setGiftRecipientId(targetUserId)
            setGiftOpen(true)
          }}
        />

        <CourtStudioTile
          spot="defendant"
          userTrack={spotUsers.defendant}
          isLocal={String(spotUsers.defendant?.uid || '') === user?.id}
          localUserId={user?.id || ''}
          onGiftUser={(targetUserId) => {
            if (!user) return
            if (targetUserId === user.id) return toast.error('You cannot gift yourself')
            setGiftRecipientId(targetUserId)
            setGiftOpen(true)
          }}
        />

        <CourtStudioTile
          spot="audience"
          userTrack={spotUsers.audience}
          isLocal={activeSpot === 'audience'}
          localUserId={user?.id || ''}
        />

        <div className="absolute right-4 top-24 z-30 flex flex-col gap-2">
          <Button variant="outline" onClick={() => setShowDocketModal(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Docket
          </Button>

          <Button variant="outline" onClick={() => setShowChat((value) => !value)}>
            <Users className="mr-2 h-4 w-4" />
            Chat
          </Button>

          <Button variant="outline" onClick={() => navigate('/troll-court')}>
            <LogOut className="mr-2 h-4 w-4" />
            Exit
          </Button>
        </div>

        {showChat && (
          <div className="absolute bottom-28 right-4 z-40 h-[360px] w-[360px] overflow-hidden rounded-2xl border border-amber-300/25 bg-black/80 p-3 shadow-[0_0_34px_rgba(0,0,0,0.75)] backdrop-blur-xl">
            <CourtChat courtId={courtId || ''} isLocked={!canJudge(effectiveRole)} />
          </div>
        )}

        <StudioControls
          activeSpot={activeSpot}
          isConnected={isLiveKitConnected}
          isJoining={isJoining}
          canUseMicCamera={canUseMicCamera}
          micOn={micOn}
          cameraOn={cameraOn}
          autoSpot={autoSpot}
          onEnter={enterCourtroom}
          onLeave={leaveCurrentSpot}
          onToggleMic={safeToggleMic}
          onToggleCamera={safeToggleCamera}
          onEndCourt={handleEndCourt}
          canEnd={canEnd}
          onDocket={() => setShowDocketModal(true)}
        />

        <CourtDocketModal
          isOpen={showDocketModal}
          onClose={() => setShowDocketModal(false)}
          courtId={courtId || ''}
          isJudge={canJudge(effectiveRole)}
        />

        <GiftBoxModal
          isOpen={giftOpen}
          onClose={() => {
            setGiftOpen(false)
            setGiftRecipientId(null)
          }}
          recipientId={giftRecipientId || ''}
          streamId=""
        />
      </div>
    </RequireRole>
  )
}