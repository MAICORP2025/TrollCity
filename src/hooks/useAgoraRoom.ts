import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Agora SDK is lazy-loaded to avoid bundling 2MB+ for all users
// Types are imported at the bottom of the file for type-checking only
let AgoraRTC: any = null;
async function loadAgoraRTC() {
  if (!AgoraRTC) {
    AgoraRTC = await import('agora-rtc-sdk-ng');
  }
  return AgoraRTC;
}

// Type-only import (erased at compile time, no bundle impact)
type IAgoraRTCClient = import('agora-rtc-sdk-ng').IAgoraRTCClient;
type IAgoraRTCRemoteUser = import('agora-rtc-sdk-ng').IAgoraRTCRemoteUser;
type ICameraVideoTrack = import('agora-rtc-sdk-ng').ICameraVideoTrack;
type IMicrophoneAudioTrack = import('agora-rtc-sdk-ng').IMicrophoneAudioTrack;
type UID = import('agora-rtc-sdk-ng').UID;

/**
 * Hook for managing Agora RTC connections
 * 
 * @param config - Configuration object
 * @param config.channelName - Agora channel name
 * @param config.userId - User ID (will be converted to numeric UID)
 * @param config.userName - User name for display
 * @param config.role - 'publisher' | 'subscriber'
 * @param config.onUserJoined - Callback when user joins
 * @param config.onUserLeft - Callback when user leaves
 * @param config.onError - Error callback
 */

