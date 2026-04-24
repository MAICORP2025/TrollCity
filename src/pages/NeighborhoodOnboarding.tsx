import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Car, User, Users, ArrowRight, Check, Lock, Sparkles, Gift, Building2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { useNeighborhood } from '../lib/hooks/useNeighborhood'
import { useVehicleSystem } from '../lib/hooks/useVehicleSystem'
import AvatarCreator from '../components/avatar/AvatarCreator'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

type OnboardingStep = 'welcome' | 'property' | 'car' | 'avatar' | 'create' | 'invite' | 'complete'

interface StepData {
  id: OnboardingStep
  title: string
  description: string
  icon: React.ReactNode
  completed: boolean
  locked?: boolean
}

export default function NeighborhoodOnboarding() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { neighborhood, createNeighborhood, inviteFollower } = useNeighborhood()
  const { activeVehicle, loading: vehicleLoading } = useVehicleSystem()
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [loading, setLoading] = useState(true)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviting, setInviting] = useState(false)
  const [neighborhoodName, setNeighborhoodName] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [creatingHouse, setCreatingHouse] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Check what user has completed
      const hasProperty = profile?.house_id
      const hasCar = profile?.vehicle_id
      const hasAvatar = profile?.troll_avatar_url
      const hasNeighborhood = profile?.neighborhood_id

      if (hasNeighborhood) {
        setCurrentStep('complete')
      } else if (hasProperty && hasCar && hasAvatar) {
        setCurrentStep('create')
      } else if (hasProperty && hasCar) {
        setCurrentStep('avatar')
      } else if (hasProperty) {
        setCurrentStep('car')
      } else {
        setCurrentStep('property')
      }
    } catch (error) {
      console.error('Error checking status:', error)
    } finally {
      setLoading(false)
    }
  }

  const createStarterHouse = async () => {
    if (!user?.id) return

    setCreatingHouse(true)
    try {
      // Create a free starter house for the user
      const { data: house, error: houseError } = await supabase
        .from('houses')
        .insert({
          owner_user_id: user.id,
          upgrade_level: 1,
          condition: 100,
          is_reposessed: false,
          electric_on: false,
          water_on: false,
          internet_on: false
        })
        .select()
        .single()

      if (houseError) throw houseError

      // Update user profile with house_id
      await supabase
        .from('user_profiles')
        .update({
          house_id: house.id
        })
        .eq('id', user.id)

      toast.success('Welcome to your new home!')
      setCurrentStep('car')
    } catch (error: any) {
      console.error('Error creating starter house:', error)
      toast.error(error.message || 'Failed to create starter house')
    } finally {
      setCreatingHouse(false)
    }
  }

  const handleCreateNeighborhood = async () => {
    if (!neighborhoodName || !zipCode) {
      toast.error('Please enter neighborhood name and zip code')
      return
    }

    setCreating(true)
    try {
      const result = await createNeighborhood(neighborhoodName, zipCode)
      if (result.success) {
        toast.success('Neighborhood created!')
        setCurrentStep('invite')
      } else {
        toast.error(result.error || 'Failed to create neighborhood')
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCreating(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteUsername) {
      toast.error('Please enter a username to invite')
      return
    }

    setInviting(true)
    try {
      const result = await inviteFollower(inviteUsername)
      if (result.success) {
        toast.success(`Invited @${inviteUsername}!`)
        setInviteUsername('')
      } else {
        toast.error(result.error || 'Failed to invite')
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setInviting(false)
    }
  }

  const steps: StepData[] = [
    { id: 'property', title: 'Buy Property', description: 'Get your starter home', icon: <Home className="w-6 h-6" />, completed: !!profile?.house_id },
    { id: 'car', title: 'Buy a Car', description: 'Choose your ride', icon: <Car className="w-6 h-6" />, completed: !!profile?.vehicle_id },
    { id: 'avatar', title: 'Create Troll', description: 'Design your avatar', icon: <User className="w-6 h-6" />, completed: !!profile?.troll_avatar_url },
    { id: 'create', title: 'Create Neighborhood', description: 'Start your community', icon: <Building2 className="w-6 h-6" />, completed: !!profile?.neighborhood_id },
    { id: 'invite', title: 'Invite Followers', description: 'Grow your neighborhood', icon: <Users className="w-6 h-6" />, completed: false }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  if (loading || vehicleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  // Complete state - user already has neighborhood
  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to Your Neighborhood!</h1>
            <p className="text-gray-400">You are all set up. Time to invite followers!</p>
          </div>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={() => navigate('/neighbors')}
                  className="h-20 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                >
                  <Users className="w-6 h-6 mr-2" />
                  View Neighborhood
                </Button>
                <Button 
                  onClick={() => navigate('/living')}
                  className="h-20 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <Home className="w-6 h-6 mr-2" />
                  My House
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Welcome/Step Selection Screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-6">
          <Sparkles className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Troll City!</h1>
          <p className="text-gray-400">Set up your neighborhood to start your journey</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step.completed 
                      ? 'bg-green-500 text-white' 
                      : index === currentStepIndex
                        ? 'bg-purple-500 text-white animate-pulse'
                        : 'bg-slate-700 text-slate-500'
                  }`}
                >
                  {step.completed ? <Check className="w-5 h-5" /> : step.icon}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 ${step.completed ? 'bg-green-500' : 'bg-slate-700'}`} />
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Current Step Content */}
        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="p-6">
            {/* Property Step */}
            {currentStep === 'property' && (
              <div className="text-center">
                <Home className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Step 1: Get Your Starter Home</h2>
                <p className="text-gray-400 mb-6">Every troll needs a home. We'll set you up with a free starter house!</p>
                <Button
                  onClick={() => {
                    // Create a free starter house for the user
                    createStarterHouse()
                  }}
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                  disabled={creatingHouse}
                >
                  {creatingHouse ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Creating Your Home...
                    </>
                  ) : (
                    <>
                      <Home className="w-5 h-5 mr-2" />
                      Get My Free House
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Car Step */}
            {currentStep === 'car' && (
              <div className="text-center">
                <Car className="w-16 h-16 text-orange-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Step 2: Get a Car</h2>
                <p className="text-gray-400 mb-6">Choose your ride from the dealership!</p>
                <Button 
                  onClick={() => navigate('/ktauto')}
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Go to Car Dealership
                </Button>
              </div>
            )}

            {/* Avatar Step */}
            {currentStep === 'avatar' && (
              <div className="text-center">
                <User className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Step 3: Create Your Troll</h2>
                <p className="text-gray-400 mb-6">Design your troll avatar for broadcast!</p>
                <div className="max-w-md mx-auto">
                  <AvatarCreator 
                    onComplete={() => setCurrentStep('create')} 
                  />
                </div>
              </div>
            )}

            {/* Create Neighborhood Step */}
            {currentStep === 'create' && (
              <div className="text-center">
                <Building2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Step 4: Create Neighborhood</h2>
                <p className="text-gray-400 mb-6">Start your own neighborhood community!</p>
                
                <div className="max-w-md mx-auto space-y-4">
                  <input
                    type="text"
                    placeholder="Neighborhood Name"
                    value={neighborhoodName}
                    onChange={(e) => setNeighborhoodName(e.target.value)}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Zip Code"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400"
                  />
                  <Button 
                    onClick={handleCreateNeighborhood}
                    disabled={creating || !neighborhoodName || !zipCode}
                    size="lg"
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    {creating ? 'Creating...' : 'Create Neighborhood'}
                  </Button>
                </div>
              </div>
            )}

            {/* Invite Step */}
            {currentStep === 'invite' && (
              <div className="text-center">
                <Users className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Invite Your Followers</h2>
                <p className="text-gray-400 mb-6">Invite your followers to join your neighborhood!</p>
                
                <div className="max-w-md mx-auto space-y-4">
                  <input
                    type="text"
                    placeholder="Username to invite"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400"
                  />
                  <Button 
                    onClick={handleInvite}
                    disabled={inviting || !inviteUsername}
                    size="lg"
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                  >
                    {inviting ? 'Inviting...' : 'Send Invite'}
                  </Button>
                  
                  <div className="pt-4">
                    <Button 
                      onClick={() => navigate('/neighbors')}
                      variant="outline"
                      size="lg"
                      className="w-full"
                    >
                      Skip & Go to Neighborhood
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requirements Reminder */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>Credit Score Required: 400 (base score)</p>
          <p>Free house provided upon neighborhood creation</p>
        </div>
      </div>
    </div>
  )
}