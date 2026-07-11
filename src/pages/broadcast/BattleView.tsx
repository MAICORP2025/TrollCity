import React from "react";
import { useBattleViewController } from "../../hooks/useBattleViewController";
import type { BattleViewProps } from "../../hooks/useBattleViewController";
import { useBattleViewMode } from "../../hooks/useBattleViewMode";
import BattleViewDesktop from "./BattleViewDesktop";
import BattleViewMobile from "./BattleViewMobile";

/**
 * Shared entry point for the Battle experience.
 *
 * The battle controller (LiveKit room, realtime state, Supabase subscriptions,
 * gift events, timer, participants, seats, chat, and cleanup) is initialized
 * exactly ONCE here — above the desktop/mobile layout decision. Selecting the
 * layout based on viewport (useBattleViewMode) only swaps the presentational
 * component, so resizing never re-connects the battle.
 */
export default function BattleView(props: BattleViewProps) {
  const battleView = useBattleViewController(props);
  const { isMobileBattleView } = useBattleViewMode();

  return isMobileBattleView ? (
    <BattleViewMobile battleView={battleView} />
  ) : (
    <BattleViewDesktop battleView={battleView} />
  );
}
