import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useProfileFrameStore } from '@/stores/useProfileFrameStore'
import { getFrameById } from '@/config/profileFrames'
 

interface ProfileDropdownProps {
  className?: string
}

export default function ProfileDropdown({ className }: ProfileDropdownProps) {
  const { profile } = useAuthStore()
  const { equippedFrame: storeFrame } = useProfileFrameStore()
  const frame = storeFrame || (profile?.active_frame_id ? getFrameById(profile.active_frame_id) : null)

  if (!profile) return null

  return (
    <div className={`relative flex items-center gap-1 ${className}`}>
      <Link
        to={`/profile/${profile.username}`}
        className="relative group outline-none"
      >
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full group-hover:scale-105 transition-transform duration-300">
          <ProfileFrame
            frame={frame}
            avatarUrl={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username || 'user'}`}
            size="xs"
            username={profile.username || ''}
            fillParent
          />
        </div>
      </Link>
    </div>
  )
}
