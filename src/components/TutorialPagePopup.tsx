import React, { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTutorial } from './TutorialWalkthrough'
import { ChevronRight, X } from 'lucide-react'

export default function TutorialPagePopup() {
  const location = useLocation()
  const { isActive, targetPage, markVisited, completeTutorial } = useTutorial()
  
  const EXCLUDED_PATHS = ['/about', '/broadcasting', '/creators', '/government', '/go-live', '/categories']

  // Helper to check if current location matches a tutorial page path (including sub-routes)
  const matchesPath = (pagePath: string, currentPath: string): boolean => {
    if (pagePath === '/') return currentPath === '/'
    return currentPath === pagePath || currentPath.startsWith(pagePath + '/')
  }
  
  // Don't show tutorial on landing/SEO pages
  if (EXCLUDED_PATHS.some(path => location.pathname.startsWith(path))) return null
  
  const shouldShow = isActive && targetPage && matchesPath(targetPage.path, location.pathname)
  
  const handleContinue = useCallback(() => {
    if (targetPage) {
      markVisited(targetPage.id)
    }
  }, [targetPage, markVisited])
  
  const handleSkip = useCallback(async () => {
    await completeTutorial()
  }, [completeTutorial])
  
  if (!shouldShow || !targetPage) return null
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-sm md:max-w-lg w-full bg-slate-900 border-2 border-yellow-500 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 via-amber-500 to-orange-600 p-4 md:p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-white/20 rounded-full mb-3 md:mb-4 mx-auto">
            <span className="text-white text-lg md:text-xl">
              {targetPage.icon}
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white mb-1">{targetPage.title}</h3>
          <p className="text-white/70 text-xs md:text-sm">You've reached an important page!</p>
        </div>
        
        {/* Description */}
        <div className="p-4 md:p-6">
          <p className="text-slate-300 leading-relaxed text-center text-sm md:text-base">
            {targetPage.description}
          </p>
        </div>
        
        {/* Actions */}
        <div className="px-4 md:px-6 pb-4 md:pb-6 flex gap-2 md:gap-3">
          <button
            onClick={handleContinue}
            className="flex-1 py-2.5 md:py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold flex items-center justify-center gap-1 md:gap-2 transition-all shadow-lg text-sm md:text-base"
          >
            <span className="hidden sm:inline">Got it!</span>
            <span className="sm:hidden">Continue</span>
            <ChevronRight size={16} className="md:w-5 md:h-5" />
          </button>
          <button
            onClick={handleSkip}
            className="px-3 md:px-4 py-2.5 md:py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center gap-1 md:gap-2 transition-all shadow-lg text-sm md:text-base"
            title="Skip tutorial"
          >
            <X size={16} className="md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
