import { useState, useEffect, useCallback, useRef } from 'react';
import { createLiveKitService, LiveKitService, LiveKitParticipant } from '../lib/LiveKitService';

export interface UnifiedLiveKitConfig {
  roomName: string;
  user: any;
  autoPublish?: boolean;
  maxReconnectAttempts?: number;
}

export function useUnifiedLiveKit(config: UnifiedLiveKitConfig) {
  const [service, setService] = useState<LiveKitService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<Map<string, LiveKitParticipant>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [localParticipant, setLocalParticipant] = useState<LiveKitParticipant | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  // Initialize service
  useEffect(() => {
    if (!config.roomName || !config.user) {
      return;
    }

    console.log('🎥 Initializing unified LiveKit service for room:', config.roomName);

    const liveKitService = createLiveKitService({
      roomName: config.roomName,
      user: config.user,
      autoPublish: config.autoPublish !== false, // Default to true
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      onConnected: () => {
        console.log('✅ LiveKit connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      },
      onDisconnected: () => {
        console.log('❌ LiveKit disconnected');
        setIsConnected(false);
        setIsConnecting(false);
      },
      onParticipantJoined: (participant) => {
        console.log('👤 Participant joined:', participant.identity);
        setParticipants(prev => new Map(prev.set(participant.identity, participant)));
      },
      onParticipantLeft: (participant) => {
        console.log('👤 Participant left:', participant.identity);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(participant.identity);
          return newMap;
        });
      },
      onTrackSubscribed: (track, participant) => {
        console.log('📥 Track subscribed:', track.kind, participant.identity);
        // Update participant with track info
        setParticipants(prev => {
          const newMap = new Map(prev);
          const updatedParticipant = { ...participant };
          if (track.kind === 'video') {
            // Store video track reference if needed
          } else if (track.kind === 'audio') {
            // Store audio track reference if needed
          }
          newMap.set(participant.identity, updatedParticipant);
          return newMap;
        });
      },
      onTrackUnsubscribed: (track, participant) => {
        console.log('📤 Track unsubscribed:', track.kind, participant.identity);
      },
      onError: (errorMsg) => {
        console.error('🔴 LiveKit error:', errorMsg);
        setError(errorMsg);
        setIsConnecting(false);
      }
    });

    setService(liveKitService);

    // Auto-connect
    liveKitService.connect().catch(err => {
      console.error('Failed to auto-connect:', err);
    });

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up LiveKit service');
      liveKitService.destroy();
    };
  }, [config.roomName, config.user?.id]);

  // Update local participant state
  useEffect(() => {
    if (service) {
      const local = service.getLocalParticipant();
      setLocalParticipant(local);
    }
  }, [service, participants]);

  // Control methods
  const connect = useCallback(async () => {
    if (!service) return false;

    setIsConnecting(true);
    setError(null);

    try {
      const success = await service.connect();
      return success;
    } catch (err) {
      setError('Failed to connect');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [service]);

  const disconnect = useCallback(() => {
    if (service) {
      service.disconnect();
    }
  }, [service]);

  const toggleCamera = useCallback(async () => {
    if (!service) return false;
    return await service.toggleCamera();
  }, [service]);

  const toggleMicrophone = useCallback(async () => {
    if (!service) return false;
    return await service.toggleMicrophone();
  }, [service]);

  // Get room for advanced operations
  const getRoom = useCallback(() => {
    return service?.getRoom() || null;
  }, [service]);

  return {
    // State
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,

    // Methods
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    getRoom,

    // Service reference for advanced usage
    service
  };
}