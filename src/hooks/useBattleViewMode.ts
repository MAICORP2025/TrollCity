import { useEffect, useState } from "react";

const MOBILE_BATTLE_QUERY = "(max-width: 767px)";

/**
 * Determines whether the mobile BattleView layout should be used.
 *
 * Uses window.matchMedia (viewport + orientation) rather than user-agent
 * detection. The controller lives above this decision so resizing between
 * mobile/desktop never re-initializes the battle connection.
 */
export function useBattleViewMode() {
  const [isMobileBattleView, setIsMobileBattleView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_BATTLE_QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BATTLE_QUERY);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileBattleView(event.matches);
    };

    setIsMobileBattleView(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return { isMobileBattleView };
}
