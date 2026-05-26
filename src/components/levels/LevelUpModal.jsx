// src/components/levels/LevelUpModal.jsx
import React from "react";
import LevelBadge from "./LevelBadge";

export default function LevelUpModal({ type = "troll", oldLevel = 0, newLevel = 0, onClose }) {
  if (!newLevel || newLevel <= oldLevel) return null;

  const levelTypeLabel =
    type === "buyer"
      ? "Supporter"
      : type === "stream"
        ? "Broadcast"
        : "Troll";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-purple-600 bg-gray-900 p-6 text-center shadow-xl shadow-purple-500/40">
        <h2 className="mb-2 text-2xl font-bold text-purple-300">
          Level Up!
        </h2>

        <p className="mb-4 text-sm text-gray-300">
          Your {levelTypeLabel} level just increased!
        </p>

        <div className="mb-4 flex flex-col items-center gap-3">
          {oldLevel ? (
            <div className="text-xs text-gray-400">
              Previous: Lv.{oldLevel}
            </div>
          ) : null}

          <LevelBadge type={type} level={newLevel} />
        </div>

        <button
          type="button"
          className="mt-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          onClick={onClose}
        >
          Continue
        </button>
      </div>
    </div>
  );
}