import { useState, useEffect, useCallback } from 'react';

export function useBattleTimer(leftUser, rightUser, onTimerEnd) {
  const [timer, setTimer] = useState(180); // 3 minutes
  const [isRunning, setIsRunning] = useState(false);

  // Check if both users are active
  const bothActive = leftUser && rightUser;

  useEffect(() => {
    if (bothActive && !isRunning) {
      // Start timer when both users are active
      setIsRunning(true);
      setTimer(180);
    } else if (!bothActive && isRunning) {
      // Stop timer when not both active
      setIsRunning(false);
    }
  }, [bothActive, isRunning]);

  useEffect(() => {
    if (!isRunning || timer <= 0) return;

    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          if (onTimerEnd) onTimerEnd();
          return 180; // Reset for next round
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timer, onTimerEnd]);

  const resetTimer = useCallback(() => {
    setTimer(180);
  }, []);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const startTimer = useCallback(() => {
    if (bothActive) {
      setIsRunning(true);
      setTimer(180);
    }
  }, [bothActive]);

  return {
    timer,
    isRunning,
    resetTimer,
    stopTimer,
    startTimer
  };
}