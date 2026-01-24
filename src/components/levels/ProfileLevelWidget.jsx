// src/components/levels/ProfileLevelWidget.jsx
import React, { useEffect, useRef, useState } from "react";
import { useUserLevels } from "@/hooks/useUserLevels";
import LevelBadge from "./LevelBadge";
import LevelUpModal from "./LevelUpModal";
import { getMainLevelMeta } from "@/lib/levelsConfig";

export default function ProfileLevelWidget() {
  const { levels, loading } = useUserLevels();
  const prevBuyerLevel = useRef(null);
  const prevStreamLevel = useRef(null);
  const prevMainLevel = useRef(null);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [showMainModal, setShowMainModal] = useState(false);

  useEffect(() => {
    if (!levels) return;

    if (
      prevBuyerLevel.current !== null &&
      levels.buyer_level > prevBuyerLevel.current
    ) {
      setShowBuyerModal(true);
    }
    if (
      prevStreamLevel.current !== null &&
      levels.stream_level > prevStreamLevel.current
    ) {
      setShowStreamModal(true);
    }
    // Main level check (levels.level or levels.current_level)
    const currentMain = levels.level || levels.current_level || 1;
    if (
      prevMainLevel.current !== null &&
      currentMain > prevMainLevel.current
    ) {
      setShowMainModal(true);
    }

    prevBuyerLevel.current = levels.buyer_level;
    prevStreamLevel.current = levels.stream_level;
    prevMainLevel.current = currentMain;
  }, [levels]);

  if (loading) return null;
  if (!levels) return null;

  const mainLevel = levels.level || levels.current_level || 1;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="text-sm text-gray-400 mb-1">Troll City Levels</div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">Troll Level</span>
        <LevelBadge type="main" level={mainLevel} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">Supporter Level</span>
        <LevelBadge type="buyer" level={levels.buyer_level} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">Broadcast Level</span>
        <LevelBadge type="stream" level={levels.stream_level} />
      </div>

      {showMainModal && (
        <LevelUpModal
          type="main"
          oldLevel={prevMainLevel.current}
          newLevel={mainLevel}
          onClose={() => setShowMainModal(false)}
        />
      )}
      {showBuyerModal && (
        <LevelUpModal
          type="buyer"
          oldLevel={prevBuyerLevel.current}
          newLevel={levels.buyer_level}
          onClose={() => setShowBuyerModal(false)}
        />
      )}
      {showStreamModal && (
        <LevelUpModal
          type="stream"
          oldLevel={prevStreamLevel.current}
          newLevel={levels.stream_level}
          onClose={() => setShowStreamModal(false)}
        />
      )}
    </div>
  );
}