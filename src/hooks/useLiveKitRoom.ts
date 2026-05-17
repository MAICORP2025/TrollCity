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
  createLocalAudioTrack
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

  // Get LiveKit credentials from environment
  const getLiveKitUrl = () => import.meta.env.VITE_LIVEKIT_URL;
  const getLiveKitApiKey = () => import.meta.env.VITE_LIVEKIT_API_KEY;
  
  // Check if LiveKit is configured
  const isLiveKitConfigured = !!getLiveKitUrl() && !!getLiveKitApiKey();

  // Fetch LiveKit token via edge function
  const fetchToken = useCallback(async (roomName: string, userId: string, userName?: string) => {
    const requestBody = {
      room: roomName,
      identity: userId,
      name: userName || 'User',
      role: publish ? 'publisher' : 'audience',
      isHost: publish && roomType === 'pod' ? true : undefined,
    };

    const requestDetails = {
      roomName,
      userId,
      role: publish ? 'publisher' : 'audience',
      isHost: publish && roomType === 'pod',
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
       await audioTrack.enable(); // Ensure audio is enabled by default
       setLocalAudioTrack(audioTrack);
       localAudioTrackRef.current = audioTrack;

       // Video track - only create if not audio-only room
       if (!audioOnly && roomType !== 'pod') {
         try {
           const { createLocalVideoTrack } = await import('livekit-client');
           const videoTrack = await createLocalVideoTrack({
             ...videoPreset,
             facingMode: 'user'
           });
           setLocalVideoTrack(videoTrack);
           localVideoTrackRef.current = videoTrack;
         } catch (videoErr) {
           console.warn('[useLiveKitRoom] Could not create video track:', videoErr);
         }
       }

      return { audioTrack, videoTrack: localVideoTrack };
    } catch (err) {
      console.error('[useLiveKitRoom] Error creating local tracks:', err);
      throw err;
    }
  }, [audioOnly, roomType, videoPreset]);

  // Handle participant joined
  const handleParticipantJoined = useCallback((participant: RemoteParticipant) => {
    console.log('[useLiveKitRoom] Participant joined:', participant.identity, 'hasAudio:', participant.audioTrack !== undefined, 'hasVideo:', participant.videoTracks.size);
    setRemoteUsers(prev => {
      const exists = prev.find(p => p.identity === participant.identity);
      if (exists) return prev;
      return [...prev, participant];
    });
    onUserJoined?.(participant);
  }, [onUserJoined]);

  // Handle participant left
  const handleParticipantLeft = useCallback((participant: RemoteParticipant) => {
    console.log('[useLiveKitRoom] Participant left:', participant.identity);
    setRemoteUsers(prev => prev.filter(p => p.identity !== participant.identity));
    onUserLeft?.(participant);
  }, [onUserLeft]);

// Handle track subscribed
   const handleTrackSubscribed = useCallback((track: RemoteVideoTrack | RemoteAudioTrack, publication, participant: RemoteParticipant) => {
    if (!participant?.identity) {
      console.warn('[useLiveKitRoom] Track subscribed without participant identity', {
        kind: track?.kind,
        publicationSid: publication?.trackSid,
      })
      return
    }

    console.log('[useLiveKitRoom] Track subscribed:', track.kind, 'from', participant.identity, 'sid:', publication?.trackSid || track.sid)

    setRemoteUsers(prev => {
      const exists = prev.some(p => p.identity === participant.identity)
      if (exists) return [...prev]
      return [...prev, participant]
    })
  }, [])

