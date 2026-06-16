import React from 'react'
import {
  MessageCircle,
  Radio,
  Sparkles,
  FileText,
  Trophy,
  BookOpen,
  Star,
  Crown,
  Zap,
} from 'lucide-react'
import { useLiveContent } from '@/contexts/LiveContentContext'
import { usePresidentSystem } from '@/hooks/usePresidentSystem'
import FloatingPoster from './FloatingPoster'
import LevelStatusCard from './LevelStatusCard'

type TabType = 'wall' | 'live' | 'universe' | 'laws-fees' | 'leagues' | 'president' | 'academy'

interface LeftNavSidebarProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  liveCount: number
  battleCount: number
  presidentTabLabel: string
  showPresidentTab: boolean
}

export default function LeftNavSidebar({
  activeTab,
  setActiveTab,
  liveCount,
  battleCount,
  showPresidentTab,
}: LeftNavSidebarProps) {
  const { liveAuctions } = useLiveContent()

  const tabs: Array<{
    id: TabType
    label: string
    icon: React.ElementType
    activeGradient: string
    count?: number
  }> = [
    { id: 'wall', label: 'Wall', icon: MessageCircle, activeGradient: 'from-pink-500 to-purple-600' },
    { id: 'live', label: 'Live Now', icon: Radio, activeGradient: 'from-red-500 to-pink-600', count: liveCount },
    { id: 'universe', label: 'Universe', icon: Sparkles, activeGradient: 'from-yellow-500 to-orange-600', count: battleCount },
    { id: 'laws-fees', label: 'City Laws', icon: FileText, activeGradient: 'from-cyan-500 to-blue-600' },
    { id: 'leagues', label: 'Leagues', icon: Trophy, activeGradient: 'from-purple-500 to-indigo-600' },
    { id: 'academy', label: 'Academy', icon: BookOpen, activeGradient: 'from-emerald-500 to-teal-600' },
  ]

  return (
    <aside className="hidden lg:flex lg:flex-col lg:gap-2 lg:w-[180px] lg:shrink-0 lg:sticky lg:top-3 lg:self-start">
      {/* Navigation Tabs — stacked vertically */}
      <div className="flex flex-col gap-1.5 rounded-2xl border border-white/[0.08] bg-[#070b19]/70 backdrop-blur-xl p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                isActive
                  ? `bg-gradient-to-r ${tab.activeGradient} shadow-lg`
                  : 'hover:bg-white/[0.06]'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                {tab.label}
              </span>
              {!!tab.count && (
                <span className={`ml-auto text-[10px] font-black rounded-full px-1.5 py-0.5 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-cyan-500/15 text-cyan-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Level Status Card */}
      <LevelStatusCard />

      {/* Cashout / Floating Poster */}
      <FloatingPoster />
    </aside>
  )
}
