import { COIN_PACKAGES as CONFIG_COIN_PACKAGES, CASHOUT_TIERS } from '../config/coinConfig';

export const STORE_USD_PER_COIN = 0.01;
export const COIN_PACKAGES = CONFIG_COIN_PACKAGES;
export const cashoutTiers = CASHOUT_TIERS;
export const STATS_COINS_PER_USD = 300;

/**
 * Format a coins value for display.
 */
export function formatCoins(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(value);
}

/**
 * Format USD value for display.
 */
export function formatUSD(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Select the highest cashout tier the user is eligible for.
 */
export function getEligibleTier(coins: number) {
  return [...CASHOUT_TIERS].reverse().find((tier) => coins >= tier.coins) || CASHOUT_TIERS[0];
}

/**
 * Calculate a combined total coin balance.
 */
export function calculateTotalCoins(coins: number, reserved: number = 0): number {
  return Math.max(0, coins + reserved);
}

/**
 * Get cashout rate (USD per coin) for a given coin amount
 */
export function getRateForCoins(coins: number): number {
  if (coins >= 200000) return 1000 / 200000;
  if (coins >= 120000) return 600 / 120000;
  if (coins >= 60000) return 300 / 60000;
  if (coins >= 30000) return 150 / 30000;
  if (coins >= 15000) return 50 / 15000;
  if (coins >= 5000) return 25 / 5000;
  return 0;
}

/**
 * Get coins per USD for a given cashout amount
 */
export function getCoinsPerUsd(coinAmount: number): number {
  const rate = getRateForCoins(coinAmount);
  return rate > 0 ? 1 / rate : 200;
}

/**
 * Calculate USD value for a given coin amount based on tiers
 */
export function calculateCashoutUsd(coinAmount: number): number {
  const tier = CASHOUT_TIERS.find((t) => t.coins === coinAmount);
  return tier?.usd ?? 0;
}

/**
 * Check if a cashout requires manual review
 */
export function requiresManualReview(coinAmount: number): boolean {
  return coinAmount >= CASHOUT_TIERS[CASHOUT_TIERS.length - 1].coins;
}

/**
 * Get all available coin packages
 */
export function getCoinPackages(): typeof COIN_PACKAGES {
  return COIN_PACKAGES;
}

/**
 * Calculate coins with new user bonus applied
 * @param baseCoins - The base coin amount
 * @param includeBonus - Whether to include the 5% bonus
 */
export function calculateCoinsWithBonus(baseCoins: number, includeBonus: boolean = true): number {
  if (!includeBonus) return baseCoins;
  return Math.floor(baseCoins * 1.05);
}

/**
 * Get the bonus coins amount for a purchase
 */
export function getBonusCoins(baseCoins: number): number {
  return Math.floor(baseCoins * 0.05);
}
