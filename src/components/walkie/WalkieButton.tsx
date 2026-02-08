import React, { useEffect, useState } from 'react'
import { Phone, AlertTriangle, Radio } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../lib/store'
import { walkieApi } from '../../lib/walkie'
import { toast } from 'sonner'

interface WalkieButtonProps {
  onClick: () => void
  isOpen: boolean
}

export default function WalkieButton({ onClick, isOpen }: WalkieButtonProps) {
  const { user, profile } = useAuthStore()
  const [hasIncomingPage, setHasIncomingPage] = useState(false)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  
  // Only show for staff
  const isStaff = profile?.role === 'admin' || 
                  profile?.is_admin || 
                  profile?.is_troll_officer || 
                  profile?.role === 'moderator' || 
                  profile?.role === 'lead_troll_officer' ||
                  profile?.role === 'secretary'

  useEffect(() => {
    if (!user || !isStaff) return

    // Check for active session
    const checkActiveSession = async () => {
      const session = await walkieApi.getActiveSession()
      setHasActiveSession(!!session)
    }
    
    checkActiveSession()

    // Subscribe to incoming pages
    const pageSubscription = walkieApi.subscribeToPages(user.id, (payload) => {
      if (payload.new.status === 'pending') {
        setHasIncomingPage(true)
        toast('Incoming Walkie Page!', {
          icon: <Radio className="w-4 h-4 text-yellow-400" />,
        })
      }
    })

    // Subscribe to session changes (if we join one)
    // For now just polling or relying on parent to update state might be better
    // But let's simple check periodically? Or better, rely on WalkieInterface to update status
    
    return () => {
      pageSubscription.unsubscribe()
    }
  }, [user, isStaff])

  if (!isStaff) return null

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-24 right-4 z-[9999] w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg border-2",
        isOpen 
          ? "bg-purple-600 border-purple-400 text-white" 
          : "bg-slate-900/90 border-slate-700 text-slate-400 hover:text-white hover:border-purple-500",
        (hasIncomingPage || hasActiveSession) && !isOpen && "animate-pulse ring-4 ring-purple-500/30 border-purple-500 text-purple-200 bg-purple-900/80"
      )}
    >
      {hasIncomingPage ? (
        <Radio className="w-6 h-6 animate-bounce" />
      ) : (
        <Phone className="w-5 h-5" />
      )}
    </button>
  )
}
