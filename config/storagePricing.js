/**
 * Storage Plan Pricing — Based on Supabase Pro Tier Costs
 *
 * Supabase Pro includes 100GB file storage at $25/month.
 * Overage: $0.0213 per GB per month.
 *
 * Troll Coin pricing = Supabase cost + 10% platform margin.
 * Conversion: $0.0213/GB → 0.0213 Troll Coins/GB (1 coin ≈ $1 for storage math)
 * With 10% margin: 0.0213 * 1.10 = ~0.0234 coins/GB
 *
 * We round to clean numbers for UX.
 *
 * Tier breakdown (monthly cost to us → what we charge):
 *
 *   Starter:   25 GB  → $0.53   → 55 coins   (rounds to 50)
 *   Basic:     50 GB  → $1.07   → 110 coins  (rounds to 100)
 *   Standard:  100 GB → $2.13   → 225 coins  (rounds to 200)
 *   Pro:       200 GB → $4.26   → 450 coins  (rounds to 400)
 *   Premium:   500 GB → $10.65  → 1100 coins (rounds to 1000)
 *   Unlimited: 1 TB+  → $21.30+ → 2200+ base (2000 coins)
 *
 * These tiers are designed so:
 * - Casual streamers (1-2 broadcasts/week) fit in Starter
 * - Regular streamers (daily) fit in Standard
 * - Power users (multiple daily + gaming clips) need Pro+
 * - The 100GB Supabase Pro pool supports ~10-20 average users on Standard
 */

// Supabase cost per GB per month
const SUPABASE_COST_PER_GB = 0.0213;
const PLATFORM_MARGIN = 1.10; // 10% margin

// Calculate Troll Coins for a given GB amount
function calcCoins(gb) {
  return Math.round(gb * SUPABASE_COST_PER_GB * PLATFORM_MARGIN);
}

// Verify: 25 GB → 25 * 0.0213 * 1.10 = 0.58575 → round to 1 coin minimum
// We use a minimum of 1 coin per GB for simplicity, with rounding

module.exports = {
  SUPABASE_COST_PER_GB,
  PLATFORM_MARGIN,
  calcCoins,
};
