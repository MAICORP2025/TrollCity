/**
 * T LEAGUE CONFIGURATION
 * ======================
 * Troll City Broadcast League System
 * Replaces the old "Broadcast Level" system
 *
 * League score = gift_coins_received + floor(total_live_minutes / 5)
 *   - 1 gift coin received = 1 league point
 *   - every 5 minutes live = 1 league point
 */

export interface TLeagueTier {
  tier: string           // T0, T1, ... T10
  minScore: number       // Minimum league score for this tier
  label: string          // Display name
  color: string          // Tailwind gradient classes
  badgeColor: string     // Badge background
  textColor: string      // Text color
  icon: string           // Emoji icon
}

export const T_LEAGUE_TIERS: TLeagueTier[] = [
  { tier: 'T0',  minScore: 0,              label: 'Unranked',              color: 'from-gray-600 to-gray-500',       badgeColor: 'bg-gray-700',      textColor: 'text-gray-300',    icon: '⚪' },
  { tier: 'T1',  minScore: 500,            label: 'Street Rookie',         color: 'from-green-600 to-green-500',     badgeColor: 'bg-green-700',     textColor: 'text-green-300',   icon: '🟢' },
  { tier: 'T2',  minScore: 2500,           label: 'Block Runner',         color: 'from-teal-600 to-teal-500',       badgeColor: 'bg-teal-700',      textColor: 'text-teal-300',    icon: '🔵' },
  { tier: 'T3',  minScore: 75000,          label: 'Neon Hustler',         color: 'from-blue-600 to-blue-500',       badgeColor: 'bg-blue-700',      textColor: 'text-blue-300',    icon: '🔷' },
  { tier: 'T4',  minScore: 150000,         label: 'City Grinder',         color: 'from-indigo-600 to-indigo-500',   badgeColor: 'bg-indigo-700',    textColor: 'text-indigo-300',  icon: '💎' },
  { tier: 'T5',  minScore: 3000000,        label: 'Broadcast Boss',       color: 'from-purple-600 to-purple-500',   badgeColor: 'bg-purple-700',    textColor: 'text-purple-300',  icon: '🟣' },
  { tier: 'T6',  minScore: 60000000,       label: 'Stream Warlord',       color: 'from-violet-600 to-violet-500',   badgeColor: 'bg-violet-700',    textColor: 'text-violet-300',  icon: '👑' },
  { tier: 'T7',  minScore: 120000000,      label: 'Hype Commander',       color: 'from-orange-600 to-orange-500',   badgeColor: 'bg-orange-700',    textColor: 'text-orange-300',  icon: '🔥' },
  { tier: 'T8',  minScore: 2500000000,     label: 'Troll Elite',          color: 'from-amber-600 to-amber-500',     badgeColor: 'bg-amber-700',     textColor: 'text-amber-300',   icon: '⭐' },
  { tier: 'T9',  minScore: 50000000000,    label: 'City Legend',          color: 'from-yellow-500 to-yellow-400',   badgeColor: 'bg-yellow-600',    textColor: 'text-yellow-200',  icon: '🌟' },
  { tier: 'T10', minScore: 100000000000,   label: 'Troll City Immortal',  color: 'from-red-500 to-yellow-500',      badgeColor: 'bg-red-700',       textColor: 'text-red-200',     icon: '🏆' },
];

/**
 * Get T League tier info from a league score
 */
export function getTLeagueTier(score: number): TLeagueTier {
  for (let i = T_LEAGUE_TIERS.length - 1; i >= 0; i--) {
    if (score >= T_LEAGUE_TIERS[i].minScore) {
      return T_LEAGUE_TIERS[i];
    }
  }
  return T_LEAGUE_TIERS[0];
}

/**
 * Get the next tier info (for progress display)
 */
export function getNextTLeagueTier(score: number): TLeagueTier | null {
  const current = getTLeagueTier(score);
  const currentIndex = T_LEAGUE_TIERS.findIndex(t => t.tier === current.tier);
  if (currentIndex < T_LEAGUE_TIERS.length - 1) {
    return T_LEAGUE_TIERS[currentIndex + 1];
  }
  return null;
}

/**
 * Calculate progress percentage within current tier
 */
export function getTLeagueProgress(score: number): number {
  const current = getTLeagueTier(score);
  const next = getNextTLeagueTier(score);
  if (!next) return 100;
  const range = next.minScore - current.minScore;
  const progress = score - current.minScore;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}

/**
 * Calculate league score from gifts and live minutes
 */
export function calculateLeagueScore(giftCoinsReceived: number, totalLiveMinutes: number): number {
  return giftCoinsReceived + Math.floor(totalLiveMinutes / 5);
}
