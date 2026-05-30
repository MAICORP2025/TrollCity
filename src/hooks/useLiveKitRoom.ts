import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Room, 
  RoomEvent, 
  LocalVideoTrack, 
  LocalAudioTrack, 
  RemoteParticipant,
  RemoteVideoTrack,
  RemoteAudioTrack,
  VideoCaptureOptions,
  AudioCaptureOptions,
  VideoPresets,
  AudioPresets,
  createLocalAudioTrack,
  createLocalVideoTrack
} from 'livekit-client';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

/**
 * Unified hook for LiveKit rooms
 * 
 * @param config - Configuration object
 * @param config.roomId - Room/stream ID
 * @param config.roomType - Type of room: 'broadcast' | 'pod' | 'church' | 'talent' | 'tcps' | 'jail' | 'court' | 'election' | 'team_meeting'
 * @param config.role - 'publisher' | 'viewer'
 * @param config.audioOnly - Whether room is audio-only (pods)
 * @param config.publish - Whether user should publish (host/speaker/guest)
 * @param config.isAdmin - Whether user is admin (1080p) vs regular (720p)
 * @param config.onUserJoined - Callback when user joins
 * @param config.onUserLeft - Callback when user leaves
 * @param config.onError - Error callback
 */
export function useLiveKitRoom({
  roomId,
  roomType = 'broadcast',
  role = 'viewer',
  audioOnly = false,
  publish = false,
  isAdmin = false,
  userName,
  identity = '',
  initialAudioEnabled = true,
  onUserJoined,
  onUserLeft,
  onError
}) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

   // Refs
    const roomRef = useRef<Room | null>(null);
    const joinedRef = useRef(false);
    const localUserIdRef = useRef<string | null>(null);
    const joiningRef = useRef(false); // Track joining state to prevent race conditions
    const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
    const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
    const prewarmedAudioTrackRef = useRef<LocalAudioTrack | null>(null);
    const prewarmedVideoTrackRef = useRef<LocalVideoTrack | null>(null);
    const prewarmCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get LiveKit credentials from environment
  const getLiveKitUrl = () => import.meta.env.VITE_LIVEKIT_URL;
  const getLiveKitApiKey = () => import.meta.env.VITE_LIVEKIT_API_KEY;
  
  // Check if LiveKit is configured
  const isLiveKitConfigured = !!getLiveKitUrl() && !!getLiveKitApiKey();

  // Fetch LiveKit token via edge function
  const fetchToken = useCallback(async (roomName: string, userId: string, userName?: string, isPublisherOverride?: boolean, metadataOverride?: string) => {
    const isPublisher = typeof isPublisherOverride === 'boolean' ? isPublisherOverride : publish;
    const requestBody: Record<string, any> = {
      room: roomName,
      roomName,
      identity: identity || userId,
      name: userName || 'User',
      role: isPublisher ? 'publisher' : 'audience',
      isHost: isPublisher && roomType === 'pod' ? true : undefined,
    };
    if (metadataOverride) {
      requestBody.metadata = metadataOverride;
    }

    const requestDetails = {
      roomName,
      userId,
      role: isPublisher ? 'publisher' : 'audience',
      isHost: isPublisher && roomType === 'pod',
    };

    try {
      const { data, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: requestBody,
      });

      if (tokenError) {
        const errorMessage = tokenError?.message || JSON.stringify(tokenError);
        console.error('[useLiveKitRoom] Error fetching token via Supabase functions.invoke:', errorMessage, requestDetails, tokenError);
        throw new Error(`LiveKit token fetch failed: ${errorMessage}`);
      }

      if (!data?.token) {
        console.error('[useLiveKitRoom] No token in response from edge function:', data, requestDetails);
        throw new Error(`LiveKit token response missing token: ${JSON.stringify(data)}`);
      }

      console.log('[useLiveKitRoom] Got token, room:', roomName);
      return data.token;
    } catch (err: any) {
      console.warn('[useLiveKitRoom] Token fetch failed, falling back to raw Supabase Function fetch:', err, requestDetails);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(`LiveKit token fetch failed and Supabase env is not configured: ${err?.message || String(err)}`);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || supabaseAnonKey;
      const response = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('[useLiveKitRoom] Failed parsing fallback token response:', parseErr, responseText);
        throw new Error(`LiveKit token fallback response parse failed: ${parseErr?.message || String(parseErr)}`);
      }

      if (!response.ok) {
        console.error('[useLiveKitRoom] Fallback token request failed:', response.status, parsed);
        throw new Error(`LiveKit token fallback request failed (${response.status}): ${parsed?.error || JSON.stringify(parsed)}`);
      }

      if (!parsed?.token) {
        console.error('[useLiveKitRoom] Fallback token response missing token:', parsed);
        throw new Error(`LiveKit token fallback response missing token: ${JSON.stringify(parsed)}`);
      }

      console.log('[useLiveKitRoom] Got token via fallback fetch, room:', roomName);
      return parsed.token;
    }
  }, [publish, roomType]);

  // Resolve video preset based on admin status
  const videoPreset = isAdmin ? VideoPresets.h1080 : VideoPresets.h720;

  // Create local tracks based on room type
  const createLocalTracks = useCallback(async () => {
    try {
// Audio track - always create for publishers
       const audioTrack = await createLocalAudioTrack();
        setLocalAudioTrack(audioTrack);
        localAudioTrackRef.current = audioTrack;

       let videoTrack: LocalVideoTrack | null = null

       // Video track - only create if not audio-only room
       if (!audioOnly && roomType !== 'pod') {
         try {
           const { createLocalVideoTrack } = await import('livekit-client');
           videoTrack = await createLocalVideoTrack({
             ...videoPreset,
             facingMode: 'user'
           });
           setLocalVideoTrack(videoTrack);
           localVideoTrackRef.current = videoTrack;
         } catch (videoErr) {
           console.warn('[useLiveKitRoom] Could not create video track:', videoErr);
         }
       }

      return { audioTrack, videoTrack };
    } catch (err) {
      console.error('[useLiveKitRoom] Error creating local tracks:', err);
      throw err;
    }
  }, [audioOnly, roomType, videoPreset]);

  const getPublicationCount = (participant: any) => {
    const publications =
      participant?.trackPublications ||
      participant?.tracks ||
      participant?.trackPublicationMap ||
      null;

    if (!publications) return 0;
    if (typeof publications.size === 'number') return publications.size;
    if (Array.isArray(publications)) return publications.length;
    if (typeof publications === 'object') return Object.keys(publications).length;
    return 0;
  };

  const getParticipantIdentity = (participant: any) => {
    return (
      participant?.identity ||
      participant?.sid ||
      participant?.name ||
      'unknown-participant'
    );
  };

  // Handle participant joined
  const handleParticipantJoined = useCallback((participant: RemoteParticipant) => {
    const identity = getParticipantIdentity(participant);

    console.log('[useLiveKitRoom] Participant connected:', {
      identity,
      publicationCount: getPublicationCount(participant),
    });

    setRemoteUsers(prev => {
      const alreadyExists = prev.some(
        (item: any) => getParticipantIdentity(item) === identity
      );

      if (alreadyExists) {
        return prev.map((item: any) =>
          getParticipantIdentity(item) === identity ? participant : item
        );
      }

      return [...prev, participant];
    });

    onUserJoined?.(participant);
  }, [onUserJoined]);

  // Handle participant left
  const handleParticipantLeft = useCallback((participant: RemoteParticipant) => {
    const identity = getParticipantIdentity(participant);

    console.log('[useLiveKitRoom] Participant disconnected:', {
      identity,
      publicationCount: getPublicationCount(participant),
    });

    setRemoteUsers(prev =>
      prev.filter((item: any) => getParticipantIdentity(item) !== identity)
    );

    onUserLeft?.(participant);
  }, [onUserLeft]);

  // Handle track subscribed
  const handleTrackSubscribed = useCallback(
    (track: RemoteVideoTrack | RemoteAudioTrack, publication, participant: RemoteParticipant) => {
      const identity = getParticipantIdentity(participant);

      if (!identity || identity === 'unknown-participant') {
        console.warn('[useLiveKitRoom] Track subscribed without participant identity', {
          kind: track?.kind,
          publicationSid: publication?.trackSid,
        });
        return;
      }

      console.log('[useLiveKitRoom] Track subscribed:', {
        participantIdentity: identity,
        trackSid: track?.sid || publication?.trackSid || publication?.sid || null,
        kind: track?.kind || publication?.kind || null,
        source: publication?.source || null,
      });

      setRemoteUsers(prev => {
        const exists = prev.some(
          (item: any) => getParticipantIdentity(item) === identity
        );

        if (!exists) return [...prev, participant];

        return prev.map((item: any) =>
          getParticipantIdentity(item) === identity ? participant : item
        );
      });
    },
    []
  );

  // Handle track unsubscribed
  const handleTrackUnsubscribed = useCallback(
    (_track: RemoteVideoTrack | RemoteAudioTrack, publication, participant: RemoteParticipant) => {
      const identity = getParticipantIdentity(participant);

      console.log('[useLiveKitRoom] Track unsubscribed:', {
        participantIdentity: identity,
        trackSid: publication?.trackSid || publication?.sid || null,
        kind: publication?.kind || null,
      });

      if (!participant?.identity) {
        return;
      }

      setRemoteUsers(prev =>
        prev.map((item: any) =>
          getParticipantIdentity(item) === identity ? participant : item
        )
      );
    },
    []
  );

  // Join LiveKit as publisher
  const joinAsPublisher = useCallback(async (userId: string, tokenOverride?: string | null) => {
    // Guard: prevent multiple simultaneous connection attempts
    if (joinedRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joined');
      return roomRef.current;
    }

    if (joiningRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joining');
      let attempts = 0;
      while (joiningRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return roomRef.current;
    }

    if (!roomId || !userId) {
      console.warn('[useLiveKitRoom] Join prevented: missing params');
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);
    setError(null);
    localUserIdRef.current = userId;

    let room: Room | null = null;
    let audioTrack: LocalAudioTrack | null = null;
    let videoTrack: LocalVideoTrack | null = null;

    try {
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          ...videoPreset,
          facingMode: 'user'
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.on(RoomEvent.Disconnected, () => {
        console.log('[useLiveKitRoom] Room disconnected');
        joinedRef.current = false;
        joiningRef.current = false;
        setIsConnected(false);
        setIsPublishing(false);
      });
      room.on(RoomEvent.Reconnecting, () => {
        console.log('[useLiveKitRoom] Room reconnecting...');
      });
      room.on(RoomEvent.Reconnected, () => {
        console.log('[useLiveKitRoom] Room reconnected');
        joinedRef.current = true;
        setIsConnected(true);
      });
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[useLiveKitRoom] Connection state changed:', state);
        if (state === 'disconnected') {
          joinedRef.current = false;
          setIsConnected(false);
        }
      });

      const token = tokenOverride || await fetchToken(roomId, userId, userName, true);
      const url = getLiveKitUrl();
      const apiKey = getLiveKitApiKey();

      if (!url || !apiKey) {
        console.error('[useLiveKitRoom] Missing LiveKit config:', {
          hasUrl: !!url,
          hasApiKey: !!apiKey
        });
        throw new Error(`Missing LiveKit env vars: VITE_LIVEKIT_URL=${url ? 'set' : 'MISSING'}, VITE_LIVEKIT_API_KEY=${apiKey ? 'set' : 'MISSING'}`);
      }

      if (!token) {
        throw new Error('Failed to get LiveKit token from server');
      }

      audioTrack = prewarmedAudioTrackRef.current || await createLocalAudioTrack();
      prewarmedAudioTrackRef.current = null;
      if (!initialAudioEnabled) {
        await audioTrack.mute();
      }

      if (!audioOnly) {
        if (prewarmedVideoTrackRef.current) {
          videoTrack = prewarmedVideoTrackRef.current;
          prewarmedVideoTrackRef.current = null;
        } else {
          const { createLocalVideoTrack } = await import('livekit-client');
          videoTrack = await createLocalVideoTrack({
            ...videoPreset,
            facingMode: 'user'
          });
        }
      }

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      await room.connect(url, token);
      await waitForRoomConnected(room, 10000);

      await room.localParticipant.publishTrack(audioTrack);
      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack);
      }

      // Small delay to ensure tracks are fully published before marking connected
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsConnected(true);
      setIsPublishing(true);

      const existingParticipants = room.remoteParticipants ? Array.from(room.remoteParticipants.values()) : [];
      console.log('[useLiveKitRoom] Existing participants after connect:', existingParticipants.map((p: any) => ({
        identity: p.identity,
        hasAudio: !!p.audioTrack,
        audioTrackSid: p.audioTrack?.sid
      })));
      setRemoteUsers(existingParticipants);

      joinedRef.current = true;
      setIsJoining(false);
      joiningRef.current = false;

      return room;
    } catch (err: any) {
      console.error('[useLiveKitRoom] Error joining as publisher:', err);

      if (audioTrack) {
        try {
          audioTrack.stop();
        } catch (stopErr) {
          console.warn('[useLiveKitRoom] Failed to stop audio track on join error:', stopErr);
        }
      }

      if (videoTrack) {
        try {
          videoTrack.stop();
        } catch (stopErr) {
          console.warn('[useLiveKitRoom] Failed to stop video track on join error:', stopErr);
        }
      }

      if (room) {
        try {
          await room.disconnect();
        } catch (disconnectErr) {
          console.warn('[useLiveKitRoom] Failed to disconnect room after publish error:', disconnectErr);
        }
      }

      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      prewarmedAudioTrackRef.current = null;
      prewarmedVideoTrackRef.current = null;
      joinedRef.current = false;
      setIsConnected(false);
      setIsPublishing(false);
      setError(err?.message || 'Failed to join room');
      setIsJoining(false);
      joiningRef.current = false;
      onError?.(err);
      throw err;
    }
  }, [roomId, videoPreset, fetchToken, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, handleTrackUnsubscribed, onError, userName, identity, audioOnly, initialAudioEnabled]);

  // Join as viewer (LiveKit)
  const joinAsAudience = useCallback(async (userId: string) => {
    // Guard: prevent multiple simultaneous connection attempts
    if (joinedRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joined');
      return roomRef.current;
    }
    
    if (joiningRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joining');
      // Wait for existing join to complete
      let attempts = 0;
      while (joiningRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return roomRef.current;
    }
    
    if (!roomId || !userId) {
      console.warn('[useLiveKitRoom] Join prevented: missing params');
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);
    setError(null);
    localUserIdRef.current = userId;

    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      
      // Handle disconnection events to reset state
      room.on(RoomEvent.Disconnected, () => {
        console.log('[useLiveKitRoom] Room disconnected');
        joinedRef.current = false;
        joiningRef.current = false;
        setIsConnected(false);
        setIsPublishing(false);
      });

      // Handle reconnection events
      room.on(RoomEvent.Reconnecting, () => {
        console.log('[useLiveKitRoom] Room reconnecting...');
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log('[useLiveKitRoom] Room reconnected');
        joinedRef.current = true;
        setIsConnected(true);
      });

      // Handle connection state changes
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[useLiveKitRoom] Connection state changed:', state);
        if (state === 'disconnected') {
          joinedRef.current = false;
          setIsConnected(false);
        }
      });

      // Get token
      const token = await fetchToken(roomId, userId, userName, false);
      const url = getLiveKitUrl();
      const apiKey = getLiveKitApiKey();

      if (!url || !apiKey) {
        console.error('[useLiveKitRoom] Missing LiveKit config:', { 
          hasUrl: !!url, 
          hasApiKey: !!apiKey 
        });
        throw new Error(`Missing LiveKit env vars: VITE_LIVEKIT_URL=${url ? 'set' : 'MISSING'}, VITE_LIVEKIT_API_KEY=${apiKey ? 'set' : 'MISSING'}`);
      }
      
      if (!token) {
        throw new Error('Failed to get LiveKit token from server');
      }

      // Connect to room
      await room.connect(url, token);
      await waitForRoomConnected(room, 10000);

       // Get existing participants - guard against undefined
       const existingParticipants = room.remoteParticipants ? Array.from(room.remoteParticipants.values()) : [];
       console.log('[useLiveKitRoom] Existing participants after connect:', existingParticipants.map((p: any) => ({
         identity: p.identity,
         hasAudio: !!p.audioTrack,
         audioTrackSid: p.audioTrack?.sid
       })));
       setRemoteUsers(existingParticipants);

      joinedRef.current = true;
      setIsConnected(true);
      setIsJoining(false);
      joiningRef.current = false;

      return room;
    } catch (err: any) {
      console.error('[useLiveKitRoom] Error joining as audience:', err);
      
      // Check if this is a getUserMedia error - these often happen in LiveKit's internal
      // reconnection logic and don't necessarily mean the connection failed
      const errorMessage = err?.message || String(err) || '';
      const isGetUserMediaError = errorMessage.includes('getUserMedia');
      
      // Only reset state and call onError if it's NOT a getUserMedia error
      // or if we haven't successfully connected yet
      if (!isGetUserMediaError || !roomRef.current) {
        // Reset state on error
        joinedRef.current = false;
        setIsConnected(false);
        setIsPublishing(false);
        setError(err.message || 'Failed to join room');
        setIsJoining(false);
        joiningRef.current = false;
        onError?.(err);
        throw err;
      } else {
        // For getUserMedia errors, just log but don't fail
        console.warn('[useLiveKitRoom] Ignoring getUserMedia error - connection may still work');
        // If we got here, the connection might have succeeded despite the error
        if (roomRef.current && !joinedRef.current) {
          joinedRef.current = true;
          setIsConnected(true);
          setIsJoining(false);
          joiningRef.current = false;
          return roomRef.current;
        }
      }
    }
  }, [roomId, identity, fetchToken, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, handleTrackUnsubscribed, onError, userName]);

  const stopUnusedPrewarmedTracks = useCallback(() => {
    if (prewarmCleanupTimerRef.current) {
      clearTimeout(prewarmCleanupTimerRef.current)
      prewarmCleanupTimerRef.current = null
    }

    if (prewarmedAudioTrackRef.current) {
      try { prewarmedAudioTrackRef.current.stop() } catch {}
      prewarmedAudioTrackRef.current = null
    }

    if (prewarmedVideoTrackRef.current) {
      try { prewarmedVideoTrackRef.current.stop() } catch {}
      prewarmedVideoTrackRef.current = null
    }

    setLocalAudioTrack(null)
    setLocalVideoTrack(null)
  }, [])

  // Publish local camera/mic tracks to the existing room without reconnecting.
  // Used when a viewer joins a seat — the room stays connected to keep broadcaster tracks.
  const publishLocalTracks = useCallback(async () => {
    const room = roomRef.current
    if (!room || room.state !== 'connected') {
      console.warn('[useLiveKitRoom] publishLocalTracks: room not connected')
      return
    }

    let audioTrack = localAudioTrackRef.current
    let videoTrack = localVideoTrackRef.current

    try {
      if (!audioTrack) {
        audioTrack = await createLocalAudioTrack()
        localAudioTrackRef.current = audioTrack
        setLocalAudioTrack(audioTrack)
      }

      if (!videoTrack && !audioOnly) {
        const { createLocalVideoTrack: createVideo } = await import('livekit-client')
        videoTrack = await createVideo({ ...videoPreset, facingMode: 'user' })
        localVideoTrackRef.current = videoTrack
        setLocalVideoTrack(videoTrack)
      }

      await room.localParticipant.publishTrack(audioTrack)
      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack)
      }

      setIsPublishing(true)
      console.log('[useLiveKitRoom] publishLocalTracks: tracks published')
    } catch (err) {
      console.error('[useLiveKitRoom] publishLocalTracks error:', err)
      onError?.(err)
    }
  }, [audioOnly, videoPreset, onError])

  // Unpublish only local camera/mic tracks. Does NOT disconnect the room.
  // Used when a viewer leaves a seat — broadcaster tracks stay subscribed.
  const unpublishLocalTracks = useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    try {
      const audioTrack = localAudioTrackRef.current
      const videoTrack = localVideoTrackRef.current

      if (audioTrack) {
        try { await room.localParticipant.unpublishTrack(audioTrack) } catch {}
        try { audioTrack.stop() } catch {}
        localAudioTrackRef.current = null
        setLocalAudioTrack(null)
      }

      if (videoTrack) {
        try { await room.localParticipant.unpublishTrack(videoTrack) } catch {}
        try { videoTrack.stop() } catch {}
        localVideoTrackRef.current = null
        setLocalVideoTrack(null)
      }

      setIsPublishing(false)
      console.log('[useLiveKitRoom] unpublishLocalTracks: tracks unpublished')
    } catch (err) {
      console.error('[useLiveKitRoom] unpublishLocalTracks error:', err)
    }
  }, [])

  const prewarmPublisherTracks = useCallback(async () => {
    if (prewarmCleanupTimerRef.current) {
      clearTimeout(prewarmCleanupTimerRef.current)
      prewarmCleanupTimerRef.current = null
    }

    if (prewarmedAudioTrackRef.current && prewarmedVideoTrackRef.current) {
      setLocalAudioTrack(prewarmedAudioTrackRef.current)
      setLocalVideoTrack(prewarmedVideoTrackRef.current)
      return {
        audioTrack: prewarmedAudioTrackRef.current,
        videoTrack: prewarmedVideoTrackRef.current,
      }
    }

    const audioTrack = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    })

    let videoTrack: LocalVideoTrack | null = null
    if (!audioOnly && roomType !== 'pod') {
      try {
        videoTrack = await createLocalVideoTrack({
          ...videoPreset,
          facingMode: 'user',
        })
      } catch (err) {
        console.warn('[useLiveKitRoom] prewarm video track failed:', err)
      }
    }

    prewarmedAudioTrackRef.current = audioTrack
    prewarmedVideoTrackRef.current = videoTrack

    setLocalAudioTrack(audioTrack)
    setLocalVideoTrack(videoTrack)

    return { audioTrack, videoTrack }
  }, [audioOnly, roomType, videoPreset])

