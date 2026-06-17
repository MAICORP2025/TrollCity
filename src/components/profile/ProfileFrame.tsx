/**
 * ProfileFrame — Premium Animated Avatar Frame Component
 * 
 * Frame wraps AROUND the avatar image (border on outside edge).
 * Avatar is 100% visible inside. Frame never overlaps the image.
 * 
 * Layer order (bottom to top):
 *   1. Background effects (glow)
 *   2. Avatar image (fully visible)
 *   3. Frame border (on outside edge)
 *   4. Particles / Sparkles
 *   5. Badges
 */

import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ProfileFrame as ProfileFrameType, AnimationSpeed } from '../../config/profileFrames';
import { ANIMATION_DURATIONS, RARITY_COLORS } from '../../config/profileFrames';

export type FrameSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface SizeConfig {
  avatar: number;
  borderWidth: number;
  fontSize: number;
  badgeSize: string;
  particleCount: number;
}

const SIZE_MAP: Record<FrameSize, SizeConfig> = {
  xs:  { avatar: 20,  borderWidth: 2, fontSize: 6,  badgeSize: 'text-[5px]',  particleCount: 2 },
  sm:  { avatar: 28,  borderWidth: 2, fontSize: 8,  badgeSize: 'text-[7px]',  particleCount: 3 },
  md:  { avatar: 40,  borderWidth: 3, fontSize: 10, badgeSize: 'text-[9px]',  particleCount: 4 },
  lg:  { avatar: 56,  borderWidth: 3, fontSize: 12, badgeSize: 'text-[10px]', particleCount: 5 },
  xl:  { avatar: 80,  borderWidth: 4, fontSize: 14, badgeSize: 'text-xs',     particleCount: 7 },
  xxl: { avatar: 104, borderWidth: 4, fontSize: 16, badgeSize: 'text-sm',     particleCount: 9 },
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

interface ProfileFrameProps {
  frame: ProfileFrameType | null;
  avatarUrl: string;
  size?: FrameSize;
  username?: string;
  showBadge?: boolean;
  className?: string;
  onClick?: () => void;
  /** If true, fills the parent container and auto-calculates sizes */
  fillParent?: boolean;
  /** Custom container size in pixels (overrides size prop) */
  containerSize?: number;
}

export default function ProfileFrame({
  frame,
  avatarUrl,
  size = 'md',
  username = '',
  showBadge = false,
  className = '',
  onClick,
  fillParent = false,
  containerSize: customContainerSize,
}: ProfileFrameProps) {
  const reducedMotion = useReducedMotion();
  const dims = SIZE_MAP[size];
  const containerSize = customContainerSize || (fillParent ? 0 : dims.avatar + dims.borderWidth * 2);
  const rarityColor = frame ? RARITY_COLORS[frame.rarity] : null;

  const glowStyle = frame?.glowColor && frame.glowIntensity > 0 && !reducedMotion
    ? `0 0 ${frame.glowIntensity * 8}px ${frame.glowColor}, 0 0 ${frame.glowIntensity * 16}px ${frame.glowColor}40`
    : 'none';

  // When fillParent, we use CSS to fill the container and calculate sizes
  if (fillParent) {
    const borderW = dims.borderWidth;
    return (
      <div
        className={`relative flex flex-col items-center gap-1 ${className}`}
        onClick={onClick}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Main container — fills parent */}
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Background glow */}
          {frame && glowStyle !== 'none' && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${frame.glowColor}30 0%, transparent 70%)`,
                filter: 'blur(4px)',
              }}
            />
          )}

          {/* Avatar — fills container minus border width */}
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: `calc(100% - ${borderW * 2}px)`,
              height: `calc(100% - ${borderW * 2}px)`,
            }}
          >
            <img
              src={avatarUrl}
              alt={username || 'Avatar'}
              className="w-full h-full object-cover rounded-full"
              draggable={false}
              loading="lazy"
            />
          </div>

          {/* Frame border — on outside edge */}
          {frame && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: `${borderW}px solid ${frame.borderColor}`,
                boxShadow: glowStyle,
              }}
            />
          )}

          {/* Shimmer */}
          {frame && !reducedMotion && frame.animationType === 'shimmer' && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none overflow-hidden"
              style={{ border: `${borderW}px solid transparent` }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, transparent, ${frame.borderColor}40, transparent)`,
                  backgroundSize: '200% 100%',
                  animation: `pf-shimmer ${ANIMATION_DURATIONS[frame.animationSpeed]}s linear infinite`,
                }}
              />
            </div>
          )}

          {/* Particles */}
          {frame && frame.hasParticles && frame.particleColor && !reducedMotion && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: dims.particleCount }).map((_, i) => {
                const angle = (i / dims.particleCount) * 360;
                const radius = 50 + 4;
                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;
                return (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: 3, height: 3,
                      backgroundColor: frame.particleColor,
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      boxShadow: `0 0 4px ${frame.particleColor}`,
                    }}
                    animate={{ opacity: [0, 0.8, 0], scale: [0.3, 1, 0.3] }}
                    transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                );
              })}
            </div>
          )}

          {/* Energy rings */}
          {frame && frame.hasEnergyRings && frame.glowColor && !reducedMotion && (
            <div className="absolute inset-0 pointer-events-none">
              {[0, 1].map((i) => (
                <motion.div
                  key={`ring-${i}`}
                  className="absolute rounded-full"
                  style={{ inset: -(4 + i * 6), border: `1px solid ${frame!.glowColor}30` }}
                  animate={{ opacity: [0.2, 0.5, 0.2], scale: [0.98, 1.02, 0.98] }}
                  transition={{ duration: 3 + i, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Badge */}
        {showBadge && frame && rarityColor && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: rarityColor.bg, border: `1px solid ${rarityColor.border}` }}
          >
            <span className={`font-bold ${dims.badgeSize}`} style={{ color: rarityColor.text }}>
              {frame.icon} {frame.name}
            </span>
          </div>
        )}

        <style>{`
          @keyframes pf-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}</style>
      </div>
    );
  }

  // Fixed size mode (original behavior)
  return (
    <div
      className={`relative flex flex-col items-center gap-1 ${className}`}
      onClick={onClick}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: containerSize, height: containerSize }}
      >
        {/* Background glow */}
        {frame && glowStyle !== 'none' && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${frame.glowColor}30 0%, transparent 70%)`,
              filter: 'blur(4px)',
            }}
          />
        )}

        {/* Avatar — fully visible, centered */}
        <div
          className="relative rounded-full overflow-hidden"
          style={{ width: dims.avatar, height: dims.avatar }}
        >
          <img
            src={avatarUrl}
            alt={username || 'Avatar'}
            className="w-full h-full object-cover rounded-full"
            draggable={false}
            loading="lazy"
          />
        </div>

        {/* Frame border — on outside edge */}
        {frame && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `${dims.borderWidth}px solid ${frame.borderColor}`,
              boxShadow: glowStyle,
            }}
          />
        )}

        {/* Shimmer */}
        {frame && !reducedMotion && frame.animationType === 'shimmer' && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none overflow-hidden"
            style={{ border: `${dims.borderWidth}px solid transparent` }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, transparent, ${frame.borderColor}40, transparent)`,
                backgroundSize: '200% 100%',
                animation: `pf-shimmer ${ANIMATION_DURATIONS[frame.animationSpeed]}s linear infinite`,
              }}
            />
          </div>
        )}

        {/* Particles */}
        {frame && frame.hasParticles && frame.particleColor && !reducedMotion && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: dims.particleCount }).map((_, i) => {
              const angle = (i / dims.particleCount) * 360;
              const radius = containerSize / 2 + 4;
              const x = Math.cos((angle * Math.PI) / 180) * radius;
              const y = Math.sin((angle * Math.PI) / 180) * radius;
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 3, height: 3,
                    backgroundColor: frame.particleColor,
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    boxShadow: `0 0 4px ${frame.particleColor}`,
                  }}
                  animate={{ opacity: [0, 0.8, 0], scale: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                />
              );
            })}
          </div>
        )}

        {/* Energy rings */}
        {frame && frame.hasEnergyRings && frame.glowColor && !reducedMotion && (
          <div className="absolute inset-0 pointer-events-none">
            {[0, 1].map((i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute rounded-full"
                style={{ inset: -(4 + i * 6), border: `1px solid ${frame!.glowColor}30` }}
                animate={{ opacity: [0.2, 0.5, 0.2], scale: [0.98, 1.02, 0.98] }}
                transition={{ duration: 3 + i, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Badge */}
      {showBadge && frame && rarityColor && (
        <div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: rarityColor.bg, border: `1px solid ${rarityColor.border}` }}
        >
          <span className={`font-bold ${dims.badgeSize}`} style={{ color: rarityColor.text }}>
            {frame.icon} {frame.name}
          </span>
        </div>
      )}

      <style>{`
        @keyframes pf-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
