import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import EntranceBanner from './EntranceEffect'
import ChatOverlay from './ChatOverlay'
import { AnimatePresence } from 'framer-motion'

interface EntranceChatPanelProps {
  streamId: string | undefined
}

interface EntranceEvent {
  id: string
  username: string
  role: 'viewer' | 'troller' | 'officer' | 'vip' | 'donor'
  timestamp: number
  profile?: any
}

type UserRole = 'viewer' | 'troller' | 'officer' | 'vip' | 'donor'

function determineUserRole(profile: any): UserRole {
  // Check role field
  if (profile.role === 'troll_officer' || profile.role === 'moderator' || profile.role === 'admin' || profile.is_admin) {
    return 'officer'
  }
  if (profile.role === 'troller' || profile.role === 'troll_family') {
    return 'troller'
  }

  // Check VIP/Donor status (high coin spending or balance)
  const totalSpent = profile.total_spent_coins || 0
  const paidBalance = profile.troll_coins || 0

  if (totalSpent > 100000 || paidBalance > 50000) {
    return 'donor'
  }
  if (totalSpent > 50000 || paidBalance > 20000) {
    return 'vip'
  }

  return 'viewer'
}

export default function EntranceChatPanel({ streamId }: EntranceChatPanelProps) {
  const [entranceEvents, setEntranceEvents] = useState<EntranceEvent[]>([])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`entrance-chat-${streamId}`)
      .on(
        'broadcast',
        { event: 'user_joined' },
        (payload) => {
           const { user_id, username, profile: rawProfile } = payload.payload;
           if (!username) return;

           // Use provided profile data or fallbacks
           const profileData = rawProfile || {};
           const role = determineUserRole(profileData);
           const entranceId = `${user_id}-${Date.now()}`;
           
           setEntranceEvents((prev) => [
             ...prev,
             {
               id: entranceId,
               username: username,
               role,
               timestamp: Date.now(),
               profile: {
                 is_troll_officer: profileData.is_troll_officer,
                 is_og_user: profileData.is_og_user,
                 role: profileData.role,
               },
             },
           ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

  const handleComplete = (id: string) => {
    setEntranceEvents((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <>
      {/* Entrance Events */}
      <div className="space-y-2 mb-3 max-h-[150px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {entranceEvents.map((event) => (
            <EntranceBanner
              key={event.id}
              username={event.username}
              role={event.role}
              profile={event.profile}
              onComplete={() => handleComplete(event.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Chat Messages - Compact version for sidebar */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatOverlay streamId={streamId} compact={true} />
      </div>
    </>
  )
}

