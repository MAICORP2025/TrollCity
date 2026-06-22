/**
 * BroadcastFrame — Decorative border frame for live streams
 *
 * Wraps the entire broadcast layout as a decorative border.
 * Users can purchase and equip these frames from the Coin Store.
 * Each stream can have only one broadcast frame active.
 */

import React, { useMemo } from 'react';
import type { ProfileFrame } from '../../config/profileFrames';

interface BroadcastFrameProps {
  frame: ProfileFrame | null;
  children: React.ReactNode;
  className?: string;
}

export default function BroadcastFrame({ frame, children, className = '' }: BroadcastFrameProps) {
  const borderStyle = useMemo(() => {
    if (!frame) return null;
    
    if (frame.borderGradient) {
      return {
        borderImage: frame.borderGradient,
        borderWidth: 6,
      };
    }
    
    return {
      borderColor: frame.borderColor || '#fff',
      borderWidth: 3,
    };
  }, [frame]);

  const glowStyle = useMemo(() => {
    if (!frame?.glowColor || !frame?.glowIntensity) return null;
    
    return {
      boxShadow: `0 0 ${frame.glowIntensity * 12}px ${frame.glowColor}, 
                  0 0 ${frame.glowIntensity * 24}px ${frame.glowColor}40,
                  inset 0 0 ${frame.glowIntensity * 8}px ${frame.glowColor}20`,
    };
  }, [frame]);

  if (!frame) {
    return <>{children}</>;
  }

  return (
    <div
      className={`relative rounded-3xl border ${className}`}
      style={{
        ...borderStyle,
        ...glowStyle,
        ...(frame.borderGradient && {
          border: '6px solid transparent',
          backgroundClip: 'border-box',
        }),
      }}
    >
      {children}
    </div>
  );
}