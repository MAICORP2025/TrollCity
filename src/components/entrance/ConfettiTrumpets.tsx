// src/components/entrance/ConfettiTrumpets.tsx
import React from 'react'

interface ConfettiTrumpetsProps {
  active: boolean
  lowPower: boolean
}

const COLORS = [
  '#4dffa0',
  '#9bffca',
  '#e3c46a',
  '#ec4899',
  '#a855f7',
  '#ffffff',
]

function Trumpet({ side, count }: { side: 'left' | 'right'; count: number }) {
  const pieces = Array.from({ length: count })
  return (
    <div className={side === 'left' ? 'gce-trumpet gce-trumpet-left' : 'gce-trumpet gce-trumpet-right'}>
      <svg viewBox="0 0 100 140" width="100%" height="100%" aria-hidden="true">
        {/* horn cone */}
        <path
          d="M10 120 L70 60 L96 30 L100 44 L74 78 L18 132 Z"
          fill="#1b221f"
          stroke="#4dffa0"
          strokeWidth="3"
        />
        <path
          d="M70 60 L96 30 L100 44 L74 78 Z"
          fill="rgba(77,255,160,0.25)"
        />
        {/* mouthpiece */}
        <rect x="2" y="116" width="14" height="22" rx="6" fill="#e3c46a" />
      </svg>
      {pieces.map((_, i) => {
        const color = COLORS[i % COLORS.length]
        const dx = (side === 'left' ? 1 : -1) * (20 + Math.random() * 120)
        const dy = -(40 + Math.random() * 55)
        const rot = (Math.random() - 0.5) * 1080
        const dur = 1800 + Math.random() * 1200
        const delay = Math.random() * 350
        return (
          <span
            key={i}
            className="gce-confetti"
            style={{
              background: color,
              ['--dx' as any]: `${dx}px`,
              ['--dy' as any]: `${dy}vh`,
              ['--rot' as any]: `${rot}deg`,
              ['--dur' as any]: `${dur}ms`,
              ['--delay' as any]: `${delay}ms`,
              width: `${7 + Math.random() * 5}px`,
              height: `${10 + Math.random() * 6}px`,
            }}
          />
        )
      })}
    </div>
  )
}

export default function ConfettiTrumpets({
  active,
  lowPower,
}: ConfettiTrumpetsProps) {
  if (!active) return null
  const count = lowPower ? 10 : 26
  return (
    <div className="gce-confetti-layer" aria-hidden="true">
      <Trumpet side="left" count={count} />
      <Trumpet side="right" count={count} />
    </div>
  )
}
