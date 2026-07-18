import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { Room, LocalAudioTrack, LocalVideoTrack, RemoteParticipant, RemoteTrack, RemoteTrackPublication, RoomEvent } from "livekit-client";

import { supabase } from "../lib/supabase";
import { logActiveChannels } from "../lib/realtimeChannelDiagnostics";
import { Stream } from "../types/broadcast";
import { useAuthStore } from "../lib/store";
import { PreflightStore } from "../lib/preflightStore";
import { useCoins } from "../lib/hooks/useCoins";
import useTrollFamilyActivity from "./useTrollFamilyActivity";
import { useBattleRealtime } from "./useBattleRealtime";
import { toast } from "sonner";
import { useJailTime } from "./useJailTime";
import { BattleSounds } from "../lib/battleSounds";
import { useActiveBattles, ActiveBattle } from "../components/broadcast/battle/ActiveBattlesPanel";
import { safeValues, getTrackPublications, CrownInfo } from "../components/broadcast/BattleArena";

const logRTC = (message: string, data?: any) => {
  console.log(`[RTC] ${message}`, data || "");
};

export interface BattleViewProps {
  battleId: string;
  currentStreamId: string;
  viewerId?: string;
  localTracks?: [LocalAudioTrack | undefined, LocalVideoTrack | undefined] | null;
  remoteUsers?: RemoteParticipant[];
  userIdToLiveKitIdentity?: Record<string, string>;
  onReturnToStream?: () => void;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
}

