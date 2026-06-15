import React, { useRef, useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface HorizontalScrollRowProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  onViewAll?: () => void
  className?: string
}

export default function HorizontalScrollRow({
  title,
  subtitle,
  icon,
  children,
  onViewAll,
  className = '',
}: HorizontalScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartScrollLeft = useRef(0)
  const hasDragged = useRef(false)

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 5)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5)
  }, [])

  // ── Drag-to-scroll (mouse) ──────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!scrollRef.current) return
    // Only primary button / single touch
    isDragging.current = true
    hasDragged.current = false
    dragStartX.current = e.clientX
    dragStartScrollLeft.current = scrollRef.current.scrollLeft
    scrollRef.current.style.scrollSnapType = 'none'
    scrollRef.current.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !scrollRef.current) return
    const dx = e.clientX - dragStartX.current
    if (Math.abs(dx) > 3) hasDragged.current = true
    scrollRef.current.scrollLeft = dragStartScrollLeft.current - dx
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    if (scrollRef.current) {
      scrollRef.current.releasePointerCapture(e.pointerId)
      scrollRef.current.style.scrollSnapType = ''
    }
    checkScroll()
  }, [checkScroll])

  // ── Drag-to-scroll (touch – for mobile) ─────────────────────────
  const touchStartX = useRef(0)
  const touchStartScrollLeft = useRef(0)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current) return
    touchStartX.current = e.touches[0].clientX
    touchStartScrollLeft.current = scrollRef.current.scrollLeft
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current) return
    const dx = e.touches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 5) {
      e.preventDefault()
      scrollRef.current.scrollLeft = touchStartScrollLeft.current - dx
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    checkScroll()
  }, [checkScroll])

  // ── Suppress click after drag so tiles don't fire onClick ────────
  const suppressClick = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.preventDefault()
      e.stopPropagation()
      hasDragged.current = false
    }
  }, [])

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = dir === 'left' ? -320 : 320
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
    setTimeout(checkScroll, 400)
  }

  return (
    <section className={`relative group/row ${className}`}>
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">{icon}</div>}
          <div>
            <h3 className="text-sm font-black text-white">{title}</h3>
            {subtitle && <p className="text-[10px] font-bold text-white/30">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-cyan-400/70 transition hover:text-cyan-300"
            >
              View All
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
          {/* Scroll arrows */}
          <button
            onClick={() => scroll('left')}
            className={`flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white ${
              !canScrollLeft ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover/row:opacity-100'
            }`}
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            onClick={() => scroll('right')}
            className={`flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white ${
              !canScrollRight ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover/row:opacity-100'
            }`}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={suppressClick}
        className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide cursor-grab active:cursor-grabbing select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </section>
  )
}
