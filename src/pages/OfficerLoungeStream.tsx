import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RoomEvent } from 'livekit-client'
import { useLiveKit } from '../contexts/LiveKitContext'
import { useLiveKitSession } from '../hooks/useLiveKitSession'
import { useSeatRoster } from '../hooks/useSeatRoster'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Shield, Video, Mic, Settings, Users } from 'lucide-react'

const TEXT_ENCODER = new TextEncoder()
const ROOM_NAME = 'officer-stream'
const SEAT_COUNT = 6

type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

type ControlMessage = {
  type: 'admin-action'
  action: 'mute-all' | 'remove'
  seatIndex?: number
  initiatorId?: string
}

const connectionLabels: Record<ConnectionStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
}

const connectionStatusColors: Record<ConnectionStatus, string> = {
  connecting: 'bg-amber-400',
  live: 'bg-emerald-400',
  reconnecting: 'bg-sky-400',
  offline: 'bg-red-500',
}

const OfficerLoungeStream: React.FC = () => {
  const { user, profile } = useAuthStore()
  const liveKit = useLiveKit()

  const {
    joinAndPublish,
    startPublishing,
    toggleCamera,
    toggleMicrophone,
    isConnected,
    isConnecting,
    error: sessionError,
  } = useLiveKitSession({
    roomName: ROOM_NAME,
    user: user ? { ...user, role: profile?.role || 'officer' } : null,
    role: 'officer',
    autoPublish: false,
    maxParticipants: SEAT_COUNT,
  })

  const { participants, localParticipant, service } = liveKit
  const { seats, claimSeat, releaseSeat, isClaimingSeat } = useSeatRoster()

  const [currentSeatIndex, setCurrentSeatIndex] = useState<number | null>(null)
  const [claimingSeat, setClaimingSeat] = useState<number | null>(null)
  const [permissionModal, setPermissionModal] = useState<{ visible: boolean; seatIndex: number | null }>({
    visible: false,
    seatIndex: null,
  })
  const [entranceEffectSeat, setEntranceEffectSeat] = useState<number | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [targetSeatIndex, setTargetSeatIndex] = useState<number | null>(null)

  const isAdmin = useMemo(
    () => Boolean(profile?.role === 'admin' || profile?.is_admin || profile?.is_lead_officer),
    [profile]
  )

  /* ==========================
     Connection status listeners
  ========================== */
  useEffect(() => {
    const room = service?.getRoom?.()
    if (!room) return

    const handleConnected = () => setConnectionStatus('live')
    const handleDisconnected = () => setConnectionStatus('offline')
    const handleReconnecting = () => setConnectionStatus('reconnecting')

    room.on(RoomEvent.Connected, handleConnected)
    room.on(RoomEvent.Disconnected, handleDisconnected)
    room.on(RoomEvent.Reconnecting, handleReconnecting)

    return () => {
      room.off(RoomEvent.Connected, handleConnected)
      room.off(RoomEvent.Disconnected, handleDisconnected)
      room.off(RoomEvent.Reconnecting, handleReconnecting)
    }
  }, [service])

  useEffect(() => {
    if (isConnecting) {
      setConnectionStatus('connecting')
    } else if (!isConnected && connectionStatus !== 'reconnecting') {
      setConnectionStatus('offline')
    }
  }, [isConnecting, isConnected, connectionStatus])

  /* ==========================
     Find local seat index
  ========================== */
  useEffect(() => {
    if (!profile) return
    const seatIndex = seats.findIndex((seat) => seat?.user_id === profile.id)
    setCurrentSeatIndex(seatIndex !== -1 ? seatIndex : null)
  }, [seats, profile])

  /* ==========================
     Entrance effect timer
  ========================== */
  useEffect(() => {
    if (entranceEffectSeat === null) return
    const timer = setTimeout(() => setEntranceEffectSeat(null), 2200)
    return () => clearTimeout(timer)
  }, [entranceEffectSeat])

  /* ==========================
     Data channel messaging
  ========================== */
  const sendSeatMessage = useCallback(
    async (message: ControlMessage) => {
      try {
        const room = service?.getRoom?.()
        if (!room?.localParticipant) return
        await room.localParticipant.publishData(TEXT_ENCODER.encode(JSON.stringify(message)), {
          reliable: true,
        })
      } catch (error) {
        console.error('Failed to broadcast control message', error)
      }
    },
    [service]
  )

  /* ============================================
     Join session once profile/user are available
  ============================================ */
  const didJoinRef = useRef(false)
  useEffect(() => {
    if (!user || !profile) return
    if (didJoinRef.current) return
    didJoinRef.current = true

    joinAndPublish().catch((err) => {
      console.error(err)
      toast.error(err?.message || 'Unable to enter Officer Stream')
      didJoinRef.current = false
    })
  }, [joinAndPublish, profile, user])

  /* ==========================
     Seat claim handler
     ✅ AUTO-PUBLISH after permission granted
  ========================== */
  const handleSeatClaim = useCallback(
    async (seatIndex: number) => {
      if (!user || !profile) return

      if (seats[seatIndex] || claimingSeat !== null) {
        toast('This seat is already occupied')
        return
      }

      const identity = localParticipant?.identity || user.id
      setClaimingSeat(seatIndex)

      try {
        // Claim seat
        await claimSeat(seatIndex, {
          username: profile.username,
          avatarUrl: profile.avatar_url ?? null,
          role: profile.role,
          metadata: { identity },
        })

        // Ensure connected
        if (!isConnected) {
          await joinAndPublish()
        }

        // Request permissions (must succeed)
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        stream.getTracks().forEach((track) => track.stop())

        // ✅ Publish immediately
        await startPublishing()

        // ✅ Update UI state immediately
        setCurrentSeatIndex(seatIndex)
        setEntranceEffectSeat(seatIndex)
      } catch (error: any) {
        const isPermissionIssue =
          error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError'

        if (isPermissionIssue) {
          setPermissionModal({ visible: true, seatIndex })
        } else {
          toast.error(error?.message || 'Failed to join this seat')
        }

        // Cleanup seat claim
        await releaseSeat(seatIndex, profile.id, { force: true })
      } finally {
        setClaimingSeat(null)
      }
    },
    [
      user,
      profile,
      seats,
      claimingSeat,
      localParticipant,
      isConnected,
      joinAndPublish,
      startPublishing,
      claimSeat,
      releaseSeat,
    ]
  )

  /* ==========================
     Leave seat handler
  ========================== */
  const handleLeaveSeat = useCallback(async () => {
    if (currentSeatIndex === null || !profile) return

    try {
      if (localParticipant?.isCameraEnabled) {
        await toggleCamera?.()
      }
      if (localParticipant?.isMicrophoneEnabled) {
        await toggleMicrophone?.()
      }
    } catch (e) {
      console.warn('Failed to stop tracks before leaving seat:', e)
    }

    await releaseSeat(currentSeatIndex, profile.id, { force: true })
    setCurrentSeatIndex(null)
  }, [currentSeatIndex, profile, localParticipant, toggleCamera, toggleMicrophone, releaseSeat])

  /* ==========================
     Handle admin control messages
  ========================== */
  const handleControlMessage = useCallback(
    async (message: ControlMessage) => {
      if (message.type !== 'admin-action') return

      if (message.action === 'mute-all') {
        if (!localParticipant) return
        if (message.initiatorId === localParticipant.identity) return
        if (currentSeatIndex === null) return

        if (localParticipant.isMicrophoneEnabled) {
          await toggleMicrophone?.()
        }
        toast('You have been muted by the admin')
        return
      }

      if (message.action === 'remove' && typeof message.seatIndex === 'number') {
        const seatIndex = message.seatIndex
        const matches =
          currentSeatIndex === seatIndex || seats[seatIndex]?.user_id === localParticipant?.identity
        if (!matches) return
        toast('You have been removed from the seat')
        await handleLeaveSeat()
      }
    },
    [currentSeatIndex, handleLeaveSeat, localParticipant, seats, toggleMicrophone]
  )

  useEffect(() => {
    const room = service?.getRoom?.()
    if (!room) return
    const decoder = new TextDecoder()

    const handleData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(decoder.decode(payload)) as ControlMessage
        handleControlMessage(message)
      } catch (error) {
        console.error('Invalid control message', error)
      }
    }

    room.on(RoomEvent.DataReceived, handleData)
    return () => {
      room.off(RoomEvent.DataReceived, handleData)
    }
  }, [service, handleControlMessage])

  const handlePermissionRetry = () => {
    const seatIndex = permissionModal.seatIndex
    setPermissionModal({ visible: false, seatIndex: null })
    if (seatIndex !== null) {
      handleSeatClaim(seatIndex)
    }
  }

  /* ======================================================
     Render seat + map participant from participants map
  ====================================================== */
  const renderSeats = useMemo(
    () =>
      seats.map((seat, index) => ({
        seat,
        participant: seat ? (participants as any).get(seat.user_id) : undefined,
        index,
      })),
    [seats, participants]
  )

  /* Admin actions */
  const handleMuteAll = useCallback(() => {
    sendSeatMessage({
      type: 'admin-action',
      action: 'mute-all',
      initiatorId: localParticipant?.identity,
    })
    toast('Mute command sent')
  }, [localParticipant?.identity, sendSeatMessage])

  const handleRemove = useCallback(async () => {
    if (targetSeatIndex === null) {
      toast.error('Select a seat to remove')
      return
    }
    const seat = seats[targetSeatIndex]
    if (!seat) {
      toast.error('Seat is already empty')
      return
    }

    sendSeatMessage({
      type: 'admin-action',
      action: 'remove',
      seatIndex: targetSeatIndex,
      initiatorId: localParticipant?.identity,
    })

    await releaseSeat(targetSeatIndex, seat.user_id, { force: true })
    setTargetSeatIndex(null)
    toast('User has been removed')
  }, [localParticipant?.identity, releaseSeat, sendSeatMessage, seats, targetSeatIndex])

  const targetedSeat = targetSeatIndex !== null ? seats[targetSeatIndex] : null
  const targetSeatNumber = targetSeatIndex !== null ? targetSeatIndex + 1 : null
  const targetSeatLabel = targetedSeat
    ? targetedSeat.username
      ? `${targetedSeat.username} (Seat ${targetSeatNumber})`
      : `Seat ${targetSeatNumber}`
    : 'None'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#03010c] via-[#05031a] to-[#110117] text-white">
      <div className="flex h-screen flex-col">
        <header className="flex items-start justify-between border-b border-purple-600/40 bg-white/5 px-6 py-5 shadow-[0_10px_40px_rgba(50,10,100,0.5)] backdrop-blur">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.5em] text-purple-300">
              <Shield className="h-4 w-4 text-purple-300" />
              Officer Stream
            </div>
            <h1 className="text-2xl font-bold text-white">Command Deck · LiveKit</h1>
            <p className="text-sm text-gray-400">6-seat broadcast · Officers only</p>
          </div>

          <div className="flex flex-col items-end gap-1 text-right uppercase tracking-[0.3em] text-gray-300">
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`h-2 w-2 rounded-full ${connectionStatusColors[connectionStatus]}`} />
              <span className="text-[11px] font-semibold text-white">{connectionLabels[connectionStatus]}</span>
            </div>
            <span className="text-[9px] tracking-[0.6em] text-purple-400">Connection status</span>
            <span className="text-[11px] text-gray-300">{participants.size} active participants</span>
            {sessionError && (
              <span className="text-[9px] uppercase tracking-[0.4em] text-pink-300">{sessionError}</span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden px-6 py-5">
          <div className="h-full overflow-hidden rounded-[32px] border border-purple-500/30 bg-gradient-to-br from-[#070117] to-[#140027] p-4 shadow-[0_20px_90px_rgba(88,38,182,0.4)]">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-gray-400">
              <span>Seat roster</span>
              <span className="text-[11px]">Target: {targetSeatLabel}</span>
            </div>

            <div className="relative h-full">
              <SeatGrid
                seats={renderSeats}
                onSeatClaim={handleSeatClaim}
                claimingSeat={claimingSeat ?? (isClaimingSeat as any)}
                currentSeatIndex={currentSeatIndex}
                isAdmin={isAdmin}
                onTargetSeat={(idx) => setTargetSeatIndex(idx)}
                targetedSeatIndex={targetSeatIndex}
              />

              {entranceEffectSeat !== null && (
                <EntranceEffectScreenOverlay seat={seats[entranceEffectSeat]} seatIndex={entranceEffectSeat} />
              )}
            </div>
          </div>
        </main>

        <BottomControls
          micEnabled={localParticipant?.isMicrophoneEnabled ?? false}
          cameraEnabled={localParticipant?.isCameraEnabled ?? false}
          onToggleMic={toggleMicrophone}
          onToggleCam={toggleCamera}
          onLeaveSeat={handleLeaveSeat}
          currentSeatIndex={currentSeatIndex}
          isAdmin={isAdmin}
          onMuteAll={handleMuteAll}
          onRemove={handleRemove}
          targetLabel={targetSeatLabel}
        />
      </div>

      {permissionModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-[30px] border border-purple-500/60 bg-[#070114]/95 p-6 text-center shadow-[0_20px_60px_rgba(94,99,255,0.4)]">
            <p className="text-xs uppercase tracking-[0.4em] text-purple-300">Permissions required</p>
            <h2 className="mt-4 text-xl font-semibold">Camera & mic blocked</h2>
            <p className="mt-2 text-sm text-gray-300">
              Troll City requires both camera and microphone permissions to publish your feed. Please enable them and retry.
            </p>
            <div className="mt-6 flex flex-col gap-3 text-xs uppercase tracking-[0.3em]">
              <button
                onClick={handlePermissionRetry}
                className="rounded-full border border-purple-400/70 bg-gradient-to-br from-purple-600 to-pink-500 px-4 py-3 font-semibold text-white shadow-[0_0_30px_rgba(214,127,255,0.45)]"
              >
                Retry permissions
              </button>
              <button
                onClick={() => setPermissionModal({ visible: false, seatIndex: null })}
                className="rounded-full border border-white/20 px-4 py-3 text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type SeatGridProps = {
  seats: Array<{ seat: ReturnType<typeof useSeatRoster>['seats'][number]; participant?: any; index: number }>
  onSeatClaim: (index: number) => void
  claimingSeat: number | null
  currentSeatIndex: number | null
  isAdmin: boolean
  targetedSeatIndex: number | null
  onTargetSeat: (index: number) => void
}

const SeatGrid: React.FC<SeatGridProps> = ({
  seats,
  onSeatClaim,
  claimingSeat,
  currentSeatIndex,
  isAdmin,
  targetedSeatIndex,
  onTargetSeat,
}) => {
  return (
    <div className="mt-4 grid h-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {seats.map(({ seat, participant, index }) => (
        <SeatTile
          key={`seat-${index}`}
          index={index}
          assignment={seat}
          participant={participant}
          onClaim={() => onSeatClaim(index)}
          isClaiming={claimingSeat === index}
          isCurrent={currentSeatIndex === index}
          isTargeted={targetedSeatIndex === index}
          isAdmin={isAdmin}
          onTarget={() => (isAdmin && seat ? onTargetSeat(index) : undefined)}
        />
      ))}
    </div>
  )
}

