import type { ReactNode } from 'react'

interface MobilePageLayoutProps {
  children: ReactNode
  className?: string
  header?: ReactNode
  topBanner?: ReactNode
  bottomNav?: ReactNode
  floatingActionButton?: ReactNode
  footer?: ReactNode
  bodyClassName?: string
  headerClassName?: string
  footerClassName?: string
  contentClassName?: string
  showBottomNav?: boolean
  safeAreaBottom?: boolean
  contentPadding?: string
}

export default function MobilePageLayout({
  children,
  className = '',
  header,
  topBanner,
  bottomNav,
  floatingActionButton,
  footer,
  bodyClassName = '',
  headerClassName = '',
  footerClassName = '',
  contentClassName = '',
  showBottomNav = true,
  safeAreaBottom = true,
  contentPadding = 'px-3 pb-4 pt-3',
}: MobilePageLayoutProps) {
  const bottomPadding = showBottomNav
    ? 'pb-[calc(var(--bottom-nav-height,64px)+env(safe-area-inset-bottom,0px))]'
    : safeAreaBottom
      ? 'pb-[env(safe-area-inset-bottom,0px)]'
      : ''

  return (
    <div className={`tc-page-surface min-h-screen w-full text-white ${className}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col overflow-y-auto overflow-x-hidden md:overflow-hidden border-x border-white/5 bg-slate-950/30 backdrop-blur-sm">
        {header ? (
          <header className={`shrink-0 border-b border-white/10 bg-slate-950/50 px-4 pb-3 pt-3 ${headerClassName}`}>
            {header}
          </header>
        ) : null}

        {topBanner ? <div className="shrink-0 px-3 pt-3">{topBanner}</div> : null}

        <main className={`flex-1 overflow-y-auto ${contentPadding} ${bottomPadding} ${bodyClassName}`}>
          <div className={`flex min-h-full flex-col gap-4 ${contentClassName}`}>
            {children}
          </div>
        </main>

        {footer ? (
          <div className={`shrink-0 border-t border-white/10 bg-slate-950/55 ${footerClassName}`}>
            {footer}
          </div>
        ) : null}

        {bottomNav ? (
          <div className="shrink-0 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl">
            {bottomNav}
          </div>
        ) : null}

        {floatingActionButton ? (
          <div className="pointer-events-none absolute bottom-[calc(var(--bottom-nav-height,64px)+1rem+env(safe-area-inset-bottom,0px))] right-4 z-20">
            <div className="pointer-events-auto">{floatingActionButton}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
