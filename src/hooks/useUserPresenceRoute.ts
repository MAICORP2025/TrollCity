import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { useLocation } from "react-router-dom";

/**
 * Tracks the user's current route/page and writes it to user_presence_routes.
 * Should be used once at the app level for authenticated users.
 */
export function useUserPresenceRoute() {
  const { user } = useAuthStore();
  const location = useLocation();
  const lastUpdateRef = useRef(0);
  const sessionIdRef = useRef(
    `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );

  const updatePresence = useCallback(
    async (path: string, title: string) => {
      if (!user?.id) return;

      // Throttle updates to once per 5 seconds
      const now = Date.now();
      if (now - lastUpdateRef.current < 5000) return;
      lastUpdateRef.current = now;

      try {
        // Check if user profile exists before writing presence (FK constraint)
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile) return; // No profile yet — skip presence tracking

        await supabase.from("user_presence_routes").upsert(
          {
            user_id: user.id,
            current_path: path,
            current_title: title || document.title || path,
            session_id: sessionIdRef.current,
            user_agent: navigator.userAgent?.slice(0, 200) || null,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      } catch {
        // Silently fail — presence tracking is non-critical
      }
    },
    [user?.id]
  );

  // Update on route change
  useEffect(() => {
    if (!user?.id) return;
    updatePresence(location.pathname, document.title);
  }, [location.pathname, user?.id, updatePresence]);

  // Periodic heartbeat while active
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      updatePresence(location.pathname, document.title);
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id, location.pathname, updatePresence]);

  // Update on visibility change (tab becomes active)
  useEffect(() => {
    if (!user?.id) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        updatePresence(location.pathname, document.title);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user?.id, location.pathname, updatePresence]);
}
