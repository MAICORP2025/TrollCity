// AR Gift Tray - Shows AR gift history alongside regular gifts
// Integrates with the existing gift tray system

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useARGiftStore } from '../../stores/arGiftStore';
import { cn } from '../../lib/utils';

interface ARGiftTrayProps {
  maxVisible?: number;
  className?: string;
}

export default function ARGiftTray({
  maxVisible = 10,
  className,
}: ARGiftTrayProps) {
  const { giftHistory } = useARGiftStore();
  const visibleGifts = giftHistory.slice(0, maxVisible);

  if (visibleGifts.length === 0) return null;

  return (
    <div className={cn('space-y-1', className)}>
      <AnimatePresence mode="popLayout">
        {visibleGifts.map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
              'bg-gradient-to-r from-fuchsia-500/10 via-purple-500/5 to-transparent',
              'border border-fuchsia-500/10 hover:border-fuchsia-500/20'
            )}
          >
            <div className="relative">
              <span className="text-lg">{entry.giftIcon}</span>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-fuchsia-400 border border-fuchsia-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs text-fuchsia-400 font-medium">
                  AR
                </span>
                <span className="text-xs text-white font-medium truncate">
                  {entry.senderName}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 truncate">
                sent {entry.giftName}
              </div>
            </div>
            <div className="text-[10px] font-mono text-fuchsia-300">
              {entry.amount.toLocaleString()}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
