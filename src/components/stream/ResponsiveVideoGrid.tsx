import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Participant, LocalParticipant } from 'livekit-client';
import { useBroadcastLayout } from '../../hooks/useBroadcastLayout';
import VideoTile from '../broadcast/VideoTile';

interface ResponsiveVideoGridProps {
  participants: Participant[];
  localParticipant?: LocalParticipant;
  broadcasterId?: string;
  onLeaveSession?: () => void;
  joinPrice?: number;
}

export default function ResponsiveVideoGrid({ 
  participants, 
  localParticipant,
  broadcasterId,
  onLeaveSession,
  joinPrice = 0
}: ResponsiveVideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isLandscape, setIsLandscape] = useState(true);

  // Monitor container size
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        setIsLandscape(width > height);
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sort participants: Broadcaster first, then others
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.identity === broadcasterId) return -1;
      if (b.identity === broadcasterId) return 1;
      return 0;
    });
  }, [participants, broadcasterId]);

  const TOTAL_SLOTS = 6;
  
  const { tileStyles } = useBroadcastLayout(
    sortedParticipants,
    dimensions.width,
    dimensions.height,
    isLandscape,
    TOTAL_SLOTS
  );

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden bg-black/50"
    >
      {/* Render Slots */}
      {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
        const style = tileStyles[i];
        if (!style) return null;

        const p = sortedParticipants[i];

        if (p) {
          const isLocal = localParticipant && p.identity === localParticipant.identity;
          const isBroadcaster = p.identity === broadcasterId;

          return (
            <VideoTile
              key={p.identity}
              participant={p}
              isBroadcaster={isBroadcaster}
              isLocal={isLocal}
              onLeave={isLocal ? onLeaveSession : undefined}
              price={joinPrice}
              style={{
                ...style,
                position: 'absolute',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              } as React.CSSProperties}
            />
          );
        } else {
          // Empty Slot Placeholder
          return (
            <div
              key={`empty-${i}`}
              className="absolute bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center justify-center backdrop-blur-sm"
              style={{
                ...style,
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              } as React.CSSProperties}
            >
              <div className="text-white/20 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-2">
                 <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <span className="text-lg">+</span>
                 </div>
                 {i === 0 ? 'Broadcaster' : `Seat ${i + 1}`}
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}
