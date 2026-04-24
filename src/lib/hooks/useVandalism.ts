import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { toast } from 'sonner'

interface VandalismIncident {
  id: string
  vehicle_id: string
  vandalized_by_user_id: string
  damage_type: 'scratch' | 'flat_tires' | 'broken_windows' | 'stolen_parts'
  damage_level: number // 1-100
  created_at: string
  repaired_at: string | null
}

export function useVandalism(vehicleId: string | null) {
  const { user, profile } = useAuthStore()
  const [incidents, setIncidents] = useState<VandalismIncident[]>([])
  const [loading, setLoading] = useState(false)

  const fetchIncidents = useCallback(async () => {
    if (!vehicleId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vehicle_vandalism')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setIncidents(data || [])
    } catch (error) {
      console.error('Error fetching vandalism:', error)
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  const vandalizeVehicle = async (
    targetVehicleId: string,
    targetUserId: string,
    damageType: VandalismIncident['damage_type'] = 'scratch'
  ) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    // Check if the current user is staff (admin, officer, etc.) - staff cannot vandalize
    const isStaff = profile?.is_admin || profile?.is_troll_officer || 
      profile?.role === 'admin' || profile?.role === 'lead_troll_officer' ||
      profile?.role === 'ceo' || profile?.role === 'secretary'

    if (isStaff) {
      return { success: false, error: 'Staff cannot vandalize vehicles' }
    }

    try {
      const damageLevel = damageType === 'scratch' ? 20 : 
                        damageType === 'flat_tires' ? 30 : 
                        damageType === 'broken_windows' ? 50 : 40

      const { error } = await supabase
        .from('vehicle_vandalism')
        .insert({
          vehicle_id: targetVehicleId,
          vandalized_by_user_id: user.id,
          damage_type: damageType,
          damage_level: damageLevel,
          created_at: new Date().toISOString()
        })

      if (error) throw error

      // Record the incident for the victim
      await supabase.from('user_reports').insert({
        reporter_id: targetUserId,
        reported_id: user.id,
        reason: `Vandalism: ${damageType}`,
        created_at: new Date().toISOString()
      })

      toast.success('Vehicle vandalized! User has been reported.')
      await fetchIncidents()
      return { success: true }
    } catch (error: any) {
      console.error('Error vandalizing:', error)
      return { success: false, error: error.message }
    }
  }

  const repairVehicle = async () => {
    if (!vehicleId) return { success: false, error: 'No vehicle' }

    try {
      await supabase
        .from('vehicle_vandalism')
        .update({ repaired_at: new Date().toISOString() })
        .eq('vehicle_id', vehicleId)
        .is('repaired_at', null)

      await fetchIncidents()
      return { success: true }
    } catch (error: any) {
      console.error('Error repairing:', error)
      return { success: false, error: error.message }
    }
  }

  const hasUnrepairedDamage = incidents.some(i => !i.repaired_at)
  const totalDamage = incidents.reduce((sum, i) => sum + (i.repaired_at ? 0 : i.damage_level), 0)

  return {
    incidents,
    loading,
    hasUnrepairedDamage,
    totalDamage,
    vandalizeVehicle,
    repairVehicle,
    fetchIncidents
  }
}