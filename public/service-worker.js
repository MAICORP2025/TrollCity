const VERSION = "trollcity-v5";
const STATIC_CACHE = `${VERSION}-static`;
const VOD_CACHE = `${VERSION}-vod`;
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("trollcity") && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// --- STREAMING SAFE FETCH HANDLER ---
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // LiveKit must always go network-only
  if (url.hostname.includes("livekit")) {
    return event.respondWith(fetch(event.request));
  }

  // Supabase APIs network-first
  if (url.hostname.includes("supabase")) {
    return event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }

  // VOD caching (download-to-device)
  if (url.pathname.startsWith("/vod/")) {
    return event.respondWith(cacheVOD(event.request));
  }

  // Static resources
  if (STATIC_ASSETS.includes(url.pathname)) {
    return event.respondWith(
      caches.match(event.request).then((res) => res || fetch(event.request))
    );
  }

  // Document requests → App Shell fallback
  if (event.request.mode === "navigate") {
    return event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// --- VOD Cache Logic ---
async function cacheVOD(req) {
  const cache = await caches.open(VOD_CACHE);
  const cached = await cache.match(req);

  if (cached) return cached;

  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());

  return res;
}

// --- Notifications ---
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  self.registration.showNotification(data.title || "Troll City", {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: data
  });
});

// Click to open the right page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || "/"));
});