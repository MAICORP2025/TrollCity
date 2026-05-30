import { useState, useRef, useCallback, useEffect } from 'react'
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  IMicrophoneAudioTrack,
  UID
} from 'agora-rtc-sdk-ng'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'

interface PodcastAgoraConfig {
  channelName: string
  enabled: boolean
  isHost?: boolean
  podcastId?: string
  onUserJoined?: (user: IAgoraRTCRemoteUser) => void
  onUserLeft?: (user: IAgoraRTCRemoteUser) => void
  onError?: (error: string) => void
}

export function usePodcastAgora({
  channelName,
  enabled,
  isHost = false,
  podcastId,
  onUserJoined,
  onUserLeft,
  onError
}: PodcastAgoraConfig) {
  // State
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)

  // Auth
  const user = useAuthStore(state => state.user)
  const profile = useAuthStore(state => state.profile)

  // Refs
  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const joinedRef = useRef(false)
  const joiningRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  // Get Agora app ID
  const getAgoraAppId = () => import.meta.env.VITE_AGORA_APP_ID

  const debugAgora = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args)
    }
  }

  // Initialize Agora client - audio-only mode
  const initAgoraClient = useCallback(async () => {
    try {
      const appId = getAgoraAppId()
      if (!appId) {
        throw new Error('VITE_AGORA_APP_ID not configured')
      }

      debugAgora('[PodcastAgora] Initializing Agora client (audio-only)')

      // Create client for audio mode
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

      // Event handlers
      client.on('user-joined', (user) => {
        debugAgora('[PodcastAgora] User joined:', user.uid)
        setRemoteUsers(prev => [...prev, user])
        onUserJoined?.(user)
      })

      client.on('user-left', (user) => {
        debugAgora('[PodcastAgora] User left:', user.uid)
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid))
        onUserLeft?.(user)
      })

      client.on('user-published', async (user, mediaType) => {
        debugAgora('[PodcastAgora] User published:', user.uid, mediaType)
        try {
          await client.subscribe(user, mediaType)
          debugAgora('[PodcastAgora] Subscribed to:', user.uid, mediaType)
          if (mediaType === 'audio') {
            const audioTrack = user.audioTrack
            if (audioTrack) {
              if (isMutedRef.current || !isPlayingRef.current) {
                audioTrack.setVolume(0)
              } else {
                audioTrack.setVolume(volumeRef.current)
                audioTrack.play()
              }
              setIsPlaying(true)
            }
          }
        } catch (subErr) {
          console.error('[PodcastAgora] Subscribe error:', subErr)
        }
      })

      client.on('user-subscribed', (user, mediaType) => {
        debugAgora('[PodcastAgora] User subscribed event:', user.uid, mediaType)
        if (mediaType === 'audio' && user.audioTrack) {
          if (isMutedRef.current || !isPlayingRef.current) {
            user.audioTrack.setVolume(0)
          } else {
            user.audioTrack.setVolume(volumeRef.current)
            user.audioTrack.play()
          }
          setIsPlaying(true)
        }
      })
      clientRef.current = client
      return client
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to initialize Agora client'
      console.error('[PodcastAgora] Initialization error:', errMsg)
      setError(errMsg)
      onError?.(errMsg)
      throw err
    }
  }, [onError, onUserJoined, onUserLeft])

  // Fetch Agora token
  const fetchAgoraToken = useCallback(async (channel: string, uid: UID, podcastId?: string) => {
    try {
      debugAgora('[PodcastAgora] Fetching Agora token for channel:', channel, 'uid:', uid)

      const { data, error: tokenError } = await supabase.functions.invoke('agora-token', {
        body: {
          channelName: channel,
          userId: uid.toString(),
          role: isHost ? 'publisher' : 'subscriber',
          podcastId: podcastId
        }
      })

      if (tokenError) {
        console.error('[PodcastAgora] Token fetch error:', tokenError)
        // Log to podcast_rtc_logs
        await supabase.from('podcast_rtc_logs').insert({
          podcast_id: podcastId || null,
          user_id: user?.id || null,
          username: profile?.username || null,
          role: profile?.role || null,
          level: profile?.level || null,
          event_type: 'agora_token_error',
          message: `Agora token fetch failed: ${tokenError.message}`,
          metadata: { channelName: channel, uid }
        })
        throw new Error(`Token error: ${tokenError.message}`)
      }

      if (!data?.token) {
        throw new Error('No token in response')
      }

      debugAgora('[PodcastAgora] Token received successfully')
      return data
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch Agora token'
      setError(errMsg)
      onError?.(errMsg)
      throw err
    }
  }, [isHost, onError, user, profile])

  // Convert user ID to numeric UID
  const getUserUid = (uid: string): UID => {
    let hash = 0
    for (let i = 0; i < uid.length; i++) {
      hash = (hash << 5) - hash + uid.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash) % 4294967295
  }

  // Join podcast channel
  const joinPodcast = useCallback(async (podcastIdArg?: string) => {
    const resolvedPodcastId = podcastIdArg || podcastId
    if (joiningRef.current || joinedRef.current) return
    if (!channelName) {
      console.error('[PodcastAgora] No channel name provided')
      return
    }

    joiningRef.current = true
    setIsJoining(true)

    try {
      debugAgora('[PodcastAgora] Joining channel:', channelName)

      // Initialize client
      let client = clientRef.current
      if (!client) {
        client = await initAgoraClient()
      }

      // Get numeric UID
      const uid = getUserUid(user?.id || 'anonymous')

      // Fetch token
      const appId = getAgoraAppId()
      if (!appId) {
        throw new Error('Agora App ID not configured')
      }

      const { token } = await fetchAgoraToken(channelName, uid, resolvedPodcastId)

      // Join channel
      const joinPromise = client.join(appId, channelName, token, uid)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Join timeout')), 15000)
      )

      await Promise.race([joinPromise, timeoutPromise])
      debugAgora('[PodcastAgora] Joined channel successfully')

      if (isHost) {
        try {
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack()
          audioTrackRef.current = audioTrack
          await client.publish([audioTrack])
          debugAgora('[PodcastAgora] Published local microphone track as host')
        } catch (trackError) {
          console.error('[PodcastAgora] Failed to publish local microphone track:', trackError)
          setError('Could not access microphone for podcast host')
        }
      }

      setIsConnected(true)
      joinedRef.current = true
      startTimeRef.current = Date.now()

      // Start elapsed time timer
      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }
      }, 1000)

      // Log join success
      await supabase.from('podcast_rtc_logs').insert({
        podcast_id: resolvedPodcastId || null,
        user_id: user?.id || null,
        username: profile?.username || null,
        role: profile?.role || null,
        level: profile?.level || null,
        event_type: 'podcast_joined',
        message: `User joined podcast`,
        metadata: { channelName, uid }
      })

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to join podcast'
      console.error('[PodcastAgora] Join error:', errMsg)
      setError(errMsg)
      toast.error('Failed to connect to podcast: ' + errMsg)
      
      // Log join failure
      await supabase.from('podcast_rtc_logs').insert({
        podcast_id: resolvedPodcastId || null,
        user_id: user?.id || null,
        username: profile?.username || null,
        role: profile?.role || null,
        level: profile?.level || null,
        event_type: 'agora_join_failed',
        message: errMsg,
        metadata: { channelName, uid: user?.id }
      })
    } finally {
      joiningRef.current = false
      setIsJoining(false)
    }
  }, [channelName, fetchAgoraToken, initAgoraClient, user, profile])

  // Leave podcast channel
  const leavePodcast = useCallback(async () => {
    if (!joinedRef.current || !clientRef.current) return

    try {
      debugAgora('[PodcastAgora] Leaving channel')

      // Stop local audio track
      if (audioTrackRef.current) {
        audioTrackRef.current.stop()
        audioTrackRef.current.close()
        audioTrackRef.current = null
      }

      // Leave channel
      await clientRef.current.leave()

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      setIsConnected(false)
      setIsPlaying(false)
      setRemoteUsers([])
      joinedRef.current = false
      startTimeRef.current = null

      debugAgora('[PodcastAgora] Left channel successfully')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to leave podcast'
      console.error('[PodcastAgora] Leave error:', errMsg)
      setError(errMsg)
    }
  }, [])

  // Toggle mute — uses refs to avoid stale closures
  const toggleMute = useCallback(async () => {
    const nextMuted = !isMutedRef.current
    setIsMuted(nextMuted)
    isMutedRef.current = nextMuted

    debugAgora(`[PodcastAgora] Toggle mute: ${nextMuted ? 'muted' : 'unmuted'}`)

    // For host: enable/disable the local microphone track
    if (audioTrackRef.current) {
      try {
        audioTrackRef.current.setEnabled(!nextMuted)
        debugAgora(`[PodcastAgora] Host mic setEnabled: ${!nextMuted}`)
      } catch (err) {
        console.error('[PodcastAgora] Error setting host mic enabled:', err)
      }
    }

    // For listener: set volume on all remote audio tracks
    const client = clientRef.current
    if (client) {
      const allRemoteUsers = (client as any).remoteUsers as IAgoraRTCRemoteUser[] | undefined
      if (allRemoteUsers) {
        allRemoteUsers.forEach((remoteUser) => {
          const audioTrack = remoteUser.audioTrack
          if (audioTrack) {
            if (nextMuted || !isPlayingRef.current) {
              audioTrack.setVolume(0)
            } else {
              audioTrack.setVolume(volumeRef.current)
              try { audioTrack.play() } catch { /* already playing */ }
            }
          }
        })
      }
    }

    // Log mute/unmute (fire-and-forget)
    supabase.from('podcast_rtc_logs').insert({
      podcast_id: podcastId || null,
      user_id: user?.id || null,
      username: profile?.username || null,
      role: profile?.role || null,
      level: profile?.level || null,
      event_type: nextMuted ? 'podcast_muted' : 'podcast_unmuted',
      message: `User ${nextMuted ? 'muted' : 'unmuted'} podcast audio`,
      metadata: {}
    })
  }, [user, profile, podcastId])

  // Toggle play/pause — actually controls audio playback
  const togglePlay = useCallback(() => {
    const nextPlaying = !isPlayingRef.current
    setIsPlaying(nextPlaying)
    isPlayingRef.current = nextPlaying

    debugAgora(`[PodcastAgora] Toggle play: ${nextPlaying ? 'playing' : 'paused'}`)

    const client = clientRef.current
    if (client) {
      const allRemoteUsers = (client as any).remoteUsers as IAgoraRTCRemoteUser[] | undefined
      if (allRemoteUsers) {
        allRemoteUsers.forEach((remoteUser) => {
          const audioTrack = remoteUser.audioTrack
          if (audioTrack) {
            if (!nextPlaying || isMutedRef.current) {
              audioTrack.setVolume(0)
            } else {
              audioTrack.setVolume(volumeRef.current)
              try { audioTrack.play() } catch { /* already playing */ }
            }
          }
        })
      }
    }
  }, [])

  // Set volume — applies to all remote tracks immediately
  const handleSetVolume = useCallback((newVolume: number) => {
    setVolume(newVolume)
    volumeRef.current = newVolume

    if (!isMutedRef.current && isPlayingRef.current) {
      const client = clientRef.current
      if (client) {
        const allRemoteUsers = (client as any).remoteUsers as IAgoraRTCRemoteUser[] | undefined
        if (allRemoteUsers) {
          allRemoteUsers.forEach((remoteUser) => {
            if (remoteUser.audioTrack) {
              remoteUser.audioTrack.setVolume(newVolume)
            }
          })
        }
      }
    }
  }, [])

  // Apply current volume and mute state to all remote audio tracks
  const applyAudioStateToRemotes = useCallback(() => {
    const client = clientRef.current
    if (!client) return
    const allRemoteUsers = (client as any).remoteUsers as IAgoraRTCRemoteUser[] | undefined
    if (!allRemoteUsers) return
    allRemoteUsers.forEach((remoteUser) => {
      const audioTrack = remoteUser.audioTrack
      if (audioTrack) {
        if (isMutedRef.current || !isPlayingRef.current) {
          audioTrack.setVolume(0)
        } else {
          audioTrack.setVolume(volumeRef.current)
          try { audioTrack.play() } catch { /* already playing */ }
        }
      }
    })
  }, [])

  // When isMuted or isPlaying changes, apply to remote tracks
  useEffect(() => {
    if (!joinedRef.current) return
    applyAudioStateToRemotes()
  }, [isMuted, isPlaying, applyAudioStateToRemotes])

  // Auto-join when enabled and channel changes
  useEffect(() => {
    if (enabled && channelName && !joinedRef.current && !joiningRef.current) {
      joinPodcast()
    }

    return () => {
      if (!enabled) {
        leavePodcast()
      }
    }
  }, [enabled, channelName, joinPodcast, leavePodcast])

  useEffect(() => {
    if (!isHost && isMuted) {
      remoteUsers.forEach((remoteUser) => {
        remoteUser.audioTrack?.setVolume(0)
      })
    }
  }, [isHost, isMuted, remoteUsers])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      leavePodcast()
    }
  }, [])

  return {
    isConnected,
    isPlaying,
    isMuted,
    volume,
    elapsedTime,
    remoteUsers,
    error,
    isJoining,
    joinPodcast,
    leavePodcast,
    togglePlay,
    toggleMute,
    setVolume: handleSetVolume
  }
}
