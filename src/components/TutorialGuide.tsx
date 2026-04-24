import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { 
  X, ChevronRight, Check, Sparkles, Home, Gavel, Building2,
  Warehouse, Store, Trophy, TrendingUp, Coins, Star, Scale, Globe,
  Radio, MessageSquare, Video, Users, Gift, Wallet, Shield, Crown,
  Eye, BookOpen, Heart, Zap, LayoutDashboard, Newspaper
} from 'lucide-react'
import { useTutorial, TutorialPage } from './TutorialWalkthrough'

interface TourGuideProps {
  onStartTutorial?: () => void
}

export default function TourGuide({ onStartTutorial }: TourGuideProps) {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { 
    isActive, visitedPages, requiredPages, progress, totalRequired,
    markVisited, startTutorial, completeTutorial 
  } = useTutorial()
  
  const [showPopup, setShowPopup] = useState(false)
  const [currentPage, setCurrentPage] = useState<TutorialPage | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  const isCreator = profile?.role === 'creator' || profile?.troll_role === 'creator'
  
  const handleStartTour = () => {
    startTutorial()
    onStartTutorial?.()
    setShowPopup(false)
    setCurrentIndex(0)
  }
  
  const handleVisitPage = (page: TutorialPage, index: number) => {
    if (!isActive) return
    
    setCurrentPage(page)
    setCurrentIndex(index)
    setShowPopup(true)
    markVisited(page.id)
  }
  
  const handleContinue = async () => {
    setShowPopup(false)
    
    if (currentIndex < requiredPages.length - 1) {
      const nextPage = requiredPages[currentIndex + 1]
      setTimeout(() => {
        setCurrentPage(nextPage)
        setCurrentIndex(currentIndex + 1)
        setShowPopup(true)
        markVisited(nextPage.id)
      }, 300)
    } else {
      await completeTutorial()
    }
  }
  
  if (!isActive) return null
  
  return (
    <>
      {/* Page Visit Popup */}
      {showPopup && currentPage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative max-w-lg w-full bg-slate-900 border-2 border-purple-500 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4 mx-auto">
                <div className="text-white">
                  {currentPage.icon}
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{currentPage.title}</h3>
              <p className="text-white/70 text-sm">Navigate to this page</p>
            </div>
            <div className="p-6">
              <p className="text-slate-300 leading-relaxed text-center">
                {currentPage.description}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                <span>Path:</span>
                <code className="bg-slate-800 px-2 py-1 rounded text-purple-400">{currentPage.path}</code>
              </div>
              <p className="mt-3 text-xs text-amber-400 text-center">
                Click the "{currentPage.title}" button in the sidebar to continue
              </p>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={handleContinue}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                {currentIndex === requiredPages.length - 1 ? (
                  <>Finish Tour <Sparkles size={16} /></>
                ) : (
                  <>Continue <ChevronRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Tour Guide Floating Panel */}
      <div className="fixed bottom-32 right-4 z-[9998] max-w-sm w-full mx-4">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span className="font-bold text-white">Interactive Tour</span>
              </div>
              <button
                onClick={completeTutorial}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                title="Skip Tour"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Progress</span>
                <span>{progress} / {totalRequired}</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${(progress / totalRequired) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Pages list */}
          <div className="p-3 max-h-80 overflow-y-auto">
            <p className="text-xs text-slate-500 px-2 mb-2">
              Click each page in order to mark as complete
            </p>
            <div className="space-y-1">
              {requiredPages.map((page, index) => {
                const completed = visitedPages.includes(page.id)
                const isCurrent = index === currentIndex
                const canClick = isActive && index >= progress
                const isPast = index < progress
                
                return (
                  <button
                    key={page.id}
                    onClick={() => canClick && handleVisitPage(page, index)}
                    disabled={!canClick}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                      completed 
                        ? 'bg-green-500/20 border border-green-500/30 cursor-not-allowed' 
                        : isCurrent
                          ? 'bg-purple-500/20 border-2 border-purple-500 shadow-lg shadow-purple-500/30 scale-[1.02]'
                          : canClick
                            ? 'bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-purple-500/50 cursor-pointer'
                            : 'bg-slate-900/50 border border-slate-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className={`flex-shrink-0 ${completed ? 'text-green-400' : isCurrent ? 'text-purple-400' : 'text-slate-500'}`}>
                      {completed ? <Check size={18} /> : isCurrent ? <Sparkles size={18} /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-current" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${completed ? 'text-green-300' : isCurrent ? 'text-purple-300' : 'text-slate-300'}`}>
                        {page.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {page.shortDesc}
                      </div>
                    </div>
                    {!completed && (
                      <div className={`flex-shrink-0 ${isCurrent ? 'text-purple-400' : 'text-slate-600'}`}>
                        <ChevronRight size={16} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Skip/Complete */}
          <div className="p-3 border-t border-slate-800">
            <button
              onClick={completeTutorial}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              Skip Tour
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
