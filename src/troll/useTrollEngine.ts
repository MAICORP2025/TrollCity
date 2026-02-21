import { useState, useEffect, useCallback } from 'react';

// Define rarity tiers
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

// Define troll event types
export type TrollEventType = 'TROLL_JUMPSCARE' | 'FAKE_BAN_SCREEN' | 'FAKE_VIRUS_SCAN' | 'FAKE_COIN_LOSS' | 'TROLL_COURT_SUMMONS';

// Define troll event interface
export interface TrollEvent {
  id: string;
  type: TrollEventType;
  rarity: Rarity;
  duration: number; // in milliseconds
}

// Define context interface
export interface TriggerTrollContext {
  context?: string;
  options?: {
    safe?: boolean;
  };
}

// Rarity probabilities
const RARITY_PROBABILITIES = {
  COMMON: 0.70,
  RARE: 0.20,
  EPIC: 0.09,
  LEGENDARY: 0.01,
};

// Event type probabilities by rarity
const EVENT_TYPE_PROBABILITIES: Record<Rarity, Array<{ type: TrollEventType; probability: number }>> = {
  COMMON: [
    { type: 'TROLL_JUMPSCARE', probability: 0.5 },
    { type: 'FAKE_BAN_SCREEN', probability: 0.3 },
    { type: 'TROLL_COURT_SUMMONS', probability: 0.2 },
  ],
  RARE: [
    { type: 'FAKE_VIRUS_SCAN', probability: 0.6 },
    { type: 'FAKE_COIN_LOSS', probability: 0.4 },
  ],
  EPIC: [
    { type: 'TROLL_COURT_SUMMONS', probability: 0.5 },
    { type: 'FAKE_BAN_SCREEN', probability: 0.3 },
    { type: 'TROLL_JUMPSCARE', probability: 0.2 },
  ],
  LEGENDARY: [
    { type: 'TROLL_COURT_SUMMONS', probability: 0.6 },
    { type: 'FAKE_COIN_LOSS', probability: 0.4 },
  ],
};

// Cooldown duration (2 minutes)
const COOLDOWN_DURATION = 2 * 60 * 1000;

// Safe contexts where trolls should not trigger
const SAFE_CONTEXTS = [
  'payment',
  'withdrawal',
  'wallet',
  'authentication',
  'moderation',
  'account_settings',
];

// Hook for triggering troll events
export const useTrollEngine = () => {
  const [lastTrollTime, setLastTrollTime] = useState<number>(0);
  const [isTrollActive, setIsTrollActive] = useState<boolean>(false);

  // Determine if a troll should be triggered based on probability and cooldown
  const shouldTriggerTroll = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTroll = now - lastTrollTime;

    // Check cooldown
    if (timeSinceLastTroll < COOLDOWN_DURATION) {
      return false;
    }

    // Roll probability (adjust based on rarity)
    const roll = Math.random();
    return roll < 0.1; // 10% chance to trigger (adjust as needed)
  }, [lastTrollTime]);

  // Select a random rarity based on probabilities
  const selectRarity = useCallback((): Rarity => {
    const roll = Math.random();
    let cumulative = 0;

    if (roll <= RARITY_PROBABILITIES.COMMON) return 'COMMON';
    cumulative += RARITY_PROBABILITIES.COMMON;
    if (roll <= cumulative + RARITY_PROBABILITIES.RARE) return 'RARE';
    cumulative += RARITY_PROBABILITIES.RARE;
    if (roll <= cumulative + RARITY_PROBABILITIES.EPIC) return 'EPIC';
    cumulative += RARITY_PROBABILITIES.EPIC;
    return 'LEGENDARY';
  }, []);

  // Select an event type based on rarity
  const selectEventType = useCallback((rarity: Rarity): TrollEventType => {
    const roll = Math.random();
    const events = EVENT_TYPE_PROBABILITIES[rarity];
    let cumulative = 0;

    for (const event of events) {
      cumulative += event.probability;
      if (roll <= cumulative) {
        return event.type;
      }
    }

    return events[0].type; // Fallback to first event
  }, []);

  // Create a new troll event
  const createTrollEvent = useCallback((): TrollEvent => {
    const rarity = selectRarity();
    const type = selectEventType(rarity);
    let duration = 3000; // Default duration

    // Adjust duration based on rarity and type
    if (rarity === 'LEGENDARY') {
      duration = 5000;
    } else if (rarity === 'EPIC') {
      duration = 4000;
    }

    if (type === 'FAKE_VIRUS_SCAN') {
      duration = rarity === 'LEGENDARY' ? 8000 : 5000;
    }

    return {
      id: `troll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      rarity,
      duration,
    };
  }, [selectRarity, selectEventType]);

  // Trigger a troll event
  const triggerTroll = useCallback((context?: string, options?: { safe?: boolean }) => {
    // Check if safe mode or safe context
    if (options?.safe || (context && SAFE_CONTEXTS.some(safeContext => 
      context.toLowerCase().includes(safeContext.toLowerCase())
    ))) {
      return null;
    }

    // Check if a troll is already active
    if (isTrollActive) {
      return null;
    }

    // Determine if we should trigger a troll
    if (!shouldTriggerTroll()) {
      return null;
    }

    // Create and return the troll event
    const event = createTrollEvent();
    setLastTrollTime(Date.now());
    setIsTrollActive(true);

    return event;
  }, [isTrollActive, shouldTriggerTroll, createTrollEvent]);

  // Set isTrollActive to false when event completes
  const completeTroll = useCallback(() => {
    setIsTrollActive(false);
  }, []);

  // Background troll trigger
  useEffect(() => {
    const startBackgroundTrolling = () => {
      const interval = setInterval(() => {
        // Random timer between 3-10 minutes
        const nextTrollDelay = (3 + Math.random() * 7) * 60 * 1000;

        const timeout = setTimeout(() => {
          // Trigger a random background troll
          if (!isTrollActive && shouldTriggerTroll()) {
            const event = createTrollEvent();
            setLastTrollTime(Date.now());
            setIsTrollActive(true);
            
            // Auto-complete the troll after duration
            setTimeout(() => {
              setIsTrollActive(false);
            }, event.duration);
          }
        }, nextTrollDelay);

        return timeout;
      }, 0);

      return interval;
    };

    const backgroundInterval = startBackgroundTrolling();

    return () => {
      clearInterval(backgroundInterval);
    };
  }, [isTrollActive, shouldTriggerTroll, createTrollEvent]);

  return {
    triggerTroll,
    completeTroll,
    isTrollActive,
  };
};
