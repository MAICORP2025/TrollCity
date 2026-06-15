import React from 'react'
import { Shield, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnnouncementCardProps {
  announcement: {
    id: string
    title: string
    content: string
    type?: 'system' | 'event' | 'election' | 'patch' | 'community'
    icon?: string
    link?: string
    created_at: string
  }
  onClick?: (id: string) => void
  className?: string
}

const TYPE_COLORS: Record<string, string> = {
  system: 'from-blue-500/20 to-cyan-500/10 border-blue-500/20',
  event: 'from-purple-500/20 to-pink-500/10 border-purple-500/20',
  election: 'from-amber-500/20 to-yellow-500/10 border-amber-500/20',
  patch: 'from-green-500/20 to-emerald-500/10 border-green-500/20',
  community: 'from-pink-500/20 to-rose-500/10 border-pink-500/20',
}

export default function AnnouncementCard({ announcement, onClick, className }: AnnouncementCardProps) {
  const colorClass = TYPE_COLORS[announcement.type || 'system'] || TYPE_COLORS.system

  return (
    <div
      onClick={() => onClick?.(announcement.id)}
      className={cn(
        'snap-start flex-shrink-0 w-[220px] rounded-2xl border bg-gradient-to-b p-3 cursor-pointer transition-all hover:scale-[1.02]',
        colorClass,
        className
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
          {announcement.icon ? (
            <span className="text-base">{announcement.icon}</span>
          ) : (
            <Shield className="w-4 h-4 text-cyan-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-white leading-tight">{announcement.title}</p>
          <p className="text-[9px] text-slate-400 mt-0.5">
            {new Date(announcement.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-300 line-clamp-3 leading-tight mb-2">{announcement.content}</p>
      {announcement.link && (
        <span className="flex items-center gap-1 text-[9px] font-bold text-cyan-300 hover:text-cyan-200 transition-colors">
          Read more <ChevronRight className="w-3 h-3" />
        </span>
      )}
    </div>
  )
}
