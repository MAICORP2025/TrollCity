// src/components/entrance/EntranceControls.tsx
import React from 'react'

interface EntranceControlsProps {
  onSkip: () => void
  onEnter: () => void
}

export default function EntranceControls({
  onSkip,
  onEnter,
}: EntranceControlsProps) {
  return (
    <div className="gce-controls">
      <button
        type="button"
        className="gce-btn gce-skip"
        onClick={onSkip}
        aria-label="Skip the Troll City entrance animation"
      >
        Skip Entrance
      </button>

      <div className="gce-enter-wrap">
        <button
          type="button"
          className="gce-btn gce-enter"
          onClick={onEnter}
          aria-label="Enter Troll City"
        >
          Enter Troll City
        </button>
        <span className="gce-enter-hint">Or press Skip to continue</span>
      </div>
    </div>
  )
}
