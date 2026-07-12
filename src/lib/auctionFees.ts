// Integer Troll Coin math only. No floating point for money.

/** 10% cancellation fee, computed with integer/numeric-safe rounding. */
export function computeCancellationFeeCents(winningBidCoins: number): number {
  const base = Math.max(0, Math.trunc(winningBidCoins || 0))
  // fee = round(base * 10 / 100)
  return Math.round((base * 10) / 100)
}

export interface CarrierDef {
  code: string
  name: string
  trackBaseUrl?: string
}

export const CARRIERS: CarrierDef[] = [
  { code: 'usps', name: 'USPS', trackBaseUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' },
  { code: 'ups', name: 'UPS', trackBaseUrl: 'https://www.ups.com/track?tracknum=' },
  { code: 'fedex', name: 'FedEx', trackBaseUrl: 'https://www.fedex.com/fedextrack/?trknbr=' },
  { code: 'dhl', name: 'DHL', trackBaseUrl: 'https://www.dhl.com/us-en/home/tracking.html?submit=1&tracking-id=' },
  { code: 'amazon_logistics', name: 'Amazon Logistics' },
  { code: 'ontrac', name: 'OnTrac', trackBaseUrl: 'https://www.ontrac.com/trackingres.asp?tracking_number=' },
  { code: 'canada_post', name: 'Canada Post', trackBaseUrl: 'https://www.canadapost-postescanada.ca/track-reperage/en#/result?trackingNumber=' },
  { code: 'other', name: 'Other' },
  { code: 'local_pickup', name: 'Local Pickup' },
  { code: 'local_delivery', name: 'Local Delivery' },
]

export function isLocalCarrier(code?: string | null): boolean {
  return code === 'local_pickup' || code === 'local_delivery'
}

export function carrierTrackUrl(code?: string | null, trackingNumber?: string | null): string | null {
  if (!code || !trackingNumber) return null
  const def = CARRIERS.find((c) => c.code === code)
  if (!def?.trackBaseUrl) return null
  return `${def.trackBaseUrl}${encodeURIComponent(trackingNumber)}`
}

/** Mask a bidder id for labels (last 6 chars of UUID). */
export function maskBidderId(id?: string | null): string {
  if (!id) return '------'
  return id.slice(-6)
}
