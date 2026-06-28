import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Shield, XCircle, Gavel, Briefcase, Video, Sparkles, Newspaper, Mic, Radio, Crown, Users } from 'lucide-react'
import { notifyCareerApplicationSubmitted } from '../lib/notifications'

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
  tcnn_news_caster: { title: 'TCNN News Caster', icon: Mic, description: 'On-air TCNN personality delivering breaking news, live reports, and official city broadcasts.' },
  secretary: { title: 'Secretary', icon: Briefcase, description: 'Official city support role for admin operations, reports, meetings, and city coordination.' },
  pastor: { title: 'Pastor', icon: Sparkles, description: 'Provide spiritual guidance, community support, and city services for Troll City.' },
  chief_news_caster: { title: 'Chief News Caster', icon: Radio, description: 'Lead the TCNN team, manage journalists and news casters, and maintain editorial standards.' },
  tcnn_chief_news_caster: { title: 'TCNN Chief News Caster', icon: Radio, description: 'Lead the TCNN team, manage journalists and news casters, and maintain editorial standards.' },
  troll_officer: { title: 'Troll Officer', icon: Shield, description: 'Official city enforcer responsible for reports, moderation, investigations, arrests, and safety response.' },
  lead_officer: { title: 'Lead Troll Officer', icon: Crown, description: 'Senior enforcement role overseeing Troll Officers, cases, escalation, and city safety consistency.' },
  lead_troll_officer: { title: 'Lead Troll Officer', icon: Crown, description: 'Senior enforcement role overseeing Troll Officers, cases, escalation, and city safety consistency.' },
  journalist: { title: 'Journalist', icon: Newspaper, description: 'Write articles, conduct investigations, and keep the city informed through Troll City News Network.' },
  agency_hr_manager: { title: 'Agency HR Manager', icon: Briefcase, description: 'Manage, approve, review, and settle issues for Troll City agencies.' },
  agency_leader: { title: 'Agency Leader', icon: Users, description: 'Lead a Troll City agency, recruit members, and grow creator talent.' },
  ceo_assistant: { title: 'CEO Assistant', icon: Crown, description: 'Assist the CEO with reports, coordination, admin follow-up, and platform operations.' },
  noah_assistant: { title: 'Noah Assistant', icon: Briefcase, description: 'Assist Noah Admin with reports, support tasks, and city operation follow-up.' },
  troller: { title: 'Troller', icon: Video, description: 'Entertainer role focused on playful chaos, satire, comedy, and broadcast engagement within city rules.' },
}

const positionToRoleCheck: Record<string, { field: string; message: string }> = {
  auctioneer: { field: 'is_auctioneer', message: 'You are already an Auctioneer' },
  secretary: { field: 'is_secretary', message: 'You are already a Secretary' },
  pastor: { field: 'is_pastor', message: 'You are already a Pastor' },
  troll_officer: { field: 'is_troll_officer', message: 'You are already a Troll Officer' },
  lead_officer: { field: 'is_lead_officer', message: 'You are already a Lead Troll Officer' },
  lead_troll_officer: { field: 'is_lead_officer', message: 'You are already a Lead Troll Officer' },
  troller: { field: 'is_troller', message: 'You are already a Troller' },
  journalist: { field: 'is_journalist', message: 'You are already a Journalist' },
  news_caster: { field: 'is_news_caster', message: 'You are already a News Caster' },
  tcnn_news_caster: { field: 'is_news_caster', message: 'You are already a News Caster' },
  chief_news_caster: { field: 'is_chief_news_caster', message: 'You are already a Chief News Caster' },
  tcnn_chief_news_caster: { field: 'is_chief_news_caster', message: 'You are already a Chief News Caster' },
  agency_hr_manager: { field: 'is_agency_hr_manager', message: 'You are already an Agency HR Manager' },
  agency_leader: { field: 'is_agency_leader', message: 'You are already an Agency Leader' },
  ceo_assistant: { field: 'is_ceo_assistant', message: 'You are already a CEO Assistant' },
  noah_assistant: { field: 'is_noah_assistant', message: 'You are already a Noah Assistant' },
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

      const positionTitle = positionToJobPosition[positionId]?.title || 'Unknown Position'
      await notifyCareerApplicationSubmitted(user.id, positionId, positionTitle)

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

  // If no position specified, redirect to the careers listing page
  useEffect(() => {
    if (!positionId) {
      navigate('/careers')
    }
  }, [positionId, navigate])

  // Redirect invalid /apply?position=... values back to careers
  useEffect(() => {
    if (positionId && !positionToJobPosition[positionId]) {
      navigate('/careers')
    }
  }, [positionId, navigate])

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

  // This view is intentionally blank: the app redirects to `/careers`
  // when no `position` query param is present. Return null to
  // avoid rendering the legacy listing UI.
  return null
}
