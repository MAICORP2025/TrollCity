export type EffectType = 'glass_crack' | 'screen_flash' | 'glitch' | 'fire_burst';
export type EffectTarget = 'page' | 'broadcast' | 'seat';

export interface ActiveEffect {
  id: string;
  type: EffectType;
  target: EffectTarget;
  durationMs: number;
  startedAt: number;
  seatId?: string;
  intensity?: number;
}

export interface GiftEffectConfig {
  giftId: string;
  effect: EffectType;
  target: EffectTarget;
  durationMs: number;
  barBoost: number;
}

export const GIFT_EFFECT_MAPPING: Record<string, GiftEffectConfig> = {
  'glass_breaker': {
    giftId: 'glass_breaker',
    effect: 'glass_crack',
    target: 'page',
    durationMs: 5000,
    barBoost: 20,
  },
  'troll_flame': {
    giftId: 'troll_flame',
    effect: 'fire_burst',
    target: 'broadcast',
    durationMs: 3000,
    barBoost: 15,
  },
  'city_surge': {
    giftId: 'city_surge',
    effect: 'screen_flash',
    target: 'page',
    durationMs: 2000,
    barBoost: 25,
  },
  'glitch_king': {
    giftId: 'glitch_king',
    effect: 'glitch',
    target: 'broadcast',
    durationMs: 4000,
    barBoost: 10,
  },
};

export interface CityHeatState {
  value: number;
  status: 'unstable' | 'normal' | 'hype';
}

export interface SeatHeatState {
  seatId: string;
  value: number;
}