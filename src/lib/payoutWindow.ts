/**
 * Payout window is now determined by user level in the backend RPC.
 * This file is kept for backward compatibility but the actual gating
 * happens in request_friday_cashout based on user_stats.level.
 *
 * Level 1-499:    Fridays only (1AM-7PM MT)
 * Level 500-999:  Every 24 hours
 * Level 1000+:    Every 30 minutes
 */

export const PAYOUT_WINDOW_LABEL =
  "Payout availability depends on your level: Level 1-499 Fridays only, Level 500-999 every 24hrs, Level 1000+ every 30min.";

/**
 * @deprecated Use backend RPC request_friday_cashout which checks user level
 * This is a frontend-only hint and should not be used for gating.
 */
export function isPayoutWindowOpen(date: Date = new Date()): boolean {
  // Always return true — the backend handles level-based gating
  return true;
}
