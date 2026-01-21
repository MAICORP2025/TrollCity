/**
 * React Hook: useInstallPrompt
 * Captures and manages the beforeinstallprompt event for Android/Chrome
 */

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      console.log('[PWA] beforeinstallprompt event captured');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  /**
   * Triggers the native install prompt (Android/Chrome)
   * Returns the user's choice
   */
  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) {
      console.warn('[PWA] No install prompt available');
      return null;
    }

    setIsInstalling(true);

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user to respond
      const choiceResult = await deferredPrompt.userChoice;
      
      console.log('[PWA] User choice:', choiceResult.outcome);

      // Clear the prompt after use
      setDeferredPrompt(null);
      
      return choiceResult.outcome;
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      return null;
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt]);

  /**
   * Manually clear the deferred prompt (e.g., user dismissed the button)
   */
  const clearPrompt = useCallback(() => {
    setDeferredPrompt(null);
  }, []);

  return {
    /** The captured beforeinstallprompt event (null if not available) */
    deferredPrompt,
    
    /** Whether an install prompt is available */
    canPromptInstall: deferredPrompt !== null,
    
    /** Whether an install is in progress */
    isInstalling,
    
    /** Trigger the install prompt */
    promptInstall,
    
    /** Clear the deferred prompt */
    clearPrompt,
  };
}
