import { Room, RoomEvent, Track } from 'livekit-client'
import api from './api'

export interface RoomConfig {
  roomName: string
  participantName: string
  allowPublish: boolean
  userId?: string
  role?: string
}

export interface RoomInstance {
  id: string
  room: Room
  roomName: string
  isConnected: boolean
  createdAt: number
}

class RoomManager {
  private rooms: Map<string, RoomInstance> = new Map()
  private livekitUrl: string | null = null

  async createBroadcastRoom(userId: string, username: string, _category: string): Promise<RoomInstance> {
    const roomName = `broadcast-${userId}-${Date.now()}`
    return this.createRoom({
      roomName,
      participantName: username,
      allowPublish: true,
      userId,
      role: 'broadcaster'
    })
  }

  async createOfficerRoom(officerId: string, officerName: string): Promise<RoomInstance> {
    const roomName = `officer-${officerId}-${Date.now()}`
    return this.createRoom({
      roomName,
      participantName: officerName,
      allowPublish: true,
      userId: officerId,
      role: 'officer'
    })
  }

  async createCourtRoom(): Promise<RoomInstance> {
    const roomName = `court-${Date.now()}`
    return this.createRoom({
      roomName,
      participantName: 'Judge',
      allowPublish: true,
      role: 'court'
    })
  }

  private async createRoom(config: RoomConfig): Promise<RoomInstance> {
    try {
      console.log(`[RoomManager] Creating room: ${config.roomName}`)
      
      const tokenResponse = await api.post('/livekit-token', {
        room: config.roomName,
        identity: config.userId || config.participantName,
        role: config.allowPublish ? 'host' : 'guest',
      })

      if (tokenResponse.error || !tokenResponse.token) {
        throw new Error(tokenResponse.error || 'Failed to get LiveKit token')
      }

      if (!tokenResponse.url) {
        throw new Error('LiveKit URL missing from token response')
      }

      console.log(`[RoomManager] Got token for room: ${config.roomName}`)

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: true,
      })

      this.livekitUrl = tokenResponse.url
      await room.connect(this.livekitUrl, tokenResponse.token)
      
      const instanceId = `${config.roomName}-${Date.now()}`
      const instance: RoomInstance = {
        id: instanceId,
        room,
        roomName: config.roomName,
        isConnected: true,
        createdAt: Date.now()
      }

      this.rooms.set(instanceId, instance)
      console.log(`✅ [RoomManager] Room created and connected: ${config.roomName}`)

      room.on(RoomEvent.Disconnected, () => {
        console.log(`[RoomManager] Room disconnected: ${config.roomName}`)
        instance.isConnected = false
      })

      return instance
    } catch (error) {
      console.error('[RoomManager] Room creation error:', error)
      throw error
    }
  }

  async publishLocalTracks(roomId: string, stream: MediaStream): Promise<void> {
    const instance = this.rooms.get(roomId)
    if (!instance || !instance.isConnected) {
      throw new Error('Room not found or not connected')
    }

    try {
      console.log(`[RoomManager] Publishing tracks to room: ${instance.roomName}`)
      
      for (const track of stream.getTracks()) {
        try {
          if (track.kind === 'video') {
            await instance.room.localParticipant.publishTrack(track, {
              name: 'camera',
              source: Track.Source.Camera,
            })
            console.log(`✅ [RoomManager] Published video track (camera)`)
          } else if (track.kind === 'audio') {
            await instance.room.localParticipant.publishTrack(track, {
              name: 'microphone',
              source: Track.Source.Microphone,
            })
            console.log(`✅ [RoomManager] Published audio track (microphone)`)
          } else {
            console.log(`[RoomManager] Skipping unsupported track kind=${track.kind}`)
          }
        } catch (trackErr) {
          console.error(`[RoomManager] Failed to publish ${track.kind} track:`, trackErr)
        }
      }
      
      console.log(`✅ [RoomManager] All tracks published to: ${instance.roomName}`)
    } catch (error) {
      console.error('[RoomManager] Track publishing error:', error)
      throw error
    }
  }

  getRoomInstance(roomId: string): RoomInstance | undefined {
    return this.rooms.get(roomId)
  }

  async disconnectRoom(roomId: string): Promise<void> {
    const instance = this.rooms.get(roomId)
    if (!instance) return

    try {
      console.log(`[RoomManager] Disconnecting room: ${instance.roomName}`)
      instance.room.disconnect()
      instance.isConnected = false
      this.rooms.delete(roomId)
      console.log(`✅ [RoomManager] Room disconnected: ${instance.roomName}`)
    } catch (error) {
      console.error('[RoomManager] Disconnection error:', error)
    }
  }

  disconnect() {
    for (const [id, instance] of this.rooms.entries()) {
      try {
        instance.room.disconnect()
      } catch (error) {
        console.error(`[RoomManager] Error disconnecting room ${id}:`, error)
      }
    }
    this.rooms.clear()
  }

  getActiveRooms(): RoomInstance[] {
    return Array.from(this.rooms.values()).filter(r => r.isConnected)
  }

  getRoomByName(roomName: string): RoomInstance | undefined {
    return Array.from(this.rooms.values()).find(r => r.roomName === roomName)
  }
}

export const roomManager = new RoomManager()
