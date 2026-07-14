// src/components/entrance/CeremonyScissors.tsx
import React from 'react'

interface CeremonyScissorsProps {
  visible: boolean
  cut: boolean
  separated: boolean
}

export default function CeremonyScissors({
  visible,
  cut,
  separated,
}: CeremonyScissorsProps) {
  const cls = [
    'gce-scissors',
    visible ? 'gce-is-scissors' : '',
    cut ? 'gce-is-cut' : '',
    separated ? 'gce-is-separated' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} aria-hidden="true">
      <svg viewBox="0 0 200 120" width="100%" height="100%">
        {/* Top blade */}
        <g
          className="gce-scissor-blade gce-scissor-blade-top"
          style={{ transformBox: 'fill-box' } as any}
        >
          <path
            d="M150 30 L70 46 L40 52 L150 30 Z"
            fill="#c9d2cf"
            stroke="#e8eef0"
            strokeWidth="2"
          />
          <circle cx="158" cy="26" r="14" fill="none" stroke="#e3c46a" strokeWidth="6" />
        </g>
        {/* Bottom blade */}
        <g
          className="gce-scissor-blade gce-scissor-blade-bottom"
          style={{ transformBox: 'fill-box' } as any}
        >
          <path
            d="M150 90 L70 74 L40 68 L150 90 Z"
            fill="#aab4b1"
            stroke="#cdd6d8"
            strokeWidth="2"
          />
          <circle cx="158" cy="94" r="14" fill="none" stroke="#4dffa0" strokeWidth="6" />
        </g>
        {/* Pivot */}
        <circle cx="40" cy="60" r="5" fill="#0a0d0c" stroke="#e3c46a" strokeWidth="3" />
      </svg>
    </div>
  )
}
