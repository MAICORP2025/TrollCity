import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Shield, XCircle, Gavel, Briefcase, Video, Sparkles, Newspaper, Mic, Radio, Crown } from 'lucide-react'

interface JobPosition {
  id: string
  title: string
  department: string
  description: string | null
  max_applications: number
  is_open: boolean
}

const positionToJobPosition: Record<string, { title: string; icon: any; description: string }> = {
  auctioneer: { title: 'Auctioneer', icon: Sparkles, description: 'Host live auction shows where users bid with Troll Coins and build a trusted auctioneer reputation.' },
  prosecutor: { title: 'Troll Court Prosecutor', icon: Gavel, description: 'Represents Troll City in court cases, reviews evidence, presents charges, and supports city justice.' },
  attorney: { title: 'Troll Court Attorney', icon: Shield, description: 'Defense attorney representing defendants in Troll Court cases, appeals, hearings, and disputes.' },
  news_caster: { title: 'News Caster', icon: Mic, description: 'On-air TCNN personality delivering breaking news, live reports, and official city broadcasts.' },
  secretary: { title: 'Secretary', icon: Briefcase, description: 'Official city support role for admin operations, reports, meetings, and city coordination.' },
  chief_news_caster: { title: 'Chief News Caster', icon: Radio, description: 'Lead the TCNN team, manage journalists and news casters, and maintain editorial standards.' },
  troll_officer: { title: 'Troll Officer', icon: Shield, description: 'Official city enforcer responsible for reports, moderation, investigations, arrests, and safety response.' },
  journalist: { title: 'Journalist', icon: Newspaper, description: 'Write articles, conduct investigations, and keep the city informed through Troll City News Network.' },
  lead_officer: { title: 'Lead Troll Officer', icon: Crown, description: 'Senior enforcement role overseeing Troll Officers, cases, escalation, and city safety consistency.' },
  troller: { title: 'Troller', icon: Video, description: 'Entertainer role focused on playful chaos, satire, comedy, and broadcast engagement within city rules.' },
}

const positionToRoleCheck: Record<string, { field: string; message: string }> = {
  auctioneer: { field: 'is_auctioneer', message: 'You are already an Auctioneer' },
  secretary: { field: 'is_secretary', message: 'You are already a Secretary' },
  troll_officer: { field: 'is_troll_officer', message: 'You are already a Troll Officer' },
  lead_officer: { field: 'is_lead_officer', message: 'You are already a Lead Troll Officer' },
  troller: { field: 'is_troller', message: 'You are already a Troller' },
  journalist: { field: 'is_journalist', message: 'You are already a Journalist' },
  news_caster: { field: 'is_news_caster', message: 'You are already a News Caster' },
  chief_news_caster: { field: 'is_chief_news_caster', message: 'You are already a Chief News Caster' },
  prosecutor: { field: 'is_prosecutor', message: 'You are already a Prosecutor' },
  attorney: { field: 'is_attorney', message: 'You are already an Attorney' },
}

export default function Application() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const positionId = searchParams.get('position')
  const [loading, setLoading] = useState(false)

  const checkRoleEligibility = (positionId: string): { eligible: boolean; message?: string } => {
    const check = positionToRoleCheck[positionId]
    if (check) {
      const roleValue = (profile as any)?.[check.field]
      if (roleValue) {
        return { eligible: false, message: check.message }
      }
    }

    if ((profile as any)?.role === positionId || (profile as any)?.troll_role === positionId) {
      const title = positionToJobPosition[positionId]?.title || 'this role'
      return { eligible: false, message: `You are already a ${title}` }
    }

    return { eligible: true }
  }

  const handleSubmitApplication = useCallback(async (positionId: string) => {
    if (!user) {
      toast.error('Please sign in to apply')
      navigate('/auth')
      return
    }

    const eligibility = checkRoleEligibility(positionId)
    if (!eligibility.eligible) {
      toast.error(eligibility.message)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_applications')
        .insert({
          user_id: user.id,
          position_id: positionId,
          status: 'pending'
        })

      if (error) throw error

      toast.success('Application submitted! We will review it soon.')
      navigate('/careers')
    } catch (err: any) {
      console.error('Application error:', err)
      toast.error(err.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }, [user, profile, navigate])

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }
  }, [user, navigate])

  if (positionId && positionToJobPosition[positionId]) {
    const position = positionToJobPosition[positionId]
    const eligibility = checkRoleEligibility(positionId)
    
    if (!eligibility.eligible) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
          <div className="text-center p-6">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{eligibility.message}</h2>
            <button
              onClick={() => navigate('/careers')}
              className="px-4 py-2 bg-purple-600 rounded-lg"
            >
              Back to Careers
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <position.icon className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Apply for {position.title}</h1>
            <p className="text-gray-400">{position.description}</p>
          </div>

          <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-2">Application Process</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Click "Submit Application" to apply for this career</li>
              <li>• Wait for admin review and approval</li>
              <li>• You'll receive a notification when your application is reviewed</li>
            </ul>
          </div>

          <button
            onClick={() => handleSubmitApplication(positionId)}
            disabled={loading}
            className="w-full px-6 py-3 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Apply for Roles</h1>
          <p className="text-gray-400">Choose a role to apply for in Troll City</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {Object.entries(positionToJobPosition).map(([id, pos]) => {
            const Icon = pos.icon
            const isDisabled = !checkRoleEligibility(id).eligible || loading
            const disabledText = checkRoleEligibility(id).message

            return (
              <div
                key={id}
                className="rounded-xl border-2 border-purple-600 bg-purple-900/20 p-6 transition-all hover:scale-105 cursor-pointer hover:shadow-lg"
                onClick={() => navigate(`/apply?position=${id}`)}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-purple-600/20">
                    <Icon className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{pos.title}</h2>
                  </div>
                </div>
                <p className="text-gray-300 mb-4">{pos.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
)
}
