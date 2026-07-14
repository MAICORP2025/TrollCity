// src/components/entrance/AudioControls.tsx
import React from 'react'

interface AudioControlsProps {
  enabled: boolean
  onToggle: () => void
}

export default function AudioControls({ enabled, onToggle }: AudioControlsProps) {
  return (
    <button
      type="button"
      className="gce-btn gce-audio"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Mute entrance sound' : 'Unmute entrance sound'}
      title={enabled ? 'Mute sound' : 'Unmute sound'}
    >
      {enabled ? (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 9v6h4l5 4V5L8 9H4z"
            fill="currentColor"
          />
          <path
            d="M16 8a5 5 0 010 8M18.5 5.5a9 9 0 010 13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
          <path
            d="M16 9l6 6M22 9l-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
