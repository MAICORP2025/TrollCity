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
  remoteAudioTrack: IRemoteAudioTrack | null;          // Track C: Microphone audio
  remoteScreenAudioTrack: IRemoteAudioTrack | null;  // Track D: Screen share / game audio
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
  const [remoteScreenAudioTrack, setRemoteScreenAudioTrack] = useState<IRemoteAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const mountedRef = useRef(true);
  const screenUidRef = useRef<UID | null>(null);
  const cameraUidRef = useRef<UID | null>(null);
  const audioSubscribedRef = useRef(false);
  const pendingFirstVideoTrack = useRef<{ uid: UID; track: IRemoteVideoTrack } | null>(null);
  const firstVideoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        // Skip if we've already left or are leaving
        if (!joinedRef.current) {
          debug('Skipping subscribe — not joined');
          return;
        }
        try {
          await client.subscribe(user, mediaType);
          debug('Subscribed to', mediaType, 'from user', user.uid);

          if (mediaType === 'video') {
            const videoTrack = user.videoTrack;
            if (!videoTrack || !mountedRef.current) {
              debug('No video track available after subscribe');
              return;
            }

            // The broadcaster publishes screen share on the primary Agora client
            // and camera on a secondary client (different UID). Due to network
            // timing, either track can arrive first. We use a short delay to
            // determine which is which: if a second track arrives within the
            // window, the first is camera (overlay) and second is screen (main).
            // If only one track arrives, it's the screen share (main).
            if (!screenUidRef.current && !cameraUidRef.current) {
              // First video track — hold it pending to see if a second arrives
              pendingFirstVideoTrack.current = { uid: user.uid, track: videoTrack };
              firstVideoTimerRef.current = setTimeout(() => {
                if (!mountedRef.current) return;
                // No second track arrived — this is the screen share (main)
                if (pendingFirstVideoTrack.current) {
                  screenUidRef.current = pendingFirstVideoTrack.current.uid;
                  setRemoteVideoTrack(pendingFirstVideoTrack.current.track);
                  setHasVideo(true);
                  debug('Screen share video track set (sole track) from uid:', pendingFirstVideoTrack.current.uid);
                  pendingFirstVideoTrack.current = null;
                }
              }, 800);
              debug('First video track held pending from uid:', user.uid);
            } else if (pendingFirstVideoTrack.current && !screenUidRef.current && !cameraUidRef.current) {
              // Second video track arrived within the window
              // First = camera (overlay), Second = screen share (main)
              if (firstVideoTimerRef.current) {
                clearTimeout(firstVideoTimerRef.current);
                firstVideoTimerRef.current = null;
              }
              cameraUidRef.current = pendingFirstVideoTrack.current.uid;
              setRemoteCameraTrack(pendingFirstVideoTrack.current.track);
              debug('Camera video track set (first arrived) from uid:', pendingFirstVideoTrack.current.uid);

              screenUidRef.current = user.uid;
              setRemoteVideoTrack(videoTrack);
              setHasVideo(true);
              debug('Screen share video track set (second arrived) from uid:', user.uid);
              pendingFirstVideoTrack.current = null;
            } else if (screenUidRef.current && !cameraUidRef.current && user.uid !== screenUidRef.current) {
              // Screen already assigned, this is the camera
              cameraUidRef.current = user.uid;
              setRemoteCameraTrack(videoTrack);
              debug('Camera video track set from uid:', user.uid);
            } else if (cameraUidRef.current && !screenUidRef.current && user.uid !== cameraUidRef.current) {
              // Camera already assigned, this is the screen share
              screenUidRef.current = user.uid;
              setRemoteVideoTrack(videoTrack);
              setHasVideo(true);
              debug('Screen share video track set from uid:', user.uid);
            } else {
              // Replace existing track by UID
              if (user.uid === screenUidRef.current) {
                setRemoteVideoTrack(videoTrack);
                debug('Screen share video track updated');
              } else if (user.uid === cameraUidRef.current) {
                setRemoteCameraTrack(videoTrack);
                debug('Camera video track updated');
              } else {
                // Third+ video track — treat as camera replacement
                cameraUidRef.current = user.uid;
                setRemoteCameraTrack(videoTrack);
                debug('Additional video track set as camera from uid:', user.uid);
              }
            }
          }

          if (mediaType === 'audio') {
            const audioTrack = user.audioTrack;
            if (audioTrack && mountedRef.current) {
              // The broadcaster may publish TWO audio tracks on the same UID:
              // 1. Microphone audio (Track C)
              // 2. Screen share / game audio (Track D)
              // First audio track = mic, second = screen audio
              if (!audioSubscribedRef.current) {
                // First audio track — microphone
                audioSubscribedRef.current = true;
                setRemoteAudioTrack(audioTrack);
                setHasAudio(true);
                try {
                  const at = audioTrack as any;
                  if (at.play) at.play();
                } catch (e) { debug('Audio play failed:', e); }
                debug('Mic audio track set from uid:', user.uid);
              } else {
                // Second audio track — screen share / game audio
                setRemoteScreenAudioTrack(audioTrack);
                try {
                  const at = audioTrack as any;
                  if (at.play) at.play();
                } catch (e) { debug('Screen audio play failed:', e); }
                debug('Screen share audio track set from uid:', user.uid);
              }
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
          // Clear both audio tracks — the broadcaster publishes mic + screen audio
          setRemoteAudioTrack(null);
          setRemoteScreenAudioTrack(null);
          setHasAudio(false);
          audioSubscribedRef.current = false;
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
          // If all remote users left, clear all audio tracks too
          const hasOtherUsers = screenUidRef.current !== null || cameraUidRef.current !== null;
          if (!hasOtherUsers) {
            setRemoteAudioTrack(null);
            setRemoteScreenAudioTrack(null);
            setHasAudio(false);
            audioSubscribedRef.current = false;
          }
        }
      });

      client.on('connection-state-change', (current, previous) => {
        debug('Connection state change:', current, previous);
        if (!mountedRef.current) return;
        if (current === 'FAILED' as any || current === 'DISCONNECTED' as any) {
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

    // Always reset joining ref so a future join can proceed
    joiningRef.current = false;

    try {
      if (clientRef.current && joinedRef.current) {
        await clientRef.current.leave();
        joinedRef.current = false;
      }
    } catch (err) {
      console.warn('[AgoraGamingViewer] Leave error:', err);
    }

    // Also reset joinedRef in case we were mid-join
    joinedRef.current = false;

    if (mountedRef.current) {
      setIsConnected(false);
      setIsConnecting(false);
      setRemoteVideoTrack(null);
      setRemoteCameraTrack(null);
      setRemoteAudioTrack(null);
      setRemoteScreenAudioTrack(null);
      setHasVideo(false);
      setHasAudio(false);
      screenUidRef.current = null;
      cameraUidRef.current = null;
      audioSubscribedRef.current = false;
      pendingFirstVideoTrack.current = null;
      if (firstVideoTimerRef.current) {
        clearTimeout(firstVideoTimerRef.current);
        firstVideoTimerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (firstVideoTimerRef.current) {
        clearTimeout(firstVideoTimerRef.current);
        firstVideoTimerRef.current = null;
      }
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
    remoteScreenAudioTrack,
    error,
    join,
    leave,
  };
}
