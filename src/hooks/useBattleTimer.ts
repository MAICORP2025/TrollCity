import { useState, useEffect, useRef } from 'react';

export function useBattleTimer(
  leftUser: any, 
  rightUser: any, 
  onTimerEnd: () => void,
  initialTime: number = 180
) {
  const [timer, setTimer] = useState(initialTime);
  const isActive = !!(leftUser && rightUser);
  const onTimerEndRef = useRef(onTimerEnd);

  // Keep ref updated to avoid effect dependency issues
  useEffect(() => {
    onTimerEndRef.current = onTimerEnd;
  }, [onTimerEnd]);

  useEffect(() => {
    if (!isActive) {
      setTimer(initialTime); // Reset when not active
      return;
    }

    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Execute callback on next tick to avoid state update collision
          setTimeout(() => {
              if (onTimerEndRef.current) onTimerEndRef.current();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, initialTime]);

  return { timer };
}
