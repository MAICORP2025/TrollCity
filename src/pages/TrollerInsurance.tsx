import React, { useState, useEffect, useCallback } from 'react'
import { Shield, Clock, Zap, Crown } from 'lucide-react'
import { supabase, UserProfile } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { deductCoins } from '../lib/coinTransactions'

interface InsurancePackage {
  id: string
  name: string
  cost: number
  duration_hours: number
  description: string
  protection_type: 'kick' | 'full' | 'bankrupt'
  icon?: React.ReactNode
  color?: string
  popular?: boolean
}

const TrollerInsurance = () => {
  const { profile } = useAuthStore()
  const [activeInsurance, setActiveInsurance] = useState<any>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [packages, setPackages] = useState<InsurancePackage[]>([])

  const loadInsuranceOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('insurance_options')
        .select('*')
        .eq('is_active', true)
        .order('cost', { ascending: true })

      if (error) throw error

      if (data) {
        const mappedPackages: InsurancePackage[] = data.map((pkg: any) => {
          let icon = <Shield className="w-6 h-6" />
          let color = '#22c55e' // basic green

          if (pkg.protection_type === 'full') {
            icon = <Crown className="w-6 h-6" />
            color = '#ffd700' // gold
          } else if (pkg.cost > 1000) {
            icon = <Zap className="w-6 h-6" />
            color = '#c0c0c0' // silver
          } else if (pkg.protection_type === 'kick') {
            icon = <Shield className="w-6 h-6" />
            color = pkg.duration_hours > 24 ? '#cd7f32' : '#22c55e'
          }

          return {
            ...pkg,
            icon,
            color,
            popular: pkg.duration_hours === 24 && pkg.protection_type === 'full'
          }
        })
        setPackages(mappedPackages)
      }
    } catch (err) {
      console.error('Error loading insurance options:', err)
      toast.error('Failed to load insurance packages')
    }
  }, [])

  const loadInsuranceStatus = useCallback(async () => {
    if (!profile) return

    try {
      // Check user_insurances table first (new system)
      const { data: activePolicy } = await supabase
        .from('user_insurances')
        .select('*, insurance_options(name, duration_hours)')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .single()

      if (activePolicy) {
        setActiveInsurance({
          expires_at: activePolicy.expires_at,
          type: activePolicy.insurance_id,
          name: activePolicy.insurance_options?.name
        })
      } else if (profile.insurance_expires_at) {
        // Fallback to legacy profile fields
        const expiresAt = new Date(profile.insurance_expires_at)
        if (expiresAt > new Date()) {
          setActiveInsurance({
            expires_at: profile.insurance_expires_at,
            type: (profile as any).insurance_type || profile.insurance_level || 'basic',
            name: 'Legacy Insurance'
          })
        }
      }
    } catch {
      toast.error('Failed to load insurance status')
    }
  }, [profile])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadInsuranceOptions(), loadInsuranceStatus()])
      setLoading(false)
    }
    init()
  }, [loadInsuranceOptions, loadInsuranceStatus])

  const purchaseInsurance = async (package_: InsurancePackage) => {
    if (!profile) return

    if ((profile.troll_coins || 0) < package_.cost) {
      toast.error('Not enough troll coins! Visit the Coin Store.')
      return
    }

    try {
      setPurchasing(package_.id)

      // Calculate expiry time
      const newExpiry = new Date()
      newExpiry.setHours(newExpiry.getHours() + package_.duration_hours)

      let finalExpiry = newExpiry
      // Extend existing insurance if active
      if (activeInsurance && activeInsurance.expires_at) {
        const currentExpiry = new Date(activeInsurance.expires_at)
        if (currentExpiry > new Date()) {
          finalExpiry = new Date(currentExpiry.getTime() + package_.duration_hours * 60 * 60 * 1000)
        }
      }

      // Deduct coins
      const result = await deductCoins({
        userId: profile.id,
        amount: package_.cost,
        type: 'insurance_purchase',
        description: `Purchased ${package_.name}`,
        metadata: {
          insurance_id: package_.id,
          insurance_name: package_.name,
          duration: package_.duration_hours,
          protection_type: package_.protection_type
        }
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to deduct coins')
        return
      }

      // Save to user_insurances table
      const { error: insuranceError } = await supabase
        .from('user_insurances')
        .insert({
          user_id: profile.id,
          insurance_id: package_.id, // Use actual DB ID
          purchased_at: new Date().toISOString(),
          expires_at: finalExpiry.toISOString(),
          is_active: true,
          protection_type: package_.protection_type,
          metadata: {
            package_name: package_.name,
            duration_hours: package_.duration_hours,
            price: package_.cost
          }
        })

      if (insuranceError) throw insuranceError

      // Update legacy profile fields for backward compatibility
      await supabase
        .from('user_profiles')
        .update({
          insurance_expires_at: finalExpiry.toISOString(),
          insurance_type: package_.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      // Refresh profile
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', profile.id)
        .single()

      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as UserProfile)
        setActiveInsurance({
          expires_at: finalExpiry.toISOString(),
          type: package_.id,
          name: package_.name
        })
      }

      toast.success(`Successfully purchased ${package_.name}!`)
    } catch (error: any) {
      console.error('Purchase error:', error)
      toast.error('Failed to purchase insurance: ' + (error.message || 'Unknown error'))
    } finally {
      setPurchasing(null)
    }
  }

  const formatTimeRemaining = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - new Date().getTime()
    if (diff <= 0) return 'Expired'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  if (loading) {
    return <div className="p-8 text-center text-troll-gold text-xl">Loading insurance data...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto text-white">
      {/* Banner */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-troll-green-neon mb-4">Troller Insurance</h1>
        <p className="text-troll-purple-300 text-lg mb-4">
          Protect yourself from kicks, bans, and consequences.
        </p>
      </div>

      {/* Active Insurance */}
      {activeInsurance && (
        <div className="bg-troll-green/20 border border-troll-green rounded-lg p-6 mb-6 flex justify-between">
          <div className="flex items-center space-x-3">
            <Shield />
            <div>
              <p className="font-semibold">Insurance Active: {activeInsurance.name}</p>
              <p>{formatTimeRemaining(activeInsurance.expires_at)}</p>
            </div>
          </div>
          <Clock className="w-6 h-6" />
        </div>
      )}

      {/* Packages */}
      {packages.length === 0 ? (
        <div className="text-center text-gray-400 py-10">No insurance packages available at the moment.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-troll-purple-dark border-2 rounded-lg p-6 ${
                pkg.popular ? 'border-troll-gold scale-105' : 'border-troll-purple'
              }`}>
              <div className="text-center mb-6">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white"
                  style={{ backgroundColor: pkg.color }}>
                  {pkg.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
                <div className="text-3xl font-bold text-troll-gold mb-2">{pkg.cost} Coins</div>
                <div>{pkg.duration_hours} Hour(s)</div>
                <p className="text-sm text-gray-400 mt-2">{pkg.description}</p>
              </div>
              <button
                onClick={() => purchaseInsurance(pkg)}
                disabled={purchasing === pkg.id}
                className="w-full bg-troll-green text-troll-purple-900 py-2 rounded-lg font-semibold disabled:opacity-50">
                {purchasing === pkg.id ? 'Purchasing…' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TrollerInsurance
