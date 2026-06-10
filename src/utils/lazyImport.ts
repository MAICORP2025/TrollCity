import { lazy, ComponentType } from 'react';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isChunkError = (error: any): boolean =>
  error.message?.includes('Failed to fetch dynamically imported module') ||
  error.message?.includes('Importing a module script failed') ||
  error.message?.includes('Loading chunk') ||
  error.message?.includes('Loading CSS chunk') ||
  error.name === 'ChunkLoadError';

/**
 * A wrapper around React.lazy that retries failed dynamic imports
 * and falls back to a page reload on persistent chunk load errors
 * (e.g., due to deployment updates / stale chunk hashes).
 *
 * Retries up to MAX_RETRIES times with a short delay, then reloads
 * the page once (rate-limited to once per 30s) to pick up new assets.
 */
export const lazyWithRetry = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) => {
  return lazy(async () => {
    let lastError: any;

    // Retry loop: attempt the import multiple times before giving up
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await factory();
      } catch (error: any) {
        lastError = error;
        console.warn(`[lazyWithRetry] Import attempt ${attempt + 1} failed:`, error?.message || error);

        if (!isChunkError(error)) {
          // Not a chunk error — re-throw immediately
          throw error;
        }

        if (attempt < MAX_RETRIES) {
          // Wait before retrying (allows transient network issues to resolve)
          await delay(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }

    // All retries exhausted — try a page reload to pick up new assets
    console.error('[lazyWithRetry] All import attempts failed, attempting reload');
    if (typeof window !== 'undefined') {
      const storageKey = 'lazy-chunk-reload-ts';
      const lastReload = sessionStorage.getItem(storageKey);
      const now = Date.now();

      if (!lastReload || (now - parseInt(lastReload)) > 30000) {
        sessionStorage.setItem(storageKey, now.toString());
        console.log('[lazyWithRetry] Reloading due to persistent chunk load error...');
        window.location.reload();
        // Return a promise that never resolves while reloading to suspend React
        return new Promise(() => {});
      } else {
        console.warn('[lazyWithRetry] Chunk load error but recently reloaded, not reloading again');
      }
    }

    // Re-throw the last error if we can't or shouldn't reload
    throw lastError;
  });
};
