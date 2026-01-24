// src/components/levels/LevelBadge.jsx
import React from "react";
import { getBuyerMeta, getStreamMeta, getMainLevelMeta } from "@/lib/levelsConfig";

export default function LevelBadge({ type, level }) {
  let meta;
  if (type === "buyer") {
    meta = getBuyerMeta(level);
  } else if (type === "stream") {
    meta = getStreamMeta(level);
  } else {
    meta = getMainLevelMeta(level);
  }

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
      <span className="mr-1">{meta.icon}</span>
      <span>{meta.name}</span>
      <span className="ml-1 text-[10px] opacity-80">Lv.{level}</span>
    </div>
  );
}