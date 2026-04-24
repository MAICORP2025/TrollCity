import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { deductCoins, recordCoinTransaction } from './coinTransactions'
import type { Vehicle, VehicleLoan, DriverTest, UserLicense } from '../../types/neighborhood'

const LOAN_AMOUNT = 10000 // 10k troll coins
const MONTHLY_PAYMENT = 500 // Monthly payment amount

export function useVehicleSystem() {
  const { user, profile } = useAuthStore()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchVehicles = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVehicles(data || [])

      // Set active vehicle
      if (data && data.length > 0) {
        const active = data.find(v => v.id === profile?.active_vehicle) || data[0]
        setActiveVehicle(active)
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.active_vehicle])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  const purchaseVehicle = async (vehicleName: string, make: string, model: string, year: number, price: number, withLoan: boolean = false) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    try {
      let finalPrice = price

      if (withLoan) {
        finalPrice = 0 // Finance the full amount
        const { error: loanError } = await supabase
          .from('vehicle_loans')
          .insert({
            vehicle_id: '', // Will update after vehicle creation
            total_amount: LOAN_AMOUNT,
            remaining_amount: LOAN_AMOUNT,
            monthly_payment: MONTHLY_PAYMENT,
            is_default: false,
            cashout_hold_until: null
          })

        if (loanError) throw loanError
      }

      // Generate license plate
      const generateLicensePlate = () => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const numbers = '0123456789'
        const letter1 = letters[Math.floor(Math.random() * letters.length)]
        const letter2 = letters[Math.floor(Math.random() * letters.length)]
        const letter3 = letters[Math.floor(Math.random() * letters.length)]
        const num1 = numbers[Math.floor(Math.random() * numbers.length)]
        const num2 = numbers[Math.floor(Math.random() * numbers.length)]
        const num3 = numbers[Math.floor(Math.random() * numbers.length)]
        return `${letter1}${letter2}${letter3}${num1}${num2}${num3}`
      }

      const licensePlate = generateLicensePlate()

      // Create vehicle
      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .insert({
          owner_user_id: user.id,
          vehicle_name: vehicleName,
          make,
          model,
          year,
          plate_number: licensePlate,
          plate_status: 'active'
        })
        .select()
        .single()

      if (error) throw error

      // Update user profile with vehicle and license plate
      await supabase
        .from('user_profiles')
        .update({
          vehicle_id: vehicle.id,
          license_plate: licensePlate
        })
        .eq('id', user.id)

      await fetchVehicles()
      return { success: true, vehicle }
    } catch (error: any) {
      console.error('Error purchasing vehicle:', error)
      return { success: false, error: error.message }
    }
  }

  const updatePlate = async (plateText: string) => {
    if (!user?.id || !activeVehicle) return { success: false, error: 'No vehicle' }

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ 
          plate_number: plateText.toUpperCase(),
          plate_status: 'active'
        })
        .eq('id', activeVehicle.id)

      if (error) throw error

      // Update profile display
      await supabase
        .from('user_profiles')
        .update({ license_plate: plateText.toUpperCase() })
        .eq('id', user.id)

      await fetchVehicles()
      return { success: true }
    } catch (error: any) {
      console.error('Error updating plate:', error)
      return { success: false, error: error.message }
    }
  }

  const getActiveLoan = async (vehicleId: string): Promise<VehicleLoan | null> => {
    try {
      const { data, error } = await supabase
        .from('vehicle_loans')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .gt('remaining_amount', 0)
        .maybeSingle()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching loan:', error)
      return null
    }
  }

  const hasActiveLoan = async (): Promise<boolean> => {
    if (!activeVehicle) return false
    const loan = await getActiveLoan(activeVehicle.id)
    return loan !== null
  }

  const isCashoutOnHold = async (): Promise<boolean> => {
    if (!activeVehicle) return false
    const loan = await getActiveLoan(activeVehicle.id)
    if (!loan?.cashout_hold_until) return false
    return new Date(loan.cashout_hold_until) > new Date()
  }

  return {
    vehicles,
    activeVehicle,
    loading,
    fetchVehicles,
    purchaseVehicle,
    updatePlate,
    hasActiveLoan,
    isCashoutOnHold,
    getActiveLoan
  }
}

