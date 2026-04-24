// Holiday theme functionality has been removed
// This file is kept for backward compatibility

export interface HolidayTheme {
  start: string
  end: string
  name: string
  icon: string
  giftBox: string
}

export function getActiveHolidayTheme(): null {
  return null
}

export function getGiftBoxIcon(): string {
  return '/giftboxes/default_box.png'
}