import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};
declare const __BUILD_TIME__: string;

// ===== VERSION =====
const CACHE_NAME = `trollcity-cache-${__BUILD_TIME__}`;
const OFFLINE_URL = '/offline.html';

// ===== PRECACHE =====
const manifest = self.__WB_MANIFEST || [];

const criticalAssets = manifest.filter((entry) => {
  const url = entry.url;

  if (url.endsWith('.html') || url.endsWith('.css') || url.endsWith('.json'))
    return true;

  if (
    url.includes('vendor-') ||
    url.includes('ui-') ||
    url.includes('supabase-') ||
    url.includes('index-')
  ) {
    return true;
  }

  return false;
});

precacheAndRoute(criticalAssets);

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL]).catch(() => {})
    )
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      // cleanup old caches
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );

      // notify clients
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clients) {
        client.postMessage({ type: 'SW_UPDATED' });
      }

      // navigation preload safe enable
      try {
        await self.registration.navigationPreload?.enable();
      } catch {}
    })()
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event: any) => {
  const req = event.request;
  const url = new URL(req.url);

  // CRITICAL: Never let the SW handle JS module/script requests.
  // A stale SW response here is what causes: "Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of ''"
  if (
    req.destination === 'script' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.cjs')
  ) {
    return;
  }

  // CRITICAL: Bypass Service Worker for all streaming and large asset requests
  // This ensures HLS streams are never intercepted or cached by the SW
  // NetworkOnly explicitly
  if (
    url.pathname.startsWith('/streams/') ||
    url.pathname.includes('.m3u8') ||
    url.pathname.includes('.ts') ||
    url.pathname.endsWith('.mp4')
  ) {
    return;
  }

  // bypass APIs
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/') ||
    url.hostname.includes('supabase')
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // navigation: network first
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;

          return await fetch(req, { cache: 'reload' });
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response('Offline', {
              status: 503,
              statusText: 'Offline',
            })
          );
        }
      })()
    );
    return;
  }

  // cache styles/images/fonts only
  const cacheable =
    req.method === 'GET' &&
    (req.destination === 'style' ||
      req.destination === 'image' ||
      req.destination === 'font');

  if (cacheable) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((network) => {
            if (network && network.status === 200) {
              const clone = network.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
            return network;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});

// ===== PUSH =====
self.addEventListener('push', (event) => {
  let data: any = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Troll City Notification';

  const options: NotificationOptions = {
    body: data.body || 'New update from Troll City!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: data.url || '/',
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ===== CLICK =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen });
          return;
        }
      }

      await self.clients.openWindow?.(urlToOpen);
    })()
  );
});