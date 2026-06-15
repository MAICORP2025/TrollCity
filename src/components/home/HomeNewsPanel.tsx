import React, { useMemo } from 'react'
import { Trophy, Gift, ShoppingBag, Sparkles, Heart, Star, Zap } from 'lucide-react'
import { usePrideWeeklyChallenges } from '@/hooks/usePrideWeeklyChallenges'
import { isPrideMonth } from '@/lib/prideMonth'
import { useNavigate } from 'react-router-dom'

const COLOR_MAP: Record<string, string> = {
  pink: 'border-pink-400/25 bg-pink-500/[0.07]',
  red: 'border-red-400/25 bg-red-500/[0.07]',
  orange: 'border-orange-400/25 bg-orange-500/[0.07]',
  yellow: 'border-yellow-300/25 bg-yellow-300/[0.07]',
  green: 'border-green-400/25 bg-green-500/[0.07]',
  cyan: 'border-cyan-400/25 bg-cyan-500/[0.07]',
  blue: 'border-blue-400/25 bg-blue-500/[0.07]',
  purple: 'border-purple-400/25 bg-purple-500/[0.07]',
}

const XP_COLOR_MAP: Record<string, string> = {
  pink: 'text-fuchsia-400',
  red: 'text-red-300',
  orange: 'text-amber-300',
  yellow: 'text-yellow-300',
  green: 'text-emerald-400',
  cyan: 'text-cyan-300',
  blue: 'text-blue-300',
  purple: 'text-violet-400',
}

export default function HomeNewsPanel() {
  const navigate = useNavigate()
  const isPride = isPrideMonth()
  const { challenges, loading, currentWeek, completedCount, totalCount, isPrideActive } = usePrideWeeklyChallenges()

  const previewChallenges = useMemo(
    () => challenges.filter(c => c.week_number === currentWeek).slice(0, 4),
    [challenges, currentWeek]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Challenges Section */}
      {isPrideActive && !loading && previewChallenges.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#070b19]/70 p-5 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-400" />
              <span className="text-sm font-black text-white">Pride Challenges</span>
            </div>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/50">
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="space-y-2">
            {previewChallenges.map((ch) => (
              <div key={ch.id} className={`rounded-xl border p-3 ${COLOR_MAP[ch.ui_color] || 'border-white/10 bg-white/[0.03]'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{ch.icon}</span>
                  <span className="flex-1 truncate text-xs font-bold text-white/80">{ch.title}</span>
                  <span className={`text-[11px] font-black ${XP_COLOR_MAP[ch.ui_color] || 'text-yellow-300'}`}>
                    +{ch.xp_reward} XP
                  </span>
                </div>
                {ch.target_value > 1 && (
                  <div className="mt-1.5">
                    <div className="h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                        style={{ width: `${Math.min(100, ch.completion_percentage)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/pride-challenges')}
            className="mt-3 w-full rounded-lg bg-gradient-to-r from-pink-500/20 to-purple-500/20 py-2 text-xs font-bold text-pink-300 transition hover:from-pink-500/30 hover:to-purple-500/30"
          >
            View All →
          </button>
        </div>
      )}

      {/* Promo / Ad Slot */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#070b19]/70 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-5 w-5 text-cyan-400" />
          <span className="text-sm font-black text-white">Featured</span>
        </div>
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02]">
          <div className="text-center">
            <Star className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-2 text-xs font-bold text-white/20">Promo Slot</p>
          </div>
        </div>
      </div>

      {/* Pride Shop */}
      {isPride && (
        <div className="rounded-2xl border border-pink-400/15 bg-gradient-to-b from-pink-500/[0.06] to-purple-500/[0.04] p-3 backdrop-blur-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <ShoppingBag className="h-3.5 w-3.5 text-pink-400" />
            <span className="text-[11px] font-black text-white">Pride Shop</span>
          </div>
          <p className="text-[10px] text-white/40 mb-2">Limited Edition Avatars, Frames & Badges</p>
          <div className="flex items-center justify-center gap-3 py-2">
            <Heart className="h-6 w-6 text-pink-300/60" />
            <Gift className="h-6 w-6 text-cyan-300/60" />
            <Trophy className="h-6 w-6 text-yellow-300/60" />
          </div>
          <button
            onClick={() => navigate('/pride-shop')}
            className="mt-1 w-full rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 py-1.5 text-[10px] font-black text-white transition hover:opacity-80"
          >
            Shop Now
          </button>
        </div>
      )}
    </div>
  )
}
