import { useEffect, useMemo, useState } from 'react'

const MOBILE_BREAKPOINT_PX = 768

function getIsTouchDevice() {
  if (typeof window === 'undefined') return false
  return (navigator.maxTouchPoints ?? 0) > 0
}

function getIsMobileWidth() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < MOBILE_BREAKPOINT_PX
}

export function useIsMobile() {
  const [isMobileWidth, setIsMobileWidth] = useState(getIsMobileWidth())

  useEffect(() => {
    const handleResize = () => setIsMobileWidth(getIsMobileWidth())
    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isTouchDevice = useMemo(() => getIsTouchDevice(), [])

  return {
    isMobile: isMobileWidth && isTouchDevice,
    isMobileWidth,
    isTouchDevice,
    breakpointPx: MOBILE_BREAKPOINT_PX,
  }
}
