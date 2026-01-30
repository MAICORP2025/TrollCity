import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { 
  Video, Calendar, Clock, FileText, CheckCircle, 
  XCircle, AlertCircle, Users, MessageSquare, Play
} from 'lucide-react'

interface InterviewSession {
  id: string
  application_id: string
  user_id: string
  interviewer_id: string
  scheduled_at: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes: string
  applicant_name: string
  applicant_username: string
}

export default function AdminInterviewDashboard() {
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [interviews, setInterviews] = useState<InterviewSession[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchInterviews()
  }, [])

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('*')
        .in('status', ['active', 'completed'])
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      // Get user profiles for each interview
      const userIds = [...new Set(data.map((i: any) => i.user_id))]
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, full_name')
        .in('id', userIds)

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

      const formattedInterviews = data.map((interview: any) => {
        const profile = profileMap.get(interview.user_id)
        return {
          ...interview,
          applicant_name: profile?.full_name || profile?.username || 'Unknown',
          applicant_username: profile?.username || 'unknown'
        }
      })

      setInterviews(formattedInterviews)
    } catch (error) {
      console.error('Error fetching interviews:', error)
      toast.error('Failed to load interviews')
    } finally {
      setLoading(false)
    }
  }

  const createFakeInterview = async () => {
    if (!user) return

    try {
      // Create fake application
      const { data: application, error: appError } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          type: 'troll_officer',
          status: 'approved',
          experience: 'Test applicant for demo',
          motivation: 'I want to help moderate!',
          availability: 'Full time',
          skills: ['Communication'],
          created_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .select()
        .single()

      if (appError) throw appError

      // Create fake interview session
      const { data: interview, error: interviewError } = await supabase
        .from('interview_sessions')
        .insert({
          application_id: application.id,
          user_id: user.id,
          interviewer_id: user.id,
          scheduled_at: new Date().toISOString(),
          status: 'active',
          notes: '🎭 Test interview session for demo purposes'
        })
        .select()
        .single()

      if (interviewError) throw interviewError

      toast.success('Fake interview created!')
      navigate(`/interview/${interview.id}`)
    } catch (error: any) {
      console.error('Error creating fake interview:', error)
      toast.error(error.message || 'Failed to create fake interview')
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      completed: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
      hired: 'bg-green-500/20 text-green-400 border border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
    }
    return colors[status] || colors.active
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Video className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Interview Dashboard</h1>
                <p className="text-gray-400">Manage and test interview sessions</p>
              </div>
            </div>
            
            <button
              onClick={createFakeInterview}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Create Test Interview
            </button>
          </div>
        </div>

        {/* Scheduled Interviews */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
          <div className="p-6 border-b border-[#2C2C2C]">
            <h2 className="text-lg font-semibold text-white">Scheduled Interviews</h2>
            <p className="text-gray-400 text-sm">{interviews.length} interview(s)</p>
          </div>

          {interviews.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Interviews Scheduled</h3>
              <p className="text-gray-400 mb-6">Create a test interview to get started</p>
              <button
                onClick={createFakeInterview}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
              >
                Create Test Interview
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#2C2C2C]">
              {interviews.map((interview) => (
                <div key={interview.id} className="p-6 flex items-center justify-between hover:bg-[#252525] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{interview.applicant_name}</h4>
                      <p className="text-gray-400 text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {new Date(interview.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getStatusBadge(interview.status)}`}>
                      {interview.status === 'in_progress' ? 'Live' : interview.status}
                    </span>
                    <button
                      onClick={() => navigate(`/interview/${interview.id}`)}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      {interview.status === 'scheduled' ? 'Start Interview' : 'Rejoin'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">🎭 Test Mode Instructions</h3>
          <ul className="space-y-2 text-gray-400">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Click "Create Test Interview" to set up a fake interview
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Click "Start Interview" to enter the interview room
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Toggle "Test Mode" to see fake avatars instead of camera feeds
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              The fake avatar shows an animated character with a unique identity
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
