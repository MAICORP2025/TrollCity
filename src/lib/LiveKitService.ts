import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from 'livekit-client'
import { LIVEKIT_URL, defaultLiveKitOptions } from './LiveKitConfig'
import api from './api'

export interface LiveKitParticipant {
  identity: string
  name?: string
  isLocal: boolean
  // IMPORTANT: your UI expects participant.videoTrack.track
  // so we store tracks as { track } consistently for local + remote.
  videoTrack?: { track: any } // LocalVideoTrack | RemoteVideoTrack
  audioTrack?: { track: any } // LocalAudioTrack | RemoteAudioTrack
  isCameraEnabled: boolean
  isMicrophoneEnabled: boolean
  isMuted: boolean
}

export interface LiveKitServiceConfig {
  roomName: string
  identity: string
  user?: any
  onConnected?: () => void
  onDisconnected?: () => void
  onParticipantJoined?: (participant: LiveKitParticipant) => void
  onParticipantLeft?: (participant: LiveKitParticipant) => void
  onTrackSubscribed?: (track: any, participant: LiveKitParticipant) => void
  onTrackUnsubscribed?: (track: any, participant: LiveKitParticipant) => void
  onError?: (error: string) => void
  autoPublish?: boolean // Whether to immediately publish camera/mic
}

export class LiveKitService {
  private room: Room | null = null
  private config: LiveKitServiceConfig
  private participants: Map<string, LiveKitParticipant> = new Map()
  private localVideoTrack: LocalVideoTrack | null = null
  private localAudioTrack: LocalAudioTrack | null = null
  private isConnecting = false

  constructor(config: LiveKitServiceConfig) {
    this.config = {
      autoPublish: false,
      ...config,
    }

    this.log('LiveKitService initialized', {
      roomName: config.roomName,
      identity: config.identity,
      userId: config.user?.id,
    })
  }

  // Main connection method
  async connect(): Promise<boolean> {
    if (this.isConnecting || this.room?.state === 'connected') {
      this.log('Already connecting or connected')
      return true
    }

    this.isConnecting = true
    this.log('Starting connection process...')

    try {
      // Step 1: Get LiveKit token
      const tokenResponse = await this.getToken()
      if (!tokenResponse?.token) {
        throw new Error('Failed to get LiveKit token')
      }

      // Step 2: Create room with configuration
      // NOTE: Do NOT spread this.config into Room() because it contains non-Room keys (callbacks/user/etc).
      // Keep your original intent but avoid invalid options.
      this.room = new Room({
        ...defaultLiveKitOptions,
      })

      // Step 3: Set up event listeners BEFORE connecting
      this.setupEventListeners()

      // Step 4: Connect to room
      this.log('Connecting to LiveKit room...')
      await this.room.connect(LIVEKIT_URL, tokenResponse.token)

      // Ensure local participant exists in map as soon as we connect
      this.updateLocalParticipantState()

      // If autoPublish requested, publish immediately
      if (this.config.autoPublish) {
        try {
          await this.startPublishing()
        } catch (e: any) {
          // startPublishing already logs + onError
          this.log('AutoPublish failed (continuing connected state):', e?.message)
        }
      }

      this.log('✅ Connection successful')
      this.config.onConnected?.()
      this.isConnecting = false
      return true
    } catch (error: any) {
      this.log('❌ Connection failed:', error.message)
      this.config.onError?.(error.message || 'Failed to connect to stream')
      this.isConnecting = false
      return false
    }
  }

