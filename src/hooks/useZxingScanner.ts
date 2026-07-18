import { useCallback, useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

/**
 * ZXing-based barcode decoder used as a fallback when the native
 * `BarcodeDetector` API is unavailable (e.g. iOS Safari, some desktop browsers).
 *
 * It continuously decodes the provided <video> element. The native detector is
 * preferred on supported platforms (Android Chrome / Edge) because it is faster
 * and runs on the GPU; this keeps iPhone scanning working without a separate
 * app.
 */
export function useZxingScanner(opts: {
  enabled: boolean
  videoRef: React.RefObject<HTMLVideoElement>
  onDetect: (value: string, format: string) => void
  onError?: (err: unknown) => void
}) {
  const { enabled, videoRef, onDetect, onError } = opts
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  // Keep the latest callback without restarting the decode session.
  const onDetectRef = useRef(onDetect)
  const onErrorRef = useRef(onError)
  onDetectRef.current = onDetect
  onErrorRef.current = onError

  const stop = useCallback(() => {
    try {
      readerRef.current?.stopContinuousDecode()
    } catch {
      /* no-op */
    }
    try {
      readerRef.current?.reset()
    } catch {
      /* no-op */
    }
    readerRef.current = null
  }, [])

  useEffect(() => {
    if (!enabled) return
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    try {
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      // Continuously decode the video element. The callback receives
      // (result, error?) on every frame; a missing result + NotFoundException is
      // the normal "no barcode yet" path, so we only surface genuine errors.
      reader.decodeFromVideoElementContinuously(video, (result, err) => {
        if (cancelled) return
        if (result) {
          const text = result.getText()
          if (text) {
            const format = result.getBarcodeFormat?.()?.toString() || 'unknown'
            onDetectRef.current(text, format)
          }
        }
        if (err && onErrorRef.current) {
          const name = (err as any)?.name || ''
          if (name && name !== 'NotFoundException') onErrorRef.current(err)
        }
      })
    } catch (err) {
      onErrorRef.current?.(err)
    }

    return () => {
      cancelled = true
      stop()
    }
  }, [enabled, videoRef, stop])

  return { stop }
}
