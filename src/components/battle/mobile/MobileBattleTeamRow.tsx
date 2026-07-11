import React from "react";
import MobileBattleParticipant, {
  MobileParticipantVM,
} from "./MobileBattleParticipant";

/**
 * Mobile team participant row.
 *
 * Boxes are laid out horizontally and scroll sideways when a team has more
 * than one participant (Blue | Red teams themselves are side-by-side in the
 * parent BattleViewMobile layout). Each card keeps a fixed, comfortable
 * mobile height so the row never grows taller than the cards.
 */
export default function MobileBattleTeamRow({
  team,
  participants,
  onTapParticipant,
  glowUserId,
}: {
  team: "blue" | "red";
  participants: MobileParticipantVM[];
  onTapParticipant?: (vm: MobileParticipantVM) => void;
  glowUserId?: string | null;
}) {
  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div
        className="flex w-full min-w-0 gap-1.5 overflow-x-auto overflow-y-hidden pb-1 snap-x scroll-smooth"
        style={{
          scrollSnapType: "x proximity",
          scrollPaddingInline: "4px",
          scrollbarWidth: "none",
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch",
        }}
        aria-label={`${team} team participants`}
      >
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="flex min-w-0 flex-none snap-start"
            style={{
              width: "clamp(160px, 46vw, 440px)",
              height: "clamp(240px, 46vh, 440px)",
            }}
          >
            <MobileBattleParticipant
              vm={participant}
              glow={glowUserId === participant.userId}
              onTap={
                onTapParticipant
                  ? () => onTapParticipant(participant)
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
