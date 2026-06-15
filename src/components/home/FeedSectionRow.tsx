import React, { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface FeedSectionRowProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  viewAllLink?: string
  onViewAll?: () => void
  scrollable?: boolean
  className?: string
}

export default function FeedSectionRow({
  title,
  subtitle,
  icon,
  children,
  onViewAll,
  scrollable = false,
  className = '',
}: FeedSectionRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = dir === 'left' ? -300 : 300
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <section className={`relative ${className}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">{icon}</div>}
          <div>
            <h3 className="text-sm font-black text-white">{title}</h3>
            {subtitle && <p className="text-[10px] font-bold text-white/35">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scrollable && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => scroll('left')}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-cyan-400/70 transition hover:text-cyan-300"
            >
              View All
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {scrollable ? (
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {children}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      )}
    </section>
  )
}
