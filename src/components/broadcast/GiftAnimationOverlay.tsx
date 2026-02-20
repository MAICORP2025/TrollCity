import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X } from 'lucide-react';
import { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { cn } from '../../lib/utils';

interface GiftAnimationOverlayProps {
  gifts: BroadcastGift[];
  onAnimationComplete?: (giftId: string) => void;
}

const HIGH_VALUE_THRESHOLD = 500; // Gifts >= 500 coins get full-screen animation
const ANIMATION_DURATION = 5000; // 5 seconds

export default function GiftAnimationOverlay({ gifts, onAnimationComplete }: GiftAnimationOverlayProps) {
  const [visibleGifts, setVisibleGifts] = useState<BroadcastGift[]>([]);

  useEffect(() => {
    if (gifts.length > 0) {
      // Filter for high-value gifts only for full-screen animations
      const highValueGifts = gifts.filter(g => g.amount >= HIGH_VALUE_THRESHOLD);
      
      if (highValueGifts.length > 0) {
        setVisibleGifts(prev => {
          // Add new high-value gifts that aren't already showing
          const existingIds = new Set(prev.map(g => g.id));
          const newGifts = highValueGifts.filter(g => !existingIds.has(g.id));
          return [...prev, ...newGifts];
        });
      }
    }
  }, [gifts]);

  // Auto-remove gifts after animation completes
  useEffect(() => {
    if (visibleGifts.length > 0) {
      const timer = setTimeout(() => {
        setVisibleGifts(prev => {
          const [first, ...rest] = prev;
          if (first) {
            onAnimationComplete?.(first.id);
          }
          return rest;
        });
      }, ANIMATION_DURATION);

      return () => clearTimeout(timer);
    }
  }, [visibleGifts, onAnimationComplete]);

  const dismissGift = (giftId: string) => {
    setVisibleGifts(prev => prev.filter(g => g.id !== giftId));
    onAnimationComplete?.(giftId);
  };

  return (
    <AnimatePresence>
      {visibleGifts.map((gift) => (
        <GiftAnimation
          key={gift.id}
          gift={gift}
          onDismiss={() => dismissGift(gift.id)}
        />
      ))}
    </AnimatePresence>
  );
}

// Individual gift animation component
function GiftAnimation({ gift, onDismiss }: { gift: BroadcastGift; onDismiss: () => void }) {
  const isEpic = gift.amount >= 2500;
  const isLegendary = gift.amount >= 5000;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
    >
      {/* Background overlay */}
      <div className={cn(
        "absolute inset-0",
        isLegendary ? "bg-gradient-to-br from-yellow-900/80 via-purple-900/60 to-black/90" :
        isEpic ? "bg-gradient-to-br from-purple-900/70 via-pink-900/50 to-black/80" :
        "bg-black/60"
      )} />

      {/* Particle effects for legendary/epic */}
      {isLegendary && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: window.innerHeight + 50,
                scale: 0 
              }}
              animate={{ 
                y: -50,
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
              className="absolute text-2xl"
            >
              {['✨', '⭐', '💫', '🌟'][Math.floor(Math.random() * 4)]}
            </motion.div>
          ))}
        </div>
      )}

      {/* Main gift animation */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.8 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Sender info */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-white text-xl font-bold drop-shadow-lg">
            {gift.sender_name || 'Someone'}
          </p>
          <p className="text-zinc-300">sent a gift!</p>
        </motion.div>

        {/* Gift icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            delay: 0.5 
          }}
          className={cn(
            "relative",
            isLegendary ? "text-9xl" : isEpic ? "text-8xl" : "text-7xl"
          )}
        >
          {/* Glow effect */}
          <div className={cn(
            "absolute inset-0 blur-3xl rounded-full",
            isLegendary ? "bg-yellow-500/50" : 
            isEpic ? "bg-purple-500/50" : 
            "bg-pink-500/30"
          )} />
          
          {/* Gift icon */}
          <motion.span
            className="relative z-10"
            animate={{ 
              y: [0, -20, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {gift.gift_icon || '🎁'}
          </motion.span>
        </motion.div>

        {/* Gift name */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6 }}
          className={cn(
            "px-8 py-3 rounded-2xl font-bold text-2xl",
            isLegendary && "bg-gradient-to-r from-yellow-500 to-orange-500 text-black",
            isEpic && "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
            !isLegendary && !isEpic && "bg-gradient-to-r from-pink-500 to-red-500 text-white"
          )}
        >
          {gift.gift_name}
        </motion.div>

        {/* Amount */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-2 text-yellow-400 text-3xl font-bold"
        >
          <span>{gift.amount.toLocaleString()}</span>
          <span>🪙</span>
        </motion.div>
      </motion.div>

      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 z-20 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors pointer-events-auto"
      >
        <X className="text-white" size={24} />
      </button>

      {/* Progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: ANIMATION_DURATION / 1000, ease: "linear" }}
        className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-500"
        style={{ transformOrigin: "left" }}
      />
    </motion.div>
  );
}

// Chat gift message component (for low-value gifts)
export function GiftChatMessage({ gift }: { gift: BroadcastGift }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
    >
      <Gift className="text-yellow-400" size={16} />
      <span className="text-sm">
        <span className="font-bold text-yellow-400">{gift.sender_name}</span>
        <span className="text-zinc-400"> sent </span>
        <span className="font-bold text-white">{gift.gift_icon} {gift.gift_name}</span>
        {gift.amount > 0 && (
          <span className="text-yellow-400 ml-1">x{gift.amount}</span>
        )}
      </span>
    </motion.div>
  );
}
