import React from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NewUserCardProps {
  user: {
    id: string
    username: string
    display_name?: string | null
    avatar_url?: string | null
    created_at?: string
    bio?: string | null
  }
  onFollow?: (userId: string) => void
  className?: string
}

export default function NewUserCard({ user, onFollow, className }: NewUserCardProps) {
  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      className={cn(
        'snap-start flex-shrink-0 w-[160px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center transition-all hover:border-cyan-400/30 hover:bg-white/[0.07] group/card',
        className
      )}
    >
      <Link to={`/profile/${user.username}`} className="block">
        <div className="relative mx-auto w-14 h-14 mb-2">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username}
              className="w-full h-full rounded-full object-cover ring-2 ring-white/10 group-hover/card:ring-cyan-400/40 transition-all"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center ring-2 ring-white/10 group-hover/card:ring-cyan-400/40 transition-all">
              <span className="text-white font-bold text-lg">
                {(user.display_name || user.username || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-[#070b19]" />
        </div>
        <p className="text-xs font-black text-white truncate">{user.display_name || user.username}</p>
        <p className="text-[10px] text-slate-400 truncate">@{user.username}</p>
      </Link>
      {joinDate && (
        <p className="text-[9px] text-slate-500 mt-1">Joined {joinDate}</p>
      )}
      {user.bio && (
        <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">{user.bio}</p>
      )}
      {onFollow && (
        <button
          onClick={(e) => { e.preventDefault(); onFollow(user.id) }}
          className="mt-2 w-full flex items-center justify-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all"
        >
          <UserPlus size={10} />
          Follow
        </button>
      )}
    </div>
  )
}
