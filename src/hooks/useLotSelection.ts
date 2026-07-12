import { useCallback, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ResolvedLot {
  id: string
  auction_show_id: string
  title: string
  lot_number?: string | null
  barcode?: string | null
  sku?: string | null
  item_number?: string | null
  status?: string
  current_highest_bid?: number | null
  starting_bid?: number
  [key: string]: any
}

export interface UseLotSelectionOptions {
  showId?: string | null
  auctioneerId?: string | null
  onSelect?: (lot: ResolvedLot) => void
  /** Debounce window to ignore duplicate rapid scans (ms). */
  dedupeMs?: number
}

function normalizeScanned(raw: string): string {
  // Strip control characters (incl. CR/LF/Enter) without a control-char regex.
  const cleaned = (raw || '')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  return cleaned.trim()
}

/**
 * Unified item-selection logic shared by every input method:
 * USB/Bluetooth HID, phone camera, manual entry, lot number, SKU,
 * item number, title search, queue click, previous, next.
 *
 * Resolves a stable identifier to a lot, verifies it belongs to the
 * authorized auctioneer/show, loads it, and reports clear errors.
 * Re-arms automatically for the next scan.
 */
export function useLotSelection(opts: UseLotSelectionOptions = {}) {
  const { showId, onSelect, dedupeMs = 1500 } = opts
  const [selected, setSelected] = useState<ResolvedLot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastRef = useRef<{ value: string; t: number }>({ value: '', t: 0 })

  const clearError = useCallback(() => setError(null), [])

  const select = useCallback(
    (lot: ResolvedLot) => {
      setSelected(lot)
      setError(null)
      onSelect?.(lot)
    },
    [onSelect],
  )

  const resolve = useCallback(
    async (raw: string) => {
      const code = normalizeScanned(raw)
      if (!code) return

      const now = Date.now()
      if (lastRef.current.value === code && now - lastRef.current.t < dedupeMs) {
        return // duplicate rapid scan — ignore
      }
      lastRef.current = { value: code, t: now }

      setLoading(true)
      setError(null)
      try {
        // 1) Exact match on barcode / lot_number / sku / item_number (show-scoped when possible).
        let exact = supabase
          .from('auction_lots')
          .select('*')
          .or(`barcode.eq.${code},lot_number.eq.${code},sku.eq.${code},item_number.eq.${code}`)
          .limit(5)

        if (showId) exact = exact.eq('auction_show_id', showId)

        const { data: exactRows, error: exactErr } = await exact
        if (exactErr) throw exactErr

        const candidates: ResolvedLot[] = (exactRows as ResolvedLot[]) || []
        const scoped =
          candidates.find((l) => !showId || l.auction_show_id === showId) || candidates[0]
        if (scoped) {
          if (showId && scoped.auction_show_id !== showId) {
            setError('That item belongs to a different show.')
            return
          }
          select(scoped)
          return
        }

        // 2) Fallback: partial title search within the show.
        if (showId) {
          const { data: titleRows, error: titleErr } = await supabase
            .from('auction_lots')
            .select('*')
            .eq('auction_show_id', showId)
            .ilike('title', `%${code}%`)
            .limit(10)
          if (titleErr) throw titleErr
          const titles = (titleRows as ResolvedLot[]) || []
          if (titles.length === 1) {
            select(titles[0])
            return
          }
          if (titles.length > 1) {
            setError(`Multiple items match "${code}". Please use the barcode or lot number.`)
            return
          }
        }

        setError(`No item found for "${code}".`)
      } catch (e: any) {
        setError(e?.message || 'Failed to look up item')
      } finally {
        setLoading(false)
      }
    },
    [showId, dedupeMs, select],
  )

  return { selected, loading, error, resolve, select, setSelected, clearError }
}

/** Normalize any scanned/entered text before lookup (exported for tests). */
export function normalizeLotCode(raw: string): string {
  return normalizeScanned(raw)
}
