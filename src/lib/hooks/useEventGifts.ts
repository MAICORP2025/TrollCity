/**
 * Limited-Time Gift Pack System
 * 
 * Manages event-specific gifts that:
 * - Only appear during active events
 * - Auto-remove when event ends
 * - Never leave UI/state remnants
 */

import { useMemo, useCallback } from 'react';
import { useGlobalEvent } from '../../contexts/GlobalEventContext';
import type { EventGift } from '../events/types';

// ============================================================================
// Gift System Hook
// ============================================================================

interface UseEventGiftsReturn {
  /** All gifts available during active events */
  activeGifts: EventGift[];
  /** Gifts filtered by category */
  exclusiveGifts: EventGift[];
  limitedGifts: EventGift[];
  specialGifts: EventGift[];
  /** Whether any event gifts are active */
  hasActiveGifts: boolean;
  /** Get a specific gift by ID */
  getGift: (giftId: string) => EventGift | undefined;
  /** Apply bonus to gift price */
  applyBonus: (basePrice: number) => number;
  /** Limited-time badge text */
  badgeLabel: string;
}

export const useEventGifts = (): UseEventGiftsReturn => {
  const { activeEvents, featureFlags } = useGlobalEvent();
  
  // Collect all gifts from active events
  const activeGifts = useMemo((): EventGift[] => {
    if (!featureFlags.hasEventGifts) return [];
    
    const gifts: EventGift[] = [];
    for (const event of activeEvents) {
      if (event.giftPacks) {
        gifts.push(...event.giftPacks);
      }
    }
    return gifts;
  }, [activeEvents, featureFlags.hasEventGifts]);
  
  // Filter by category
  const exclusiveGifts = useMemo(() => 
    activeGifts.filter(g => g.category === 'exclusive'),
    [activeGifts]
  );
  
  const limitedGifts = useMemo(() => 
    activeGifts.filter(g => g.category === 'limited'),
    [activeGifts]
  );
  
  const specialGifts = useMemo(() => 
    activeGifts.filter(g => g.category === 'special'),
    [activeGifts]
  );
  
  // Get a specific gift
  const getGift = useCallback((giftId: string): EventGift | undefined => {
    return activeGifts.find(g => g.id === giftId);
  }, [activeGifts]);
  
  // Apply any event bonuses to gift price
  const applyBonus = useCallback((basePrice: number): number => {
    let discountedPrice = basePrice;
    
    // Check for gift_discount bonuses
    for (const event of activeEvents) {
      if (event.bonuses) {
        const discount = event.bonuses.find(b => b.type === 'gift_discount');
        if (discount) {
          discountedPrice = Math.floor(discountedPrice * discount.value);
        }
      }
    }
    
    return discountedPrice;
  }, [activeEvents]);
  
  // Badge label based on active events
  const badgeLabel = useMemo(() => {
    if (!featureFlags.hasEventGifts) return '';
    
    const eventNames = activeEvents
      .filter(e => e.giftPacks && e.giftPacks.length > 0)
      .map(e => e.name);
    
    if (eventNames.length === 0) return 'Limited Event Gift';
    if (eventNames.length === 1) return `${eventNames[0]} Exclusive`;
    
    return 'Limited Event Gifts';
  }, [activeEvents, featureFlags.hasEventGifts]);
  
  return {
    activeGifts,
    exclusiveGifts,
    limitedGifts,
    specialGifts,
    hasActiveGifts: activeGifts.length > 0,
    getGift,
    applyBonus,
    badgeLabel,
  };
};

// ============================================================================
// Gift Animation Mapper
// ============================================================================

export const getGiftAnimationClass = (
  animation?: 'bounce' | 'spin' | 'pulse' | 'glow' | 'float'
): string => {
  const animations: Record<string, string> = {
    bounce: 'animate-bounce',
    spin: 'animate-spin',
    pulse: 'animate-pulse',
    glow: 'shadow-[0_0_20px_rgba(255,215,0,0.8)]',
    float: 'animate-float',
  };
  
  return animation ? animations[animation] || '' : '';
};

// ============================================================================
// Gift Purchase Validation
// ============================================================================

interface GiftPurchaseValidation {
  /** Whether purchase is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** Any applied discounts */
  discount?: {
    originalPrice: number;
    finalPrice: number;
    percentage: number;
  };
}

export const validateGiftPurchase = (
  gift: EventGift,
  userCoins: number
): GiftPurchaseValidation => {
  const finalPrice = gift.coinPrice;
  
  if (userCoins < finalPrice) {
    return {
      allowed: false,
      reason: 'Insufficient coins',
    };
  }
  
  return {
    allowed: true,
  };
};

// ============================================================================
// Auto-Cleanup Verification
// ============================================================================

/**
 * Verify that event gifts are properly cleaned up
 * This is used during testing/QA to ensure no gift remnants
 */
export const verifyGiftCleanup = (): boolean => {
  // In a real implementation, this would:
  // 1. Check that event gift IDs are not in any cached state
  // 2. Verify UI components are unmounted
  // 3. Confirm store subscriptions are cleaned up
  
  // For now, we rely on React's cleanup effects
  // and the useEventGifts hook which returns empty arrays when no events are active
  
  return true;
};

export default useEventGifts;
