import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { TutorialProvider, useTutorial, TUTORIAL_PAGES, CREATOR_TUTORIAL_PAGES } from '@/components/TutorialWalkthrough'
import TourGuide from '@/components/TutorialGuide'
import { 
  Play, Radio, Users, Coins, Trophy, Crown, Shield, Gavel, Building2,
  MessageSquare, Star, Package, ShoppingBag, Scale, Globe, 
  Sparkles, Zap, Heart, Gift, Wallet, BookOpen, Eye, X, Check
} from 'lucide-react'

function TutorialDemo() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { isActive, visitedPages, requiredPages, progress, totalRequired, startTutorial, completeTutorial, markVisited } = useTutorial()
  const [currentPage, setCurrentPage] = useState<any>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  const isCreator = profile?.role === 'creator' || profile?.troll_role === 'creator'
  const allPages = [...TUTORIAL_PAGES]
  if (isCreator) allPages.push(...CREATOR_TUTORIAL_PAGES)
  
  const isCompleted = (pageId: string) => visitedPages.includes(pageId)
  
  const handleStartTour = () => {
    startTutorial()
    setCurrentIndex(0)
    const firstPage = requiredPages[0]
    if (firstPage) {
      setCurrentPage(firstPage)
      setShowPopup(true)
      markVisited(firstPage.id)
    }
  }
  
  const handleVisitPage = (page: any, index: number) => {
    if (!isActive) return
    
    setCurrentPage(page)
    setCurrentIndex(index)
    setShowPopup(true)
    markVisited(page.id)
  }
  
  const handleContinue = () => {
    setShowPopup(false)
    
    if (currentIndex < requiredPages.length - 1) {
      setTimeout(() => {
        const nextPage = requiredPages[currentIndex + 1]
        setCurrentPage(nextPage)
        setCurrentIndex(currentIndex + 1)
        setShowPopup(true)
        markVisited(nextPage.id)
      }, 300)
    } else {
      completeTutorial()
    }
  }
  
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
          Back to Dev Menu
        </button>
        
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent mb-6">
          Interactive Tour Guide Preview
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Control Panel */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-xl font-bold text-white mb-4">Tutorial Controls</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50">
                  <div>
                    <div className="text-slate-400 text-sm">Status</div>
                    <div className={`font-bold ${isActive ? 'text-green-400' : 'text-slate-500'}`}>
                      {isActive ? 'Active - Tour in Progress' : 'Not Active'}
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                </div>
                
                {!isActive && (
                  <button
                    onClick={handleStartTour}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-600 text-white font-bold text-lg flex items-center justify-center gap-2"
                  >
                    <Play size={20} />
                    Start Interactive Tour
                  </button>
                )}
                
                {isActive && (
                  <button
                    onClick={completeTutorial}
                    className="w-full py-3 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 font-semibold"
                  >
                    End Tour Early
                  </button>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-800/50">
                    <div className="text-slate-400 text-sm">Progress</div>
                    <div className="text-2xl font-bold text-purple-400">
                      {progress} / {totalRequired}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/50">
                    <div className="text-slate-400 text-sm">Completed</div>
                    <div className="text-2xl font-bold text-green-400">
                      {visitedPages.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Simulated Profile */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Simulated User Role</h3>
              <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30">
                <span className="text-purple-400 font-medium">
                  {isCreator ? 'Creator (broadcaster)' : 'Regular User'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Pages List */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-4">
              Pages to Explore {isActive && <span className="text-purple-400">(Click to test)</span>}
            </h2>
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {requiredPages.map((page, index) => {
                const completed = isCompleted(page.id)
                const canClick = isActive && index <= progress
                
                return (
                  <button
                    key={page.id}
                    onClick={() => canClick && handleVisitPage(page, index)}
                    disabled={!canClick}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      completed 
                        ? 'bg-green-500/20 border border-green-500/30' 
                        : canClick 
                          ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/50'
                          : 'bg-slate-900 border border-slate-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className={`flex-shrink-0 ${completed ? 'text-green-400' : 'text-slate-500'}`}>
                      {completed ? <Check size={18} /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-current" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${completed ? 'text-green-300' : 'text-white'}`}>
                        {page.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {page.path}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        
        {/* Popup Preview */}
        {showPopup && currentPage && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80">
            <div className="relative max-w-lg w-full bg-slate-900 border-2 border-purple-500 rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-full mb-3 mx-auto">
                  <div className="text-white">{currentPage.icon}</div>
                </div>
                <h3 className="text-xl font-bold text-white">{currentPage.title}</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-300 leading-relaxed">{currentPage.description}</p>
                <div className="mt-3 text-center text-sm text-slate-500">
                  Path: <code className="bg-slate-800 px-2 py-0.5 rounded">{currentPage.path}</code>
                </div>
              </div>
              <div className="px-6 pb-6">
                <button
                  onClick={handleContinue}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold flex items-center justify-center gap-2"
                >
                  {currentIndex === requiredPages.length -1 ? 'Finish Tour' : 'Continue'} <Sparkles size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TutorialPreview() {
  return (
    <TutorialProvider>
      <TutorialDemo />
      <TourGuide />
    </TutorialProvider>
  )
}