// Handle track unsubscribed
   const handleTrackUnsubscribed = useCallback((track: RemoteVideoTrack | RemoteAudioTrack, publication, participant: RemoteParticipant) => {
    console.log('[useLiveKitRoom] Track unsubscribed:', track.kind, 'from', participant?.identity)

    if (!participant?.identity) {
      setRemoteUsers(prev => [...prev])
      return
    }

    setRemoteUsers(prev => [...prev])
  }, []);

  // Join LiveKit as publisher
  const joinAsPublisher = useCallback(async (userId: string) => {
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
        dynacast: true,
        videoCaptureDefaults: {
          ...videoPreset,
          facingMode: 'user'
        },
        audioCaptureDefaults: {
          ...AudioPresets.audio,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      roomRef.current = room;

      let prePublishAudioTrack: LocalAudioTrack | null = null;
      if (publish) {
try {
           prePublishAudioTrack = await createLocalAudioTrack();
           prePublishAudioTrack.enable();
           setLocalAudioTrack(prePublishAudioTrack);
           localAudioTrackRef.current = prePublishAudioTrack;
           console.log('[useLiveKitRoom] Created pre-connect audio track for publish');
        } catch (trackErr) {
          console.error('[useLiveKitRoom] Failed to create pre-connect audio track:', trackErr);
          throw trackErr;
        }
      }

      // Set up event listeners
      room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      
      // Ensure pre-created tracks are enabled before publishing
      if (prePublishAudioTrack) {
        await prePublishAudioTrack.enable();
      }
      if (localAudioTrack) {
        await localAudioTrack.enable();
      }
      
      // Handle disconnection events - delay reset for pods
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
      const token = await fetchToken(roomId, userId, userName);
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

      // Connect to room - include explicit identity/name for publisher sessions
      await room.connect(url, token, { name: roomId, identity: userId });
      await waitForRoomConnected(room, 5000);

      // Create and publish local tracks if publishing
      if (publish) {
        await waitForRoomConnected(room, 5000);
       console.log('[useLiveKitRoom] Ready to publish audio after stable connect', {
         state: room.state,
         connectionState: room.connectionState,
         sessionId: (room as any).sessionId,
         participantCount: room.remoteParticipants?.size,
       });

        await new Promise(resolve => setTimeout(resolve, 500));

        // Create and publish audio track  
        let audioTrack: LocalAudioTrack | null = localAudioTrack;
if (!audioTrack) {
           try {
             audioTrack = await createLocalAudioTrack();
             await audioTrack.enable();
             setLocalAudioTrack(audioTrack);
             localAudioTrackRef.current = audioTrack;
           } catch (trackErr) {
            console.error('[useLiveKitRoom] Error creating audio track before publish:', trackErr);
            throw trackErr;
          }
        } else {
          // Ensure existing track is enabled
          await audioTrack.enable();
        }

try {
           await room.localParticipant.publishTrack(audioTrack);
           setLocalAudioTrack(audioTrack);
           localAudioTrackRef.current = audioTrack;
           console.log('[useLiveKitRoom] Published audio track after connect', {
            source: roomType === 'pod' ? 'pod' : 'standard',
            audioTrackId: audioTrack.sid,
          });
} catch (trackErr) {
           console.error('[useLiveKitRoom] Error publishing audio track after connect:', trackErr);
           if (audioTrack) {
             try {
               audioTrack.stop();
             } catch (stopErr) {
               console.warn('[useLiveKitRoom] Failed to stop audio track after publish error:', stopErr);
             }
           }
           setLocalAudioTrack(null);
           localAudioTrackRef.current = null;
         }

// Create and publish video track (if not audioOnly)
         if (!audioOnly && roomType !== 'pod') {
           try {
             const { createLocalVideoTrack } = await import('livekit-client');
             const videoTrack = await createLocalVideoTrack({
               ...videoPreset,
               facingMode: 'user'
             });
             videoTrack.enable();
             setLocalVideoTrack(videoTrack);
             localVideoTrackRef.current = videoTrack;
             await room.localParticipant.publishTrack(videoTrack);
            console.log('[useLiveKitRoom] Published video track after connect', {
              videoTrackId: videoTrack.sid,
            });
          } catch (videoErr) {
            console.warn('[useLiveKitRoom] Error creating/publishing video track:', videoErr);
          }
        }

        setIsPublishing(true);
      }

       // Get existing participants - guard against undefined
       const existingParticipants = room.remoteParticipants ? Array.from(room.remoteParticipants.values()) : [];
       console.log('[useLiveKitRoom] Existing participants after connect:', existingParticipants.map(p => ({
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
      console.error('[useLiveKitRoom] Error joining as publisher:', err);
      
      // Check if this is a getUserMedia error - these often happen in LiveKit's internal
      // reconnection logic and don't necessarily mean the connection failed
      const errorMessage = err?.message || String(err) || '';
      const isGetUserMediaError = errorMessage.includes('getUserMedia');
      
      // Only reset state and call onError if it's NOT a getUserMedia error
      // or if we haven't successfully connected yet
      if (!isGetUserMediaError || !roomRef.current) {
        if (localAudioTrack) {
          try {
            localAudioTrack.stop();
          } catch (stopErr) {
            console.warn('[useLiveKitRoom] Failed to stop audio track on join error:', stopErr);
          }
        }
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
  }, [roomId, publish, audioOnly, roomType, videoPreset, fetchToken, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, handleTrackUnsubscribed, onError]);

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
      const token = await fetchToken(roomId, userId, userName);
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
      await room.connect(url, token, {
        name: roomId,
        identity: userId
      });
      await waitForRoomConnected(room, 5000);

       // Get existing participants - guard against undefined
       const existingParticipants = room.remoteParticipants ? Array.from(room.remoteParticipants.values()) : [];
       console.log('[useLiveKitRoom] Existing participants after connect:', existingParticipants.map(p => ({
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
  }, [roomId, fetchToken, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, handleTrackUnsubscribed, onError]);

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
    if (!localVideoTrack || !roomRef.current) return;

    try {
      if (localVideoTrack.isEnabled) {
        await roomRef.current.localParticipant.unpublishTrack(localVideoTrack);
        localVideoTrack.stop();
} else {
         const newTrack = await LocalVideoTrack.create(videoPreset);
         setLocalVideoTrack(newTrack);
         localVideoTrackRef.current = newTrack;
         await roomRef.current.localParticipant.publishTrack(newTrack);
      }
    } catch (err) {
      console.error('[useLiveKitRoom] Error toggling camera:', err);
    }
  }, [localVideoTrack, videoPreset]);

   // Toggle microphone - with error handling to prevent disconnects
   const waitForRoomConnected = useCallback(async (room: Room, timeoutMs = 5000) => {
     if (room.state === 'connected' || room.connectionState === 'CONNECTED') {
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

  const toggleMicrophone = useCallback(async () => {
    const track = localAudioTrack;
    if (!track) {
      return;
    }
    
    // Just toggle the track directly - doesn't need room
    try {
      if (track.isEnabled) {
        track.disable();
      } else {
        track.enable();
      }
    } catch (err) {
      console.warn('[useLiveKitRoom] Toggle mic error:', err);
    }
    return;

    const publishTrack = async (track: LocalAudioTrack) => {
      if (!room) throw new Error('Room unavailable');
      await room.localParticipant.publishTrack(track);
      setIsPublishing(true);
      console.log('[useLiveKitRoom] Published mic track');
    };

    // If track exists, toggle it
    if (localAudioTrack) {
      try {
        if (localAudioTrack.isEnabled) {
          // Muting - disable the track
          await localAudioTrack.disable();
          toast.success('Mic muted');
        } else {
          // Unmuting - enable the track
          await localAudioTrack.enable();
          toast.success('Mic unmuted');
        }
      } catch (err) {
        console.error('[useLiveKitRoom] Error toggling microphone:', err);
        toast.error('Failed to toggle mic');
      }
      return;
    }

// No track exists - create new one (first time enabling mic)
     let audioTrack: LocalAudioTrack | null = null;
     try {
       audioTrack = await createLocalAudioTrack();
       await audioTrack.enable();
       await publishTrack(audioTrack);
       setLocalAudioTrack(audioTrack);
       localAudioTrackRef.current = audioTrack;
       toast.success('Mic enabled!');
     } catch (err) {
       console.error('[useLiveKitRoom] Error enabling microphone:', err);
       if (audioTrack) {
         try {
           audioTrack.stop();
         } catch (stopErr) {
           console.warn('[useLiveKitRoom] Failed to stop audio track after publish error:', stopErr);
         }
       }
       setLocalAudioTrack(null);
       localAudioTrackRef.current = null;
     }
  }, [localAudioTrack, waitForRoomConnected]);

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
    toggleCamera,
    toggleMicrophone,
    
    // Room ref for external access
    room: roomRef.current
  };
}

export default useLiveKitRoom;
