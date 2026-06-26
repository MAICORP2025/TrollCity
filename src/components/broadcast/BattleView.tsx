import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Room, LocalAudioTrack, LocalVideoTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, RoomEvent, Track } from 'livekit-client';

import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { Loader2, Coins, User, MicOff, VideoOff, Mic, Video, Plus, Minus, Crown, Flame, ArrowLeft, Skull, Gem, X } from 'lucide-react';
import { useCoins } from '../../lib/hooks/useCoins';
import useTrollFamilyActivity from '../../hooks/useTrollFamilyActivity';
import { useBattleRealtime } from '../../hooks/useBattleRealtime';
import { logActiveChannels } from '../../lib/realtimeChannelDiagnostics';
import { useIsMobile } from '../../hooks/useIsMobile';
import BattleChat from './BattleChat';
import MuteHandler from './MuteHandler';
import GiftTray from './GiftTray';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { BattleSounds } from '../../lib/battleSounds';
import { useJailTime } from '../../hooks/useJailTime';
import JailBarOverlay from './JailBarOverlay';

// --- Safe Helper Functions ---
function safeValues<T>(mapLike: Map<any, T> | undefined | null): T[] {
  if (!mapLike || typeof mapLike.values !== 'function') return [];
  try {
    return Array.from(mapLike.values());
  } catch (e) {
    console.warn('[BattleView] safeValues failed:', e);
    return [];
  }
}

function safeObjectValues<T>(obj: Record<string, T> | undefined | null): T[] {
  if (!obj || typeof obj !== 'object') return [];
  try {
    return Object.values(obj);
  } catch (e) {
    console.warn('[BattleView] safeObjectValues failed:', e);
    return [];
  }
}

// --- Logging Helpers ---
const logBroadcastLifecycle = (message: string, data?: any) => {
  console.log(`[BroadcastLifecycle] ${message}`, data || '');
};

const logRealtime = (message: string, data?: any) => {
  console.log(`[Realtime] ${message}`, data || '');
};

const logParticipants = (message: string, data?: any) => {
  console.log(`[Participants] ${message}`, data || '');
};

const logRTC = (message: string, data?: any) => {
  console.log(`[RTC] ${message}`, data || '');
};

// --- Sub-components for the new architecture ---

const LiveKitVideoPlayer = ({
  videoTrack,
  isLocal = false,
  onDimensionsReady,
}: {
  videoTrack?: LocalVideoTrack | RemoteVideoTrack;
  isLocal?: boolean;
  onDimensionsReady?: (width: number, height: number) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachedTrackIdRef = useRef<string | null>(null);
  const attachedElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) {
      console.log('[LiveKitVideoPlayer] Skipping - missing track or container');
      return;
    }

    // Check if this track is already attached (by comparing track IDs)
    const currentTrackId = videoTrack.sid || (videoTrack as any).id;
    if (attachedTrackIdRef.current === currentTrackId && videoRef.current) {
      console.log('[LiveKitVideoPlayer] Track already attached, skipping:', currentTrackId);
      return;
    }

    // Clean up any existing video element before attaching new one.
    // Remove stale detached video elements to avoid ghost overlays and click-blocking layers.
    const existingVideoElement = containerRef.current.querySelector('video');
    if (existingVideoElement) {
      console.log('[LiveKitVideoPlayer] Cleaning up existing video element');
      try {
        if (attachedElementRef.current) {
          videoTrack.detach(attachedElementRef.current);
        }
      } catch (e) {
        console.warn('[LiveKitVideoPlayer] Failed to detach existing video element:', e);
      }
      existingVideoElement.remove();
      videoRef.current = null;
      attachedElementRef.current = null;
      attachedTrackIdRef.current = null;
    }

    const handleLoaded = () => {
      if (!videoRef.current) return;
      
      // This is the ONLY moment the browser actually knows the real dimensions
      const width = videoRef.current.videoWidth;
      const height = videoRef.current.videoHeight;
      
      console.log('[LiveKitVideoPlayer] REAL dimensions from loadedmetadata:', width, height);
      
      // Report dimensions back to parent if callback provided
      if (onDimensionsReady && width > 0 && height > 0) {
        onDimensionsReady(width, height);
      }
    };

    const playWithRetry = (attempt = 0) => {
      if (!containerRef.current) return;
      if (attempt > 3) {
        console.error('[LiveKitVideoPlayer] Max retries reached - no frames flowing');
        return;
      }

      try {
        console.log('[LiveKitVideoPlayer] Calling attach() - attempt', attempt + 1);
        // LiveKit tracks use attach() instead of play()
        const videoElement = videoTrack.attach() as HTMLVideoElement;
        
        // Store ref to the attached video element for dimension tracking
        videoRef.current = videoElement;
        attachedElementRef.current = videoElement;
        
        // Store the track ID so we know this track is attached
        attachedTrackIdRef.current = currentTrackId;
        
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.style.display = 'block';
        videoElement.style.backgroundColor = 'black';
        // Mirror is applied on the container div, not the video element, to avoid double-mirroring on mobile
        // Critical: Add autoplay and playsInline for proper video display
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.controls = false;
        (videoElement as any).disablePictureInPicture = true;
        // Keep muted to satisfy mobile autoplay policies. Audio comes from separate tracks.
        videoElement.muted = true;
        
        // Add loadedmetadata listener for reliable dimensions
        videoElement.addEventListener('loadedmetadata', handleLoaded);
        
        containerRef.current.appendChild(videoElement);

        // Mirror front-camera video so remote viewers see natural orientation
        const mediaTrack = videoTrack?.mediaStreamTrack;
        const trackSettings = mediaTrack ? (mediaTrack.getSettings?.() || {}) : {};
        const isFrontCamera = (trackSettings as any).facingMode !== 'environment';
        if (containerRef.current) {
          containerRef.current.style.transform = isFrontCamera ? 'scaleX(-1)' : '';
        }

        console.log('[LiveKitVideoPlayer] attach() called successfully');

        // Inspect injected video after LiveKit has time to inject it
        // Also handle case where metadata is already loaded
        setTimeout(() => {
          const inner = containerRef.current?.querySelector('video') as HTMLVideoElement | null;
          console.log('[LiveKitVideoPlayer] Inner <video> inspection:', {
            exists: !!inner,
            width: inner?.videoWidth ?? 0,
            height: inner?.videoHeight ?? 0,
            readyState: inner?.readyState ?? -1,
            paused: inner?.paused ?? false,
            muted: inner?.muted ?? false,
            srcObjectPresent: !!inner?.srcObject,
          });

          // If already loaded, trigger the handler
          if (inner && inner.videoWidth > 0 && inner.readyState >= 1) {
            handleLoaded();
          } else if (inner && (inner.videoWidth === 0 || inner.readyState < 2)) {
            // If video element has no srcObject, try to play it
            if (inner && !inner.srcObject) {
              console.log('[LiveKitVideoPlayer] Video element has no srcObject, attempting play()');
              inner.play().catch(e => console.log('[LiveKitVideoPlayer] play() failed:', e));
            }
            // Retry with delay
            console.warn(`[LiveKitVideoPlayer] No frames yet (attempt ${attempt + 1}/3) - retrying in 500ms`);
            setTimeout(() => playWithRetry(attempt + 1), 500);
          }
        }, 600);

      } catch (err) {
        console.error('[LiveKitVideoPlayer] attach() threw error:', err);
        if (attempt < 3) {
          setTimeout(() => playWithRetry(attempt + 1), 500);
        }
      }
    };

    const initialTimer = setTimeout(playWithRetry, 100);

    // FIX #5: Cleanup - only detach video element, don't stop tracks
    // Stopping tracks will cause camera/mic to disappear
    return () => {
      clearTimeout(initialTimer);
      
      // Remove the loadedmetadata listener
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoaded);
      }
      
      // Detach the video element from container (but DON'T stop the track)
      if (containerRef.current) {
        const videoEl = containerRef.current.querySelector('video');
        if (videoEl) {
          try {
            videoTrack.detach(videoEl as HTMLVideoElement);
          } catch (e) {
            console.warn('[LiveKitVideoPlayer] Failed to detach cleanup video element:', e);
          }
          videoEl.remove();
          attachedTrackIdRef.current = null;
          attachedElementRef.current = null;
          videoRef.current = null;
        }
      }
      
      // DO NOT stop the track here - it's managed by the parent component
      // Stopping local tracks causes camera/mic to disappear in battle mode
    };
  }, [videoTrack]); // Only re-run when videoTrack reference changes

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-0 object-cover overflow-hidden"
      style={{
        minWidth: '100%',
        minHeight: '100%',
        // Keep battle orientation consistent for both sides/viewers.
        transform: undefined,
      }}
    />
  );
};

const BattleAudioTrackPlayer = ({
  audioTrack,
  label,
}: {
  audioTrack: LocalAudioTrack | RemoteAudioTrack;
  label: string;
}) => {
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    if (!audioTrack) return;

    let audioElement: HTMLAudioElement | null = null;
    let mounted = true;

    const tryPlay = (reason: string) => {
      if (!audioElement || !mounted) return;
      audioElement.play().then(() => {
        if (import.meta.env.DEV) {
          console.log('[BattleAudio] Audio element playing', { label, reason });
        }
        setAudioEnabled(true);
        setAudioBlocked(false);
      }).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[BattleAudio] Audio play blocked', { label, reason, err: String(err) });
        }
        setAudioBlocked(true);
        setAudioEnabled(false);
      });
    };

    const unlockAudio = () => {
      setAudioBlocked(false);
      tryPlay('user-interaction');
    };

    try {
      audioElement = audioTrack.attach() as HTMLAudioElement;
      audioElement.autoplay = true;
      audioElement.muted = false;
      audioElement.volume = 1;
      (audioElement as any).playsInline = true;
      audioElement.setAttribute('playsinline', 'true');
      audioElement.setAttribute('webkit-playsinline', 'true');
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      if (import.meta.env.DEV) {
        console.log('[BattleAudio] Remote audio attached', {
          label,
          trackSid: (audioTrack as any)?.sid,
          enabled: (audioTrack as any)?.enabled,
        });
      }

      tryPlay('initial');
      document.addEventListener('pointerdown', unlockAudio, { once: true });
      document.addEventListener('touchstart', unlockAudio, { once: true });
      document.addEventListener('keydown', unlockAudio, { once: true });
    } catch (err) {
      console.error('[BattleAudio] Failed to attach remote audio track:', label, err);
    }

    return () => {
      mounted = false;
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      if (audioElement) {
        try {
          audioTrack.detach(audioElement);
        } catch (err) {
          console.warn('[BattleAudio] Failed detaching remote audio element:', err);
        }
        try {
          audioElement.remove();
        } catch (_err) {}
      }
    };
  }, [audioTrack, label]);

  // Mobile audio unlock button
  if (audioBlocked) {
    return (
      <button
        onClick={() => {
          setAudioBlocked(false);
          // Trigger audio unlock
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }
        }}
        className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-4 py-2 rounded-full font-bold shadow-lg border border-purple-400/50 md:hidden"
      >
        🔊 Tap to enable battle audio
      </button>
    );
  }

  return null;
};

const BattleAudioRenderer = ({
  entries,
}: {
  entries: Array<{ key: string; label: string; audioTrack: LocalAudioTrack | RemoteAudioTrack }>;
}) => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[BattleAudio] Renderer entries updated', {
        count: entries.length,
        entries: entries.map((e) => ({ key: e.key, label: e.label, trackSid: (e.audioTrack as any)?.sid })),
      });
    }
  }, [entries]);

  return (
    <>
      {entries.map((entry) => (
        <BattleAudioTrackPlayer
          key={entry.key}
          audioTrack={entry.audioTrack}
          label={entry.label}
        />
      ))}
    </>
  );
};

interface BattleParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  videoTrack?: LocalVideoTrack | RemoteVideoTrack;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  metadata: any;
  role?: 'host' | 'stage' | 'viewer';
  team?: 'challenger' | 'opponent';
  sourceStreamId?: string;
  seatIndex?: number;
  profile?: any;
  trollCoins?: number;
  trollmonds?: number;
}

interface CrownInfo {
  crowns: number;
  streak: number;
  hasStreak: boolean;
}

