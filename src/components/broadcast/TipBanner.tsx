import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Gift } from 'lucide-react';
import { useTipBanner } from '@/hooks/useTipBanner';

export interface TipBannerData {
  id: string;
  username: string;
  giftName: string;
  giftIcon: string;
  amount: number;
  coinCost: number;
}

interface TipBannerProps {
  /** Stream ID to listen for gift events */
  streamId: string;
}

/**
 * TipBanner — displays animated tip banners when gifts are sent during a stream.
 * Each banner shows "username sent X giftName (coin amount)" for 4 seconds.
 * Banners queue up if multiple tips arrive simultaneously.
 *
 * Works for both viewer and broadcaster in HytroGaming.
 */
export function TipBanner({ streamId }: TipBannerProps) {
  const { activeTip } = useTipBanner(streamId);

  return (
    <AnimatePresence>
      {activeTip && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="pointer-events-none fixed left-1/2 top-4 z-[9999] -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-950/90 via-amber-900/85 to-orange-950/90 px-5 py-3 shadow-2xl shadow-amber-500/25 backdrop-blur-xl">
            {/* Animated gift icon */}
            <div className="relative">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20">
                <span className="text-xl">{activeTip.giftIcon}</span>
              </div>
              <div className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-[9px] font-black text-black">
                {activeTip.amount}
              </div>
            </div>

            {/* Text */}
            <div className="min-w-0">
              <p className="text-sm font-black text-amber-100">
                {activeTip.username}
              </p>
              <p className="flex items-center gap-1 text-xs font-bold text-amber-300/80">
                <Gift className="h-3 w-3" />
                sent {activeTip.giftName}
                {activeTip.coinCost > 0 && (
                  <span className="ml-1 flex items-center gap-0.5 text-amber-400">
                    <Coins className="h-3 w-3" />
                    {activeTip.coinCost * activeTip.amount}
                  </span>
                )}
              </p>
            </div>

            {/* Sparkle */}
            <span className="shrink-0 text-amber-400/60">✨</span>
          </div>

          {/* Progress bar — 4 second countdown */}
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 4, ease: 'linear' }}
            className="mt-1 h-0.5 origin-left rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TipBanner;
