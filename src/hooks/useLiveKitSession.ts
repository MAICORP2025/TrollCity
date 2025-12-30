import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveKit } from './useLiveKit'

interface SessionOptions {
  roomName: string
  user: any
  role?: string
  allowPublish?: boolean
  autoPublish?: boolean
  maxParticipants?: number
}

// Shared join/publish helper used by Go Live, Officer Stream, Troll Court
export function useLiveKitSession(options: SessionOptions) {
  const {
    connect,
    disconnect,
    startPublishing,
    toggleCamera,
    toggleMicrophone,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,
    service,
  } = useLiveKit()

  const [sessionError, setSessionError] = useState<string | null>(null)
  const joinStartedRef = useRef(false)

  const maxParticipants = options.maxParticipants ?? 6

  const joinAndPublish = useMemo(
    () => async (mediaStream?: MediaStream) => {
      if (joinStartedRef.current) return false
      if (!options.roomName || !options.user?.identity) {
        setSessionError('Missing room or user for LiveKit')
        return false
      }

      const allowPublish = options.allowPublish !== false
      const autoPublish = options.autoPublish !== false

      console.log('[useLiveKitSession] joinAndPublish triggered', {
        roomName: options.roomName,
        allowPublish,
        autoPublish,
      })
      joinStartedRef.current = true
      setSessionError(null)

      try {
        console.log('[useLiveKitSession] Requesting LiveKit token/connect')
        const connected = await connect(options.roomName, options.user, {
          allowPublish,
          preflightStream: mediaStream,
        })
        if (!connected) throw new Error('LiveKit connection failed')

        console.log('[useLiveKitSession] LiveKit connected')
        const room = service.getRoom()
        if (!room) throw new Error('LiveKit room missing after connect')

        // Limit room size
        if (participants.size > maxParticipants) {
          disconnect()
          throw new Error('Room is full')
        }

        if (allowPublish && autoPublish) {
          console.log('[useLiveKitSession] Publishing local tracks via LiveKit session')
          await room.localParticipant.setCameraEnabled(true)
          await room.localParticipant.setMicrophoneEnabled(true)
          console.log('[useLiveKitSession] Local tracks enabled/published')
        } else if (allowPublish && !autoPublish) {
          console.log('[useLiveKitSession] Publishing allowed but autoPublish disabled – skipping local track enable')
        } else {
          console.log('[useLiveKitSession] Joined LiveKit without publishing (viewer mode)')
        }

        return true
      } catch (err: any) {
        console.error('[useLiveKitSession] joinAndPublish failed:', err)
        setSessionError(err?.message || 'Failed to join stream')
        joinStartedRef.current = false
        return false
      }
    },
    [
      connect,
      disconnect,
      startPublishing,
      options.roomName,
      options.user,
      options.allowPublish,
      options.autoPublish,
      maxParticipants,
      participants.size,
      service,
    ]
  )

  const resetJoinGuard = () => {
    joinStartedRef.current = false
  }

  useEffect(() => {
    return () => {
      joinStartedRef.current = false
    }
  }, [])

  return {
    joinAndPublish,
    resetJoinGuard,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error: sessionError || error,
    toggleCamera,
    toggleMicrophone,
    startPublishing,
  }
}
