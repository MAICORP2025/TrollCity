import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Room, RoomEvent } from 'livekit-client'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { 
  Mic, MicOff, Video, VideoOff, Phone, MessageSquare, 
  Users, Clock, CheckCircle, XCircle, Briefcase, Shield
} from 'lucide-react'

// Interview session type
interface InterviewSession {
  id: string
  application_id: string
  user_id: string
  interviewer_id: string
  scheduled_at: string
  status: 'active' | 'completed' | 'hired' | 'rejected'
  notes: string
  applicant_name: string
  applicant_username: string
}

// Fake avatar images for test mode
const fakeAvatars = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana',
]

function getFakeAvatar(seed: string): string {
  // Use deterministic seed to pick avatar
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash
  }
  return fakeAvatars[Math.abs(hash) % fakeAvatars.length]
}

// Broadcast box component for showing video
function BroadcastBox({ 
  participant, 
  label, 
  isMuted, 
  isVideoOff,
  isInterviewer,
  useFakeAvatar = false // Enable fake avatar for test mode
}: { 
  participant?: any
  label: string
  isMuted?: boolean
  isVideoOff?: boolean
  isInterviewer?: boolean
  useFakeAvatar?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // const [avatarSeed] = useState(() => Math.random().toString(36).substring(7))

  useEffect(() => {
    const videoElement = videoRef.current;
    if (participant?.videoTrack?.track && videoElement && !useFakeAvatar) {
      try {
        participant.videoTrack.track.attach(videoElement)
      } catch (e) {
        console.warn('Video attach failed:', e)
      }
    }
    return () => {
      if (participant?.videoTrack?.track && videoElement) {
        try {
          participant.videoTrack.track.detach(videoElement)
        } catch (e) {
          console.warn('Video detach failed:', e)
        }
      }
    }
  }, [participant, useFakeAvatar])

  const fakeAvatarUrl = getFakeAvatar(label)

  return (
    <div 
      className={`relative bg-gray-900 rounded-xl overflow-hidden border-2 ${
        isInterviewer ? 'border-purple-500' : 'border-cyan-500'
      }`}
    >
      {/* Fake avatar mode - always show avatar */}
      {useFakeAvatar ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 relative">
          {/* Animated avatar background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-cyan-900/50 animate-pulse" />
          
          {/* Avatar image */}
          <div className="relative z-10 text-center">
            <div className="w-32 h-32 rounded-full bg-gray-800 p-2 mx-auto mb-4 shadow-2xl">
              <img 
                src={fakeAvatarUrl} 
                alt={label}
                className="w-full h-full rounded-full"
              />
            </div>
            <p className="text-white font-bold text-xl">{label}</p>
            <p className="text-cyan-400 text-sm mt-1">🎭 Test Mode</p>
          </div>
          
          {/* Recording indicator */}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/80 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-xs font-medium">REC</span>
          </div>
        </div>
      ) : !isVideoOff && participant ? (
        <video 
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
          muted={!isInterviewer}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isInterviewer ? 'bg-purple-500/20' : 'bg-cyan-500/20'
            }`}>
              <Users className={`w-10 h-10 ${isInterviewer ? 'text-purple-400' : 'text-cyan-400'}`} />
            </div>
            <p className="text-white font-medium">{label}</p>
            <p className="text-gray-400 text-sm">Camera Off</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-black/60 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">
        {isInterviewer ? <Shield className="w-4 h-4 text-purple-400" /> : <Briefcase className="w-4 h-4 text-cyan-400" />}
        <span>{label}</span>
      </div>

      <div className="absolute top-2 right-2 flex gap-2">
        {isMuted && (
          <div className="bg-red-500/80 p-1.5 rounded-full">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
        {isVideoOff && (
          <div className="bg-red-500/80 p-1.5 rounded-full">
            <VideoOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  )
}

export default function InterviewRoom() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [hiring, setHiring] = useState(false)
  const [testMode, setTestMode] = useState(false) // Fake avatar mode for testing

  const roomRef = useRef<Room | null>(null)

  const isAdminOrLead = profile?.role === 'admin' || profile?.role === 'lead_troll_officer'

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        toast.error('Invalid session ID')
        navigate('/career')
        return
      }

      try {
        const { data, error } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('id', sessionId)
          .single()

        if (error) throw error

        // Get user profile separately
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username, full_name')
          .eq('id', data.user_id)
          .single()

        const applicantName = profile?.full_name || profile?.username || 'Applicant'
        setSession({ ...data, applicant_name: applicantName })
        setNotes(data.notes || '')
      } catch (error) {
        console.error('Error fetching session:', error)
        toast.error('Failed to load interview session')
        navigate('/career')
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [sessionId, navigate])

  useEffect(() => {
    const getToken = async () => {
      if (!session || !user) return

      try {
        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL
        const functionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL ||
          'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

        if (!livekitUrl) {
          console.error('VITE_LIVEKIT_URL environment variable is not set')
          toast.error('LiveKit server URL not configured')
          return
        }

        // Validate LiveKit URL
        try {
          new URL(livekitUrl)
        } catch {
          console.error('Invalid VITE_LIVEKIT_URL:', livekitUrl)
          toast.error('Invalid LiveKit server URL configuration')
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const response = await fetch(`${functionsUrl}/livekit-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token}`
          },
          body: JSON.stringify({
            room: `interview-${sessionId}`,
            identity: profile?.username || user.id,
            allowPublish: true,
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('LiveKit token response:', response.status, errorText)
          throw new Error(`Failed to get token: ${response.status}`)
        }

        const data = await response.json()
        if (!data.token) {
          console.error('No token in response:', data)
          throw new Error('Invalid token response')
        }

        setToken(data.token)
      } catch (error) {
        console.error('Error getting LiveKit token:', error)
        toast.error('Failed to connect to interview room')
      }
    }

    getToken()
  }, [session, user, profile, sessionId])

  const connectToRoom = useCallback(async () => {
    if (!token || !session) {
      toast.error('Invalid room connection parameters')
      return
    }

    // Validate token is a proper URL
    let serverUrl: string
    try {
      // Handle token format: could be full URL or just token string
      if (token.includes('?')) {
        serverUrl = token.split('?')[0]
      } else {
        // Assume token is just the token string, use default LiveKit URL
        serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-livekit-server.livekit.cloud'
      }

      // Validate the server URL
      new URL(serverUrl)
    } catch (urlError) {
      console.error('Invalid URL:', urlError)
      toast.error('Invalid server URL configuration')
      return
    }

    try {
      setConnecting(true)
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === 'connected') {
          toast.success('Connected to interview room')
          setRoom(newRoom)
          roomRef.current = newRoom
        } else if (state === 'disconnected') {
          toast.info('Disconnected from interview room')
          setRoom(null)
          roomRef.current = null
        }
      })

      await newRoom.connect(serverUrl, token)
      roomRef.current = newRoom
      setRoom(newRoom)

      await supabase
        .from('interview_sessions')
        .update({ status: 'active' })
        .eq('id', session.id)

      setSession(prev => prev ? { ...prev, status: 'active' } : null)

    } catch (error) {
      console.error('Error connecting to room:', error)
      toast.error('Failed to connect to interview room')
    } finally {
      setConnecting(false)
    }
  }, [token, session])

  useEffect(() => {
    if (session?.status === 'active') {
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [session?.status])

  const toggleMute = async () => {
    if (room) {
      await room.localParticipant.setMicrophoneEnabled(isMuted)
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = async () => {
    if (room) {
      await room.localParticipant.setCameraEnabled(isVideoOff)
      setIsVideoOff(!isVideoOff)
    }
  }

  const endCall = async () => {
    if (room) {
      room.disconnect()
      setRoom(null)
      roomRef.current = null
    }
    
    if (session) {
      await supabase
        .from('interview_sessions')
        .update({ status: 'completed', notes })
        .eq('id', session.id)
    }
    
    toast.success('Interview ended')
    navigate('/career')
  }

  const hireCandidate = async () => {
    if (!session || !isAdminOrLead) return

    try {
      setHiring(true)
      
      await supabase
        .from('applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', session.application_id)

      const { data: application } = await supabase
        .from('applications')
        .select('type')
        .eq('id', session.application_id)
        .single()

      if (application) {
        const newRole = application.type === 'troll_officer' ? 'troll_officer' : 
                       application.type === 'lead_officer' ? 'lead_troll_officer' : 
                       application.type === 'pastor' ? 'pastor' : 'troller'

        await supabase
          .from('user_profiles')
          .update({ role: newRole })
          .eq('id', session.user_id)
      }

      await supabase
        .from('interview_sessions')
        .update({ status: 'completed', notes: notes + '\n\n✅ HIRED' })
        .eq('id', session.id)

      toast.success(`${session.applicant_name} has been hired!`)
      navigate('/admin/applications')
    } catch (error) {
      console.error('Error hiring candidate:', error)
      toast.error('Failed to hire candidate')
    } finally {
      setHiring(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading interview session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Session Not Found</h1>
          <p className="text-gray-400 mb-4">This interview session does not exist.</p>
          <button
            onClick={() => navigate('/career')}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
          >
            Go to Career Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/career')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <XCircle className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Interview Room</h1>
              <p className="text-gray-400 text-sm">{session.applicant_name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-mono">{formatTime(elapsedTime)}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              session.status === 'active' ? 'bg-green-500/20 text-green-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {session.status === 'active' ? 'Live Interview' : 'Completed'}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pt-20 pb-24">
        {!token ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Connecting to interview room...</p>
            </div>
          </div>
        ) : !room ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center mx-auto mb-6">
                <Users className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Ready to Start Interview</h2>
              <p className="text-gray-400 mb-6">
                You are about to interview <strong>{session.applicant_name}</strong>.
              </p>
              
              <button
                onClick={connectToRoom}
                disabled={connecting}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50 transition-all"
              >
                {connecting ? 'Connecting...' : 'Join Interview Room'}
              </button>
              
              {/* Test Mode Toggle */}
              {isAdminOrLead && (
                <button
                  onClick={() => setTestMode(!testMode)}
                  className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    testMode 
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' 
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                  }`}
                >
                  {testMode ? '🎭 Test Mode ON' : '🎭 Enable Test Mode'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 p-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <BroadcastBox 
                participant={isAdminOrLead ? room.localParticipant : Array.from(room.remoteParticipants.values())[0]}
                label={isAdminOrLead ? (profile?.username || 'Interviewer') : 'Interviewer'}
                isInterviewer={true}
                useFakeAvatar={testMode && !isAdminOrLead}
              />
              <BroadcastBox 
                participant={isAdminOrLead ? Array.from(room.remoteParticipants.values())[0] : room.localParticipant}
                label={session.applicant_name}
                isInterviewer={false}
                useFakeAvatar={testMode && isAdminOrLead}
              />
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
          </button>

          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-4 rounded-full transition-colors ${
              showNotes ? 'bg-cyan-500' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <MessageSquare className="w-6 h-6 text-white" />
          </button>

          {isAdminOrLead && (
            <button
              onClick={() => setTestMode(!testMode)}
              className={`p-4 rounded-full transition-colors ${
                testMode ? 'bg-yellow-500' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <span className="text-lg">{testMode ? '🎭' : '🎭'}</span>
            </button>
          )}

          <button
            onClick={endCall}
            className="p-4 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
          >
            <Phone className="w-6 h-6 text-white rotate-[135deg]" />
          </button>

          {isAdminOrLead && session.status === 'active' && (
            <button
              onClick={hireCandidate}
              disabled={hiring}
              className="px-6 py-4 bg-green-500 hover:bg-green-600 rounded-full transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-6 h-6 text-white" />
              <span className="text-white font-bold">{hiring ? 'Hiring...' : 'Hire'}</span>
            </button>
          )}
        </div>
      </div>

      {showNotes && (
        <div className="absolute bottom-24 right-4 w-80 bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl p-4 z-20">
          <h3 className="text-lg font-semibold text-white mb-3">Interview Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this interview..."
            className="w-full h-40 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg p-3 text-white resize-none focus:border-cyan-400 focus:outline-none"
          />
          <p className="text-gray-400 text-xs mt-2">Notes are saved automatically</p>
        </div>
      )}
    </div>
  )
}
