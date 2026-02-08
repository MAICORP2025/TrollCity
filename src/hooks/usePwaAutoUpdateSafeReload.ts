import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";

function isSafeToReload() {
  const path = window.location.pathname;

  // Never reload mid-broadcast / mid-watch / payment / settings forms
  const unsafePrefixes = [
    "/watch",
    "/broadcast",
    "/live",
    "/wallet",
    "/checkout",
    "/admin/payments",
  ];

  return !unsafePrefixes.some((p) => path.startsWith(p));
}

export function usePwaAutoUpdateSafeReload() {
  const location = useLocation();
  const updatePendingRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "SW_UPDATED") return;
      
      updatePendingRef.current = true;

      if (isSafeToReload()) {
        // Prevent reload loops: check if we just reloaded recently
        const lastReload = sessionStorage.getItem('pwa_reload_ts');
        if (lastReload && Date.now() - parseInt(lastReload) < 10000) {
          console.warn("[PWA] Update detected immediately after reload. Ignoring to prevent loop.");
          return;
        }

        console.log("[PWA] Safe to reload, reloading now...");
        sessionStorage.setItem('pwa_reload_ts', Date.now().toString());
        window.location.reload();
        return;
      }

      console.log("[PWA] Update available but current route is unsafe. Waiting...");
      toast.info("New Update Available!", {
        id: "pwa-update-toast", // prevent duplicates
        description: "A new version of Troll City is live. Refresh when ready.",
        action: { label: "Refresh Now", onClick: () => window.location.reload() },
        duration: Infinity,
        dismissible: false,
      });
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // Re-check on route change
  useEffect(() => {
    if (updatePendingRef.current && isSafeToReload()) {
      // Prevent reload loops here too
      const lastReload = sessionStorage.getItem('pwa_reload_ts');
      if (lastReload && Date.now() - parseInt(lastReload) < 10000) {
        console.warn("[PWA] Update detected immediately after reload (route change). Ignoring.");
        return;
      }

      console.log("[PWA] Route changed to safe zone, reloading for update...");
      sessionStorage.setItem('pwa_reload_ts', Date.now().toString());
      window.location.reload();
    }
  }, [location.pathname]);
}
