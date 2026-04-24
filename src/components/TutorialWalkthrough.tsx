import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { 
  X, ChevronRight, ChevronLeft, Sparkles, Home, Gavel, Building2,
  Warehouse, Store, Trophy, TrendingUp, Coins, Star, Scale, Globe,
  Radio, MessageSquare, Video, Users, Gift, Wallet, Shield, Crown,
  Eye, BookOpen, Heart, Zap, LayoutDashboard, Newspaper
} from 'lucide-react'
import { TutorialBanner } from './TutorialBanner'

export interface TutorialPage {
  id: string
  title: string
  description: string
  shortDesc: string
  icon: React.ReactNode
  path: string
  required: boolean
}

export const TUTORIAL_PAGES: TutorialPage[] = [
  {
    id: 'home',
    title: 'Home',
    description: 'Your home base! This is where the community wall lives. See posts from other users, check out trending content, and get a pulse on what is happening in Troll City.',
    shortDesc: 'Community wall & live streams',
    icon: <Home className="w-6 h-6" />,
    path: '/',
    required: true
  },
  {
    id: 'live',
    title: 'Live Auctions',
    description: 'Bid on cars, properties, rare items, and exclusive packages! Auctions run 24/7. Place your bids and try to win big. New items go up daily.',
    shortDesc: 'Bid on cars, property & more',
    icon: <Gavel className="w-6 h-6 text-green-500" />,
    path: '/auctions',
    required: true
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    description: 'Buy and sell items with other users! Find rare collectibles, upgrade your gear, and build your inventory. List your own items for sale.',
    shortDesc: 'Buy & sell items',
    icon: <Store className="w-6 h-6" />,
    path: '/marketplace',
    required: true
  },
  {
    id: 'tcps',
    title: 'TCPS Messaging',
    description: 'Your private messaging hub! Send direct messages, create group chats, and make voice calls. Connect with friends and build your network.',
    shortDesc: 'Private messaging & calls',
    icon: <MessageSquare className="w-6 h-6" />,
    path: '/tcps',
    required: true
  },
  // Optional additional pages (not required for tutorial completion)
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    description: 'See the top streamers, bidders, and community contributors! Climb the ranks by streaming, participating in auctions, and being active.',
    shortDesc: 'Top streamers & contributors',
    icon: <Trophy className="w-6 h-6" />,
    path: '/leaderboard',
    required: false
  },
  {
    id: 'credit',
    title: 'Credit Score',
    description: 'Your financial reputation! A good credit score unlocks lower auction fees, higher bidding limits, and VIP features. Keep it healthy by making on-time payments.',
    shortDesc: 'Financial reputation tracker',
    icon: <TrendingUp className="w-6 h-6" />,
    path: '/credit-scores',
    required: false
  },
  {
    id: 'store',
    title: 'Coin Store',
    description: 'Purchase coins to bid in auctions, send gifts, and unlock premium features. Multiple payment options available. Watch for special discounts!',
    shortDesc: 'Purchase coins & gifts',
    icon: <Coins className="w-6 h-6" />,
    path: '/store',
    required: false
  },
  {
    id: 'troll-court',
    title: 'Troll Court',
    description: 'File complaints, attend hearings, and seek justice! Report rule violations, resolve disputes, or defend yourself against accusations.',
    shortDesc: 'Dispute resolution system',
    icon: <Scale className="w-6 h-6" />,
    path: '/troll-court',
    required: false
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Your personal space! Customize your profile, view your stats, see your gifts received, and share your profile link with friends.',
    shortDesc: 'Your personal profile',
    icon: <Eye className="w-6 h-6" />,
    path: '/profile',
    required: false
  }
]

