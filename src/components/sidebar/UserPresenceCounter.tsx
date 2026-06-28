import React from 'react';
import { usePresenceStore } from '@/lib/presenceStore';
import { Users } from 'lucide-react';

/**
 * UserPresenceCounter — displays online user count.
 * 
 * OPTIMIZED: Uses the global presence store instead of creating its own channel.
 * The GlobalPresenceTracker component handles the single shared presence channel.
 */
const UserPresenceCounter = () => {
  const onlineCount = usePresenceStore(state => state.onlineCount);

  return (
    <span className="text-xs text-slate-400">
      {onlineCount}
    </span>
  );
};

export default UserPresenceCounter;