  // IMMEDIATE media capture and publishing - no previews, no delays
  // (kept exactly as your original design; not required if using startPublishing only)
  private async immediateMediaCaptureAndPublish(): Promise<void> {
    if (!this.room || this.room.state !== 'connected') {
      throw new Error('Room not connected')
    }

    this.log('🎥 Starting immediate media capture and publishing...')

    try {
      // Capture camera and microphone simultaneously
      const [videoTrack, audioTrack] = await Promise.all([
        this.captureVideoTrack(),
        this.captureAudioTrack(),
      ])

      // Store references to prevent garbage collection
      this.localVideoTrack = videoTrack
      this.localAudioTrack = audioTrack

      // Publish tracks immediately
      if (videoTrack) {
        await this.publishVideoTrack(videoTrack)
      }

      if (audioTrack) {
        await this.publishAudioTrack(audioTrack)
      }

      // Update local participant state
      this.updateLocalParticipantState()

      this.log('✅ Media capture and publishing complete')
    } catch (error: any) {
      this.log('❌ Media capture/publishing failed:', error.message)
      this.config.onError?.(`Media access failed: ${error.message}`)

      // Clean up any tracks that were created
      if (this.localVideoTrack) {
        this.localVideoTrack.stop()
        this.localVideoTrack = null
      }
      if (this.localAudioTrack) {
        this.localAudioTrack.stop()
        this.localAudioTrack = null
      }

      throw error
    }
  }

  // Capture video track with immediate constraints
  private async captureVideoTrack(): Promise<LocalVideoTrack | null> {
    try {
      this.log('📹 Capturing video track...')
      const track = await createLocalVideoTrack({
        facingMode: 'user',
        resolution: { width: 1280, height: 720 },
        frameRate: { ideal: 30, max: 60 },
      } as any)
      this.log('✅ Video track captured')
      return track
    } catch (error: any) {
      this.log('❌ Video capture failed:', error.message)
      throw new Error(`Camera access failed: ${error.message}`)
    }
  }

