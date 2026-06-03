/**
 * React Hook: useInstallPrompt
 * Captures and manages the beforeinstallprompt event for Android/Chrome/Edge.
 *
 * The event is captured at module level (before React mounts) so we never miss it.
 * We call e.preventDefault() at capture time to suppress Chrome's default mini-infobar
 * and instead show our own custom install button. The stored event is later used
 * by promptInstall() to trigger the native install prompt on user demand.
 *
 * Uses useSyncExternalStore for reliable cross-render synchronization,
 * ensuring the install button always reflects the correct prompt availability.
 */

import { useState, useCallback, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level capture — runs before React mounts
let gDeferredPrompt: BeforeInstallPromptEvent | null = null;
let gListeners: Array<() => void> = [];

function notifyListeners() {
  gListeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome's default mini-infobar so we can show our own button.
    // The event is stored for later use by promptInstall().
    e.preventDefault();
    gDeferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA] beforeinstallprompt captured and stored');
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    gDeferredPrompt = null;
    notifyListeners();
  });
}

function subscribe(listener: () => void) {
  gListeners.push(listener);
  return () => {
    gListeners = gListeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): BeforeInstallPromptEvent | null {
  return gDeferredPrompt;
}

export function useInstallPrompt() {
  // Use useSyncExternalStore for reliable cross-render synchronization.
  // This ensures the component always re-renders when the prompt becomes available,
  // even if the event fired before the component mounted.
  const deferredPrompt = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [isInstalling, setIsInstalling] = useState(false);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    const prompt = gDeferredPrompt;
    if (!prompt) {
      console.warn('[PWA] No install prompt available');
      return null;
    }

    setIsInstalling(true);

    try {
      await prompt.prompt();
      const choiceResult = await prompt.userChoice;
      console.log('[PWA] User choice:', choiceResult.outcome);
      gDeferredPrompt = null;
      notifyListeners();
      return choiceResult.outcome;
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      return null;
    } finally {
      setIsInstalling(false);
    }
  }, []);

  const clearPrompt = useCallback(() => {
    gDeferredPrompt = null;
    notifyListeners();
  }, []);

  return {
    deferredPrompt,
    canPromptInstall: deferredPrompt !== null,
    isInstalling,
    promptInstall,
    clearPrompt,
  };
}
