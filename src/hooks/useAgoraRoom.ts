import { useState, useRef, useCallback, useEffect } from 'react';
import AgoraRTC, { 
  IAgoraRTCClient, 
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  UID
} from 'agora-rtc-sdk-ng';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

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

  // Initialize Agora client
  const initAgoraClient = useCallback(async () => {
    try {
      const appId = getAgoraAppId();
      if (!appId) {
        throw new Error('VITE_AGORA_APP_ID not configured');
      }

      console.log('🔧 Initializing Agora client');

      // Create client
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Event handlers
      client.on('user-joined', (user) => {
        console.log('👤 User joined:', user.uid);
        setRemoteUsers(prev => [...prev, user]);
        onUserJoined?.(user);
      });

      client.on('user-left', (user) => {
        console.log('👤 User left:', user.uid);
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        onUserLeft?.(user);
      });

      client.on('user-published', async (user, mediaType) => {
        console.log('📢 User published:', user.uid, mediaType);
        await client.subscribe(user, mediaType);
      });

      client.on('user-unpublished', (user, mediaType) => {
        console.log('🔇 User unpublished:', user.uid, mediaType);
      });

      client.on('connection-state-change', (curState, revState) => {
        console.log('🔌 Connection state:', curState, '(was', revState + ')');
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
      console.log('🎫 Fetching Agora token for channel:', channel, 'uid:', uid);

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

      console.log('✅ Agora token received, length:', data.token.length);
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
      console.log('📍 Joining Agora channel:', channelName);

      // Initialize client if needed
      let client = clientRef.current;
      if (!client) {
        console.log('🔧 Initializing Agora client...');
        client = await initAgoraClient();
      }

      // Get numeric UID
      const uid = getUserUid(userId);
      console.log('👤 User UID:', uid);

      // Get token
      console.log('🎫 Fetching Agora token...');
      const appId = getAgoraAppId();
      if (!appId) {
        throw new Error('Agora App ID not configured');
      }
      
      const token = await fetchAgoraToken(channelName, uid);
      if (!token) {
        throw new Error('Failed to get Agora token');
      }
      console.log('✅ Token received, joining...');

      // Join channel with 15 second timeout
      const joinPromise = client.join(appId, channelName, token, uid);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Join timeout - connection took too long')), 15000)
      );
      
      await Promise.race([joinPromise, timeoutPromise]);
      console.log('✅ Joined Agora channel');

      setIsConnected(true);
      joinedRef.current = true;

      // Publish audio/video if publisher role
      if (role === 'publisher') {
        console.log('🎬 Creating local tracks for publisher');

        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();

        await client.publish([videoTrack, audioTrack]);

        // Store in both state and refs
        videoTrackRef.current = videoTrack;
        audioTrackRef.current = audioTrack;
        setLocalVideoTrack(videoTrack);
        setLocalAudioTrack(audioTrack);
        setIsPublishing(true);

        console.log('✅ Published local tracks');
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
      console.log('👋 Leaving Agora channel');

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

      console.log('✅ Left Agora channel');
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
      console.log('📹 Camera:', videoTrackRef.current.enabled ? 'on' : 'off');
    } catch (err) {
      console.error('❌ Toggle camera error:', err);
    }
  }, []);

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    try {
      if (!audioTrackRef.current) return;
      await audioTrackRef.current.setEnabled(!audioTrackRef.current.enabled);
      console.log('🎤 Microphone:', audioTrackRef.current.enabled ? 'on' : 'off');
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



