import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import './styles/broadcast-responsive.css'
import './styles/mobile-theme.css'
import './styles/broadcast-themes.css'
import './styles/battle-themes.css'
import './styles/leaflet.css'
import { AuthProvider } from './contexts/AuthProvider'
import { GlobalAppProvider } from './contexts/GlobalAppContext'
import { GlobalEventProvider } from './contexts/GlobalEventContext'
import AprilFoolsProvider from './components/april-fools/AprilFoolsProvider'
import { EasterEggHuntProvider } from './contexts/EasterEggHuntContext'
import { PWAProvider } from './contexts/PWAContext'
import { supabase } from './lib/supabase'
 import { initTelemetry } from './lib/telemetry'
 import { initMobilePlatform, isMobilePlatform } from './lib/mobilePlatform'
 import { reportBug, reportFetchError } from './lib/bugReporter'

 // App version for cache busting
const env = import.meta.env
const APP_VERSION =
  (env.VITE_APP_VERSION as string | undefined) ||
  (env.VITE_PUBLIC_APP_VERSION as string | undefined) ||
  '1.0.0'

// Initialize mobile platform features (Capacitor)
if (isMobilePlatform) {
  console.log('[Main] Running on native mobile platform');
  initMobilePlatform().catch((error) => {
    console.error('[Main] Failed to initialize mobile platform:', error);
  });
}

// ── iOS / WKWebView / In-App Browser navigator.mediaDevices runtime guard ──
// Capacitor WKWebView and some in-app browsers may clobber navigator.mediaDevices
// AFTER the page-loaded script has run.  Re-check here and rebuild if missing.
(function () {
  if (typeof navigator === 'undefined') return;
  var hasWebkit =
    typeof navigator.webkitGetUserMedia === 'function' ||
    typeof navigator.webkitGetDisplayMedia === 'function';
  var hasStandard =
    typeof navigator.mediaDevices !== 'undefined' &&
    !!navigator.mediaDevices.getUserMedia;

  if (!hasStandard && hasWebkit) {
    console.info('[iOS Guard] navigator.mediaDevices missing after bootstrap, rebuilding from webkit shims');
    var MD: any = {};

    if (typeof navigator.webkitGetUserMedia === 'function') {
      MD.getUserMedia = function (constraints: MediaStreamConstraints): Promise<MediaStream> {
        return navigator.webkitGetUserMedia!(constraints);
      };
    }

    if (typeof navigator.webkitGetDisplayMedia === 'function') {
      MD.getDisplayMedia = function (constraints: MediaStreamConstraints): Promise<MediaStream> {
        return navigator.webkitGetDisplayMedia!(constraints);
      };
    }

    if (typeof navigator.mediaDevices !== 'undefined' &&
        typeof navigator.mediaDevices.enumerateDevices === 'function') {
      MD.enumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: MD,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    console.info('[iOS Guard] navigator.mediaDevices rebuilt successfully');
  }
})();

// App version guard - clear storage on deploy
try {
  const storedVersion = localStorage.getItem('app_version')
  if (storedVersion !== APP_VERSION) {
    console.log('App version changed, clearing storage')
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('app_version', APP_VERSION)
  }
} catch (error) {
  console.warn('Unable to evaluate app version guard', error)
}

 if (typeof window !== 'undefined') {
   (window as any).__ENV = env
   initTelemetry()

   // ================================================================
   // GLOBAL ERROR CATCHERS - Universal Bug Catcher
   // ================================================================

   // Catch unhandled JavaScript errors
const isExpectedDevNoise = (errorLike: unknown) => {
      const message = String(
        (errorLike as any)?.message ||
        (errorLike as any)?.reason?.message ||
        errorLike ||
        ''
      ).toLowerCase()

      return (
        message.includes('aborterror') ||
        message.includes('operation was aborted') ||
        message.includes('signal is aborted') ||
        message.includes('lock request is aborted') ||
        message.includes('@vite/client') ||
        message.includes('vite') && message.includes('ping') ||
        message.includes('failed to fetch dynamically imported module') ||
        message.includes('failed to fetch') && env.DEV
      )
    }

    // Track reported HTTP 0 errors for deduplication
    const reportedHttpZeroErrors = new Set<string>()

   window.addEventListener('error', (event: ErrorEvent) => {
     const error = event.error || event.message;
     if (isExpectedDevNoise(error)) {
       if (env.DEV) console.debug('[BugCenter] ignored expected dev/browser error', error)
       return
     }
     reportBug(error, {
       source: 'frontend',
       severity: 'high',
       functionName: 'globalErrorHandler',
     });
   });

   // Catch unhandled promise rejections
   window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
     const error = event.reason;
     if (isExpectedDevNoise(error)) {
       if (env.DEV) console.debug('[BugCenter] ignored expected rejection', error)
       return
     }
     reportBug(error, {
       source: 'frontend',
       severity: 'high',
       functionName: 'globalUnhandledRejection',
     });
   });

   const isBugReporterRequest = (input: RequestInfo | URL) => {
     const url = typeof input === 'string'
       ? input
       : input instanceof Request
         ? input.url
         : input.toString()

     return url.includes('/rpc/log_app_bug_report') || url.includes('/app_bug_reports')
   }

