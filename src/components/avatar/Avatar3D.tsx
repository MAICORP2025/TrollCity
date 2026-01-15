import React from 'react'
import type { AvatarConfig } from '../../lib/hooks/useAvatar'

interface Avatar3DProps {
  config: AvatarConfig
  size?: 'sm' | 'md' | 'lg'
  showInCar?: boolean
}

export default function Avatar3D({ config, size = 'md', showInCar = false }: Avatar3DProps) {
  const sizeMap = {
    sm: { container: 'w-16 h-16', head: 'w-10 h-10', body: 'w-12 h-8', accent: 'w-14 h-14' },
    md: { container: 'w-24 h-24', head: 'w-14 h-14', body: 'w-16 h-10', accent: 'w-20 h-20' },
    lg: { container: 'w-32 h-32', head: 'w-20 h-20', body: 'w-24 h-14', accent: 'w-28 h-28' }
  }

  const s = sizeMap[size]

  const skinColor =
    config.skinTone === 'light'
      ? 'bg-[#f1c27d]'
      : config.skinTone === 'dark'
      ? 'bg-[#8d5524]'
      : 'bg-[#c68642]'

  const hairColorClass =
    config.hairColor === 'black'
      ? 'bg-[#1f1f1f]'
      : config.hairColor === 'blonde'
      ? 'bg-[#f5e6b3]'
      : config.hairColor === 'red'
      ? 'bg-[#b33a3a]'
      : config.hairColor === 'neon'
      ? 'bg-[#22d3ee]'
      : 'bg-[#4b3b2b]'

  const outfitColorClass =
    config.outfit === 'formal'
      ? 'bg-gradient-to-b from-slate-900 to-slate-700'
      : config.outfit === 'street'
      ? 'bg-gradient-to-b from-purple-700 to-indigo-700'
      : 'bg-gradient-to-b from-emerald-700 to-emerald-500'

  const accessoryElement =
    config.accessory === 'glasses' ? (
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-black/80">
        <div className="w-3 h-2 rounded-sm border border-black/70 bg-black/10" />
        <div className="w-3 h-2 rounded-sm border border-black/70 bg-black/10" />
      </div>
    ) : config.accessory === 'hat' ? (
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-4 rounded-t-xl bg-black/80 shadow-md" />
    ) : config.accessory === 'mask' ? (
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 rounded-full bg-slate-800/90 border border-slate-500/80" />
    ) : null

  if (showInCar) {
    return (
      <div className={`${s.container} relative flex items-center justify-center`}>
        <div className="absolute inset-1 rounded-[14px] bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 shadow-[0_0_25px_rgba(15,23,42,0.9)] border border-slate-600/80" />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-300 font-semibold tracking-widest uppercase">
          Driver
        </div>
        <div className="relative mt-3 flex flex-col items-center">
          <div
            className={`relative ${s.head} rounded-[40%] ${skinColor} shadow-[0_10px_20px_rgba(0,0,0,0.45)]`}
          >
            {config.hairStyle !== 'none' && (
              <div
                className={`absolute -top-2 left-1/2 -translate-x-1/2 w-[130%] h-3 rounded-[40%] ${hairColorClass} shadow-[0_6px_12px_rgba(0,0,0,0.6)]`}
              />
            )}
            <div className="absolute inset-x-2 top-1/2 flex justify-between text-xs text-black/70">
              <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-1.5 rounded-full bg-black/40" />
            {accessoryElement}
          </div>
          <div
            className={`mt-1 ${s.body} ${outfitColorClass} rounded-[40%] shadow-[0_12px_25px_rgba(0,0,0,0.7)] flex items-center justify-center`}
          >
            <div className="w-1.5 h-4 bg-slate-100/80 rounded-full mr-2" />
            <div className="w-1.5 h-4 bg-slate-100/50 rounded-full" />
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-2 bg-black/70 rounded-full blur-[3px]" />
      </div>
    )
  }

  return (
    <div className={`${s.container} relative flex items-center justify-center`}>
      <div
        className={`${s.accent} rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-[0_0_35px_rgba(88,28,135,0.7)]`}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div
            className={`relative ${s.head} rounded-[40%] ${skinColor} shadow-[0_12px_24px_rgba(0,0,0,0.45)]`}
          >
            {config.hairStyle !== 'none' && (
              <div
                className={`absolute -top-2 left-1/2 -translate-x-1/2 w-[130%] h-4 rounded-[40%] ${hairColorClass} shadow-[0_8px_16px_rgba(0,0,0,0.6)]`}
              />
            )}
            <div className="absolute inset-x-3 top-1/2 flex justify-between text-xs text-black/70">
              <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full bg-black/35" />
            {accessoryElement}
          </div>
          <div
            className={`mt-2 ${s.body} ${outfitColorClass} rounded-[40%] shadow-[0_16px_30px_rgba(0,0,0,0.7)] flex items-center justify-center`}
          >
            <div className="w-1.5 h-5 bg-slate-100/80 rounded-full mr-2" />
            <div className="w-1.5 h-5 bg-slate-100/50 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