// Leave room
   const leaveRoom = useCallback(async () => {
    try {
      const audioTrack = localAudioTrackRef.current
      const videoTrack = localVideoTrackRef.current

      if (audioTrack) {
        audioTrack.stop()
        localAudioTrackRef.current = null
        setLocalAudioTrack(null)
      }

      if (videoTrack) {
        videoTrack.stop()
        localVideoTrackRef.current = null
        setLocalVideoTrack(null)
      }

      if (roomRef.current) {
        await roomRef.current.disconnect()
        roomRef.current = null
      }

      joinedRef.current = false
      joiningRef.current = false
      localUserIdRef.current = null
      setIsConnected(false)
      setIsPublishing(false)
      setRemoteUsers([])
    } catch (err) {
      console.error('[useLiveKitRoom] Error leaving room:', err)
      joinedRef.current = false
      joiningRef.current = false
      roomRef.current = null
      setIsConnected(false)
      setIsPublishing(false)
    }
  }, [])

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (!roomRef.current) return;

    try {
      if (localVideoTrack) {
        if (!localVideoTrack.isMuted) {
          await roomRef.current.localParticipant.unpublishTrack(localVideoTrack);
          localVideoTrack.stop();
          localVideoTrackRef.current = null;
          setLocalVideoTrack(null);
        } else {
          await roomRef.current.localParticipant.publishTrack(localVideoTrack);
        }
      } else {
        const { createLocalVideoTrack } = await import('livekit-client');
        const newTrack = await createLocalVideoTrack({
          ...videoPreset,
          facingMode: 'user',
        });
        setLocalVideoTrack(newTrack);
        localVideoTrackRef.current = newTrack;
        await roomRef.current.localParticipant.publishTrack(newTrack);
      }
    } catch (err) {
      console.error('[useLiveKitRoom] Error toggling camera:', err);
    }
  }, [localVideoTrack, videoPreset]);

