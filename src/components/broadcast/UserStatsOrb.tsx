import React, { useState, useEffect, useCallback } from 'react'
import { Car, Shield, ShieldCheck, Home, DollarSign, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { isStaffProfile } from '../../lib/staff'
import UserStatsModal from './UserStatsModal'

interface UserStatsOrbProps {
  userId: string
  username?: string
  trollCoins?: number
  trollmonds?: number
  licensePlate?: string | null
  streamId?: string
  isSeatUser?: boolean
  className?: string
}

interface UserStatsData {
  licenseStatus: 'active' | 'suspended' | 'none'
  insuranceStatus: 'active' | 'expired' | 'suspended' | 'none'
  hasHouse: boolean
  houseCondition?: number
  cashValue: number
  isSuspended?: boolean
  suspensionType?: string
}

export default function UserStatsOrb({
  userId,
  username = '',
  trollCoins = 0,
  trollmonds = 0,
  licensePlate,
  streamId,
  isSeatUser = false,
  className = '',
}: UserStatsOrbProps) {
  const { profile: currentProfile } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState<UserStatsData>({
    licenseStatus: 'none',
    insuranceStatus: 'none',
    hasHouse: false,
    cashValue: 0,
  })
  const [loading, setLoading] = useState(true)

  const isStaff = isStaffProfile(currentProfile)

  const fetchStats = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)

      // Fetch license status
      const { data: licenseData } = await supabase
        .from('user_licenses')
        .select('status, suspended_until, expires_at')
        .eq('user_id', userId)
        .maybeSingle()

      let licenseStatus: 'active' | 'suspended' | 'none' = 'none'
      if (licenseData) {
        if (licenseData.status === 'suspended' || 
            (licenseData.suspended_until && new Date(licenseData.suspended_until) > new Date())) {
          licenseStatus = 'suspended'
        } else if (licenseData.status === 'active' && licenseData.expires_at && new Date(licenseData.expires_at) > new Date()) {
          licenseStatus = 'active'
        }
      }

      // Fetch insurance status
      const [{ data: homeownersData }, { data: carData }, { data: broadcastData }] = await Promise.all([
        supabase.from('homeowners_insurances').select('expires_at').eq('user_id', userId).maybeSingle(),
        supabase.from('car_insurances').select('expires_at').eq('user_id', userId).maybeSingle(),
        supabase.from('broadcast_insurances').select('expires_at, coverage_type').eq('user_id', userId).maybeSingle(),
      ])

      let insuranceStatus: 'active' | 'expired' | 'suspended' | 'none' = 'none'
      const now = new Date()
      
      if (homeownersData?.expires_at && new Date(homeownersData.expires_at) > now) {
        insuranceStatus = 'active'
      } else if (carData?.expires_at && new Date(carData.expires_at) > now) {
        insuranceStatus = 'active'
      } else if (broadcastData?.expires_at && new Date(broadcastData.expires_at) > now) {
        insuranceStatus = 'active'
      } else if (homeownersData || carData || broadcastData) {
        insuranceStatus = 'expired'
      }

      // Check for house
      const { data: houseData } = await supabase
        .from('houses')
        .select('id, condition')
        .eq('owner_user_id', userId)
        .maybeSingle()

      // Check for suspension/jail status
      const { data: jailData } = await supabase
        .from('jail')
        .select('id, release_time')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let isSuspended = false
      let suspensionType = ''
      
      if (licenseStatus === 'suspended') {
        isSuspended = true
        suspensionType = 'license'
      } else if (jailData && new Date(jailData.release_time) > new Date()) {
        isSuspended = true
        suspensionType = 'jail'
      }

      // Get cash value (use coins passed in or fetch from profile)
      let cashValue = trollCoins || 0
      if (cashValue === 0) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('troll_coins')
          .eq('id', userId)
          .maybeSingle()
        cashValue = profileData?.troll_coins || 0
      }

      setStats({
        licenseStatus,
        insuranceStatus,
        hasHouse: !!houseData,
        houseCondition: houseData?.condition,
        cashValue,
        isSuspended,
        suspensionType: suspensionType || undefined,
      })
    } catch (error) {
      console.error('[UserStatsOrb] Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, trollCoins, currentProfile])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const formatCashValue = (coins: number): string => {
    const dollars = coins / 100
    if (dollars >= 1000) {
      return `$${(dollars / 1000).toFixed(1)}k`
    } else if (dollars >= 1) {
      return `$${dollars.toFixed(2)}`
    }
    return `${coins} coins`
  }

  const getLicenseIcon = () => {
    switch (stats.licenseStatus) {
      case 'active':
        return <Car className="h-3 w-3 text-green-400" />
      case 'suspended':
        return <Car className="h-3 w-3 text-red-400" />
      default:
        return <Car className="h-3 w-3 text-gray-500" />
    }
  }

  const getInsuranceIcon = () => {
    switch (stats.insuranceStatus) {
      case 'active':
        return <ShieldCheck className="h-3 w-3 text-green-400" />
      case 'expired':
        return <Shield className="h-3 w-3 text-yellow-400" />
      case 'suspended':
        return <Shield className="h-3 w-3 text-red-400" />
      default:
        return <Shield className="h-3 w-3 text-gray-500" />
    }
  }

  const handleClick = () => {
    if (isStaff) {
      setIsOpen(true)
    }
  }

  if (loading) {
    return (
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 ${className}`}
      >
        <div className="h-3 w-3 animate-spin rounded-full border border-purple-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md ${
          isStaff ? 'cursor-pointer hover:bg-black/70' : 'cursor-default'
        } border border-cyan-400/30 shadow-[0_0_12px_rgba(45,212,191,0.2)] transition-colors ${className}`}
        onClick={handleClick}
        title={isStaff ? 'View user stats' : undefined}
      >
        {/* License status */}
        <div className="flex items-center" title={`License: ${stats.licenseStatus}`}>
          {getLicenseIcon()}
        </div>

        {/* Insurance status */}
        <div className="flex items-center" title={`Insurance: ${stats.insuranceStatus}`}>
          {getInsuranceIcon()}
        </div>

        {/* House icon */}
        {stats.hasHouse && (
          <div className="flex items-center" title={`House: ${stats.houseCondition ?? 0}% condition`}>
            <Home className="h-3 w-3 text-blue-400" />
          </div>
        )}

        {/* Cash value */}
        <div className="flex items-center text-[10px] font-bold text-white" title={`${stats.cashValue} Troll Coins`}>
          <DollarSign className="h-2.5 w-2.5 text-yellow-400" />
          {formatCashValue(stats.cashValue)}
        </div>

        {/* Suspension indicator */}
        {stats.isSuspended && isStaff && (
          <div className="flex items-center" title={`Status: ${stats.suspensionType || 'suspended'}`}>
            <AlertTriangle className="h-3 w-3 text-red-400" />
          </div>
        )}
      </div>

      {/* UserStatsModal for staff */}
      {isStaff && (
        <UserStatsModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          userId={userId}
          username={username}
          trollCoins={trollCoins}
          trollmonds={trollmonds}
          licensePlate={licensePlate}
          streamId={streamId}
          isSeatUser={isSeatUser}
        />
      )}
    </>
  )
}