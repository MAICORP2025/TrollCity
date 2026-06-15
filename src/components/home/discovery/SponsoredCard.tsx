import React from 'react'
import { cn } from '@/lib/utils'

interface SponsoredCardProps {
  title: string
  subtitle?: string
  ctaText?: string
  icon?: React.ReactNode
  gradient?: string
  onClick?: () => void
  className?: string
}

export default function SponsoredCard({
  title,
  subtitle,
  ctaText = 'Learn More',
  icon,
  gradient = 'from-purple-500/20 to-cyan-500/10 border-purple-500/20',
  onClick,
  className,
}: SponsoredCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'snap-start flex-shrink-0 w-[200px] rounded-2xl border bg-gradient-to-b p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.02]',
        gradient,
        className
      )}
    >
      {icon && <div className="mb-2">{icon}</div>}
      <p className="text-xs font-black text-white mb-0.5">{title}</p>
      {subtitle && <p className="text-[9px] text-slate-400 mb-2">{subtitle}</p>}
      <span className="text-[9px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-0.5">
        {ctaText}
      </span>
      <p className="text-[8px] text-slate-600 mt-1.5 uppercase tracking-wider">Sponsored</p>
    </div>
  )
}
