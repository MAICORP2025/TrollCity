import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';

import { Room, LocalAudioTrack, LocalVideoTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, RoomEvent, Track } from 'livekit-client';

import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { Loader2, Coins, User, MicOff, VideoOff, Plus, Minus, Crown, Flame, ArrowLeft, Skull, Gem, X } from 'lucide-react';
import { useCoins } from '../../lib/hooks/useCoins';
import useTrollFamilyActivity from '../../hooks/useTrollFamilyActivity';
import BattleChat from './BattleChat';
import MuteHandler from './MuteHandler';
import GiftTray from './GiftTray';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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

const logMux = (message: string, data?: any) => {
  console.log(`[Mux] ${message}`, data || '');
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

const BattleHlsFallbackPlayer = ({ hlsUrl }: { hlsUrl?: string | null }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);

  // Memoize Hls config to prevent reinitialization
  const hlsConfig = useMemo(() => ({
    enableWorker: true,
    lowLatencyMode: true,
    // Mobile-specific optimizations
    maxBufferLength: 10,
    maxMaxBufferLength: 20,
    levelLoadingMaxRetry: 3,
    levelLoadingMaxRetryTimeout: 2000,
    // iOS Safari specific
    startLevel: -1, // Auto quality
    // Android Chrome specific
    fragLoadingMaxRetry: 3,
    fragLoadingMaxRetryTimeout: 2000,
  }), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;
    logMux('Initializing Mux player', { hlsUrl });

    // Enhanced mobile attributes
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x5-video-player-type', 'h5'); // Android WeChat
    video.setAttribute('x5-video-player-fullscreen', 'true'); // Android WeChat
    video.setAttribute('x-webkit-airplay', 'allow'); // iOS AirPlay
    video.setAttribute('airplay', 'allow'); // iOS AirPlay
    video.muted = true;
    video.preload = 'metadata';

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const cleanupNative = () => {
      video.removeAttribute('src');
      try {
        video.load();
      } catch (_e) {}
    };

    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOSSafari = isIOS && isSafari;

    // Detect Android Chrome
    const isAndroid = /Android/.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (iOS Safari, modern Safari)
      video.src = hlsUrl;

      const tryPlay = () => {
        video.play().then(() => {
          setIsPlaying(true);
          setNeedsUserInteraction(false);
        }).catch(() => {
          setNeedsUserInteraction(true);
        });
      };

      // iOS Safari needs user interaction
      if (isIOSSafari) {
        setNeedsUserInteraction(true);
      } else {
        tryPlay();
      }

      return cleanupNative;
    }

    if (Hls.isSupported()) {
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        logMux('Mux manifest parsed, starting playback');
        video.play().then(() => {
          setIsPlaying(true);
          setNeedsUserInteraction(false);
        }).catch(() => {
          // Android Chrome may need user interaction
          if (isAndroid && isChrome) {
            setNeedsUserInteraction(true);
          }
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('[BattleHlsFallbackPlayer] HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover network error
              console.log('[BattleHlsFallbackPlayer] Network error, attempting recovery');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[BattleHlsFallbackPlayer] Media error, attempting recovery');
              hls.recoverMediaError();
              break;
            default:
              // Cannot recover
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        logMux('Destroying Mux player');
        hls.destroy();
        hlsRef.current = null;
      };
    }

    return cleanupNative;
  }, [hlsUrl, hlsConfig]);

  const handleUserInteraction = () => {
    const video = videoRef.current;
    if (video && needsUserInteraction) {
      video.play().then(() => {
        setIsPlaying(true);
        setNeedsUserInteraction(false);
      }).catch(console.error);
    }
  };

  return (
    <>
      <video
        ref={videoRef}
        className="w-full h-full object-cover bg-black pointer-events-none"
        autoPlay
        muted
        preload="auto"
        playsInline
        controls={false}
        onClick={handleUserInteraction}
      />
      {needsUserInteraction && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <button
            onClick={handleUserInteraction}
            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-4 py-2 rounded-full font-bold shadow-lg border border-purple-400/50"
          >
            ▶️ Tap to start battle video
          </button>
        </div>
      )}
    </>
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
      audioElement.playsInline = true;
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
  fallbackHlsUrl?: string | null;
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
// - viewers render Mux HLS only
// - the tile itself must stay clickable for gifts/mod actions
interface BattleParticipantTileProps extends BattleParticipant {
  side: 'challenger' | 'opponent';
  crownInfo?: CrownInfo;
  isSuddenDeath?: boolean;
  onTroll?: () => void;
  canTroll?: boolean;
  onTileClick?: () => void;
  isSingleHost?: boolean;
  fallbackHlsUrl?: string | null;
  playbackMode: 'livekit' | 'mux';
}

const BattleParticipantTile = ({
  identity,
  name,
  isLocal,
  videoTrack,
  isMicrophoneEnabled,
  metadata,
  role,
  side,
  crownInfo,
  isSuddenDeath,
  onTroll,
  canTroll,
  onTileClick,
  isSingleHost = false,
  fallbackHlsUrl,
  playbackMode,
}: BattleParticipantTileProps) => {
  const isHost = role === 'host' || metadata?.role === 'host';
  const shouldUseMux = playbackMode === 'mux';
  const isMicMuted = !isMicrophoneEnabled;
  const hasPlayableVideo = shouldUseMux ? !!fallbackHlsUrl : !!videoTrack || !!fallbackHlsUrl;

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

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[BattleParticipantTile] Rendering:', {
      identity,
      name,
      isHost,
      isSingleHost,
      hasLiveKitVideo: !!videoTrack,
      hasMuxFallback: !!fallbackHlsUrl,
      playbackMode,
      side,
    });
  }, [identity, isSingleHost, isHost, name, side, videoTrack, fallbackHlsUrl, playbackMode]);

  const containerBg = hasPlayableVideo ? 'bg-black' : 'bg-black/60';
  const containerClass = isSingleHost
    ? `relative w-full aspect-video md:h-full min-h-0 rounded-2xl overflow-hidden ${containerBg} transition-all duration-300`
    : `relative w-full aspect-video md:h-full min-h-0 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${side === 'challenger' ? 'border-cyan-400/60 shadow-[0_0_22px_rgba(34,211,238,0.24)]' : 'border-fuchsia-400/60 shadow-[0_0_22px_rgba(217,70,239,0.24)]'} ${containerBg} ${hasPlayableVideo ? '' : 'backdrop-blur-sm'}`;

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
          The explicit tap-to-start overlay inside the HLS player still uses a button. */}
      {shouldUseMux && fallbackHlsUrl ? (
        <div className="absolute inset-0 pointer-events-none">
          <BattleHlsFallbackPlayer hlsUrl={fallbackHlsUrl} />
        </div>
      ) : videoTrack ? (
        <div className="absolute inset-0 pointer-events-none">
          <LiveKitVideoPlayer videoTrack={videoTrack} isLocal={isLocal} />
        </div>
      ) : fallbackHlsUrl ? (
        <div className="absolute inset-0 pointer-events-none">
          <BattleHlsFallbackPlayer hlsUrl={fallbackHlsUrl} />
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90">
          <div className={cn(
            'rounded-full flex items-center justify-center border-2 mb-2 bg-white/5',
            isHost ? 'w-16 h-16 md:w-20 md:h-20 border-cyan-400/50' : 'w-12 h-12 md:w-14 md:h-14 border-white/20'
          )}>
            <User className="text-slate-400" size={isHost ? 32 : 24} />
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <VideoOff size={14} />
            <span>{isHost && shouldUseMux ? 'Waiting for Mux feed...' : 'Connecting video...'}</span>
          </div>
        </div>
      )}

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
          {isHost && shouldUseMux && (
            <span className="text-[8px] bg-black/50 border border-white/10 text-white/80 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              MUX
            </span>
          )}
        </div>

        {isMicMuted && !shouldUseMux && (
          <div className="bg-red-500 p-1.5 rounded-full shadow-lg">
            <MicOff size={12} className="text-white" />
          </div>
        )}
      </div>

      {onTileClick && (
        <div className="absolute bottom-2 left-2 z-20 pointer-events-none rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[10px] font-bold text-white/80 backdrop-blur-md">
          Tap for actions
        </div>
      )}
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
  challengerHostHlsUrl?: string | null;
  opponentHostHlsUrl?: string | null;
  challengerBoxCount?: number;
  opponentBoxCount?: number;
  challengerCrownInfo?: CrownInfo;
  opponentCrownInfo?: CrownInfo;
  isSuddenDeath?: boolean;
  onTrollOpponent?: (targetStreamId: string) => void;
  canTroll?: boolean;
  currentUserTeam?: 'challenger' | 'opponent' | null;
  userIdToLiveKitIdentity?: Record<string, string>;
  shouldUseMuxPlayback: boolean;
  currentUserProfile?: any;
  onOpenStaffActions?: (participant: BattleParticipant) => void;
  trackRevision: number;
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
  challengerHostHlsUrl,
  opponentHostHlsUrl,
  challengerBoxCount = 1,
  opponentBoxCount = 1,
  challengerCrownInfo,
  opponentCrownInfo,
  isSuddenDeath = false,
  onTrollOpponent,
  canTroll = false,
  currentUserTeam,
  userIdToLiveKitIdentity,
  shouldUseMuxPlayback,
  currentUserProfile,
  onOpenStaffActions,
}: BattleArenaProps) => {
  const { user } = useAuthStore();
  const lastKnownTrackRef = useRef<Record<string, { video?: RemoteVideoTrack; audio?: RemoteAudioTrack }>>({});
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
  
  useEffect(() => {
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
          // Skip if we already have this participant
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
            return participant.profile?.username || participant.username || 'Anonymous';
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

      // Viewers must not parse/subscribe to LiveKit RTC media tracks.
      // They render hosts through Mux HLS URLs only. This avoids mobile black screens,
      // autoplay edge cases, and video elements intercepting gift/mod-action taps.
      if (shouldUseMuxPlayback) {
        setBattleParticipants(participantsData);
        return;
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
          return participant.profile?.username || participant.username || 'You';
        };
        
        participantsData.push({
          identity: user.id,
          name: getUsername(localSupabaseParticipant) || user.user_metadata?.username || 'You',
          isLocal: true,
          videoTrack: localVideoTrack,
          audioTrack: localAudioTrack,
          // Use explicitly passed enabled state, fallback to track-based detection
          isMicrophoneEnabled: localIsMicEnabled ?? (localAudioTrack?.enabled ?? false),
          // Be more lenient with camera check - use explicit state if available, otherwise check track
          isCameraEnabled: localIsCameraEnabled ?? !!localVideoTrack,
          metadata: localMetadata,
          role: localSupabaseParticipant?.role,
          team: localSupabaseParticipant?.team,
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
            sid: p.sid,
            trackSid: p.trackSid,
            source: p.source,
            isSubscribed: p.isSubscribed,
            trackKind: p.kind,
            hasTrack: !!p.track,
            trackId: p.track?.id,
            trackSidFromTrack: p.track?.sid,
            // Use Track.Source enum for proper comparison
            isCamera: p.source === Track.Source.Camera,
            isScreen: p.source === Track.Source.ScreenShare,
          });
        });

        audioPublications.forEach(p => {
          console.log('[BattleArena] Audio publication:', {
            sid: p.sid,
            trackSid: p.trackSid,
            source: p.source,
            isSubscribed: p.isSubscribed,
            trackKind: p.kind,
            hasTrack: !!p.track,
            trackId: p.track?.id,
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
          const allVideoPubs = remoteUser.trackPublications ?
            Array.from((remoteUser.trackPublications as any).values()) : [];
          videoPub = allVideoPubs.find((p: any) => p.track && p.kind === 'video' && p.source === Track.Source.Camera) ||
                    allVideoPubs.find((p: any) => p.track && p.kind === 'video');
        }

        if (!audioPub && isMobileDevice) {
          const allAudioPubs = remoteUser.trackPublications ?
            Array.from((remoteUser.trackPublications as any).values()) : [];
          audioPub = allAudioPubs.find((p: any) => p.track && p.kind === 'audio' && p.source === Track.Source.Microphone) ||
                    allAudioPubs.find((p: any) => p.track && p.kind === 'audio');
        }
        
        // Log what we found
        console.log('[BattleArena] Selected video publication:', {
          found: !!videoPub,
          sid: videoPub?.sid,
          trackSid: videoPub?.trackSid,
          hasTrack: !!videoPub?.track,
          trackSidFromTrack: videoPub?.track?.sid,
        });
        console.log('[BattleArena] Selected audio publication:', {
          found: !!audioPub,
          sid: audioPub?.sid,
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

        const videoPub = getTrackPublications(remote, 'video').find((p) => p.isSubscribed && p.track);
        const audioPub = getTrackPublications(remote, 'audio').find((p) => p.isSubscribed && p.track);

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
      }

      setBattleParticipants(participantsData);
      } catch (e) {
        console.error('[BattleArena] fetchParticipantData failed:', e);
      }
    };

    fetchParticipantData();
  }, [remoteUsers, battleId, trackRevision, userIdToLiveKitIdentity, challengerHostId, opponentHostId, shouldUseMuxPlayback]);

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
  const generateSlots = (team: 'challenger' | 'opponent') => {
    const teamData = categorized[team];
    const boxCount = Math.min(teamData.boxCount, 6);
    const slots: Array<{ type: 'host' | 'guest'; participant?: BattleParticipant | null; index?: number }> = [];
    
    // Always include host slot (can be empty)
    slots.push({ type: 'host', participant: teamData.host || null });
    
    // Generate guest slots based on box_count
    const guestSlots = Math.max(0, boxCount - 1);
    for (let i = 0; i < guestSlots; i++) {
      const guest = teamData.guests[i];
      slots.push({ type: 'guest', participant: guest || null, index: i + 1 });
    }

    // Mobile viewer layout: keep host slots visible even when the partner hasn't connected yet.
    if (isMobileLayout) {
      return slots.filter((slot) => slot.type === 'host' || !!slot.participant);
    }

    return slots;
  };

  const challengerSlots = generateSlots('challenger');
  const opponentSlots = generateSlots('opponent');

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

  // DEBUG: Log slot counts to diagnose single-host scenarios
  useEffect(() => {
    console.log('[BattleArena] Slot counts:', {
      challengerSlots: challengerSlots.length,
      opponentSlots: opponentSlots.length,
      challengerGuests: categorized.challenger.guests.length,
      opponentGuests: categorized.opponent.guests.length
    });
  }, [challengerSlots.length, opponentSlots.length, categorized.challenger.guests.length, categorized.opponent.guests.length]);

  // Determine if a side has only the host (no guests) - for single-host styling
  const challengerIsSingleHost = challengerSlots.length === 1 && challengerSlots[0]?.type === 'host';
  const opponentIsSingleHost = opponentSlots.length === 1 && opponentSlots[0]?.type === 'host';

  const getGridClass = (totalSlots: number) => {
    // Mobile-first: prioritize readability over density
    if (totalSlots === 1) return 'grid-cols-1 grid-rows-1';
    if (totalSlots === 2) return 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1'; // Stack vertically on mobile
    if (totalSlots === 3) return 'grid-cols-1 grid-rows-3 md:grid-cols-2 md:grid-rows-2'; // Single column on mobile
    if (totalSlots === 4) return 'grid-cols-2 grid-rows-2'; // 2x2 grid readable on mobile
    if (totalSlots === 5) return 'grid-cols-1 grid-rows-5 md:grid-cols-2 md:grid-rows-3'; // Single column on mobile
    if (totalSlots === 6) return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2'; // 2x3 on mobile, 3x2 on desktop
    return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2'; // Fallback
  };

  return (
    <div className="w-full h-full min-h-0 flex overflow-hidden p-2 md:p-4 gap-2 md:gap-4">
      {/* Challenger Side */}
      <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pr-1 scrollbar-hide">
        <button
          onClick={() => handleSideGiftClick('challenger')}
          className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white border border-purple-400/50 shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
        >
          Gift Side A
        </button>
        
        {/* Unified Grid for Host + Guests - match BroadcastGrid layout */}
        <div className={`grid gap-2 auto-rows-[minmax(200px,1fr)] md:auto-rows-fr ${getGridClass(challengerSlots.length)} h-full`}>
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
                    <BattleParticipantTile 
                      {...slot.participant} 
                      side="challenger" 
                      crownInfo={challengerCrownInfo}
                      isSuddenDeath={isSuddenDeath}
                      canTroll={canTroll && currentUserTeam === 'opponent'}
                      onTroll={() => handleTrollClick('challenger')}
                      onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                      isSingleHost={challengerIsSingleHost}
                      fallbackHlsUrl={challengerHostHlsUrl}
                      playbackMode={shouldUseMuxPlayback ? 'mux' : 'livekit'}
                    />
                  ) : (
                    challengerHostHlsUrl ? (
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
                        fallbackHlsUrl={challengerHostHlsUrl}
                        playbackMode={shouldUseMuxPlayback ? 'mux' : 'livekit'}
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
                      playbackMode={shouldUseMuxPlayback ? 'mux' : 'livekit'}
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

      {/* VS Divider */}
      <div className="w-px bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />

      {/* Opponent Side */}
      <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pl-1 scrollbar-hide">
        <button
          onClick={() => handleSideGiftClick('opponent')}
          className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
        >
          Gift Side B
        </button>
        
        {/* Unified Grid for Host + Guests - match BroadcastGrid layout */}
        <div className={`grid gap-2 auto-rows-[minmax(200px,1fr)] md:auto-rows-fr ${getGridClass(opponentSlots.length)} h-full`}>
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
                    <BattleParticipantTile 
                      {...slot.participant} 
                      side="opponent" 
                      crownInfo={opponentCrownInfo}
                      isSuddenDeath={isSuddenDeath}
                      canTroll={canTroll && currentUserTeam === 'challenger'}
                      onTroll={() => handleTrollClick('opponent')}
                      onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                      isSingleHost={opponentIsSingleHost}
                      fallbackHlsUrl={opponentHostHlsUrl}
                      playbackMode={shouldUseMuxPlayback ? 'mux' : 'livekit'}
                    />
                  ) : (
                    opponentHostHlsUrl ? (
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
                        fallbackHlsUrl={opponentHostHlsUrl}
                        playbackMode={shouldUseMuxPlayback ? 'mux' : 'livekit'}
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
                      playbackMode={shouldUseMuxPlayback ? 'mux' : 'livekit'}
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

      {!shouldUseMuxPlayback && <BattleAudioRenderer entries={remoteAudioEntries} />}
    </div>
  );
};

const MemoBattleArena = React.memo(BattleArena);

// --- Main Component ---

interface BattleViewProps {
  battleId: string;
  currentStreamId: string;
  viewerId?: string;
  localTracks?: [LocalAudioTrack, LocalVideoTrack] | null;
  remoteUsers?: RemoteParticipant[];
  userIdToLiveKitIdentity?: Record<string, string>;
  onReturnToStream?: () => void;
  challengerHlsUrl?: string | null;
  opponentHlsUrl?: string | null;
}

export default function BattleView({ battleId, currentStreamId, viewerId, localTracks: passedLocalTracks, remoteUsers: _passedRemoteUsers, userIdToLiveKitIdentity, onReturnToStream }: BattleViewProps) {
  // Track connection phases to avoid repeated renders from track events
  const [trackRevision, setTrackRevision] = useState(0);
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
  const { troll_coins: userCoins, crowns: userCrowns, trollmonds: userTrollmonds } = useCoins();
  
  // Family activity recording
  const { recordBattleWon, recordBattleLost, recordBattleJoined } = useTrollFamilyActivity();
  const hasRecordedBattleJoinedRef = useRef(false);
  
  // Explicitly track enabled state to ensure camera stays on during battle
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  
  // Local track state - used for publishing to battle room (managed by component, not hook)
  const [battleLocalAudioTrack, setBattleLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [battleLocalVideoTrack, setBattleLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [participantSnapshots, setParticipantSnapshots] = useState<Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>>([]);
  const [arenaReadyAtMs, setArenaReadyAtMs] = useState<number | null>(null);
  const [arenaReady, setArenaReady] = useState(false);
  const hasHandledReturnRef = useRef(false);
  const [challengerCrownInfo, setChallengerCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  const [opponentCrownInfo, setOpponentCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  
  const publishedArenaReadyRef = useRef(false);
  const isReusingRoomRef = useRef(false);
  const battleRoomRef = useRef<Room | null>(null); // FIX 1: Prevent double connection
  const isConnectingRef = useRef(false); // FIX 1: Track connection state
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const effectiveUserId = viewerId || user?.id;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const resolvedBattleRole = useMemo<'host' | 'stage' | 'viewer' | null>(() => {
    if (!effectiveUserId || !challengerStream || !opponentStream) return null;
    if (effectiveUserId === challengerStream.user_id || effectiveUserId === opponentStream.user_id) return 'host';
    if (participantInfo?.role === 'host' || participantInfo?.role === 'stage' || participantInfo?.role === 'viewer') {
      return participantInfo.role;
    }
    return 'viewer';
  }, [effectiveUserId, challengerStream?.user_id, opponentStream?.user_id, participantInfo?.role]);

  const isBroadcaster = resolvedBattleRole === 'host' || resolvedBattleRole === 'stage';
  const shouldUseMuxPlayback = !isBroadcaster;

  // Prefer tracks passed from BroadcastPage; fallback to PreflightStore when page refresh/race drops props.
  const localTracksFromPreflight = passedLocalTracks || PreflightStore.getTracks() || null;

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
        .single();

      const { data: opponentProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', opponentStream.user_id)
        .single();

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
    
    // FIX 1: Prevent double connection - check if already connected or connecting
    if (battleRoomRef.current && battleRoomRef.current.state === 'connected') {
      console.log('[BattleView] Already connected to battle room, skipping connection');
      return;
    }
    
    if (isConnectingRef.current) {
      console.log('[BattleView] Connection in progress, skipping');
      return;
    }
    
    // Always create a new room for battle - don't reuse existing room from PreflightStore
    console.log('[BattleView] Creating new battle room connection (battle-' + battle.id + ')');
    isConnectingRef.current = true;
    isReusingRoomRef.current = false;
    const client = new Room({ mode: 'rtc', codec: 'vp8' });
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
                  data.token,
                  { name: roomName }
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

          if (localTracksFromPreflight) {
            // Handle tracks independently - publish whatever is available
            if (localTracksFromPreflight[0]) {
              const audioTrack = cloneLocalTrackForBattle(localTracksFromPreflight[0], 'audio');
              if (audioTrack) {
                createdAudioTrack = audioTrack;
                setBattleLocalAudioTrack(audioTrack);
              } else {
                setBattleLocalAudioTrack(localTracksFromPreflight[0]);
              }
              setIsMicEnabled(true);
              const audioTrackToPublish = audioTrack || localTracksFromPreflight[0];
              if (audioTrackToPublish) {
                try {
                  // Pass trackName to ensure proper identification in battle room
                  await publishLocalTrack(audioTrackToPublish, { name: 'audio' }, 'audio');
                } catch (e) {
                  console.warn('[BattleView] Failed to publish audio track:', e);
                }
              }
            }
            if (localTracksFromPreflight[1]) {
              const videoTrack = cloneLocalTrackForBattle(localTracksFromPreflight[1], 'video');
              if (videoTrack) {
                createdVideoTrack = videoTrack;
                setBattleLocalVideoTrack(videoTrack);
              } else {
                setBattleLocalVideoTrack(localTracksFromPreflight[1]);
              }
              setIsCameraEnabled(true);
              const videoTrackToPublish = videoTrack || localTracksFromPreflight[1];
              if (videoTrackToPublish) {
                try {
                  // Pass trackName to ensure proper identification in battle room
                  await publishLocalTrack(videoTrackToPublish, { name: 'video' }, 'video');
                } catch (e) {
                  console.warn('[BattleView] Failed to publish video track:', e);
                }
              }
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
                data.token,
                { name: roomName }
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
      console.log('[BattleView] ✅ Participant connected:', participant.identity);
      setRemoteUsers(prev => {
        if (prev.some(p => p.identity === participant.identity)) {
          console.log('[BattleView] Participant already in list, skipping');
          return prev;
        }
        console.log('[BattleView] Adding new participant to list, total:', prev.length + 1);
        return [...prev, participant];
      });
    };

    // Handle participant disconnected
    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      console.log('[BattleView] ❌ Participant disconnected:', participant.identity);
      setRemoteUsers(prev => {
        const newList = prev.filter(p => p.identity !== participant.identity);
        console.log('[BattleView] Remaining participants:', newList.length);
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
      // ONLY increment trackRevision on TrackSubscribed to trigger participant selection
      setTrackRevision((v) => v + 1);
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
      // Track unsubscribed is less common; still increment to trigger reselection
      setTrackRevision((v) => v + 1);
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
        trackSid: publication.sid || publication.trackSid,
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
        trackSid: publication.sid || publication.trackSid,
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
      console.log('[BattleView] Connection state changed:', state);
      if (state === 'connected') {
        setConnectionStatus('connected');
        isRoomConnectedRef.current = true;
      } else if (state === 'disconnected') {
        setConnectionStatus('disconnected');
        isRoomDisconnectedRef.current = true;
      } else if (state === 'connecting' || state === 'reconnecting') {
        setConnectionStatus('connecting');
      }
    });

    joinBattle();

    return () => {
      mounted = false;
      isRoomDisconnectedRef.current = true;
      isConnectingRef.current = false; // FIX 1: Reset connecting flag on cleanup
      
      // FIX 5: Don't destroy connection mid-flow - only disconnect when explicitly leaving
      // Only disconnect if the component is truly unmounting (not just re-rendering)
      // The battleRoomRef check ensures we only clean up the room created by this effect
      if (battleRoomRef.current === client) {
        // Remove all listeners first to prevent events during cleanup
        client.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
        client.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        client.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        client.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        client.off(RoomEvent.TrackPublished, handleTrackPublished);
        client.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
        
        // Only stop tracks if they were created in this component (not passed in)
        if (createdAudioTrack) {
          console.log('[BattleView] Cleanup: stopping created audio track');
          createdAudioTrack.stop();
        }
        if (createdVideoTrack) {
          console.log('[BattleView] Cleanup: stopping created video track');
          createdVideoTrack.stop();
        }
        
        // Only disconnect if room is still connected - FIX 5: Don't destroy mid-flow
        if (client.state === 'connected') {
          console.log('[BattleView] Cleanup: disconnecting room');
          client.disconnect();
        }
        
        // Clear the ref
        battleRoomRef.current = null;
      }
      // Do NOT call PreflightStore.clear() - tracks belong to the main broadcast
      // clearTracks();
    };
  }, [battleId, battle, effectiveUserId, resolvedBattleRole, isBroadcaster]);

  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showMobileGiftTray, setShowMobileGiftTray] = useState(false);

  // Gift recipient state for battle mode
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftStreamId, setGiftStreamId] = useState<string | null>(null);

  // Remote users state - initialize as empty array, battle room participants are managed internally
  // Don't use passedRemoteUsers as those are from the main broadcast room, not the battle room
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);

  const handleGiftSelect = useCallback((uid: string, sourceStreamId: string) => {
    setGiftRecipientId(uid);
    setGiftStreamId(sourceStreamId);
  }, []);

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
        if (!preflightSetInBattleRef.current && !PreflightStore.getState().isInBattle) {
          PreflightStore.setInBattle(true);
          preflightSetInBattleRef.current = true;
          console.log('[BattleView] Set isInBattle = true');
        }
        
        const { data: battleData, error: battleError } = await supabase.from('battles').select('*').eq('id', battleId).maybeSingle();
        if (battleError || !battleData) {
          setError('Battle not found');
          return;
        }
        setBattle(battleData);

        if (battleData.status === 'ended') {
          setShowResults(true);
          setShowRematchOption(true);
        }

        const { data: streams, error: streamsError } = await supabase
          .from('streams')
          .select('*')
          .in('id', [battleData.challenger_stream_id, battleData.opponent_stream_id]);
            
        if (streamsError || !streams) {
          setError('Failed to load battle streams: ' + (streamsError?.message || 'Unknown error'));
          return;
        }

        const cStream = streams.find(s => s.id === battleData.challenger_stream_id);
        const oStream = streams.find(s => s.id === battleData.opponent_stream_id);
            
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

    const channel = supabase.channel(`battle:${battleId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${battleId}`
      }, (payload) => {
        logRealtime('Battle update received', payload.new);
        const newBattle = payload.new;
        setBattle(newBattle);
        if (newBattle.status === 'ended') {
          setShowResults(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Clear battle mode flag when leaving battle
      PreflightStore.setInBattle(false);
      preflightSetInBattleRef.current = false;
      console.log('[BattleView] Set isInBattle = false (cleanup)');
    };
  }, [battleId]);

  // Participants channel
  useEffect(() => {
    if (!battleId) return;
    const participantsChannel = supabase
      .channel(`battle_participants:${battleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` },
        async () => {
          logParticipants('Participants update received');
          const { data } = await supabase
            .from('battle_participants')
            .select('user_id, role')
            .eq('battle_id', battleId);
          setParticipantSnapshots((data as Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>) || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
    };
  }, [battleId]);

  // Arena ready channel
  useEffect(() => {
    if (!battleId) return;

    const arenaChannel = supabase.channel(`battle_arena:${battleId}`);
    arenaChannel
      .on('broadcast', { event: 'arena_ready' }, (payload) => {
        const readyAtMs = Number(payload?.payload?.ready_at_ms || 0);
        if (!readyAtMs || arenaReadyAtMs) return;
        setArenaReadyAtMs(readyAtMs);
        setArenaReady(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(arenaChannel);
    };
  }, [battleId, arenaReadyAtMs]);

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
        if (!hasAnyPublication) {
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

  // Stream updates
  useEffect(() => {
    if (!challengerStream?.id && !opponentStream?.id) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (challengerStream?.id) {
      const c = supabase.channel(`battle_stream_${challengerStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${challengerStream.id}` },
          (payload) => {
            setChallengerStream((prev) => prev ? { ...prev, ...(payload.new as Stream) } : (payload.new as Stream));
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
            setOpponentStream((prev) => prev ? { ...prev, ...(payload.new as Stream) } : (payload.new as Stream));
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
  }, [challengerStream?.id, opponentStream?.id]);

  // Keep battle state synchronized even if a realtime event is missed.
  useEffect(() => {
    if (!battleId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('battles')
          .select('*')
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
              return data;
            }
            return prev;
          });
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [battleId]);

  // Gift-driven refresh for instant side score updates across clients.
  useEffect(() => {
    if (!battleId || (!challengerStream?.id && !opponentStream?.id)) return;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const refetchBattle = async () => {
      const { data } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .maybeSingle();
      if (data) setBattle(data);
    };

    for (const sid of [challengerStream?.id, opponentStream?.id].filter(Boolean) as string[]) {
      const channel = supabase
        .channel(`battle-sync-gifts:${sid}`)
        .on('broadcast', { event: 'gift_sent' }, () => {
          refetchBattle();
        })
        .subscribe();
      channels.push(channel);
    }
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [battleId, challengerStream?.id, opponentStream?.id]);

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
        // CRITICAL: Update streams to clear battle state - this prevents redirect loop
        try {
          // Clear challenger stream's battle state
          if (challengerStream?.id) {
            await supabase.from('streams').update({
              is_battle: false,
              battle_id: null
            }).eq('id', challengerStream.id);
          }
          // Clear opponent stream's battle state
          if (opponentStream?.id) {
            await supabase.from('streams').update({
              is_battle: false,
              battle_id: null
            }).eq('id', opponentStream.id);
          }
          console.log('[BattleView] Cleared battle state from streams');
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
  useEffect(() => {
    if (!battleId) return;
    const ch = supabase
      .channel(`battle:${battleId}`)
      .on('broadcast', { event: 'return_to_broadcast' }, () => {
        if (hasHandledReturnRef.current) return;
        hasHandledReturnRef.current = true;
        setShowResults(false);
        setShowRematchOption(false);
        navigateBackToOwnBroadcast();
        onReturnToStream?.();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [battleId, navigateBackToOwnBroadcast, onReturnToStream]);

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
      <div className="flex flex-col items-center justify-center min-h-0 bg-black text-amber-500 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <span className="font-medium animate-pulse">Joining Battle Arena...</span>
      </div>
    );
  }

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

  const totalScore = (battle?.score_challenger || 0) + (battle?.score_opponent || 0);
  const challengerPercent = totalScore === 0 ? 50 : Math.round((battle?.score_challenger / totalScore) * 100);
  const opponentPercent = 100 - challengerPercent;
  const challengerSlotCount = Math.max(1, Math.min(challengerStream.box_count || 1, 6));
  const opponentSlotCount = Math.max(1, Math.min(opponentStream.box_count || 1, 6));

  // Use the userIdToLiveKitIdentity mapping from BroadcastPage to find video tracks
  // The mapping converts database user IDs to LiveKit identities
  const challengerLiveKitIdentity = userIdToLiveKitIdentity?.[challengerStream.user_id] || challengerStream.user_id;
  const opponentLiveKitIdentity = userIdToLiveKitIdentity?.[opponentStream.user_id] || opponentStream.user_id;
  
  if (import.meta.env.DEV) {
    console.log('[BattleView] User lookup - challenger stream:', challengerStream.user_id?.substring(0, 8), '-> livekit identity:', challengerLiveKitIdentity);
    console.log('[BattleView] User lookup - opponent stream:', opponentStream.user_id?.substring(0, 8), '-> livekit identity:', opponentLiveKitIdentity);
    console.log('[BattleView] Battle remoteUsers count:', remoteUsers?.length || 0);
    console.log('[BattleView] Local videoTrack:', !!battleLocalVideoTrack);
  }

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

  // Handle challenger video - use mapping to find remote user
  const challengerUser = findRemoteByIdentity(challengerLiveKitIdentity) ||
    (effectiveUserId === challengerStream.user_id
      ? { videoTrack: battleLocalVideoTrack }
      : null);

  // Handle opponent video - use mapping to find remote user
  const opponentUser = findRemoteByIdentity(opponentLiveKitIdentity) ||
    (effectiveUserId === opponentStream.user_id
      ? { videoTrack: battleLocalVideoTrack }
      : null);

  const resolveBattlePlaybackUrl = (streamRow: Stream | null): string | null => {
    if (!streamRow) return null;
    const hlsUrl = String((streamRow as any).hls_url || '').trim();
    if (hlsUrl) return hlsUrl;

    const muxPlaybackId = String(
      (streamRow as any).mux_playback_id ||
      (streamRow as any).muxPlaybackId ||
      (streamRow as any).playback_id ||
      ''
    ).trim();
    if (muxPlaybackId) return `https://stream.mux.com/${muxPlaybackId}.m3u8`;

    return null;
  };

  const challengerPlaybackUrl = resolveBattlePlaybackUrl(challengerStream);
  const opponentPlaybackUrl = resolveBattlePlaybackUrl(opponentStream);

  return (
    <div className="fixed inset-0 overflow-hidden z-50 relative bg-black">
      {/* Header - Troll Battle Royale with Balance */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 md:px-6 py-2 md:py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="text-white font-black text-lg">T</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-wide">Troll Battle Royale</h1>
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
        className="absolute top-4 md:top-5 left-3 md:left-6 z-50 flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full border border-white/10 transition-all hover:scale-105"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Home</span>
      </button>

      {/* Main Content Container */}
        <div className="relative z-10 flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] min-h-0 pt-16 overflow-hidden">
          {/* Battle Arena - Shows all participants with scores */}
          <div className="flex-1 min-h-0 h-full flex items-stretch justify-stretch px-1 md:px-2 pb-0 pr-0 lg:pr-80 pl-0 lg:pl-20 overflow-hidden">
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
                challengerHostHlsUrl={challengerPlaybackUrl}
                opponentHostHlsUrl={opponentPlaybackUrl}
                challengerBoxCount={challengerStream.box_count || 1}
                opponentBoxCount={opponentStream.box_count || 1}
                challengerCrownInfo={challengerCrownInfo}
                opponentCrownInfo={opponentCrownInfo}
                isSuddenDeath={isSuddenDeath}
                onTrollOpponent={handleTrollOpponent}
                canTroll={isSuddenDeath && participantInfo?.role === 'host'}
                currentUserTeam={participantInfo?.team}
                userIdToLiveKitIdentity={userIdToLiveKitIdentity}
                shouldUseMuxPlayback={shouldUseMuxPlayback}
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
              />

              {/* Global Battle Score Overlay */}
              <div className="pointer-events-none absolute left-1/2 bottom-2 md:bottom-3 z-50 -translate-x-1/2 bg-transparent w-fit h-fit max-w-[220px] md:max-w-[240px]">
                <div className={cn(
                  "w-fit max-w-[220px] md:max-w-[240px] flex flex-col items-center gap-1 rounded-xl border px-3 py-2 bg-neutral-950/80 backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.28)]",
                  isSuddenDeath
                    ? "border-red-500/45"
                    : "border-white/10"
                )}>
                  <span className={cn(
                    "text-sm font-black uppercase tracking-[0.14em] leading-none",
                    isSuddenDeath ? "text-red-400" : "text-amber-500"
                  )}>
                    {isSuddenDeath ? "SUDDEN DEATH" : `${challengerSlotCount}v${opponentSlotCount} BATTLE`}
                  </span>

                  <div className={cn(
                    "font-mono text-lg md:text-xl font-black leading-none",
                    isSuddenDeath ? "text-red-500" : "text-white"
                  )}>
                    {battle?.status === 'ended' ? "FINISHED" : battle?.started_at ? formatTime(timeLeft) : "SYNCING"}
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                    <span className="text-right text-xs font-bold uppercase tracking-[0.1em] text-purple-400 truncate max-w-[82px] md:max-w-[96px]">
                      {challengerStream.title || 'Player A'}
                    </span>
                    <span className="text-xs font-bold text-white/45">VS</span>
                    <span className="text-left text-xs font-bold uppercase tracking-[0.1em] text-emerald-400 truncate max-w-[82px] md:max-w-[96px]">
                      {opponentStream.title || 'Player B'}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                    <span className="text-right font-mono text-lg md:text-xl font-black leading-none text-purple-400">
                      {battle?.score_challenger?.toLocaleString() || 0}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide text-white/30">SCORE</span>
                    <span className="text-left font-mono text-lg md:text-xl font-black leading-none text-emerald-400">
                      {battle?.score_opponent?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </div>
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

        {/* Host Controls */}
        {participantInfo?.role === 'host' && (battle?.status === 'active' || battle?.status === 'starting') && (
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
            onClose={() => {
              setGiftRecipientId(null);
              setGiftStreamId(null);
            }}
            recipientId={giftRecipientId}
            streamId={giftStreamId || currentStreamId}
          />
        )}

        {/* Mobile Bottom Action Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10">
          <div className="flex items-center justify-around px-4 py-3">
            {/* Gift Button */}
            <button
              onClick={() => setShowMobileGiftTray(true)}
              className="flex flex-col items-center gap-1 text-white hover:text-purple-400 transition-colors"
            >
              <Gem size={20} />
              <span className="text-xs font-medium">Gift</span>
            </button>

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

        {/* Mobile Gift Tray Overlay */}
        <AnimatePresence>
          {showMobileGiftTray && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
              onClick={() => setShowMobileGiftTray(false)}
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
                    onClick={() => setShowMobileGiftTray(false)}
                    className="text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Quick gift options for mobile */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Challenger Side */}
                  <button
                    onClick={() => {
                      handleGiftSelect(challengerStream.user_id, challengerStream.id);
                      setShowMobileGiftTray(false);
                    }}
                    className="flex flex-col items-center gap-2 p-3 bg-purple-500/20 border border-purple-500/50 rounded-xl hover:bg-purple-500/30 transition-colors"
                  >
                    <User size={24} className="text-purple-400" />
                    <span className="text-xs font-medium text-white text-center">{challengerStream.title}</span>
                  </button>

                  {/* Opponent Side */}
                  <button
                    onClick={() => {
                      handleGiftSelect(opponentStream.user_id, opponentStream.id);
                      setShowMobileGiftTray(false);
                    }}
                    className="flex flex-col items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl hover:bg-emerald-500/30 transition-colors"
                  >
                    <User size={24} className="text-emerald-400" />
                    <span className="text-xs font-medium text-white text-center">{opponentStream.title}</span>
                  </button>

                  {/* Close */}
                  <button
                    onClick={() => setShowMobileGiftTray(false)}
                    className="flex flex-col items-center gap-2 p-3 bg-zinc-500/20 border border-zinc-500/50 rounded-xl hover:bg-zinc-500/30 transition-colors"
                  >
                    <X size={24} className="text-zinc-400" />
                    <span className="text-xs font-medium text-white">Cancel</span>
                  </button>
                </div>

                {/* Full GiftTray for selected recipient */}
                {giftRecipientId && (
                  <div className="mt-6">
                    <GiftTray
                      onClose={() => {
                        setGiftRecipientId(null);
                        setGiftStreamId(null);
                      }}
                      recipientId={giftRecipientId}
                      streamId={giftStreamId || currentStreamId}
                    />
                  </div>
                )}
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