type SeatTileProps = {
  index: number
  assignment: ReturnType<typeof useSeatRoster>['seats'][number]
  participant?: any
  onClaim: () => void
  isClaiming: boolean
  isCurrent: boolean
  isTargeted: boolean
  isAdmin: boolean
  onTarget?: () => void
}

const SeatTile: React.FC<SeatTileProps> = ({
  index,
  assignment,
  participant,
  onClaim,
  isClaiming,
  isCurrent,
  isTargeted,
  isAdmin,
  onTarget,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const vTrack = participant?.videoTrack?.track
    const aTrack = participant?.audioTrack?.track

    if (vTrack && videoRef.current) {
      vTrack.attach(videoRef.current)
    }
    if (aTrack && audioRef.current) {
      aTrack.attach(audioRef.current)
    }

    return () => {
      try {
        if (vTrack && videoRef.current) vTrack.detach(videoRef.current)
      } catch {}
      try {
        if (aTrack && audioRef.current) aTrack.detach(audioRef.current)
      } catch {}
    }
  }, [participant?.videoTrack?.track, participant?.audioTrack?.track])

  const micActive = participant?.isMicrophoneEnabled ?? false
  const camActive = participant?.isCameraEnabled ?? false

  const avatarLabel =
    assignment?.avatar_url ??
    (assignment?.username
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(assignment.username)}&background=2d0c3c&color=ffffff`
      : null)

  const borderState = isCurrent
    ? 'border-cyan-400 shadow-[0_0_35px_rgba(85,244,255,0.35)] ring-1 ring-cyan-200/70'
    : isTargeted
    ? 'border-pink-400 shadow-[0_0_25px_rgba(214,127,255,0.5)]'
    : 'border-purple-500/30'

  const showVideo = Boolean(assignment && participant?.videoTrack?.track)

  return (
    <div className={`relative flex h-56 flex-col overflow-hidden rounded-[28px] border ${borderState} bg-gradient-to-br from-white/5 to-black/40 text-white transition`}>
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] uppercase tracking-[0.4em] text-purple-300">
        <span>Seat {index + 1}</span>
      </div>

      {assignment ? (
        <div className="relative flex flex-1 flex-col justify-between">
          <div className="absolute inset-4 overflow-hidden rounded-[22px] border border-white/5 bg-black/60">
            {showVideo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isCurrent}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/70 text-xs uppercase tracking-[0.3em]">
                Waiting for video…
              </div>
            )}
            <audio ref={audioRef} autoPlay />
          </div>

          <div className="relative z-10 flex flex-col gap-2 p-4">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.4em] text-white">
              {avatarLabel ? (
                <img
                  src={avatarLabel}
                  alt={assignment.username}
                  className="h-6 w-6 rounded-full border border-white/30 object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xs">
                  {assignment.username?.charAt(0) ?? 'T'}
                </div>
              )}
              <span>{assignment.username}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-gray-300">
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">{assignment.role}</span>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${micActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`h-2 w-2 rounded-full ${camActive ? 'bg-cyan-400' : 'bg-red-400'}`} />
              </div>
            </div>
          </div>

          {isCurrent && (
            <div className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white">
              You
            </div>
          )}

          {isAdmin && onTarget && (
            <button
              onClick={onTarget}
              className="absolute top-3 right-3 rounded-full border border-white/30 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-[0.4em] text-white transition hover:border-pink-400"
            >
              Target
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onClaim}
          disabled={isClaiming}
          className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-purple-500/40 bg-black/60 px-4 py-6 text-center text-sm uppercase tracking-[0.3em] text-gray-200 transition hover:border-white/50 disabled:opacity-60"
        >
          <Video className="h-6 w-6 text-purple-300" />
          <span>{isClaiming ? 'Joining...' : 'Click to join'}</span>
        </button>
      )}
    </div>
  )
}

const BottomControls: React.FC<{
  micEnabled: boolean
  cameraEnabled: boolean
  onToggleMic?: () => void
  onToggleCam?: () => void
  onLeaveSeat: () => void
  currentSeatIndex: number | null
  isAdmin: boolean
  onMuteAll: () => void
  onRemove: () => void
  targetLabel: string
}> = ({
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCam,
  onLeaveSeat,
  currentSeatIndex,
  isAdmin,
  onMuteAll,
  onRemove,
  targetLabel,
}) => {
  const isSeated = currentSeatIndex !== null

  return (
    <div className="border-t border-purple-600/40 bg-black/70 p-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => isSeated && onToggleMic?.()}
          disabled={!isSeated}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white transition disabled:opacity-50"
        >
          <Mic className={`inline h-4 w-4 ${micEnabled ? 'text-emerald-300' : 'text-red-400'}`} />{' '}
          {micEnabled ? 'Mute Mic' : 'Unmute Mic'}
        </button>

        <button
          onClick={() => isSeated && onToggleCam?.()}
          disabled={!isSeated}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white transition disabled:opacity-50"
        >
          <Video className={`inline h-4 w-4 ${cameraEnabled ? 'text-cyan-300' : 'text-red-400'}`} />{' '}
          {cameraEnabled ? 'Camera On' : 'Camera Off'}
        </button>

        <button
          onClick={onLeaveSeat}
          disabled={!isSeated}
          className="rounded-full border border-red-500/80 bg-red-500/30 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-red-200 transition hover:bg-red-500/50 disabled:opacity-50"
        >
          Leave Seat
        </button>

        {isAdmin && (
          <>
            <button
              onClick={onMuteAll}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white"
            >
              <Users className="inline h-4 w-4 text-white" /> Mute All
            </button>

            <button
              onClick={onRemove}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white"
            >
              <Settings className="inline h-4 w-4 text-white" /> Remove
            </button>
          </>
        )}
      </div>

      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.3em] text-white/60">
        Target Seat: {targetLabel}
      </p>
    </div>
  )
}

const EntranceEffectScreenOverlay: React.FC<{
  seat: ReturnType<typeof useSeatRoster>['seats'][number]
  seatIndex: number
}> = ({ seat, seatIndex }) => {
  const displayName = seat?.username || `Seat ${seatIndex + 1}`

  return (
    <div className="pointer-events-none absolute inset-4 z-20 flex flex-col items-center justify-center gap-3 rounded-[28px] bg-gradient-to-br from-white/20 via-transparent to-black/60 text-center text-white shadow-[0_0_60px_rgba(156,89,255,0.5)]">
      <div className="text-[10px] uppercase tracking-[0.6em] text-purple-200">Entrance Effects</div>
      <h3 className="text-3xl font-bold uppercase tracking-[0.3em]">{displayName}</h3>
      <div className="text-sm uppercase tracking-[0.4em] text-pink-300">Activated</div>
      <div className="flex gap-2">
        {[...Array(5)].map((_, index) => (
          <span
            key={`entrance-confetti-${index}`}
            className="h-1 w-1 rounded-full bg-gradient-to-r from-purple-300 to-pink-400 animate-[pulse_1.2s_infinite]"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default OfficerLoungeStream 
