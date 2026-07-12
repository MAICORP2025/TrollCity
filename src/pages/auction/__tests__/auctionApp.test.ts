import { computeCancellationFeeCents, isLocalCarrier, maskBidderId, carrierTrackUrl } from '../../../lib/auctionFees'
import { normalizeLotCode } from '../../../hooks/useLotSelection'

describe('auction cancellation fee (integer Troll Coin math)', () => {
  it('computes 10% correctly', () => {
    expect(computeCancellationFeeCents(1000)).toBe(100)
    expect(computeCancellationFeeCents(2500)).toBe(250)
    expect(computeCancellationFeeCents(27550)).toBe(2755)
    expect(computeCancellationFeeCents(10)).toBe(1)
  })
  it('never goes below zero', () => {
    expect(computeCancellationFeeCents(0)).toBe(0)
    expect(computeCancellationFeeCents(-500)).toBe(0)
  })
})

describe('normalizeLotCode', () => {
  it('strips control chars and trims', () => {
    expect(normalizeLotCode('TC-LOT-000123\n')).toBe('TC-LOT-000123')
    expect(normalizeLotCode('  TC-LOT-000123  ')).toBe('TC-LOT-000123')
    expect(normalizeLotCode('TC-LOT-000123\r')).toBe('TC-LOT-000123')
  })
})

describe('carrier helpers', () => {
  it('detects local carriers', () => {
    expect(isLocalCarrier('local_pickup')).toBe(true)
    expect(isLocalCarrier('local_delivery')).toBe(true)
    expect(isLocalCarrier('usps')).toBe(false)
  })
  it('builds safe track urls only for known carriers', () => {
    expect(carrierTrackUrl('usps', 'ABC123')).toContain('ABC123')
    expect(carrierTrackUrl('other', 'ABC123')).toBeNull()
    expect(carrierTrackUrl('local_pickup', 'ABC123')).toBeNull()
  })
  it('masks bidder id', () => {
    expect(maskBidderId('11111111-2222-3333-4444-555555555555')).toBe('555555')
  })
})

// ---------------------------------------------------------------------------
// SQL-backed behaviors (require the migration applied + a test DB). Documented
// here as the contract the migration must satisfy:
//  1. Inserting an auction_lots row always yields a non-null, unique barcode + lot_number.
//  2. Duplicating an item yields a DIFFERENT barcode.
//  3. Backfill preserves existing barcodes (trigger is idempotent).
//  4. mark_lot_sold is atomic + idempotent (one order/win/receipt per lot).
//  5. process_auction_cancellations creates exactly one 10% fee per order.
//  6. RLS blocks cross-bidder / cross-auctioneer reads of private records.
// These are validated by applying supabase/migrations/20260710000000_auction_app_barcodes_shipping_fees.sql
// against a staging database and exercising the RPCs.
// ---------------------------------------------------------------------------
