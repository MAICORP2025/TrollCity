import { useState, useEffect } from 'react'

export function useIsPwa() {
  const [isPwa, setIsPwa] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    setIsPwa(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsPwa(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isPwa
}
