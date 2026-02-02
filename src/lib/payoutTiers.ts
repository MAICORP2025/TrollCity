export const TIERS = [
  { coins: 12000, usd: 25, manualReview: false },
  { coins: 26375, usd: 70, manualReview: false },
  { coins: 60000, usd: 150, manualReview: false },
  { coins: 120000, usd: 355, manualReview: true },
] as const;

export const FIXED_FEE_USD = 3;

export function getRateForCoins(coins: number) {
  if (coins >= 120000) return 355 / 120000;
  if (coins >= 60000) return 150 / 60000;
  if (coins >= 26375) return 70 / 26375;
  if (coins >= 12000) return 25 / 12000;
  return 0;
}
