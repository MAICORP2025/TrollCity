import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home,
  Car,
  Check,
  Sparkles,
  MapPin,
  ShieldCheck,
  Zap,
  Star,
  Trophy
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { useNeighborhood } from '../lib/hooks/useNeighborhood'
import { useVehicleSystem, useDriverTest } from '../lib/hooks/useVehicleSystem'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { deductCoins } from '../lib/coinTransactions'
import {
  CAR_OPTIONS,
  DOOR_COLORS,
  HOUSE_TYPES,
  ROOF_STYLES,
  TRIM_COLORS,
  WINDOW_STYLES,
  YARD_DECORATIONS
} from '../lib/neighborhoodAssets'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../components/ui/dialog'

type OnboardingScene = 'street' | 'car' | 'driverTest' | 'insurance' | 'license' | 'complete'

const DRIVER_QUESTIONS = [
  {
    question: 'What does an ACTIVE license allow you to do?',
    options: [
      'Only watch broadcasts',
      'Drive and broadcast',
      'Send messages only',
      'Buy coins'
    ],
    correct: 1
  },
  {
    question: 'What happens if you drive without a license in Troll City?',
    options: [
      'Nothing happens',
      'You gain coins',
      'You get suspended and must retake the test',
      'You get a warning only'
    ],
    correct: 2
  },
  {
    question: 'Can a suspended user start a broadcast?',
    options: [
      'Yes',
      'No',
      'Only at night',
      'Only with coins'
    ],
    correct: 1
  },
  {
    question: 'Can a suspended user join a broadcast seat?',
    options: [
      'No',
      'Yes',
      'Only if invited',
      'Only if they pay coins'
    ],
    correct: 1
  },
  {
    question: 'What is required before you can legally drive?',
    options: [
      'A car only',
      'Coins',
      'Active license and insurance',
      'Followers'
    ],
    correct: 2
  },
  {
    question: 'What does insurance help cover?',
    options: [
      'Free upgrades',
      'Vehicle damage and vandalism',
      'More followers',
      'Faster streaming'
    ],
    correct: 1
  },
  {
    question: 'If your vehicle is damaged and you have NO insurance, what happens?',
    options: [
      'Free repair',
      'Half cost repair',
      'Full cost repair',
      'Vehicle is deleted'
    ],
    correct: 2
  },
  {
    question: 'What must you do after a driving violation?',
    options: [
      'Nothing',
      'Buy insurance and retake the test',
      'Restart the app',
      'Join a stream'
    ],
    correct: 1
  },
  {
    question: 'What happens when your license is suspended?',
    options: [
      'You can still drive',
      'You cannot broadcast or drive',
      'You gain coins',
      'Nothing changes'
    ],
    correct: 1
  },
  {
    question: 'What is the purpose of the Troll City driver test?',
    options: [
      'To give free coins',
      'To unlock broadcasting and driving privileges',
      'To customize avatars',
      'To join chat rooms'
    ],
    correct: 1
  }
]

