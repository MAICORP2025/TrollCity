/**
 * ProfileFrame — Premium Animated Avatar Frame Component
 *
 * Renders an animated frame around a user's avatar.
 * Supports 12 animation types, particles, sparkles, energy rings.
 * Respects prefers-reduced-motion.
 * GPU-accelerated CSS animations for 60fps performance.
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ProfileFrame as ProfileFrameType, AnimationSpeed } from '../../config/profileFrames';
import { ANIMATION_DURATIONS, RARITY_COLORS } from '../../config/profileFrames';

// ─── Size Config ────────────────────────────────────────────────
export type FrameSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SizeConfig {
  container: number;
  borderWidth: number;
  fontSize: number;
  badgeSize: string;
  particleCount: number;
}

const SIZE_MAP: Record<FrameSize, SizeConfig> = {
  xs:  { container: 32,  borderWidth: 1.5, fontSize: 7,  badgeSize: 'text-[6px]',  particleCount: 2 },
  sm:  { container: 48,  borderWidth: 2,   fontSize: 9,  badgeSize: 'text-[8px]',  particleCount: 3 },
  md:  { container: 72,  borderWidth: 3,   fontSize: 11, badgeSize: 'text-[10px]', particleCount: 5 },
  lg:  { container: 96,  borderWidth: 4,   fontSize: 13, badgeSize: 'text-xs',     particleCount: 7 },
  xl:  { container: 128, borderWidth: 5,   fontSize: 15, badgeSize: 'text-sm',     particleCount: 9 },
};

// ─── Reduced Motion Hook ────────────────────────────────────────
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ─── Particle Component ─────────────────────────────────────────
function FrameParticle({
  color,
  index,
  total,
  size,
  disabled,
}: {
  color: string;
  index: number;
  total: number;
  size: number;
  disabled: boolean;
}) {
  const angle = (index / total) * 360;
  const radius = size / 2 + 4;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  const delay = index * 0.4;
  const duration = 2 + Math.random() * 1.5;
  const particleSize = 2 + Math.random() * 3;

  if (disabled) return null;

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: particleSize,
        height: particleSize,
        backgroundColor: color,
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        boxShadow: `0 0 4px ${color}, 0 0 8px ${color}80`,
        willChange: 'transform, opacity',
      }}
      animate={{
        opacity: [0, 0.9, 0],
        scale: [0.3, 1.1, 0.3],
        y: [0, -6, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Sparkle Component ──────────────────────────────────────────
function Sparkle({
  color,
  containerSize,
  index,
  disabled,
}: {
  color: string;
  containerSize: number;
  index: number;
  disabled: boolean;
}) {
  if (disabled) return null;

  const seed = index * 137.5;
  const angle = (seed % 360) * (Math.PI / 180);
  const radius = containerSize * 0.35 + (seed % 8);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const delay = index * 0.25;
  const size = 2 + (index % 3);

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        backgroundColor: '#fff',
        borderRadius: '50%',
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        boxShadow: `0 0 3px ${color}, 0 0 6px ${color}`,
        willChange: 'transform, opacity',
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, 1, 0],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 1.5,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Energy Ring Component ──────────────────────────────────────
function EnergyRing({
  color,
  containerSize,
  index,
  disabled,
}: {
  color: string;
  containerSize: number;
  index: number;
  disabled: boolean;
}) {
  if (disabled) return null;

  const inset = -(4 + index * 6);
  const delay = index * 0.6;

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        inset,
        border: `1px solid ${color}40`,
        boxShadow: `0 0 8px ${color}30, inset 0 0 8px ${color}15`,
        willChange: 'transform, opacity',
      }}
      animate={{
        opacity: [0.2, 0.6, 0.2],
        scale: [0.95, 1.05, 0.95],
        rotate: index % 2 === 0 ? [0, 360] : [360, 0],
      }}
      transition={{
        duration: 3 + index,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// ─── CSS Keyframe Generator ─────────────────────────────────────
function generateKeyframes(frame: ProfileFrameType): string {
  const dur = ANIMATION_DURATIONS[frame.animationSpeed];
  const id = frame.id;

  switch (frame.animationType) {
    case 'rainbow':
      return `
        @keyframes pf-rainbow-${id} {
          0%   { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
      `;
    case 'gold_shimmer':
      return `
        @keyframes pf-gold-shimmer-${id} {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `;
    case 'diamond_sparkle':
      return `
        @keyframes pf-diamond-${id} {
          0%, 100% { filter: brightness(1) hue-rotate(0deg); }
          25%      { filter: brightness(1.3) hue-rotate(15deg); }
          50%      { filter: brightness(1.1) hue-rotate(-10deg); }
          75%      { filter: brightness(1.4) hue-rotate(5deg); }
        }
      `;
    case 'neon_glow':
      return `
        @keyframes pf-neon-${id} {
          0%, 100% { filter: hue-rotate(0deg) brightness(1); }
          33%      { filter: hue-rotate(120deg) brightness(1.2); }
          66%      { filter: hue-rotate(240deg) brightness(1.1); }
        }
      `;
    case 'fire':
      return `
        @keyframes pf-fire-${id} {
          0%, 100% { filter: hue-rotate(0deg) brightness(1.1) saturate(1.2); }
          25%      { filter: hue-rotate(-15deg) brightness(1.3) saturate(1.4); }
          50%      { filter: hue-rotate(10deg) brightness(1.2) saturate(1.3); }
          75%      { filter: hue-rotate(-10deg) brightness(1.4) saturate(1.5); }
        }
      `;
    case 'ice':
      return `
        @keyframes pf-ice-${id} {
          0%, 100% { filter: hue-rotate(0deg) brightness(1.1) saturate(0.8); }
          50%      { filter: hue-rotate(20deg) brightness(1.3) saturate(1); }
        }
      `;
    case 'electric':
      return `
        @keyframes pf-electric-${id} {
          0%, 100% { opacity: 1; filter: brightness(1); }
          5%       { opacity: 0.85; filter: brightness(1.3); }
          10%      { opacity: 1; filter: brightness(1); }
          15%      { opacity: 0.7; filter: brightness(1.5); }
          20%      { opacity: 1; filter: brightness(1); }
          80%      { opacity: 1; filter: brightness(1); }
          85%      { opacity: 0.8; filter: brightness(1.4); }
          90%      { opacity: 1; filter: brightness(1); }
        }
      `;
    case 'galaxy':
      return `
        @keyframes pf-galaxy-${id} {
          0%   { filter: hue-rotate(0deg) brightness(1); }
          33%  { filter: hue-rotate(60deg) brightness(1.2); }
          66%  { filter: hue-rotate(-40deg) brightness(1.1); }
          100% { filter: hue-rotate(0deg) brightness(1); }
        }
      `;
    case 'crown':
      return `
        @keyframes pf-crown-${id} {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.3); }
        }
      `;
    case 'trophy':
      return `
        @keyframes pf-trophy-${id} {
          0%   { filter: brightness(1) hue-rotate(0deg); }
          50%  { filter: brightness(1.25) hue-rotate(10deg); }
          100% { filter: brightness(1) hue-rotate(0deg); }
        }
      `;
    case 'verified':
      return `
        @keyframes pf-verified-${id} {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.15); }
        }
      `;
    case 'founder':
      return `
        @keyframes pf-founder-${id} {
          0%   { filter: hue-rotate(0deg) brightness(1.1); }
          25%  { filter: hue-rotate(30deg) brightness(1.3); }
          50%  { filter: hue-rotate(-20deg) brightness(1.2); }
          75%  { filter: hue-rotate(15deg) brightness(1.4); }
          100% { filter: hue-rotate(0deg) brightness(1.1); }
        }
      `;
    case 'shimmer':
    default:
      return `
        @keyframes pf-shimmer-${id} {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `;
  }
}

// ─── Animation Style Builder ────────────────────────────────────
function buildAnimationStyle(frame: ProfileFrameType): React.CSSProperties {
  const dur = ANIMATION_DURATIONS[frame.animationSpeed];
  const id = frame.id;

  const base: React.CSSProperties = {
    willChange: 'filter, background-position, opacity',
  };

  switch (frame.animationType) {
    case 'rainbow':
      return { ...base, animation: `pf-rainbow-${id} ${dur * 2}s linear infinite` };
    case 'gold_shimmer':
      return { ...base, animation: `pf-gold-shimmer-${id} ${dur}s linear infinite`, backgroundSize: '200% 100%' };
    case 'diamond_sparkle':
      return { ...base, animation: `pf-diamond-${id} ${dur}s ease-in-out infinite` };
    case 'neon_glow':
      return { ...base, animation: `pf-neon-${id} ${dur * 1.5}s linear infinite` };
    case 'fire':
      return { ...base, animation: `pf-fire-${id} ${dur * 0.8}s ease-in-out infinite` };
    case 'ice':
      return { ...base, animation: `pf-ice-${id} ${dur * 2}s ease-in-out infinite` };
    case 'electric':
      return { ...base, animation: `pf-electric-${id} ${dur * 0.6}s steps(1) infinite` };
    case 'galaxy':
      return { ...base, animation: `pf-galaxy-${id} ${dur * 3}s ease-in-out infinite` };
    case 'crown':
      return { ...base, animation: `pf-crown-${id} ${dur}s ease-in-out infinite` };
    case 'trophy':
      return { ...base, animation: `pf-trophy-${id} ${dur}s ease-in-out infinite` };
    case 'verified':
      return { ...base, animation: `pf-verified-${id} ${dur * 1.5}s ease-in-out infinite` };
    case 'founder':
      return { ...base, animation: `pf-founder-${id} ${dur}s linear infinite` };
    case 'shimmer':
    default:
      return { ...base, animation: `pf-shimmer-${id} ${dur}s linear infinite`, backgroundSize: '200% 100%' };
  }
}

// ─── Frame Border Renderer ──────────────────────────────────────
function FrameBorder({
  frame,
  size,
  animStyle,
  reducedMotion,
}: {
  frame: ProfileFrameType;
  size: SizeConfig;
  animStyle: React.CSSProperties;
  reducedMotion: boolean;
}) {
  const bw = size.borderWidth;
  const effectiveStyle = reducedMotion ? {} : animStyle;

  const glowShadow = frame.glowColor && frame.glowIntensity > 0
    ? `0 0 ${frame.glowIntensity * 10}px ${frame.glowColor}, 0 0 ${frame.glowIntensity * 20}px ${frame.glowColor}50, inset 0 0 ${frame.glowIntensity * 6}px ${frame.glowColor}20`
    : 'none';

  const gradient = frame.borderGradient || `linear-gradient(135deg, ${frame.borderColor}, ${frame.borderColor}88)`;

  // Static fallback for reduced motion
  if (reducedMotion) {
    return (
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `${bw}px solid ${frame.borderColor}`,
          boxShadow: glowShadow,
        }}
      />
    );
  }

  switch (frame.frameStyle) {
    case 'flat':
      return (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `${bw}px solid ${frame.borderColor}`,
            boxShadow: glowShadow,
            ...effectiveStyle,
          }}
        />
      );

    case 'beveled':
      return (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `${bw}px solid ${frame.borderColor}`,
            boxShadow: `${glowShadow}, inset 2px 2px 4px rgba(255,255,255,0.15), inset -2px -2px 4px rgba(0,0,0,0.25)`,
            ...effectiveStyle,
          }}
        />
      );

    case 'glowing':
      return (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `${bw}px solid ${frame.borderColor}`,
            boxShadow: glowShadow,
            ...effectiveStyle,
          }}
          animate={
            frame.glowIntensity > 0.4
              ? {
                  boxShadow: [
                    glowShadow,
                    `0 0 ${frame.glowIntensity * 16}px ${frame.glowColor}, 0 0 ${frame.glowIntensity * 32}px ${frame.glowColor}60`,
                    glowShadow,
                  ],
                }
              : {}
          }
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      );

    case 'animated':
      return (
        <>
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `${bw}px solid transparent`,
              background: `linear-gradient(#000, #000) padding-box, ${gradient} border-box`,
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: glowShadow,
              ...effectiveStyle,
            }}
          />
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `${Math.max(1, bw - 1)}px solid transparent`,
              background: `linear-gradient(#0000, #0000) padding-box, linear-gradient(90deg, transparent, ${frame.borderColor}60, transparent) border-box`,
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              animation: `pf-shimmer-${frame.id} ${ANIMATION_DURATIONS[frame.animationSpeed]}s linear infinite`,
              backgroundSize: '200% 100%',
            }}
          />
        </>
      );

    case 'premium':
    case 'legendary':
    default:
      return (
        <>
          {/* Main gradient border */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `${bw}px solid transparent`,
              background: `linear-gradient(#000, #000) padding-box, ${gradient} border-box`,
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: glowShadow,
              ...effectiveStyle,
            }}
          />
          {/* Shimmer overlay */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `${bw + 1}px solid transparent`,
              background: `linear-gradient(#0000, #0000) padding-box, linear-gradient(90deg, transparent, #fff4, transparent) border-box`,
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              animation: `pf-shimmer-${frame.id} ${ANIMATION_DURATIONS[frame.animationSpeed] * 0.75}s linear infinite`,
              backgroundSize: '200% 100%',
              opacity: 0.5,
            }}
          />
          {/* Outer glow ring */}
          {frame.glowIntensity > 0.5 && (
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                inset: -bw - 3,
                border: `1px solid ${frame.borderColor}25`,
                boxShadow: `0 0 ${frame.glowIntensity * 16}px ${frame.glowColor}25`,
              }}
              animate={{
                opacity: [0.2, 0.5, 0.2],
                scale: [1, 1.02, 1],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </>
      );
  }
}

