import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { Shield } from 'lucide-react'

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
  // 1. Admin ONLY -> ALLOWED
  // 2. Others -> Show "Under Construction"
  
  const isAdmin = profile.role === 'admin' || profile.is_admin === true

  if (isAdmin) {
    return <Outlet />
  }

  // 🚧 Under Construction for non-admins
  return (
    <div className="min-h-screen bg-[#050012] flex flex-col items-center justify-center text-white p-6 text-center">
      <div className="w-24 h-24 bg-purple-900/20 rounded-full flex items-center justify-center mb-6 border border-purple-500/30">
        <Shield className="w-12 h-12 text-purple-400" />
      </div>
      <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 mb-4">
        TROLLS@NIGHT
      </h1>
      <h2 className="text-2xl font-bold text-white mb-2">UNDER CONSTRUCTION</h2>
      <p className="text-gray-400 max-w-md">
        This section is currently being built. Check back later for the grand opening!
      </p>
      <button 
        onClick={() => window.history.back()}
        className="mt-8 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
      >
        Go Back
      </button>
    </div>
  )
}
