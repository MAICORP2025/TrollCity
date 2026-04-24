import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase, UserRole } from '@/lib/supabase'
import { PreflightStore } from '@/lib/preflightStore'
import { 
  X, ChevronRight, ChevronLeft, Play, Radio, 
  Users, Coins, Trophy, Crown, Shield, Gavel, Building2,
  MessageSquare, Star, Package, ShoppingBag, Scale, Globe, 
  Sparkles, Zap, Heart, Gift, Wallet, BookOpen, Scale3d,
  Home, Video
} from 'lucide-react'

interface TutorialStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  highlight?: string
}

interface TutorialConfig {
  name: string
  steps: TutorialStep[]
}

const ALL_USER_TUTORIAL: TutorialConfig = {
  name: 'Getting Started',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Troll City',
      description: 'The ultimate social streaming & battle arena. Watch live streams, chat with friends, send gifts, battle rivals, and climb the leaderboard! Use the sidebar to navigate between different sections.',
      icon: <Sparkles className="w-12 h-12 text-yellow-400" />
    },
    {
      id: 'homepage',
      title: 'The Homepage',
      description: 'This is your home base! The wall shows posts from the community. Click on the Live tab to see who is streaming now. The sidebar on the left has all the features - click any icon to explore!',
      icon: <Home className="w-12 h-12 text-purple-500" />
    },
    {
      id: 'sidebar',
      title: 'The Sidebar',
      description: 'Your navigation hub! Home button takes you back here. Live Auctions, Troll Town, Living space, Inventory, Marketplace, Leaderboard, Credit scores, Coin Store, Creator mode, Troll Court, President, and more!',
      icon: <Globe className="w-12 h-12 text-cyan-500" />
    },
    {
      id: 'live',
      title: 'Watch Live Streams',
      description: 'Click the Live tab on the homepage OR go to the sidebar and click the gavel icon for Live Auctions. Watch broadcasts, send reactions, chat in real-time!',
      icon: <Radio className="w-12 h-12 text-red-500" />
    },
    {
      id: 'tcps',
      title: 'TCPS Chat System',
      description: 'Your private messaging hub! Click TCPS in the sidebar for private messages, group chats, and voice calls. Connect with friends and build your network!',
      icon: <MessageSquare className="w-12 h-12 text-purple-500" />
    },
    {
      id: 'gifts',
      title: 'Send Gifts & Earn Rewards',
      description: 'Click any streamer\'s profile to send virtual gifts! Earn coins through broadcasts, battles, and daily login. Your balance shows in the header - tap for full wallet details!',
      icon: <Gift className="w-12 h-12 text-yellow-500" />
    },
    {
      id: 'leaderboard',
      title: 'Climb the Leaderboard',
      description: 'Compete with other users! Check Rankings in the sidebar. Top streamers earn badges, perks, and get featured on the homepage!',
      icon: <Trophy className="w-12 h-12 text-amber-500" />
    },
    {
      id: 'wallet',
      title: 'Your Wallet',
      description: 'Click the coin icon in the header! Track earnings, manage coins, view transaction history, and withdraw funds. Your money, your way!',
      icon: <Wallet className="w-12 h-12 text-green-500" />
    }
  ]
}

const CREATOR_TUTORIAL: TutorialConfig = {
  name: 'Creator Features',
  steps: [
    {
      id: 'go-live',
      title: 'GO LIVE - Start Broadcasting',
      description: 'The yellow GO LIVE button in the sidebar is your broadcast studio! Click it to set up your stream - add title, choose category, enable camera/mic, then hit Go Live to start! Your viewers will see you on the Live tab.',
      icon: <Play className="w-12 h-12 text-pink-500" />,
      highlight: '/broadcast/setup'
    },
    {
      id: 'broadcast-setup',
      title: 'Broadcast Setup',
      description: 'On the setup page: Add a catchy title, select category (Just Chatting, Gaming, Music, etc), toggle your camera and mic. The "Start Broadcast" button goes LIVE!',
      icon: <Video className="w-12 h-12 text-pink-500" />,
      highlight: '/broadcast/setup'
    },
    {
      id: 'battles',
      title: 'Troll Battles',
      description: 'Challenge other streamers! During a broadcast, click "Start Battle" to challenge another live streamer. Battles bring in viewers and multiply gift earnings!',
      icon: <Shield className="w-12 h-12 text-orange-500" />
    },
    {
      id: 'creator-switch',
      title: 'Creator Mode',
      description: 'The wand icon in the sidebar is your Creator Dashboard. Switch between viewer and broadcaster mode here. Access analytics, growth tips, and creator perks!',
      icon: <Star className="w-12 h-12 text-purple-500" />,
      highlight: '/creator-switch'
    },
    {
      id: 'audience',
      title: 'Build Your Audience',
      description: 'Consistent streaming schedules, engaging content, and interacting with chat grow your following! Share your profile link on TCPS to invite friends!',
      icon: <Users className="w-12 h-12 text-cyan-500" />
    },
    {
      id: 'monetize',
      title: 'Monetize Your Content',
      description: 'Earn coins from viewer gifts! Top performers get featured on homepage, earn badges, and get promoted on the city news (TCNN). Build your brand!',
      icon: <Coins className="w-12 h-12 text-yellow-500" />
    }
  ]
}

