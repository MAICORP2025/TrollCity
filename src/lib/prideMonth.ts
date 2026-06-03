/**
 * Pride Month utilities for date-based theme switching
 * Pride Month: June 1 - June 30
 * Reverts to original theme starting July 1
 */

export const isPrideMonth = (): boolean => {
  const now = new Date()
  const month = now.getMonth() // 0-11, so June = 5
  return month === 5 // Only June
}

export const getPrideWeek = (): number => {
  const now = new Date()
  return Math.min(4, Math.max(1, Math.ceil(now.getDate() / 7)))
}

export const getDaysUntilPrideEnd = (): number => {
  const now = new Date()
  const month = now.getMonth()
  
  // If not in June, return 0
  if (month !== 5) return 0
  
  // Get last day of June (30)
  const daysInJune = 30
  const daysRemaining = daysInJune - now.getDate()
  return Math.max(0, daysRemaining)
}
