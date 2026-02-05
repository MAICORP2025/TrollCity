import { useState, useEffect } from 'react';

export function useLiveTimer(startTime: string | null | undefined, isLive: boolean) {
  const [timer, setTimer] = useState('00:00:00');

  useEffect(() => {
    if (!isLive || !startTime) return;

    const start = new Date(startTime).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const elapsed = Math.floor((now - start) / 1000);
      
      if (elapsed < 0) {
          setTimer('00:00:00');
          return;
      }

      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setTimer(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isLive]);

  return timer;
}
