import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveKit } from './useLiveKit'
import { LIVEKIT_URL } from '../lib/LiveKitConfig'
import { toast } from 'sonner'

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
    getRoom,
  } = useLiveKit()

  const [sessionError, setSessionError] = useState<string | null>(null)
  const joinStartedRef = useRef(false)
  const publishInProgressRef = useRef(false)

  const maxParticipants = options.maxParticipants ?? 6

  // ✅ Clear stale session errors from context on mount/update
  useEffect(() => {
    if (error) {
      const isSessionError = error.toLowerCase().includes('session') || 
                           error.toLowerCase().includes('sign in') || 
                           error.toLowerCase().includes('no active session') ||
                           error.toLowerCase().includes('no valid user session')
      if (isSessionError) {
        // Don't treat session errors as real errors - they're expected on load
        console.log('[useLiveKitSession] Detected session error in context (expected on load) — ignoring')
        // Error will be cleared by LiveKitProvider when it detects no session
      }
    }
  }, [error])

  const joinAndPublish = useMemo(
    () => async (mediaStream?: MediaStream, tokenOverride?: string) => {
      if (joinStartedRef.current) throw new Error('Join already in progress')
      
      // ✅ CRITICAL: Early return if roomName is empty (prevents all connection attempts)
      // This prevents the hook from doing anything when not on a broadcast page
      if (!options.roomName || options.roomName.trim() === '') {
        // Silently return - this is expected when not on broadcast page
        return false
      }
      
      // ✅ Check for stale session errors in context FIRST - don't even try if there's a session error
      if (error) {
        const errorLower = error.toLowerCase()
        const isSessionError = errorLower.includes('session') || 
                              errorLower.includes('sign in') || 
                              errorLower.includes('no active session') || 
                              errorLower.includes('no valid user session') ||
                              errorLower.includes('please sign in again')
        if (isSessionError) {
          console.log("[useLiveKitSession] Session error detected in context — skipping connect (will retry after login)")
          return false
        }
      }
      
      // ✅ 1) Add a hard guard before LiveKit ever runs
      // Check session FIRST - use cached user from options if available to avoid auth fetch
      let hasValidSession = false
      if (options.user && options.user.id) {
        hasValidSession = true
      } else {
        const { supabase } = await import('../lib/supabase')
        // Only fetch if we really don't have a user
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) hasValidSession = true
      }
      
      if (!hasValidSession) {
        console.log("[useLiveKitSession] No active session yet — skipping connect")
        return false
      }

      // ✅ 2) Only trigger joinAndPublish when ALL are true
      const roomName = options.roomName
      const identity = options.user?.identity
      const allowPublish = options.allowPublish !== false
      
      if (!roomName || !identity || !allowPublish) {
        console.log("[useLiveKitSession] Skipping connect — missing requirements", { 
          roomName, 
          identity, 
          allowPublish,
          hasUser: !!options.user
        })
        return false
      }

      const autoPublish = options.autoPublish !== false

      console.log('[useLiveKitSession] joinAndPublish triggered', {
        roomName: options.roomName,
        allowPublish,
        autoPublish,
      })
      joinStartedRef.current = true
      setSessionError(null)

      try {
        // ✅ CRITICAL: Check roomName FIRST before any logging or connection attempts
        if (!options.roomName || options.roomName.trim() === '') {
          return false
        }

        console.log('[useLiveKitSession] Requesting LiveKit token/connect')
        console.log('[useLiveKitSession] connecting to room', options.roomName)

        // Log quick debug details before attempting connection
        try {
          console.log('[useLiveKitSession] LIVEKIT_URL', LIVEKIT_URL)
          console.log('[useLiveKitSession] roomName', options.roomName)
          console.log('[useLiveKitSession] identity', options.user?.identity)
          if (tokenOverride) {
            console.log('[useLiveKitSession] tokenOverride length', tokenOverride.length)
            try {
              const parts = tokenOverride.split('.')
              if (parts.length >= 2) {
                const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1]))))
                console.log('[useLiveKitSession] tokenOverride payload', payload)
                console.log('[useLiveKitSession] tokenOverride room/canPublish', {
                  tokenRoom: payload?.video?.room ?? payload?.room ?? payload?.r ?? null,
                  canPublish: payload?.video?.canPublish ?? payload?.allowPublish ?? payload?.canPublish ?? null,
                  videoGrant: payload?.video
                })
              }
            } catch (e) {
              console.warn('[useLiveKitSession] Failed to decode tokenOverride', e)
            }
          } else {
            console.log('[useLiveKitSession] no tokenOverride provided; token details will be logged by service')
          }
        } catch (e) {
          console.warn('[useLiveKitSession] debug logging failed', e)
        }

        // Fix A/C: Connect with autoPublish: false to allow granular publishing control
        // We cast to any because the interface update might not be reflected in this file's type inference yet
        const connectedService = await connect(options.roomName, options.user, {
          allowPublish,
          preflightStream: mediaStream,
          autoPublish: false, // FORCE FALSE
          tokenOverride,
        }) as any

        if (!connectedService) {
          // ✅ CRITICAL: Check for session errors FIRST before any other processing
          // If connection skipped (null return), we might not have a service error.
          const serviceError = connectedService?.getLastConnectionError?.() || service?.getLastConnectionError?.() || null
          const rawError = serviceError || error || ''
          const errorToCheck = String(rawError).toLowerCase().trim()
          
          // Comprehensive check for session-related errors (expected on load/refresh)
          const isSessionError = !errorToCheck || // Empty error is fine (skipped)
                                errorToCheck.includes('session') || 
                                errorToCheck.includes('sign in') || 
                                errorToCheck.includes('no active session') || 
                                errorToCheck.includes('no valid user session') ||
                                errorToCheck.includes('please sign in again') ||
                                errorToCheck.includes('session expired') ||
                                errorToCheck.includes('session validation') ||
                                errorToCheck.includes('no valid user session found') ||
                                errorToCheck.includes('active session')
          
          if (isSessionError) {
            console.log('[useLiveKitSession] No session yet or skipped — will retry after login')
            joinStartedRef.current = false
            return false
          }
          
          // If we get here, it's a REAL error
          const room = (typeof getRoom === 'function' && getRoom()) || connectedService?.getRoom?.() || service?.getRoom?.()
          
          console.error('[useLiveKitSession] ❌ connect returned false/null. Full failure details:', {
            error: rawError,
            serviceError,
            roomState: room?.state,
            roomName: options.roomName,
            identity: options.user?.identity,
          })
          
          let userMessage = 'LiveKit connection failed'
          if (errorToCheck.includes('token')) userMessage = 'Failed to get LiveKit token.'
          else if (errorToCheck.includes('network')) userMessage = 'Network error connecting to LiveKit.'
          else if (errorToCheck.includes('timeout')) userMessage = 'Connection timeout.'
          else userMessage = `Connection failed: ${errorToCheck}`
          
          toast.error(userMessage, { duration: 6000 })
          joinStartedRef.current = false
          setSessionError(rawError)
          return false
        }

        console.log('[useLiveKitSession] LiveKit connected')
        const activeService = connectedService || service
        const room = activeService?.getRoom?.() || (typeof getRoom === 'function' && getRoom())
        
        if (!room) throw new Error('LiveKit room missing after connect')

        // Limit room size
        if (participants.size > maxParticipants) {
          disconnect()
          throw new Error('Room is full')
        }

        if (allowPublish && autoPublish) {
          if (publishInProgressRef.current) return true
          publishInProgressRef.current = true
          if (activeService) activeService.publishingInProgress = true

          try {
              console.log('[useLiveKitSession] Publishing local tracks via LiveKit session', {
                hasPreflightStream: !!mediaStream,
                preflightStreamActive: mediaStream?.active
              })
              
              if (mediaStream && mediaStream.active) {
                 // Fix C: Use helper methods on the active service
                 console.log('[useLiveKitSession] 📹 Publishing split tracks from preflight stream');
                 
                 const videoTrack = mediaStream.getVideoTracks()[0];
                 if (videoTrack && activeService?.publishVideoTrack) {
                    await activeService.publishVideoTrack(videoTrack);
                 }

                 // Fix A: Tiny delay between video and audio
                 await new Promise(r => setTimeout(r, 150));

                 const audioTrack = mediaStream.getAudioTracks()[0];
                 if (audioTrack && activeService?.publishAudioTrack) {
                    await activeService.publishAudioTrack(audioTrack);
                 }
              } else {
                 // Fallback to startPublishing if no stream provided
                 console.log('[useLiveKitSession] No preflight stream, capturing new tracks');
                 await startPublishing(); 
              }

              console.log('[useLiveKitSession] Local tracks published')
          } catch (spErr: any) {
            console.error('[useLiveKitSession] Publishing failed', spErr)
            throw new Error(`Failed to publish tracks: ${spErr?.message || 'Unknown error'}`)
          } finally {
             publishInProgressRef.current = false
             if (activeService) activeService.publishingInProgress = false
          }
        } else if (allowPublish && !autoPublish) {
          console.log('[useLiveKitSession] Publishing allowed but autoPublish disabled – skipping local track enable')
        } else {
          console.log('[useLiveKitSession] Joined LiveKit without publishing (viewer mode)')
        }

        return true
      } catch (err: any) {
        console.error('[useLiveKitSession] connect failed', err)
        const errorMsg = err?.message || 'Failed to join stream'
        setSessionError(errorMsg)
        joinStartedRef.current = false
        // Preserve existing behavior for non-connect errors by re-throwing
        throw err
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

  const joinOnly = useMemo(
    () => async () => {
      if (joinStartedRef.current) throw new Error('Join already in progress')
      if (!options.roomName || !options.user?.identity) {
        const msg = 'Missing room or user for LiveKit'
        setSessionError(msg)
        throw new Error(msg)
      }

      console.log('[useLiveKitSession] joinOnly triggered', { roomName: options.roomName })
      joinStartedRef.current = true
      setSessionError(null)

      try {
        console.log('[useLiveKitSession] connecting (viewer only)')
        const connected = await connect(options.roomName, options.user, {
          allowPublish: false,
          preflightStream: undefined,
          autoPublish: false,
        })
        if (!connected) throw new Error('LiveKit connection failed')

        console.log('[useLiveKitSession] joinOnly connected')
        return true
      } catch (err: any) {
        console.error('[useLiveKitSession] connect failed', err)
        setSessionError(err?.message || 'Failed to join stream')
        joinStartedRef.current = false
        return false
      }
    },
    [connect, options.roomName, options.user]
  )

  const resetJoinGuard = () => {
    joinStartedRef.current = false
  }

  // Guarded disconnect to prevent cutting off mid-publish
  const guardedDisconnect = () => {
    if (publishInProgressRef.current) {
      console.warn("🚫 Prevented disconnect during publish (hook guard)")
      return
    }
    disconnect()
  }

  useEffect(() => {
    return () => {
      joinStartedRef.current = false
    }
  }, [])

  return {
    joinAndPublish,
    joinOnly,
    resetJoinGuard,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error: sessionError || error,
    toggleCamera,
    toggleMicrophone,
    startPublishing,
    disconnect: guardedDisconnect,
  }
}
