import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { Shield, Lock } from 'lucide-react'

export default function TrollsNightGuard() {
  const { user, profile, isLoading } = useAuthStore()
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!isLoading) {
      setIsChecking(false)
    }
  }, [isLoading])

  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen bg-[#050012] flex items-center justify-center text-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Shield className="w-12 h-12 text-purple-600" />
          <span className="text-purple-200">Verifying Access...</span>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  // ✅ Access Logic:
  // 1. Admin / Lead Officer / Troll Officer -> ALWAYS ALLOWED
  // 2. Regular User -> MUST have 'trolls_night_approved' flag in profile
  
  const isStaff = ['admin', 'lead_troll_officer', 'troll_officer'].includes(profile.role)
  const isApproved = profile.trolls_night_approved === true

  if (isStaff || isApproved) {
    return <Outlet />
  }

  // ❌ Access Denied -> Redirect to Application
  return <Navigate to="/trolls-night/apply" replace />
}