// ─── Main ProfileFrame Component ────────────────────────────────
interface ProfileFrameProps {
  /** The frame to display */
  frame: ProfileFrameType | null;
  /** Avatar image URL */
  avatarUrl: string;
  /** Size preset */
  size?: FrameSize;
  /** Username for alt text */
  username?: string;
  /** Show level badge */
  showBadge?: boolean;
  /** Additional className for the container */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

export default function ProfileFrame({
  frame,
  avatarUrl,
  size = 'md',
  username = '',
  showBadge = false,
  className = '',
  onClick,
}: ProfileFrameProps) {
  const reducedMotion = useReducedMotion();
  const dims = SIZE_MAP[size];

  const keyframes = useMemo(
    () => (frame && !reducedMotion ? generateKeyframes(frame) : ''),
    [frame, reducedMotion]
  );

  const animStyle = useMemo(
    () => (frame && !reducedMotion ? buildAnimationStyle(frame) : {}),
    [frame, reducedMotion]
  );

  const particles = useMemo(() => {
    if (!frame || !frame.hasParticles || !frame.particleColor || reducedMotion) return null;
    const count = Math.min(frame.particleCount, dims.particleCount);
    return Array.from({ length: count }, (_, i) => (
      <FrameParticle
        key={`p-${i}`}
        color={frame.particleColor}
        index={i}
        total={count}
        size={dims.container}
        disabled={reducedMotion}
      />
    ));
  }, [frame, dims.container, dims.particleCount, reducedMotion]);

  const sparkles = useMemo(() => {
    if (!frame || !frame.hasSparkles || !frame.glowColor || reducedMotion) return null;
    const count = Math.min(6, Math.max(3, Math.floor(dims.container / 16)));
    return Array.from({ length: count }, (_, i) => (
      <Sparkle
        key={`s-${i}`}
        color={frame.glowColor!}
        containerSize={dims.container}
        index={i}
        disabled={reducedMotion}
      />
    ));
  }, [frame, dims.container, reducedMotion]);

  const energyRings = useMemo(() => {
    if (!frame || !frame.hasEnergyRings || !frame.glowColor || reducedMotion) return null;
    return Array.from({ length: 2 }, (_, i) => (
      <EnergyRing
        key={`r-${i}`}
        color={frame.glowColor!}
        containerSize={dims.container}
        index={i}
        disabled={reducedMotion}
      />
    ));
  }, [frame, dims.container, reducedMotion]);

  const rarityColor = frame ? RARITY_COLORS[frame.rarity] : null;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`} onClick={onClick}>
      {/* Inject CSS keyframes */}
      {keyframes && <style>{keyframes}</style>}

      <div
        className="relative flex items-center justify-center"
        style={{ width: dims.container, height: dims.container }}
      >
        {/* Particles behind */}
        {particles}

        {/* Avatar container */}
        <motion.div
          className="relative rounded-full overflow-hidden"
          style={{
            width: dims.container - dims.borderWidth * 2,
            height: dims.container - dims.borderWidth * 2,
          }}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <img
            src={avatarUrl}
            alt={username || 'Avatar'}
            className="w-full h-full object-cover rounded-full"
            draggable={false}
            loading="lazy"
          />

          {/* Frame border overlay */}
          {frame && (
            <FrameBorder
              frame={frame}
              size={dims}
              animStyle={animStyle}
              reducedMotion={reducedMotion}
            />
          )}
        </motion.div>

        {/* Sparkles in front */}
        {sparkles}

        {/* Energy rings */}
        {energyRings}
      </div>

      {/* Rarity badge */}
      {showBadge && frame && rarityColor && (
        <motion.div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: rarityColor.bg,
            border: `1px solid ${rarityColor.border}`,
          }}
          initial={{ y: 4, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <span
            className={`font-bold ${dims.badgeSize}`}
            style={{ color: rarityColor.text }}
          >
            {frame.icon} {frame.name}
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ─── Simplified Avatar Wrapper (for use in chat, lists, etc.) ───
interface AvatarWithFrameProps {
  frame: ProfileFrameType | null;
  avatarUrl: string;
  size?: FrameSize;
  username?: string;
  className?: string;
  onClick?: () => void;
}

export function AvatarWithFrame({
  frame,
  avatarUrl,
  size = 'sm',
  username,
  className,
  onClick,
}: AvatarWithFrameProps) {
  return (
    <ProfileFrame
      frame={frame}
      avatarUrl={avatarUrl}
      size={size}
      username={username}
      showBadge={false}
      className={className}
      onClick={onClick}
    />
  );
}
