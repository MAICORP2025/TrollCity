/**
 * Profile Frame System — Configuration & Types
 * Premium animated avatar frames for Troll City
 */

// ─── Types ──────────────────────────────────────────────────────
export type FrameRarity =
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'founder'
  | 'limited_edition';

export type AnimationType =
  | 'shimmer'
  | 'rainbow'
  | 'gold_shimmer'
  | 'diamond_sparkle'
  | 'neon_glow'
  | 'fire'
  | 'ice'
  | 'electric'
  | 'galaxy'
  | 'crown'
  | 'trophy'
  | 'verified'
  | 'founder'
  | null;

export type FrameStyle = 'flat' | 'beveled' | 'glowing' | 'animated' | 'premium' | 'legendary';

export type AnimationSpeed = 'slow' | 'normal' | 'fast';

export interface ProfileFrame {
  id: string;
  name: string;
  description: string;
  icon: string;
  animationType: AnimationType;
  frameStyle: FrameStyle;
  borderColor: string;
  borderGradient: string | null;
  glowColor: string | null;
  glowIntensity: number; // 0-2
  animationSpeed: AnimationSpeed;
  hasParticles: boolean;
  particleColor: string | null;
  particleCount: number;
  hasSparkles: boolean;
  hasEnergyRings: boolean;
  rarity: FrameRarity;
  coinCost: number;
  isActive: boolean;
  isLimited: boolean;
  limitedQuantity: number | null;
  sortOrder: number;
}

// ─── Rarity Colors ──────────────────────────────────────────────
export const RARITY_COLORS: Record<FrameRarity, { text: string; bg: string; border: string; glow: string }> = {
  common:         { text: '#9ca3af', bg: 'rgba(156,163,175,0.1)',  border: 'rgba(156,163,175,0.3)',  glow: 'rgba(156,163,175,0.2)' },
  rare:           { text: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)',   glow: 'rgba(59,130,246,0.2)' },
  epic:           { text: '#a855f7', bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.3)',   glow: 'rgba(168,85,247,0.25)' },
  legendary:      { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.3)',   glow: 'rgba(245,158,11,0.3)' },
  mythic:         { text: '#ec4899', bg: 'rgba(236,72,153,0.1)',   border: 'rgba(236,72,153,0.3)',   glow: 'rgba(236,72,153,0.3)' },
  founder:        { text: '#ff3366', bg: 'rgba(255,51,102,0.1)',   border: 'rgba(255,51,102,0.35)',  glow: 'rgba(255,51,102,0.35)' },
  limited_edition:{ text: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    border: 'rgba(6,182,212,0.35)',   glow: 'rgba(6,182,212,0.3)' },
};

export const RARITY_LABELS: Record<FrameRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
  founder: 'Founder',
  limited_edition: 'Limited Edition',
};

// ─── Animation Speed Map ────────────────────────────────────────
export const ANIMATION_DURATIONS: Record<AnimationSpeed, number> = {
  slow: 4,
  normal: 2.5,
  fast: 1.2,
};