// Note: We only log actual failed responses here; validation errors should be logged at call site
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const urlString =
        typeof args[0] === 'string'
          ? args[0]
          : args[0] instanceof Request
            ? args[0].url
            : String(args[0])

      // Bypass global fetch logging for Supabase Edge Functions
      // to avoid interference with critical auth flows like Terms agreement
      const isSupabaseFunction = urlString.includes('/functions/v1/')

      try {
        const response = await originalFetch(...args);
        if (!response.ok && !isSupabaseFunction) {
          // Handle HTTP 0 (network/CORS/insecure context/aborted) - classify appropriately
          if (response.status === 0) {
            const errorKey = `http0_${urlString}`;
            // Deduplicate HTTP 0 errors - only report once per URL per session
            if (!reportedHttpZeroErrors.has(errorKey)) {
              reportedHttpZeroErrors.add(errorKey);
              
              // Add context for network/CORS issues
              const networkContext = {
                source: 'frontend',
                severity: 'medium',
                functionName: 'globalFetchWrapper',
                table: 'network_cors',
                current_origin: window.location.origin,
                request_url: urlString,
                navigator_onLine: navigator.onLine,
                is_secure_context: window.isSecureContext,
              };
              
              // In dev/localhost, just log - don't spam Bug Center
              if (env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn('[BugCenter] HTTP 0 (network/CORS) error:', urlString, {
                  onLine: navigator.onLine,
                  isSecureContext: window.isSecureContext,
                  origin: window.location.origin,
                });
              } else {
                reportBug(new Error(`HTTP 0 - Network/CORS error: ${urlString}`), networkContext);
              }
              return response;
            }
          }
          // Clone response to read body without consuming it
          const cloned = response.clone();
          cloned.text().then(rawText => {
            reportFetchError(
              response,
              rawText,
              {
                source: 'frontend',
                severity: response.status >= 500 ? 'high' : 'medium',
                functionName: 'globalFetchWrapper',
              }
            );
          }).catch(() => {
            // Ignore errors reading body
          });
        }
        return response;
} catch (error: any) {
        if (!isSupabaseFunction && !isExpectedDevNoise(error)) {
          // Add more context to network errors
          const errorContext: any = {
            source: 'frontend',
            severity: 'high',
            functionName: 'globalFetchWrapper',
            table: 'network_error',
            current_origin: window.location.origin,
            request_url: urlString,
            navigator_onLine: navigator.onLine,
            is_secure_context: window.isSecureContext,
          };
          
          // Add URL and error type for better debugging
          if (error.name === 'AbortError') {
            errorContext.table = 'fetch_abort';
          } else if (error.name === 'TypeError') {
            // TypeError can indicate CORS, network offline, or insecure context
            const msg = String(error.message || '').toLowerCase();
            if (msg.includes('failed to fetch') || msg.includes('network')) {
              errorContext.table = 'network_cors';
              // In dev/localhost, downgrade severity and just log
              if (env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn('[BugCenter] Network error in dev:', urlString, {
                  onLine: navigator.onLine,
                  isSecureContext: window.isSecureContext,
                });
                throw error;
              }
            } else {
              errorContext.table = 'fetch_type_error';
            }
          }
          
          // Enhance error message with URL info
          const enhancedError = new Error(`${error.message} (URL: ${urlString})`);
          enhancedError.name = error.name;
          enhancedError.stack = error.stack;
          
          reportBug(enhancedError, errorContext);
        }
        throw error;
      }
    };


   // Register service worker for PWA — MUST come BEFORE root element render
   // VitePWA injectManifest produces dist/service-worker.js (all push/cache handlers).
   // VitePWA virtual:pwa-register (import() below) handles future updates.
   // We register eagerly here so the PWA SW is live on first page visit.
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});

     // Unregister any stale /sw.js (dev stub) from earlier deploys silently
     navigator.serviceWorker.getRegistrations().then((regs) => {
       for (const r of regs) {
         if (r.active?.scriptURL.endsWith('/sw.js')) {
           r.unregister().catch(() => {});
         }
       }
     }).catch(() => {});
   }

  // Initialize offline notification system
  // This will deliver queued notifications when user comes back online
  // initializeOfflineNotifications()
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element (#root) not found')
}

