import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { EntranceEffectConfig } from '../../lib/entranceEffects';
import GiftAnimationOverlay from './GiftAnimationOverlay';

interface BroadcastEffectsLayerProps {
  streamId: string;
}

interface ActiveEffect {
  id: string; // unique instance id
  username: string;
  effect: EntranceEffectConfig;
}

export default function BroadcastEffectsLayer({ streamId }: BroadcastEffectsLayerProps) {
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase.channel(`room:${streamId}`);

    channel
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // newPresences is an array of objects. Each object has a `user_id` and the data tracked.
        // The structure depends on how `track` was called.
        // In useViewerTracking: track({ user_id, username, ..., entrance_effect })
        
        newPresences.forEach((presence: any) => {
          if (presence.entrance_effect) {
             const effect = presence.entrance_effect as EntranceEffectConfig;
             const id = Math.random().toString(36).substring(7);
             
             setActiveEffects(prev => [...prev, {
                 id,
                 username: presence.username,
                 effect
             }]);

             // Remove after duration
             setTimeout(() => {
                 setActiveEffects(prev => prev.filter(e => e.id !== id));
             }, 5000); // 5 seconds duration
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[40]">
      <GiftAnimationOverlay streamId={streamId} />
      <AnimatePresence>
        {activeEffects.map(({ id, username, effect }) => (
          <EffectRenderer key={id} username={username} effect={effect} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function EffectRenderer({ username, effect }: { username: string, effect: EntranceEffectConfig }) {
  // Map rarity to colors
  const getRarityStyles = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'border-zinc-500/50 shadow-[0_0_30px_rgba(113,113,122,0.4)]';
      case 'Uncommon': return 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)]';
      case 'Rare': return 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.4)]';
      case 'Epic': return 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.4)]';
      case 'Legendary': return 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.4)]';
      default: return 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.4)]';
    }
  };

  const getRarityTextColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-zinc-300';
      case 'Uncommon': return 'text-green-300';
      case 'Rare': return 'text-blue-300';
      case 'Epic': return 'text-purple-300';
      case 'Legendary': return 'text-yellow-300';
      default: return 'text-purple-300';
    }
  };

  const rarityStyle = getRarityStyles(effect.rarity);
  const textColor = getRarityTextColor(effect.rarity);

  return (
    <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.5, filter: 'blur(10px)' }}
        transition={{ type: 'spring', damping: 15 }}
        className={`absolute bottom-32 left-8 flex items-center gap-4 bg-black/60 p-4 rounded-xl backdrop-blur-md border ${rarityStyle}`}
    >
        {/* Icon/Image */}
        <div className="text-4xl animate-bounce">
            {effect.icon || '👋'}
        </div>
        
        <div className="flex flex-col">
            <motion.span 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-white font-bold text-lg"
            >
                {username}
            </motion.span>
            <span className={`${textColor} text-sm font-medium uppercase tracking-wider`}>
                {effect.name}
            </span>
        </div>
        
        {/* Particle effects could go here */}
        <div className={`absolute inset-0 border-2 rounded-xl animate-pulse ${rarityStyle.split(' ')[0].replace('/50', '/30')}`} />
    </motion.div>
  );
}