export function useDriverTest() {
  const { user } = useAuthStore()
  const [test, setTest] = useState<DriverTest | null>(null)
  const [license, setLicense] = useState<UserLicense | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchLicense = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)

      // Get latest test
      const { data: testData, error: testError } = await supabase
        .from('driver_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('test_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!testError) setTest(testData)

      // Get license
      const { data: licenseData, error: licenseError } = await supabase
        .from('user_licenses')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!licenseError) setLicense(licenseData)
    } catch (error) {
      console.error('Error fetching license:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchLicense()
  }, [fetchLicense])

  const takeTest = async (answers: number[]): Promise<{success: boolean, passed: boolean, score: number}> => {
    if (!user?.id) return { success: false, passed: false, score: 0 }

    // Simple 10 question test - 7/10 to pass
    const correctAnswers = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2] // Placeholder correct answers
    let score = 0
    answers.forEach((answer, index) => {
      if (answer === correctAnswers[index]) score++
    })

    const passed = score >= 7

    try {
      const licenseNumber = passed ? `TL${Date.now().toString(36).toUpperCase()}` : null

      // Save test result
      await supabase.from('driver_tests').insert({
        user_id: user.id,
        score,
        passed,
        test_date: new Date().toISOString(),
        license_number: licenseNumber
      })

      if (passed) {
        // Create license
        await supabase.from('user_licenses').insert({
          user_id: user.id,
          license_number: licenseNumber,
          status: 'active',
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          suspended_until: null,
          reports_count_week: 0,
          arrests_count_week: 0
        })

        // Update profile
        await supabase
          .from('user_profiles')
          .update({ 
            drivers_test_passed: true,
            license_id: user.id
          })
          .eq('id', user.id)
      }

      await fetchLicense()
      return { success: true, passed, score }
    } catch (error: any) {
      console.error('Error taking test:', error)
      return { success: false, passed: false, score: 0 }
    }
  }

  const checkSuspension = async (): Promise<{suspended: boolean, reason: string}> => {
    if (!license) return { suspended: false, reason: '' }

    // Check reports (5 per week = suspended)
    if (license.reports_count_week >= 5) {
      return { suspended: true, reason: '5+ reports this week' }
    }

    // Check arrests (2 per week = suspended)
    if (license.arrests_count_week >= 2) {
      return { suspended: true, reason: '2+ arrests this week' }
    }

    // Check if currently suspended
    if (license.suspended_until && new Date(license.suspended_until) > new Date()) {
      return { suspended: true, reason: 'License suspended' }
    }

    return { suspended: false, reason: '' }
  }

  const checkAndSuspendExpiredInsurance = async () => {
    if (!user?.id) return;

    try {
      // Get all users with licenses
      const { data: licenses, error: licenseError } = await supabase
        .from('user_licenses')
        .select('user_id, status')
        .eq('status', 'active');

      if (licenseError || !licenses) return;

      for (const license of licenses) {
        // Check car insurance
        const { data: carInsurance, error: carError } = await supabase
          .from('car_insurances')
          .select('expires_at')
          .eq('user_id', license.user_id)
          .maybeSingle();

        // Check homeowners insurance
        const { data: homeInsurance, error: homeError } = await supabase
          .from('homeowners_insurances')
          .select('expires_at')
          .eq('user_id', license.user_id)
          .maybeSingle();

        const now = new Date();
        const carExpired = carInsurance && new Date(carInsurance.expires_at) < now;
        const homeExpired = homeInsurance && new Date(homeInsurance.expires_at) < now;

        // If both insurances are expired, suspend license
        if (carExpired && homeExpired) {
          await supabase
            .from('user_licenses')
            .update({
              status: 'suspended',
              suspended_until: null // Indefinite suspension until insurance is renewed
            })
            .eq('user_id', license.user_id);

          // Also update vehicle plate status
          await supabase
            .from('vehicles')
            .update({ plate_status: 'suspended' })
            .eq('owner_user_id', license.user_id);
        }
      }
    } catch (error) {
      console.error('Error checking and suspending expired insurance:', error);
    }
  };

  return {
    test,
    license,
    loading,
    takeTest,
    checkSuspension,
    fetchLicense,
    checkAndSuspendExpiredInsurance
  }
}