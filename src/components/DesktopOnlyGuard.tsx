import { ReactNode, useEffect, useState } from 'react'

interface Props {
  children: ReactNode
}

export default function DesktopOnlyGuard({ children }: Props) {
  const getIsDesktop = () => {
    if (typeof window === 'undefined') return true

    const ua = navigator.userAgent || ''
    const isMobileUA = /(Mobi|Android|iPhone|iPad|iPod|Phone|BlackBerry|IEMobile|Opera Mini)/i.test(ua)
    const isDesktopOS = /(Windows|Macintosh|Mac OS|Linux)/i.test(ua)
    const wideEnough = window.innerWidth >= 1024

    return !isMobileUA && (isDesktopOS || wideEnough)
  }

  const [isDesktop, setIsDesktop] = useState(getIsDesktop)

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(getIsDesktop())
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  if (isDesktop) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 bg-black/90 text-white z-[9999] flex items-center justify-center p-6">
      <div className="rounded-3xl border border-white/30 bg-gradient-to-b from-black/70 to-neutral-900/80 shadow-2xl p-8 text-center max-w-lg space-y-4">
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Desktop Only</p>
        <h1 className="text-3xl font-bold">Please use a computer</h1>
        <p className="text-gray-300">
          Troll City is optimized for desktop PWA installs. Use a Windows or macOS machine for the full experience.
        </p>
        <p className="text-sm text-gray-400">
          In the meantime, bookmark this URL and return on a desktop device to continue.
        </p>
      </div>
    </div>
  )
}