// Wait for room to be connected
    const waitForRoomConnected = useCallback(async (room: Room, timeoutMs = 5000) => {
      if (room.state === 'connected') {
        return true;
      }

      return new Promise<boolean>((resolve, reject) => {
        let resolved = false;
        const onConnected = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve(true);
        };

        const onTimeout = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          reject(new Error(`LiveKit room not connected after ${timeoutMs}ms`));
        };

        const cleanup = () => {
          room.off(RoomEvent.Connected, onConnected);
          window.clearTimeout(timeoutId);
        };

        const timeoutId = window.setTimeout(onTimeout, timeoutMs);

        room.on(RoomEvent.Connected, onConnected);
      });
    }, []);

  // Toggle microphone - with error handling to prevent disconnects
  const toggleMicrophone = useCallback(async () => {
    const track = localAudioTrack;
    if (!track) {
      return;
    }
    
    // Just toggle the track directly - doesn't need room
    try {
      if (track.isMuted) {
        await track.unmute();
      } else {
        await track.mute();
      }
    } catch (err) {
      console.warn('[useLiveKitRoom] Toggle mic error:', err);
    }
  }, [localAudioTrack]);

  // Set mic enabled/disabled (for walkie-talkie integration)
  const setMicEnabled = useCallback(async (enabled: boolean) => {
    const track = localAudioTrackRef.current;
    if (!track) return false;
    
    try {
      if (enabled) {
        await track.unmute();
      } else {
        await track.mute();
      }
      setLocalAudioTrack(track);
      return true;
    } catch (err) {
      console.error('[useLiveKitRoom] Error setting mic enabled:', err);
      return false;
    }
  }, []);

  // Get current mic state
  const getMicEnabled = useCallback(() => {
    const track = localAudioTrackRef.current;
    return track ? !track.isMuted : false;
  }, []);

// Cleanup on unmount
   useEffect(() => {
    return () => {
      try {
        const room = roomRef.current

        if (localAudioTrackRef.current) {
          localAudioTrackRef.current.stop()
          localAudioTrackRef.current = null
        }

        if (localVideoTrackRef.current) {
          localVideoTrackRef.current.stop()
          localVideoTrackRef.current = null
        }

        if (room) {
          room.disconnect()
        }
      } catch (err) {
        console.warn('[useLiveKitRoom] unmount cleanup failed:', err)
      }

      roomRef.current = null
      joinedRef.current = false
      joiningRef.current = false
      localUserIdRef.current = null
    }
  }, [])

  return {
    // State
    isConnected,
    isPublishing,
    isJoining,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    
    // Methods
    joinAsPublisher,
    joinAsAudience,
    leaveRoom,
    publishLocalTracks,
    unpublishLocalTracks,
    toggleCamera,
    toggleMicrophone,
    setMicEnabled,
    getMicEnabled,
    prewarmPublisherTracks,
    stopUnusedPrewarmedTracks,
    
    // Room ref for external access
    room: roomRef.current
  };
}

export default useLiveKitRoom;
