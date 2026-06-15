import React, { useRef, useState, useCallback, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DiscoverySectionProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  showArrows?: boolean
  /** If true, uses a grid instead of horizontal scroll */
  grid?: boolean
  /** Max height for the scroll container */
  maxScrollHeight?: string
  /** Optional right side header content (e.g., "View All" link) */
  headerExtra?: ReactNode
}

export default function DiscoverySection({
  title,
  icon,
  children,
  className,
  headerClassName,
  showArrows = true,
  grid = false,
  maxScrollHeight,
  headerExtra,
}: DiscoverySectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, scrollLeft: 0 })

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.75
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
    setTimeout(checkScroll, 400)
  }, [checkScroll])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current
    if (!el) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, scrollLeft: el.scrollLeft }
    el.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    const el = scrollRef.current
    if (!el) return
    const dx = e.clientX - dragStart.current.x
    el.scrollLeft = dragStart.current.scrollLeft - dx
    checkScroll()
  }, [isDragging, checkScroll])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  return (
    <section className={cn('group/section', className)}>
      {/* Section Header */}
      <div className={cn('flex items-center justify-between mb-3', headerClassName)}>
        <div className="flex items-center gap-2">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          {showArrows && !grid && (
            <>
              <button
                onClick={() => scroll('left')}
                className={cn(
                  'w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all',
                  !canScrollLeft && 'opacity-0 pointer-events-none'
                )}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => scroll('right')}
                className={cn(
                  'w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all',
                  !canScrollRight && 'opacity-0 pointer-events-none'
                )}
              >
                <ChevronRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      {grid ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {children}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            'flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory',
            'scrollbar-hide',
            isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
          )}
          style={{ maxHeight: maxScrollHeight }}
        >
          {children}
        </div>
      )}
    </section>
  )
}
