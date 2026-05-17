import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { getGiftVisualConfig } from '../../lib/giftVisuals';

interface GiftAnimationOverlayProps {
  gifts?: BroadcastGift[];
  onAnimationComplete?: (giftId: string) => void;
  participantNames?: Record<string, string>;
}

type GiftOverlayItem = BroadcastGift & {
  animationKey: string;
  animationUrl?: string | null;
  animationType: string;
  durationMs: number;
  isFullscreen: boolean;
  rarity: string;
  soundUrl?: string | null;
  isPremium: boolean;
};

const getGiftPriority = (rarity: string) => {
  if (rarity === 'mythic') return 4;
  if (rarity === 'legendary') return 3;
  if (rarity === 'epic') return 2;
  if (rarity === 'rare') return 1;
  return 0;
};

const buildOverlayItem = (gift: BroadcastGift): GiftOverlayItem => {
  const config = getGiftVisualConfig({
    name: gift.gift_name,
    slug: gift.gift_slug,
    icon: gift.gift_icon,
    amount: gift.amount,
    animation_key: gift.animation_key,
    animation_type: gift.animation_type,
    animation_url: gift.animation_url,
    animation_duration_ms: gift.animation_duration_ms,
    sound_url: gift.sound_url,
    is_fullscreen: gift.is_fullscreen,
    rarity: gift.rarity,
  });

  return {
    ...gift,
    animationKey: gift.animation_key || config.animationKey,
    animationUrl: gift.animation_url || config.animationUrl,
    animationType: gift.animation_type || config.animationType,
    durationMs: gift.animation_duration_ms || config.durationMs,
    isFullscreen: gift.is_fullscreen ?? config.isFullscreen,
    rarity: gift.rarity || config.rarity,
    soundUrl: gift.sound_url || config.soundUrl,
    isPremium: (gift.amount || 0) >= 300,
  };
};

const createVideoSource = (animationKey?: string, currentUrl?: string | null) => {
  if (currentUrl) return currentUrl;
  if (!animationKey) return null;
  return `/gift-animations/${animationKey}.mp4`;
};

const getGiftDedupId = (gift: BroadcastGift) => {
  return gift.id || gift.gift_event_id || gift.event_id || gift.gift_id || gift.animation_key || '';
};

const clampDuration = (gift: GiftOverlayItem) => {
  return Math.min(Math.max(gift.animation_duration_ms || gift.durationMs || 3500, 0), 7000);
};

export default function GiftAnimationOverlay({
  gifts = [],
  onAnimationComplete,
  participantNames = {},
}: GiftAnimationOverlayProps) {
  const [queue, setQueue] = useState<GiftOverlayItem[]>([]);
  const [activeGift, setActiveGift] = useState<GiftOverlayItem | null>(null);
  const [videoSource, setVideoSource] = useState<string | null>(null);
  const [videoFallbackTried, setVideoFallbackTried] = useState(false);
  const seenGiftIdsRef = useRef<Set<string>>(new Set());
  const seenGiftTimersRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const newItems: GiftOverlayItem[] = gifts
      .map((gift) => {
        const dedupeId = getGiftDedupId(gift);
        if (!dedupeId || seenGiftIdsRef.current.has(dedupeId)) return null;
        seenGiftIdsRef.current.add(dedupeId);
        const timeoutId = window.setTimeout(() => {
          seenGiftIdsRef.current.delete(dedupeId);
          seenGiftTimersRef.current.delete(dedupeId);
        }, 30000);
        seenGiftTimersRef.current.set(dedupeId, timeoutId);
        return buildOverlayItem(gift);
      })
      .filter((item): item is GiftOverlayItem => item !== null);

    if (newItems.length === 0) return;

    setQueue((prev) => {
      const premiumItems = newItems.filter((item) => getGiftPriority(item.rarity) > 1);
      const normalItems = newItems.filter((item) => getGiftPriority(item.rarity) <= 1);
      return [...premiumItems, ...prev, ...normalItems];
    });
  }, [gifts]);

  useEffect(() => {
    if (activeGift || queue.length === 0) return;
    setActiveGift(queue[0]);
    setQueue((prev) => prev.slice(1));
  }, [activeGift, queue]);

  useEffect(() => {
    if (!activeGift) {
      setVideoSource(null);
      setVideoFallbackTried(false);
      return;
    }

    const source = createVideoSource(activeGift.animationKey, activeGift.animationUrl);
    setVideoSource(source);
    setVideoFallbackTried(false);
  }, [activeGift]);

  useEffect(() => {
    if (!activeGift || activeGift.isPremium) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      const id = activeGift.id;
      setActiveGift(null);
      if (id) onAnimationComplete?.(id);
    }, clampDuration(activeGift));

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [activeGift, onAnimationComplete]);

  const handlePremiumComplete = useCallback(() => {
    if (!activeGift) return;
    const id = activeGift.id;
    setActiveGift(null);
    if (id) onAnimationComplete?.(id);
  }, [activeGift, onAnimationComplete]);

  useEffect(() => {
    if (!activeGift || !activeGift.isPremium) return;
    if (!videoSource) {
      handlePremiumComplete();
    }
  }, [activeGift, videoSource, handlePremiumComplete]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      seenGiftTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      seenGiftTimersRef.current.clear();
      seenGiftIdsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!activeGift || !activeGift.soundUrl) return;
    const audio = new Audio(activeGift.soundUrl);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [activeGift]);

  const onVideoError = () => {
    if (!activeGift || !videoSource) return;
    if (!videoFallbackTried && activeGift.animationKey) {
      const fallbackSource = videoSource.endsWith('.mp4')
        ? `/gift-animations/${activeGift.animationKey}.webm`
        : `/gift-animations/${activeGift.animationKey}.mp4`;
      setVideoSource(fallbackSource);
      setVideoFallbackTried(true);
      return;
    }
    setVideoSource(null);
  };

  const senderName = participantNames[activeGift?.sender_id || ''] || activeGift?.sender_name || 'Someone';
  const giftName =
    activeGift?.gift_name ||
    activeGift?.gift_slug?.replace(/[-_]/g, ' ') ||
    activeGift?.animationKey ||
    'Gift';
  const activeGiftIcon = activeGift?.gift_icon || '🎁';

  if (!activeGift) return null;

  if (activeGift.isPremium) {
    return (
      <AnimatePresence>
        <motion.div
          key={activeGift.id || activeGift.animationKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none absolute inset-0 z-[80] overflow-hidden bg-black"
        >
          {videoSource ? (
            <video
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              src={videoSource}
              autoPlay
              playsInline
              muted
              onEnded={handlePremiumComplete}
              onError={onVideoError}
              preload="metadata"
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key={activeGift.id || activeGift.animationKey}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
        className="pointer-events-none absolute left-1/2 top-4 z-[80] -translate-x-1/2"
      >
        <div className="pointer-events-none rounded-full border border-white/15 bg-slate-950/90 px-5 py-3 shadow-2xl shadow-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3 text-sm text-white">
            <span className="text-2xl">{activeGiftIcon}</span>
            <div className="text-left">
              <div className="font-semibold">{senderName} sent {giftName}</div>
              {activeGift.amount ? (
                <div className="text-xs text-slate-400">{activeGift.amount.toLocaleString()} coins</div>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
