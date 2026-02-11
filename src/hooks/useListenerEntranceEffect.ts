import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useConnectionState } from '@livekit/components-react';
import { getUserEntranceEffect } from '../lib/entranceEffects';

/**
 * Hook to trigger entrance effect for listeners only.
 * 
 * Requirements:
 * - Only trigger for listeners (non-host, non-guest, non-broadcaster)
 * - Trigger only after connection is confirmed (LiveKit Connected OR Mux onPlaying/onCanPlay)
 * - Play once per streamId per session using sessionStorage
 * - Never trigger on Home or other pages (only broadcast watch routes)
 * - Idempotent: play once per streamId, not on rerenders
 */
export function useListenerEntranceEffect({
  streamId,
  isHost,
  isGuest,
  canPublish,
  userId,
  username,
}: {
  streamId: string | null | undefined;
  isHost: boolean;
  isGuest: boolean;
  canPublish: boolean;
  userId: string | null | undefined;
  username?: string;
}) {
  const connectionState = useConnectionState();
  const isConnected = connectionState === 'connected';
  const hasPlayedRef = useRef(false);
  
  // Session storage key format: entrancePlayed:{streamId}
  const getStorageKey = (sid: string) => `entrancePlayed:${sid}`;

  // Initialize play state from sessionStorage on mount and streamId change
  useEffect(() => {
    if (streamId) {
      const key = getStorageKey(streamId);
      const alreadyPlayed = sessionStorage.getItem(key);
      hasPlayedRef.current = !!alreadyPlayed;
      console.log(`[ListenerEntrance] Stream ${streamId}, alreadyPlayed: ${!!alreadyPlayed}`);
    } else {
      hasPlayedRef.current = false;
    }
  }, [streamId]);

  const location = useLocation();

  // Guard: Only trigger inside broadcast/watch routes
  const isBroadcastPage = 
    location.pathname.includes('/broadcast/') ||
    location.pathname.includes('/watch/') ||
    location.pathname.includes('/stream/');

  const triggerEntrance = useCallback(async () => {
    // Guard: Not on broadcast page
    if (!isBroadcastPage) {
      console.log('[ListenerEntrance] Not triggering - not on broadcast page');
      return;
    }

    if (!streamId || !userId || hasPlayedRef.current) {
      console.log('[ListenerEntrance] Not triggering:', { hasStreamId: !!streamId, hasUserId: !!userId, hasPlayed: hasPlayedRef.current });
      return;
    }

    // Listener-only gating:
    // - NOT a host
    // - NOT a guest
    // - CANNOT publish (not on stage)
    if (isHost) {
      console.log('[ListenerEntrance] Not triggering - not a listener (host/guest/publisher)');
      return;
    }

    const key = getStorageKey(streamId);
    
    // Double-check sessionStorage before proceeding
    if (sessionStorage.getItem(key)) {
      hasPlayedRef.current = true;
      console.log('[ListenerEntrance] Already played this stream, skipping');
      return;
    }

    // Mark as played immediately to prevent duplicate triggers from any source
    sessionStorage.setItem(key, '1');
    hasPlayedRef.current = true;
    console.log(`[ListenerEntrance] Marked as played for stream ${streamId}`);

    try {
      const { effectKey } = await getUserEntranceEffect(userId);
      if (effectKey) {
        // Import the animation function dynamically to avoid circular imports
        const { playEntranceAnimation } = await import('../lib/entranceAnimations');
        await playEntranceAnimation(userId, effectKey);
        console.log(`🎪 Listener entrance effect triggered for user ${userId} in stream ${streamId}`);
      } else {
        console.log('[ListenerEntrance] No entrance effect found for user');
      }
    } catch (err) {
      console.error('Error triggering listener entrance effect:', err);
    }
  }, [streamId, userId, isHost, isGuest, canPublish, isBroadcastPage]);

  // Trigger when connection is confirmed and all conditions are met
  useEffect(() => {
    if (isConnected && streamId && !hasPlayedRef.current) {
      console.log(`[ListenerEntrance] Connected, triggering entrance for stream ${streamId}`);
      triggerEntrance();
    }
  }, [isConnected, streamId, triggerEntrance]);

  return {
    connectionState,
    isConnected,
    hasPlayed: hasPlayedRef.current,
  };
}

/**
 * Component that triggers listener entrance effect inside LiveKitRoom context.
 * Must be rendered inside <LiveKitRoom> to have access to connection state.
 */
export function ListenerEntranceEffect({
  streamId,
  isHost,
  isGuest,
  canPublish,
  userId,
  username,
}: {
  streamId: string | null | undefined;
  isHost: boolean;
  isGuest: boolean;
  canPublish: boolean;
  userId: string | null | undefined;
  username?: string;
}) {
  useListenerEntranceEffect({
    streamId,
    isHost,
    isGuest,
    canPublish,
    userId,
    username,
  });

  return null;
}
