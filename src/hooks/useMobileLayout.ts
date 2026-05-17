import { useState, useEffect, useCallback } from 'react'

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
}

const MOBILE_BREAKPOINT = 768
const DEFAULT_HEADER_HEIGHT = 56
const DEFAULT_DOCK_HEIGHT = 64

/**
 * Detects if device is mobile based on viewport width
 */
export function useMobileLayout(): MobileLayoutReturn {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    window.addEventListener('resize', handleResize, { passive: true })
    window.addEventListener('orientationchange', handleResize, { passive: true })

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  return { isMobile }
}

/**
 * Gets safe area insets for notched devices and calculates header/dock heights
 * Uses CSS environment variables if available (iOS Safari, Android Chrome)
 */
export function useSafeAreaHeight(): SafeAreaHeightReturn {
  const [metrics, setMetrics] = useState<SafeAreaHeightReturn>(() => ({
    headerHeight: DEFAULT_HEADER_HEIGHT,
    dockHeight: DEFAULT_DOCK_HEIGHT,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  }))

  const updateMetrics = useCallback(() => {
    const newMetrics: SafeAreaHeightReturn = {
      headerHeight: DEFAULT_HEADER_HEIGHT,
      dockHeight: DEFAULT_DOCK_HEIGHT,
      safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    }

    if (typeof window === 'undefined') {
      setMetrics(newMetrics)
      return
    }

    // Get CSS environment variables (safe area insets from notched devices)
    const getCSSEnvValue = (varName: string): number => {
      if (typeof getComputedStyle === 'undefined') return 0
      const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
      if (!value) return 0
      const num = parseInt(value, 10)
      return isNaN(num) ? 0 : num
    }

    // Try to get safe area insets from CSS env variables (iOS 11.2+, Android Q+)
    newMetrics.safeArea.top = getCSSEnvValue('--safe-area-inset-top')
    newMetrics.safeArea.bottom = getCSSEnvValue('--safe-area-inset-bottom')
    newMetrics.safeArea.left = getCSSEnvValue('--safe-area-inset-left')
    newMetrics.safeArea.right = getCSSEnvValue('--safe-area-inset-right')

    // Fallback: detect notch from viewport and screen dimensions
    if (newMetrics.safeArea.top === 0 && window.devicePixelRatio > 2) {
      const screenTop = window.screen.availTop || 0
      const screenHeight = window.screen.availHeight || window.innerHeight
      const topInset = window.outerHeight - screenHeight - screenTop

      if (topInset > 20) {
        newMetrics.safeArea.top = topInset
      }
    }

    // Add extra padding for notch safety (add notch size to header)
    const hasNotch = newMetrics.safeArea.top > 20
    if (hasNotch) {
      newMetrics.headerHeight = DEFAULT_HEADER_HEIGHT + newMetrics.safeArea.top
    }

    setMetrics(newMetrics)
  }, [])

  useEffect(() => {
    updateMetrics()

    // Re-check on resize and orientation change
    window.addEventListener('resize', updateMetrics, { passive: true })
    window.addEventListener('orientationchange', updateMetrics, { passive: true })

    // Also listen to visual viewport changes (handles keyboard appearing)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateMetrics, { passive: true })
    }

    return () => {
      window.removeEventListener('resize', updateMetrics)
      window.removeEventListener('orientationchange', updateMetrics)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateMetrics)
      }
    }
  }, [updateMetrics])

  return metrics
}
