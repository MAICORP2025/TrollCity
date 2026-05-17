import { useEffect, useState, useCallback } from 'react';

export type VisibilityState = 'visible' | 'hidden' | 'prerender' | 'unloaded';

export interface UsePageVisibilityReturn {
  isVisible: boolean;
  visibilityState: VisibilityState;
  onVisibilityChange: (callback: (isVisible: boolean, state: VisibilityState) => void) => () => void;
}

export function usePageVisibility(): UsePageVisibilityReturn {
  const [isVisible, setIsVisible] = useState<boolean>(!document.hidden);
  const [visibilityState, setVisibilityState] = useState<VisibilityState>(
    document.visibilityState as VisibilityState
  );

  const handleVisibilityChange = useCallback(() => {
    const newIsVisible = !document.hidden;
    const newVisibilityState = document.visibilityState as VisibilityState;

    setIsVisible(newIsVisible);
    setVisibilityState(newVisibilityState);
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set initial state
    handleVisibilityChange();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  const onVisibilityChange = useCallback(
    (callback: (isVisible: boolean, state: VisibilityState) => void) => {
      const handler = () => callback(isVisible, visibilityState);

      // Call immediately with current state
      handler();

      // Return cleanup function
      return () => {
        // The callback is already called in the useEffect when visibility changes
      };
    },
    [isVisible, visibilityState]
  );

  return {
    isVisible,
    visibilityState,
    onVisibilityChange,
  };
}

// Utility function to check if page visibility API is supported
export function isPageVisibilitySupported(): boolean {
  return typeof document !== 'undefined' &&
         typeof document.hidden !== 'undefined' &&
         typeof document.visibilityState !== 'undefined' &&
         typeof document.addEventListener !== 'undefined';
}