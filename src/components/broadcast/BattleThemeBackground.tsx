import React from 'react'
import { getBattleTheme } from '../../lib/battleThemes'

interface BattleThemeBackgroundProps {
  themeId?: string | null
}

export default function BattleThemeBackground({
  themeId,
}: BattleThemeBackgroundProps) {
  const theme = getBattleTheme(themeId)

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none z-0 battle-theme-layer ${theme.className}`}
    >
      {/* Main cinematic battle background */}
      <div className="absolute inset-0">
        
        {/* Core dark cinematic base */}
        <div className="absolute inset-0 bg-[#050505]" />

        {/* Red battle energy */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,0,60,0.35),transparent_38%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,140,0,0.22),transparent_40%)]" />

        {/* Gold luxury energy */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,200,0,0.08),transparent_55%)]" />

        {/* Dark vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.88)_100%)]" />

        {/* Animated arena lights */}
        <div className="absolute left-[-10%] top-0 h-full w-[40%] rotate-12 bg-gradient-to-r from-transparent via-red-500/10 to-transparent blur-3xl animate-pulse" />

        <div className="absolute right-[-10%] top-0 h-full w-[40%] -rotate-12 bg-gradient-to-l from-transparent via-orange-400/10 to-transparent blur-3xl animate-pulse" />

        {/* Battle sparks */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-[12%] top-[18%] h-1 w-1 rounded-full bg-red-400 shadow-[0_0_20px_6px_rgba(255,0,60,0.9)] animate-ping" />

          <div className="absolute right-[18%] top-[28%] h-1.5 w-1.5 rounded-full bg-yellow-300 shadow-[0_0_25px_8px_rgba(255,200,0,0.9)] animate-pulse" />

          <div className="absolute left-[28%] bottom-[22%] h-1 w-1 rounded-full bg-orange-400 shadow-[0_0_18px_6px_rgba(255,120,0,0.8)] animate-ping" />

          <div className="absolute right-[32%] bottom-[18%] h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_30px_10px_rgba(255,0,50,0.9)] animate-pulse" />
        </div>

        {/* Metallic battle grid */}
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:50px_50px]" />

        {/* Bottom arena glow */}
        <div className="absolute bottom-[-10%] left-1/2 h-[300px] w-[80%] -translate-x-1/2 rounded-full bg-gradient-to-t from-red-500/25 via-orange-400/10 to-transparent blur-3xl" />

        {/* Side battle panels */}
        <div className="absolute left-0 top-0 h-full w-[8px] bg-gradient-to-b from-red-500 via-orange-400 to-red-600 opacity-70 shadow-[0_0_25px_rgba(255,0,60,0.8)]" />

        <div className="absolute right-0 top-0 h-full w-[8px] bg-gradient-to-b from-orange-400 via-yellow-300 to-red-500 opacity-70 shadow-[0_0_25px_rgba(255,140,0,0.8)]" />

        {/* Premium glossy overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_25%,transparent_70%,rgba(255,255,255,0.03))]" />
      </div>
    </div>
  )
}