  // Capture audio track with immediate constraints
  private async captureAudioTrack(): Promise<LocalAudioTrack | null> {
    try {
      this.log('🎤 Capturing audio track...')
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as any)
      this.log('✅ Audio track captured')
      return track
    } catch (error: any) {
      this.log('❌ Audio capture failed:', error.message)
      throw new Error(`Microphone access failed: ${error.message}`)
    }
  }

  // Publish video track
  private async publishVideoTrack(track: LocalVideoTrack): Promise<void> {
    if (!this.room?.localParticipant) {
      throw new Error('No local participant available')
    }

    try {
      this.log('📤 Publishing video track...')
      await this.room.localParticipant.publishTrack(track as any)
      this.log('✅ Video track published')
    } catch (error: any) {
      this.log('❌ Video publishing failed:', error.message)
      track.stop()
      throw error
    }
  }

  // Publish audio track
  private async publishAudioTrack(track: LocalAudioTrack): Promise<void> {
    if (!this.room?.localParticipant) {
      throw new Error('No local participant available')
    }

    try {
      this.log('📤 Publishing audio track...')
      await this.room.localParticipant.publishTrack(track as any)
      this.log('✅ Audio track published')
    } catch (error: any) {
      this.log('❌ Audio publishing failed:', error.message)
      track.stop()
      throw error
    }
  }

  // ✅ FIXED: Store tracks consistently as { track } for UI compatibility
  private updateLocalParticipantState(): void {
    if (!this.room?.localParticipant) return

    const p = this.room.localParticipant

    const localParticipant: LiveKitParticipant = {
      identity: p.identity,
      name: this.config.user?.username || this.config.user?.email || 'You',
      isLocal: true,
      videoTrack: this.localVideoTrack ? { track: this.localVideoTrack } : undefined,
      audioTrack: this.localAudioTrack ? { track: this.localAudioTrack } : undefined,
      isCameraEnabled: p.isCameraEnabled,
      isMicrophoneEnabled: p.isMicrophoneEnabled,
      isMuted: !p.isMicrophoneEnabled,
    }

    this.participants.set(localParticipant.identity, localParticipant)
  }

  // Set up all event listeners
  private setupEventListeners(): void {
    if (!this.room) return

    this.room.on(RoomEvent.Connected, () => {
      this.log('📡 Room connected')
      this.isConnecting = false
      // ensure local participant is registered
      this.updateLocalParticipantState()
    })

    this.room.on(RoomEvent.Disconnected, () => {
      this.log('📡 Room disconnected')
      this.cleanup()
      this.config.onDisconnected?.()
    })

    this.room.on(RoomEvent.ParticipantConnected, (participant: any) => {
      this.log('👤 Participant joined:', participant.identity)

      const liveKitParticipant: LiveKitParticipant = {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: false,
        isCameraEnabled: participant.isCameraEnabled,
        isMicrophoneEnabled: participant.isMicrophoneEnabled,
        isMuted: !participant.isMicrophoneEnabled,
      }

      this.participants.set(participant.identity, liveKitParticipant)
      this.config.onParticipantJoined?.(liveKitParticipant)
    })

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
      this.log('👤 Participant left:', participant.identity)
      const liveKitParticipant = this.participants.get(participant.identity)
      if (liveKitParticipant) {
        this.participants.delete(participant.identity)
        this.config.onParticipantLeft?.(liveKitParticipant)
      }
    })

    // ✅ FIXED: store remote tracks as { track } to match UI expectations
    this.room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
      this.log('📥 Track subscribed:', track.kind, participant.identity)
      const liveKitParticipant = this.participants.get(participant.identity)
      if (liveKitParticipant) {
        if (track.kind === 'video') {
          liveKitParticipant.videoTrack = { track }
        } else if (track.kind === 'audio') {
          liveKitParticipant.audioTrack = { track }
        }
        this.config.onTrackSubscribed?.(track, liveKitParticipant)
      }
    })

    this.room.on(RoomEvent.TrackUnsubscribed, (track: any, publication: any, participant: any) => {
      this.log('📤 Track unsubscribed:', track.kind, participant.identity)
      const liveKitParticipant = this.participants.get(participant.identity)
      if (liveKitParticipant) {
        // Clear the corresponding reference if it matches
        if (track.kind === 'video' && liveKitParticipant.videoTrack?.track === track) {
          liveKitParticipant.videoTrack = undefined
        }
        if (track.kind === 'audio' && liveKitParticipant.audioTrack?.track === track) {
          liveKitParticipant.audioTrack = undefined
        }
        this.config.onTrackUnsubscribed?.(track, liveKitParticipant)
      }
    })

    // Connection quality monitoring
    this.room.on(RoomEvent.ConnectionQualityChanged, (quality: any, participant: any) => {
      this.log('📊 Connection quality changed:', quality, participant?.identity)
    })
  }

  // ✅ FIXED: Identity must match config.identity (the identity used by the client)
  private async getToken(): Promise<any> {
    try {
      const response = await api.post('/livekit-token', {
        room: this.config.roomName,
        identity: this.config.identity, // ✅ FIXED
        user_id: this.config.user?.id,
        role: this.config.user?.role || this.config.user?.troll_role || 'viewer',
        level: this.config.user?.level || 1,
      })

      if (!response.token) {
        throw new Error('No token received from server')
      }

      return response
    } catch (error: any) {
      this.log('❌ Token fetch failed:', error.message)
      throw new Error(`Authentication failed: ${error.message}`)
    }
  }

  // Public control methods
  async toggleCamera(): Promise<boolean> {
    if (!this.room?.localParticipant) return false

    try {
      const enabled = !this.room.localParticipant.isCameraEnabled
      await this.room.localParticipant.setCameraEnabled(enabled)

      // If disabling, clear the track reference since it's stopped
      if (!enabled) {
        this.localVideoTrack = null
      }

      // If we toggled ON and we have no stored local track yet, try capture+publish
      if (enabled && !this.localVideoTrack) {
        const track = await this.captureVideoTrack()
        if (track) {
          this.localVideoTrack = track
          await this.publishVideoTrack(track)
        }
      }

      this.updateLocalParticipantState()
      this.log(`📹 Camera ${enabled ? 'enabled' : 'disabled'}`)
      return enabled
    } catch (error: any) {
      this.log('❌ Camera toggle failed:', error.message)
      return false
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) return false

    try {
      const enabled = !this.room.localParticipant.isMicrophoneEnabled
      await this.room.localParticipant.setMicrophoneEnabled(enabled)

      // If disabling, clear the track reference since it's stopped
      if (!enabled) {
        this.localAudioTrack = null
      }

      // If we toggled ON and we have no stored local track yet, try capture+publish
      if (enabled && !this.localAudioTrack) {
        const track = await this.captureAudioTrack()
        if (track) {
          this.localAudioTrack = track
          await this.publishAudioTrack(track)
        }
      }

      this.updateLocalParticipantState()
      this.log(`🎤 Microphone ${enabled ? 'enabled' : 'disabled'}`)
      return enabled
    } catch (error: any) {
      this.log('❌ Microphone toggle failed:', error.message)
      return false
    }
  }

  // Start publishing camera and microphone - user-triggered
  async startPublishing(): Promise<void> {
    if (!this.room || this.room.state !== 'connected') {
      throw new Error('Room not connected')
    }

    this.log('🎥 Starting user-triggered media publishing...')

    try {
      // Capture camera and microphone simultaneously
      const [videoTrack, audioTrack] = await Promise.all([
        this.captureVideoTrack(),
        this.captureAudioTrack(),
      ])

      // Store references
      this.localVideoTrack = videoTrack
      this.localAudioTrack = audioTrack

      // Publish tracks
      if (videoTrack) {
        await this.publishVideoTrack(videoTrack)
      }

      if (audioTrack) {
        await this.publishAudioTrack(audioTrack)
      }

      // Enable tracks after publishing
      await this.room.localParticipant.setCameraEnabled(true)
      await this.room.localParticipant.setMicrophoneEnabled(true)

      // Update local participant state (✅ ensures UI gets {track: ...})
      this.updateLocalParticipantState()

      this.log('✅ User-triggered publishing complete')
    } catch (error: any) {
      this.log('❌ Publishing failed:', error.message)
      this.config.onError?.(`Media publishing failed: ${error.message}`)

      // Clean up tracks
      if (this.localVideoTrack) {
        this.localVideoTrack.stop()
        this.localVideoTrack = null
      }
      if (this.localAudioTrack) {
        this.localAudioTrack.stop()
        this.localAudioTrack = null
      }

      // Update local participant state to remove tracks
      this.updateLocalParticipantState()

      throw error
    }
  }

  // Get current state
  getRoom(): Room | null {
    return this.room
  }

  getParticipants(): Map<string, LiveKitParticipant> {
    return this.participants
  }

  isConnected(): boolean {
    return this.room?.state === 'connected'
  }

  getLocalParticipant(): LiveKitParticipant | null {
    if (!this.room?.localParticipant) return null
    return this.participants.get(this.room.localParticipant.identity) || null
  }

  // Cleanup and disconnect
  disconnect(): void {
    this.log('🔌 Disconnecting from LiveKit room...')

    if (this.room) {
      try {
        this.room.disconnect()
      } catch (error: any) {
        this.log('❌ Disconnect error:', error.message)
      }
    }

    this.cleanup()
  }

  private cleanup(): void {
    // Clean up tracks
    if (this.localVideoTrack) {
      this.localVideoTrack.stop()
      this.localVideoTrack = null
    }

    if (this.localAudioTrack) {
      this.localAudioTrack.stop()
      this.localAudioTrack = null
    }

    // Clear participants
    this.participants.clear()

    // Reset state
    this.room = null
    this.isConnecting = false
  }

  // Logging utility
  private log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString()
    const roomInfo = this.config.roomName ? `[${this.config.roomName}]` : ''
    console.log(`🔴 LiveKit ${timestamp} ${roomInfo} ${message}`, ...args)
  }

  // Cleanup on destroy
  destroy(): void {
    this.disconnect()
  }
}

// Factory function for easy service creation
export function createLiveKitService(config: LiveKitServiceConfig): LiveKitService {
  return new LiveKitService(config)
}