const safeParseMetadata = (raw: unknown, context: string): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[BattleView] Failed to parse metadata for ${context}:`, raw, e);
      return {};
    }
  }
  return {};
};

const getTrackPublications = (
  participant: RemoteParticipant,
  kind: 'video' | 'audio'
): RemoteTrackPublication[] => {
  const sourceMaps = kind === 'video'
    ? [
        (participant as any).videoTrackPublications,
        (participant as any).videoTracks,
      ]
    : [
        (participant as any).audioTrackPublications,
        (participant as any).audioTracks,
      ];

  for (const mapLike of sourceMaps) {
    if (!mapLike?.values) continue;

    const entries = safeValues(mapLike) as any[];
    if (entries.length === 0) continue;

    const normalized = entries.map((entry) => {
      if (entry && typeof entry.track === 'undefined' && typeof entry.attach === 'function') {
        return {
          track: entry,
          isSubscribed: (entry as any).isSubscribed ?? true,
          kind: (entry as any).kind,
          source: (entry as any).source,
          // FIX 4: Support both sid and trackSid to handle undefined sid cases
          sid: (entry as any).sid ?? (entry as any).trackSid ?? '',
          trackSid: (entry as any).sid ?? (entry as any).trackSid ?? '',
        };
      }
      return entry;
    }) as RemoteTrackPublication[];

    return normalized.filter((p) => (kind === 'video' ? p.kind === Track.Kind.Video : p.kind === Track.Kind.Audio));
  }

  const all = safeValues((participant as any).trackPublications) as RemoteTrackPublication[];

  // FIX 4: More robust filtering that handles both kind and track.kind
  return all.filter((p) => {
    if (kind === 'video') {
      return p.kind === Track.Kind.Video || p.track?.kind === Track.Kind.Video;
    }
    return p.kind === Track.Kind.Audio || p.track?.kind === Track.Kind.Audio;
  });
};

// Extended props for BattleParticipantTile.
// Battle rule:
// - publishers (host/stage) render LiveKit tracks
// - viewers also render LiveKit tracks only
// - the tile itself must stay clickable for gifts/mod actions
interface BattleParticipantTileProps extends BattleParticipant {
  side: 'challenger' | 'opponent';
  crownInfo?: CrownInfo;
  isSuddenDeath?: boolean;
  onTroll?: () => void;
  canTroll?: boolean;
  onTileClick?: () => void;
  isSingleHost?: boolean;
  /** State battle: state code to display (e.g. "CA") */
  stateCode?: string | null;
  /** State battle: state name to display (e.g. "California") */
  stateName?: string | null;
  /** State battle: total battle points for this state */
  statePoints?: number | null;
  /** Whether this is a state battle */
  isStateBattle?: boolean;
  /** Callback to toggle camera for this participant */
  onToggleCamera?: () => void;
  /** Callback to toggle mic for this participant */
  onToggleMic?: () => void;
  /** Whether camera toggle is available */
  canToggleCamera?: boolean;
  /** Whether mic toggle is available */
  canToggleMic?: boolean;
}

const BattleVideoRenderer = ({
  videoTrack,
}: {
  videoTrack?: LocalVideoTrack | RemoteVideoTrack;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    const currentTrackId = videoTrack.sid || (videoTrack as any).id;
    if (currentTrackId && videoRef.current) {
      return;
    }
    const existingVideoElement = containerRef.current.querySelector('video');
    if (existingVideoElement) {
      try {
        if (videoRef.current) {
          videoTrack.detach(videoRef.current);
        }
      } catch (e) {
        console.warn('[BattleVideoRenderer] Failed to detach existing video element:', e);
      }
      existingVideoElement.remove();
      videoRef.current = null;
    }
    try {
      const videoElement = videoTrack.attach() as HTMLVideoElement;
      videoRef.current = videoElement;
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      videoElement.style.display = 'block';
      videoElement.style.backgroundColor = 'black';
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.controls = false;
      (videoElement as any).disablePictureInPicture = true;
      videoElement.muted = true;
      containerRef.current.appendChild(videoElement);
      const mediaTrack = videoTrack?.mediaStreamTrack;
      const trackSettings = mediaTrack ? (mediaTrack.getSettings?.() || {}) : {};
      const isFrontCamera = (trackSettings as any).facingMode !== 'environment';
      if (containerRef.current) {
        containerRef.current.style.transform = isFrontCamera ? 'scaleX(-1)' : '';
      }
    } catch (err) {
      console.error('[BattleVideoRenderer] attach() threw error:', err);
    }
  }, [videoTrack]);

  if (!videoTrack) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-0 object-cover overflow-hidden"
      style={{ minWidth: '100%', minHeight: '100%' }}
    />
  );
};

const BattleParticipantTile = ({
  identity,
  name,
  isLocal,
  videoTrack,
  isMicrophoneEnabled,
  isCameraEnabled,
  metadata,
  role,
  side,
  crownInfo,
  isSuddenDeath,
  onTroll,
  canTroll,
  onTileClick,
  isSingleHost = false,
  stateCode = null,
  stateName = null,
  statePoints = null,
  isStateBattle = false,
  onToggleCamera,
  onToggleMic,
  canToggleCamera = false,
  canToggleMic = false,
}: BattleParticipantTileProps) => {
  const isHost = role === 'host' || metadata?.role === 'host';
  const micMuted = !isMicrophoneEnabled;

  const handleTileClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onTileClick) return;
    if ((e.target as HTMLElement).closest('button')) return;
    onTileClick();
  };

  const handleTileKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onTileClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTileClick();
    }
  };

  const lastTileLogRef = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastTileLogRef.current < 3000) return;
    lastTileLogRef.current = now;
    console.log('[BattleParticipantTile] Rendering:', {
      identity,
      name,
      isHost,
      isSingleHost,
      hasLiveKitVideo: !!videoTrack,
      side,
      isLocal,
      videoTrackSid: videoTrack?.sid,
    });
  }, [identity, isSingleHost, isHost, name, side, videoTrack]);

  const containerClass = isSingleHost
    ? `relative w-full aspect-square md:h-full min-h-0 rounded-2xl overflow-hidden bg-black transition-all duration-300`
    : `relative w-full aspect-square md:aspect-video md:h-full min-h-0 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${side === 'challenger' ? 'border-emerald-400/70 shadow-[0_0_22px_rgba(16,185,129,0.24)]' : 'border-fuchsia-500/60 shadow-[0_0_22px_rgba(192,38,211,0.24)]'} bg-black`;

  return (
    <div
      className={cn(containerClass, onTileClick ? 'cursor-pointer touch-manipulation active:scale-[0.99]' : '')}
      onClick={handleTileClick}
      onKeyDown={handleTileKeyDown}
      role={onTileClick ? 'button' : undefined}
      tabIndex={onTileClick ? 0 : undefined}
    >
      {/* Video or Avatar.
          Critical: the actual video layer is pointer-events-none so mobile taps hit the tile.
          Video is rendered through LiveKit track attachment only. */}
      <div className="absolute inset-0 pointer-events-none">
        <BattleVideoRenderer
          videoTrack={videoTrack}
        />
      </div>

      {isHost && crownInfo && crownInfo.crowns > 0 && (
        <div className="absolute -top-1 -right-1 z-20 pointer-events-none">
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow-lg',
            crownInfo.hasStreak
              ? 'bg-gradient-to-r from-yellow-300 to-amber-500 text-black animate-pulse'
              : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black'
          )}>
            <Crown size={12} className="fill-black" />
            <span>{crownInfo.crowns}</span>
            {crownInfo.hasStreak && <Flame size={12} className="ml-0.5 fill-black" />}
          </div>
        </div>
      )}

      {isHost && crownInfo?.hasStreak && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <motion.div
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1"
          >
            <Flame size={12} className="fill-white" />
            <span>{crownInfo.streak} WIN STREAK!</span>
          </motion.div>
        </div>
      )}

      {isHost && isSuddenDeath && canTroll && onTroll && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onTroll();
          }}
          className="absolute bottom-2 right-2 z-30 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white p-2 rounded-full shadow-lg border-2 border-white/20"
          title="Troll Opponent"
        >
          <Skull size={18} />
        </motion.button>
      )}

      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-20 pointer-events-none">
        <div className={cn(
          'flex items-center gap-2 backdrop-blur-md px-2 py-1 rounded-full border',
          isHost ? 'bg-cyan-400/15 border-cyan-300/40' : 'bg-black/60 border-white/10'
        )}>
          <span className={cn('text-xs font-bold', isHost ? 'text-cyan-200' : 'text-white')}>
            {name || 'Anonymous'}
          </span>
          {isHost && (
            <span className="text-[8px] bg-gradient-to-r from-cyan-300 to-fuchsia-300 text-black px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              HOST
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Camera toggle button for remote participants */}
          {!isLocal && canToggleCamera && onToggleCamera && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCamera(); }}
              className={cn(
                "p-1.5 rounded-full shadow-lg pointer-events-auto",
                isCameraEnabled ? "bg-green-500/80 hover:bg-green-500" : "bg-red-500/80 hover:bg-red-500"
              )}
              title={isCameraEnabled ? "Camera ON" : "Camera OFF"}
            >
              {isCameraEnabled ? <Video size={12} className="text-white" /> : <VideoOff size={12} className="text-white" />}
            </button>
          )}

          {/* Mic toggle button for remote participants */}
          {!isLocal && canToggleMic && onToggleMic && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMic(); }}
              className={cn(
                "p-1.5 rounded-full shadow-lg pointer-events-auto",
                isMicrophoneEnabled ? "bg-green-500/80 hover:bg-green-500" : "bg-red-500/80 hover:bg-red-500"
              )}
              title={isMicrophoneEnabled ? "Mic ON" : "Mic OFF"}
            >
              {isMicrophoneEnabled ? <Mic size={12} className="text-white" /> : <MicOff size={12} className="text-white" />}
            </button>
          )}

          {micMuted && (
            <div className="bg-red-500 p-1.5 rounded-full shadow-lg">
              <MicOff size={12} className="text-white" />
            </div>
          )}
        </div>
      </div>

      {onTileClick && (
        <div className={cn(
          "absolute bottom-2 left-2 z-20 pointer-events-none rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[10px] font-bold text-white/80 backdrop-blur-md",
          isHost && "bottom-2 right-2 left-auto border-purple-400/30 bg-purple-500/20 text-purple-200 px-3 py-1.5 text-xs"
        )}>
          {isHost ? "Tap to gift 🎁" : "Tap for actions"}
        </div>
      )}

      {/* State battle: show state name + points at bottom middle of broadcaster box */}
      {isStateBattle && stateCode && stateName && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border whitespace-nowrap",
            side === 'challenger'
              ? "bg-emerald-950/80 border-emerald-400/40 text-emerald-200"
              : "bg-fuchsia-950/80 border-fuchsia-400/40 text-fuchsia-200"
          )}>
            <span>🏛️</span>
            <span>{stateName}</span>
            {statePoints !== null && statePoints !== undefined && (
              <span className="ml-1 opacity-70">• {statePoints.toLocaleString()} pts</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * JailTimeHostTile — Wraps a host BattleParticipantTile with the JAIL TIME
 * overlay when that side is losing. Used inside BattleArena render.
 */
const JailTimeHostTile = ({
  children,
  side,
  isLosing,
  onJailLock,
   onJailUnlock,
}: {
  children: React.ReactNode;
  side: 'challenger' | 'opponent';
  isLosing: boolean;
  onJailLock?: () => void;
  onJailUnlock?: () => void;
}) => {
  if (!isLosing) return <>{children}</>;
  return (
    <div className="relative w-full h-full">
      {children}
      <JailBarOverlay
        side={side}
        isLosing={true}
        onBarsLocked={onJailLock}
        onBarsFreed={onJailUnlock}
        showWarningLights={true}
        showTextBanner={true}
      />
    </div>
  );
};

/**
 * The main split arena component
 */
interface BattleArenaProps {
  onGift: (uid: string, sourceStreamId: string) => void;
  battleId: string;
  localAudioTrack: LocalAudioTrack | null;
  localVideoTrack: LocalVideoTrack | null;
  localIsCameraEnabled?: boolean;
  localIsMicEnabled?: boolean;
  remoteUsers: RemoteParticipant[];
  challengerStreamId: string;
  opponentStreamId: string;
  challengerHostId: string;
  opponentHostId: string;
  challengerHostName?: string;
  opponentHostName?: string;
  challengerBoxCount?: number;
  opponentBoxCount?: number;
  challengerCrownInfo?: CrownInfo;
  opponentCrownInfo?: CrownInfo;
  challengerScore?: number;
  opponentScore?: number;
  isSuddenDeath?: boolean;
  onTrollOpponent?: (targetStreamId: string) => void;
  canTroll?: boolean;
  currentUserTeam?: 'challenger' | 'opponent' | null;
  userIdToLiveKitIdentity?: Record<string, string>;
  currentUserProfile?: any;
  onOpenStaffActions?: (participant: BattleParticipant) => void;
  trackRevision: number;
  currentUserId?: string | null;
  isBroadcaster?: boolean;
  timeLeft?: number;
  battleStatus?: string;
  /** Enable JAIL TIME overlay effect (default: true for random battles) */
  jailTimeEnabled?: boolean;
  /** Enable JAIL TIME sound effects */
  jailTimeSoundEnabled?: boolean;
  /** Enable JAIL TIME ambient background audio */
  jailTimeAmbientEnabled?: boolean;
  /** State battle: challenger state code (e.g. "CA") */
  challengerStateCode?: string | null;
  /** State battle: challenger state name (e.g. "California") */
  challengerStateName?: string | null;
  /** State battle: challenger state total battle points */
  challengerStatePoints?: number | null;
  /** State battle: opponent state code */
  opponentStateCode?: string | null;
  /** State battle: opponent state name */
  opponentStateName?: string | null;
  /** State battle: opponent state total battle points */
  opponentStatePoints?: number | null;
  /** Whether this is a state battle */
  isStateBattle?: boolean;
  /** Callback to toggle camera for current user */
  onToggleCamera?: () => void;
  /** Callback to toggle mic for current user */
  onToggleMic?: () => void;
}

const BattleArena = ({
  onGift,
  battleId,
  localAudioTrack,
  localVideoTrack,
  localIsCameraEnabled,
  localIsMicEnabled,
  remoteUsers,
  trackRevision,
  challengerStreamId,
  opponentStreamId,
  challengerHostId,
  opponentHostId,
  challengerHostName,
  opponentHostName,
  challengerBoxCount = 1,
  opponentBoxCount = 1,
  challengerCrownInfo,
  opponentCrownInfo,
  challengerScore = 0,
  opponentScore = 0,
  isSuddenDeath = false,
  onTrollOpponent,
  canTroll = false,
  currentUserTeam,
  userIdToLiveKitIdentity,
  currentUserProfile,
  onOpenStaffActions,
  currentUserId,
  isBroadcaster = false,
  timeLeft,
  battleStatus,
  jailTimeEnabled = true,
  jailTimeSoundEnabled = true,
  jailTimeAmbientEnabled = true,
  challengerStateCode = null,
  challengerStateName = null,
  challengerStatePoints = null,
  opponentStateCode = null,
  opponentStateName = null,
  opponentStatePoints = null,
  isStateBattle = false,
  onToggleCamera,
  onToggleMic,
}: BattleArenaProps) => {
  const { user } = useAuthStore();

  // ── JAIL TIME effect ──
  const battleActive = battleStatus === 'active' || battleStatus === 'starting' || battleStatus === 'ready';
  const {
    challengerLosing,
    opponentLosing,
    onChallengerJailLock,
    onChallengerJailUnlock,
    onOpponentJailLock,
    onOpponentJailUnlock,
  } = useJailTime({
    challengerScore,
    opponentScore,
    battleActive: battleActive && jailTimeEnabled !== false,
    soundEnabled: jailTimeSoundEnabled !== false,
    ambientEnabled: jailTimeAmbientEnabled !== false,
  });
  const lastKnownTrackRef = useRef<Record<string, { video?: RemoteVideoTrack; audio?: RemoteAudioTrack }>>({});
  const [preBattleCountdown, setPreBattleCountdown] = useState<number | null>(null);
  const [cameraCheckResults, setCameraCheckResults] = useState<Record<string, { hasParticipant: boolean; hasPublication: boolean; hasSubscription: boolean; hasVideo: boolean }>>({});
  const [battleParticipants, setBattleParticipants] = useState<BattleParticipant[]>([]);
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobileLayout(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobileViewport = isMobileLayout;

  // Pre-battle camera check: when battle is starting/ready, verify both sides have cameras
  useEffect(() => {
    if (battleStatus !== 'starting' && battleStatus !== 'ready') {
      setPreBattleCountdown(null);
      setCameraCheckResults({});
      return;
    }

    const checkCameras = () => {
      const results: Record<string, { hasParticipant: boolean; hasPublication: boolean; hasSubscription: boolean; hasVideo: boolean }> = {};

      for (const side of ['challenger', 'opponent'] as const) {
        const hostId = side === 'challenger' ? challengerHostId : opponentHostId;
        const liveKitIdentity = userIdToLiveKitIdentity?.[hostId] || hostId;
        const normalizedIdentity = String(liveKitIdentity || '').replace(/-/g, '').toLowerCase();

        const participant = remoteUsers.find((u) => {
          const id = String(u.identity || '');
          const normalized = id.replace(/-/g, '').toLowerCase();
          return (
            id === liveKitIdentity ||
            normalized === normalizedIdentity ||
            normalized.startsWith(normalizedIdentity.substring(0, 8)) ||
            normalizedIdentity.startsWith(normalized.substring(0, 8))
          );
        });

        if (!participant) {
          results[side] = { hasParticipant: false, hasPublication: false, hasSubscription: false, hasVideo: false };
          continue;
        }

        const videoPubs = getTrackPublications(participant, 'video');
        const cameraPub = videoPubs.find(p => p.source === Track.Source.Camera);
        const hasPublication = !!cameraPub;
        const hasSubscription = cameraPub?.isSubscribed ?? false;
        const hasVideo = !!cameraPub?.track;

        results[side] = { hasParticipant: true, hasPublication, hasSubscription, hasVideo };
      }

      setCameraCheckResults(results);

      // Start 3-second countdown if not already running
      setPreBattleCountdown((prev) => {
        if (prev !== null) return prev; // Already counting down
        return 3;
      });
    };

    checkCameras();
  }, [battleStatus, remoteUsers, challengerHostId, opponentHostId, userIdToLiveKitIdentity]);

  // Countdown timer effect
  useEffect(() => {
    if (preBattleCountdown === null) return;
    if (preBattleCountdown <= 0) {
      setPreBattleCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      setPreBattleCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [preBattleCountdown]);

  const STAFF_ROLES = useMemo(() => new Set([
    'admin',
    'owner',
    'ceo',
    'moderator',
    'lead_troll_officer',
    'troll_officer',
    'staff',
  ]), []);

  const isStaffProfile = useCallback((profile: any) => {
    const role = String(profile?.role || profile?.account_type || '').toLowerCase();
    return STAFF_ROLES.has(role) || profile?.is_admin === true || profile?.is_staff === true || profile?.is_moderator === true;
  }, [STAFF_ROLES]);

  // Helper to get username from participant (checks profile join first)
  const getUsername = (participant: any, fallback = 'Anonymous'): string => {
    return participant?.profile?.username || participant?.username || fallback;
  };

  // Track last remote users identities and trackRevision to avoid redundant re-fetches
  const lastRemoteIdentitiesRef = useRef<string>('');
  const lastTrackRevisionRef = useRef<number>(-1);
  
  useEffect(() => {
    // Skip fetch if remoteUsers identities haven't changed AND trackRevision hasn't changed
    const currentIdentities = remoteUsers.map(u => u?.identity || '').sort().join(',');
    if (currentIdentities === lastRemoteIdentitiesRef.current && trackRevision === lastTrackRevisionRef.current) {
      return;
    }
    lastRemoteIdentitiesRef.current = currentIdentities;
    lastTrackRevisionRef.current = trackRevision;

    const fetchParticipantData = async () => {
      try {
      const getSupabaseParticipant = async (userId: string) => {
        const { data, error } = await supabase
          .from('battle_participants')
          .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
          .eq('battle_id', battleId)
          .eq('user_id', userId)
          .maybeSingle();
        if (error) console.error(`Failed to fetch battle_participant for user ${userId}:`, error);
        console.log('[BattleArena] getSupabaseParticipant for', userId, ':', data);
        return data;
      };

      const participantsData: BattleParticipant[] = [];

      // First, fetch ALL battle participants from database to ensure slots are shown
      // even before LiveKit connections are established
      const { data: allParticipants } = await supabase
        .from('battle_participants')
        .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
        .eq('battle_id', battleId);

      // Add database participants even if they're not in LiveKit yet
      if (allParticipants) {
        for (const dbParticipant of allParticipants) {
          // Skip null entries or if we already have this participant
          if (!dbParticipant) continue;
          if (participantsData.some(p => p.identity === dbParticipant.user_id)) continue;
          
          const metadata = safeParseMetadata(dbParticipant.metadata, `db participant ${dbParticipant.user_id}`);
          
          // Determine team from host IDs if not set
          let team: 'challenger' | 'opponent' | null = dbParticipant.team;
          if (!team) {
            if (dbParticipant.user_id === challengerHostId) {
              team = 'challenger';
            } else if (dbParticipant.user_id === opponentHostId) {
              team = 'opponent';
            }
          }
          
          // Get username from profile if available (joined via profile:user_profiles)
          const getUsername = (participant: any): string => {
            return participant?.profile?.username || participant?.username || 'Anonymous';
          };
          
          participantsData.push({
            identity: dbParticipant.user_id,
            name: getUsername(dbParticipant),
            isLocal: false, // Database participants aren't local until they connect
            videoTrack: undefined,
            audioTrack: undefined,
            isMicrophoneEnabled: false,
            isCameraEnabled: false,
            metadata: metadata,
            role: dbParticipant.role,
            team: team,
            sourceStreamId: metadata.sourceStreamId,
            seatIndex: metadata.seatIndex,
            profile: dbParticipant.profile,
            trollCoins: dbParticipant.profile?.troll_coins || 0,
            trollmonds: dbParticipant.profile?.trollmonds || 0,
          });
        }
      }

     
      // Helper to find LiveKit identity for a user ID
      const findLiveKitIdentity = (userId: string): string => {
        if (userIdToLiveKitIdentity?.[userId]) {
          return userIdToLiveKitIdentity[userId];
        }
        // Fallback to userId identity used by battle publishers.
        return userId;
      };

      // Helper to find RemoteParticipant by LiveKit identity
      const findRemoteParticipant = (livekitIdentity: string): RemoteParticipant | undefined => {
        const normalizedIdentity = String(livekitIdentity || '').replace(/-/g, '').toLowerCase();
        return remoteUsers.find((u) => {
          const id = String(u.identity || '');
          const normalized = id.replace(/-/g, '').toLowerCase();
          return (
            id === livekitIdentity ||
            normalized === normalizedIdentity ||
            normalized.startsWith(normalizedIdentity.substring(0, 8)) ||
            normalizedIdentity.startsWith(normalized.substring(0, 8))
          );
        });
      };

      // Local participant
      if (user) {
        const localSupabaseParticipant = await getSupabaseParticipant(user.id);
        const localMetadata = safeParseMetadata(localSupabaseParticipant?.metadata, `local user ${user.id}`);
        // Get username from profile if available (joined via profile:user_profiles)
        const getUsername = (participant: any): string => {
          return participant?.profile?.username || participant?.username || 'You';
        };
        
        // Determine the local user's team and role
        let localTeam: 'challenger' | 'opponent' | null = localSupabaseParticipant?.team;
        let localRole: 'host' | 'stage' | 'viewer' = localSupabaseParticipant?.role;
        
        // If not set from database, infer from stream ownership
        if (!localTeam) {
          if (user.id === challengerHostId) {
            localTeam = 'challenger';
          } else if (user.id === opponentHostId) {
            localTeam = 'opponent';
          }
        }
        
        // If broadcaster, they should be host
        if (isBroadcaster && !localRole) {
          localRole = 'host';
        }
        
        participantsData.push({
          identity: user.id,
          name: getUsername(localSupabaseParticipant) || user.user_metadata?.username || 'You',
          isLocal: true,
          videoTrack: localVideoTrack,
          audioTrack: localAudioTrack,
          // Use explicitly passed enabled state, fallback to track-based detection via mediaStreamTrack
          isMicrophoneEnabled: localIsMicEnabled ?? (localAudioTrack?.mediaStreamTrack?.enabled ?? false),
          // Be more lenient with camera check - use explicit state if available, otherwise check track
          isCameraEnabled: localIsCameraEnabled ?? !!localVideoTrack,
          metadata: localMetadata,
          role: localRole,
          team: localTeam,
          sourceStreamId: localMetadata.sourceStreamId,
          seatIndex: localMetadata.seatIndex,
          profile: localSupabaseParticipant?.profile,
          trollCoins: localSupabaseParticipant?.profile?.troll_coins || 0,
          trollmonds: localSupabaseParticipant?.profile?.trollmonds || 0,
        });
      }

      // Remote participants - use mapping to identify which team each belongs to
      for (const remoteUser of remoteUsers) {
        try {
        if (!remoteUser?.identity) {
          console.log('[BattleArena] Skipping remote participant with missing identity');
          continue;
        }
        const remoteIdentity = String(remoteUser.identity);
        const normalizeId = (v: string | null | undefined) => String(v || '').replace(/-/g, '').toLowerCase();
        const remoteIdentityNorm = normalizeId(remoteIdentity);
        const challengerIdentityGuess = normalizeId(userIdToLiveKitIdentity?.[challengerHostId] || challengerHostId);
        const opponentIdentityGuess = normalizeId(userIdToLiveKitIdentity?.[opponentHostId] || opponentHostId);

        // Try to match remote user to a team using the LiveKit identity mapping
        let matchedUserId: string | null = null;
        let matchedTeam: 'challenger' | 'opponent' | null = null;
        
        if (userIdToLiveKitIdentity) {
          // Find which user ID has this LiveKit identity
          for (const [userId, identity] of Object.entries(userIdToLiveKitIdentity)) {
            if (identity === remoteIdentity) {
              matchedUserId = userId;
              // Determine team based on which stream this user owns
              if (userId === challengerHostId) {
                matchedTeam = 'challenger';
              } else if (userId === opponentHostId) {
                matchedTeam = 'opponent';
              }
              break;
            }
          }
        }

        // If we didn't find a match via mapping, try to find participant by LiveKit identity directly
        // This handles the case where the identity IS the user ID
        if (!matchedUserId) {
          const { data: participantByIdentity } = await supabase
            .from('battle_participants')
            .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
            .eq('battle_id', battleId)
            .eq('user_id', remoteIdentity)
            .maybeSingle();
          
          if (participantByIdentity) {
            matchedUserId = remoteIdentity;
            matchedTeam = participantByIdentity.team;
          }
        }

        // Final fallback for viewer/mobile: infer host identity even when mapping is stale/missing.
        if (!matchedUserId) {
          if (
            remoteIdentityNorm === challengerIdentityGuess ||
            remoteIdentityNorm.startsWith(challengerIdentityGuess.substring(0, 8)) ||
            challengerIdentityGuess.startsWith(remoteIdentityNorm.substring(0, 8))
          ) {
            matchedUserId = challengerHostId;
            matchedTeam = 'challenger';
          } else if (
            remoteIdentityNorm === opponentIdentityGuess ||
            remoteIdentityNorm.startsWith(opponentIdentityGuess.substring(0, 8)) ||
            opponentIdentityGuess.startsWith(remoteIdentityNorm.substring(0, 8))
          ) {
            matchedUserId = opponentHostId;
            matchedTeam = 'opponent';
          }
        }

        // If we still don't have a match, skip this participant
        if (!matchedUserId) {
          console.log('[BattleArena] Skipping unmatched remote participant:', remoteUser.identity);
          continue;
        }

        // If we found a match, get participant data from database
        let remoteSupabaseParticipant = null;
        let remoteMetadata: any = {};
        
        if (matchedUserId) {
          remoteSupabaseParticipant = await getSupabaseParticipant(matchedUserId);
          remoteMetadata = safeParseMetadata(remoteSupabaseParticipant?.metadata, `remote user ${remoteIdentity}`);
          // Use team from database if not set from mapping
          if (!matchedTeam && remoteSupabaseParticipant?.team) {
            matchedTeam = remoteSupabaseParticipant.team;
          }
        }

        // FIX #1: Correct Track Extraction - use publications with isSubscribed check
        // Use proper source mapping - check publication.source against Track.Source enum
        // Also handle case where videoTracks/audioTracks might be undefined
        const videoPublications = getTrackPublications(remoteUser, 'video');
        const audioPublications = getTrackPublications(remoteUser, 'audio');

        // Log ALL publication details for debugging
        videoPublications.forEach(p => {
          console.log('[BattleArena] Video publication:', {
            trackSid: p.trackSid,
            source: p.source,
            isSubscribed: p.isSubscribed,
            trackKind: p.kind,
            hasTrack: !!p.track,
            trackSidFromTrack: p.track?.sid,
            // Use Track.Source enum for proper comparison
            isCamera: p.source === Track.Source.Camera,
            isScreen: p.source === Track.Source.ScreenShare,
          });
        });

        audioPublications.forEach(p => {
          console.log('[BattleArena] Audio publication:', {
            trackSid: p.trackSid,
            source: p.source,
            isSubscribed: p.isSubscribed,
            trackKind: p.kind,
            hasTrack: !!p.track,
            trackSidFromTrack: p.track?.sid,
            isMic: p.source === Track.Source.Microphone,
          });
        });

        // Enhanced mobile track detection - more aggressive fallbacks for mobile devices
        // Mobile devices may have delayed subscription or different track handling
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Find subscribed tracks - prefer Camera source for video, Microphone for audio
        // On mobile, be more lenient with subscription status
        let videoPub = videoPublications.find(p => p.isSubscribed && p.track && p.source === Track.Source.Camera);
        if (!videoPub && isMobileDevice) {
          // Mobile fallback: try any camera track, even if not subscribed yet
          videoPub = videoPublications.find(p => p.track && p.source === Track.Source.Camera) ||
                    videoPublications.find(p => p.track);
        }
        if (!videoPub) {
          // Standard fallback
          videoPub = videoPublications.find(p => p.isSubscribed && p.track);
        }

        let audioPub = audioPublications.find(p => p.isSubscribed && p.track && p.source === Track.Source.Microphone);
        if (!audioPub && isMobileDevice) {
          // Mobile fallback: try any microphone track, even if not subscribed yet
          audioPub = audioPublications.find(p => p.track && p.source === Track.Source.Microphone) ||
                    audioPublications.find(p => p.track);
        }
        if (!audioPub) {
          // Standard fallback
          audioPub = audioPublications.find(p => p.isSubscribed && p.track);
        }

        // Additional mobile-specific track detection
        if (!videoPub && isMobileDevice) {
          // Try to find tracks that might be in the process of subscribing
          const allVideoPubs: RemoteTrackPublication[] = remoteUser.trackPublications ?
            Array.from((remoteUser.trackPublications as Map<string, RemoteTrackPublication>).values()) : [];
          videoPub = allVideoPubs.find(p => p.track && p.kind === Track.Kind.Video && p.source === Track.Source.Camera) ||
                    allVideoPubs.find(p => p.track && p.kind === Track.Kind.Video);
        }

        if (!audioPub && isMobileDevice) {
          const allAudioPubs: RemoteTrackPublication[] = remoteUser.trackPublications ?
            Array.from((remoteUser.trackPublications as Map<string, RemoteTrackPublication>).values()) : [];
          audioPub = allAudioPubs.find(p => p.track && p.kind === Track.Kind.Audio && p.source === Track.Source.Microphone) ||
                    allAudioPubs.find(p => p.track && p.kind === Track.Kind.Audio);
        }
        
        // Log what we found
        console.log('[BattleArena] Selected video publication:', {
          found: !!videoPub,
          trackSid: videoPub?.trackSid,
          hasTrack: !!videoPub?.track,
          trackSidFromTrack: videoPub?.track?.sid,
        });
        console.log('[BattleArena] Selected audio publication:', {
          found: !!audioPub,
          trackSid: audioPub?.trackSid,
          hasTrack: !!audioPub?.track,
          trackSidFromTrack: audioPub?.track?.sid,
        });
        
        const cacheKey = matchedUserId;
        const cached = lastKnownTrackRef.current[cacheKey] || {};
        const resolvedVideoTrack = (videoPub?.track as RemoteVideoTrack | undefined) || cached.video;
        const resolvedAudioTrack = (audioPub?.track as RemoteAudioTrack | undefined) || cached.audio;

        if (videoPub?.track || audioPub?.track) {
          lastKnownTrackRef.current[cacheKey] = {
            video: (videoPub?.track as RemoteVideoTrack | undefined) || cached.video,
            audio: (audioPub?.track as RemoteAudioTrack | undefined) || cached.audio,
          };
        }

        // Keep previously known tracks during reconnect churn so tiles don't disappear instantly.
        const hasVideoTrack = !!resolvedVideoTrack;
        const hasAudioTrack = !!resolvedAudioTrack;

        console.log('[BattleArena] Adding participant to list:', {
          matchedUserId,
          matchedTeam,
          hasVideoTrack,
          hasAudioTrack,
          resolvedVideoTrackSid: resolvedVideoTrack?.sid,
          resolvedAudioTrackSid: resolvedAudioTrack?.sid,
        });
        
        // Update existing participant or add new one
        const existingIdx = participantsData.findIndex(p => p.identity === matchedUserId);
        // Get username from profile join
        const remoteName = remoteSupabaseParticipant?.profile?.username || remoteSupabaseParticipant?.username || `User ${remoteIdentity.slice(0, 8)}`;
        const participantData = {
          identity: matchedUserId || remoteIdentity,
          name: remoteName,
          isLocal: false,
          videoTrack: resolvedVideoTrack,
          audioTrack: resolvedAudioTrack,
          isMicrophoneEnabled: hasAudioTrack,
          isCameraEnabled: hasVideoTrack,
          metadata: remoteMetadata,
          role: remoteSupabaseParticipant?.role || (matchedTeam ? 'host' : 'stage'),
          team: matchedTeam || remoteSupabaseParticipant?.team || null,
          sourceStreamId: remoteMetadata.sourceStreamId,
          seatIndex: remoteMetadata.seatIndex,
          profile: remoteSupabaseParticipant?.profile,
          trollCoins: remoteSupabaseParticipant?.profile?.troll_coins || 0,
          trollmonds: remoteSupabaseParticipant?.profile?.trollmonds || 0,
        };
        
        if (existingIdx >= 0) {
          participantsData[existingIdx] = participantData;
        } else {
          participantsData.push(participantData);
        }
        } catch (participantError) {
          console.error('[BattleArena] Failed processing remote participant:', remoteUser?.identity, participantError);
        }
      }

      // Ensure both host slots can still render video even if participant lookup/mapping misses.
      const ensureHostFallback = (
        hostUserId: string,
        team: 'challenger' | 'opponent',
        label: string
      ) => {
        const hostAlreadyPresent = participantsData.some(
          (p) => p.role === 'host' && p.team === team && (!!p.videoTrack || !!p.audioTrack)
        );
        if (hostAlreadyPresent) return;

        const liveKitIdentity = userIdToLiveKitIdentity?.[hostUserId] || hostUserId;
        const normalizedIdentity = String(liveKitIdentity || '').replace(/-/g, '').toLowerCase();
        const remote = remoteUsers.find((u) => {
          const id = String(u.identity || '');
          const normalized = id.replace(/-/g, '').toLowerCase();
          return (
            id === liveKitIdentity ||
            normalized === normalizedIdentity ||
            normalized.startsWith(normalizedIdentity.substring(0, 8)) ||
            normalizedIdentity.startsWith(normalized.substring(0, 8))
          );
        });
        if (!remote) return;

const videoPub = getTrackPublications(remote, 'video').find((p) => p.isSubscribed && p.track)
            || getTrackPublications(remote, 'video').find((p) => p.track);
          const audioPub = getTrackPublications(remote, 'audio').find((p) => p.isSubscribed && p.track)
            || getTrackPublications(remote, 'audio').find((p) => p.track);

        console.log('[BattleArena] ensureHostFallback found tracks:', {
          team,
          label,
          hostUserId,
          liveKitIdentity,
          hasVideo: !!videoPub?.track,
          hasAudio: !!audioPub?.track,
          videoPubTrackSid: videoPub?.track?.sid,
          audioPubTrackSid: audioPub?.track?.sid,
        });

        participantsData.push({
          identity: hostUserId,
          name: label,
          isLocal: false,
          videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
          audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
          isMicrophoneEnabled: !!audioPub?.track,
          isCameraEnabled: !!videoPub?.track,
          metadata: {},
          role: 'host',
          team,
          sourceStreamId: undefined,
          seatIndex: 0,
        });
      };

      ensureHostFallback(challengerHostId, 'challenger', 'Challenger');
      ensureHostFallback(opponentHostId, 'opponent', 'Opponent');

      // Last-resort viewer fallback:
      // when identity mapping fails on some mobile viewer sessions, bind remaining remote
      // participants to missing host slots by order so broadcaster feeds still render.
      const hasChallengerHost = participantsData.some(
        (p) => p.role === 'host' && p.team === 'challenger' && (!!p.videoTrack || !!p.audioTrack)
      );
      const hasOpponentHost = participantsData.some(
        (p) => p.role === 'host' && p.team === 'opponent' && (!!p.videoTrack || !!p.audioTrack)
      );

      if ((!hasChallengerHost || !hasOpponentHost) && remoteUsers.length > 0) {
        const usedIdentities = new Set(participantsData.map((p) => p.identity));
        const remainingRemotes = remoteUsers.filter((u) => u?.identity && !usedIdentities.has(String(u.identity)));

        const buildHostFromRemote = (
          remote: RemoteParticipant,
          hostUserId: string,
          team: 'challenger' | 'opponent',
          label: string
        ) => {
          const videoPub = getTrackPublications(remote, 'video').find((p) => p.isSubscribed && p.track)
            || getTrackPublications(remote, 'video').find((p) => p.track);
          const audioPub = getTrackPublications(remote, 'audio').find((p) => p.isSubscribed && p.track)
            || getTrackPublications(remote, 'audio').find((p) => p.track);

          participantsData.push({
            identity: hostUserId,
            name: label,
            isLocal: false,
            videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
            audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
            isMicrophoneEnabled: !!audioPub?.track,
            isCameraEnabled: !!videoPub?.track,
            metadata: {},
            role: 'host',
            team,
            sourceStreamId: undefined,
            seatIndex: 0,
          });
        };

        if (!hasChallengerHost && remainingRemotes[0]) {
          buildHostFromRemote(remainingRemotes[0], challengerHostId, 'challenger', 'Challenger');
        }
        if (!hasOpponentHost && remainingRemotes[1]) {
          buildHostFromRemote(remainingRemotes[1], opponentHostId, 'opponent', 'Opponent');
        }

        // ULTRA-FALLBACK: If still no hosts with tracks, assign ANY remote user with video to the missing slots
        // This handles cases where identity mapping completely fails on mobile
        const finalChallengerHost = participantsData.find(p => p.role === 'host' && p.team === 'challenger' && p.videoTrack);
        const finalOpponentHost = participantsData.find(p => p.role === 'host' && p.team === 'opponent' && p.videoTrack);

        if (!finalChallengerHost) {
          const anyRemoteWithVideo = remoteUsers.find(u => {
            const pubs = getTrackPublications(u, 'video');
            return pubs.some(p => p.track);
          });
          if (anyRemoteWithVideo) {
            const p = anyRemoteWithVideo;
            const videoPub = getTrackPublications(p, 'video').find((pb: any) => pb.track);
            const audioPub = getTrackPublications(p, 'audio').find((pb: any) => pb.track);
            participantsData.push({
              identity: p.identity,
              name: p.name || 'User',
              isLocal: false,
              videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
              audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
              isMicrophoneEnabled: !!audioPub?.track,
              isCameraEnabled: !!videoPub?.track,
              metadata: {},
              role: 'host',
              team: 'challenger',
              sourceStreamId: undefined,
              seatIndex: 0,
            });
            console.log('[BattleArena] ULTRA-FALLBACK: Assigned remote user to challenger slot', p.identity?.substring(0, 8));
          }
        }

        if (!finalOpponentHost) {
          const anyRemoteWithVideo = remoteUsers.find(u => {
            const pubs = getTrackPublications(u, 'video');
            return pubs.some(p => p.track) && u.identity !== participantsData.find(p => p.videoTrack)?.identity;
          });
          if (anyRemoteWithVideo) {
            const p = anyRemoteWithVideo;
            const videoPub = getTrackPublications(p, 'video').find((pb: any) => pb.track);
            const audioPub = getTrackPublications(p, 'audio').find((pb: any) => pb.track);
            participantsData.push({
              identity: p.identity,
              name: p.name || 'User',
              isLocal: false,
              videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
              audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
              isMicrophoneEnabled: !!audioPub?.track,
              isCameraEnabled: !!videoPub?.track,
              metadata: {},
              role: 'host',
              team: 'opponent',
              sourceStreamId: undefined,
              seatIndex: 0,
            });
            console.log('[BattleArena] ULTRA-FALLBACK: Assigned remote user to opponent slot', p.identity?.substring(0, 8));
          }
        }
      }

      setBattleParticipants(participantsData);
      } catch (e) {
        console.error('[BattleArena] fetchParticipantData failed:', e);
      }
    };

    fetchParticipantData();
  }, [remoteUsers, battleId, trackRevision, userIdToLiveKitIdentity, challengerHostId, opponentHostId]);

  const categorized = useMemo(() => {
    const teams = {
      challenger: { host: null as BattleParticipant | null, guests: [] as BattleParticipant[], boxCount: Math.max(1, Math.min(challengerBoxCount, 6)) },
      opponent: { host: null as BattleParticipant | null, guests: [] as BattleParticipant[], boxCount: Math.max(1, Math.min(opponentBoxCount, 6)) }
    };

    battleParticipants.forEach(p => {
      if (p.team === 'challenger' || p.team === 'opponent') {
        if (p.role === 'host') {
          teams[p.team].host = p;
        } else if (p.role === 'stage') {
          teams[p.team].guests.push(p);
        }
      }
    });

    const sortBySeat = (a: BattleParticipant, b: BattleParticipant) => {
      return (a.seatIndex || 0) - (b.seatIndex || 0);
    };
    
    teams.challenger.guests.sort(sortBySeat);
    teams.opponent.guests.sort(sortBySeat);

    return teams;
  }, [battleParticipants, challengerBoxCount, opponentBoxCount]);

  const handleGiftClick = (p: BattleParticipant) => {
    if (isBroadcaster) return;
    if (currentUserId && p.identity === currentUserId) return;
    const resolvedStreamId =
      p.sourceStreamId ||
      (p.team === 'challenger' ? challengerStreamId : p.team === 'opponent' ? opponentStreamId : '');
    if (!resolvedStreamId || !p.identity) return;
    onGift(p.identity, resolvedStreamId);
  };

  const handleParticipantBoxClick = (participant: BattleParticipant) => {
    if (!participant?.identity) return;

    const resolvedStreamId =
      participant.sourceStreamId ||
      (participant.team === 'challenger'
        ? challengerStreamId
        : participant.team === 'opponent'
          ? opponentStreamId
          : '');

    if (isStaffProfile(currentUserProfile)) {
      if (onOpenStaffActions) {
        onOpenStaffActions({ ...participant, sourceStreamId: resolvedStreamId || participant.sourceStreamId });
        return;
      }

      window.dispatchEvent(new CustomEvent('trollcity:open-user-actions', {
        detail: {
          userId: participant.identity,
          username: participant.name,
          streamId: resolvedStreamId,
          battleId,
          role: participant.role,
          team: participant.team,
          source: 'battle_box',
        },
      }));
      return;
    }

    handleGiftClick({ ...participant, sourceStreamId: resolvedStreamId || participant.sourceStreamId });
  };

  const handleSideGiftClick = (team: 'challenger' | 'opponent') => {
    if (isBroadcaster) return;
    const streamId = team === 'challenger' ? challengerStreamId : opponentStreamId;
    const hostId = team === 'challenger' ? challengerHostId : opponentHostId;
    if (!streamId || !hostId) return;
    onGift(hostId, streamId);
  };

  const handleTrollClick = (team: 'challenger' | 'opponent') => {
    if (!onTrollOpponent) return;
    const targetStreamId = team === 'challenger' ? challengerStreamId : opponentStreamId;
    onTrollOpponent(targetStreamId);
  };

  // Generate placeholder slots based on box_count for each team - show ALL slots including empty ones
  const challengerSlots = useMemo(() => {
    const teamData = categorized.challenger;
    const boxCount = Math.min(teamData.boxCount, 6);
    const slots: Array<{ type: 'host' | 'guest'; participant?: BattleParticipant | null; index?: number }> = [];
    slots.push({ type: 'host', participant: teamData.host || null });
    const guestSlots = Math.max(0, boxCount - 1);
    for (let i = 0; i < guestSlots; i++) {
      slots.push({ type: 'guest', participant: teamData.guests[i] || null, index: i + 1 });
    }
    return slots;
  }, [categorized.challenger.boxCount, categorized.challenger.host, categorized.challenger.guests]);

  const opponentSlots = useMemo(() => {
    const teamData = categorized.opponent;
    const boxCount = Math.min(teamData.boxCount, 6);
    const slots: Array<{ type: 'host' | 'guest'; participant?: BattleParticipant | null; index?: number }> = [];
    slots.push({ type: 'host', participant: teamData.host || null });
    const guestSlots = Math.max(0, boxCount - 1);
    for (let i = 0; i < guestSlots; i++) {
      slots.push({ type: 'guest', participant: teamData.guests[i] || null, index: i + 1 });
    }
    return slots;
  }, [categorized.opponent.boxCount, categorized.opponent.host, categorized.opponent.guests]);

  const remoteAudioEntries = useMemo(() => {
    const unique = new Map<string, { label: string; audioTrack: LocalAudioTrack | RemoteAudioTrack }>();
    for (const participant of battleParticipants) {
      if (participant.isLocal || !participant.audioTrack) continue;
      const track = participant.audioTrack as LocalAudioTrack | RemoteAudioTrack;
      const trackSid = String((track as any)?.sid || (track as any)?.mediaStreamTrack?.id || 'audio');
      const key = `${participant.identity}:${trackSid}`;
      if (!unique.has(key)) {
        unique.set(key, {
          label: `${participant.team || 'viewer'}:${participant.name || participant.identity}`,
          audioTrack: track,
        });
      }
    }
    return Array.from(unique.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      audioTrack: value.audioTrack,
    }));
  }, [battleParticipants]);

  // DEBUG: Log slot counts to diagnose single-host scenarios (throttled)
  const lastDebugLogRef = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastDebugLogRef.current < 2000) return;
    lastDebugLogRef.current = now;
    console.log('[BattleArena] Remote users for track lookup:', {
      remoteUsersCount: remoteUsers.length,
      challengerHostId,
      opponentHostId,
      userIdToLiveKitIdentity,
      remoteUsersIdentities: remoteUsers.map(u => u?.identity?.substring(0, 12)),
    });
    console.log('[BattleArena] Slot counts:', {
      challengerSlots: challengerSlots.length,
      opponentSlots: opponentSlots.length,
      challengerGuests: categorized.challenger.guests.length,
      opponentGuests: categorized.opponent.guests.length,
      battleParticipantsCount: battleParticipants.length,
      challengeHostTrack: !!battleParticipants.find(p => p.team === 'challenger' && p.role === 'host')?.videoTrack,
      opponentHostTrack: !!battleParticipants.find(p => p.team === 'opponent' && p.role === 'host')?.videoTrack,
    });
  }, [remoteUsers.length, challengerHostId, opponentHostId, userIdToLiveKitIdentity, challengerSlots.length, opponentSlots.length, categorized.challenger.guests.length, categorized.opponent.guests.length, battleParticipants.length]);

  // Determine if a side has only the host (no guests) - for single-host styling
  const challengerIsSingleHost = challengerSlots.length === 1 && challengerSlots[0]?.type === 'host';
  const opponentIsSingleHost = opponentSlots.length === 1 && opponentSlots[0]?.type === 'host';
  const isSingleHostBattle = challengerIsSingleHost && opponentIsSingleHost;

  const battleLeadTeam = challengerScore > opponentScore
    ? 'challenger'
    : opponentScore > challengerScore
      ? 'opponent'
      : 'tie';

  const challengerGlowClass = battleLeadTeam === 'challenger'
    ? 'border-2 border-emerald-500/90 shadow-[0_0_30px_rgba(16,185,129,0.45)]'
    : 'border-2 border-emerald-500/20';
  const opponentGlowClass = battleLeadTeam === 'opponent'
    ? 'border-2 border-fuchsia-500/90 shadow-[0_0_30px_rgba(192,38,211,0.45)]'
    : 'border-2 border-fuchsia-500/20';
  const vsGlowClass = battleLeadTeam === 'challenger'
    ? 'text-emerald-300 drop-shadow-[0_0_20px_rgba(16,185,129,0.85)]'
    : battleLeadTeam === 'opponent'
      ? 'text-fuchsia-300 drop-shadow-[0_0_20px_rgba(192,38,211,0.85)]'
      : 'text-white/90 drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]';

  // Mobile-optimized grid layout: horizontal layout for mobile, vertical split for desktop
  const getGridClass = (totalSlots: number) => {
    // Mobile: Always use horizontal layout (2 columns) for both sides
    // Desktop: Use existing vertical split logic
    if (isMobileViewport) {
      // On mobile, each side shows its own grid independently
      // Host + guests for each team in a row
      // Use square aspect ratio for mobile battle arena
      if (totalSlots === 1) return 'grid-cols-1';
      if (totalSlots === 2) return 'grid-cols-2';
      if (totalSlots === 3) return 'grid-cols-3';
      if (totalSlots <= 4) return 'grid-cols-2';
      if (totalSlots <= 6) return 'grid-cols-3';
      return 'grid-cols-3';
    }
    // Desktop layout
    if (totalSlots === 1) return 'grid-cols-1 grid-rows-1';
    if (totalSlots === 2) return 'grid-cols-1 grid-rows-2';
    if (totalSlots === 3) return 'grid-cols-1 grid-rows-3';
    if (totalSlots === 4) return 'grid-cols-2 grid-rows-2';
    if (totalSlots === 5) return 'grid-cols-1 grid-rows-5 md:grid-cols-2 md:grid-rows-3';
    if (totalSlots === 6) return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';
    return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';
  };

return (
    <div className={cn(
      "w-full h-full min-h-0 overflow-hidden p-2 md:p-4 gap-2 md:gap-4",
      isMobileViewport && isSingleHostBattle ? "flex flex-col" : "flex"
    )}>
      {/* Mobile Layout: vertical split for single-host battles, horizontal for multi-host */}
      {(() => {
        if (isMobileViewport) {
          if (isSingleHostBattle) {
            return (
              <>
          {/* Challenger Side - Top */}
          <div className={cn(
            'flex-none w-full flex flex-col gap-1 overflow-hidden rounded-3xl p-1',
            challengerGlowClass
          )} style={{ height: 'calc((100% - 4.5rem) / 2)' }}>
            <div className="grid gap-1 grid-cols-1 w-full h-full">
              {challengerSlots.map((slot, idx) => (
                <div key={`challenger-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <JailTimeHostTile side="challenger" isLosing={challengerLosing} onJailLock={onChallengerJailLock} onJailUnlock={onChallengerJailUnlock}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={true}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-purple-500/50" size={48} />
                          <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="challenger"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-purple-500/30" size={24} />
                          <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center: VS + Score + Timer */}
          <div className="flex-none flex items-center justify-center gap-3 h-16 px-2">
            {/* Challenger score */}
            <div className="flex-1 flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 truncate max-w-full">{challengerHostName || 'Challenger'}</span>
              <span className="font-mono text-lg font-black leading-none text-purple-400">{challengerScore.toLocaleString()}</span>
            </div>

            {/* Center VS + Timer */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60',
                vsGlowClass
              )}>
                <span className="text-xs font-black uppercase tracking-wider">VS</span>
              </div>
              <div className={cn(
                "font-mono text-xs font-bold leading-none",
                isSuddenDeath ? "text-red-500" : "text-white"
              )}>
                {battleStatus === 'ended' ? "ENDED" : timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : "3:00"}
              </div>
            </div>

            {/* Opponent score */}
            <div className="flex-1 flex flex-col items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 truncate max-w-full">{opponentHostName || 'Opponent'}</span>
              <span className="font-mono text-lg font-black leading-none text-emerald-400">{opponentScore.toLocaleString()}</span>
            </div>
          </div>

          {/* Opponent Side - Bottom */}
          <div className={cn(
            'flex-none w-full flex flex-col gap-1 overflow-hidden rounded-3xl p-1',
            opponentGlowClass
          )} style={{ height: 'calc((100% - 4.5rem) / 2)' }}>
            <div className="grid gap-1 grid-cols-1 w-full h-full">
              {opponentSlots.map((slot, idx) => (
                <div key={`opponent-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <JailTimeHostTile side="opponent" isLosing={opponentLosing} onJailLock={onOpponentJailLock} onJailUnlock={onOpponentJailUnlock}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={true}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/50" size={48} />
                          <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="opponent"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/30" size={24} />
                          <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
            );
          }
          return (
        <div className="relative flex-1 min-h-0 h-full flex flex-col gap-1 overflow-hidden">
          {/* Challenger Side - top */}
          <div className={cn(
            'flex-none rounded-3xl border-2 p-1',
            challengerGlowClass
          )} style={{ height: 'calc((100% - 4.5rem) / 2)' }}>
            <div className="grid gap-1 grid-cols-1 h-full">
              {challengerSlots.map((slot, idx) => (
                <div key={`challenger-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <JailTimeHostTile side="challenger" isLosing={challengerLosing} onJailLock={onChallengerJailLock} onJailUnlock={onChallengerJailUnlock}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={challengerIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-purple-500/50" size={48} />
                          <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="challenger"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-purple-500/30" size={24} />
                          <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center: VS + Timer + Score */}
          <div className="flex-none flex items-center justify-center gap-2 h-16 px-2">
            {/* Challenger score */}
            <div className="flex-1 flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 truncate max-w-full">{challengerHostName || 'Challenger'}</span>
              <span className="font-mono text-lg font-black leading-none text-purple-400">{challengerScore.toLocaleString()}</span>
            </div>

            {/* Center VS + Timer */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60',
                vsGlowClass
              )}>
                <span className="text-xs font-black uppercase tracking-wider">VS</span>
              </div>
              <div className={cn(
                "font-mono text-xs font-bold leading-none",
                isSuddenDeath ? "text-red-500" : "text-white"
              )}>
                {battleStatus === 'ended' ? "ENDED" : timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : "3:00"}
              </div>
            </div>

            {/* Opponent score */}
            <div className="flex-1 flex flex-col items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 truncate max-w-full">{opponentHostName || 'Opponent'}</span>
              <span className="font-mono text-lg font-black leading-none text-emerald-400">{opponentScore.toLocaleString()}</span>
            </div>
          </div>

          {/* Opponent Side - bottom */}
          <div className={cn(
            'flex-none rounded-3xl border-2 p-1',
            opponentGlowClass
          )} style={{ height: 'calc((100% - 4.5rem) / 2)' }}>
            <div className="grid gap-1 grid-cols-1 h-full">
              {opponentSlots.map((slot, idx) => (
                <div key={`opponent-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <JailTimeHostTile side="opponent" isLosing={opponentLosing} onJailLock={onOpponentJailLock} onJailUnlock={onOpponentJailUnlock}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={opponentIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/50" size={48} />
                          <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="opponent"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/30" size={24} />
                          <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
            );
        }
        if (isSingleHostBattle) {
          return (
        /* Desktop Layout: Vertical split */
        <>
          {/* Challenger Side */}
          <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pr-1 scrollbar-hide">
            {!isBroadcaster && (
              <button
                onClick={() => handleSideGiftClick('challenger')}
                className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white border border-purple-400/50 shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
              >
                Gift Side A
              </button>
            )}
            
            {/* Unified Grid for Host + Guests */}
             <div className={`grid gap-2 ${getGridClass(challengerSlots.length)} h-full`}>
              {challengerSlots.map((slot, idx) => (
                <div key={`challenger-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <JailTimeHostTile side="challenger" isLosing={challengerLosing} onJailLock={onChallengerJailLock} onJailUnlock={onChallengerJailUnlock}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={challengerIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        false ? (
                          <BattleParticipantTile
                            identity={challengerHostId}
                            name={challengerHostName || 'Challenger'}
                            isLocal={false}
                            isMicrophoneEnabled={true}
                            isCameraEnabled={true}
                            metadata={{ role: 'host' }}
                            role="host"
                            team="challenger"
                            sourceStreamId={challengerStreamId}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            isSingleHost={challengerIsSingleHost}
                            onTileClick={() => handleParticipantBoxClick({
                              identity: challengerHostId,
                              name: challengerHostName || 'Challenger',
                              isLocal: false,
                              isMicrophoneEnabled: false,
                              isCameraEnabled: true,
                              metadata: { role: 'host' },
                              role: 'host',
                              team: 'challenger',
                              sourceStreamId: challengerStreamId,
                            })}
                            onToggleCamera={currentUserId === challengerHostId ? onToggleCamera : undefined}
                            onToggleMic={currentUserId === challengerHostId ? onToggleMic : undefined}
                            canToggleCamera={currentUserId === challengerHostId}
                            canToggleMic={currentUserId === challengerHostId}
                          />
                        ) : (
                          <div className="h-full min-h-0 rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                            <User className="text-purple-500/50" size={48} />
                            <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="challenger"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-purple-500/30" size={24} />
                          <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center: VS + Score + Timer */}
          <div className="flex-none w-24 flex flex-col items-center justify-center gap-1.5 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              {isSuddenDeath ? "SUDDEN DEATH" : "1v1 BATTLE"}
            </span>
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60',
              vsGlowClass
            )}>
              <span className="text-lg font-black uppercase tracking-[0.15em]">VS</span>
            </div>
            <div className={cn(
              "font-mono text-sm font-black leading-none",
              isSuddenDeath ? "text-red-500" : "text-white/70"
            )}>
              {battleStatus === 'ended' ? "ENDED" : timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : "3:00"}
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="font-mono text-base font-black text-purple-400">{challengerScore.toLocaleString()}</span>
              <span className="text-[7px] font-bold text-white/30">·</span>
              <span className="font-mono text-base font-black text-emerald-400">{opponentScore.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-1 w-full">
              <span className="text-right text-[8px] font-bold uppercase tracking-wider text-purple-400 truncate">{challengerHostName || 'A'}</span>
              <span className="text-[7px] text-white/30">·</span>
              <span className="text-left text-[8px] font-bold uppercase tracking-wider text-emerald-400 truncate">{opponentHostName || 'B'}</span>
            </div>
          </div>

          {/* Opponent Side */}
          <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pl-1 scrollbar-hide">
            {!isBroadcaster && (
              <button
                onClick={() => handleSideGiftClick('opponent')}
                className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
              >
                Gift Side B
              </button>
            )}
            
            {/* Unified Grid for Host + Guests - match BroadcastGrid layout */}
            <div className={`grid gap-2 ${getGridClass(opponentSlots.length)} h-full`}>
              {opponentSlots.map((slot, idx) => (
                <div key={`opponent-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <JailTimeHostTile side="opponent" isLosing={opponentLosing} onJailLock={onOpponentJailLock} onJailUnlock={onOpponentJailUnlock}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={opponentIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        false ? (
                          <BattleParticipantTile
                            identity={opponentHostId}
                            name={opponentHostName || 'Opponent'}
                            isLocal={false}
                            isMicrophoneEnabled={true}
                            isCameraEnabled={true}
                            metadata={{ role: 'host' }}
                            role="host"
                            team="opponent"
                            sourceStreamId={opponentStreamId}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            isSingleHost={opponentIsSingleHost}
                            onTileClick={() => handleParticipantBoxClick({
                              identity: opponentHostId,
                              name: opponentHostName || 'Opponent',
                              isLocal: false,
                              isMicrophoneEnabled: false,
                              isCameraEnabled: true,
                              metadata: { role: 'host' },
                              role: 'host',
                              team: 'opponent',
                              sourceStreamId: opponentStreamId,
                            })}
                            onToggleCamera={currentUserId === opponentHostId ? onToggleCamera : undefined}
                            onToggleMic={currentUserId === opponentHostId ? onToggleMic : undefined}
                            canToggleCamera={currentUserId === opponentHostId}
                            canToggleMic={currentUserId === opponentHostId}
                          />
                        ) : (
                          <div className="h-full min-h-0 rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                            <User className="text-emerald-500/50" size={48} />
                            <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="opponent"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/30" size={24} />
                          <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
          );
        }
        return (
        /* Desktop Layout: Random battle — side by side with score/timer/VS in center */
        <>
          {/* Challenger Side */}
          <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pr-1 scrollbar-hide">
            {!isBroadcaster && (
              <button
                onClick={() => handleSideGiftClick('challenger')}
                className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white border border-purple-400/50 shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
              >
                Gift Side A
              </button>
            )}
            <div className={`grid gap-2 ${getGridClass(challengerSlots.length)} h-full`}>
              {challengerSlots.map((slot, idx) => (
                <div key={`challenger-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <JailTimeHostTile side="challenger" isLosing={challengerLosing} onJailLock={onChallengerJailLock} onJailUnlock={onChallengerJailUnlock}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={challengerIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-purple-500/50" size={48} />
                          <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="challenger"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-purple-500/30" size={24} />
                          <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center: VS + Score + Timer */}
          <div className="flex-none w-28 flex flex-col items-center justify-center gap-2 px-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">
              {isSuddenDeath ? "SUDDEN DEATH" : `${challengerSlots.length}v${opponentSlots.length} BATTLE`}
            </span>
            <div className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/60',
              vsGlowClass
            )}>
              <span className="text-2xl font-black uppercase tracking-[0.2em]">VS</span>
            </div>
            <div className={cn(
              "font-mono text-lg font-black leading-none",
              isSuddenDeath ? "text-red-500" : "text-white"
            )}>
              {battleStatus === 'ended' ? "ENDED" : timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : "3:00"}
            </div>
            <div className="flex flex-col items-center gap-1 w-full">
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-lg font-black text-purple-400">{challengerScore.toLocaleString()}</span>
                <span className="text-[8px] font-bold text-white/30">SCORE</span>
                <span className="font-mono text-lg font-black text-emerald-400">{opponentScore.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-1 w-full">
                <span className="text-right text-[9px] font-bold uppercase tracking-wider text-purple-400 truncate">{challengerHostName || 'Player A'}</span>
                <span className="text-[8px] text-white/30">·</span>
                <span className="text-left text-[9px] font-bold uppercase tracking-wider text-emerald-400 truncate">{opponentHostName || 'Player B'}</span>
              </div>
            </div>
          </div>

          {/* Opponent Side */}
          <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pl-1 scrollbar-hide">
            {!isBroadcaster && (
              <button
                onClick={() => handleSideGiftClick('opponent')}
                className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
              >
                Gift Side B
              </button>
            )}
            <div className={`grid gap-2 ${getGridClass(opponentSlots.length)} h-full`}>
              {opponentSlots.map((slot, idx) => (
                <div key={`opponent-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <JailTimeHostTile side="opponent" isLosing={opponentLosing} onJailLock={onOpponentJailLock} onJailUnlock={onOpponentJailUnlock}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={opponentIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/50" size={48} />
                          <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="opponent"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/30" size={24} />
                          <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
        );
      })()}

      {/* Pre-battle countdown overlay */}
      {preBattleCountdown !== null && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div
            key={preBattleCountdown}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl font-black text-white mb-4"
          >
            {preBattleCountdown}
          </motion.div>
          <div className="text-lg text-white/70 font-bold">Preparing battle cameras...</div>
          <div className="mt-4 flex gap-4 text-xs">
            <span className={cameraCheckResults.challenger?.hasVideo ? 'text-green-400' : 'text-red-400'}>
              Challenger: {cameraCheckResults.challenger?.hasVideo ? '✅ Camera ready' : '❌ No camera'}
            </span>
            <span className={cameraCheckResults.opponent?.hasVideo ? 'text-green-400' : 'text-red-400'}>
              Opponent: {cameraCheckResults.opponent?.hasVideo ? '✅ Camera ready' : '❌ No camera'}
            </span>
          </div>
        </div>
      )}

      {<BattleAudioRenderer entries={remoteAudioEntries} />}
    </div>
  );
};

const MemoBattleArena = React.memo(BattleArena);

// --- Main Component ---

interface BattleViewProps {
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

export default function BattleView({ battleId, currentStreamId, viewerId, localTracks: passedLocalTracks, remoteUsers: _passedRemoteUsers, userIdToLiveKitIdentity, onReturnToStream, onToggleCamera: onToggleCameraProp, onToggleMic: onToggleMicProp }: BattleViewProps) {
  // Provide safe defaults to prevent ReferenceError if props are undefined
  const onToggleCamera = onToggleCameraProp || (() => {});
  const onToggleMic = onToggleMicProp || (() => {});
  // Track connection phases to avoid repeated renders from track events
  const [trackRevision, setTrackRevision] = useState(0);
  // Debounce track revision to prevent flashing from rapid track events
  const trackRevisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackRevisionRef = useRef(0);
  const [connectionPhase, setConnectionPhase] = useState<'idle' | 'connecting' | 'room-connected' | 'local-ready' | 'remote-ready'>('idle');
  const roomConnectedAtRef = useRef<number | null>(null);
  const preflightSetInBattleRef = useRef(false);
  
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

  // ── Channel diagnostics (dev only) ──
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

  // LiveKit setup - ALWAYS create a NEW connection to the battle room
  // Do NOT reuse the main broadcast room - we need a separate battle room connection
  useEffect(() => {
    // Skip if battle isn't ready yet
    if (!battle || !effectiveUserId || !resolvedBattleRole) return;

    // PHASE 3: If battleId changed, disconnect old room first
    const previousBattleId = previousBattleIdRef.current;
    if (previousBattleId !== battleId) {
      // BattleId changed — disconnect old room if exists
      if (battleRoomRef.current && previousBattleId !== null) {
        if (import.meta.env.DEV) {
          console.log('[BattleView] battleId changed, disconnecting old room:', previousBattleId, '→', battleId);
        }
        battleRoomRef.current.disconnect();
        battleRoomRef.current = null;
        connectedBattleIdRef.current = null;
        isConnectingRef.current = false;
      }
      previousBattleIdRef.current = battleId;
    }

    // PHASE 3: If already connected for this battleId and tracks are already published, skip
    if (connectedBattleIdRef.current === battleId && battleRoomRef.current && battleRoomRef.current.state === 'connected' && (hasPublishedTracksRef.current || !isBroadcaster)) {
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
          const maxConnectAttempts = 3;
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
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * connectAttempts));
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
          const maxConnectAttempts = 3;
          
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
                await new Promise(resolve => setTimeout(resolve, 1000 * connectAttempts));
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
        if (import.meta.env.DEV) console.log('[BattleView] ✅ Participant connected:', participant.identity, 'total:', prev.length + 1);
        return [...prev, participant];
      });
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
      // Track unsubscribed — also debounced
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
      console.log('[BattleView] Track published:', {
        trackKind: publication.kind,
        trackSid: publication.trackSid,
        trackSource: publication.source,
        participantIdentity: participant.identity,
      });
      // Don't trigger rerender on TrackPublished - wait for TrackSubscribed
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
  }, [battleId, effectiveUserId, resolvedBattleRole, isBroadcaster, effectiveLocalTracksKey]);

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

  const updateMyStreamBoxCount = async (newCount: number) => {
    if (!myStream || participantInfo?.role !== 'host') return;

    if (newCount < 1) {
      toast.warning('Cannot have less than 1 box.');
      return;
    }
    if (newCount > 6) {
      toast.warning('Maximum 6 boxes allowed.');
      return;
    }

    const prevStream = myStream;
    if (participantInfo.team === 'challenger') {
      setChallengerStream({ ...myStream, box_count: newCount });
    } else if (participantInfo.team === 'opponent') {
      setOpponentStream({ ...myStream, box_count: newCount });
    }

    try {
      const broadcastChannel = supabase.channel(`stream:${myStream.id}`);
      
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
        payload: { box_count: newCount, stream_id: myStream.id }
      });
      
      setTimeout(() => {
        supabase.removeChannel(broadcastChannel);
      }, 3000);
    } catch (broadcastErr) {
      console.warn('[BoxCount] Broadcast error (non-fatal):', broadcastErr);
    }

    const { error } = await supabase.rpc('set_stream_box_count', {
      p_stream_id: myStream.id,
      p_new_box_count: newCount
    });

    if (error) {
      toast.error('Failed to update box count.');
      if (participantInfo.team === 'challenger') {
        setChallengerStream(prevStream);
      } else if (participantInfo.team === 'opponent') {
        setOpponentStream(prevStream);
      }
    }
  };

  // Initialize battle
  useEffect(() => {
    const initBattle = async () => {
      try {
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

        // Retry DB query up to 3 times with short delays — handles race where battle row is being created
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
            // wait up to 1500ms for realtime to populate
            let found = false;
            const start = Date.now();
            while (!found && Date.now() - start < 1500) {
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
                setError('Battle not found');
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
          setError('Failed to load battle streams: ' + (streamsError?.message || 'Unknown error'));
          return;
        }

        const cStream = streams.find(s => s.id === resolvedBattle.challenger_stream_id);
        const oStream = streams.find(s => s.id === resolvedBattle.opponent_stream_id);
            
        if (!cStream) {
          setError('Challenger stream not found or not live.');
          return;
        }
        if (!oStream) {
          setError('Opponent stream not found or not live.');
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
          .select('user_id, role')
          .eq('battle_id', battleId);
        setParticipantSnapshots((participantData as Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>) || []);
      } catch (e) {
        console.error("[BattleView] Initialization error:", e);
        setError('Failed to initialize battle');
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


  // Stream updates — kept as minimal postgres_changes on streams table
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
          p_winner_stream_id: winnerStreamId
        });

        // Broadcast return_to_broadcast to all participants
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
            winnerStreamId
          }
        });
        setTimeout(() => supabase.removeChannel(returnChannel), 2000);
      } catch (e) {
        console.error('[BattleView] Stream ended handling error:', e);
      }

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

  // Fallback poll — 15s during active battle, 30s otherwise.
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


  // Timer Logic - 3 minutes with 10 second sudden death
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [showRematchOption, setShowRematchOption] = useState(false);

  const awardCrownToWinner = useCallback(async (winnerStreamId: string) => {
    try {
      // Award crown to winner using the existing function
      const { data, error } = await supabase.rpc('end_battle_with_rewards', {
        p_battle_id: battle.id,
        p_winner_stream_id: winnerStreamId
      });
      
      if (error) {
        console.error('Failed to award crown:', error);
        return;
      }
      
      if (data?.success && data?.crowns_awarded > 0) {
        toast.success(`Winner awarded ${data.crowns_awarded} crown(s)!`);
      }
    } catch (e) {
      console.error('Crown award error:', e);
    }
  }, [battle?.id]);

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
      let winner_id = null;
      if (battle.score_challenger > battle.score_opponent) {
        winner_id = challengerStream?.user_id;
      } else if (battle.score_opponent > battle.score_challenger) {
        winner_id = opponentStream?.user_id;
      }

      const isRandomQueueBattle = challengerStream?.battle_mode === 'random_queue' || opponentStream?.battle_mode === 'random_queue';
      const { data: endResult, error: endError } = isRandomQueueBattle
        ? await supabase.rpc('finish_random_battle', {
            p_battle_id: battle.id,
            p_end_reason: 'timer_expired',
          })
        : await supabase.rpc('end_battle_guarded', {
            p_battle_id: battle.id,
            p_winner_id: winner_id
          });

      if (endError || !endResult?.success) {
        // If the guarded RPC fails (e.g., timer mismatch), force-end the battle directly
        console.warn('[BattleView] end_battle_guarded failed, force-ending battle:', endResult?.message || endError?.message);
        
        // Force update the battle status in the database
        await supabase
          .from('battles')
          .update({ 
            status: 'ended',
            ended_at: new Date().toISOString(),
            winner_id: winner_id
          })
          .eq('id', battle.id);
        
        // Update local state
        setBattle((prev: any) => prev ? { ...prev, status: 'ended', winner_id } : prev);
        setShowResults(true);
        
        // Record family activity for winner and loser
        if (winner_id === user?.id) {
          await recordBattleWon(battle.id, currentStreamId);
        } else if (winner_id !== null) {
          // Current user lost
          await recordBattleLost(battle.id, currentStreamId);
        }
        
        // Still try to distribute winnings
        try {
          await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        } catch (payoutErr) {
          console.warn('[BattleView] Payout failed after force-end:', payoutErr);
        }
        
        toast.success('Battle Ended!');
        return;
      }

      // Record family activity for winner and loser
      if (winner_id === user?.id) {
        await recordBattleWon(battle.id, currentStreamId);
      } else if (winner_id !== null) {
        // Current user lost
        await recordBattleLost(battle.id, currentStreamId);
      }

      const { error: payoutError } = await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
      if (payoutError) toast.error("Battle ended but payout failed.");
      else toast.success(`Battle Ended! Winnings distributed.`);
    } catch (e) {
      console.error('[BattleView] endBattle error:', e);
      // Force-end as fallback
      try {
        await supabase
          .from('battles')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', battle.id);
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
      // The LiveKit room will handle cleanup when the user leaves the battle room
      // Note: We intentionally don't stop/close tracks or disconnect the room here
      // because the user is returning to their broadcast stream where these tracks are needed
      
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

  // Timer effect - server-authoritative from started_at/ends_at only.
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

        if (!hasEnded) {
          setHasEnded(true);
          // Award crown to winner
          if (battle.score_challenger > battle.score_opponent && challengerStream?.user_id) {
            awardCrownToWinner(challengerStream.user_id);
          } else if (battle.score_opponent > battle.score_challenger && opponentStream?.user_id) {
            awardCrownToWinner(opponentStream.user_id);
          }
          // Show rematch option for hosts
          if (participantInfo?.role === 'host') {
            setShowRematchOption(true);
          }
          endBattle(true);
        }
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [battle?.ends_at, battle?.started_at, battle?.status, battle?.score_challenger, battle?.score_opponent, participantInfo?.role, hasEnded, endBattle, awardCrownToWinner, arenaReadyAtMs, challengerStream?.user_id, opponentStream?.user_id]);

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

  // Return to stream handler - returns each broadcaster to their own stream
  // Also broadcasts to all participants to return to their respective broadcasts
  const handleReturnToStream = useCallback(async () => {
    if (hasHandledReturnRef.current) return;
    hasHandledReturnRef.current = true;
    setShowResults(false);
    setShowRematchOption(false);

    // Only disconnect the battle LiveKit room
    // Do NOT stop/close local tracks - they belong to the broadcaster's main stream
    // and are shared with BroadcastPage. Closing them here would kill the camera.
    if (livekitRoom) {
      livekitRoom.disconnect();
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

  const findRemoteByIdentity = (targetIdentity: string) => {
    const normalizedTarget = String(targetIdentity || '').replace(/-/g, '').toLowerCase();
    return remoteUsers?.find((u) => {
      const id = String(u.identity || '');
      const normalized = id.replace(/-/g, '').toLowerCase();
      return (
        id === targetIdentity ||
        normalized === normalizedTarget ||
        normalized.startsWith(normalizedTarget.substring(0, 8)) ||
        normalizedTarget.startsWith(normalized.substring(0, 8))
      );
    });
  };

  // Handle challenger video - use mapping to find remote user, or use local tracks for broadcaster
  const challengerUser = findRemoteByIdentity(challengerLiveKitIdentity) ||
    (challengerStream && effectiveUserId === challengerStream.user_id
      ? { videoTrack: battleLocalVideoTrack, audioTrack: battleLocalAudioTrack, isLocal: true }
      : null);

  // Handle opponent video - use mapping to find remote user, or use local tracks for broadcaster
  const opponentUser = findRemoteByIdentity(opponentLiveKitIdentity) ||
    (opponentStream && effectiveUserId === opponentStream.user_id
      ? { videoTrack: battleLocalVideoTrack, audioTrack: battleLocalAudioTrack, isLocal: true }
      : null);

  // Show connection status indicator
  const renderConnectionStatus = () => {
    if (connectionStatus === 'connecting') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-yellow-400 text-xs font-bold">Connecting...</span>
        </div>
      );
    } else if (connectionStatus === 'failed') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-red-400 text-xs font-bold">Connection Failed</span>
        </div>
      );
    } else if (connectionStatus === 'disconnected') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-red-400 text-xs font-bold">Disconnected</span>
        </div>
      );
    }
    return null;
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-0 bg-black text-red-500 gap-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white">Battle Error</h2>
        <span className="font-medium">{error}</span>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (loading || !battle || !challengerStream || !opponentStream) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-amber-500 gap-4" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Loader2 className="animate-spin" size={48} />
        <span className="font-black text-lg animate-pulse">Entering Battle Arena...</span>
        <span className="text-sm text-amber-400/60">Connecting to battle room</span>
      </div>
    );
  }

  const totalScore = (battle?.score_challenger || 0) + (battle?.score_opponent || 0);
  const challengerPercent = totalScore === 0 ? 50 : Math.round((battle?.score_challenger / totalScore) * 100);
  const opponentPercent = 100 - challengerPercent;
  const challengerSlotCount = Math.max(1, Math.min(challengerStream.box_count || 1, 6));
  const opponentSlotCount = Math.max(1, Math.min(opponentStream.box_count || 1, 6));

  return (
    <div className="fixed inset-0 overflow-hidden z-50 relative bg-black">
      {/* Header - Troll Battle Royale with Balance */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 md:px-6 py-2 md:py-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="text-white font-black text-lg">T</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-wide hidden sm:inline">Troll Battle Royale</h1>
        </div>
        
        {/* Crown & Coin Balance Display */}
        {effectiveUserId && (
          <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <div className="flex items-center gap-1.5">
              <Crown size={14} className="text-amber-400" />
              <span className="text-sm font-bold text-white">
                {(userCrowns ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Gem size={14} className="text-purple-400" />
              <span className="text-sm font-bold text-white">
                {(userTrollmonds ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Coins size={14} className="text-yellow-400" />
              <span className="text-sm font-bold text-white">
                {(userCoins ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400 text-sm font-bold">LIVE</span>
        </div>
        
        {/* Connection Status Indicator */}
        {renderConnectionStatus()}
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))] left-3 md:left-6 z-50 flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full border border-white/10 transition-all hover:scale-105"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium hidden sm:inline">Home</span>
      </button>

      {/* Main Content Container */}
        <div className="relative z-10 flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] min-h-0 pt-16 md:pt-16 overflow-hidden" style={{ paddingTop: 'max(4rem, calc(env(safe-area-inset-top) + 3.5rem))' }}>
          {/* Battle Arena - Shows all participants with scores */}
          <div className="flex-1 min-h-0 h-full flex items-stretch justify-stretch px-1 md:px-2 pb-0 pr-0 lg:pr-80 pl-0 lg:pl-20 overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="relative flex w-full h-full min-h-0 items-start justify-center overflow-hidden">
              {/* Battle Arena */}
              <MemoBattleArena
                onGift={handleGiftSelect}
                battleId={battleId}
                localAudioTrack={battleLocalAudioTrack}
                localVideoTrack={battleLocalVideoTrack}
                localIsCameraEnabled={isCameraEnabled}
                localIsMicEnabled={isMicEnabled}
                remoteUsers={remoteUsers}
                trackRevision={trackRevision}
                challengerStreamId={challengerStream.id}
                opponentStreamId={opponentStream.id}
                challengerHostId={challengerStream.user_id}
                opponentHostId={opponentStream.user_id}
                challengerHostName={challengerStream.title}
                opponentHostName={opponentStream.title}
                challengerBoxCount={challengerStream.box_count || 1}
                opponentBoxCount={opponentStream.box_count || 1}
                challengerScore={battle?.score_challenger || 0}
                opponentScore={battle?.score_opponent || 0}
                challengerCrownInfo={challengerCrownInfo}
                opponentCrownInfo={opponentCrownInfo}
                isSuddenDeath={isSuddenDeath}
                onTrollOpponent={handleTrollOpponent}
                canTroll={isSuddenDeath && participantInfo?.role === 'host'}
                currentUserTeam={participantInfo?.team}
                userIdToLiveKitIdentity={userIdToLiveKitIdentity}
                
                currentUserProfile={profile}
                onOpenStaffActions={(participant) => {
                  const streamId = participant.sourceStreamId ||
                    (participant.team === 'challenger' ? challengerStream.id : opponentStream.id);
                  window.dispatchEvent(new CustomEvent('trollcity:open-user-actions', {
                    detail: {
                      userId: participant.identity,
                      username: participant.name,
                      streamId,
                      battleId,
                      role: participant.role,
                      team: participant.team,
                      source: 'battle_box',
                    },
                  }));
                }}
                currentUserId={effectiveUserId}
                isBroadcaster={isBroadcaster}
                timeLeft={timeLeft}
                battleStatus={battle?.status}
              />

            </div>
          </div>

        {/* Progress Bar */}
        <div className="absolute top-14 md:top-16 left-0 w-full h-1 flex z-30 pointer-events-none">
          <div 
            className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500" 
            style={{ width: `${challengerPercent}%` }}
          />
          <div 
            className="h-full bg-gradient-to-l from-emerald-500 to-teal-500 transition-all duration-500" 
            style={{ width: `${opponentPercent}%` }}
          />
        </div>

        <MuteHandler streamId={challengerStream.id} />
        
        {/* Live Chat - desktop sidebar only to keep mobile battle feeds unobstructed */}
        <div className="hidden lg:block absolute top-16 right-0 bottom-0 w-80 pointer-events-none z-40">
          <div className="h-full pointer-events-auto">
            <BattleChat
              battleId={battleId}
              challengerStream={{ id: challengerStream.id, title: challengerStream.title, user_id: challengerStream.user_id }}
              opponentStream={{ id: opponentStream.id, title: opponentStream.title, user_id: opponentStream.user_id }}
              currentStreamId={currentStreamId}
              currentUserId={effectiveUserId}
              participantRole={participantInfo?.role}
            />
          </div>
        </div>

        {/* Host Controls - only show for non-random battles */}
        {!isRandomBattle && participantInfo?.role === 'host' && (battle?.status === 'active' || battle?.status === 'starting') && (
          <div className="absolute top-20 md:top-20 left-3 md:left-4 z-40 flex flex-col gap-2">
            <button
              onClick={handleLeaveBattle}
              disabled={leaveLoading}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-600/80 hover:bg-red-500 text-white border border-red-500/40 transition disabled:opacity-60 shadow-lg"
            >
              {leaveLoading ? 'Leaving...' : 'Forfeit'}
            </button>
          </div>
        )}

        {/* Battle End Overlay */}
        <AnimatePresence>
          {showResults && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-gradient-to-b from-zinc-900 to-black border-2 border-amber-500/50 p-6 md:p-8 rounded-3xl text-center max-w-md shadow-[0_0_60px_rgba(245,158,11,0.3)]"
              >
                <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500 mb-2 uppercase tracking-tighter italic">
                  Battle Ended
                </h2>
                <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent w-full my-4" />
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-zinc-300 font-mono px-4">
                    <span className="flex items-center gap-2">
                      {challengerCrownInfo.hasStreak && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
                      {challengerStream.title}
                    </span>
                    <span className="text-purple-400 font-bold text-lg">{battle.score_challenger.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300 font-mono px-4">
                    <span className="flex items-center gap-2">
                      {opponentCrownInfo.hasStreak && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
                      {opponentStream.title}
                    </span>
                    <span className="text-emerald-400 font-bold text-lg">{battle.score_opponent.toLocaleString()}</span>
                  </div>
                </div>

                {battle.status === 'ended' ? (
                  <div className="mb-6">
                    <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Winner</div>
                    {/* Check both winner_id and winner_stream_id for winner determination */}
                    {battle.winner_id === challengerStream.user_id || battle.winner_stream_id === challengerStream.id ? (
                      <div className="flex flex-col items-center gap-2">
                        {participantInfo?.team === 'challenger' ? (
                          <>
                            <div className="flex items-center justify-center gap-2 text-3xl font-black text-green-400">
                              <Crown size={32} className="text-yellow-400 fill-yellow-400" />
                              YOU WON!
                            </div>
                            <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
                              <Coins size={20} className="text-yellow-400" />
                              +{Math.round((battle.score_challenger || 0) * 0.1)} coins
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
                            <Crown size={24} className="text-yellow-400 fill-yellow-400" />
                            {challengerStream.title}
                          </div>
                        )}
                      </div>
                    ) : battle.winner_id === opponentStream.user_id || battle.winner_stream_id === opponentStream.id ? (
                      <div className="flex flex-col items-center gap-2">
                        {participantInfo?.team === 'opponent' ? (
                          <>
                            <div className="flex items-center justify-center gap-2 text-3xl font-black text-green-400">
                              <Crown size={32} className="text-yellow-400 fill-yellow-400" />
                              YOU WON!
                            </div>
                            <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
                              <Coins size={20} className="text-yellow-400" />
                              +{Math.round((battle.score_opponent || 0) * 0.1)} coins
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
                            <Crown size={24} className="text-yellow-400 fill-yellow-400" />
                            {opponentStream.title}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-2xl font-bold text-zinc-400">
                        It&apos;s a Draw!
                      </div>
                    )}
                    {(battle.winner_id === challengerStream.user_id && challengerCrownInfo.hasStreak) ||
                     (battle.winner_id === opponentStream.user_id && opponentCrownInfo.hasStreak) ? (
                      <div className="mt-2 text-amber-400 font-bold flex items-center justify-center gap-1">
                        <Flame size={16} className="fill-amber-400" />
                        WIN STREAK CONTINUES!
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mb-6 text-xl font-bold text-zinc-400 italic animate-pulse">Calculating Results...</div>
                )}

                <div className="text-sm text-zinc-500">
                  Choose rematch or return to stream.
                </div>

                {showRematchOption && participantInfo?.role === 'host' && (
                  <button
                    onClick={handleRematch}
                    className="mt-4 mr-2 px-6 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-full transition"
                  >
                    Rematch
                  </button>
                )}

                <button
                  onClick={handleReturnToStream}
                  className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-full transition"
                >
                  Return Now
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gift Tray */}
        {giftRecipientId && !isMobileViewport && (
          <GiftTray 
            key={giftRecipientId}
            onClose={() => {
              setGiftRecipientId(null);
              setGiftStreamId(null);
            }}
            recipientId={giftRecipientId}
            streamId={giftStreamId || currentStreamId}
            battleId={battleId}
          />
        )}

        {/* Mobile Bottom Action Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-around px-4 py-3">
            {/* Chat Button */}
            <button
              onClick={() => setShowMobileChat(true)}
              className="flex flex-col items-center gap-1 text-white hover:text-blue-400 transition-colors"
            >
              <div className="relative">
                💬
                {/* Chat notification dot */}
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              <span className="text-xs font-medium">Chat</span>
            </button>

            {/* Troll Button (only for hosts during sudden death) */}
            {participantInfo?.role === 'host' && isSuddenDeath && (
              <button
                onClick={() => {
                  const targetStreamId = participantInfo.team === 'challenger' ? opponentStream?.id : challengerStream?.id;
                  if (targetStreamId) {
                    handleTrollOpponent(targetStreamId);
                  }
                }}
                className="flex flex-col items-center gap-1 text-white hover:text-red-400 transition-colors"
              >
                <Skull size={20} />
                <span className="text-xs font-medium">Troll</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Gift Tray Overlay - only shown when a broadcaster box is clicked */}
        <AnimatePresence>
          {showMobileGiftTray && giftRecipientId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
              onClick={() => {
                setShowMobileGiftTray(false);
                setGiftRecipientId(null);
                setGiftStreamId(null);
              }}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Send Gift</h3>
                  <button
                    onClick={() => {
                      setShowMobileGiftTray(false);
                      setGiftRecipientId(null);
                      setGiftStreamId(null);
                    }}
                    className="text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <GiftTray
                  key={giftRecipientId}
                  onClose={() => {
                    setGiftRecipientId(null);
                    setGiftStreamId(null);
                    setShowMobileGiftTray(false);
                  }}
                  recipientId={giftRecipientId}
                  streamId={giftStreamId || currentStreamId}
                  battleId={battleId}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Chat Overlay */}
        <AnimatePresence>
          {showMobileChat && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
              onClick={() => setShowMobileChat(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                  <h3 className="text-lg font-bold text-white">Battle Chat</h3>
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="h-[60vh]">
                  <BattleChat
                    battleId={battleId}
                    challengerStream={{ id: challengerStream.id, title: challengerStream.title, user_id: challengerStream.user_id }}
                    opponentStream={{ id: opponentStream.id, title: opponentStream.title, user_id: opponentStream.user_id }}
                    currentStreamId={currentStreamId}
                    currentUserId={effectiveUserId}
                    participantRole={participantInfo?.role}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}