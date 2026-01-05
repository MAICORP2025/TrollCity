import { useState, useEffect, useCallback } from 'react';

export function useBattleQueue(onTimerEnd) {
  const [queue, setQueue] = useState([]);
  const [leftUser, setLeftUser] = useState(null);
  const [rightUser, setRightUser] = useState(null);
  const [timer, setTimer] = useState(180); // 3 minutes
  const [isActive, setIsActive] = useState(false);

  // Timer effect
  useEffect(() => {
    if (!isActive || timer <= 0) return;

    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          // Timer reached 0, call callback and rotate
          if (onTimerEnd) onTimerEnd();
          rotateBattle();
          return 180; // Reset timer
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timer, onTimerEnd, rotateBattle]);

  const rotateBattle = useCallback(() => {
    // Stop current streams
    if (leftUser?.stopStream) leftUser.stopStream();
    if (rightUser?.stopStream) rightUser.stopStream();

    // Add current users back to queue if they were active
    if (leftUser) {
      setQueue(prev => [...prev, leftUser]);
    }
    if (rightUser) {
      setQueue(prev => [...prev, rightUser]);
    }

    // Clear current positions
    setLeftUser(null);
    setRightUser(null);

    // Place next users from queue
    setQueue(prev => {
      const newQueue = [...prev];
      const nextLeft = newQueue.shift();
      const nextRight = newQueue.shift();

      if (nextLeft) {
        setLeftUser(nextLeft);
        nextLeft.startStream?.();
      }
      if (nextRight) {
        setRightUser(nextRight);
        nextRight.startStream?.();
      }

      return newQueue;
    });
  }, [leftUser, rightUser]);

  const joinQueue = useCallback((user, preferredSide = null) => {
    // Check if user is already in queue or active
    if (queue.some(u => u.id === user.id) ||
        leftUser?.id === user.id ||
        rightUser?.id === user.id) {
      return false;
    }

    setQueue(prev => [...prev, { ...user, preferredSide }]);

    // Try to place immediately if spot available
    if (preferredSide === 'left' && !leftUser) {
      setQueue(prev => prev.filter(u => u.id !== user.id)); // Remove from queue
      setLeftUser(user);
      user.startStream?.();
    } else if (preferredSide === 'right' && !rightUser) {
      setQueue(prev => prev.filter(u => u.id !== user.id));
      setRightUser(user);
      user.startStream?.();
    } else if (!preferredSide) {
      // No preference, place in first available
      if (!leftUser) {
        setQueue(prev => prev.filter(u => u.id !== user.id));
        setLeftUser(user);
        user.startStream?.();
      } else if (!rightUser) {
        setQueue(prev => prev.filter(u => u.id !== user.id));
        setRightUser(user);
        user.startStream?.();
      }
    }

    // If battle not started and we have users, start it
    if (!isActive && (leftUser || rightUser)) {
      setIsActive(true);
    }

    return true;
  }, [queue, leftUser, rightUser, isActive]);

  const removeUser = useCallback((userId) => {
    // Remove from queue
    setQueue(prev => prev.filter(u => u.id !== userId));

    // Remove from active positions
    if (leftUser?.id === userId) {
      leftUser.stopStream?.();
      setLeftUser(null);
      // Try to place next from queue
      setQueue(prev => {
        const newQueue = [...prev];
        const next = newQueue.shift();
        if (next) {
          setLeftUser(next);
          next.startStream?.();
        }
        return newQueue;
      });
    }

    if (rightUser?.id === userId) {
      rightUser.stopStream?.();
      setRightUser(null);
      setQueue(prev => {
        const newQueue = [...prev];
        const next = newQueue.shift();
        if (next) {
          setRightUser(next);
          next.startStream?.();
        }
        return newQueue;
      });
    }
  }, [leftUser, rightUser]);

  const startBattle = useCallback(() => {
    setIsActive(true);
    setTimer(180);
  }, []);

  const updateGift = useCallback((side, amount) => {
    if (side === 'left' && leftUser) {
      setLeftUser(prev => prev ? { ...prev, gifts: prev.gifts + amount } : null);
    } else if (side === 'right' && rightUser) {
      setRightUser(prev => prev ? { ...prev, gifts: prev.gifts + amount } : null);
    }
  }, [leftUser, rightUser]);

  const stopBattle = useCallback(() => {
    setIsActive(false);
    setTimer(180);
    // Stop all streams
    leftUser?.stopStream?.();
    rightUser?.stopStream?.();
    setLeftUser(null);
    setRightUser(null);
    setQueue([]);
  }, [leftUser, rightUser]);

  return {
    queue,
    leftUser,
    rightUser,
    timer,
    isActive,
    joinQueue,
    removeUser,
    updateGift,
    rotateBattle,
    startBattle,
    stopBattle
  };
}