export function useAgoraRoom({
  channelName,
  userId,
  userName = 'User',
  role = 'publisher',
  onUserJoined,
  onUserLeft,
  onError
}: {
  channelName: string;
  userId: string;
  userName?: string;
  role?: 'publisher' | 'subscriber';
  onUserJoined?: (user: IAgoraRTCRemoteUser) => void;
  onUserLeft?: (user: IAgoraRTCRemoteUser) => void;
  onError?: (error: string) => void;
}) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const isMountedRef = useRef(true);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  // Get Agora app ID
  const getAgoraAppId = () => import.meta.env.VITE_AGORA_APP_ID;

  const debugAgora = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args)
    }
  }

  // Initialize Agora client (lazy-loads SDK on first call)
  const initAgoraClient = useCallback(async () => {
    try {
      const appId = getAgoraAppId();
      if (!appId) {
        throw new Error('VITE_AGORA_APP_ID not configured');
      }

      debugAgora('🔧 Initializing Agora client');

      // Lazy-load Agora SDK (~2MB) only when needed
      const Agora = await loadAgoraRTC();

      // Create client
      const client = Agora.createClient({ mode: 'rtc', codec: 'vp8' });

      // Event handlers
      client.on('user-joined', (user) => {
        debugAgora('👤 User joined:', user.uid);
        setRemoteUsers(prev => [...prev, user]);
        onUserJoined?.(user);
      });

      client.on('user-left', (user) => {
        debugAgora('👤 User left:', user.uid);
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        onUserLeft?.(user);
      });

      client.on('user-published', async (user, mediaType) => {
        debugAgora('📢 User published:', user.uid, mediaType);
        await client.subscribe(user, mediaType);
      });

      client.on('user-unpublished', (user, mediaType) => {
        debugAgora('🔇 User unpublished:', user.uid, mediaType);
      });

      client.on('connection-state-change', (curState, revState) => {
        debugAgora('🔌 Connection state:', curState, '(was', revState + ')');
      });

      clientRef.current = client;
      return client;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to initialize Agora client';
      console.error('❌ Agora initialization error:', errMsg);
      setError(errMsg);
      onError?.(errMsg);
      throw err;
    }
  }, [getAgoraAppId, onError, onUserJoined, onUserLeft]);

  // Fetch Agora token
  const fetchAgoraToken = useCallback(async (channel: string, uid: UID) => {
    try {
      debugAgora('🎫 Fetching Agora token for channel:', channel, 'uid:', uid);

      const { data, error: tokenError } = await supabase.functions.invoke('agora-token', {
        body: {
          channel,
          userId: uid.toString(),
          tokenType: 'rtc',
          role
        }
      });

      if (tokenError) {
        console.error('❌ Token fetch error response:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      if (!data) {
        console.error('❌ No data in token response');
        throw new Error('No data in token response');
      }

      if (!data?.token) {
        console.error('❌ No token in response, data:', data);
        throw new Error('No token in response: ' + JSON.stringify(data));
      }

      debugAgora('✅ Agora token received, length:', data.token.length);
      return data.token;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch Agora token';
      console.error('❌ Token fetch error:', errMsg, err);
      throw err;
    }
  }, [role]);

  // Convert user ID to numeric UID
  const getUserUid = (uid: string): UID => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = (hash << 5) - hash + uid.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 4294967295; // Use UID < 4294967295
  };

  // Join channel
  const joinChannel = useCallback(async () => {
    if (joiningRef.current || joinedRef.current) return;
    if (!channelName) {
      console.error('❌ No channel name provided');
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);

    try {
      debugAgora('📍 Joining Agora channel:', channelName);

      // Initialize client if needed
      let client = clientRef.current;
      if (!client) {
        debugAgora('🔧 Initializing Agora client...');
        client = await initAgoraClient();
      }

      // Get numeric UID
      const uid = getUserUid(userId);
      debugAgora('👤 User UID:', uid);

      // Get token
      debugAgora('🎫 Fetching Agora token...');
      const appId = getAgoraAppId();
      if (!appId) {
        throw new Error('Agora App ID not configured');
      }
      
      const token = await fetchAgoraToken(channelName, uid);
      if (!token) {
        throw new Error('Failed to get Agora token');
      }
      debugAgora('✅ Token received, joining...');

      // Join channel with 15 second timeout
      const joinPromise = client.join(appId, channelName, token, uid);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Join timeout - connection took too long')), 15000)
      );
      
      await Promise.race([joinPromise, timeoutPromise]);
      debugAgora('✅ Joined Agora channel');

      setIsConnected(true);
      joinedRef.current = true;

      // Publish audio/video if publisher role
      if (role === 'publisher') {
        debugAgora('🎬 Creating local tracks for publisher');

        const Agora = await loadAgoraRTC();
        const videoTrack = await Agora.createCameraVideoTrack();
        const audioTrack = await Agora.createMicrophoneAudioTrack({
          encoderConfig: 'speech_standard',
          AEC: true,
          ANS: true,
          AGC: true,
        });

        await client.publish([videoTrack, audioTrack]);

        // Store in both state and refs
        videoTrackRef.current = videoTrack;
        audioTrackRef.current = audioTrack;
        setLocalVideoTrack(videoTrack);
        setLocalAudioTrack(audioTrack);
        setIsPublishing(true);

        debugAgora('✅ Published local tracks');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to join channel';
      console.error('❌ Join error:', errMsg, err);
      setError(errMsg);
      onError?.(errMsg);
      toast.error('Meeting connection failed: ' + errMsg);
      joinedRef.current = false;
    } finally {
      joiningRef.current = false;
      setIsJoining(false);
    }
  }, [channelName, userId, role, getAgoraAppId, fetchAgoraToken, initAgoraClient, getUserUid, onError]);

  // Leave channel
  const leaveChannel = useCallback(async () => {
    if (!joinedRef.current || !clientRef.current) return;

    try {
      debugAgora('👋 Leaving Agora channel');

      // Stop and close local tracks using refs
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current.close();
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
      }

      // Leave channel
      await clientRef.current.leave();

      setIsConnected(false);
      setIsPublishing(false);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setRemoteUsers([]);
      joinedRef.current = false;
      videoTrackRef.current = null;
      audioTrackRef.current = null;

      debugAgora('✅ Left Agora channel');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to leave channel';
      console.error('❌ Leave error:', errMsg);
      setError(errMsg);
    }
  }, []); // No dependencies - uses refs instead

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    try {
      if (!videoTrackRef.current) return;
      await videoTrackRef.current.setEnabled(!videoTrackRef.current.enabled);
      debugAgora('📹 Camera:', videoTrackRef.current.enabled ? 'on' : 'off');
    } catch (err) {
      console.error('❌ Toggle camera error:', err);
    }
  }, []);

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    try {
      if (!audioTrackRef.current) return;
      await audioTrackRef.current.setEnabled(!audioTrackRef.current.enabled);
      debugAgora('🎤 Microphone:', audioTrackRef.current.enabled ? 'on' : 'off');
    } catch (err) {
      console.error('❌ Toggle microphone error:', err);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      leaveChannel();
    };
  }, [leaveChannel]);

  return {
    isConnected,
    isPublishing,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    isJoining,
    joinChannel,
    leaveChannel,
    toggleCamera,
    toggleMicrophone
  };
}



