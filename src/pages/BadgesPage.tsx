import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import BadgesGrid from '@/components/badges/BadgesGrid'

export default function BadgesPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const targetUserId = userId || currentUser?.id

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badges</h1>
        </div>

        <BadgesGrid userId={targetUserId} />
      </div>
    </div>
  )
}
