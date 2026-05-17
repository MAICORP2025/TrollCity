import { useState, useCallback, useEffect } from 'react';

interface BattleUser {
  id: string;
  username: string;
  avatar_url?: string;
  gifts: number;
  [key: string]: any;
}

export function useBattleQueue(onBattleEnd?: () => Promise<void> | void) {
  const [queue, setQueue] = useState<BattleUser[]>([]);
  const [leftUser, setLeftUser] = useState<BattleUser | null>(null);
  const [rightUser, setRightUser] = useState<BattleUser | null>(null);

  // Auto-fill slots from queue
  useEffect(() => {
    // If we have queue items and empty slots, fill them
    // We use a small timeout to avoid state update loops if multiple slots open at once
    const timeout = setTimeout(() => {
        setQueue(currentQueue => {
            if (currentQueue.length === 0) return currentQueue;
            
            const newQueue = [...currentQueue];
            let changed = false;

            // Try to fill left
            if (!leftUser && newQueue.length > 0) {
                setLeftUser(newQueue[0]);
                newQueue.shift();
                changed = true;
            }

            // Try to fill right (from potentially modified queue)
            if (!rightUser && newQueue.length > 0) {
                setRightUser(newQueue[0]);
                newQueue.shift();
                changed = true;
            }

            return changed ? newQueue : currentQueue;
        });
    }, 100);

    return () => clearTimeout(timeout);
  }, [queue.length, leftUser, rightUser]);

  const joinQueue = useCallback((user: any) => {
    if (!user) return;
    
    // Check if already in battle or queue
    if (leftUser?.id === user.id || rightUser?.id === user.id) return;
    
    setQueue(prev => {
      if (prev.find(u => u.id === user.id)) return prev;
      return [...prev, { ...user, gifts: 0 }];
    });
  }, [leftUser, rightUser]);

  const removeUser = useCallback((userId: string) => {
    if (leftUser?.id === userId) {
        setLeftUser(null);
    } else if (rightUser?.id === userId) {
        setRightUser(null);
    } else {
        setQueue(prev => prev.filter(u => u.id !== userId));
    }
  }, [leftUser, rightUser]);

  const updateGift = useCallback((userId: string, amount: number) => {
    if (leftUser?.id === userId) {
      setLeftUser(prev => prev ? { ...prev, gifts: (prev.gifts || 0) + amount } : null);
    } else if (rightUser?.id === userId) {
      setRightUser(prev => prev ? { ...prev, gifts: (prev.gifts || 0) + amount } : null);
    }
  }, [leftUser?.id, rightUser?.id]);

  const rotateBattle = useCallback(async () => {
     // Reset gifts for safety or clear users
     // Logic: Both leave the stage, next 2 come in
     // Or winner stays? For now, clear both to allow queue rotation
     setLeftUser(null);
     setRightUser(null);
     if (onBattleEnd) {
         await onBattleEnd();
     }
  }, [onBattleEnd]);

  return {
    queue,
    leftUser,
    rightUser,
    joinQueue,
    removeUser,
    updateGift,
    rotateBattle
  };
}