// ─── Launch Collection ──────────────────────────────────────────
export const LAUNCH_FRAMES: ProfileFrame[] = [
  {
    id: 'pride_rainbow',
    name: 'Pride Rainbow',
    description: 'Animated flowing rainbow border celebrating pride and diversity',
    icon: '🏳️‍🌈',
    animationType: 'rainbow',
    frameStyle: 'premium',
    borderColor: '#ff0000',
    borderGradient: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)',
    glowColor: '#ff00ff',
    glowIntensity: 0.7,
    animationSpeed: 'normal',
    hasParticles: true,
    particleColor: '#ffffff',
    particleCount: 6,
    hasSparkles: true,
    hasEnergyRings: false,
    rarity: 'rare',
    coinCost: 2500,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 1,
  },
  {
    id: 'gold_vip',
    name: 'Gold VIP',
    description: 'Luxury gold shimmer fit for royalty',
    icon: '👑',
    animationType: 'gold_shimmer',
    frameStyle: 'premium',
    borderColor: '#ffd700',
    borderGradient: 'linear-gradient(135deg, #ffd700, #ffaa00, #ffd700, #ffe066)',
    glowColor: '#ffd700',
    glowIntensity: 0.8,
    animationSpeed: 'normal',
    hasParticles: true,
    particleColor: '#ffd700',
    particleCount: 5,
    hasSparkles: true,
    hasEnergyRings: false,
    rarity: 'epic',
    coinCost: 5000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 2,
  },
  {
    id: 'diamond_elite',
    name: 'Diamond Elite',
    description: 'Sparkling crystal diamond effect with prismatic light',
    icon: '💎',
    animationType: 'diamond_sparkle',
    frameStyle: 'legendary',
    borderColor: '#00d4ff',
    borderGradient: 'linear-gradient(135deg, #00d4ff, #ffffff, #00d4ff, #80f0ff)',
    glowColor: '#00d4ff',
    glowIntensity: 1.0,
    animationSpeed: 'fast',
    hasParticles: true,
    particleColor: '#ffffff',
    particleCount: 8,
    hasSparkles: true,
    hasEnergyRings: true,
    rarity: 'legendary',
    coinCost: 10000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 3,
  },
  {
    id: 'neon_cyber',
    name: 'Neon Cyber',
    description: 'Rotating neon cyberpunk glow with energy rings',
    icon: '⚡',
    animationType: 'neon_glow',
    frameStyle: 'animated',
    borderColor: '#00ff88',
    borderGradient: 'linear-gradient(90deg, #00ff88, #ff00ff, #0088ff, #00ff88)',
    glowColor: '#00ff88',
    glowIntensity: 0.9,
    animationSpeed: 'fast',
    hasParticles: true,
    particleColor: '#00ff88',
    particleCount: 6,
    hasSparkles: false,
    hasEnergyRings: true,
    rarity: 'epic',
    coinCost: 6000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 4,
  },
  {
    id: 'fire_lord',
    name: 'Fire Lord',
    description: 'Animated flames dancing around your avatar border',
    icon: '🔥',
    animationType: 'fire',
    frameStyle: 'premium',
    borderColor: '#ff4400',
    borderGradient: 'linear-gradient(135deg, #ff4400, #ff8800, #ffcc00, #ff4400)',
    glowColor: '#ff4400',
    glowIntensity: 1.0,
    animationSpeed: 'fast',
    hasParticles: true,
    particleColor: '#ffcc00',
    particleCount: 7,
    hasSparkles: true,
    hasEnergyRings: false,
    rarity: 'legendary',
    coinCost: 12000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 5,
  },
  {
    id: 'ice_king',
    name: 'Ice King',
    description: 'Frost crystals and snow particles swirling around you',
    icon: '❄️',
    animationType: 'ice',
    frameStyle: 'premium',
    borderColor: '#88ccff',
    borderGradient: 'linear-gradient(135deg, #88ccff, #ffffff, #aaddff, #88ccff)',
    glowColor: '#88ccff',
    glowIntensity: 0.8,
    animationSpeed: 'normal',
    hasParticles: true,
    particleColor: '#ffffff',
    particleCount: 6,
    hasSparkles: true,
    hasEnergyRings: false,
    rarity: 'legendary',
    coinCost: 12000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 6,
  },
  {
    id: 'electric_storm',
    name: 'Electric Storm',
    description: 'Crackling lightning pulses with electric energy rings',
    icon: '⚡',
    animationType: 'electric',
    frameStyle: 'animated',
    borderColor: '#ffee00',
    borderGradient: 'linear-gradient(90deg, #ffee00, #ff8800, #ffee00, #ffff88)',
    glowColor: '#ffee00',
    glowIntensity: 1.1,
    animationSpeed: 'fast',
    hasParticles: true,
    particleColor: '#ffff88',
    particleCount: 5,
    hasSparkles: false,
    hasEnergyRings: true,
    rarity: 'epic',
    coinCost: 8000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 7,
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    description: 'Swirling cosmic stars and nebula particles in deep space',
    icon: '🌌',
    animationType: 'galaxy',
    frameStyle: 'legendary',
    borderColor: '#8800ff',
    borderGradient: 'linear-gradient(135deg, #8800ff, #ff0088, #0088ff, #8800ff)',
    glowColor: '#8800ff',
    glowIntensity: 1.2,
    animationSpeed: 'slow',
    hasParticles: true,
    particleColor: '#ff88ff',
    particleCount: 9,
    hasSparkles: true,
    hasEnergyRings: true,
    rarity: 'mythic',
    coinCost: 20000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 8,
  },
  {
    id: 'verified_creator',
    name: 'Verified Creator',
    description: 'Premium verification glow for approved creators',
    icon: '✅',
    animationType: 'verified',
    frameStyle: 'premium',
    borderColor: '#1d9bf0',
    borderGradient: 'linear-gradient(135deg, #1d9bf0, #1a8cd8, #1d9bf0)',
    glowColor: '#1d9bf0',
    glowIntensity: 0.6,
    animationSpeed: 'normal',
    hasParticles: false,
    particleColor: null,
    particleCount: 0,
    hasSparkles: true,
    hasEnergyRings: false,
    rarity: 'rare',
    coinCost: 3000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 9,
  },
  {
    id: 'family_leader',
    name: 'Family Leader',
    description: 'Royal crown aura exclusive for family leaders',
    icon: '👑',
    animationType: 'crown',
    frameStyle: 'premium',
    borderColor: '#cc8800',
    borderGradient: 'linear-gradient(135deg, #cc8800, #ffcc44, #cc8800, #ffdd66)',
    glowColor: '#ffcc44',
    glowIntensity: 0.7,
    animationSpeed: 'normal',
    hasParticles: true,
    particleColor: '#ffdd66',
    particleCount: 4,
    hasSparkles: true,
    hasEnergyRings: false,
    rarity: 'epic',
    coinCost: 7500,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 10,
  },
  {
    id: 'battle_champion',
    name: 'Battle Champion',
    description: 'Gold rotating trophy aura earned from battle victories',
    icon: '🏆',
    animationType: 'trophy',
    frameStyle: 'animated',
    borderColor: '#ffd700',
    borderGradient: 'linear-gradient(135deg, #ffd700, #b8860b, #ffd700, #daa520)',
    glowColor: '#ffd700',
    glowIntensity: 0.9,
    animationSpeed: 'normal',
    hasParticles: true,
    particleColor: '#ffd700',
    particleCount: 5,
    hasSparkles: true,
    hasEnergyRings: true,
    rarity: 'legendary',
    coinCost: 15000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 11,
  },
  {
    id: 'troll_city_founder',
    name: 'Troll City Founder',
    description: 'Exclusive founder badge — only for the original trolls of the city',
    icon: '🧌',
    animationType: 'founder',
    frameStyle: 'legendary',
    borderColor: '#ff3366',
    borderGradient: 'linear-gradient(135deg, #ff3366, #ffd700, #00ff88, #ff3366)',
    glowColor: '#ff3366',
    glowIntensity: 1.5,
    animationSpeed: 'fast',
    hasParticles: true,
    particleColor: '#ffd700',
    particleCount: 10,
    hasSparkles: true,
    hasEnergyRings: true,
    rarity: 'founder',
    coinCost: 50000,
    isActive: true,
    isLimited: false,
    limitedQuantity: null,
    sortOrder: 12,
  },
];

// ─── Helper: Get frame by ID ────────────────────────────────────
export function getFrameById(id: string): ProfileFrame | undefined {
  return LAUNCH_FRAMES.find(f => f.id === id);
}

// ─── Helper: Get frames by rarity ───────────────────────────────
export function getFramesByRarity(rarity: FrameRarity): ProfileFrame[] {
  return LAUNCH_FRAMES.filter(f => f.rarity === rarity);
}

// ─── Helper: Sort frames by rarity tier ─────────────────────────
export const RARITY_ORDER: Record<FrameRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
  limited_edition: 5,
  founder: 6,
};

export function sortFramesByRarity(frames: ProfileFrame[]): ProfileFrame[] {
  return [...frames].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
}
