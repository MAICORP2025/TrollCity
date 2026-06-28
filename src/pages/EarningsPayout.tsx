// src/pages/EarningsPayout.tsx
// Redirects to the unified MAI Pay / Fast Pay cashout system
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function EarningsPayout() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirect to the unified MAI Pay system
    navigate('/mai-pay', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#05030B] text-white p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-troll-gold border-r-transparent mb-4" />
        <p className="text-gray-400">Redirecting to MAI Pay...</p>
      </div>
    </div>
  )
}
