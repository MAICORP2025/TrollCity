/**
 * React Hook: useInstallPrompt
 * Captures and manages the beforeinstallprompt event for Android/Chrome/Edge.
 *
 * The event is captured at module level (before React mounts) so we never miss it.
 * We do NOT call e.preventDefault() at capture time — that blocks Chrome's default
 * mini-infobar and can prevent the event from firing on subsequent visits.
 * preventDefault is only called inside promptInstall() right before we show our
 * own prompt.
 */

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level capture — runs before React mounts
let gDeferredPrompt: BeforeInstallPromptEvent | null = null;
let gInstallOutcome: 'accepted' | 'dismissed' | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Store the event but do NOT call preventDefault here.
    // Let the browser show its default mini-infobar so the user sees install is available.
    gDeferredPrompt = e as BeforeInstallPromptEvent;
    gInstallOutcome = null;
    console.log('[PWA] beforeinstallprompt captured');
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    gDeferredPrompt = null;
    gInstallOutcome = 'accepted';
  });
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    gDeferredPrompt
  );
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Sync with module-level if captured before mount
    if (gDeferredPrompt && !deferredPrompt) {
      setDeferredPrompt(gDeferredPrompt);
    }
  }, [deferredPrompt]);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    const prompt = deferredPrompt || gDeferredPrompt;
    if (!prompt) {
      console.warn('[PWA] No install prompt available');
      return null;
    }

    setIsInstalling(true);

    try {
      // NOW we prevent default — right before showing the prompt
      prompt.preventDefault();
      await prompt.prompt();
      const choiceResult = await prompt.userChoice;
      console.log('[PWA] User choice:', choiceResult.outcome);
      gDeferredPrompt = null;
      setDeferredPrompt(null);
      return choiceResult.outcome;
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      return null;
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt]);

  const clearPrompt = useCallback(() => {
    gDeferredPrompt = null;
    setDeferredPrompt(null);
  }, []);

  return {
    deferredPrompt: deferredPrompt || gDeferredPrompt,
    canPromptInstall: (deferredPrompt || gDeferredPrompt) !== null,
    isInstalling,
    promptInstall,
    clearPrompt,
  };
}
