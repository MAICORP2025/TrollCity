import { useState, useCallback, useEffect, useRef } from 'react';

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

  const previousLeftRef = useRef<BattleUser | null>(null);
  const previousRightRef = useRef<BattleUser | null>(null);
  const prevQueueLenRef = useRef(0);
  const autoFillTimerRef = useRef<number | null>(null);
  const isAutoFillingRef = useRef(false);

  const tryAutoFill = useCallback(() => {
    if (isAutoFillingRef.current) return;
    isAutoFillingRef.current = true;

    const currentLeft = leftUser;
    const currentRight = rightUser;

    setQueue(currentQueue => {
      if (currentQueue.length === 0) return currentQueue;
      if (currentLeft && currentRight) return currentQueue;

      const newQueue = [...currentQueue];
      const fillLeft = !currentLeft;
      const fillRight = !currentRight;
      const toAssign: BattleUser[] = [];

      if (fillLeft && newQueue.length > 0) {
        toAssign.push(newQueue[0]);
        newQueue.shift();
      }
      if (fillRight && newQueue.length > 0) {
        toAssign.push(newQueue[0]);
        newQueue.shift();
      }

      if (toAssign.length > 0) {
        Promise.resolve().then(() => {
          if (toAssign[0]) setLeftUser(toAssign[0]);
          if (toAssign[1]) setRightUser(toAssign[1]);
          isAutoFillingRef.current = false;
        });
      } else {
        isAutoFillingRef.current = false;
      }

      return toAssign.length > 0 ? newQueue : currentQueue;
    });
  }, [leftUser, rightUser]);

  useEffect(() => {
    if (autoFillTimerRef.current !== null) {
      clearTimeout(autoFillTimerRef.current);
    }

    const hadBothSlots = previousLeftRef.current !== null && previousRightRef.current !== null;
    const hasVacancy = leftUser === null || rightUser === null;
    const queueGrew = queue.length > prevQueueLenRef.current;

    if (hadBothSlots && hasVacancy) {
      autoFillTimerRef.current = window.setTimeout(() => {
        autoFillTimerRef.current = null;
        tryAutoFill();
      }, 100);
    } else if (!hadBothSlots && queueGrew) {
      autoFillTimerRef.current = window.setTimeout(() => {
        autoFillTimerRef.current = null;
        tryAutoFill();
      }, 100);
    }

    previousLeftRef.current = leftUser;
    previousRightRef.current = rightUser;
    prevQueueLenRef.current = queue.length;

    return () => {
      if (autoFillTimerRef.current !== null) {
        clearTimeout(autoFillTimerRef.current);
        autoFillTimerRef.current = null;
      }
    };
  }, [queue.length, leftUser, rightUser, tryAutoFill]);

  const joinQueue = useCallback((user: any) => {
    if (!user) return;
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
