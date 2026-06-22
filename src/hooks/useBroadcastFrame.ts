/**
 * Hook to fetch the broadcast frame for a user's streams.
 * Broadcast frames are special profile frames that decorate the stream border.
 */

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProfileFrame } from '@/config/profileFrames';

const broadcastFrameCache = new Map<string, ProfileFrame | null>();

export function useBroadcastFrame(userId?: string | null): ProfileFrame | null {
  const [frame, setFrame] = useState<ProfileFrame | null>(() => {
    if (!userId) return null;
    return broadcastFrameCache.get(userId) ?? null;
  });
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setFrame(null);
      return;
    }

    if (broadcastFrameCache.has(userId)) {
      setFrame(broadcastFrameCache.get(userId) ?? null);
      return;
    }

    if (fetchedRef.current === userId) return;
    fetchedRef.current = userId;

    const fetchBroadcastFrame = async () => {
      try {
        // Check if user has equipped a broadcast frame
        const { data: userFrame, error } = await supabase
          .from('user_profile_frames')
          .select('frame_id')
          .eq('user_id', userId)
          .eq('is_equipped', true)
          .maybeSingle();

        if (error || !userFrame?.frame_id) {
          broadcastFrameCache.set(userId, null);
          return;
        }

        // Fetch frame details
        const { data: frameRow } = await supabase
          .from('profile_frames')
          .select('*')
          .eq('id', userFrame.frame_id)
          .eq('is_active', true)
          .maybeSingle();

        if (frameRow && frameRow.frame_type === 'broadcast') {
          const broadcastFrame: ProfileFrame = {
            id: frameRow.id,
            name: frameRow.name,
            description: frameRow.description || '',
            icon: frameRow.icon || '✨',
            animationType: frameRow.animation_type,
            frameStyle: frameRow.frame_style || 'flat',
            borderColor: frameRow.border_color || '#ffffff',
            borderGradient: frameRow.border_gradient || null,
            glowColor: frameRow.glow_color || null,
            glowIntensity: frameRow.glow_intensity ?? 1,
            animationSpeed: frameRow.animation_speed || 'normal',
            hasParticles: frameRow.has_particles ?? false,
            particleColor: frameRow.particle_color || null,
            particleCount: frameRow.particle_count ?? 4,
            hasSparkles: frameRow.has_sparkles ?? false,
            hasEnergyRings: frameRow.has_energy_rings ?? false,
            rarity: frameRow.rarity || 'common',
            coinCost: frameRow.coin_cost ?? 0,
            isActive: frameRow.is_active ?? true,
            isLimited: frameRow.is_limited ?? false,
            limitedQuantity: frameRow.limited_quantity ?? null,
            sortOrder: frameRow.sort_order ?? 0,
            frameType: 'broadcast',
          };
          broadcastFrameCache.set(userId, broadcastFrame);
          setFrame(broadcastFrame);
        } else {
          broadcastFrameCache.set(userId, null);
        }
      } catch (err) {
        console.warn('[useBroadcastFrame] fetch failed:', err);
        broadcastFrameCache.set(userId, null);
      }
    };

    void fetchBroadcastFrame();
  }, [userId]);

  return frame;
}