import { useEffect, useRef, useCallback } from 'react'

/**
 * Detects double-tap (touch) or double-click (mouse) anywhere on the document.
 * Fires a callback within `delay` ms between taps.
 * Ignores if the target is an input, textarea, button, or contenteditable.
 */
export function useDoubleTap(
  onDoubleTap: () => void,
  delay = 350
) {
  const lastTapRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isInteractiveTarget = useCallback((el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return true
    const tag = el.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return true
    if (el.isContentEditable) return true
    // Check up the tree for interactive ancestors
    let node: HTMLElement | null = el
    while (node) {
      if (node.dataset?.noDoubleTap === 'true') return true
      node = node.parentElement
    }
    return false
  }, [])

  useEffect(() => {
    const handler = (e: TouchEvent | MouseEvent) => {
      // Don't intercept on interactive elements
      if (isInteractiveTarget(e.target)) return

      const now = Date.now()
      const elapsed = now - lastTapRef.current

      if (elapsed < delay && elapsed > 0) {
        // Double tap detected
        lastTapRef.current = 0
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        onDoubleTap()
      } else {
        // First tap — wait to see if a second comes
        lastTapRef.current = now
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          lastTapRef.current = 0
          timerRef.current = null
        }, delay)
      }
    }

    // Use pointerdown for unified touch+mouse handling
    document.addEventListener('pointerdown', handler as EventListener, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handler as EventListener)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onDoubleTap, delay, isInteractiveTarget])
}
