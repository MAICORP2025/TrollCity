import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Shield, Home, Car, Radio, Zap, X, Check, 
  Clock, DollarSign, FileText, Users, AlertTriangle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

const INSURANCE_TYPES = [
  { 
    id: 'homeowners', 
    name: 'Homeowners Insurance', 
    icon: Home, 
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    description: 'Protects your house from raids & damage',
    plans: [
      { id: 'home_basic', name: 'Basic Week', cost: 500, duration: 168, deductible: 25 },
      { id: 'home_month', name: 'Premium Month', cost: 1500, duration: 720, deductible: 25 }
    ]
  },
  { 
    id: 'car', 
    name: 'Car Insurance', 
    icon: Car, 
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    description: 'Protects your vehicle from vandalism',
    plans: [
      { id: 'car_basic', name: 'Basic Week', cost: 400, duration: 168, deductible: 50 },
      { id: 'car_month', name: 'Premium Month', cost: 1200, duration: 720, deductible: 50 }
    ]
  },
  { 
    id: 'broadcast', 
    name: 'Broadcast Insurance', 
    icon: Radio, 
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    description: 'Protects during live broadcasts',
    plans: [
      { id: 'broadcast_week', name: 'Weekly', cost: 800, duration: 168 },
      { id: 'broadcast_month', name: 'Monthly', cost: 2500, duration: 720 }
    ]
  },
  { 
    id: 'kick', 
    name: 'Kick Insurance', 
    icon: Zap, 
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    description: 'Prevents kicks during broadcast',
    plans: [
      { id: 'kick_week', name: 'Weekly', cost: 500, duration: 168 },
      { id: 'kick_month', name: 'Monthly', cost: 1500, duration: 720 }
    ]
  },
  { 
    id: 'ban', 
    name: 'Ban Insurance', 
    icon: Shield, 
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    description: 'Prevents bans during broadcast',
    plans: [
      { id: 'ban_week', name: 'Weekly', cost: 1000, duration: 168 },
      { id: 'ban_month', name: 'Monthly', cost: 3000, duration: 720 }
    ]
  }
]

export default function InsurancePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [isBroker, setIsBroker] = useState(false)

  // Check if user is already an insurance broker
  const checkBrokerStatus = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const { data, error } = await supabase
        .from('insurance_broker_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (!error && data) {
        setIsBroker(data.status === 'approved')
      }
    } catch (error) {
      console.error('Error checking broker status:', error)
    }
  }, [user?.id])

  // Register user as insurance broker when they purchase insurance
  const registerAsInsuranceBroker = useCallback(async () => {
    if (!user?.id) return
    
    try {
      // Check if already applied or approved
      const { data: existingApp, error: checkError } = await supabase
        .from('insurance_broker_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (checkError) throw checkError
      
      // If not exists or not approved, create/approve application
      if (!existingApp || existingApp.status !== 'approved') {
        const { error: upsertError } = await supabase
          .from('insurance_broker_applications')
          .upsert({
            user_id: user.id,
            status: 'approved',
            experience: 'Automatically approved upon insurance purchase',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })
        
        if (upsertError) throw upsertError
        
        setIsBroker(true)
        toast.success('You are now a registered insurance broker!')
      }
    } catch (error: any) {
      console.error('Error registering as broker:', error)
      // Don't show error to user as insurance purchase was successful
    }
  }, [user?.id])

  // Check broker status on load
  useEffect(() => {
    checkBrokerStatus()
  }, [checkBrokerStatus])

  const handlePurchase = async (type: string, planId: string) => {
    if (!user?.id) return

    try {
      let result = { success: false }
      
      switch (type) {
        case 'homeowners':
          result = await purchaseHomeownersInsurance(planId)
          break
        case 'car':
          result = await purchaseCarInsurance(planId)
          break
        case 'broadcast':
          result = await purchaseBroadcastInsurance(planId)
          break
        default:
          toast.error('Invalid insurance type')
      }

      if (result.success) {
        toast.success('Insurance purchased!')
        
        // Automatically register user as insurance broker when they purchase insurance
        await registerAsInsuranceBroker()
      } else {
        toast.error(result.error || 'Purchase failed')
      }
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const isExpired = (expiry: string | null | undefined) => {
    if (!expiry) return true
    return new Date(expiry) < new Date()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
           <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-400" />
                Insurance Center
              </h1>
              <p className="text-gray-400">Protect your assets & broadcasts</p>
            </div>
         </div>

         {/* Active Insurance */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
           <Card className={`bg-slate-800 ${!isExpired(profile?.homeowners_insurance_expiry) ? 'border-green-500' : 'border-slate-700'}`}>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <Home className={`w-8 h-8 ${!isExpired(profile?.homeowners_insurance_expiry) ? 'text-green-400' : 'text-gray-500'}`} />
                 <div>
                   <p className="text-white font-medium">Homeowners</p>
                   <p className="text-sm text-gray-400">
                     {isExpired(profile?.homeowners_insurance_expiry) 
                       ? 'Not active' 
                       : `Expires ${new Date(profile?.homeowners_insurance_expiry).toLocaleDateString()}`}
                   </p>
                 </div>
               </div>
             </CardContent>
           </Card>

           <Card className={`bg-slate-800 ${!isExpired(profile?.car_insurance_expiry) ? 'border-green-500' : 'border-slate-700'}`}>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <Car className={`w-8 h-8 ${!isExpired(profile?.car_insurance_expiry) ? 'text-green-400' : 'text-gray-500'}`} />
                 <div>
                   <p className="text-white font-medium">Car</p>
                   <p className="text-sm text-gray-400">
                     {isExpired(profile?.car_insurance_expiry) 
                       ? 'Not active' 
                       : `Expires ${new Date(profile?.car_insurance_expiry).toLocaleDateString()}`}
                   </p>
                 </div>
               </div>
             </CardContent>
           </Card>

           <Card className={`bg-slate-800 border-slate-700`}>
             <CardContent className="p-4">
               <div className="flex items-center gap-3">
                 <Radio className={`w-8 h-8 text-gray-500`} />
                 <div>
                   <p className="text-white font-medium">Broadcast</p>
                   <p className="text-sm text-gray-400">
                     Not active
                   </p>
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>

         {/* Insurance Options */}
         <div className="space-y-6">
           {INSURANCE_TYPES.map(type => (
             <Card key={type.id} className="bg-slate-800 border-slate-700">
               <CardHeader>
                 <CardTitle className={`flex items-center gap-2 ${type.color}`}>
                   <type.icon className="w-5 h-5" />
                   {type.name}
                 </CardTitle>
                 <p className="text-gray-400 text-sm">{type.description}</p>
               </CardHeader>
               <CardContent>
                 <div className="grid grid-cols-2 gap-4">
                    {type.plans.map(plan => (
                      <div 
                        key={plan.id}
                        className={`p-4 rounded-lg ${type.bg} border border-slate-600`}
                      >
                        <p className="text-white font-medium">{plan.name}</p>
                        <p className="text-yellow-400 font-bold text-xl">{plan.cost} TC</p>
                        <p className="text-gray-400 text-xs">
                          {Math.round(plan.duration / 24)} days
                        </p>
                      </div>
                    ))}
                 </div>
               </CardContent>
             </Card>
           ))}
          </div>
      </div>
    </div>
  )
}