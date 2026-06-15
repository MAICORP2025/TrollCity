import React from 'react'
import { Star, Crown } from 'lucide-react'

const neonCard =
  'border border-cyan-400/20 bg-[#071020]/80 backdrop-blur-2xl shadow-[0_0_28px_rgba(34,211,238,0.08)]'

export default function LevelStatusCard() {
  return (
    <section className={`${neonCard} rounded-2xl p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-black text-white">
            <Star className="h-3.5 w-3.5 text-yellow-300" />
            Level System
          </p>
          <p className="mt-0.5 text-[10px] font-bold text-slate-400">City Rank Lvl 385</p>
        </div>
        <Crown className="h-6 w-6 text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" />
      </div>
      <div className="mt-2 rounded-lg border border-fuchsia-400/30 bg-gradient-to-r from-amber-500 via-fuchsia-500 to-purple-600 px-2 py-1.5 text-center text-[10px] font-black text-white">
        VETERAN WARRIOR
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-300">
        <span>XP Progress</span>
        <span>16.2%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/10">
        <div className="h-1.5 w-[16.2%] rounded-full bg-gradient-to-r from-pink-500 via-yellow-300 to-cyan-300" />
      </div>
      <p className="mt-2 text-[9px] text-slate-400">
        <span className="font-black text-fuchsia-300">838 XP</span> to next level
        <span className="float-right font-black text-cyan-300">+84 bonus coins</span>
      </p>
    </section>
  )
}