export function useBattleViewController({
  battleId,
  currentStreamId,
  viewerId,
  localTracks: passedLocalTracks,
  remoteUsers: _passedRemoteUsers,
  userIdToLiveKitIdentity,
  onReturnToStream,
  onToggleCamera: onToggleCameraProp,
  onToggleMic: onToggleMicProp,
}: BattleViewProps) {
  // Provide safe defaults to prevent ReferenceError if props are undefined
  const onToggleCamera = onToggleCameraProp || (() => {});
  const onToggleMic = onToggleMicProp || (() => {});
  // Track connection phases to avoid repeated renders from track events
  const [trackRevision, setTrackRevision] = useState(0);
  const trackRevisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackRevisionRef = useRef(0);
  const [connectionPhase, setConnectionPhase] = useState<'idle' | 'connecting' | 'room-connected' | 'local-ready' | 'remote-ready'>('idle');
  const roomConnectedAtRef = useRef<number | null>(null);
  const preflightSetInBattleRef = useRef(false);
  const [battleTick, setBattleTick] = useState(0);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionRetryCountRef = useRef(0);
  const MAX_CONNECTION_RETRIES = 5;
  const CONNECTION_TIMEOUT_MS = 3000;

  const deferError = useCallback((message: string, delayMs?: number) => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    connectionTimeoutRef.current = setTimeout(() => {
      setError(message);
      setLoading(false);
    }, delayMs ?? CONNECTION_TIMEOUT_MS);
  }, []);

  const clearDeferredError = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);
  
  const [battle, setBattle] = useState<any>(null);
  const [challengerStream, setChallengerStream] = useState<Stream | null>(null);
  const [opponentStream, setOpponentStream] = useState<Stream | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  // Get coin/crown balances for display
  const { troll_coins: userCoins, crowns: userCrowns, trollmonds: userTrollmonds } = useCoins() as any;
  
  // Family activity recording
  const { recordBattleWon, recordBattleLost, recordBattleJoined } = useTrollFamilyActivity();
  const hasRecordedBattleJoinedRef = useRef(false);
  
  // Explicitly track enabled state to ensure camera stays on during battle
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  
  // Local track state - used for publishing to battle room (managed by component, not hook)
  const [battleLocalAudioTrack, setBattleLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [battleLocalVideoTrack, setBattleLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  // Cache tracks in refs to prevent disappearance during re-renders / effect re-runs
  const cachedAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const cachedVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  // Track whether we've already connected for this battle to prevent re-connect loops
  const hasPublishedTracksRef = useRef(false);
  const [participantSnapshots, setParticipantSnapshots] = useState<Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>>([]);
  // Full battle_participants rows (with profile join) — used by the mobile layout
  // to render team boxes. Crowns are intentionally NOT used for battle scoring.
  const [battleParticipants, setBattleParticipants] = useState<any[]>([]);
  // Real, authoritative per-recipient battle-point contributions aggregated from
  // realtime gift_sent events (gift coin value credited to the recipient). Never mocked.
  const [participantContributions, setParticipantContributions] = useState<Record<string, number>>({});
  const [arenaReadyAtMs, setArenaReadyAtMs] = useState<number | null>(null);
  const [arenaReady, setArenaReady] = useState(false);
  const hasHandledReturnRef = useRef(false);
  const [challengerCrownInfo, setChallengerCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  const [opponentCrownInfo, setOpponentCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  
  // Track stream live status to detect when a stream ends during battle
  const prevStreamLiveRef = useRef({ challenger: true, opponent: true });
  
  const publishedArenaReadyRef = useRef(false);
  const isReusingRoomRef = useRef(false);
  const battleRoomRef = useRef<Room | null>(null); // FIX 1: Prevent double connection
  const isConnectingRef = useRef(false); // FIX 1: Track connection state
  const connectedBattleIdRef = useRef<string | null>(null); // PHASE 3: Track which battleId the room is connected for
  const previousBattleIdRef = useRef<string | null>(null); // PHASE 3: Track battleId changes for cleanup
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const effectiveUserId = viewerId || user?.id;

  // Consolidated battle realtime hook (replaces 6 separate channel subscriptions)
  const { state: battleRealtime } = useBattleRealtime(battleId || null);

  // Realtime list of other live battles (for the Active Battles sidebar + next-stream nav)
  const { battles: activeBattles, loading: activeBattlesLoading } = useActiveBattles(battleId);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const resolvedBattleRole = useMemo<'host' | 'stage' | 'viewer' | null>(() => {
    if (!effectiveUserId || !challengerStream?.user_id || !opponentStream?.user_id) return null;
    if (effectiveUserId === challengerStream.user_id || effectiveUserId === opponentStream.user_id) return 'host';
    if (participantInfo?.role === 'host' || participantInfo?.role === 'stage' || participantInfo?.role === 'viewer') {
      return participantInfo.role;
    }
    return 'viewer';
  }, [effectiveUserId, challengerStream?.user_id, opponentStream?.user_id, participantInfo?.role]);

  const isBroadcaster = resolvedBattleRole === 'host' || resolvedBattleRole === 'stage';
  // Broadcasters use LiveKit. All viewers use LiveKit only.
  const isRandomBattle = challengerStream?.battle_mode === 'random_queue' || opponentStream?.battle_mode === 'random_queue';

  // â”€â”€ Channel diagnostics (dev only) â”€â”€
  useEffect(() => {
    logActiveChannels(`BattleView:mount:${battleId}`);
    return () => logActiveChannels(`BattleView:unmount:${battleId}`);
  }, [battleId]);

  // DEBUG: Log battle state
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[BattleView] State:', {
      battleId,
      effectiveUserId,
      resolvedBattleRole,
      isBroadcaster,
    });
  }, [battleId, effectiveUserId, resolvedBattleRole, isBroadcaster]);

  // PHASE 5: Dev-only mount/unmount log to identify StrictMode double-mount vs real spam
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[BattleView] MOUNT battleId=', battleId);
      return () => console.log('[BattleView] UNMOUNT battleId=', battleId);
    }
    return;
  }, [battleId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prefer tracks passed from BroadcastPage; fallback to PreflightStore when page refresh/race drops props.
  // Normalize: ensure we always have a tuple [audio, video] even if one is undefined
  const normalizeTracks = (tracks: any): [LocalAudioTrack | undefined, LocalVideoTrack | undefined] | null => {
    if (!tracks) return null;
    // Already a tuple
    if (Array.isArray(tracks)) {
      const audio = tracks[0] || undefined;
      const video = tracks[1] || undefined;
      if (!audio && !video) return null;
      return [audio, video];
    }
    const audio = tracks.audio ?? tracks.audioTrack;
    const video = tracks.video ?? tracks.videoTrack;
    if (!audio && !video) return null;
    return [audio, video];
  };
  const localTracksFromPreflight = normalizeTracks(passedLocalTracks)
    || normalizeTracks(PreflightStore.getLivekitTracks())
    || normalizeTracks(PreflightStore.getTracks())
    || null;

  // Mobile retry: if no tracks yet, retry PreflightStore after a short delay
  // This handles the race condition where BattleView mounts before PreflightStore is populated
  const [retryTracks, setRetryTracks] = useState<[LocalAudioTrack | undefined, LocalVideoTrack | undefined] | null>(null);
  useEffect(() => {
    if (localTracksFromPreflight) return;
    if (!isBroadcaster) return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      const tracks = normalizeTracks(PreflightStore.getLivekitTracks()) || normalizeTracks(PreflightStore.getTracks());
      if (tracks) {
        if (import.meta.env.DEV) console.log('[BattleView] Mobile retry: found PreflightStore tracks');
        setRetryTracks(tracks);
        clearInterval(interval);
        return;
      }
      if (attempts >= 6) {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [localTracksFromPreflight, isBroadcaster]);

  const effectiveLocalTracks = localTracksFromPreflight || retryTracks;
  const effectiveLocalTracksKey = effectiveLocalTracks
    ? `${effectiveLocalTracks[0]?.sid ?? 'noaudio'}|${effectiveLocalTracks[1]?.sid ?? 'novideo'}`
    : 'none';

  // REMOVED useBattleRoom hook - using legacy connection only to avoid conflicts
  // The legacy code uses room name: battle-{battleId}

  // Update mic/camera enabled state based on track availability
  useEffect(() => {
    if (battleLocalAudioTrack) {
      setIsMicEnabled(true);
    }
    if (battleLocalVideoTrack) {
      setIsCameraEnabled(true);
    }
  }, [battleLocalAudioTrack, battleLocalVideoTrack]);

  // Fetch crown info for both broadcasters
  useEffect(() => {
    const fetchCrownInfo = async () => {
      if (!challengerStream?.user_id || !opponentStream?.user_id) return;

      const { data: challengerProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', challengerStream.user_id)
        .maybeSingle();

      const { data: opponentProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', opponentStream.user_id)
        .maybeSingle();

      if (challengerProfile) {
        setChallengerCrownInfo({
          crowns: challengerProfile.battle_crowns || 0,
          streak: challengerProfile.battle_crown_streak || 0,
          hasStreak: (challengerProfile.battle_crown_streak || 0) >= 3,
        });
      }

      if (opponentProfile) {
        setOpponentCrownInfo({
          crowns: opponentProfile.battle_crowns || 0,
          streak: opponentProfile.battle_crown_streak || 0,
          hasStreak: (opponentProfile.battle_crown_streak || 0) >= 3,
        });
      }
    };

    fetchCrownInfo();
  }, [challengerStream?.user_id, opponentStream?.user_id]);

  // Refs holding the latest battle + local tracks so the connection effect can
  // read them WITHOUT being re-subscribed on every re-render / track churn.
  // Depending on `effectiveLocalTracksKey` previously caused an infinite
  // connect/disconnect storm: BattleView re-created the LiveKit battle room on
  // every local-track identity change, which also prevented the opponent's
  // remote tracks from ever settling.
  const battleViewStateRef = useRef<{ battle: any; effectiveLocalTracks: [LocalAudioTrack | undefined, LocalVideoTrack | undefined] | null }>({ battle, effectiveLocalTracks });
  battleViewStateRef.current = { battle, effectiveLocalTracks };

  // LiveKit setup - ALWAYS create a NEW connection to the battle room
  // Do NOT reuse the main broadcast room - we need a separate battle room connection
  useEffect(() => {
    // Read latest values from ref so the effect doesn't re-run on track/object churn
    const battle = battleViewStateRef.current.battle;
    const effectiveLocalTracks = battleViewStateRef.current.effectiveLocalTracks;
    // Skip if battle isn't ready yet
    if (!battle || !effectiveUserId) return;

    // GUARD: Do NOT initialize the battle room until the participant role is known.
    // `resolvedBattleRole` is null until challenger/opponent streams load. Without this
    // guard the effect ran first with role=null (isBroadcaster=false) and connected as a
    // VIEWER, then re-ran the instant the role resolved to 'host' (isBroadcaster flips
    // true). That second run tore down the first room WHILE its publish was still in
    // flight â€” producing "could not createOffer with closed peer connection", a
    // connectâ†’publishâ†’disconnect race, spurious track subscribe/unsubscribe, and wiped
    // publications. Waiting for the role means the room is created exactly once, correctly.
    if (resolvedBattleRole === null) {
      if (import.meta.env.DEV) {
        console.log('[BattleView] Waiting for battle role to resolve before connecting');
      }
      return;
    }

    // PHASE 3: If battleId changed, disconnect old room first
    const previousBattleId = previousBattleIdRef.current;
    if (previousBattleId !== battleId) {
      // BattleId changed â€” disconnect old room if exists
      if (battleRoomRef.current && previousBattleId !== null) {
        if (import.meta.env.DEV) {
          console.log('[BattleView] battleId changed, disconnecting old room:', previousBattleId, 'â†’', battleId);
        }
        battleRoomRef.current.disconnect();
        battleRoomRef.current = null;
        connectedBattleIdRef.current = null;
        isConnectingRef.current = false;
      }
      previousBattleIdRef.current = battleId;
    }

    // If already connected for this battleId, do not reconnect solely because role/broadcaster state changed
    if (connectedBattleIdRef.current === battleId && battleRoomRef.current && battleRoomRef.current.state === 'connected') {
      return;
    }

    // FIX 1: Prevent double connection - check if already connecting
    if (isConnectingRef.current) {
      return;
    }
    
    // Always create a new room for battle - don't reuse existing room from PreflightStore
    if (import.meta.env.DEV) console.log('[BattleView] Creating new battle room connection (battle-' + battle.id + ')');
    isConnectingRef.current = true;
    isReusingRoomRef.current = false;
    const client = new Room();
    battleRoomRef.current = client;
    setLivekitRoom(client);
    
    // Track connection state to prevent race conditions
    const isRoomConnectedRef = { current: false };
    const isRoomDisconnectedRef = { current: false };
    
    let mounted = true;
    let createdAudioTrack: LocalAudioTrack | null = null;
    let createdVideoTrack: LocalVideoTrack | null = null;

    const waitForRoomConnected = async (timeoutMs = 5000) => {
      const startedAt = Date.now();
      while (mounted && client.state !== 'connected' && Date.now() - startedAt < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return mounted && client.state === 'connected';
    };

    const publishLocalTrack = async (
      track: LocalAudioTrack | LocalVideoTrack,
      options: { name: string },
      label: 'audio' | 'video'
    ) => {
      if (!(await waitForRoomConnected())) {
        console.warn(`[BattleView] Skipping ${label} publish - battle room is not connected`, {
          state: client.state,
        });
        return;
      }

      try {
        await client.localParticipant.publishTrack(track, options);
        if (import.meta.env.DEV) {
          console.log('[BattleAudio] Local track published', {
            label,
            enabled: (track as any)?.enabled,
            trackSid: (track as any)?.sid,
          });
        }
      } catch (e: any) {
        if (e?.name === 'UnexpectedConnectionState' || String(e?.message || e).includes('not connected')) {
          console.warn(`[BattleView] ${label} publish raced connection state, retrying once`, e);
          if (await waitForRoomConnected(3000)) {
            await client.localParticipant.publishTrack(track, options);
            return;
          }
        }
        throw e;
      }
    };

    const cloneLocalTrackForBattle = <T extends LocalAudioTrack | LocalVideoTrack>(
      track: T,
      kind: 'audio' | 'video'
    ): T | null => {
      try {
        const mediaTrack = (track as any).getMediaStreamTrack?.() || (track as any).mediaStreamTrack;
        if (!mediaTrack) {
          throw new Error('No native MediaStreamTrack available');
        }
        const clonedMediaTrack = mediaTrack.clone();
        return (kind === 'video'
          ? new LocalVideoTrack(clonedMediaTrack)
          : new LocalAudioTrack(clonedMediaTrack)) as T;
      } catch (e) {
        console.warn(`[BattleView] Failed to clone ${kind} track for battle room`, e);
        return null;
      }
    };

    const joinBattle = async () => {
      if (!battle || !effectiveUserId) return;

      const roomName = `battle-${battle.id}`;

      if (isBroadcaster) {
        try {
          const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: { room: roomName, userId: effectiveUserId, role: 'publisher' },
          });
          if (error) throw error;

          // Add connection error handling with retry logic
          let connectAttempts = 0;
          const maxConnectAttempts = MAX_CONNECTION_RETRIES;
          const connectWithRetry = async () => {
            while (connectAttempts < maxConnectAttempts) {
              try {
                await client.connect(
                  import.meta.env.VITE_LIVEKIT_URL,
                  data.token
                );
                const existingRemote = safeValues(client.remoteParticipants);
                if (existingRemote.length > 0) {
                  setRemoteUsers(existingRemote);
                }
                isRoomConnectedRef.current = await waitForRoomConnected();
                console.log('[BattleView] Successfully connected to battle room');
                return isRoomConnectedRef.current;
              } catch (connectError: any) {
                connectAttempts++;
                console.warn(`[BattleView] Connection attempt ${connectAttempts} failed:`, connectError?.message || connectError);
                
                // Check if it's a connection error that we can retry
                if (connectError?.message?.includes('could not establish pc connection') || 
                    connectError?.message?.includes('connection failed') ||
                    connectError?.message?.includes('Failed to connect')) {
                  if (connectAttempts < maxConnectAttempts) {
                    // Exponential backoff: 1s, 2s, 4s, 8s
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, connectAttempts - 1)));
                    continue;
                  }
                }
                // For other errors or max attempts reached, stop trying
                break;
              }
            }
            return false;
          };

          const connected = await connectWithRetry();
          
          if (!connected) {
            console.error('[BattleView] All connection attempts failed');
            setConnectionStatus('failed');
            isConnectingRef.current = false; // FIX 1: Reset on failure
            toast.error('Could not connect to battle. Please check your internet connection and try again.');
            return;
          }

          if (isBroadcaster && battle?.id && !hasRecordedBattleJoinedRef.current) {
            hasRecordedBattleJoinedRef.current = true;
            try {
              await recordBattleJoined(battle.id, currentStreamId);
            } catch (err) {
              console.warn('[BattleView] Failed to record battle joined:', err);
            }
          }

          // Prevent re-publishing tracks on effect re-runs (causes track disappearance)
          if (hasPublishedTracksRef.current) {
            if (import.meta.env.DEV) {
              console.log('[BattleView] Tracks already published for this battle, skipping re-publish');
            }
          } else if (effectiveLocalTracks?.[0] || effectiveLocalTracks?.[1]) {
            // Handle tracks independently - publish whatever is available (audio-only, video-only, or both)
            // This is critical for mobile where video track might not be immediately available
            const tracksToPublish: string[] = [];
            if (effectiveLocalTracks?.[0]) {
              const audioTrack = cloneLocalTrackForBattle(effectiveLocalTracks[0], 'audio');
              if (audioTrack) {
                createdAudioTrack = audioTrack;
                cachedAudioTrackRef.current = audioTrack;
                setBattleLocalAudioTrack(audioTrack);
              } else {
                cachedAudioTrackRef.current = effectiveLocalTracks[0];
                setBattleLocalAudioTrack(effectiveLocalTracks[0]);
              }
              setIsMicEnabled(true);
              const audioTrackToPublish = audioTrack || effectiveLocalTracks[0];
              if (audioTrackToPublish) {
                try {
                  await publishLocalTrack(audioTrackToPublish, { name: 'audio' }, 'audio');
                  tracksToPublish.push('audio');
                } catch (e) {
                  console.warn('[BattleView] Failed to publish audio track:', e);
                }
              }
            }
            if (effectiveLocalTracks?.[1]) {
              const videoTrack = cloneLocalTrackForBattle(effectiveLocalTracks[1], 'video');
              if (videoTrack) {
                createdVideoTrack = videoTrack;
                cachedVideoTrackRef.current = videoTrack;
                setBattleLocalVideoTrack(videoTrack);
              } else {
                cachedVideoTrackRef.current = effectiveLocalTracks[1];
                setBattleLocalVideoTrack(effectiveLocalTracks[1]);
              }
              setIsCameraEnabled(true);
              const videoTrackToPublish = videoTrack || effectiveLocalTracks[1];
              if (videoTrackToPublish) {
                try {
                  await publishLocalTrack(videoTrackToPublish, { name: 'video' }, 'video');
                  tracksToPublish.push('video');
                } catch (e) {
                  console.warn('[BattleView] Failed to publish video track:', e);
                }
              }
            }
            hasPublishedTracksRef.current = true;
            if (import.meta.env.DEV) {
              console.log('[BattleView] Published tracks to battle room:', tracksToPublish.join(', ') || 'none');
            }
          } else {
            // Do not request fresh media in battle view; it is unstable after route transitions
            // and causes camera dropouts/reconnect loops. Battle should reuse broadcast tracks only.
            console.warn('[BattleView] No reusable local tracks available for host in battle room');
            setIsCameraEnabled(false);
            setIsMicEnabled(false);
          }
        } catch (error) {
          console.error("Failed to join battle as publisher:", error);
          toast.error("Couldn't connect to the battle.");
        }
      } else {
        try {
          const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: { room: roomName, userId: effectiveUserId, role: 'viewer' },
          });
          if (error) throw error;
          
          // Add connection error handling for viewers too
          let connectAttempts = 0;
          const maxConnectAttempts = MAX_CONNECTION_RETRIES;
          
          while (connectAttempts < maxConnectAttempts) {
            try {
              await client.connect(
                import.meta.env.VITE_LIVEKIT_URL,
                data.token
              );
              const existingRemote = safeValues(client.remoteParticipants);
              if (existingRemote.length > 0) {
                setRemoteUsers(existingRemote);
              }
              isRoomConnectedRef.current = true;
              console.log('[BattleView] Viewer connected to battle room');
              break;
            } catch (connectError: any) {
              connectAttempts++;
              console.warn(`[BattleView] Viewer connection attempt ${connectAttempts} failed:`, connectError?.message || connectError);
              
              if (connectAttempts < maxConnectAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, connectAttempts - 1)));
              }
            }
          }
          
          if (!isRoomConnectedRef.current) {
            console.error('[BattleView] Viewer could not connect to battle room after all attempts');
            setConnectionStatus('failed');
            isConnectingRef.current = false; // FIX 1: Reset on failure
            toast.error('Could not connect to battle. Please check your internet connection.');
          }
        } catch (error) {
          console.error("Failed to join battle as viewer:", error);
        }
      }
    };

    // Handle participant connected - FIX 4: Listen for participants correctly
    const handleParticipantConnected = (participant: RemoteParticipant) => {
      setRemoteUsers(prev => {
        if (prev.some(p => p.identity === participant.identity)) {
          return prev;
        }
        if (import.meta.env.DEV) console.log('[BattleView] Participant connected:', participant.identity, 'total:', prev.length + 1);
        return [...prev, participant];
      });
      setBattleTick(t => t + 1);
    };

    // Handle participant disconnected
    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      setRemoteUsers(prev => {
        // Skip update if participant not in list
        if (!prev.some(p => p.identity === participant.identity)) return prev;
        const newList = prev.filter(p => p.identity !== participant.identity);
        return newList;
      });
    };

    // FIX #2 & #3: Use trackRevision counter instead of forceUpdate
    // This ensures ArenaComponent only rerenders when tracks actually become available
    // NOT on every track event (which was causing 20+ rerenders)
    const handleTrackSubscribed = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      // Skip if room is disconnected
      if (isRoomDisconnectedRef.current || !client || client.state !== 'connected') {
        logRTC('Skipping track subscribed - room not connected');
        return;
      }
      logRTC('Track subscribed', {
        trackKind: track.kind,
        trackSid: track.sid,
        participantIdentity: participant.identity,
      });
      setBattleTick(t => t + 1);
      // Debounce trackRevision to prevent flashing — batch rapid track events into single update
      if (trackRevisionTimerRef.current) {
        clearTimeout(trackRevisionTimerRef.current);
      }
      trackRevisionTimerRef.current = setTimeout(() => {
        setTrackRevision((v) => v + 1);
        trackRevisionTimerRef.current = null;
      }, 300);
    };

    // Handle track unsubscribed
    const handleTrackUnsubscribed = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      // Skip if room is disconnected
      if (isRoomDisconnectedRef.current || !client || client.state !== 'connected') {
        logRTC('Skipping track unsubscribed - room not connected');
        return;
      }
      logRTC('Track unsubscribed', {
        trackKind: track.kind,
        trackSid: track.sid,
        participantIdentity: participant.identity,
      });
      setBattleTick(t => t + 1);
      // Track unsubscribed â€” also debounced
      if (trackRevisionTimerRef.current) {
        clearTimeout(trackRevisionTimerRef.current);
      }
      trackRevisionTimerRef.current = setTimeout(() => {
        setTrackRevision((v) => v + 1);
        trackRevisionTimerRef.current = null;
      }, 300);
    };

    // Handle track published (local participant published a track)
    const handleTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      // Skip if room is disconnected
      if (isRoomDisconnectedRef.current || !client || client.state !== 'connected') {
        console.log('[BattleView] Skipping track published - room not connected');
        return;
      }
      if (import.meta.env.DEV) {
        console.log('[BattleView] Track published:', {
          trackKind: publication.kind,
          trackSid: publication.trackSid,
          trackSource: publication.source,
          participantIdentity: participant.identity,
          battleId,
          expectedChallenger: challengerLiveKitIdentity,
          expectedOpponent: opponentLiveKitIdentity,
        });
      }
      setBattleTick(t => t + 1);
    };

    // Handle track unpublished
    const handleTrackUnpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      // Skip if room is disconnected
      if (isRoomDisconnectedRef.current || !client || client.state !== 'connected') {
        console.log('[BattleView] Skipping track unpublished - room not connected');
        return;
      }
      console.log('[BattleView] Track unpublished:', {
        trackKind: publication.kind,
        trackSid: publication.trackSid,
        trackSource: publication.source,
        participantIdentity: participant.identity,
      });
      // Don't trigger rerender on unpublished - this is cleanup
    };

    client.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    client.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    client.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    client.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    client.on(RoomEvent.TrackPublished, handleTrackPublished);
    client.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    
    // Handle connection status changes
    client.on(RoomEvent.Connected, () => {
      console.log('[BattleView] Room connected event');
      setConnectionStatus('connected');
      setConnectionPhase('room-connected');
      roomConnectedAtRef.current = Date.now();
      isRoomConnectedRef.current = true;
      isConnectingRef.current = false; // FIX 1: Reset connecting flag
    });
    
    client.on(RoomEvent.Disconnected, () => {
      console.log('[BattleView] Room disconnected event');
      setConnectionStatus('disconnected');
      isRoomDisconnectedRef.current = true;
    });
    
    client.on(RoomEvent.Reconnecting, () => {
      console.log('[BattleView] Room reconnecting...');
      setConnectionStatus('connecting');
    });
    
    client.on(RoomEvent.Reconnected, () => {
      console.log('[BattleView] Room reconnected');
      setConnectionStatus('connected');
      isRoomConnectedRef.current = true;
      setBattleTick(t => t + 1);
    });
    
    client.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (import.meta.env.DEV) {
        console.log('[BattleView] Connection state changed:', state);
      }
      if (state === 'connected') {
        setConnectionStatus('connected');
        isRoomConnectedRef.current = true;
        connectedBattleIdRef.current = battleId; // PHASE 3: Mark as connected for this battleId
      } else if (state === 'disconnected') {
        setConnectionStatus('disconnected');
        isRoomDisconnectedRef.current = true;
        connectedBattleIdRef.current = null; // PHASE 3: Clear on disconnect
      } else if (state === 'connecting' || state === 'reconnecting') {
        setConnectionStatus('connecting');
      }
    });

    joinBattle();

    return () => {
      mounted = false;
      isRoomDisconnectedRef.current = true;
      isConnectingRef.current = false;
      connectedBattleIdRef.current = null;
      // Reset publish flag and clear track debounce timer on unmount
      hasPublishedTracksRef.current = false;
      if (trackRevisionTimerRef.current) {
        clearTimeout(trackRevisionTimerRef.current);
        trackRevisionTimerRef.current = null;
      }
      
      if (battleRoomRef.current === client) {
        // Remove all listeners first to prevent events during cleanup
        client.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
        client.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        client.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        client.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        client.off(RoomEvent.TrackPublished, handleTrackPublished);
        client.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
        
        // Only stop tracks if they were created/cloned in this component (not passed in)
        if (createdAudioTrack) {
          if (import.meta.env.DEV) console.log('[BattleView] Cleanup: stopping created audio track');
          createdAudioTrack.stop();
        }
        if (createdVideoTrack) {
          if (import.meta.env.DEV) console.log('[BattleView] Cleanup: stopping created video track');
          createdVideoTrack.stop();
        }
        
        // Only disconnect if room is still connected
        if (client.state === 'connected') {
          if (import.meta.env.DEV) console.log('[BattleView] Cleanup: disconnecting room');
          client.disconnect();
        }
        
        battleRoomRef.current = null;
      }
      // Do NOT call PreflightStore.clear() - tracks belong to the main broadcast
    };
    // NOTE: `resolvedBattleRole` (not just `isBroadcaster`) is a dependency so the effect
    // re-runs once the role transitions from null â†’ 'host'/'stage'/'viewer'. The guard at
    // the top ensures the first (role=null) render never opens a connection, so the room is
    // created a single time with the correct role instead of viewer-then-host.
  }, [battleId, effectiveUserId, battle?.id, isBroadcaster, resolvedBattleRole]);

  // Handle publishing changes when broadcaster status changes without reconnecting the room
  useEffect(() => {
    if (!battleRoomRef.current || battleRoomRef.current.state !== 'connected') return;
    if (!battle || !effectiveUserId) return;

    const client = battleRoomRef.current;
    const localParticipant = client.localParticipant;

    if (isBroadcaster && !hasPublishedTracksRef.current) {
      (async () => {
        try {
          if (effectiveLocalTracks?.[0]) {
            await localParticipant.publishTrack(effectiveLocalTracks[0], { name: 'audio' });
          }
          if (effectiveLocalTracks?.[1]) {
            await localParticipant.publishTrack(effectiveLocalTracks[1], { name: 'video' });
          }
          hasPublishedTracksRef.current = true;
        } catch (e) {
          console.warn('[BattleView] Failed to publish tracks on broadcaster role change:', e);
        }
      })();
    }
  }, [isBroadcaster, battle?.id, effectiveUserId, effectiveLocalTracksKey]);

  const [showMobileChat, setShowMobileChat] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const [showMobileGiftTray, setShowMobileGiftTray] = useState(false);

  // Gift recipient state for battle mode
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftStreamId, setGiftStreamId] = useState<string | null>(null);

  // Remote users state - initialize as empty array, battle room participants are managed internally
  // Don't use passedRemoteUsers as those are from the main broadcast room, not the battle room
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);

  const handleGiftSelect = useCallback((uid: string, sourceStreamId: string) => {
    if (isBroadcaster) return;
    if (effectiveUserId && uid === effectiveUserId) return;
    setGiftRecipientId(uid);
    setGiftStreamId(sourceStreamId);
    if (isMobileViewport) {
      setShowMobileGiftTray(true);
    }
  }, [isBroadcaster, effectiveUserId, isMobileViewport]);

  const myStream = useMemo(() => {
    if (!participantInfo?.team) return null;
    if (participantInfo.team === 'challenger') return challengerStream;
    if (participantInfo.team === 'opponent') return opponentStream;
    return null;
  }, [participantInfo?.team, challengerStream, opponentStream]);

  // Persist a broadcaster seat (box) count change for a given team.
  // Used by BattleArena's broadcaster seat-management controls. Optimistically
  // updates local state, broadcasts box_count_changed (consumed in realtime),
  // and writes through to the DB via set_stream_box_count.
  const setTeamBoxCount = useCallback(async (team: 'challenger' | 'opponent', newCount: number) => {
    const targetStream = team === 'challenger' ? challengerStream : opponentStream;
    if (!targetStream) return;

    if (newCount < 1) {
      toast.warning('Cannot have less than 1 box.');
      return;
    }
    if (newCount > 6) {
      toast.warning('Maximum 6 boxes allowed.');
      return;
    }

    const prevStream = targetStream;
    if (team === 'challenger') {
      setChallengerStream({ ...targetStream, box_count: newCount });
    } else {
      setOpponentStream({ ...targetStream, box_count: newCount });
    }

    try {
      const broadcastChannel = supabase.channel(`stream:${targetStream.id}`);

      await new Promise<void>((resolve, reject) => {
        broadcastChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error('Channel subscription failed'));
          }
        });
      });

      await broadcastChannel.send({
        type: 'broadcast',
        event: 'box_count_changed',
        payload: { box_count: newCount, stream_id: targetStream.id }
      });

      setTimeout(() => {
        supabase.removeChannel(broadcastChannel);
      }, 3000);
    } catch (broadcastErr) {
      console.warn('[BoxCount] Broadcast error (non-fatal):', broadcastErr);
    }

    const { error } = await supabase.rpc('set_stream_box_count', {
      p_stream_id: targetStream.id,
      p_new_box_count: newCount
    });

    if (error) {
      toast.error('Failed to update box count.');
      if (team === 'challenger') {
        setChallengerStream(prevStream);
      } else {
        setOpponentStream(prevStream);
      }
    } else {
      toast.success(team === 'challenger' ? 'Blue seat updated' : 'Red seat updated');
    }
  }, [challengerStream, opponentStream]);

   // Initialize battle
   useEffect(() => {
     const initBattle = async () => {
       try {
         if (connectionTimeoutRef.current) {
           clearTimeout(connectionTimeoutRef.current);
           connectionTimeoutRef.current = null;
         }
         setError(null);
         setLoading(true);
        // Set battle mode flag to hide TrollEngine during battles
        // FIX 7: Only set if not already set to avoid repeated updates
        if (!preflightSetInBattleRef.current && !PreflightStore.getInBattle()) {
          PreflightStore.setInBattle(true);
          preflightSetInBattleRef.current = true;
          if (import.meta.env.DEV) console.log('[BattleView] Set isInBattle = true');
        }
        
        // DEBUG: Log battleId and auth state before query
        const { data: { user: authUser } } = await supabase.auth.getUser();
        console.log('[BattleView] DEBUG initBattle', { battleId, authUserId: authUser?.id, authUserExists: !!authUser });

        // Verify battle_id format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!battleId || !uuidRegex.test(battleId)) {
          setError('Invalid battle ID');
          return;
        }

        // Retry DB query up to 3 times with short delays â€” handles race where battle row is being created
        let battleData: any = null;
        let battleError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await supabase.from('battles').select('*').eq('id', battleId).maybeSingle();
          battleData = result.data;
          battleError = result.error;
          if (battleData) break;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        // Use a resolvedBattle local variable so later code doesn't accidentally
        // dereference `battleData` when it was null and we used a realtime fallback.
        let resolvedBattle: any = null;
        if (battleError || !battleData) {
          console.warn('[BattleView] battle query returned empty or error after retries', { battleId, battleData, battleError });
          // Fallback: prefer realtime state (handles viewers with RLS blocking DB reads)
          const realtimeCandidate = (battleRealtime as any)?.battle;
          if (realtimeCandidate) {
            console.log('[BattleView] Using immediate battleRealtime fallback for battle', battleId);
            setBattle(realtimeCandidate);
            resolvedBattle = realtimeCandidate;
          } else {
            // wait up to 3000ms for realtime to populate
            let found = false;
            const start = Date.now();
            while (!found && Date.now() - start < 3000) {
              // eslint-disable-next-line no-await-in-loop
              await new Promise((r) => setTimeout(r, 100));
              const candidate = (battleRealtime as any)?.battle;
              if (candidate) {
                console.log('[BattleView] Using delayed battleRealtime fallback for battle', battleId);
                setBattle(candidate);
                resolvedBattle = candidate;
                found = true;
                break;
              }
            }
            if (!found) {
              // last-resort: try window fallback populated for debugging
              const realtimeFallback = (typeof window !== 'undefined' && (window as any).__battleRealtimeFallback && (window as any).__battleRealtimeFallback[battleId]) || null;
              if (realtimeFallback) {
                console.log('[BattleView] Using window realtime fallback for battle', battleId);
                setBattle(realtimeFallback);
                resolvedBattle = realtimeFallback;
          } else {
            deferError('Battle not found');
            return;
          }
            }
          }
        } else {
          setBattle(battleData);
          resolvedBattle = battleData;
        }

        // From here on, use `resolvedBattle` (it will never be null)
        if (resolvedBattle?.status === 'ended') {
          setShowResults(true);
          setShowRematchOption(true);
        }

        const { data: streams, error: streamsError } = await supabase
          .from('streams')
          .select('*')
          .in('id', [resolvedBattle.challenger_stream_id, resolvedBattle.opponent_stream_id]);
            
        if (streamsError || !streams) {
          deferError('Failed to load battle streams: ' + (streamsError?.message || 'Unknown error'));
          return;
        }

        const cStream = streams.find(s => s.id === resolvedBattle.challenger_stream_id);
        const oStream = streams.find(s => s.id === resolvedBattle.opponent_stream_id);
            
        if (!cStream) {
          deferError('Challenger stream not found or not live.');
          return;
        }
        if (!oStream) {
          deferError('Opponent stream not found or not live.');
          return;
        }
              
        setChallengerStream(cStream);
        setOpponentStream(oStream);

        if (effectiveUserId) {
          const { data: pData, error: pError } = await supabase
            .from('battle_participants')
            .select('*')
            .eq('battle_id', battleId)
            .eq('user_id', effectiveUserId)
            .maybeSingle();
          if (pError) {
            console.error("Error fetching participant data", pError);
          }
          if (pData) {
            setParticipantInfo(pData);
          } else if (effectiveUserId === cStream.user_id) {
            setParticipantInfo({ role: 'host', team: 'challenger' });
          } else if (effectiveUserId === oStream.user_id) {
            setParticipantInfo({ role: 'host', team: 'opponent' });
          } else {
            setParticipantInfo({ role: 'viewer', team: null });
          }
        }

        const { data: participantData } = await supabase
          .from('battle_participants')
          .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
          .eq('battle_id', battleId);
        setParticipantSnapshots((participantData as Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>) || []);
        setBattleParticipants((participantData as any[]) || []);
      } catch (e) {
        console.error("[BattleView] Initialization error:", e);
        deferError('Failed to initialize battle');
      } finally {
        setLoading(false);
      }
    };
    initBattle();

    // Consolidated battle realtime: replaces 6 separate channels with 1
    // Channels removed: battle:${battleId}, battle_participants:${battleId},
    //   battle_arena:${battleId}, battle_stream_${challengerId},
    //   battle_stream_${opponentId}, battle-sync-gifts:${streamId} (×2)
    return () => {
      clearDeferredError();
      // Clear battle mode flag when leaving battle
      PreflightStore.setInBattle(false);
      preflightSetInBattleRef.current = false;
      if (import.meta.env.DEV) console.log('[BattleView] Set isInBattle = false (cleanup)');
    };
  }, [battleId]);

  // Expose realtime battle state on window for debugging/fallback when DB reads fail
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__battleRealtimeFallback = (window as any).__battleRealtimeFallback || {};
    if (battleRealtime?.battle && battleId) {
      (window as any).__battleRealtimeFallback[battleId] = battleRealtime.battle;
    }
  }, [battleRealtime?.battle, battleId]);

  // Sync consolidated realtime state into BattleView state
  useEffect(() => {
    if (!battleRealtime.battle) return;
    clearDeferredError();
    setBattle((prev: any) => {
      // PHASE 2: Avoid unnecessary re-renders — only update if battle data actually changed
      if (!prev) return battleRealtime.battle;
      const keys = ['score_challenger', 'score_opponent', 'status', 'started_at', 'ends_at', 'winner_id', 'sudden_death'];
      const changed = keys.some((k) => (prev as any)[k] !== (battleRealtime.battle as any)[k]);
      return changed ? { ...prev, ...battleRealtime.battle } : prev;
    });
    if (battleRealtime.battle.status === 'ended') {
      setShowResults(true);
    }
  }, [battleRealtime.battle]);

  // If we previously set an immediate 'Battle not found' error, clear it when realtime data appears
  useEffect(() => {
    if (error === 'Battle not found' && (battleRealtime as any)?.battle) {
      console.log('[BattleView] Clearing "Battle not found" error due to realtime data', battleId);
      clearDeferredError();
      setError(null);
      setBattle((battleRealtime as any).battle);
    }
  }, [error, battleRealtime?.battle, battleId]);

  useEffect(() => {
    if (battleRealtime.participants.length > 0) {
      setParticipantSnapshots(battleRealtime.participants);
    }
  }, [battleRealtime.participants]);

  useEffect(() => {
    if (battleRealtime.arenaReady && !arenaReady) {
      setArenaReady(true);
      setArenaReadyAtMs(Date.now());
    }
  }, [battleRealtime.arenaReady]);

  // Arena readiness check
  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;

    const expectedHosts = participantSnapshots.filter((p) => p.role === 'host').map((p) => p.user_id);
    const expectedStages = participantSnapshots.filter((p) => p.role === 'stage').map((p) => p.user_id);

    const loaded = new Set<string>();
    // Current user is considered loaded if they're connected (don't need tracks for mobile)
    if (effectiveUserId) {
      loaded.add(String(effectiveUserId));
    }

    const findUserIdForIdentity = (identity: string): string | null => {
      if (!identity) return null;
      const direct = participantSnapshots.find((p) => p.user_id === identity);
      if (direct) return direct.user_id;
      if (userIdToLiveKitIdentity) {
        for (const [userId, mappedIdentity] of Object.entries(userIdToLiveKitIdentity)) {
          if (mappedIdentity === identity) return userId;
        }
      }
      return null;
    };

    for (const remoteUser of remoteUsers) {
      // Check if user has identity and is connected
      if (!remoteUser.identity) continue;

      const resolvedUserId = findUserIdForIdentity(remoteUser.identity);
      const snapshot = resolvedUserId
        ? participantSnapshots.find((p) => p.user_id === resolvedUserId)
        : null;

      // During connect churn, require host connection but do not hard-block on
      // media publication timing to avoid endless "SYNCING" for one side.
      if (snapshot?.role === 'host') {
        const videoPubs = getTrackPublications(remoteUser, 'video');
        const audioPubs = getTrackPublications(remoteUser, 'audio');
        const hasAnyPublication = Boolean(videoPubs.length || audioPubs.length);
        if (!hasAnyPublication && import.meta.env.DEV) {
          console.log('[BattleView] Host connected without media publications yet:', remoteUser.identity);
        }
      }

      loaded.add(String(resolvedUserId || remoteUser.identity));
    }

    const hostsReady = expectedHosts.length >= 2 && expectedHosts.every((id) => loaded.has(String(id)));
    const stagesReady = expectedStages.every((id) => loaded.has(String(id)));

    if (hostsReady && stagesReady) {
      const nowMs = Date.now();
      setArenaReadyAtMs(nowMs);
      setArenaReady(true);

      if (participantInfo?.role === 'host' && !publishedArenaReadyRef.current) {
        publishedArenaReadyRef.current = true;
        const publishChannel = supabase.channel(`battle_arena:${battleId}`);
        publishChannel.subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return;
          await publishChannel.send({
            type: 'broadcast',
            event: 'arena_ready',
            payload: { ready_at_ms: nowMs },
          });
          setTimeout(() => {
            supabase.removeChannel(publishChannel);
          }, 500);
        });
      }
    }
  }, [
    battle, arenaReady, participantSnapshots, remoteUsers, effectiveUserId,
    participantInfo?.role, battleId, userIdToLiveKitIdentity,
  ]);

  // Fallback arena ready
  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;
    const timeout = setTimeout(() => {
      if (arenaReady) return;
      setArenaReadyAtMs(Date.now());
      setArenaReady(true);
    }, 4500);
    return () => clearTimeout(timeout);
  }, [battle, arenaReady]);

  // If battle is active and has a server start time, force timer readiness.
  // Prevents one client from being stuck on SYNCING during reconnect churn.
  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;
    if (!battle.started_at) return;
    setArenaReadyAtMs((prev) => prev ?? new Date(battle.started_at).getTime());
    setArenaReady(true);
  }, [battle?.status, battle?.started_at, arenaReady]);


  // Stream updates â€” kept as minimal postgres_changes on streams table
  // (these are per-stream, not per-battle, and are needed for box_count/seat changes)
  // Detect stream end during battle: opposite side wins, forfeiting user goes home
  useEffect(() => {
    if (!challengerStream?.id && !opponentStream?.id) return;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const streamEndedHandledRef = { challenger: false, opponent: false };

    const handleStreamEnded = async (endedStreamId: string, endedStreamUserId: string, userTeam: 'challenger' | 'opponent') => {
      if (battle?.status !== 'active' || streamEndedHandledRef[userTeam]) return;
      streamEndedHandledRef[userTeam] = true;

      const winnerStreamId = userTeam === 'challenger' ? opponentStream?.id : challengerStream?.id;
      if (!winnerStreamId) return;

      // Award crown to winner
      try {
        await supabase.rpc('end_battle_with_rewards', {
          p_battle_id: battleId,
          p_winner_stream_id: winnerStreamId,
        });
      } catch (e) {
        // Battle may already have been ended by forfeit_random_battle on the loser side.
        // That's OK — the broadcast below is what matters for routing users away from
        // the ended stream, so we intentionally continue instead of blocking here.
        if (import.meta.env.DEV) {
          console.warn('[BattleView] end_battle_with_rewards failed (likely already ended by forfeit):', e);
        }
      }

      const returnChannel = supabase.channel(`battle:${battleId}`);
      await returnChannel.send({
        type: 'broadcast',
        event: 'return_to_broadcast',
        payload: {
          challengerStreamId: challengerStream?.id,
          opponentStreamId: opponentStream?.id,
          challengerHostId: challengerStream?.user_id,
          opponentHostId: opponentStream?.user_id,
          streamEnded: true,
          winnerStreamId,
        },
      });
      setTimeout(() => supabase.removeChannel(returnChannel), 2000);

      // Navigate forfeiting user to home
      if (userTeam === 'challenger' && participantInfo?.team === 'challenger') {
        navigate('/');
      } else if (userTeam === 'opponent' && participantInfo?.team === 'opponent') {
        navigate('/');
      }
    };

    if (challengerStream?.id) {
      const c = supabase.channel(`battle_stream_${challengerStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${challengerStream.id}` },
          (payload) => {
            const newStream = payload.new as Stream;
            setChallengerStream((prev) => prev ? { ...prev, ...newStream } : newStream);
            // Check if challenger stream ended during battle
            if (newStream.status !== 'live' && prevStreamLiveRef.current.challenger && battle?.status === 'active') {
              handleStreamEnded(challengerStream.id, challengerStream.user_id, 'challenger');
            }
            if (newStream.status === 'live') {
              prevStreamLiveRef.current.challenger = true;
            } else {
              prevStreamLiveRef.current.challenger = false;
            }
          }
        )
        .on('broadcast', { event: 'box_count_changed' }, (payload) => {
          const boxData = payload.payload;
          if (boxData && boxData.box_count !== undefined) {
            setChallengerStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
          }
        })
        .subscribe();
      channels.push(c);
    }

    if (opponentStream?.id) {
      const c = supabase.channel(`battle_stream_${opponentStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${opponentStream.id}` },
          (payload) => {
            const newStream = payload.new as Stream;
            setOpponentStream((prev) => prev ? { ...prev, ...newStream } : newStream);
            // Check if opponent stream ended during battle
            if (newStream.status !== 'live' && prevStreamLiveRef.current.opponent && battle?.status === 'active') {
              handleStreamEnded(opponentStream.id, opponentStream.user_id, 'opponent');
            }
            if (newStream.status === 'live') {
              prevStreamLiveRef.current.opponent = true;
            } else {
              prevStreamLiveRef.current.opponent = false;
            }
          }
        )
        .on('broadcast', { event: 'box_count_changed' }, (payload) => {
          const boxData = payload.payload;
          if (boxData && boxData.box_count !== undefined) {
            setOpponentStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
          }
        })
        .subscribe();
      channels.push(c);
    }

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [challengerStream?.id, opponentStream?.id, battle?.status, battleId]);

  // Fallback poll â€” 15s during active battle, 30s otherwise.
  // Score updates are handled in realtime via useBattleRealtime broadcasts,
  // so this is only a safety net. Keep it infrequent to avoid overwriting
  // optimistic/realtime score updates with stale DB data.
  useEffect(() => {
    if (!battleId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('battles')
          .select('id, score_challenger, score_opponent, status, started_at, ends_at, winner_id, sudden_death')
          .eq('id', battleId)
          .maybeSingle();
        if (data) {
          setBattle((prev: any) => {
            if (!prev) return data;
            if (
              prev.score_challenger !== data.score_challenger ||
              prev.score_opponent !== data.score_opponent ||
              prev.status !== data.status ||
              prev.started_at !== data.started_at ||
              prev.ends_at !== data.ends_at
            ) {
              return { ...prev, ...data };
            }
            return prev;
          });
        }
      } catch {}
    }, battle?.status === 'active' ? 15000 : 30000);
    return () => clearInterval(interval);
  }, [battleId, battle?.status]);

  // Listen for optimistic score updates from the local gift sender.
  // This makes the score bar and jail bars update instantly for the
  // user who sent the gift, without waiting for any poll or broadcast.
  useEffect(() => {
    if (!battleId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.battleId !== battleId) return;
      setBattle((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          score_challenger: detail.score_challenger ?? prev.score_challenger,
          score_opponent: detail.score_opponent ?? prev.score_opponent,
        };
      });
    };
    window.addEventListener('battle-score-optimistic', handler);
    return () => window.removeEventListener('battle-score-optimistic', handler);
  }, [battleId]);

  // Aggregate REAL gift coin value credited to each participant from realtime
  // gift_sent events. This is the authoritative per-recipient battle-point
  // contribution shown on mobile participant boxes. Crowns are never used.
  // The team total is still driven by the backend score_challenger/score_opponent.
  useEffect(() => {
    if (!battleId) return;
    const channel = supabase
      .channel(`battle-gift-agg:${battleId}`)
      .on('broadcast', { event: 'gift_sent' }, (payload: any) => {
        const d = payload?.payload?.d || payload?.payload || {};
        const receiverId = d.receiver_id || d.recipient_id;
        const amount =
          typeof d.amount === 'number'
            ? d.amount
            : typeof d.coin_value === 'number'
            ? d.coin_value
            : typeof d.quantity === 'number'
            ? d.quantity
            : 0;
        if (!receiverId || !amount) return;
        setParticipantContributions((prev) => ({
          ...prev,
          [receiverId]: (prev[receiverId] || 0) + amount,
        }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId]);


  // Timer Logic - 3 minutes with 10 second sudden death
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [showRematchOption, setShowRematchOption] = useState(false);

  const handleRematch = useCallback(async () => {
    if (!battle || !user) return;
    
    try {
      const myStreamId = participantInfo?.team === 'opponent' ? opponentStream?.id : challengerStream?.id;
      const { data, error: updateError } = await supabase.rpc('request_random_battle_rematch', {
        p_battle_id: battle.id,
        p_stream_id: myStreamId,
        p_broadcaster_id: user.id,
      });
      
      if (updateError) throw updateError;
      if (!data?.success) throw new Error(data?.message || 'Failed to start rematch');
      
      setTimeLeft(180);
      setIsSuddenDeath(false);
      setHasEnded(false);
      setShowRematchOption(false);
      setArenaReady(true);
      setArenaReadyAtMs(Date.now());
      
      toast.success('Rematch countdown started!');
    } catch (e) {
      console.error('Rematch error:', e);
      toast.error('Failed to start rematch');
    }
  }, [battle, challengerStream?.id, opponentStream?.id, participantInfo?.team, user]);

  const endBattle = useCallback(async (skipConfirmation = false) => {
    if (!battle || !user) return;
    
    if (!skipConfirmation && !confirm("Are you sure you want to end this battle?")) {
      return;
    }

    try {
      const isRandomQueueBattle = challengerStream?.battle_mode === 'random_queue' || opponentStream?.battle_mode === 'random_queue';
      const { data: endResult, error: endError } = isRandomQueueBattle
        ? await supabase.rpc('finish_random_battle', {
            p_battle_id: battle.id,
            p_end_reason: 'timer_expired',
          })
        : await supabase.rpc('end_battle_guarded', {
            p_battle_id: battle.id,
          });

      if (endError || !endResult?.success) {
        console.warn('[BattleView] end RPC failed, force-ending battle:', endResult?.message || endError?.message);
        
        await supabase
          .from('battles')
          .update({ 
            status: 'ended',
            ended_at: new Date().toISOString(),
            winner_stream_id: endResult?.winner_stream_id,
            winner_id: endResult?.winner_id
          })
          .eq('id', battle.id);
        
        await supabase
          .from('streams')
          .update({
            is_battle: false,
            battle_id: null,
            battle_mode: 'manual',
            battle_status: 'waiting',
          })
          .eq('battle_id', battle.id);
        
        setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
        setShowResults(true);
        
        if (endResult?.winner_id === user?.id) {
          await recordBattleWon(battle.id, currentStreamId);
        } else if (endResult?.winner_id !== null) {
          await recordBattleLost(battle.id, currentStreamId);
        }
        
        try {
          await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        } catch (payoutErr) {
          console.warn('[BattleView] Payout failed after force-end:', payoutErr);
        }
        
        toast.success('Battle Ended!');
        return;
      }

      if (endResult?.winner_id === user?.id) {
        await recordBattleWon(battle.id, currentStreamId);
      } else if (endResult?.winner_id !== null) {
        await recordBattleLost(battle.id, currentStreamId);
      }

      const { error: payoutError } = await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
      if (payoutError) toast.error("Battle ended but payout failed.");
      else toast.success(`Battle Ended! Winnings distributed.`);
    } catch (e) {
      console.error('[BattleView] endBattle error:', e);
      try {
        await supabase
          .from('battles')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', battle.id);
        await supabase
          .from('streams')
          .update({
            is_battle: false,
            battle_id: null,
            battle_mode: 'manual',
            battle_status: 'waiting',
          })
          .eq('battle_id', battle.id);
        setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
        setShowResults(true);
        toast.success('Battle Ended!');
      } catch (fallbackErr) {
        console.error('[BattleView] Force-end fallback failed:', fallbackErr);
      }
    }
  }, [battle, user, challengerStream, opponentStream, recordBattleWon, recordBattleLost, currentStreamId]);

  const [leaveLoading, setLeaveLoading] = useState(false);

  const handleLeaveBattle = useCallback(async () => {
    if (!battle || !user) return;

    if (!confirm('Leave this battle and forfeit?')) {
      return;
    }

    setLeaveLoading(true);
    try {
      setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
      setShowResults(true);

      const { data: leaveResult, error: leaveError } = await supabase.rpc('leave_battle', {
        p_battle_id: battle.id,
        p_user_id: user.id
      });

      if (leaveError || leaveResult?.success === false) {
        toast.error(leaveResult?.message || leaveError?.message || 'Failed to leave battle');
      } else {
        // CRITICAL: Only clear battle state from the forfeiting user's stream
        // The other broadcaster should remain in their broadcast
        // Use server-returned forfeiting_stream_id, or fallback to participant info
        let forfeitingStreamId = leaveResult?.forfeiting_stream_id;
        if (!forfeitingStreamId) {
          // Determine forfeiting stream from participant info
          const isChallengerTeam = participantInfo?.team === 'challenger';
          forfeitingStreamId = isChallengerTeam ? challengerStream?.id : opponentStream?.id;
        }
        try {
          if (forfeitingStreamId) {
            await supabase.from('streams').update({
              is_battle: false,
              battle_id: null
            }).eq('id', forfeitingStreamId);
            console.log('[BattleView] Cleared battle state from forfeiting stream:', forfeitingStreamId);
          }
        } catch (streamUpdateErr) {
          console.warn('[BattleView] Failed to update stream battle state:', streamUpdateErr);
        }
        
        // Award crowns to the winner (the other broadcaster)
        const winnerStreamId = leaveResult?.winner_stream_id;
        if (winnerStreamId) {
          try {
            const { data: rewardResult } = await supabase.rpc('end_battle_with_rewards', {
              p_battle_id: battle.id,
              p_winner_stream_id: winnerStreamId
            });
            
            if (rewardResult?.success && rewardResult?.crowns_awarded > 0) {
              toast.success(`Winner awarded ${rewardResult.crowns_awarded} crown(s)!`);
            }
          } catch (rewardErr) {
            console.warn('Crown award failed:', rewardErr);
          }
        }
        
        // Distribute winnings
        try {
          await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        } catch (payoutErr) {
          console.warn('Payout failed:', payoutErr);
        }
        
        // Update battle state with winner
        setBattle((prev: any) => {
          if (!prev) return prev;
          return { 
            ...prev, 
            status: 'ended', 
            winner_id: winnerStreamId,
            winner_stream_id: winnerStreamId
          };
        });
        
        // Show appropriate message based on who forfeited
        const isChallenger = participantInfo?.team === 'challenger';
        toast.success(isChallenger ? 'You forfeited. Opponent wins!' : 'You forfeited. Challenger wins!');
      }
      
      // FIX: Forfeiting broadcaster should return to their own stream, not the winner's stream
      // Navigate back to the forfeiting broadcaster's own stream so they can continue their broadcast
      // Use /stream/{streamId} route (not /live which redirects to /live)
      if (participantInfo?.team === 'challenger' && challengerStream?.id) {
        navigate(`/stream/${challengerStream.id}`);
      } else if (participantInfo?.team === 'opponent' && opponentStream?.id) {
        navigate(`/stream/${opponentStream.id}`);
      } else if (currentStreamId) {
        // Fallback to original stream
        navigate(`/stream/${currentStreamId}`);
      } else if (onReturnToStream) {
        // Fallback to callback if provided
        onReturnToStream();
      } else {
        // Last resort - navigate to home
        navigate('/');
      }
      
      // Do NOT stop local tracks - they belong to the broadcaster's main stream
      // The tracks should continue working when they return to their stream
      // But DO disconnect the battle room and unpublish battle tracks before navigating
      if (battleRoomRef.current && battleRoomRef.current.state === 'connected') {
        try {
          const localParticipant = battleRoomRef.current.localParticipant;
          const tracks = Array.from(localParticipant.trackPublications.values());
          for (const pub of tracks) {
            try {
              if (pub.track) await localParticipant.unpublishTrack(pub.track);
            } catch (e) {
              // ignore unpublish errors during cleanup
            }
          }
          battleRoomRef.current.disconnect();
        } catch (e) {
          console.warn('[BattleView] Cleanup disconnect error:', e);
        }
        battleRoomRef.current = null;
        connectedBattleIdRef.current = null;
        hasPublishedTracksRef.current = false;
      }
      
      // Just navigate back to the stream without stopping tracks
    } catch (e) {
      console.error(e);
      toast.error('Failed to leave battle');
      if (onReturnToStream) {
        onReturnToStream();
      } else {
        navigate('/');
      }
    } finally {
      setLeaveLoading(false);
    }
  }, [battle, user, battleLocalAudioTrack, battleLocalVideoTrack, livekitRoom, onReturnToStream, navigate, participantInfo?.team, challengerStream?.id, opponentStream?.id, currentStreamId]);

  // Timer refs to avoid restarting interval on score/role updates
  const hasEndedRef = useRef(false);
  const endBattleRef = useRef(endBattle);
  const participantRoleRef = useRef(participantInfo?.role);
  endBattleRef.current = endBattle;
  participantRoleRef.current = participantInfo?.role;

  // Timer effect - server-authoritative from started_at/ends_at only.
  // Score and role changes do NOT restart this timer.
  useEffect(() => {
    if (!battle?.started_at || battle.status !== 'active') {
      if (battle?.status === 'ended') setHasEnded(true);
      return;
    }

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const endMs = battle.ends_at
        ? new Date(battle.ends_at).getTime()
        : new Date(battle.started_at).getTime() + 180_000;
      const newTimeLeft = Math.max(0, Math.ceil((endMs - nowMs) / 1000));
      const sudden = newTimeLeft > 0 && newTimeLeft <= 15;

      if (newTimeLeft > 0) {
        setTimeLeft(newTimeLeft);
        setIsSuddenDeath(sudden);
      } else {
        setTimeLeft(0);
        setIsSuddenDeath(true);

        if (!hasEndedRef.current) {
          hasEndedRef.current = true;
          setHasEnded(true);
          if (participantRoleRef.current === 'host') {
            setShowRematchOption(true);
          }
          endBattleRef.current(true);
        }
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [battle?.ends_at, battle?.started_at, battle?.status]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Handle troll opponent
  const handleTrollOpponent = async (targetStreamId: string) => {
    if (!battle || !user) return;

    try {
      const { data, error } = await supabase.rpc('troll_opponent', {
        p_battle_id: battle.id,
        p_troller_id: user.id,
        p_target_stream_id: targetStreamId
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data?.success) {
        toast.success(`Trolled opponent! Deducted ${data.deduction} coins`);
      } else {
        toast.error(data?.message || 'Troll failed');
      }
    } catch (e) {
      console.error('Troll error:', e);
      toast.error('Failed to troll opponent');
    }
  };

  const navigateBackToOwnBroadcast = useCallback(() => {
    const isChallengerHost = effectiveUserId && challengerStream?.user_id && effectiveUserId === challengerStream.user_id;
    const isOpponentHost = effectiveUserId && opponentStream?.user_id && effectiveUserId === opponentStream.user_id;

    if ((participantInfo?.team === 'challenger' || isChallengerHost) && challengerStream?.id) {
      navigate(`/stream/${challengerStream.id}`);
      return;
    }
    if ((participantInfo?.team === 'opponent' || isOpponentHost) && opponentStream?.id) {
      navigate(`/stream/${opponentStream.id}`);
      return;
    }
    if (currentStreamId) {
      navigate(`/stream/${currentStreamId}`);
      return;
    }
    if (onReturnToStream) {
      onReturnToStream();
      return;
    }
    navigate('/');
  }, [
    effectiveUserId,
    participantInfo?.team,
    challengerStream?.id,
    challengerStream?.user_id,
    opponentStream?.id,
    opponentStream?.user_id,
    currentStreamId,
    onReturnToStream,
    navigate,
  ]);

  // History-aware Back button: return to previous page when history is usable,
  // otherwise fall back to the broadcasts / city-center route. Does NOT trigger
  // battle cleanup early â€” cleanup runs on unmount via the existing effects.
  const handleBack = useCallback(() => {
    try {
      const state = window.history.state as { idx?: number } | null;
      if (window.history.length > 1 && state && typeof state.idx === 'number' && state.idx > 0) {
        navigate(-1);
        return;
      }
    } catch {
      /* fall through to default */
    }
    navigate('/broadcasts');
  }, [navigate]);

  // Navigate into another live battle (safe switch: BattleView remounts via key,
  // running full LiveKit / presence / subscription cleanup for the old battle).
  const handleSelectBattle = useCallback(
    (b: ActiveBattle) => {
      if (!b.challenger_stream_id) return;
      navigate(`/watch/${b.challenger_stream_id}`);
    },
    [navigate]
  );

  const handleNextBattle = useCallback(
    (dir: 1 | -1 = 1) => {
      if (activeBattles.length === 0) return;
      const idx = activeBattles.findIndex((b) => b.id === battleId);
      const nextIdx = idx === -1 ? 0 : (idx + dir + activeBattles.length) % activeBattles.length;
      const next = activeBattles[nextIdx];
      if (next && next.id !== battleId && next.challenger_stream_id) {
        navigate(`/watch/${next.challenger_stream_id}`);
      }
    },
    [activeBattles, battleId, navigate]
  );

  // Return to stream handler - returns each broadcaster to their own stream
  // Also broadcasts to all participants to return to their respective broadcasts
  const handleReturnToStream = useCallback(async () => {
    if (hasHandledReturnRef.current) return;
    hasHandledReturnRef.current = true;
    setShowResults(false);
    setShowRematchOption(false);

    // Only disconnect the battle LiveKit room and unpublish tracks
    // Do NOT stop/close local tracks - they belong to the broadcaster's main stream
    // and are shared with BroadcastPage. Closing them here would kill the camera.
    if (livekitRoom) {
      try {
        const localParticipant = livekitRoom.localParticipant;
        const tracks = Array.from(localParticipant.trackPublications.values());
        for (const pub of tracks) {
          try {
            if (pub.track) await localParticipant.unpublishTrack(pub.track);
          } catch (e) {
            // ignore unpublish errors during cleanup
          }
        }
        livekitRoom.disconnect();
      } catch (e) {
        console.warn('[BattleView] Cleanup disconnect error:', e);
      }
    }
    
    // Broadcast to all participants to return to their broadcasts
    try {
      const returnChannel = supabase.channel(`battle:${battleId}`);
      await returnChannel.send({
        type: 'broadcast',
        event: 'return_to_broadcast',
        payload: {
          challengerStreamId: challengerStream?.id,
          opponentStreamId: opponentStream?.id,
          challengerHostId: challengerStream?.user_id,
          opponentHostId: opponentStream?.user_id
        }
      });
      // Clean up channel after sending
      setTimeout(() => supabase.removeChannel(returnChannel), 2000);
    } catch (e) {
      console.warn('[BattleView] Failed to broadcast return event:', e);
    }

    navigateBackToOwnBroadcast();
    onReturnToStream?.();
  }, [battleLocalAudioTrack, battleLocalVideoTrack, livekitRoom, battleId, challengerStream?.id, challengerStream?.user_id, opponentStream?.id, opponentStream?.user_id, navigateBackToOwnBroadcast, onReturnToStream]);

  // React to battle-level "return_to_broadcast" broadcast from either broadcaster.
  // When streamEnded is true, the user on the ended stream goes home, winner goes to broadcast
  useEffect(() => {
    if (!battleId) return;
    const ch = supabase
      .channel(`battle:${battleId}`)
      .on('broadcast', { event: 'return_to_broadcast' }, (payload) => {
        if (hasHandledReturnRef.current) return;
        hasHandledReturnRef.current = true;
        setShowResults(false);
        setShowRematchOption(false);
        
        const data = payload.payload;
        const winnerStreamId = data?.winnerStreamId;
        
        if (data?.streamEnded) {
          // Stream ended during battle - route based on who was affected
          const currentUserOnChallenger = participantInfo?.team === 'challenger';
          const currentUserOnOpponent = participantInfo?.team === 'opponent';
          
          // If user was on the ended stream, go to home
          if ((currentUserOnChallenger && winnerStreamId === opponentStream?.id) ||
              (currentUserOnOpponent && winnerStreamId === challengerStream?.id)) {
            navigate('/');
            onReturnToStream?.();
            return;
          }
          // Winner or viewer stays - return to broadcast
          navigateBackToOwnBroadcast();
          onReturnToStream?.();
        } else {
          // Normal return
          navigateBackToOwnBroadcast();
          onReturnToStream?.();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [battleId, navigateBackToOwnBroadcast, onReturnToStream, participantInfo?.team, opponentStream?.id, challengerStream?.id, navigate]);

  // Guarantee end screen appears whenever server battle row is ended.
  useEffect(() => {
    if (battle?.status === 'ended') {
      setShowResults(true);
    }
  }, [battle?.status]);

  // Auto-return after battle ends - only for viewers, not for broadcasters who should stay
  // Don't auto-return when someone forfeited - show winner first and let them click return
  useEffect(() => {
    if (showResults && battle?.status === 'ended') {
      // Check if user is a broadcaster (host or stage) - they should NOT auto-return
      const isBroadcasterUser = participantInfo?.role === 'host' || participantInfo?.role === 'stage';
      
      // Don't auto-return for broadcasters - they need to manually return to stay in their broadcast
      if (isBroadcasterUser) {
        return;
      }
      
      // For viewers, auto-return after delay but only to the original stream
      // Use /stream/{streamId} route (not /live which redirects to /live)
      const timer = setTimeout(() => {
        // Return to original stream if available
        if (currentStreamId) {
          navigate(`/stream/${currentStreamId}`);
        } else if (onReturnToStream) {
          onReturnToStream();
        } else {
          navigate('/');
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showResults, battle?.status, navigate, currentStreamId, onReturnToStream, participantInfo?.role]);

  // Use the userIdToLiveKitIdentity mapping from BroadcastPage to find video tracks
  // The mapping converts database user IDs to LiveKit identities
  const challengerLiveKitIdentity = challengerStream
    ? userIdToLiveKitIdentity?.[challengerStream.user_id] || challengerStream.user_id
    : undefined;
  const opponentLiveKitIdentity = opponentStream
    ? userIdToLiveKitIdentity?.[opponentStream.user_id] || opponentStream.user_id
    : undefined;

  // DEBUG: User lookup logging (throttled, in useEffect to avoid render body side effects)
  const lastUserLookupLogRef = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastUserLookupLogRef.current < 2000) return;
    lastUserLookupLogRef.current = now;
    console.log('[BattleView] User lookup - challenger stream:', challengerStream?.user_id?.substring(0, 8), '-> livekit identity:', challengerLiveKitIdentity);
    console.log('[BattleView] User lookup - opponent stream:', opponentStream?.user_id?.substring(0, 8), '-> livekit identity:', opponentLiveKitIdentity);
    console.log('[BattleView] Battle remoteUsers count:', remoteUsers?.length || 0);
    console.log('[BattleView] Local videoTrack:', !!battleLocalVideoTrack);
  }, [challengerLiveKitIdentity, opponentLiveKitIdentity, remoteUsers.length, battleLocalVideoTrack]);

  // Diagnostic logging: room participants and their video track SIDs
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (remoteUsers.length === 0) return;
    const trackMap: Record<string, string[]> = {};
    for (const u of remoteUsers) {
      const videoPubs = getTrackPublications(u, 'video');
      const sids = videoPubs.filter((p: any) => p.track).map((p: any) => p.track.sid || p.trackSid);
      trackMap[u.identity] = sids;
    }
    console.log('[BattleView] Room participant video track SIDs:', trackMap);
  }, [remoteUsers, battleTick, trackRevision]);

  const findRemoteByIdentity = (targetIdentity: string, expectedUserId?: string) => {
    if (!targetIdentity || !remoteUsers) return null;
    
    const normalizedTarget = String(targetIdentity).replace(/-/g, '').toLowerCase();
    
    return remoteUsers.find((u) => {
      const id = String(u.identity || '');
      const normalized = id.replace(/-/g, '').toLowerCase();
      
      // Strict identity match
      if (id === targetIdentity || normalized === normalizedTarget) {
        if (expectedUserId && u.metadata) {
          try {
            const metadata = typeof u.metadata === 'string' ? JSON.parse(u.metadata) : u.metadata;
            const metadataUserId = metadata.user_id || metadata.userId;
            if (metadataUserId && metadataUserId !== expectedUserId) {
              return false;
            }
          } catch {
            // ignore metadata parse errors
          }
        }
        return true;
      }
      
      // Match by metadata user_id if identity doesn't match
      if (expectedUserId && u.metadata) {
        try {
          const metadata = typeof u.metadata === 'string' ? JSON.parse(u.metadata) : u.metadata;
          const metadataUserId = metadata.user_id || metadata.userId;
          if (metadataUserId === expectedUserId) {
            return true;
          }
        } catch {
          // ignore
        }
      }
      
      return false;
    });
  };

  const resolveBoxUser = (streamUser: string | null | undefined, liveKitIdentity: string | undefined, isLocalBroadcaster: boolean) => {
    if (isLocalBroadcaster) {
      return { videoTrack: battleLocalVideoTrack, audioTrack: battleLocalAudioTrack, isLocal: true };
    }
    if (!streamUser || !liveKitIdentity) return null;
    return findRemoteByIdentity(liveKitIdentity, streamUser);
  };

  const isChallengerBroadcaster = challengerStream ? effectiveUserId === challengerStream.user_id : false;
  const isOpponentBroadcaster = opponentStream ? effectiveUserId === opponentStream.user_id : false;

  // Guard against both sides resolving to the LOCAL track. This happens when the
  // two battle streams belong to the same account (e.g. same-account testing, or
  // a self-match) — then effectiveUserId equals BOTH host ids and every box
  // would show the local camera. We only ever treat ONE side as local: the side
  // whose host id matches, preferring challenger when both match.
  const sameHostBothSides =
    !!challengerStream?.user_id &&
    challengerStream?.user_id === opponentStream?.user_id;
  const localIsChallenger = isChallengerBroadcaster;
  const localIsOpponent = isOpponentBroadcaster && !(sameHostBothSides && localIsChallenger);

  const challengerUser = resolveBoxUser(challengerStream?.user_id, challengerLiveKitIdentity, localIsChallenger);
  let opponentUser = resolveBoxUser(opponentStream?.user_id, opponentLiveKitIdentity, localIsOpponent);

  // Final safety net: never render the SAME participant/track in both boxes.
  // If the opponent resolved to the same identity as the challenger (identity
  // mapping churn, echoed local track, etc.), drop it so the box shows a
  // "waiting for opponent" state instead of duplicating the challenger.
  const challengerResolvedId =
    (challengerUser as any)?.identity ||
    (challengerUser && (challengerUser as any).isLocal ? `local:${effectiveUserId}` : null);
  const opponentResolvedId =
    (opponentUser as any)?.identity ||
    (opponentUser && (opponentUser as any).isLocal ? `local:${effectiveUserId}` : null);
  if (challengerResolvedId && opponentResolvedId && challengerResolvedId === opponentResolvedId) {
    console.warn('[BattleView] Prevented duplicate participant in both battle boxes:', challengerResolvedId);
    opponentUser = null;
  }

  if (import.meta.env.DEV) {
    const challengerIdentity = (challengerUser as any)?.identity;
    const opponentIdentity = (opponentUser as any)?.identity;
    if (challengerIdentity && opponentIdentity && challengerIdentity === opponentIdentity) {
      console.warn('[BattleView] ⚠️ SAME participant resolved for BOTH boxes:', challengerIdentity);
    }
    console.log('[BattleView] Box resolution:', {
      battleId,
      challengerStreamUserId: challengerStream?.user_id?.substring(0, 8),
      opponentStreamUserId: opponentStream?.user_id?.substring(0, 8),
      challengerLiveKitIdentity,
      opponentLiveKitIdentity,
      challengerResolved: challengerUser ? (challengerUser as any).identity || 'local' : 'null',
      opponentResolved: opponentUser ? (opponentUser as any).identity || 'local' : 'null',
      remoteCount: remoteUsers?.length || 0,
      battleTick,
    });
  }

  // Desktop keyboard navigation to the next/previous live battle.
  // Switching battles navigates to the other battle's stream, which remounts
  // BattleView (keyed by battleId) â€” the existing unmount effects tear down the
  // LiveKit room, audience presence, and all realtime subscriptions safely.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextBattle(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNextBattle(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextBattle]);

  // ── Derived scoring (POINTS, not crowns) ──────────────────────────────
  // Authoritative team point totals come from the backend battle row
  // (score_challenger / score_opponent). Crowns are a separate, non-winning
  // reward and must NEVER be used to decide the winner.
  const bluePoints = battle?.score_challenger || 0;
  const redPoints = battle?.score_opponent || 0;

  const blueTeam = useMemo(
    () => battleParticipants.filter((p: any) => p.team === 'challenger'),
    [battleParticipants]
  );
  const redTeam = useMemo(
    () => battleParticipants.filter((p: any) => p.team === 'opponent'),
    [battleParticipants]
  );

  const goBackToBroadcast = navigateBackToOwnBroadcast;
  const switchBattle = handleSelectBattle;
  const openGiftPicker = handleGiftSelect;
  const selectedGiftRecipient = giftRecipientId
    ? { id: giftRecipientId, streamId: giftStreamId || currentStreamId }
    : null;
  const setSelectedGiftRecipient = (r: { id: string; streamId: string } | null) => {
    setGiftRecipientId(r?.id ?? null);
    setGiftStreamId(r?.streamId ?? null);
    setShowMobileGiftTray(!!r);
  };

  const shareBroadcast = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = `${challengerStream?.title || 'Blue'} vs ${opponentStream?.title || 'Red'} Battle`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success('Battle link copied'))
        .catch(() => {});
    }
  }, [challengerStream?.title, opponentStream?.title]);

  const followBroadcaster = useCallback(async () => {
    const targetId = challengerStream?.user_id;
    if (!targetId) return;
    if (!user) {
      toast.info('Sign in to follow this streamer');
      navigate('/auth');
      return;
    }
    if (targetId === user.id) {
      toast.info("You can't follow yourself");
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('user_follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', targetId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetId);
        if (!error) toast.success(`Unfollowed ${challengerStream?.title || 'streamer'}`);
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: targetId });
        if (!error) toast.success(`Following ${challengerStream?.title || 'streamer'}`);
      }
    } catch {
      toast.error('Follow action failed');
    }
  }, [challengerStream?.user_id, challengerStream?.title, user, navigate]);

  // BattleChat manages its own input/send pipeline; exposed for interface parity.
  const sendMessage = useCallback(() => {}, []);

  return {
    // ── Shared battle controller contract ──
    battle,
    blueTeam,
    redTeam,
    bluePoints,
    redPoints,
    remainingTime: timeLeft,
    battleStatus: battle?.status,
    isSuddenDeath,
    messages: undefined,
    viewerCount: participantSnapshots?.length || 0,
    activeBattles,
    selectedGiftRecipient,
    setSelectedGiftRecipient,
    openGiftPicker,
    sendMessage,
    goBackToBroadcast,
    switchBattle,
    followBroadcaster,
    shareBroadcast,

    // ── Extra state/derived consumed by the layouts ──
    loading,
    error,
    showResults,
    showRematchOption,
    timeLeft,
    participantInfo,
    challengerStream,
    opponentStream,
    participantSnapshots,
    battleParticipants,
    participantContributions,
    battleLocalAudioTrack,
    battleLocalVideoTrack,
    isCameraEnabled,
    isMicEnabled,
    remoteUsers,
    trackRevision,
    challengerCrownInfo,
    opponentCrownInfo,
    connectionStatus,
    giftRecipientId,
    giftStreamId,
    currentStreamId,
    showMobileChat,
    setShowMobileChat,
    showMobileGiftTray,
    setShowMobileGiftTray,
    isMobileViewport,
    profile,
    userIdToLiveKitIdentity,
    effectiveUserId,
    isBroadcaster,
    isRandomBattle,
    resolvedBattleRole,
    challengerLiveKitIdentity,
    opponentLiveKitIdentity,
    touchStartRef,
    arenaReady,
    activeBattlesLoading,
    battleId,
    formatTime,

    // ── Actions ──
    handleGiftSelect,
    setGiftRecipientId,
    setGiftStreamId,
    setTeamBoxCount,
    handleTrollOpponent,
    handleBack,
    handleSelectBattle,
    handleNextBattle,
    handleReturnToStream,
    handleRematch,
    handleLeaveBattle,
    leaveLoading,
    navigateBackToOwnBroadcast,
    onReturnToStream,
    onToggleCamera,
    onToggleMic,
  };
}

export type BattleViewController = ReturnType<typeof useBattleViewController>;

