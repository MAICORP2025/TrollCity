import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BroadcastTextPopupPayload } from '@/types/textPopup';
import { POPUP_STYLE_CONFIG } from '@/types/textPopup';
import { cn } from '@/lib/utils';

interface BroadcastTextPopupOverlayProps {
  popup: BroadcastTextPopupPayload | null;
  isBattleActive?: boolean;
  mobileSafe?: boolean;
}

export default function BroadcastTextPopupOverlay({
  popup,
  isBattleActive = false,
  mobileSafe = false,
}: BroadcastTextPopupOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (popup) {
      setVisible(true);
    } else {
      // Small delay to allow exit animation
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
  }, [popup]);

  if (!popup && !visible) return null;

  const styleConfig = POPUP_STYLE_CONFIG[popup?.style || 'default'];

  // Position: above bottom controls on mobile, centered on desktop
  const positionClasses = mobileSafe
    ? 'bottom-[18%] left-1/2 -translate-x-1/2 max-w-[90vw]'
    : isBattleActive
      ? 'top-[15%] left-1/2 -translate-x-1/2 max-w-[80vw] md:max-w-[60vw]'
      : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[80vw] md:max-w-[50vw]';

  return (
    <AnimatePresence mode="wait">
      {popup && (
        <motion.div
          key={popup.id}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={cn(
            'fixed z-[100] pointer-events-none',
            positionClasses,
          )}
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-3xl border backdrop-blur-xl',
              'px-6 py-4 md:px-8 md:py-5',
              'bg-gradient-to-br',
              styleConfig.bgGradient,
              styleConfig.borderColor,
              styleConfig.glowColor,
            )}
          >
            {/* Glow effect */}
            <div
              className={cn(
                'absolute inset-0 opacity-20',
                'bg-gradient-to-r from-transparent via-white/10 to-transparent',
                'animate-pulse',
              )}
            />

            {/* Content */}
            <div className="relative flex flex-col items-center gap-2 text-center">
              {/* Style icon */}
              <span className="text-2xl md:text-3xl" role="img" aria-label={popup.style}>
                {styleConfig.iconEmoji}
              </span>

              {/* Sender name */}
              {popup.sender_username && (
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                  {popup.sender_username}
                </p>
              )}

              {/* Message */}
              <p
                className={cn(
                  'text-base md:text-lg font-black leading-snug break-words',
                  styleConfig.textColor,
                  'max-w-[80vw] md:max-w-[40vw]',
                )}
              >
                {popup.message}
              </p>
            </div>

            {/* Bottom accent line */}
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 h-[2px]',
                'bg-gradient-to-r',
                popup.style === 'default' && 'from-cyan-400 via-blue-400 to-cyan-400',
                popup.style === 'urgent' && 'from-red-400 via-orange-400 to-red-400',
                popup.style === 'battle' && 'from-purple-400 via-pink-400 to-purple-400',
                popup.style === 'hype' && 'from-green-400 via-cyan-400 to-green-400',
              )}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
