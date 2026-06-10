import { useState, useRef, useCallback, useEffect } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
  UID,
} from 'agora-rtc-sdk-ng';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * useAgoraGamingViewer
 *
 * Viewer-side hook for watching HytroGaming screen-share streams via Agora.
 * Subscribes to the broadcaster's screen + mic tracks.
 */

export interface AgoraGamingViewerState {
  isConnecting: boolean;
  isConnected: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  remoteVideoTrack: IRemoteVideoTrack | null;
  remoteCameraTrack: IRemoteVideoTrack | null;
  remoteAudioTrack: IRemoteAudioTrack | null;
  error: string | null;
}

export interface AgoraGamingViewerActions {
  join: (channelName: string, userId: string) => Promise<void>;
  leave: () => Promise<void>;
}

export function useAgoraGamingViewer(): AgoraGamingViewerState & AgoraGamingViewerActions {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<IRemoteVideoTrack | null>(null);
  const [remoteCameraTrack, setRemoteCameraTrack] = useState<IRemoteVideoTrack | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<IRemoteAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const mountedRef = useRef(true);
  const screenUidRef = useRef<UID | null>(null);
  const cameraUidRef = useRef<UID | null>(null);

  const getAgoraAppId = () => import.meta.env.VITE_AGORA_APP_ID;

  const debug = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log('[AgoraGamingViewer]', ...args);
  };

  const getUserUid = (uid: string): UID => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = (hash << 5) - hash + uid.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 4294967295;
  };

  const fetchToken = useCallback(async (channel: string, uid: UID): Promise<string> => {
    const { data, error: tokenError } = await supabase.functions.invoke('agora-token', {
      body: {
        channel,
        userId: uid.toString(),
        tokenType: 'rtc',
        role: 'subscriber',
      },
    });

    debug('fetchToken response', { channel, uid, tokenError, hasData: Boolean(data), tokenLen: data?.token?.length ?? 0 });

    if (tokenError) {
      debug('fetchToken error detail', tokenError);
      throw new Error(`Token error: ${tokenError.message}`);
    }
    if (!data?.token) {
      debug('fetchToken no token, data:', data);
      throw new Error('No token received');
    }

    return data.token;
  }, []);

  const join = useCallback(async (channelName: string, userId: string) => {
    if (joinedRef.current || joiningRef.current) return;

    joiningRef.current = true;

    setIsConnecting(true);
    setError(null);

    try {
      const appId = getAgoraAppId();
      if (!appId) throw new Error('VITE_AGORA_APP_ID not configured');

      debug('AGORA join details', { appId: Boolean(appId), channelName, userId });

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Handle remote user publishing (broadcaster shares screen + camera)
      client.on('user-published', async (user, mediaType) => {
        debug('Remote user published:', user.uid, mediaType);
        try {
          await client.subscribe(user, mediaType);
          debug('Subscribed to', mediaType, 'from user', user.uid);

          if (mediaType === 'video') {
            const videoTrack = user.videoTrack;
            if (!videoTrack || !mountedRef.current) {
              debug('No video track available after subscribe');
              return;
            }

            // First video track = broadcaster's screen share (primary client).
            // Second video track = broadcaster's camera (secondary client with -camera UID).
            if (!screenUidRef.current) {
              screenUidRef.current = user.uid;
              setRemoteVideoTrack(videoTrack);
              setHasVideo(true);
              debug('Screen share video track set from uid:', user.uid);
            } else if (!cameraUidRef.current) {
              cameraUidRef.current = user.uid;
              setRemoteCameraTrack(videoTrack);
              debug('Camera video track set from uid:', user.uid);
            } else {
              // If we already have both, replace whichever matches this uid
              if (user.uid === screenUidRef.current) {
                setRemoteVideoTrack(videoTrack);
                debug('Screen share video track updated');
              } else if (user.uid === cameraUidRef.current) {
                setRemoteCameraTrack(videoTrack);
                debug('Camera video track updated');
              }
            }
          }

          if (mediaType === 'audio') {
            const audioTrack = user.audioTrack;
            if (audioTrack && mountedRef.current) {
              setRemoteAudioTrack(audioTrack);
              setHasAudio(true);
              audioTrack.play().catch(e => debug('Audio play failed:', e));
              debug('Audio track set');
            }
          }
        } catch (err) {
          console.error('[AgoraGamingViewer] Subscribe error:', err);
        }
      });

      client.on('user-unpublished', (user, mediaType) => {
        debug('Remote user unpublished:', user.uid, mediaType);
        if (mediaType === 'video' && mountedRef.current) {
          if (user.uid === screenUidRef.current) {
            setRemoteVideoTrack(null);
            setHasVideo(false);
            screenUidRef.current = null;
          } else if (user.uid === cameraUidRef.current) {
            setRemoteCameraTrack(null);
            cameraUidRef.current = null;
          }
        }
        if (mediaType === 'audio' && mountedRef.current) {
          setRemoteAudioTrack(null);
          setHasAudio(false);
        }
      });

      client.on('user-joined', (user) => {
        debug('User joined:', user.uid);
      });

      client.on('user-left', (user) => {
        debug('User left:', user.uid);
        if (mountedRef.current) {
          if (user.uid === screenUidRef.current) {
            setRemoteVideoTrack(null);
            setHasVideo(false);
            screenUidRef.current = null;
          }
          if (user.uid === cameraUidRef.current) {
            setRemoteCameraTrack(null);
            cameraUidRef.current = null;
          }
          // If all remote users left, clear audio too
          const hasOtherUsers = screenUidRef.current !== null || cameraUidRef.current !== null;
          if (!hasOtherUsers) {
            setRemoteAudioTrack(null);
            setHasAudio(false);
          }
        }
      });

      client.on('connection-state-change', (current, previous) => {
        debug('Connection state change:', current, previous);
        if (!mountedRef.current) return;
        if (current === 'FAILED' || current === 'DISCONNECTED') {
          setError('Agora connection failed');
          setIsConnecting(false);
          joiningRef.current = false;
        }
      });

      clientRef.current = client;

      const uid = getUserUid(userId);
      debug('fetching agora token', { channelName, uid });
      const token = await fetchToken(channelName, uid);
      debug('fetched agora token', { channelName, uid, tokenLen: token?.length ?? 0 });
      const joinPromise = client.join(appId, channelName, token, uid);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Agora join timed out')), 15000),
      );

      await Promise.race([joinPromise, timeoutPromise]);
      joinedRef.current = true;

      if (mountedRef.current) {
        setIsConnected(true);
        setIsConnecting(false);
        joiningRef.current = false;
      }

      debug('Joined Agora channel as viewer:', channelName);
    } catch (err: any) {
      console.error('[AgoraGamingViewer] Join failed:', err);
      if (mountedRef.current) {
        setError(err?.message || 'Failed to connect to stream');
        setIsConnecting(false);
        joiningRef.current = false;
      }
      toast.error('Failed to connect to gaming stream');
    }
  }, [fetchToken]);

  const leave = useCallback(async () => {
    debug('Leaving Agora viewer channel...');

    try {
      if (clientRef.current && joinedRef.current) {
        await clientRef.current.leave();
        joinedRef.current = false;
      }
    } catch (err) {
      console.warn('[AgoraGamingViewer] Leave error:', err);
    }

    if (mountedRef.current) {
      setIsConnected(false);
      setIsConnecting(false);
      setRemoteVideoTrack(null);
      setRemoteCameraTrack(null);
      setRemoteAudioTrack(null);
      setHasVideo(false);
      setHasAudio(false);
      screenUidRef.current = null;
      cameraUidRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (clientRef.current && joinedRef.current) {
        clientRef.current.leave().catch(() => {});
      }
    };
  }, []);

  return {
    isConnecting,
    isConnected,
    hasVideo,
    hasAudio,
    remoteVideoTrack,
    remoteCameraTrack,
    remoteAudioTrack,
    error,
    join,
    leave,
  };
}
