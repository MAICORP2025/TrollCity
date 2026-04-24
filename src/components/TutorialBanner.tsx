import React from 'react'
import { Sparkles, ChevronRight } from 'lucide-react'

export function TutorialBanner({ onStart }: { onStart: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9997] bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
          <span className="text-white font-medium">
            Welcome to Troll City! Take an interactive tour to learn how everything works.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onStart}
            className="px-4 py-2 bg-white text-purple-600 font-bold rounded-lg hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            Start Tour <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