if (typeof window !== 'undefined') {
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0'
  const isHttps = window.location.protocol === 'https:'

  // In prod, only register SW on HTTPS and not on localhost preview unless explicitly forced.
  // In dev, only register if explicitly enabled.
  const forceLocalhostSw = localStorage.getItem('force_sw') === '1'
  const enableDevSw = env.DEV && localStorage.getItem('enable_sw_dev') === '1'
  const enableProdSw = env.PROD && (isHttps && (!isLocalhost || forceLocalhostSw))

   if (enableDevSw || enableProdSw) {
     // We use vite-plugin-pwa's virtual module to handle registration and updates
     // @ts-expect-error - Virtual module
     import('virtual:pwa-register').then(({ registerSW }) => {
       const updateSW = registerSW({
         onNeedRefresh() {
           console.log('[SW] update ready, dispatching in-app update event')
           if (typeof window !== 'undefined') {
             window.dispatchEvent(new CustomEvent('pwa-update-available'))
           }
         },
         onOfflineReady() {
           console.log('App ready to work offline')
         }
       })

       const checkForUpdate = () => {
         if (typeof updateSW === 'function') {
           void updateSW()
         }
       }

       const runPeriodicUpdateCheck = () => {
         if (typeof window === 'undefined') return

         checkForUpdate()
         const interval = window.setInterval(checkForUpdate, 1000 * 60 * 30)
         window.addEventListener('beforeunload', () => {
           window.clearInterval(interval)
         })
       }

       runPeriodicUpdateCheck()
     })

     const urlBase64ToUint8Array = (base64String: string) => {
       const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
       const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
       const rawData = window.atob(base64)
       const outputArray = new Uint8Array(rawData.length)
       for (let i = 0; i < rawData.length; ++i) {
         outputArray[i] = rawData.charCodeAt(i)
       }
       return outputArray
     }

     const initPushNotifications = async () => {
       try {
         if (!('Notification' in window) || !('serviceWorker' in navigator)) {
           return
         }

         // Do not auto-prompt. The temporary admin/debug button runs the request flow manually.
         if (Notification.permission === 'default') {
           return
         } else if (Notification.permission !== 'granted') {
           return
         }

         const publicKey = env.VITE_VAPID_PUBLIC_KEY as string | undefined
         if (!publicKey) {
           console.warn('Missing VITE_VAPID_PUBLIC_KEY; push subscription skipped')
           return
         }

         let registration: ServiceWorkerRegistration | undefined
         try {
           registration = await navigator.serviceWorker.ready
         } catch (swErr) {
           console.warn('No active service worker (push skip)', swErr)
           return
         }
         const existing = await registration.pushManager.getSubscription()
         const subscription =
           existing ||
           (await registration.pushManager.subscribe({
             userVisibleOnly: true,
             applicationServerKey: urlBase64ToUint8Array(publicKey),
           }))

         const { data: sessionData } = await supabase.auth.getSession()
         const userId = sessionData?.session?.user?.id
         if (!userId) {
           return
         }

         const subJson = subscription.toJSON() as any
         const expiration =
           (subscription as any).expirationTime
             ? new Date((subscription as any).expirationTime).toISOString()
             : null

         await supabase
           .from('web_push_subscriptions')
           .upsert(
             {
               user_id: userId,
               endpoint: subJson.endpoint,
               p256dh_key: subJson.keys?.p256dh,
               auth_key: subJson.keys?.auth,
               expiration_time: expiration,
               user_agent: navigator.userAgent,
             },
             { onConflict: 'endpoint' }
           )
       } catch (err) {
         console.warn('Push notification setup failed', err)
       }
     }

     initPushNotifications()
     supabase.auth.onAuthStateChange((_event, session) => {
       if (session?.user) {
         void initPushNotifications()
       }
     })
   } else {
     console.log('[SW] registration skipped', {
       dev: !!env.DEV,
       prod: !!env.PROD,
       host: window.location.hostname,
       protocol: window.location.protocol,
     })
   }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - balance between freshness and reduced fetches
      gcTime: 30 * 60 * 1000, // 30 minutes - keep inactive queries longer
      refetchOnMount: false, // Don't refetch on mount if cache exists
      refetchOnReconnect: true, // Refetch when reconnecting
      refetchOnWindowFocus: false, // Disabled to prevent bursts when switching tabs
      retry: 1, // Allow one retry on failure
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchIntervalInBackground: false, // Don't refetch in background tabs
    },
    mutations: {
      retry: 1, // Allow one retry on mutation failure
      retryDelay: 1000,
    },
  },
})

createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      
      <AuthProvider>
        <GlobalAppProvider>
          <GlobalEventProvider>
            <AprilFoolsProvider>
              <PWAProvider>
                <EasterEggHuntProvider>
                  <App />
                </EasterEggHuntProvider>
              </PWAProvider>
            </AprilFoolsProvider>
          </GlobalEventProvider>
        </GlobalAppProvider>
      </AuthProvider>
      
    </BrowserRouter>
  </QueryClientProvider>
)
