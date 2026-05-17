import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import Slider from '../components/ui/slider'

import {
  Briefcase,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Home,
  Map,
  Navigation,
  Plus,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  X,
  XCircle,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useDriverTest } from '@/lib/hooks/useVehicleSystem'
import { cn } from '@/lib/utils'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const eventCategories = [
  'Cleanup',
  'Volunteer',
  'Fitness',
  'Social',
  'Food',
  'Education',
  'Animal Care',
  'Safety',
  'Other',
]

const businessCategories = [
  'Restaurant',
  'Retail',
  'Healthcare',
  'Education',
  'Entertainment',
  'Service',
  'Other',
]

const tcPanel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'

const tcCard =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 text-white shadow-[0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-xl'

const tcInput =
  'border-cyan-300/20 bg-slate-950/80 text-white placeholder:text-slate-500 focus-visible:ring-cyan-300/35'

const tcButton =
  'border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20 hover:text-white shadow-[0_0_20px_rgba(34,211,238,0.12)]'

const tcPrimary =
  'border border-cyan-300/30 bg-cyan-300 text-slate-950 hover:bg-cyan-200 font-black shadow-[0_0_24px_rgba(34,211,238,0.22)]'

const tcDanger =
  'border border-red-300/25 bg-red-500/15 text-red-100 hover:bg-red-500/25'

const tcSelectContent =
  'z-[99999] border border-cyan-300/20 bg-slate-950 text-white shadow-[0_0_40px_rgba(34,211,238,0.2)] backdrop-blur-2xl'

function resetEventForm() {
  return {
    title: '',
    description: '',
    category: '',
    latitude: 0,
    longitude: 0,
    city: '',
    state: '',
    start_time: '',
    end_time: '',
    duration_minutes: 60,
    max_participants: 10,
    reward_coins: 100,
    requirements: '',
    images: [],
    visibility: 'public',
  }
}

function resetBusinessForm() {
  return {
    business_name: '',
    description: '',
    category: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    latitude: 0,
    longitude: 0,
    city: '',
    state: '',
    logo_url: '',
  }
}

function resetHiringForm() {
  return {
    business_id: '',
    title: '',
    description: '',
    requirements: '',
    contact_email: '',
    contact_phone: '',
    location: '',
    job_type: 'full-time',
    pay_rate: '',
  }
}

function DriverTestManual() {
  const { license, takeTest, loading } = useDriverTest()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [showResults, setShowResults] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [showManual, setShowManual] = useState(true)

  const manual = [
    {
      title: 'Traffic Signals & Signs',
      content: 'Yellow means slow down and prepare to stop. Red means stop. Green means go while yielding to pedestrians.',
      rules: ['Yellow: stop if safe', 'Red: complete stop', 'Flashing red: stop sign', 'Flashing yellow: proceed with caution'],
    },
    {
      title: 'Speed Limits',
      content: 'Always obey posted limits and adjust for traffic, weather, and road conditions.',
      rules: ['School zones: 15-25 mph', 'Residential: usually 25 mph', 'Highways: posted limit', 'Construction: reduced speed'],
    },
    {
      title: 'Right of Way',
      content: 'Yield to traffic already in the intersection and always yield to pedestrians in crosswalks.',
      rules: ['Yield to traffic on your right', 'Pull over for emergency vehicles', 'Do not cut funeral processions', 'Stop for school buses'],
    },
  ]

  const questions = [
    {
      question: 'What does a yellow traffic light mean?',
      options: ['Stop if safe', 'Speed up', 'Go normally', 'Stop immediately'],
      correct: 0,
    },
    {
      question: 'When is it illegal to use your horn?',
      options: ['In traffic', 'To warn danger', 'In a school zone at night', 'To signal anger'],
      correct: 3,
    },
    {
      question: "What's the speed limit in a school zone?",
      options: ['15 mph', '25 mph', '35 mph', '45 mph'],
      correct: 0,
    },
    {
      question: 'When must you use your turn signal?',
      options: ['Before turning', 'While turning', 'After turning', 'Only at night'],
      correct: 0,
    },
    {
      question: 'What does a double yellow line mean?',
      options: ['Passing allowed', 'No passing', 'School zone', 'Construction'],
      correct: 1,
    },
    {
      question: "What's the minimum following distance?",
      options: ['1 second', '2 seconds', '3 seconds', '5 seconds'],
      correct: 2,
    },
    {
      question: 'When can you pass another vehicle?',
      options: ['Anytime', 'When lines are solid', 'When dashed lines show', 'Never'],
      correct: 2,
    },
    {
      question: 'What does a flashing red light mean?',
      options: ['Speed up', 'Treat as stop sign', 'Slow down only', 'Keep going'],
      correct: 1,
    },
    {
      question: 'When must you stop for a school bus?',
      options: ['Only if children present', 'When red lights flashing', 'Only at night', 'Never'],
      correct: 1,
    },
    {
      question: "What's the legal BAC limit?",
      options: ['0.05%', '0.08%', '0.10%', '0.15%'],
      correct: 1,
    },
  ]

  const answerQuestion = (answerIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[currentQuestion] = answerIndex
      return next
    })
  }

  const submitTest = async () => {
    if (answers.length !== questions.length) return
    const result = await takeTest(answers)
    setTestResult(result)
    setShowResults(true)
  }

  const resetTest = () => {
    setCurrentQuestion(0)
    setAnswers([])
    setShowResults(false)
    setTestResult(null)
  }

  return (
    <div className="space-y-5">
      <section className={cn(tcPanel, 'p-5')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white">Driver License Center</h2>
            <p className="mt-1 text-sm text-slate-400">
              Study the Troll City driver manual and pass the test to unlock your license.
            </p>
          </div>

          <Car className="h-8 w-8 text-cyan-200" />
        </div>

        {license && (
          <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-3">
            <div className="flex items-center gap-2 text-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-bold">License Status: {license.status === 'active' ? 'Active' : 'Suspended'}</span>
            </div>
            {license.license_number && (
              <p className="mt-1 text-sm text-emerald-200/80">License #: {license.license_number}</p>
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowManual(true)} className={showManual ? tcPrimary : tcButton}>
          Study Manual
        </Button>
        <Button onClick={() => setShowManual(false)} className={!showManual ? tcPrimary : tcButton}>
          Take Test
        </Button>
      </div>

      {showManual ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {manual.map((section) => (
            <Card key={section.title} className={cn(tcCard, 'p-5')}>
              <h3 className="text-lg font-black text-white">{section.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{section.content}</p>
              <ul className="mt-4 space-y-2">
                {section.rules.map((rule) => (
                  <li key={rule} className="flex gap-2 text-sm text-slate-400">
                    <span className="text-cyan-300">•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card className={cn(tcCard, 'p-5')}>
          {!showResults ? (
            <>
              <div className="mb-5 flex items-center justify-between gap-3">
                <h3 className="text-xl font-black text-white">
                  Question {currentQuestion + 1} of {questions.length}
                </h3>
                <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
                  {answers.filter((a) => a !== undefined).length}/{questions.length} answered
                </Badge>
              </div>

              <h4 className="mb-4 text-lg font-bold text-white">{questions[currentQuestion].question}</h4>

              <div className="space-y-2">
                {questions[currentQuestion].options.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => answerQuestion(index)}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold transition',
                      answers[currentQuestion] === index
                        ? 'border-cyan-300/50 bg-cyan-300 text-slate-950'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-white'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex justify-between">
                <Button
                  type="button"
                  disabled={currentQuestion === 0}
                  onClick={() => setCurrentQuestion((prev) => Math.max(prev - 1, 0))}
                  className={tcButton}
                >
                  Previous
                </Button>

                {currentQuestion < questions.length - 1 ? (
                  <Button
                    type="button"
                    disabled={answers[currentQuestion] === undefined}
                    onClick={() => setCurrentQuestion((prev) => prev + 1)}
                    className={tcPrimary}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={answers.length !== questions.length || loading}
                    onClick={submitTest}
                    className="border border-emerald-300/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25"
                  >
                    {loading ? 'Submitting...' : 'Submit Test'}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div
                className={cn(
                  'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full',
                  testResult?.passed ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'
                )}
              >
                {testResult?.passed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
              </div>

              <h3 className={cn('text-2xl font-black', testResult?.passed ? 'text-emerald-300' : 'text-red-300')}>
                {testResult?.passed ? 'Test Passed!' : 'Test Failed'}
              </h3>

              <p className="mt-2 text-slate-300">
                Score: {testResult?.score || 0}/{questions.length}
              </p>

              <Button onClick={resetTest} className={cn(tcPrimary, 'mt-5')}>
                {testResult?.passed ? 'Take Test Again' : 'Try Again'}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default function NeighborsPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const [activeTab, setActiveTab] = useState('nearby')
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [searchRadius, setSearchRadius] = useState(40)
  const [events, setEvents] = useState<any[]>([])
  const [businesses, setBusinesses] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [neighborhoods, setNeighborhoods] = useState<any[]>([])
  const [availableHouses, setAvailableHouses] = useState<any[]>([])
  const [myNeighborhood, setMyNeighborhood] = useState<any>(null)
  const [myProperties, setMyProperties] = useState<any[]>([])
  const [myTenants, setMyTenants] = useState<any[]>([])
  const [pendingApplications, setPendingApplications] = useState<any[]>([])
  const [myBusinesses, setMyBusinesses] = useState<any[]>([])
  const [myEvents, setMyEvents] = useState<any[]>([])
  const [hiringPosts, setHiringPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [user, setUser] = useState<any>(null)

  const [creatingEvent, setCreatingEvent] = useState(false)
  const [creatingBusiness, setCreatingBusiness] = useState(false)
  const [creatingHiring, setCreatingHiring] = useState(false)
  const [businessSuccess, setBusinessSuccess] = useState(false)

  const [eventFormData, setEventFormData] = useState(resetEventForm())
  const [businessFormData, setBusinessFormData] = useState(resetBusinessForm())
  const [hiringFormData, setHiringFormData] = useState(resetHiringForm())

  const profileReady = Boolean(profile?.neighborhood_id || profile?.house_id)

  const kmDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const r = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    return r * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data?.user) return

      setUser(data.user)

      if (!profileReady) {
        const { data: fetchedProfile } = await supabase
          .from('user_profiles')
          .select('neighborhood_id, house_id')
          .eq('id', data.user.id)
          .maybeSingle()

        if (!fetchedProfile?.neighborhood_id && !fetchedProfile?.house_id) {
          navigate('/neighborhood-setup')
        }
      }
    }

    void init()
  }, [navigate, profileReady])

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setUserLocation([39.8283, -98.5795])
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude])
      },
      () => {
        setUserLocation([39.8283, -98.5795])
      }
    )
  }, [])

  useEffect(() => {
    const loadEvents = async () => {
      if (!userLocation) return
      setLoading(true)

      try {
        const { data, error } = await supabase.rpc('get_nearby_neighbors_events', {
          lat: userLocation[0],
          lng: userLocation[1],
          radius: searchRadius,
        })

        if (error) throw error
        setEvents(data || [])
      } catch (error) {
        console.error('Error fetching nearby events:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadEvents()
  }, [userLocation, searchRadius])

  useEffect(() => {
    const loadBusinesses = async () => {
      if (!userLocation) return

      const { data, error } = await supabase
        .from('neighbors_businesses')
        .select('*')
        .or('verified.eq.true,approval_status.eq.approved')

      if (error) {
        console.error('Error fetching businesses:', error)
        return
      }

      setBusinesses(
        (data || []).filter((business) => {
          if (!business.latitude || !business.longitude) return true
          return kmDistance(userLocation[0], userLocation[1], business.latitude, business.longitude) <= searchRadius
        })
      )
    }

    void loadBusinesses()
  }, [userLocation, searchRadius])

  useEffect(() => {
    const loadBaseData = async () => {
      const [{ data: participantsData }, { data: neighborhoodsData }, { data: housesData }, { data: hiringData }] =
        await Promise.all([
          supabase.from('neighbors_participants').select('*'),
          supabase.from('neighborhoods').select('*'),
          supabase
            .from('houses')
            .select('*, neighborhoods(name, zip_code), user_profiles!houses_owner_user_id_fkey(username)')
            .is('owner_user_id', null),
          supabase.from('neighbors_hiring').select('*, neighbors_businesses(business_name)').eq('is_active', true),
        ])

      setParticipants(participantsData || [])
      setNeighborhoods(neighborhoodsData || [])
      setAvailableHouses(housesData || [])
      setHiringPosts(hiringData || [])
    }

    void loadBaseData()
  }, [])

  useEffect(() => {
    const loadNeighborhoodManager = async () => {
      if (!user?.id) return

      const { data: neighborhoodData } = await supabase
        .from('neighborhoods')
        .select('*')
        .eq('leader_user_id', user.id)
        .maybeSingle()

      if (!neighborhoodData) return

      setMyNeighborhood(neighborhoodData)

      const { data: propertiesData } = await supabase
        .from('houses')
        .select('*, user_profiles!houses_owner_user_id_fkey(username)')
        .eq('neighborhood_id', neighborhoodData.id)

      setMyProperties(propertiesData || [])
      setMyTenants((propertiesData || []).filter((p) => p.owner_user_id && p.owner_user_id !== user.id))

      const propertyIds = (propertiesData || []).map((p) => p.id)
      if (propertyIds.length > 0) {
        const { data: applicationsData } = await supabase
          .from('apartment_applications')
          .select('*')
          .in('property_id', propertyIds)
          .eq('status', 'pending')

        setPendingApplications(applicationsData || [])
      }
    }

    void loadNeighborhoodManager()
  }, [user?.id])

  const participantStatus = (eventId: string, userId?: string) => {
    return participants.find((p) => p.event_id === eventId && p.user_id === userId)?.status
  }

  const participantCount = (eventId: string) => {
    return participants.filter((p) => p.event_id === eventId).length
  }

  const refreshProfile = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return

    setLoadingProfile(true)

    try {
      const [{ data: businessRows }, { data: eventRows }] = await Promise.all([
        supabase.from('neighbors_businesses').select('*').eq('owner_user_id', userData.user.id),
        supabase.from('neighbors_events').select('*').eq('created_by_user_id', userData.user.id),
      ])

      setMyBusinesses(businessRows || [])
      setMyEvents(eventRows || [])
    } finally {
      setLoadingProfile(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'my-profile' || activeTab === 'hiring') void refreshProfile()
  }, [activeTab])

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return

    const payload = {
      ...eventFormData,
      created_by_user_id: userData.user.id,
      latitude: eventFormData.latitude || userLocation?.[0] || 0,
      longitude: eventFormData.longitude || userLocation?.[1] || 0,
      start_time: new Date(eventFormData.start_time).toISOString(),
      end_time: new Date(eventFormData.end_time).toISOString(),
    }

    const { error } = await supabase.from('neighbors_events').insert([payload])
    if (error) {
      console.error('Error creating event:', error)
      return
    }

    setCreatingEvent(false)
    setEventFormData(resetEventForm())

    if (userLocation) {
      const { data } = await supabase.rpc('get_nearby_neighbors_events', {
        lat: userLocation[0],
        lng: userLocation[1],
        radius: searchRadius,
      })
      setEvents(data || [])
    }
  }

  const handleRegisterBusiness = async (event: React.FormEvent) => {
    event.preventDefault()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return

    const payload = {
      ...businessFormData,
      latitude: businessFormData.latitude || userLocation?.[0] || 0,
      longitude: businessFormData.longitude || userLocation?.[1] || 0,
      owner_user_id: userData.user.id,
      verified: false,
      approval_status: 'pending',
    }

    const { error } = await supabase.from('neighbors_businesses').insert([payload])
    if (error) {
      console.error('Error registering business:', error)
      return
    }

    setCreatingBusiness(false)
    setBusinessSuccess(true)
    setBusinessFormData(resetBusinessForm())
  }

  const handleCreateHiring = async (event: React.FormEvent) => {
    event.preventDefault()

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return

    const { error } = await supabase.from('neighbors_hiring').insert([
      {
        ...hiringFormData,
        owner_user_id: userData.user.id,
        is_active: true,
      },
    ])

    if (error) {
      console.error('Error posting job:', error)
      return
    }

    setCreatingHiring(false)
    setHiringFormData(resetHiringForm())

    const { data } = await supabase
      .from('neighbors_hiring')
      .select('*, neighbors_businesses(business_name)')
      .eq('is_active', true)

    setHiringPosts(data || [])
  }

  const handleJoinEvent = async (eventId: string) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return

    const { error } = await supabase.from('neighbors_participants').insert([
      {
        event_id: eventId,
        user_id: userData.user.id,
        status: 'joined',
      },
    ])

    if (error) {
      console.error('Error joining event:', error)
      return
    }

    const { data } = await supabase.from('neighbors_participants').select('*')
    setParticipants(data || [])
  }

  const tabItems = [
    ['nearby', Calendar, 'Nearby'],
    ['map', Map, 'Map'],
    ['neighborhoods', Home, 'Neighborhoods'],
    ['my-neighborhood', Building2, 'My Hood'],
    ['driver-test', Car, 'Driver Test'],
    ['my-events', Users, 'My Events'],
    ['create-event', Plus, 'Create'],
    ['businesses', Briefcase, 'Biz'],
    ['my-profile', Users, 'Profile'],
    ['hiring', Briefcase, 'Hiring'],
    ['leaderboard', Trophy, 'Top'],
  ] as const

  const mapCenter = userLocation || [39.8283, -98.5795]

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050714] px-4 pb-10 pt-24 text-white md:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.14),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />

      <div className="relative z-10 mx-auto max-w-7xl">
        {businessSuccess && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 text-emerald-100">
            <div>
              <p className="font-black">Business registered successfully.</p>
              <p className="text-sm text-emerald-200/75">Your business is pending verification.</p>
            </div>
            <button onClick={() => setBusinessSuccess(false)} className="rounded-xl p-2 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <header className={cn(tcPanel, 'mb-6 overflow-hidden p-5 md:p-6')}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <Home className="h-6 w-6 text-cyan-200" />
                </div>

                <div>
                  <h1 className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-300 bg-clip-text text-3xl font-black text-transparent md:text-5xl">
                    Troll City Neighbors
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Local events, businesses, neighborhoods, driver tests, jobs, and community rewards.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCreatingEvent(true)} className={tcPrimary}>
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>

              <Button onClick={() => setCreatingBusiness(true)} className={tcButton}>
                <Briefcase className="mr-2 h-4 w-4" />
                Register Business
              </Button>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className={cn(tcPanel, 'mb-6 p-2')}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11">
              {tabItems.map(([value, Icon, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs font-black text-slate-300 data-[state=active]:border-cyan-300/40 data-[state=active]:bg-cyan-300 data-[state=active]:text-slate-950"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="nearby">
            <PanelTitle title="Nearby Events" subtitle="Find community events around your search radius." />

            <Card className={cn(tcCard, 'p-5')}>
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black">Events Near You</h2>
                  <p className="text-sm text-slate-400">{searchRadius} km search radius</p>
                </div>

                <div className="flex items-center gap-3">
                  <Label className="text-cyan-100">Radius</Label>
                  <Slider value={searchRadius} onValueChange={setSearchRadius} min={5} max={100} step={5} className="w-40" />
                  <span className="text-sm font-bold text-cyan-200">{searchRadius} km</span>
                </div>
              </div>

              {loading ? (
                <EmptyState title="Loading nearby events..." icon={<RefreshCw className="h-8 w-8 animate-spin text-cyan-300" />} />
              ) : events.length === 0 ? (
                <EmptyState
                  title="No events nearby"
                  subtitle="Increase your radius or create the first community event."
                  icon={<Calendar className="h-8 w-8 text-slate-500" />}
                  action={
                    <Button onClick={() => setCreatingEvent(true)} className={tcPrimary}>
                      Create Event
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      participantCount={participantCount(event.id)}
                      joined={Boolean(participantStatus(event.id, user?.id))}
                      onJoin={() => handleJoinEvent(event.id)}
                    />
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="map">
            <PanelTitle title="Neighbor Map" subtitle="Events, businesses, and neighborhoods in one city view." />

            <Card className={cn(tcCard, 'overflow-hidden p-3')}>
              <div className="h-[620px] overflow-hidden rounded-[1.5rem] border border-cyan-300/15">
                <MapContainer center={mapCenter as [number, number]} zoom={6} className="h-full w-full">
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {events.map((event) => (
                    <Marker key={`event-${event.id}`} position={[event.latitude || mapCenter[0], event.longitude || mapCenter[1]]}>
                      <Popup>
                        <PopupCard
                          title={event.title}
                          description={event.description}
                          badges={[event.category, `${event.reward_coins || 0} coins`]}
                        />
                      </Popup>
                    </Marker>
                  ))}

                  {businesses.map((business) => (
                    <Marker key={`business-${business.id}`} position={[business.latitude || mapCenter[0], business.longitude || mapCenter[1]]}>
                      <Popup>
                        <PopupCard
                          title={business.business_name}
                          description={business.description}
                          badges={[business.category, business.verified ? 'Verified' : 'Pending']}
                        />
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="neighborhoods">
            <PanelTitle title="Neighborhoods" subtitle="View available houses and city districts." />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {neighborhoods.length === 0 ? (
                <EmptyPanel title="No neighborhoods found" />
              ) : (
                neighborhoods.map((neighborhood) => {
                  const houses = availableHouses.filter((house) => house.neighborhood_id === neighborhood.id)

                  return (
                    <Card key={neighborhood.id} className={cn(tcCard, 'p-5')}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black">{neighborhood.name}</h3>
                          <p className="text-sm text-slate-400">ZIP: {neighborhood.zip_code || 'N/A'}</p>
                        </div>
                        <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
                          {houses.length} open
                        </Badge>
                      </div>

                      <Button onClick={() => navigate('/living')} className={cn(tcButton, 'mt-5 w-full')}>
                        View Houses
                      </Button>
                    </Card>
                  )
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-neighborhood">
            <PanelTitle title="My Neighborhood" subtitle="Manage properties, tenants, and pending applications." />

            {!myNeighborhood ? (
              <EmptyPanel title="You are not a neighborhood leader yet." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <StatPanel label="Properties" value={myProperties.length} />
                <StatPanel label="Tenants" value={myTenants.length} />
                <StatPanel label="Pending Applications" value={pendingApplications.length} />

                <Card className={cn(tcCard, 'p-5 lg:col-span-3')}>
                  <h3 className="mb-4 text-xl font-black">{myNeighborhood.name}</h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {myProperties.map((property) => (
                      <div key={property.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="font-bold text-white">{property.name || property.address || 'Property'}</p>
                        <p className="text-sm text-slate-400">
                          Owner: {property.user_profiles?.username || 'Available'}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="driver-test">
            <DriverTestManual />
          </TabsContent>

          <TabsContent value="my-events">
            <PanelTitle title="My Events" subtitle="Events you created or joined." />
            <EmptyPanel
              title="My Events module is ready"
              subtitle="Connect this tab to joined/created event queries when the backend is finalized."
              button={
                <Button onClick={() => setCreatingEvent(true)} className={tcPrimary}>
                  Create Event
                </Button>
              }
            />
          </TabsContent>

          <TabsContent value="create-event">
            <PanelTitle title="Create Event" subtitle="Post a nearby event with rewards and requirements." />
            <EventForm
              eventFormData={eventFormData}
              setEventFormData={setEventFormData}
              onSubmit={handleCreateEvent}
              onClear={() => setEventFormData(resetEventForm())}
            />
          </TabsContent>

          <TabsContent value="businesses">
            <PanelTitle title="Businesses" subtitle="Verified local businesses inside Troll City Neighbors." />

            {businesses.length === 0 ? (
              <EmptyPanel
                title="No businesses nearby"
                button={
                  <Button onClick={() => setCreatingBusiness(true)} className={tcPrimary}>
                    Register Business
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {businesses.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-profile">
            <PanelTitle title="My Profile" subtitle="Manage your registered businesses and created events." />

            <Card className={cn(tcCard, 'p-5')}>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-black">My Neighbor Profile</h2>
                <Button onClick={refreshProfile} disabled={loadingProfile} className={tcButton}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', loadingProfile && 'animate-spin')} />
                  Refresh
                </Button>
              </div>

              <SectionList title="My Businesses" empty="You have not registered any businesses yet." rows={myBusinesses} type="business" />
              <SectionList title="My Events" empty="You have not created any events yet." rows={myEvents} type="event" />
            </Card>
          </TabsContent>

          <TabsContent value="hiring">
            <PanelTitle title="Hiring & Jobs" subtitle="Business job posts for the Troll City local economy." />

            <Card className={cn(tcCard, 'p-5')}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Open Jobs</h2>
                  <p className="text-sm text-slate-400">Verified businesses can post jobs.</p>
                </div>

                <Button onClick={() => setCreatingHiring(true)} className={tcPrimary}>
                  <Plus className="mr-2 h-4 w-4" />
                  Post Job
                </Button>
              </div>

              {hiringPosts.length === 0 ? (
                <EmptyState title="No job postings yet" icon={<Briefcase className="h-8 w-8 text-slate-500" />} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {hiringPosts.map((post) => (
                    <Card key={post.id} className={cn(tcCard, 'p-4')}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{post.title}</h3>
                          <p className="text-sm text-cyan-200/80">{post.neighbors_businesses?.business_name}</p>
                        </div>
                        <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">{post.job_type}</Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{post.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                        {post.pay_rate && <Badge className="bg-emerald-400/10 text-emerald-100">{post.pay_rate}</Badge>}
                        {post.contact_email && <Badge className="bg-white/10 text-slate-200">{post.contact_email}</Badge>}
                        {post.contact_phone && <Badge className="bg-white/10 text-slate-200">{post.contact_phone}</Badge>}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <PanelTitle title="Leaderboard" subtitle="Top participants and businesses are coming soon." />
            <EmptyPanel title="Leaderboard Coming Soon" subtitle="Check back later for the top participants in your area." />
          </TabsContent>
        </Tabs>
      </div>

      {creatingEvent && (
        <Modal title="Create New Event" onClose={() => setCreatingEvent(false)}>
          <EventForm
            eventFormData={eventFormData}
            setEventFormData={setEventFormData}
            onSubmit={handleCreateEvent}
            onClear={() => setEventFormData(resetEventForm())}
          />
        </Modal>
      )}

      {creatingBusiness && (
        <Modal title="Register Business" onClose={() => setCreatingBusiness(false)}>
          <BusinessForm
            businessFormData={businessFormData}
            setBusinessFormData={setBusinessFormData}
            onSubmit={handleRegisterBusiness}
            onClear={() => setBusinessFormData(resetBusinessForm())}
          />
        </Modal>
      )}

      {creatingHiring && (
        <Modal title="Post a Job" onClose={() => setCreatingHiring(false)}>
          <HiringForm
            hiringFormData={hiringFormData}
            setHiringFormData={setHiringFormData}
            myBusinesses={myBusinesses}
            onSubmit={handleCreateHiring}
          />
        </Modal>
      )}
    </div>
  )
}

function PanelTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="bg-gradient-to-r from-cyan-200 to-fuchsia-200 bg-clip-text text-2xl font-black text-transparent">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
  )
}

function EmptyState({ title, subtitle, icon, action }: any) {
  return (
    <div className="flex min-h-[260px] items-center justify-center text-center">
      <div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
          {icon || <Sparkles className="h-8 w-8 text-cyan-300/60" />}
        </div>
        <p className="text-lg font-black text-white">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

function EmptyPanel({ title, subtitle, button }: any) {
  return (
    <Card className={cn(tcCard, 'p-8 text-center')}>
      <EmptyState title={title} subtitle={subtitle} action={button} />
    </Card>
  )
}

function StatPanel({ label, value }: { label: string; value: number }) {
  return (
    <Card className={cn(tcCard, 'p-5 text-center')}>
      <p className="text-3xl font-black text-cyan-200">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    </Card>
  )
}

function EventCard({ event, participantCount, joined, onJoin }: any) {
  return (
    <Card className={cn(tcCard, 'p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{event.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400">{event.description}</p>
        </div>
        <Badge className="border border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100">{event.category}</Badge>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-300">
        <p className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-cyan-300" />
          {event.start_time ? new Date(event.start_time).toLocaleString() : 'TBD'}
        </p>
        <p className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-cyan-300" />
          {event.city}, {event.state}
        </p>
        <p className="flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-300" />
          {participantCount} participants
        </p>
        <p className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-300" />
          {event.reward_coins || 0} coins
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        <Button onClick={onJoin} disabled={joined} className={cn(tcPrimary, 'flex-1')}>
          {joined ? 'Joined' : 'Join Event'}
        </Button>
        <Button className={tcButton}>Details</Button>
      </div>
    </Card>
  )
}

function BusinessCard({ business }: any) {
  return (
    <Card className={cn(tcCard, 'p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{business.business_name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400">{business.description}</p>
        </div>
        <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">{business.category}</Badge>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-300">
        <p>{business.address}</p>
        <p>{business.city}, {business.state}</p>
        {business.phone && <p>{business.phone}</p>}
        {business.email && <p>{business.email}</p>}
      </div>

      <div className="mt-5 flex gap-2">
        <Button className={cn(tcPrimary, 'flex-1')}>View Profile</Button>
        <Button className={tcButton}>Directions</Button>
      </div>
    </Card>
  )
}

function PopupCard({ title, description, badges }: any) {
  return (
    <div className="min-w-[220px] p-2 text-slate-900">
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-1 text-sm text-slate-700">{description}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {badges.map((badge: string) => (
          <span key={badge} className="rounded-full bg-slate-900 px-2 py-1 text-xs font-bold text-white">
            {badge}
          </span>
        ))}
      </div>
    </div>
  )
}

function FormField({ label, children }: any) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-bold text-cyan-100">{label}</Label>
      {children}
    </div>
  )
}

function EventForm({ eventFormData, setEventFormData, onSubmit, onClear }: any) {
  return (
    <Card className={cn(tcCard, 'p-5')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Event Title">
            <Input className={tcInput} value={eventFormData.title} onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })} required />
          </FormField>

          <FormField label="Category">
            <Select value={eventFormData.category} onValueChange={(value) => setEventFormData({ ...eventFormData, category: value })}>
              <SelectTrigger className={tcInput}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={8} className={tcSelectContent}>
                {eventCategories.map((category) => (
                  <SelectItem key={category} value={category} className="cursor-pointer focus:bg-cyan-400/20">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="Description">
          <Textarea className={tcInput} rows={3} value={eventFormData.description} onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })} required />
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="City">
            <Input className={tcInput} value={eventFormData.city} onChange={(e) => setEventFormData({ ...eventFormData, city: e.target.value })} required />
          </FormField>

          <FormField label="State">
            <Input className={tcInput} value={eventFormData.state} onChange={(e) => setEventFormData({ ...eventFormData, state: e.target.value })} required />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Start Time">
            <Input className={tcInput} type="datetime-local" value={eventFormData.start_time} onChange={(e) => setEventFormData({ ...eventFormData, start_time: e.target.value })} required />
          </FormField>

          <FormField label="End Time">
            <Input className={tcInput} type="datetime-local" value={eventFormData.end_time} onChange={(e) => setEventFormData({ ...eventFormData, end_time: e.target.value })} required />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Max Participants">
            <Input className={tcInput} type="number" min="1" max="100" value={eventFormData.max_participants} onChange={(e) => setEventFormData({ ...eventFormData, max_participants: Number(e.target.value) })} />
          </FormField>

          <FormField label="Reward Coins">
            <Input className={tcInput} type="number" min="0" max="10000" value={eventFormData.reward_coins} onChange={(e) => setEventFormData({ ...eventFormData, reward_coins: Number(e.target.value) })} />
          </FormField>
        </div>

        <FormField label="Requirements">
          <Textarea className={tcInput} rows={2} value={eventFormData.requirements} onChange={(e) => setEventFormData({ ...eventFormData, requirements: e.target.value })} />
        </FormField>

        <FormField label="Visibility">
          <Select value={eventFormData.visibility} onValueChange={(value) => setEventFormData({ ...eventFormData, visibility: value })}>
            <SelectTrigger className={tcInput}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={8} className={tcSelectContent}>
              <SelectItem value="public" className="focus:bg-cyan-400/20">Public</SelectItem>
              <SelectItem value="neighborhood" className="focus:bg-cyan-400/20">Neighborhood Only</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" className={tcPrimary}>Create Event</Button>
          <Button type="button" onClick={onClear} className={tcButton}>Clear Form</Button>
        </div>
      </form>
    </Card>
  )
}

function BusinessForm({ businessFormData, setBusinessFormData, onSubmit, onClear }: any) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Business Name">
        <Input className={tcInput} value={businessFormData.business_name} onChange={(e) => setBusinessFormData({ ...businessFormData, business_name: e.target.value })} required />
      </FormField>

      <FormField label="Category">
        <Select value={businessFormData.category} onValueChange={(value) => setBusinessFormData({ ...businessFormData, category: value })}>
          <SelectTrigger className={tcInput}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={8} className={tcSelectContent}>
            {businessCategories.map((category) => (
              <SelectItem key={category} value={category} className="focus:bg-cyan-400/20">
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="Description">
        <Textarea className={tcInput} value={businessFormData.description} onChange={(e) => setBusinessFormData({ ...businessFormData, description: e.target.value })} rows={3} />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Phone">
          <Input className={tcInput} value={businessFormData.phone} onChange={(e) => setBusinessFormData({ ...businessFormData, phone: e.target.value })} />
        </FormField>

        <FormField label="Email">
          <Input className={tcInput} type="email" value={businessFormData.email} onChange={(e) => setBusinessFormData({ ...businessFormData, email: e.target.value })} />
        </FormField>
      </div>

      <FormField label="Website">
        <Input className={tcInput} value={businessFormData.website} onChange={(e) => setBusinessFormData({ ...businessFormData, website: e.target.value })} />
      </FormField>

      <FormField label="Address">
        <Input className={tcInput} value={businessFormData.address} onChange={(e) => setBusinessFormData({ ...businessFormData, address: e.target.value })} />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="City">
          <Input className={tcInput} value={businessFormData.city} onChange={(e) => setBusinessFormData({ ...businessFormData, city: e.target.value })} />
        </FormField>

        <FormField label="State">
          <Input className={tcInput} value={businessFormData.state} onChange={(e) => setBusinessFormData({ ...businessFormData, state: e.target.value })} />
        </FormField>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" onClick={onClear} className={tcButton}>Clear</Button>
        <Button type="submit" className={tcPrimary}>Register Business</Button>
      </div>
    </form>
  )
}

function HiringForm({ hiringFormData, setHiringFormData, myBusinesses, onSubmit }: any) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Business">
        <Select value={hiringFormData.business_id} onValueChange={(value) => setHiringFormData({ ...hiringFormData, business_id: value })}>
          <SelectTrigger className={tcInput}>
            <SelectValue placeholder="Select your business" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={8} className={tcSelectContent}>
            {myBusinesses.map((business: any) => (
              <SelectItem key={business.id} value={business.id} className="focus:bg-cyan-400/20">
                {business.business_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="Job Title">
        <Input className={tcInput} value={hiringFormData.title} onChange={(e) => setHiringFormData({ ...hiringFormData, title: e.target.value })} required />
      </FormField>

      <FormField label="Description">
        <Textarea className={tcInput} value={hiringFormData.description} onChange={(e) => setHiringFormData({ ...hiringFormData, description: e.target.value })} rows={3} />
      </FormField>

      <FormField label="Requirements">
        <Textarea className={tcInput} value={hiringFormData.requirements} onChange={(e) => setHiringFormData({ ...hiringFormData, requirements: e.target.value })} rows={2} />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Job Type">
          <Select value={hiringFormData.job_type} onValueChange={(value) => setHiringFormData({ ...hiringFormData, job_type: value })}>
            <SelectTrigger className={tcInput}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={8} className={tcSelectContent}>
              <SelectItem value="full-time" className="focus:bg-cyan-400/20">Full-time</SelectItem>
              <SelectItem value="part-time" className="focus:bg-cyan-400/20">Part-time</SelectItem>
              <SelectItem value="contract" className="focus:bg-cyan-400/20">Contract</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Pay Rate">
          <Input className={tcInput} value={hiringFormData.pay_rate} onChange={(e) => setHiringFormData({ ...hiringFormData, pay_rate: e.target.value })} />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Contact Email">
          <Input className={tcInput} type="email" value={hiringFormData.contact_email} onChange={(e) => setHiringFormData({ ...hiringFormData, contact_email: e.target.value })} />
        </FormField>

        <FormField label="Contact Phone">
          <Input className={tcInput} value={hiringFormData.contact_phone} onChange={(e) => setHiringFormData({ ...hiringFormData, contact_phone: e.target.value })} />
        </FormField>
      </div>

      <FormField label="Location">
        <Input className={tcInput} value={hiringFormData.location} onChange={(e) => setHiringFormData({ ...hiringFormData, location: e.target.value })} />
      </FormField>

      <div className="flex justify-end pt-2">
        <Button type="submit" className={tcPrimary}>Post Job</Button>
      </div>
    </form>
  )
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-cyan-300/20 bg-slate-950 p-6 text-white shadow-[0_0_60px_rgba(34,211,238,0.22)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="bg-gradient-to-r from-cyan-200 to-fuchsia-200 bg-clip-text text-2xl font-black text-transparent">
            {title}
          </h2>
          <button onClick={onClose} className={cn(tcDanger, 'rounded-xl p-2')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

function SectionList({ title, empty, rows, type }: any) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-lg font-black text-white">{title}</h3>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row: any) => (
            <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="font-black text-white">{type === 'business' ? row.business_name : row.title}</h4>
              <p className="mt-1 text-sm text-slate-400">{row.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {type === 'business' && (
                  <Badge className="bg-cyan-400/10 text-cyan-100">
                    {row.verified || row.approval_status === 'approved' ? 'Approved' : 'Pending'}
                  </Badge>
                )}
                {row.category && <Badge className="bg-white/10 text-slate-200">{row.category}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}