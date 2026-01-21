/**
 * PWA Install Detection Helpers
 * Robust detection for iOS, Safari, standalone mode, and install prompt support
 */

/**
 * Detects if device is iOS (iPhone, iPad, iPod)
 * Includes iPadOS detection (Safari reports as MacIntel with touch support)
 */
export function isIos(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
  
  // iPadOS detection: Safari on iPad reports as "MacIntel" but has touch support
  const isMacWithTouch = /macintosh|mac os x/.test(userAgent) && 
                         'ontouchend' in document &&
                         navigator.maxTouchPoints > 1;
  
  return isIosDevice || isMacWithTouch;
}

/**
 * Detects if browser is Safari (not Chrome or Firefox on iOS)
 * iOS Chrome/Firefox are just Safari wrappers but we try to detect them
 */
export function isSafari(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const vendor = window.navigator.vendor?.toLowerCase() || '';
  
  // Safari has vendor = "Apple Computer, Inc." and safari in UA
  const isSafariBrowser = /safari/.test(userAgent) && /apple/i.test(vendor);
  
  // Exclude Chrome and Firefox (even though they're Safari wrappers on iOS)
  const isChrome = /crios|chrome/.test(userAgent);
  const isFirefox = /fxios|firefox/.test(userAgent);
  
  return isSafariBrowser && !isChrome && !isFirefox;
}

/**
 * Detects if app is running in standalone mode (installed as PWA)
 * Works for both iOS and Android
 */
export function isStandalone(): boolean {
  // iOS standalone check
  const iosStandalone = (window.navigator as any).standalone === true;
  
  // Standard display-mode check (works on Android/Desktop)
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Fallback: fullscreen mode
  const fullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  
  return iosStandalone || displayStandalone || fullscreen;
}

/**
 * Checks if browser supports beforeinstallprompt (Android/Chrome/Edge)
 * Note: This just checks if the event fired, actual availability tracked by hook
 */
export function supportsInstallPrompt(): boolean {
  return 'onbeforeinstallprompt' in window;
}

/**
 * Gets the install prompt status for the current device
 * Returns what action the install button should take
 */
export type InstallStatus = 
  | 'installed'          // Already installed (standalone mode)
  | 'prompt-available'   // Android/Chrome with beforeinstallprompt
  | 'ios-manual'         // iOS Safari, needs manual instructions
  | 'unsupported';       // Desktop or browser without install support

export function getInstallStatus(hasPrompt: boolean): InstallStatus {
  if (isStandalone()) {
    return 'installed';
  }
  
  if (hasPrompt) {
    return 'prompt-available';
  }
  
  if (isIos() && isSafari()) {
    return 'ios-manual';
  }
  
  return 'unsupported';
}

/**
 * Checks if iOS A2HS instructions should be shown
 * (iOS Safari, not installed, not dismissed recently)
 */
export function shouldShowIosInstructions(): boolean {
  if (!isIos() || !isSafari() || isStandalone()) {
    return false;
  }
  
  // Check if user dismissed it recently (7 days)
  const dismissedUntil = localStorage.getItem('ios_install_dismissed_until');
  if (dismissedUntil) {
    const dismissedTime = parseInt(dismissedUntil, 10);
    if (!isNaN(dismissedTime) && Date.now() < dismissedTime) {
      return false;
    }
  }
  
  return true;
}

/**
 * Marks iOS instructions as dismissed for 7 days
 */
export function dismissIosInstructions(days: number = 7): void {
  const dismissUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
  localStorage.setItem('ios_install_dismissed_until', dismissUntil.toString());
}

/**
 * Clears the iOS dismissal (useful for testing or "Show again" button)
 */
export function clearIosDismissal(): void {
  localStorage.removeItem('ios_install_dismissed_until');
}