const GOVERNMENT_TUTORIAL: TutorialConfig = {
  name: 'Government Features',
  steps: [
    {
      id: 'officer',
      title: 'Officer Dashboard',
      description: 'Manage city safety, respond to reports, and enforce community guidelines!',
      icon: <Shield className="w-12 h-12 text-emerald-500" />,
      highlight: '/officer/dashboard'
    },
    {
      id: 'court',
      title: 'Troll Court System',
      description: 'File complaints, attend hearings, and seek justice in the city court!',
      icon: <Gavel className="w-12 h-12 text-orange-500" />,
      highlight: '/troll-court'
    },
    {
      id: 'tcnn',
      title: 'TCNN News',
      description: 'Stay informed with city news, broadcasts, and current events!',
      icon: <Globe className="w-12 h-12 text-blue-500" />,
      highlight: '/tcnn/dashboard'
    }
  ]
}

const FAMILY_TUTORIAL: TutorialConfig = {
  name: 'Family Features',
  steps: [
    {
      id: 'family',
      title: 'Your Troll Family',
      description: 'Build your family empire! Recruit members, compete in family battles, and earn team rewards!',
      icon: <Building2 className="w-12 h-12 text-amber-500" />,
      highlight: '/family/home'
    },
    {
      id: 'recruit',
      title: 'Recruit Members',
      description: 'Invite friends to join your family. Together you are stronger!',
      icon: <Users className="w-12 h-12 text-yellow-500" />
    },
    {
      id: 'family-battles',
      title: 'Family Battles',
      description: 'Family vs Family battles. Team up and represent your family pride!',
      icon: <Shield className="w-12 h-12 text-red-500" />
    }
  ]
}

interface TutorialOverlayProps {
  onComplete: () => void
  forceShow?: boolean
}

