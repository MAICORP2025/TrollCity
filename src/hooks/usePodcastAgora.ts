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
  onUserJoined?: (user: IAgoraRTCRemoteUser) => void
  onUserLeft?: (user: IAgoraRTCRemoteUser) => void
  onError?: (error: string) => void
}

export function usePodcastAgora({
  channelName,
  enabled,
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
        await client.subscribe(user, mediaType)
        if (mediaType === 'audio') {
          const audioTrack = user.audioTrack
          if (audioTrack) {
            audioTrack.play()
            setIsPlaying(true)
          }
        }
      })

      client.on('user-unpublished', (user, mediaType) => {
        debugAgora('[PodcastAgora] User unpublished:', user.uid, mediaType)
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
          role: 'subscriber',
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
  }, [onError, user, profile])

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
  const joinPodcast = useCallback(async (podcastId?: string) => {
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

      const { token } = await fetchAgoraToken(channelName, uid, podcastId)

      // Join channel
      const joinPromise = client.join(appId, channelName, token, uid)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Join timeout')), 15000)
      )

      await Promise.race([joinPromise, timeoutPromise])
      debugAgora('[PodcastAgora] Joined channel successfully')

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
        podcast_id: podcastId || null,
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
        podcast_id: podcastId || null,
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

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!audioTrackRef.current && !clientRef.current) return

    try {
      const wasMuted = isMuted
      setIsMuted(!wasMuted)

      // Log mute/unmute
      await supabase.from('podcast_rtc_logs').insert({
        podcast_id: null,
        user_id: user?.id || null,
        username: profile?.username || null,
        role: profile?.role || null,
        level: profile?.level || null,
        event_type: wasMuted ? 'podcast_unmuted' : 'podcast_muted',
        message: `User ${wasMuted ? 'unmuted' : 'muted'} podcast audio`,
        metadata: {}
      })
    } catch (err) {
      console.error('[PodcastAgora] Mute error:', err)
    }
  }, [isMuted, user, profile])

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  // Set volume
  const handleSetVolume = useCallback((newVolume: number) => {
    setVolume(newVolume)
    // Apply volume to remote audio tracks
    remoteUsers.forEach(user => {
      if (user.audioTrack) {
        user.audioTrack.setVolume(newVolume)
      }
    })
  }, [remoteUsers])

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