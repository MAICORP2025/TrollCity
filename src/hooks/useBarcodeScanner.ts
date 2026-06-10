import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Universal barcode scanner hook.
 * Auto-detects USB HID keyboard scanners by monitoring rapid keystroke input.
 * Scanners typically input characters within 50ms of each other.
 *
 * Usage: Call useBarcodeScanner() in any component that needs scan input.
 * Returns: { scannedValue, isScanning, resetScan, lastScannedAt }
 */
export function useBarcodeScanner(options?: {
  prefix?: string
  suffix?: string
  minLength?: number
  maxIntervalMs?: number
  onScan?: (value: string) => void
}) {
  const {
    minLength = 3,
    maxIntervalMs = 80,
    onScan,
  } = options || {}

  const [scannedValue, setScannedValue] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null)

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const resetScan = useCallback(() => {
    bufferRef.current = ''
    setIsScanning(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      const timeSinceLastKey = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      // If too much time passed, reset buffer (new scan session)
      if (timeSinceLastKey > maxIntervalMs * 3 && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      // Scanner input — rapid alphanumeric characters
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Check if focused on an input — skip scan mode for manual typing
        const activeEl = document.activeElement
        const isInputFocused =
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          (activeEl as HTMLElement)?.isContentEditable

        if (isInputFocused) {
          bufferRef.current = ''
          setIsScanning(false)
          return
        }

        e.preventDefault()
        bufferRef.current += e.key
        setIsScanning(true)

        // Clear previous timer
        if (timerRef.current) {
          window.clearTimeout(timerRef.current)
        }

        // If buffer looks complete (scanner often sends Enter at end)
        if (e.key === '\n' || e.key === '\r') {
          const value = bufferRef.current.replace(/[\n\r]/g, '').trim()
          if (value.length >= minLength) {
            setScannedValue(value)
            setLastScannedAt(value)
            onScan?.(value)
          }
          bufferRef.current = ''
          setIsScanning(false)
          return
        }

        // Auto-finalize after silence period
        timerRef.current = window.setTimeout(() => {
          const value = bufferRef.current.trim()
          if (value.length >= minLength) {
            setScannedValue(value)
            setLastScannedAt(value)
            onScan?.(value)
          }
          bufferRef.current = ''
          setIsScanning(false)
        }, maxIntervalMs * 4)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const value = bufferRef.current.trim()
        if (value.length >= minLength) {
          setScannedValue(value)
          setLastScannedAt(value)
          onScan?.(value)
        }
        bufferRef.current = ''
        setIsScanning(false)
      } else if (e.key === 'Escape') {
        bufferRef.current = ''
        setIsScanning(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [minLength, maxIntervalMs, onScan])

  return { scannedValue, isScanning, resetScan, lastScannedAt }
}
