import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import './styles/broadcast-responsive.css'
import './styles/mobile-theme.css'
import './styles/broadcast-themes.css'
import './styles/leaflet.css'
import { AuthProvider } from './contexts/AuthProvider'
import { GlobalAppProvider } from './contexts/GlobalAppContext'
import { GlobalEventProvider } from './contexts/GlobalEventContext'
import AprilFoolsProvider from './components/april-fools/AprilFoolsProvider'
import { EasterEggHuntProvider } from './contexts/EasterEggHuntContext'
import { supabase } from './lib/supabase'
import { initTelemetry } from './lib/telemetry'
import { initMobilePlatform, isMobilePlatform } from './lib/mobilePlatform'

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
  
  // Register service worker for PWA
  // Enable in dev with ?sw=1 query param, or always in production
  const enableInDev = new URLSearchParams(window.location.search).get('sw') === '1';
  if ('serviceWorker' in navigator && (import.meta.env.PROD || enableInDev)) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('[ServiceWorker] Registered successfully:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
        
      } catch (error) {
        console.error('[ServiceWorker] Registration failed:', error);
      }
    });
  } else if ('serviceWorker' in navigator && import.meta.env.DEV) {
    console.log('[SW] Dev mode: Add ?sw=1 to enable service worker, or use production build');
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

         // Check if we already asked or if permission is already granted/denied
         if (Notification.permission === 'default') {
           const hasAsked = localStorage.getItem('push_notification_requested')
           if (hasAsked) {
             return
           }
           localStorage.setItem('push_notification_requested', 'true')
           const permission = await Notification.requestPermission()
           if (permission !== 'granted') {
             return
           }
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
               keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
               expiration_time: expiration,
               created_at: new Date().toISOString(),
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
      staleTime: 60 * 1000, // 1 minute - increased for better cache utilization
      gcTime: 15 * 60 * 1000, // 15 minutes - increased to prevent premature garbage collection
      refetchOnWindowFocus: false, // Disabled to prevent loading states when switching tabs
      refetchOnReconnect: true, // Refetch when reconnecting
      retry: 1, // Allow one retry on failure
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
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
              <EasterEggHuntProvider>
                <App />
              </EasterEggHuntProvider>
            </AprilFoolsProvider>
          </GlobalEventProvider>
        </GlobalAppProvider>
      </AuthProvider>
      
    </BrowserRouter>
  </QueryClientProvider>
)
