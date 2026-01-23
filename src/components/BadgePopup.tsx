import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Award } from 'lucide-react'

interface BadgeDetails {
  id: string
  name: string
  description: string
  icon_url: string | null
  rarity: string
}

export default function BadgePopup() {
  const user = useAuthStore((s) => s.user)
  const [queue, setQueue] = useState<BadgeDetails[]>([])
  const [currentBadge, setCurrentBadge] = useState<BadgeDetails | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Listen for new badges
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('badge-popup-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('New badge awarded!', payload)
          const badgeId = payload.new.badge_id
          
          // Fetch badge details
          const { data, error } = await supabase
            .from('badge_catalog')
            .select('id, name, description, icon_url, rarity')
            .eq('id', badgeId)
            .single()

          if (data && !error) {
            setQueue((prev) => [...prev, data])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Process queue
  useEffect(() => {
    if (!isVisible && queue.length > 0) {
      setCurrentBadge(queue[0])
      setQueue((prev) => prev.slice(1))
      setIsVisible(true)
    }
  }, [isVisible, queue])

  // Auto hide after 5 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'legendary': return 'from-yellow-500 to-amber-700 border-yellow-400'
      case 'epic': return 'from-purple-500 to-fuchsia-700 border-purple-400'
      case 'rare': return 'from-blue-500 to-cyan-700 border-blue-400'
      case 'mythic': return 'from-red-500 to-rose-700 border-red-400'
      default: return 'from-slate-600 to-slate-800 border-slate-500'
    }
  }

  const getRarityGlow = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'legendary': return 'shadow-[0_0_30px_rgba(234,179,8,0.5)]'
      case 'epic': return 'shadow-[0_0_30px_rgba(168,85,247,0.5)]'
      case 'rare': return 'shadow-[0_0_30px_rgba(59,130,246,0.5)]'
      case 'mythic': return 'shadow-[0_0_30px_rgba(239,68,68,0.5)]'
      default: return 'shadow-[0_0_20px_rgba(148,163,184,0.3)]'
    }
  }

  if (!currentBadge && !isVisible) return null

  return (
    <AnimatePresence>
      {isVisible && currentBadge && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-8 right-8 z-[100] max-w-sm w-full"
        >
          <div className={`relative overflow-hidden rounded-xl border-2 bg-gradient-to-br ${getRarityColor(currentBadge.rarity)} p-1 ${getRarityGlow(currentBadge.rarity)}`}>
            
            {/* Background Effects */}
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            
            <div className="relative bg-[#1a1b26]/90 backdrop-blur-sm rounded-lg p-4 flex items-start gap-4">
              {/* Close Button */}
              <button 
                onClick={() => setIsVisible(false)}
                className="absolute top-2 right-2 text-white/50 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              {/* Icon */}
              <div className="flex-shrink-0">
                {currentBadge.icon_url ? (
                  <img src={currentBadge.icon_url} alt={currentBadge.name} className="w-16 h-16 object-contain drop-shadow-lg" />
                ) : (
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getRarityColor(currentBadge.rarity)} flex items-center justify-center`}>
                    <Award className="text-white w-8 h-8" />
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 pt-1">
                <div className="text-xs font-bold uppercase tracking-wider text-yellow-400 mb-1">
                  New Badge Unlocked!
                </div>
                <h3 className="text-lg font-bold text-white leading-tight mb-1">
                  {currentBadge.name}
                </h3>
                <p className="text-sm text-gray-300 leading-snug">
                  {currentBadge.description}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
