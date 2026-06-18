import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { useLocation } from "react-router-dom";

/**
 * Tracks the user's current route/page and writes it to user_presence_routes.
 *
 * REPLACED: Previous version used 30s setInterval heartbeat to upsert
 * user_presence_routes. Now the 30s timer is removed — route changes and
 * visibility transitions are sufficient triggers. The periodic heartbeat was
 * redundant since the route only changes on navigation.
 *
 * Should be used once at the app level for authenticated users.
 */
export function useUserPresenceRoute() {
  const { user: storeUser } = useAuthStore();
  const location = useLocation();
  const lastUpdateRef = useRef(0);
  const sessionIdRef = useRef(
    `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );

  const getAuthUserId = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }, []);

  const updatePresence = useCallback(
    async (path: string, title: string) => {
      const authUserId = await getAuthUserId();

      if (!authUserId) {
        return;
      }

      const now = Date.now();
      if (now - lastUpdateRef.current < 5000) return;
      lastUpdateRef.current = now;

      try {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("id", authUserId)
          .maybeSingle();
        if (!profile) return;

        const { error } = await supabase.from("user_presence_routes").upsert(
          {
            user_id: authUserId,
            current_path: path,
            current_title: title || document.title || path,
            session_id: sessionIdRef.current,
            user_agent: navigator.userAgent?.slice(0, 200) || null,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        if (error) {
          console.error("[useUserPresenceRoute] Upsert failed", {
            error,
            authUserId,
            currentPath: path,
          });
        }
      } catch (err: any) {
        console.error("[useUserPresenceRoute] Unexpected error", {
          error: err,
          authUserId,
          currentPath: path,
        });
      }
    },
    [getAuthUserId]
  );

  // Update on route change
  useEffect(() => {
    updatePresence(location.pathname, document.title);
  }, [location.pathname, updatePresence]);

  // REMOVED: 30s periodic heartbeat — route changes are event-driven.
  // The periodic upsert was causing unnecessary DB writes every 30s per user
  // with no new data (same route, same title).

  // Update on visibility change (tab becomes active)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        updatePresence(location.pathname, document.title);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [location.pathname, updatePresence]);
}