export default function TutorialOverlay({ onComplete, forceShow = false }: TutorialOverlayProps) {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; vx: number; vy: number; color: string; size: number }>>([])
  
  const isCreator = profile?.role === 'creator' || profile?.troll_role === 'creator'
  const isOfficer = profile?.is_troll_officer || profile?.role === 'admin' || profile?.is_admin
  const isFamily = profile?.role === 'troll_family' || profile?.troll_role === 'troll_family'
  const hasSeenTutorial = (profile as any)?.has_seen_tutorial === true
  
  const configs: TutorialConfig[] = [ALL_USER_TUTORIAL]
  if (isCreator) configs.push(CREATOR_TUTORIAL)
  if (isOfficer && profile?.role !== 'admin') configs.push(GOVERNMENT_TUTORIAL)
  if (isFamily) configs.push(FAMILY_TUTORIAL)
  
  const allSteps = configs.flatMap(c => c.steps)
  const totalSteps = allSteps.length
  const step = allSteps[currentStep]
  
  const currentConfig = configs.find(c => c.steps.some(s => s.id === step.id)) || configs[0]
  const configIndex = configs.indexOf(currentConfig)
  const configStepIndex = currentConfig.steps.findIndex(s => s.id === step.id)
  const configProgress = configStepIndex >= 0 ? configs.slice(0, configIndex).reduce((acc, c) => acc + c.steps.length, 0) + configStepIndex : 0
  
  useEffect(() => {
    if (forceShow || !hasSeenTutorial) {
      setIsVisible(true)
      PreflightStore.setInTutorial(true)
      generateParticles()
    }
    return () => {
      PreflightStore.setInTutorial(false)
    }
  }, [forceShow, hasSeenTutorial])
  
  const generateParticles = () => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      color: ['#fbbf24', '#ec4899', '#8b5cf6', '#06b6d4', '#22c55e'][Math.floor(Math.random() * 5)],
      size: Math.random() * 4 + 2
    }))
    setParticles(newParticles)
    
    const animate = () => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: (p.x + p.vx + 100) % 100,
        y: (p.y + p.vy + 100) % 100
      })))
    }
    
    const interval = setInterval(animate, 50)
    return () => clearInterval(interval)
  }
  
  const goToNext = useCallback(async () => {
    if (isAnimating) return
    setIsAnimating(true)
    
    if (currentStep < totalSteps - 1) {
      await new Promise(r => setTimeout(r, 150))
      setCurrentStep(prev => prev + 1)
    } else {
      await completeTutorial()
    }
    setIsAnimating(false)
  }, [currentStep, totalSteps, isAnimating])
  
  const goToPrev = useCallback(async () => {
    if (isAnimating || currentStep === 0) return
    setIsAnimating(true)
    await new Promise(r => setTimeout(r, 150))
    setCurrentStep(prev => prev - 1)
    setIsAnimating(false)
  }, [currentStep, isAnimating])
  
  const completeTutorial = async () => {
    PreflightStore.setInTutorial(false)
    if (profile?.id) {
      await supabase
        .from('user_profiles')
        .update({ has_seen_tutorial: true })
        .eq('id', profile.id)
    }
    localStorage.setItem('tutorial_seen_on_device', 'true')
    setIsVisible(false)
    onComplete()
  }
  
  const handleSkip = async () => {
    await completeTutorial()
  }
  
  const handleNavigate = () => {
    if (step.highlight) {
      completeTutorial()
      navigate(step.highlight)
    }
  }
  
  if (!isVisible) return null
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.3),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(236,72,153,0.2),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.15),transparent_50%)]" />
        
        {/* Animated Grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(139,92,246,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }} />
        <style>{`
          @keyframes gridMove {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
          }
        `}</style>
        
        {/* Floating Particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full animate-pulse"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              opacity: 0.8
            }}
          />
        ))}
      </div>
      
      {/* Content Card */}
      <div className="relative max-w-lg w-full mx-4">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>{configProgress + configStepIndex + 1}/{allSteps.length}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Main Card */}
        <div className={`bg-slate-900/80 backdrop-blur-2xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl transform transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          {/* Close Button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse" />
              <div className="relative bg-slate-800 rounded-full p-6 border border-purple-500/30">
                {step.icon}
              </div>
            </div>
          </div>
          
          {/* Title */}
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-white via-purple-100 to-slate-200 bg-clip-text text-transparent mb-4">
            {step.title}
          </h2>
          
          {/* Description */}
          <p className="text-slate-300 text-center text-lg leading-relaxed mb-8">
            {step.description}
          </p>
          
          {/* Navigation Buttons */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={goToPrev}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft size={20} />
                Back
              </button>
            )}
            
            {step.highlight ? (
              <button
                onClick={handleNavigate}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
              >
                <Zap size={20} />
                Go to {step.title}
              </button>
            ) : (
              <button
                onClick={goToNext}
                disabled={isAnimating}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-600 hover:from-purple-500 hover:via-pink-400 hover:to-cyan-500 text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:opacity-50"
              >
                {currentStep < totalSteps - 1 ? (
                  <>Next <ChevronRight size={20} /></>
                ) : (
                  <>Get Started! <Sparkles size={20} /></>
                )}
              </button>
            )}
          </div>
          
          {/* Skip Link */}
          <button
            onClick={handleSkip}
            className="w-full mt-4 text-slate-500 hover:text-slate-400 text-sm transition-colors"
          >
            Skip tutorial
          </button>
        </div>
        
        {/* Dots Indicator */}
        <div className="flex justify-center gap-2 mt-6">
          {allSteps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => !isAnimating && setCurrentStep(i)}
              className={`transition-all duration-300 rounded-full ${
                i === currentStep 
                  ? 'w-8 h-2 bg-gradient-to-r from-purple-500 to-pink-500' 
                  : 'w-2 h-2 bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore()
  const [showTutorial, setShowTutorial] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  
  useEffect(() => {
    const seenOnDevice = localStorage.getItem('tutorial_seen_on_device') === 'true'
    if (profile?.id && !seenOnDevice && !(profile as any)?.has_seen_tutorial) {
      setShowTutorial(true)
    }
    setIsLoaded(true)
  }, [profile?.id, (profile as any)?.has_seen_tutorial])
  
  if (!isLoaded) return null
  
  return (
    <>
      {children}
      {showTutorial && (
        <TutorialOverlay 
          onComplete={() => setShowTutorial(false)} 
        />
      )}
    </>
  )
}