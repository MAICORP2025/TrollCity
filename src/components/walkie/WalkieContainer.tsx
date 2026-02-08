import React, { useState } from 'react'
import WalkieButton from './WalkieButton'
import WalkieInterface from './WalkieInterface'
import { useAuthStore } from '../../lib/store'

export default function WalkieContainer() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, profile } = useAuthStore()

  // Strict Staff Check
  const isStaff = profile?.role === 'admin' || 
                  profile?.is_admin || 
                  profile?.is_troll_officer || 
                  profile?.role === 'moderator' || 
                  profile?.role === 'lead_troll_officer' ||
                  profile?.role === 'secretary'

  if (!user || !isStaff) return null

  return (
    <>
      <WalkieButton 
        isOpen={isOpen} 
        onClick={() => setIsOpen(!isOpen)} 
      />
      <WalkieInterface 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  )
}
