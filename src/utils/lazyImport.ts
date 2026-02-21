import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that automatically reloads the page
 * if a dynamic import fails (e.g., due to deployment updates/chunk version mismatches).
 */
export const lazyWithRetry = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) => {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      console.error('Lazy load error:', error);
      
      const isChunkError = 
        error.message?.includes('Failed to fetch dynamically imported module') ||
        error.message?.includes('Importing a module script failed') ||
        error.name === 'ChunkLoadError';

      if (isChunkError) {
        const env = (import.meta as any).env
        if (typeof window !== 'undefined' && env.PROD) {
          // Prevent reload storms: only reload once per tab/session for chunk mismatch.
          const storageKey = 'lazy-chunk-reload-once'
          const alreadyReloaded = sessionStorage.getItem(storageKey)
          if (!alreadyReloaded) {
            sessionStorage.setItem(storageKey, '1')
            console.log('Reloading due to chunk load error...')
            window.location.reload()
            // Return a promise that never resolves while reloading to suspend React
            return new Promise(() => {})
          }
        }
      }
      
      // If not a chunk error or we already retried, re-throw
      throw error;
    }
  });
};