export const CREATOR_TUTORIAL_PAGES: TutorialPage[] = [
  {
    id: 'creator-switch',
    title: 'Creator Mode',
    description: 'Switch between viewer and broadcaster mode! Access your dashboard, view analytics, and manage your streaming setup from here.',
    shortDesc: 'Toggle creator mode',
    icon: <Star className="w-6 h-6 text-purple-500" />,
    path: '/creator-switch',
    required: true
  },
  {
    id: 'broadcast-setup',
    title: 'Broadcast Setup',
    description: 'Your streaming studio! Set up your title, category, camera, and mic. Enable alerts and go live with one click!',
    shortDesc: 'Set up & start streaming',
    icon: <Video className="w-6 h-6 text-pink-500" />,
    path: '/broadcast/setup',
    required: true
  },
  {
    id: 'wallet-earnings',
    title: 'Earnings & Wallet',
    description: 'Track everything! See gift earnings, auction winnings, and withdrawal history. Cash out whenever you want.',
    shortDesc: 'Earnings & payouts',
    icon: <Wallet className="w-6 h-6" />,
    path: '/wallet',
    required: true
  },
  {
    id: 'loots',
    title: 'Loot & Items',
    description: 'Give your viewers loot drops! Earn loot boxes through milestones and distribute prizes to your community.',
    shortDesc: 'Give viewer loot drops',
    icon: <Gift className="w-6 h-6 text-yellow-500" />,
    path: '/loots',
    required: false
  }
]

export const TutorialContext = React.createContext<TutorialContextType | undefined>(undefined)

export type TutorialContextType = {
  isActive: boolean
  visitedPages: string[]
  requiredPages: TutorialPage[]
  targetPage: TutorialPage | null
  progress: number
  totalRequired: number
  startTutorial: () => void
  completeTutorial: () => Promise<void>
  markVisited: (pageId: string) => void
  resetTutorial: () => void
}

export const useTutorial = () => {
  const context = React.useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider')
  }
  return context
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { profile } = useAuthStore()
  const [isActive, setIsActive] = useState(false)
  const [visitedPages, setVisitedPages] = useState<Set<string>>(new Set())
  
  const isCreator = profile?.role === 'creator' || profile?.troll_role === 'creator'
  
  const allPages = useMemo(() => {
    const pages = [...TUTORIAL_PAGES]
    if (isCreator) {
      pages.push(...CREATOR_TUTORIAL_PAGES)
    }
    return pages
  }, [isCreator])
  
  const requiredPages = useMemo(() => allPages.filter(p => p.required), [allPages])
  
  const startTutorial = useCallback(() => {
    setIsActive(true)
    setVisitedPages(new Set())
  }, [])
  
  const completeTutorial = useCallback(async () => {
    setIsActive(false)
    if (profile?.id) {
      try {
        await supabase
          .from('user_profiles')
          .update({ has_seen_tutorial: true })
          .eq('id', profile.id)
      } catch (error) {
        console.error('Failed to mark tutorial as seen:', error)
      }
    }
  }, [profile?.id])
  
  const markVisited = useCallback((pageId: string) => {
    setVisitedPages(prev => new Set([...prev, pageId]))
  }, [])
  
  const resetTutorial = useCallback(() => {
    setIsActive(false)
    setVisitedPages(new Set())
  }, [])
  
  const progress = useMemo(() => 
    requiredPages.filter(p => visitedPages.has(p.id)).length,
    [requiredPages, visitedPages]
  )
  
  const totalRequired = requiredPages.length
  
  const targetPage = useMemo(() => 
    requiredPages.find(p => !visitedPages.has(p.id)) ?? null,
    [requiredPages, visitedPages]
  )
  
  const value: TutorialContextType = {
    isActive,
    visitedPages: Array.from(visitedPages),
    requiredPages,
    targetPage,
    progress,
    totalRequired,
    startTutorial,
    completeTutorial,
    markVisited,
    resetTutorial
  }
  
  // Auto-complete tutorial when all required pages are visited
  useEffect(() => {
    if (isActive && progress >= totalRequired && totalRequired > 0) {
      completeTutorial()
    }
  }, [progress, totalRequired, isActive, completeTutorial])
  
  const hasSeenTutorial = (profile as any)?.has_seen_tutorial === true
  const isOnHomePage = location.pathname === '/home'
  const isLoggingOut = typeof window !== 'undefined' && sessionStorage.getItem('logout_requested') === 'true'
  const showBanner = !hasSeenTutorial && !isActive && isOnHomePage && !isLoggingOut
  
  return (
    <TutorialContext.Provider value={value}>
      {children}
      {showBanner && <TutorialBanner onStart={startTutorial} />}
    </TutorialContext.Provider>
  )
}

export default TutorialProvider