export default function NeighborhoodOnboarding() {
  const navigate = useNavigate()
  const { user, profile, setProfile, refreshProfile } = useAuthStore()
  const { createNeighborhood, checkInvites, acceptInvite } = useNeighborhood()
  const { activeVehicle, purchaseVehicle, updatePlate, loading: vehicleLoading } = useVehicleSystem()
  const { license, takeTest, loading: licenseLoading } = useDriverTest()

  const [currentScene, setCurrentScene] = useState<OnboardingScene>('street')
  const [loading, setLoading] = useState(true)
  const [streetName, setStreetName] = useState('Troll City Lane')
  const [zipCode, setZipCode] = useState('00001')
  const [houseCount, setHouseCount] = useState(5)
  const [houseStyle, setHouseStyle] = useState(HOUSE_TYPES[0].id)
  const [doorColor, setDoorColor] = useState(DOOR_COLORS[0].id)
  const [trimColor, setTrimColor] = useState(TRIM_COLORS[0].id)
  const [windowStyle, setWindowStyle] = useState(WINDOW_STYLES[0].id)
  const [roofStyle, setRoofStyle] = useState(ROOF_STYLES[0].id)
  const [yardDecoration, setYardDecoration] = useState(YARD_DECORATIONS[0].id)
  const [selectedCarId, setSelectedCarId] = useState(CAR_OPTIONS[0].id)
  const [purchasingCar, setPurchasingCar] = useState(false)
  const [testAnswers, setTestAnswers] = useState<number[]>([])
  const [testSubmitted, setTestSubmitted] = useState(false)
  const [testResult, setTestResult] = useState<{ score: number; passed: boolean } | null>(null)
  const [insuranceBuying, setInsuranceBuying] = useState(false)
  const [insuranceActive, setInsuranceActive] = useState(false)
  const [plateText, setPlateText] = useState('TROLL123')
  const [updatingPlate, setUpdatingPlate] = useState(false)
  const [creatingNeighborhood, setCreatingNeighborhood] = useState(false)
  const [completeMessage, setCompleteMessage] = useState('')
  const [driversLicenseExpiry, setDriversLicenseExpiry] = useState<string | null>(null)
  const [sceneTransitioning, setSceneTransitioning] = useState(false)
  const [showSceneCelebration, setShowSceneCelebration] = useState(false)
  const [celebrationMessage, setCelebrationMessage] = useState('')
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const selectedCar = useMemo(
    () => CAR_OPTIONS.find((car) => car.id === selectedCarId) || CAR_OPTIONS[0],
    [selectedCarId]
  )

  const currentStepIndex = useMemo(
    () => ['street', 'car', 'driverTest', 'insurance', 'license', 'complete'].indexOf(currentScene),
    [currentScene]
  )

  const progressSteps = [
    { id: 'street', title: 'Build Your Street' },
    { id: 'car', title: 'Choose Your Ride' },
    { id: 'driverTest', title: 'Pass the Test' },
    { id: 'insurance', title: 'Buy Insurance' },
    { id: 'license', title: 'Plate Your Car' },
    { id: 'complete', title: 'Enter the Neighborhood' }
  ]

  const driverStatus = useMemo(() => {
    const profileAny = profile as any
    // Check profile first as it's updated during insurance purchase
    if (profileAny?.license_status === 'active') return 'Active'
    if (profileAny?.license_status === 'suspended') return 'Suspended'
    // Fallback to license object
    if (!license) return 'No License'
    if (license.status === 'active') return 'Active'
    if (license.status === 'suspended') return 'Suspended'
    return 'No License'
  }, [license, profile])

  const transitionToScene = (nextScene: OnboardingScene, celebrationMsg: string = '') => {
    setSceneTransitioning(true)
    if (celebrationMsg) {
      setCelebrationMessage(celebrationMsg)
      setShowSceneCelebration(true)
      setTimeout(() => {
        setShowSceneCelebration(false)
        setCurrentScene(nextScene)
        setSceneTransitioning(false)
      }, 2500)
    } else {
      setTimeout(() => {
        setCurrentScene(nextScene)
        setSceneTransitioning(false)
      }, 800)
    }
  }

  useEffect(() => {
    if (!user) return

    const checkUserStatus = async () => {
      setLoading(true)

      const profileAny = profile as any
      const hasNeighborhood = !!profileAny?.neighborhood_id
      const hasHouse = !!profileAny?.house_id
      const hasVehicle = !!profileAny?.vehicle_id
      const carInsuranceValid = profileAny?.car_insurance_expiry ? new Date(profileAny.car_insurance_expiry) > new Date() : false
      const hasPlate = !!profileAny?.license_plate
      const hasRestorableLicense =
        profileAny?.license_status === 'suspended' &&
        carInsuranceValid &&
        !!profileAny?.driver_test_passed_at
      const hasLicense = license?.status === 'active' || profileAny?.license_status === 'active' || hasRestorableLicense

      // Sync drivers license expiry from profile
      if (profileAny?.drivers_license_expiry) {
        setDriversLicenseExpiry(profileAny.drivers_license_expiry)
      }

      // Check if user is a family member (has accepted invites)
      const { hasAcceptedInvites } = await checkInvites()
      const isFamilyMember = hasAcceptedInvites && !hasNeighborhood

      // If family member doesn't have neighborhood, accept the invite to assign them
      if (isFamilyMember) {
        try {
          await acceptInvite()
          // Refresh profile after accepting invite
          await refreshProfile()
        } catch (error) {
          console.error('Error accepting family invite:', error)
        }
      }

      if (!isMountedRef.current) return

      let nextScene: OnboardingScene = currentScene
      let nextMessage = ''

      if (hasNeighborhood && hasHouse && hasVehicle && carInsuranceValid && hasPlate && hasLicense) {
        nextScene = 'complete'
        nextMessage = 'Your neighborhood is ready. Enter the streets of Troll City!'
      } else if (isFamilyMember) {
        // Family members skip neighborhood creation and go to car selection
        if (!hasVehicle) {
          nextScene = 'car'
        } else if (!hasLicense && !hasRestorableLicense) {
          nextScene = 'driverTest'
        } else if (!carInsuranceValid) {
          nextScene = 'insurance'
        } else if (!hasPlate) {
          nextScene = 'license'
        } else {
          nextScene = 'complete'
          nextMessage = 'Welcome to your family neighborhood! Enter the streets of Troll City!'
        }
      } else if (!hasNeighborhood || !hasHouse) {
        nextScene = 'street'
      } else if (!hasVehicle) {
        nextScene = 'car'
      } else if (!hasLicense && !hasRestorableLicense) {
        nextScene = 'driverTest'
      } else if (!carInsuranceValid) {
        nextScene = 'insurance'
      } else if (!hasPlate) {
        nextScene = 'license'
      }

      if (nextScene !== currentScene) {
        setCurrentScene(nextScene)
      }
      if (nextScene === 'complete' && nextMessage) {
        setCompleteMessage(nextMessage)
      }
      setLoading(false)
    }

    checkUserStatus()
  }, [profile, license, user, checkInvites])

  const streetPreview = () => {
    const houses = Array.from({ length: houseCount }, (_, index) => index + 1)
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {houses.map((houseNumber) => (
          <div
            key={houseNumber}
            className={`relative rounded-3xl p-4 border ${houseNumber === 1 ? 'border-indigo-400 bg-indigo-950/40' : 'border-slate-700 bg-slate-900/60'} shadow-lg`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">House {houseNumber}</span>
              <Badge variant="secondary" className="text-[10px] uppercase">
                {houseNumber === 1 ? 'Your House' : 'Family Slot'}
              </Badge>
            </div>
            <div className="h-24 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-center text-sm">
              {houseNumber === 1 ? 'Home Base' : 'Future Family Home'}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const neighborhoodMapPreview = () => {
    const houses = Array.from({ length: houseCount }, (_, index) => index + 1)

    return (
      <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-slate-400">Neighborhood Map</div>
            <div className="text-lg font-semibold text-white">{streetName}</div>
          </div>
          <Badge variant="secondary" className="uppercase tracking-[0.24em] text-xs">ZIP {zipCode}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {houses.map((houseNumber) => (
            <div
              key={houseNumber}
              className={`rounded-3xl border p-4 ${houseNumber === 1 ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/80'} shadow-sm shadow-black/10`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">Block {houseNumber}</span>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {houseNumber === 1 ? 'Main' : 'Family'}
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-slate-300">
                <div>{houseNumber === 1 ? 'Leader home' : 'Open slot'}</div>
                <div>{houseNumber === 1 ? selectedHouseConfig.houseType : 'House slot'}</div>
              </div>
              <div className="mt-3 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center text-[11px] uppercase tracking-[0.2em] text-slate-400">
                {houseNumber === 1 ? 'Home Base' : 'Family Slot'}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
          <div className="font-semibold text-slate-100">Game Notes</div>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>Lead your home block to become the safest street.</li>
            <li>Invite family members to fill open slots and expand your block.</li>
            <li>Unlock house upgrades, officer patrols, and neighborhood raids.</li>
          </ul>
        </div>
      </div>
    )
  }

  const handleCreateStreet = async () => {
    if (!streetName.trim() || !zipCode.trim()) {
      toast.error('Street name and zip code are required')
      return
    }
    if (!/^[A-Z0-9 ]{3,8}$/i.test(zipCode)) {
      toast.error('Zip code must be 3-8 letters or numbers')
      return
    }

    setCreatingNeighborhood(true)
    try {
      const result = await createNeighborhood(streetName.trim(), zipCode.trim(), houseCount)
      if (result.success) {
        // Refresh profile to sync neighborhood_id and house_id
        await refreshProfile(true)
        toast.success('Street created! Next stop: your car')
        transitionToScene('car', '🏘️ Street built! Time to choose your ride!')
      } else {
        toast.error(result.error || 'Unable to create your street')
      }
    } catch (error: any) {
      toast.error(error.message || 'Neighborhood creation failed')
    } finally {
      setCreatingNeighborhood(false)
    }
  }

  const handlePurchaseCar = async () => {
    if (!selectedCar) return
    if (!user?.id) {
      toast.error('Must be signed in')
      return
    }

    setPurchasingCar(true)
    try {
      const result = await purchaseVehicle(
        selectedCar.name,
        'TrollMotors',
        selectedCar.name,
        2026,
        selectedCar.price,
        false
      )
      if (!result.success) {
        toast.error(result.error || 'Unable to buy this car')
      } else {
        // Refresh profile to sync vehicle_id
        await refreshProfile(true)
        toast.success(`${selectedCar.name} is yours!`)
        transitionToScene('driverTest', '🚗 Car purchased! Now prove you can drive!')
      }
    } catch (error: any) {
      toast.error(error.message || 'Purchase failed')
    } finally {
      setPurchasingCar(false)
    }
  }

  const handleToggleAnswer = (questionIndex: number, optionIndex: number) => {
    setTestAnswers((existing) => {
      const next = [...existing]
      next[questionIndex] = optionIndex
      return next
    })
  }

  const handleSubmitDriverTest = async () => {
    if (testAnswers.length !== DRIVER_QUESTIONS.length || testAnswers.some((answer) => answer === undefined)) {
      toast.error('Answer every question before submitting')
      return
    }

    setTestSubmitted(true)
    const result = await takeTest(testAnswers, DRIVER_QUESTIONS.map((q) => q.correct))
    if (result.success) {
      setTestResult({ score: result.score, passed: result.passed })
      if (result.passed) {
        transitionToScene('insurance', '🎓 Test passed! License pending - get insured!')
      }
    } else {
      toast.error('Driver test submission failed')
    }
  }

  const handlePurchaseInsurance = async () => {
    if (!activeVehicle) {
      toast.error('No active vehicle to insure')
      return
    }

    setInsuranceBuying(true)
    try {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      
      const profileAny = profile as any
      const isFirstTimeUser = !profileAny?.neighborhood_id && !profileAny?.house_id
      const hasFreeInsurance = isFirstTimeUser

      let deductSuccess = true
      let deductError: string | null = null

      if (!hasFreeInsurance) {
         const { success, error } = await deductCoins({
           userId: user?.id,
           amount: 200,
           type: 'insurance_purchase',
           coinType: 'troll_coins',
           description: 'Car insurance - 30 days',
           metadata: { vehicle_id: activeVehicle.id, duration_days: 30 }
         })
        deductSuccess = success
        deductError = error
      }

      if (!deductSuccess) {
        throw new Error(deductError || 'Insufficient coins to purchase insurance')
      }

      const shouldRestoreLicense =
        profileAny?.license_status === 'suspended' &&
        !!profileAny?.driver_test_passed_at

      const updateData: any = {
        car_insurance_expiry: expiry
      }

      if (shouldRestoreLicense) {
        updateData.license_status = 'active'
        updateData.license_restored_at = new Date().toISOString()
        updateData.insurance_required = false
        updateData.drivers_license_expiry = expiry
      }

      const { error } = await supabase.from('car_insurances').insert({
        user_id: user?.id,
        vehicle_id: activeVehicle.id,
        expires_at: expiry,
        deductible_paid: 0
      })
      if (error) {
        throw error
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user?.id)

      if (profileError) {
        throw profileError
      }

      if (profile) {
        setProfile({
          ...profile,
          ...updateData
        })
        if (shouldRestoreLicense) {
          setDriversLicenseExpiry(expiry)
        }
      }

      await refreshProfile(true)
      
      setInsuranceActive(true)
      toast.success(hasFreeInsurance 
        ? 'Free insurance activated for 30 days!' 
        : 'Car insurance active for 30 days')
      transitionToScene('license', '🛡️ Insured! Now customize your license plate!')
    } catch (error: any) {
      console.error('Insurance error:', error)
      toast.error(error.message || 'Unable to purchase insurance')
    } finally {
      setInsuranceBuying(false)
    }
  }

  const handleSavePlate = async () => {
    if (!activeVehicle) return
    const normalized = plateText.trim().toUpperCase()
    if (!/^[A-Z0-9]{1,8}$/.test(normalized)) {
      toast.error('Plate must be 1-8 letters or numbers')
      return
    }

     setUpdatingPlate(true)
     try {
       const result = await updatePlate(normalized)
       if (!result.success) {
         toast.error(result.error || 'Unable to save plate')
       } else {
         await supabase.from('user_profiles').update({ license_plate: normalized }).eq('id', user?.id)
         // Refresh profile to sync
         await refreshProfile(true)
         toast.success('License plate saved')
         transitionToScene('complete', '🏆 License complete! Welcome to Troll City!')
       }
     } catch (error: any) {
       toast.error(error.message || 'Failed to save license plate')
     } finally {
       setUpdatingPlate(false)
     }
   }

  const selectedHouseConfig = useMemo(() => {
    return {
      houseType: HOUSE_TYPES.find((item) => item.id === houseStyle)?.label || 'Townhouse',
      doorColor: DOOR_COLORS.find((item) => item.id === doorColor)?.label || 'Neon Blue',
      trimColor: TRIM_COLORS.find((item) => item.id === trimColor)?.label || 'Gold',
      windowStyle: WINDOW_STYLES.find((item) => item.id === windowStyle)?.label || 'Arched',
      roofStyle: ROOF_STYLES.find((item) => item.id === roofStyle)?.label || 'Flat Roof',
      yardDecoration: YARD_DECORATIONS.find((item) => item.id === yardDecoration)?.label || 'Garden'
    }
  }, [doorColor, houseStyle, roofStyle, trimColor, windowStyle, yardDecoration])

  if (loading || vehicleLoading || licenseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0d1222] to-[#1c1334] text-white py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-600/20 px-4 py-2 text-sm font-semibold text-violet-200">
              <Sparkles className="w-4 h-4 text-violet-300" />
              Neighborhood Setup: Troll City Edition
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">Launch your first Troll City street</h1>
            <p className="mt-3 max-w-2xl text-slate-400">A gamified neighborhood setup that turns onboarding into a city builder adventure.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {progressSteps.map((step, index) => (
              <div key={step.id} className={`rounded-3xl border p-3 text-xs ${index <= currentStepIndex ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700 bg-slate-900/60'}`}>
                <div className="font-semibold text-slate-100">{index + 1}</div>
                <div className="mt-1 text-slate-400">{step.title}</div>
              </div>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden border-slate-700 bg-slate-900/80 shadow-2xl shadow-black/20">
          <CardHeader className="bg-slate-950/90 border-b border-slate-700 px-6 py-5">
            <CardTitle className="text-xl text-white">{currentScene === 'street' && 'Scene 1: Create Your First Home'}
              {currentScene === 'car' && 'Scene 2: Choose Your Starter Car'}
              {currentScene === 'driverTest' && 'Scene 3: Driver Test'}
              {currentScene === 'insurance' && 'Scene 4: Buy Car Insurance'}
              {currentScene === 'license' && 'Scene 5: Customize Your License'}
              {currentScene === 'complete' && 'Scene 6: Enter Neighborhood'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              {currentScene === 'street' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">Create Your First Home in Troll City</h2>
                    <p className="text-slate-400">Choose a street name, zip, and the number of houses on your block. Your house will be the hero home.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="streetName">Street / Neighborhood Name</Label>
                        <Input id="streetName" value={streetName} onChange={(e) => setStreetName(e.target.value)} placeholder="Neon Lane" />
                      </div>
                      <div>
                        <Label htmlFor="zipCode">Zip Code</Label>
                        <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="12345" />
                      </div>
                      <div>
                        <Label htmlFor="houseCount">Number of Houses</Label>
                        <Input
                          id="houseCount"
                          type="number"
                          value={houseCount}
                          min={1}
                          max={15}
                          onChange={(e) => setHouseCount(Math.max(1, Math.min(15, Number(e.target.value))))}
                          placeholder="5"
                        />
                        <p className="mt-2 text-xs text-slate-500">Max 15 houses. The first house becomes your base.</p>
                      </div>
                    </div>
                    <div className="space-y-4 rounded-3xl border border-slate-700 bg-slate-950/80 p-5">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-200">
                        <MapPin className="w-4 h-4 text-cyan-300" />
                        Street Preview
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-300">
                          <p className="font-semibold text-white">{streetName || 'Troll City Lane'}</p>
                          <p>ZIP {zipCode || '00001'} • {houseCount} houses</p>
                        </div>
                        {streetPreview()}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                      <div className="text-sm text-slate-400">House Type</div>
                      <Select value={houseStyle} onValueChange={setHouseStyle}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="House Style" />
                        </SelectTrigger>
                        <SelectContent>
                          {HOUSE_TYPES.map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                      <div className="text-sm text-slate-400">Door Color</div>
                      <Select value={doorColor} onValueChange={setDoorColor}>
                        <SelectTrigger className="mt-2"><SelectValue placeholder="Door Color" /></SelectTrigger>
                        <SelectContent>
                          {DOOR_COLORS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                      <div className="text-sm text-slate-400">Yard Decoration</div>
                      <Select value={yardDecoration} onValueChange={setYardDecoration}>
                        <SelectTrigger className="mt-2"><SelectValue placeholder="Yard Style" /></SelectTrigger>
                        <SelectContent>
                          {YARD_DECORATIONS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleCreateStreet} disabled={creatingNeighborhood} className="bg-gradient-to-r from-cyan-500 to-blue-600">
                      {creatingNeighborhood ? 'Creating street…' : 'Build My Street'}
                    </Button>
                    <Button variant="secondary" onClick={() => setCurrentScene('car')}>
                      Skip Setup
                    </Button>
                  </div>
                </div>
              )}

              {currentScene === 'car' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">Choose Your Car</h2>
                    <p className="text-slate-400">Pick a starter vehicle and prepare for your first driver challenge.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {CAR_OPTIONS.map((car) => (
                      <button
                        key={car.id}
                        type="button"
                        onClick={() => setSelectedCarId(car.id)}
                        className={`group rounded-3xl border p-5 text-left transition ${selectedCarId === car.id ? 'border-violet-400 bg-violet-950/60 shadow-lg shadow-violet-500/10' : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm uppercase tracking-[0.2em] text-slate-400">{car.tier}</span>
                          <Badge>{car.price} TC</Badge>
                        </div>
                        <div className="mb-3 text-lg font-semibold text-white">{car.name}</div>
                        <p className="text-sm text-slate-400">{car.description}</p>
                        <div className="mt-4 flex items-center gap-3 text-sm text-slate-300">
                          <span>Speed {car.speed}</span>
                          <span>Armor {car.armor}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={handlePurchaseCar} disabled={purchasingCar} className="bg-gradient-to-r from-orange-500 to-red-500">
                      {purchasingCar ? 'Buying ride…' : `Buy ${selectedCar.name}`}
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/ktauto')}>More Cars at Dealership</Button>
                  </div>
                </div>
              )}

              {currentScene === 'driverTest' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">Driver Test</h2>
                    <p className="text-slate-400">Pass the street quiz to activate your license.</p>
                  </div>
                  <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Troll City Driving Rules</h3>
                    <ul className="space-y-3 text-slate-300">
  <li><strong>Active license required:</strong> You must have an active Troll City driver license to drive or start a broadcast.</li>
  <li><strong>No license = suspension:</strong> Driving without a license will suspend your driving status and require a test retake.</li>
  <li><strong>Suspended users cannot broadcast:</strong> A suspended license blocks you from starting broadcasts or using vehicles.</li>
  <li><strong>Seats are still allowed:</strong> Suspended users may still join broadcast seats unless they are banned by moderation rules.</li>
  <li><strong>Insurance is required:</strong> After a driving violation, you must buy insurance before your license can be restored.</li>
  <li><strong>Vehicle damage matters:</strong> Raids, vandalism, and crashes can damage your car. Insurance helps reduce repair costs.</li>
  <li><strong>License plate visibility:</strong> Your plate and driver status may show on your profile, vehicle card, and broadcast box.</li>
</ul>
                  </div>
                  <div className="space-y-4 rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                    {DRIVER_QUESTIONS.map((item, index) => (
                      <div key={index} className="space-y-3">
                        <div className="text-sm font-semibold text-white">{index + 1}. {item.question}</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {item.options.map((option, optionIndex) => (
                            <button
                              key={optionIndex}
                              type="button"
                              onClick={() => handleToggleAnswer(index, optionIndex)}
                              className={`rounded-2xl border p-3 text-left transition ${testAnswers[index] === optionIndex ? 'border-violet-400 bg-violet-950/70 text-white' : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'}`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <Button onClick={handleSubmitDriverTest} disabled={testSubmitted || testAnswers.length !== DRIVER_QUESTIONS.length} className="bg-gradient-to-r from-green-500 to-emerald-500">
                      Submit Test
                    </Button>
                    <Button variant="secondary" onClick={() => {
                      setTestSubmitted(false)
                      setTestAnswers([])
                      setTestResult(null)
                    }}>
                      Reset Answers
                    </Button>
                  </div>
                  {testResult && (
                    <div className={`rounded-3xl border p-4 ${testResult.passed ? 'border-green-500 bg-green-950/50' : 'border-red-500 bg-red-950/50'}`}>
                      <div className="text-lg font-semibold text-white">
                        {testResult.passed ? 'Passed!' : 'Not Passed'} • {testResult.score}/{DRIVER_QUESTIONS.length}
                      </div>
                      <p className="text-slate-300">{testResult.passed ? 'You earned your driver status. Time for insurance.' : 'Study the rules and try again.'}</p>
                    </div>
                  )}
                </div>
              )}

              {currentScene === 'insurance' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">Buy Car Insurance</h2>
                    <p className="text-slate-400">Activate insurance so your ride can survive vandalism and raids.</p>
                  </div>
                  <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                    <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                      <div>
                        <p className="font-semibold text-white">Starter Coverage</p>
                        <p>30 days active coverage with deductible protection.</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white"> 200 TC</div>
                        <div className="text-slate-500">Monthly</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handlePurchaseInsurance} disabled={insuranceBuying} className="bg-gradient-to-r from-yellow-500 to-amber-500">
                      {insuranceBuying ? 'Buying insurance…' : 'Buy Insurance'}
                    </Button>
                    <Button variant="secondary" onClick={() => setCurrentScene('license')}>Skip for now</Button>
                  </div>
                </div>
              )}

              {currentScene === 'license' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">Customize Your License Plate</h2>
                    <p className="text-slate-400">Your plate is your street identity. Use uppercase letters and numbers.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4 rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <Label htmlFor="plateText">License Plate</Label>
                      <Input id="plateText" value={plateText} onChange={(e) => setPlateText(e.target.value.toUpperCase())} placeholder="TROLL123" maxLength={8} />
                      <div className="grid gap-2 text-sm text-slate-400">
                        <p>Allowed: letters and numbers only.</p>
                        <p>Max 8 characters.</p>
                        <p>Current driver status: <span className="text-slate-100">{driverStatus}</span>
                        {driversLicenseExpiry && <span className="text-slate-100"> (Expires: {new Date(driversLicenseExpiry).toLocaleDateString()})</span>}</p>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <div className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Plate Preview</div>
                      <div className="rounded-3xl border border-slate-600 bg-slate-900 p-4 text-center">
                        <div className="text-xl font-bold tracking-[0.3em] text-cyan-300">TROLL CITY</div>
                        <div className="mt-4 text-4xl font-black text-white tracking-[0.5em]">{plateText || 'XXXXXXX'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <Button onClick={handleSavePlate} disabled={updatingPlate} className="bg-gradient-to-r from-cyan-500 to-blue-500">
                      {updatingPlate ? 'Saving…' : 'Save Plate & Finish'}
                    </Button>
                    <Button variant="secondary" onClick={() => setCurrentScene('complete')}>Skip and enter neighborhood</Button>
                  </div>
                </div>
              )}

              {currentScene === 'complete' && (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-6 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
                      <Check className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-semibold text-white">Neighborhood Ready</h2>
                    <p className="mt-3 text-slate-400">{completeMessage || 'Your street is complete. Welcome to the neighborhood!'}</p>
                  </div>

                  {neighborhoodMapPreview()}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <h3 className="font-semibold text-white">Property Summary</h3>
                      <ul className="mt-4 space-y-2 text-sm text-slate-300">
                        <li><span className="text-slate-100">House Type:</span> {selectedHouseConfig.houseType}</li>
                        <li><span className="text-slate-100">Door:</span> {selectedHouseConfig.doorColor}</li>
                        <li><span className="text-slate-100">Trim:</span> {selectedHouseConfig.trimColor}</li>
                        <li><span className="text-slate-100">Windows:</span> {selectedHouseConfig.windowStyle}</li>
                        <li><span className="text-slate-100">Roof:</span> {selectedHouseConfig.roofStyle}</li>
                        <li><span className="text-slate-100">Yard:</span> {selectedHouseConfig.yardDecoration}</li>
                      </ul>
                    </div>
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <h3 className="font-semibold text-white">Final Stats</h3>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between"><span>Street</span><span>{streetName}</span></div>
                        <div className="flex items-center justify-between"><span>ZIP</span><span>{zipCode}</span></div>
                        <div className="flex items-center justify-between"><span>Houses</span><span>{houseCount}</span></div>
                        <div className="flex items-center justify-between"><span>Vehicle</span><span>{selectedCar.name}</span></div>
                        <div className="flex items-center justify-between"><span>License</span><span>{driverStatus}{driversLicenseExpiry ? ` (Expires: ${new Date(driversLicenseExpiry).toLocaleDateString()})` : ''}</span></div>
                        <div className="flex items-center justify-between"><span>Insurance</span><span>{insuranceActive ? 'Active' : 'Pending'}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button onClick={() => navigate('/neighborhood-map')} className="bg-gradient-to-r from-blue-500 to-cyan-500">
                      Explore the Map
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/ktauto')}>Polish Your Ride</Button>
                  </div>
                </div>
              )}
            </div>
            <aside className="space-y-6 rounded-3xl border border-slate-700 bg-slate-950/90 p-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Neighborhood Bonus</span>
                  <Badge>NEW</Badge>
                </div>
                <p className="mt-3 text-slate-400">Complete the onboarding to unlock a street map, family slots, driver status, and house upgrades.</p>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="text-sm uppercase tracking-[0.24em] text-slate-500">Your House Build</div>
                <div className="grid gap-2">
                  <Badge variant="secondary">{HOUSE_TYPES.find((item) => item.id === houseStyle)?.label}</Badge>
                  <Badge variant="secondary">Door {DOOR_COLORS.find((item) => item.id === doorColor)?.label}</Badge>
                  <Badge variant="secondary">Roof {ROOF_STYLES.find((item) => item.id === roofStyle)?.label}</Badge>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                  <span>Driver Status</span>
                </div>
                <div className="text-white text-2xl font-semibold">{driverStatus}</div>
                <div className="text-slate-400 text-sm">Your license is the key to safe car upgrades and future raids.</div>
              </div>
            </aside>
          </CardContent>
        </Card>
      </div>

      {/* Scene Transition Celebration Overlay */}
      {showSceneCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative text-center">
            {/* Animated background sparkles */}
            <div className="absolute inset-0 -z-10">
              {[...Array(20)].map((_, i) => (
                <Sparkles
                  key={i}
                  className="absolute animate-pulse text-yellow-400"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${1 + Math.random() * 2}s`
                  }}
                  size={16 + Math.random() * 16}
                />
              ))}
            </div>

            {/* Main celebration content */}
            <div className="rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-8 shadow-2xl">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <Trophy className="h-16 w-16 text-yellow-400 animate-bounce" />
                  <Zap className="absolute -top-2 -right-2 h-6 w-6 text-orange-400 animate-pulse" />
                  <Star className="absolute -bottom-1 -left-1 h-5 w-5 text-yellow-300 animate-spin" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Level Up!</h3>
              <p className="text-yellow-200 text-lg">{celebrationMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scene transition loading overlay */}
      {sceneTransitioning && !showSceneCelebration && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent mx-auto"></div>
            <p className="text-cyan-300 text-lg">Transitioning to next scene...</p>
          </div>
        </div>
      )}
    </div>
  )
}

