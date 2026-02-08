import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function useVersionCheck() {
  const lastNotifiedRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Get local build time
    // __BUILD_TIME__ is injected by Vite at build time
    const localBuildTime = (window as any).__BUILD_TIME__ || 0;
    
    // If dev mode or no build time, skip
    if (!localBuildTime && import.meta.env.DEV) return;

    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        
        // If remote version is newer than local bundle
        if (data.buildTime > localBuildTime) {
           console.log(`[VersionCheck] New version detected! Local: ${localBuildTime}, Remote: ${data.buildTime}`);
           
           // Prevent duplicate notifications for the same version
           if (lastNotifiedRef.current !== data.buildTime) {
             lastNotifiedRef.current = data.buildTime;
             
             toast.info("New Update Available!", {
               id: 'app-version-update', // Unique ID to prevent duplicates
               description: "A new version of Troll City has been deployed.",
               action: {
                 label: "Refresh Now",
                 onClick: async () => {
                   // Force unregister SW to ensure fresh load
                   if ('serviceWorker' in navigator) {
                     try {
                       const regs = await navigator.serviceWorker.getRegistrations();
                       for(let reg of regs) {
                         await reg.unregister();
                       }
                     } catch (err) {
                       console.error('Error unregistering service worker:', err);
                     }
                   }
                   // Force reload ignoring cache if possible (deprecated in some browsers but worth a try)
                   window.location.reload();
                 }
               },
               duration: Infinity, 
               dismissible: false
             });
           }
        }
      } catch (e) {
        console.error("Failed to check version", e);
      }
    };

    // Check immediately
    checkVersion();

    // 2. Poll every minute
    const interval = setInterval(checkVersion, 60000);
    
    // 3. Check on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
