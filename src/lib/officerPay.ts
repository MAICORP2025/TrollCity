/**
 * Officer base pay rate (coins per hour)
 * All officers earn 2500 coins per hour clocked in
 */
export const OFFICER_BASE_HOURLY_COINS = 2500;

/**
 * Calculate base coins earned based on hours worked
 * All officers get the same base rate of 2500 coins per hour
 */
export function calculateOfficerBaseCoins(hoursWorked: number): number {
  return Math.round(hoursWorked * OFFICER_BASE_HOURLY_COINS);
}

/**
 * Calculate total officer earnings including bonuses
 */
export function calculateTotalOfficerEarnings(
  baseHours: number,
  liveEarnings: number = 0,
  courtBonuses: number = 0,
  otherBonuses: number = 0
): number {
  const basePay = calculateOfficerBaseCoins(baseHours);
  return basePay + liveEarnings + courtBonuses + otherBonuses;
}

