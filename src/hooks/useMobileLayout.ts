import { useCallback, useEffect, useState } from 'react'

interface SafeArea {
  top: number
  bottom: number
  left: number
  right: number
}

interface MobileLayoutReturn {
  isMobile: boolean
}

interface SafeAreaHeightReturn {
  headerHeight: number
  dockHeight: number
  safeArea: SafeArea
  visualViewportHeight: number
}

const MOBILE_BREAKPOINT = 768
const DEFAULT_HEADER_HEIGHT = 56
const DEFAULT_DOCK_HEIGHT = 64

function canUseDOM() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function parsePixelValue(value: string | null | undefined): number {
  if (!value) return 0

  const parsed = Number.parseFloat(String(value).replace('px', '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function getOrCreateSafeAreaProbe(): HTMLDivElement | null {
  if (!canUseDOM()) return null

  const existing = document.getElementById('tc-safe-area-probe') as HTMLDivElement | null
  if (existing) return existing

  const probe = document.createElement('div')
  probe.id = 'tc-safe-area-probe'
  probe.setAttribute('aria-hidden', 'true')

  probe.style.position = 'fixed'
  probe.style.left = '0'
  probe.style.top = '0'
  probe.style.width = '0'
  probe.style.height = '0'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  probe.style.zIndex = '-1'

  probe.style.paddingTop = 'env(safe-area-inset-top)'
  probe.style.paddingBottom = 'env(safe-area-inset-bottom)'
  probe.style.paddingLeft = 'env(safe-area-inset-left)'
  probe.style.paddingRight = 'env(safe-area-inset-right)'

  document.body.appendChild(probe)
  return probe
}

function readSafeAreaFromProbe(): SafeArea {
  if (!canUseDOM()) {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }

  const probe = getOrCreateSafeAreaProbe()
  if (!probe) {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }

  const styles = window.getComputedStyle(probe)

  return {
    top: parsePixelValue(styles.paddingTop),
    bottom: parsePixelValue(styles.paddingBottom),
    left: parsePixelValue(styles.paddingLeft),
    right: parsePixelValue(styles.paddingRight),
  }
}

/**
 * Detects mobile based on viewport width.
 */
export function useMobileLayout(): MobileLayoutReturn {
  const getIsMobile = useCallback(() => {
    if (!canUseDOM()) return true
    return window.innerWidth < MOBILE_BREAKPOINT
  }, [])

  const [isMobile, setIsMobile] = useState<boolean>(() => getIsMobile())

  useEffect(() => {
    if (!canUseDOM()) return

    let frame = 0

    const update = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        setIsMobile(getIsMobile())
      })
    }

    update()

    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update, { passive: true })
      window.visualViewport.addEventListener('scroll', update, { passive: true })
    }

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)

      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update)
        window.visualViewport.removeEventListener('scroll', update)
      }
    }
  }, [getIsMobile])

  return { isMobile }
}

/**
 * Reads real device safe-area values and calculates usable header/dock heights.
 *
 * Important:
 * - CSS env() values cannot be read directly from JS.
 * - This hook measures them through a hidden DOM probe.
 * - visualViewportHeight helps prevent PWA/mobile keyboard and footer layout jumps.
 */
export function useSafeAreaHeight(): SafeAreaHeightReturn {
  const getMetrics = useCallback((): SafeAreaHeightReturn => {
    if (!canUseDOM()) {
      return {
        headerHeight: DEFAULT_HEADER_HEIGHT,
        dockHeight: DEFAULT_DOCK_HEIGHT,
        safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
        visualViewportHeight: 0,
      }
    }

    const safeArea = readSafeAreaFromProbe()

    const visualViewportHeight =
      Math.round(window.visualViewport?.height || window.innerHeight || 0)

    const headerHeight = DEFAULT_HEADER_HEIGHT + safeArea.top
    const dockHeight = DEFAULT_DOCK_HEIGHT + safeArea.bottom

    return {
      headerHeight,
      dockHeight,
      safeArea,
      visualViewportHeight,
    }
  }, [])

  const [metrics, setMetrics] = useState<SafeAreaHeightReturn>(() => getMetrics())

  useEffect(() => {
    if (!canUseDOM()) return

    let frame = 0

    const updateMetrics = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        setMetrics(getMetrics())
      })
    }

    updateMetrics()

    window.addEventListener('resize', updateMetrics, { passive: true })
    window.addEventListener('orientationchange', updateMetrics, { passive: true })

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateMetrics, { passive: true })
      window.visualViewport.addEventListener('scroll', updateMetrics, { passive: true })
    }

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateMetrics)
      window.removeEventListener('orientationchange', updateMetrics)

      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateMetrics)
        window.visualViewport.removeEventListener('scroll', updateMetrics)
      }
    }
  }, [getMetrics])

  return metrics
}