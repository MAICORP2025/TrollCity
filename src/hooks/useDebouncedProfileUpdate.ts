import { useEffect, useRef } from 'react';
import { useAuthStore } from '../lib/store';

export const useDebouncedProfileUpdate = (userId?: string) => {
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    // Prevent immediate re-run if just updated (debounce)
    const now = Date.now();
    if (now - lastUpdateRef.current < 1000) return;

    const timeoutId = setTimeout(async () => {
      try {
        await refreshProfile();
        lastUpdateRef.current = Date.now();
      } catch (error) {
        console.error('Debounced profile update error:', error);
      }
    }, 1000); // Increased to 1000ms to be safe

    return () => clearTimeout(timeoutId);
  }, [userId, refreshProfile]);
};