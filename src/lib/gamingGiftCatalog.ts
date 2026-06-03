export interface GamingGiftItem {
  id: string
  name: string
  icon: string
  coinCost: number
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
  animationType: 'emoji' | 'particle'
  description: string
}

export const GAMING_GIFTS: GamingGiftItem[] = [
  {
    id: 'gaming_gg',
    name: 'GG',
    icon: '👋',
    coinCost: 10,
    rarity: 'common',
    animationType: 'emoji',
    description: 'Good Game!',
  },
  {
    id: 'gaming_headshot',
    name: 'Headshot',
    icon: '🎯',
    coinCost: 25,
    rarity: 'uncommon',
    animationType: 'particle',
    description: 'Clean headshot!',
  },
  {
    id: 'gaming_clutch',
    name: 'Clutch',
    icon: '🔥',
    coinCost: 50,
    rarity: 'rare',
    animationType: 'particle',
    description: 'Insane clutch play!',
  },
  {
    id: 'gaming_mvp',
    name: 'MVP',
    icon: '🏆',
    coinCost: 100,
    rarity: 'epic',
    animationType: 'particle',
    description: 'Most Valuable Player!',
  },
  {
    id: 'gaming_penta',
    name: 'Penta Kill',
    icon: '⚡',
    coinCost: 250,
    rarity: 'legendary',
    animationType: 'particle',
    description: 'Penta Kill!',
  },
  {
    id: 'gaming_raidboss',
    name: 'Raid Boss',
    icon: '🐉',
    coinCost: 500,
    rarity: 'mythic',
    animationType: 'particle',
    description: 'Raid Boss defeated!',
  },
  {
    id: 'gaming_legendary',
    name: 'Legendary Play',
    icon: '👑',
    coinCost: 1000,
    rarity: 'mythic',
    animationType: 'particle',
    description: 'A play for the ages!',
  },
]

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
}

const RARITY_COLORS: Record<string, string> = {
  common: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
  uncommon: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  rare: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
  epic: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  legendary: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  mythic: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
}

export function getGamingGiftRarityStyle(rarity: string): string {
  return RARITY_COLORS[rarity] || RARITY_COLORS.common
}
