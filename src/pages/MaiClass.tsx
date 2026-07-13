import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import {
  getAvailableSlotsForOrg,
  enrollStudentInClass,
  isStudentEnrolledInClass,
} from '@/lib/maiClassEnrollment'
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom'
import { toast } from 'sonner'
import ErrorBoundary from '@/components/ErrorBoundary'
import LiveKitVideoGrid from '@/components/MaiClassVideoGrid'
import { PreflightStore } from '@/lib/preflightStore'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Hand,
  Loader2,
  Mail,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Play,
  Send,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'

const COLORS = {
  black: '#07050d',
  panel: '#0d0a18',
  card: '#121024',
  cardSoft: '#17132e',
  purple: '#9333ea',
  purpleLight: '#c084fc',
  violet: '#7c3aed',
  gold: '#ffd54a',
  green: '#10b981',
  red: '#ef4444',
  orange: '#f59e0b',
}

const AVAILABLE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'live-class', label: 'Live Class' },
  { id: 'modules', label: 'Modules' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'progress', label: 'My Progress' },
  { id: 'resources', label: 'Resources' },
  { id: 'reports', label: 'Reports' },
  { id: 'announcements', label: 'Announcements' },
]

type MaiClassRole = 'student' | 'admin' | 'ceo'

type ChatMessage = {
  id: string
  sender: string
  message: string
  timestamp: Date
  isAdmin: boolean
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function GlassCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-purple-500/20 bg-[#0d0a18]/82 shadow-[0_0_45px_rgba(147,51,234,0.10)] backdrop-blur-xl', className)}>
      {children}
    </div>
  )
}

function StatPill({ icon, value, label, accent = 'purple' }: { icon: React.ReactNode; value: string; label: string; accent?: 'purple' | 'gold' | 'green' }) {
  const accentClasses = {
    purple: 'from-purple-600/30 to-fuchsia-600/10 text-purple-200 border-purple-500/25',
    gold: 'from-yellow-500/30 to-orange-500/10 text-yellow-200 border-yellow-400/25',
    green: 'from-emerald-500/25 to-lime-500/10 text-emerald-200 border-emerald-400/25',
  }

  return (
    <div className={cn('flex min-w-[150px] items-center gap-3 rounded-xl border bg-gradient-to-br px-4 py-3', accentClasses[accent])}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35">
        {icon}
      </div>
      <div>
        <div className="text-lg font-black leading-tight text-white">{value}</div>
        <div className="text-xs text-white/65">{label}</div>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-purple-500/20 bg-black/20 p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-600/15 text-purple-300">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
    </div>
  )
}

export default function MaiClass() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()

  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('live-class')
  const [userRole, setUserRole] = useState<MaiClassRole>('student')

  const [activeClass, setActiveClass] = useState<any>(null)
  const [instructor, setInstructor] = useState<any>(null)
  const [availableSlots, setAvailableSlots] = useState(0)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrollmentLoading, setEnrollmentLoading] = useState(false)

  const [organizations, setOrganizations] = useState<any[]>([])
  const [orgLoading, setOrgLoading] = useState(false)

  const [roomJoined, setRoomJoined] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [speakerBoxes, setSpeakerBoxes] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const isInstructor = user?.id === activeClass?.instructor_id
  const isLiveSession = activeClass?.session_status === 'live'
  const canHostControls = userRole !== 'student'

  const {
    joinAsAudience,
    joinAsPublisher,
    leaveRoom,
    remoteUsers,
    localAudioTrack,
    localVideoTrack,
    toggleMicrophone,
    toggleCamera,
  } = useLiveKitRoom({
    roomId: classId || activeClass?.livekit_room_name || 'mai-class-default',
    roomType: 'broadcast',
    publish: false,
    onError: (err) => {
      console.error('[LiveKit error]', err)
      toast.error('Video connection error')
    },
  })

  const studentCount = activeClass?.current_student_count || 0
  const studentLimit = activeClass?.student_limit || 20
  const progressPercent = Math.min(100, Math.round((studentCount / studentLimit) * 100))

  const nextClassLabel = useMemo(() => {
    if (!activeClass?.session_start_time) return 'To be scheduled'
    return new Date(activeClass.session_start_time).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [activeClass?.session_start_time])

  const canAccessMaiClass = Boolean(
    userRole !== 'student' ||
      profile?.organization_id ||
      profile?.role === 'student' ||
      (profile as any)?.is_org_student,
  )

  const canEnroll = Boolean(profile?.organization_id && (profile?.role === 'student' || (profile as any)?.is_org_student))

  useEffect(() => {
    PreflightStore.setInBroadcast(true)

    if (!profile) {
      navigate('/auth')
      return
    }

    const isCEO = profile?.role === 'ceo'
    const isAdmin = profile?.role === 'admin' || profile?.is_admin || profile?.role === 'owner' || profile?.role === 'staff' || profile?.role === 'secretary'
    setUserRole(isCEO ? 'ceo' : isAdmin ? 'admin' : 'student')

    loadActiveClass()

    if (isCEO || isAdmin) {
      loadOrganizations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, navigate])

  useEffect(() => {
    return () => {
      PreflightStore.setInBroadcast(false)
      leaveRoom()
    }
  }, [leaveRoom])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const loadActiveClass = async () => {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const response = await fetch('/api/mai-class/active-class', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const text = await response.text()
      if (!text) return

      let result: any
      try {
        result = JSON.parse(text)
      } catch (error) {
        console.error('[MaiClass] Failed to parse active class response:', text)
        return
      }

      if (!response.ok) {
        console.log('[MaiClass] No active class found:', result.error)
        return
      }

      const classData = result.class
      setActiveClass(classData)
      setInstructor(result.instructor)

      if (profile?.organization_id && profile?.id) {
        const slots = await getAvailableSlotsForOrg(classData.id, profile.organization_id)
        const enrolled = await isStudentEnrolledInClass(classData.id, profile.id)
        if (isMountedRef.current) {
          setAvailableSlots(slots)
          setIsEnrolled(enrolled)
        }
      }
    } catch (err) {
      console.error('[load active class error]', err)
    } finally {
      if (isMountedRef.current) setIsLoading(false)
    }
  }

  const loadOrganizations = async () => {
    setOrgLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const response = await fetch('/api/organizations/dashboard?all=true', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        console.error('[MaiClass] Failed to load orgs:', response.statusText)
        return
      }

      const result = await response.json()
      setOrganizations(result.organizations || [])
    } catch (err) {
      console.error('[load orgs error]', err)
    } finally {
      setOrgLoading(false)
    }
  }

  const handleEnroll = async () => {
    if (!activeClass || !profile?.organization_id || !profile?.id) return
    if (availableSlots <= 0) {
      toast.error('Class is full (20 students max per organization)')
      return
    }

    setEnrollmentLoading(true)
    try {
      const result = await enrollStudentInClass(activeClass.id, profile.id, profile.organization_id)
      if (result.success) {
        setIsEnrolled(true)
        setAvailableSlots(prev => Math.max(prev - 1, 0))
        toast.success('Enrolled in MAI Class!')
      } else {
        toast.error(result.error || 'Enrollment failed')
      }
    } finally {
      setEnrollmentLoading(false)
    }
  }

  const authedFetch = async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Please sign in')

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
  }

  const handleCreateClass = async () => {
    try {
      const response = await authedFetch('/api/mai-class/create', { method: 'POST' })
      const result = await response.json()
      if (response.ok) {
        toast.success('Class created!')
        loadActiveClass()
      } else {
        toast.error(result.error || 'Failed to create class')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error')
    }
  }

  const handleStartClass = async () => {
    if (!activeClass) return
    try {
      const response = await authedFetch('/api/mai-class/start', {
        method: 'POST',
        body: JSON.stringify({ classId: activeClass.id }),
      })
      const result = await response.json()
      if (response.ok) {
        toast.success('Class started!')
        loadActiveClass()
        setActiveTab('live-class')
      } else {
        toast.error(result.error || 'Failed to start class')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error')
    }
  }

  const handleEndClass = async () => {
    if (!activeClass) return
    try {
      const response = await authedFetch('/api/mai-class/end', {
        method: 'POST',
        body: JSON.stringify({ classId: activeClass.id }),
      })
      const result = await response.json()
      if (response.ok) {
        toast.success('Class ended')
        setRoomJoined(false)
        leaveRoom()
        loadActiveClass()
      } else {
        toast.error(result.error || 'Failed to end class')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error')
    }
  }

  const handleJoinClass = async () => {
    if (!activeClass?.livekit_room_name) {
      toast.error('Class room not configured yet.')
      return
    }

    setIsLoading(true)
    try {
      if (isInstructor || canHostControls) {
        await joinAsPublisher(user?.id || '')
      } else {
        await joinAsAudience(user?.id || '')
      }
      setRoomJoined(true)
    } catch (err: any) {
      console.error('[join class]', err)
      toast.error(`Failed to join class: ${err?.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndCall = () => {
    leaveRoom()
    setRoomJoined(false)
  }

  const handleSendMessage = () => {
    if (!newMessage.trim() || !user) return
    setChatMessages(prev => [
      ...prev,
      {
        id: `${Date.now()}`,
        sender: profile?.username || profile?.display_name || 'Unknown',
        message: newMessage.trim(),
        timestamp: new Date(),
        isAdmin: userRole !== 'student',
      },
    ])
    setNewMessage('')
  }

  if (!canAccessMaiClass) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07050d] px-4 text-white">
        <GlassCard className="max-w-lg p-8 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-purple-300" />
          <h1 className="text-2xl font-black text-yellow-300">MAI Class is organization-only</h1>
          <p className="mt-3 text-sm text-slate-300">Students must be created by an approved organization before they can join MAI Class.</p>
        </GlassCard>
      </div>
    )
  }

  if (!isLoading && !activeClass && userRole === 'student') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07050d] text-white">
        <AlertTriangle size={52} className="text-yellow-400" />
        <h2 className="mt-4 text-2xl font-black text-yellow-300">No Active Class</h2>
        <p className="mt-2 text-slate-400">MAI Class is not currently scheduled.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07050d]">
        <Loader2 className="h-9 w-9 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07050d] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(147,51,234,0.28),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(255,213,74,0.12),transparent_24%),radial-gradient(circle_at_70%_90%,rgba(124,58,237,0.20),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(7,5,13,0.15),rgba(7,5,13,0.94))]" />

        <main className="relative z-10 mx-auto grid h-screen max-w-[1780px] grid-cols-1 gap-4 overflow-y-auto overflow-x-hidden md:overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
          <section className="flex min-w-0 flex-col gap-4 overflow-hidden">
            <GlassCard className="relative overflow-hidden p-4 md:p-5">
              <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(147,51,234,0.15),rgba(0,0,0,0.05),rgba(255,213,74,0.08))]" />
              <div className="absolute right-0 top-0 hidden h-full w-1/2 bg-[radial-gradient(circle_at_70%_35%,rgba(147,51,234,0.35),transparent_34%)] md:block" />

              <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-yellow-400/50 bg-black/50 shadow-[0_0_40px_rgba(255,213,74,0.18)]">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-yellow-400/80 bg-gradient-to-br from-yellow-400/20 to-purple-700/30 text-5xl">
                      🎓
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-5xl font-black uppercase tracking-[0.10em] text-white drop-shadow md:text-6xl">
                      MAI <span className="text-purple-400">CLASS</span>
                    </div>
                    <p className="mt-2 text-sm font-black uppercase tracking-wide text-yellow-300 md:text-base">Real world prep. Real life. Real freedom.</p>
                    <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">Teaching 17+ how to survive, win, and build a better future. Led by CEO every Monday & Thursday.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <StatPill icon={<Users className="h-5 w-5" />} value={`${studentCount}/${studentLimit}`} label="Students Enrolled" accent="purple" />
                  <StatPill icon={<span className="text-xl">💰</span>} value="200" label="Troll Coins / Week" accent="gold" />
                  <StatPill icon={<Shield className="h-5 w-5" />} value="CEO LED" label="No Teachers. No Limits." accent="green" />
                  <StatPill icon={<BookOpen className="h-5 w-5" />} value="17+ Only" label="Real World Skills" accent="purple" />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="shrink-0 overflow-hidden">
              <div className="flex gap-1 overflow-x-auto border-b border-purple-500/20 px-3 pt-2">
                {AVAILABLE_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition',
                      activeTab === tab.id
                        ? 'border-purple-400 text-white shadow-[0_8px_28px_rgba(147,51,234,0.22)]'
                        : 'border-transparent text-slate-400 hover:text-white',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {canHostControls && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  {!activeClass && (
                    <button onClick={handleCreateClass} className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-black text-white hover:bg-purple-500">Create Class</button>
                  )}
                  {activeClass && activeClass.session_status !== 'live' && (
                    <button onClick={handleStartClass} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500">Start Class</button>
                  )}
                  {activeClass?.session_status === 'live' && (
                    <button onClick={handleEndClass} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-500">End Class</button>
                  )}
                  <button onClick={() => setSpeakerBoxes(prev => Math.min(prev + 1, 6))} className="inline-flex items-center gap-2 rounded-lg border border-purple-500/30 px-4 py-2 text-xs font-black text-purple-200 hover:bg-purple-500/10">
                    <UserPlus size={14} /> Add Speaker Box
                  </button>
                </div>
              )}
            </GlassCard>

            <section className="min-h-0 flex-1 overflow-hidden">
              {activeTab === 'live-class' && (
                <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <GlassCard className="flex min-h-0 flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-purple-500/20 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <h2 className="text-sm font-black uppercase tracking-wide">Live Class Room</h2>
                        {isLiveSession ? <span className="rounded bg-red-600 px-2 py-1 text-[11px] font-black">LIVE</span> : <span className="rounded bg-slate-700 px-2 py-1 text-[11px] font-black text-slate-300">WAITING</span>}
                        <span className="inline-flex items-center gap-1 text-xs text-slate-300"><Eye size={14} /> {remoteUsers.length}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-xs">Signal Ready</span>
                      </div>
                    </div>

                    <div className="relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden bg-black/70">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(147,51,234,0.20),transparent_38%)]" />

                      {!roomJoined ? (
                        isLiveSession ? (
                          <div className="relative z-10 max-w-lg p-8 text-center">
                            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-purple-600 shadow-[0_0_50px_rgba(147,51,234,0.45)]">
                              <Play size={46} className="ml-1 text-yellow-300" />
                            </div>
                            <h2 className="text-2xl font-black text-white">Class is Live</h2>
                            <p className="mt-2 text-sm text-slate-300">Join the session to interact with the instructor and follow the live lesson.</p>
                            <button onClick={handleJoinClass} disabled={isLoading} className="mt-6 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-7 py-3 text-sm font-black text-white shadow-[0_0_30px_rgba(147,51,234,0.35)] disabled:opacity-50">
                              {isLoading ? 'Joining...' : 'Join Class Now'}
                            </button>
                          </div>
                        ) : (
                          <div className="relative z-10 max-w-lg p-8 text-center">
                            <Clock size={58} className="mx-auto mb-4 text-yellow-300" />
                            <h2 className="text-2xl font-black text-white">Class Has Not Started</h2>
                            <p className="mt-2 text-sm text-slate-400">Next class: {nextClassLabel}</p>
                          </div>
                        )
                      ) : (
                        <div className="relative z-10 h-full w-full">
                          <LiveKitVideoGrid participants={remoteUsers} currentUserId={user?.id} />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1 border-t border-purple-500/20 bg-black/35 p-2 sm:grid-cols-8">
                      <button onClick={toggleMicrophone} disabled={!roomJoined} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">
                        {localAudioTrack?.isEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                        Mute
                      </button>
                      <button onClick={toggleCamera} disabled={!roomJoined} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">
                        {localVideoTrack?.isEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                        Video
                      </button>
                      <button disabled={!roomJoined} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">
                        <MonitorUp size={18} /> Share
                      </button>
                      <button className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-200 hover:bg-white/10">
                        <Users size={18} /> {remoteUsers.length}
                      </button>
                      <button className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-200 hover:bg-white/10">
                        <Send size={18} /> Chat
                      </button>
                      <button disabled={!roomJoined} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">
                        <Hand size={18} /> Raise
                      </button>
                      <button className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-200 hover:bg-white/10">
                        <Settings size={18} /> Settings
                      </button>
                      <button onClick={handleEndCall} disabled={!roomJoined} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40">
                        <PhoneOff size={18} /> End
                      </button>
                    </div>
                  </GlassCard>

                  <GlassCard className="hidden min-h-0 overflow-hidden p-4 xl:block">
                    <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-white">Class Info</h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex gap-3"><BookOpen className="mt-1 h-4 w-4 text-purple-300" /><div><div className="font-semibold text-white">Class Topic</div><div className="text-slate-400">{activeClass?.topic || activeClass?.name || 'Money & Credit'}</div></div></div>
                      <div className="flex gap-3"><Calendar className="mt-1 h-4 w-4 text-purple-300" /><div><div className="font-semibold text-white">Next Class</div><div className="text-slate-400">{nextClassLabel}</div></div></div>
                      <div className="flex gap-3"><Clock className="mt-1 h-4 w-4 text-purple-300" /><div><div className="font-semibold text-white">Duration</div><div className="text-slate-400">2 hours</div></div></div>
                      <div>
                        <div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">Coins This Week</span><span className="text-white">150 / 200 earned</span></div>
                        <div className="h-2 rounded-full bg-slate-700"><div className="h-full w-3/4 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500" /></div>
                      </div>
                    </div>

                    {canHostControls && (
                      <div className="mt-6 border-t border-purple-500/20 pt-4">
                        <h4 className="mb-3 text-xs font-black uppercase text-purple-200">CEO Controls</h4>
                        <div className="grid gap-2">
                          <button className="rounded-xl border border-purple-500/20 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 hover:bg-purple-500/10">Allow Students to Unmute</button>
                          <button className="rounded-xl border border-purple-500/20 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 hover:bg-purple-500/10">Require Hand Raise</button>
                          <button className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200 hover:bg-red-500/20">Remove Student</button>
                        </div>
                      </div>
                    )}
                  </GlassCard>

                  <GlassCard className="col-span-full min-h-[175px] overflow-hidden p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-wide text-purple-300">Students ({studentCount}/{studentLimit})</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10">
                      {Array.from({ length: studentLimit }).map((_, index) => {
                        const isOccupied = index < remoteUsers.length
                        return (
                          <div key={index} className="relative aspect-video overflow-hidden rounded-xl border border-purple-500/20 bg-black/45">
                            <div className="absolute left-2 top-2 rounded bg-purple-700 px-1.5 py-0.5 text-xs font-black">{index + 1}</div>
                            <div className="flex h-full items-center justify-center text-xs text-slate-500">
                              {isOccupied ? 'Connected' : 'Empty Seat'}
                            </div>
                            <div className="absolute bottom-1 right-1 flex gap-1 text-slate-400">
                              <MicOff size={12} /> <VideoOff size={12} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </GlassCard>
                </div>
              )}

              {activeTab === 'overview' && (
                <div className="grid h-full gap-4 overflow-y-auto lg:grid-cols-2">
                  <GlassCard className="p-6">
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-yellow-300"><Calendar size={22} /> Upcoming Session</h2>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between gap-4"><span className="text-slate-400">Date & Time</span><span className="text-right font-semibold text-white">{nextClassLabel}</span></div>
                      <div className="flex justify-between gap-4"><span className="text-slate-400">Instructor</span><span className="font-semibold text-white">{instructor?.username || 'CEO'}</span></div>
                      <div className="flex justify-between gap-4"><span className="text-slate-400">Enrolled</span><span className="font-semibold text-white">{studentCount}/{studentLimit}</span></div>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-6">
                    <h2 className="mb-4 text-xl font-black text-yellow-300">Your Enrollment</h2>
                    {canEnroll ? (
                      <button onClick={handleEnroll} disabled={isEnrolled || enrollmentLoading || availableSlots <= 0} className={cn('w-full rounded-xl px-4 py-4 text-sm font-black transition', isEnrolled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:scale-[1.01]', 'disabled:cursor-not-allowed disabled:opacity-60')}>
                        {enrollmentLoading ? 'Enrolling...' : isEnrolled ? 'Enrolled ✓' : availableSlots <= 0 ? 'Class Full' : 'Enroll Now'}
                      </button>
                    ) : (
                      <p className="text-sm text-slate-400">Join your organization to enroll in MAI Class.</p>
                    )}
                    <p className="mt-3 text-center text-xs text-slate-500">Available slots: {availableSlots}/20</p>
                  </GlassCard>

                  {canHostControls && (
                    <GlassCard className="p-6 lg:col-span-2">
                      <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-yellow-300"><Shield size={22} /> Command Center</h2>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <button onClick={() => navigate('/organization/dashboard')} className="rounded-xl border border-purple-500/20 bg-white/5 p-4 text-left hover:bg-purple-500/10"><Building2 className="mb-2 text-purple-300" /><div className="font-bold">Manage Orgs</div><div className="text-xs text-slate-400">View and edit organizations</div></button>
                        <button onClick={() => navigate('/admin/applications')} className="rounded-xl border border-purple-500/20 bg-white/5 p-4 text-left hover:bg-purple-500/10"><Users className="mb-2 text-emerald-300" /><div className="font-bold">Applications</div><div className="text-xs text-slate-400">Review org requests</div></button>
                        <button onClick={loadOrganizations} className="rounded-xl border border-purple-500/20 bg-white/5 p-4 text-left hover:bg-purple-500/10"><Mail className="mb-2 text-yellow-300" /><div className="font-bold">Refresh Orgs</div><div className="text-xs text-slate-400">{orgLoading ? 'Loading...' : `${organizations.length} organizations`}</div></button>
                        <button onClick={handleCreateClass} className="rounded-xl border border-purple-500/20 bg-white/5 p-4 text-left hover:bg-purple-500/10"><Video className="mb-2 text-fuchsia-300" /><div className="font-bold">Create Class</div><div className="text-xs text-slate-400">Prepare next session</div></button>
                      </div>
                    </GlassCard>
                  )}
                </div>
              )}

              {activeTab === 'modules' && <EmptyState icon={<BookOpen size={32} />} title="Class Modules" description="Modules will appear here after lessons are published for enrolled students." />}
              {activeTab === 'assignments' && <EmptyState icon={<FileText size={32} />} title="Assignments" description="Assignments and homework will appear here once the CEO publishes them." />}
              {activeTab === 'progress' && <EmptyState icon={<CheckCircle size={32} />} title="My Progress" description="Student progress, attendance, and coin rewards will appear after class activity is recorded." />}
              {activeTab === 'resources' && <EmptyState icon={<BookOpen size={32} />} title="Resources" description="Guides, worksheets, and downloadable class resources will appear here." />}
              {activeTab === 'reports' && <EmptyState icon={<Shield size={32} />} title="Reports" description="Organization and admin reporting will appear here for authorized roles." />}
              {activeTab === 'announcements' && <EmptyState icon={<Bell size={32} />} title="Announcements" description="Class updates and CEO announcements will appear here." />}
            </section>
          </section>

          <aside className="hidden min-h-0 flex-col gap-4 overflow-hidden lg:flex">
            <GlassCard className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-black uppercase tracking-wide text-white">Next Class</h3>
                <button className="text-xs font-semibold text-purple-300 hover:text-purple-200">View Calendar</button>
              </div>
              <div className="rounded-xl border border-purple-500/20 bg-black/30 p-4">
                <h4 className="font-bold text-white">{activeClass?.topic || activeClass?.name || 'Real World Prep'}</h4>
                <p className="mt-2 text-sm text-slate-400">{nextClassLabel}</p>
                <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-700 px-4 py-3 text-sm font-black text-white">
                  <Bell size={16} /> Set Reminder
                </button>
              </div>
            </GlassCard>

            <GlassCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-purple-500/20 p-4">
                <h3 className="font-black uppercase tracking-wide text-white">Class Chat</h3>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Users size={14} /> {remoteUsers.length}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {chatMessages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-purple-500/20 p-5 text-center text-sm text-slate-500">No messages yet.</div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-700 text-xs font-black">{msg.sender.slice(0, 2).toUpperCase()}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><span className={cn('text-sm font-bold', msg.isAdmin ? 'text-yellow-300' : 'text-purple-200')}>@{msg.sender}</span>{msg.isAdmin && <span className="rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold">Host</span>}</div>
                        <p className="break-words text-sm text-slate-300">{msg.message}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-purple-500/20 p-3">
                <div className="flex overflow-hidden rounded-xl border border-purple-500/25 bg-black/35">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Type a message..." className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                  <button onClick={handleSendMessage} className="bg-purple-700 px-4 text-white hover:bg-purple-600"><Send size={18} /></button>
                </div>
              </div>
            </GlassCard>

            {canHostControls && (
              <GlassCard className="p-4">
                <div className="mb-4 flex items-center gap-2"><Settings size={18} className="text-purple-300" /><h3 className="font-black uppercase tracking-wide text-white">Class Settings</h3></div>
                <div className="grid gap-2">
                  <button className="rounded-xl border border-purple-500/20 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 hover:bg-purple-500/10">Mute All Students</button>
                  <button className="rounded-xl border border-purple-500/20 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 hover:bg-purple-500/10">Stop All Videos</button>
                  <button className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200 hover:bg-red-500/20"><Trash2 className="mr-2 inline h-4 w-4" />Remove Student</button>
                </div>
              </GlassCard>
            )}
          </aside>
        </main>
      </div>
    </ErrorBoundary>
  )
}