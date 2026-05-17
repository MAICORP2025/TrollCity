import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { deductCoins, recordCoinTransaction } from '../coinTransactions'
import type { Vehicle, VehicleLoan, DriverTest, UserLicense } from '../../types/neighborhood'

const LOAN_AMOUNT = 10000 // 10k troll coins
const MONTHLY_PAYMENT = 500 // Monthly payment amount

const DRIVER_TEST_QUESTIONS = [
  {
    question: 'What is required to legally drive in Troll City?',
    options: ['Just a car', 'A license and registered vehicle', 'Coins only', 'Nothing'],
    correct: 1
  },
  {
    question: 'What happens if you drive without a license?',
    options: ['Nothing', 'You earn coins', 'You may be suspended', 'You get a free upgrade'],
    correct: 2
  },
  {
    question: 'What does an ACTIVE license mean?',
    options: ['You can repair cars', 'You can drive and use vehicles', 'You get free coins', 'You own multiple cars'],
    correct: 1
  },
  {
    question: 'What is required to broadcast in Troll City?',
    options: ['A vehicle only', 'Active license', 'Coins', 'Followers'],
    correct: 1
  },
  {
    question: 'Can a suspended user join a broadcast seat?',
    options: ['No', 'Yes'],
    correct: 1
  },
  {
    question: 'Can you broadcast while your license is suspended?',
    options: ['Yes', 'No'],
    correct: 1
  },
  {
    question: 'What must you do after a driving violation if insurance is required?',
    options: ['Nothing', 'Buy insurance and pass the driver test', 'Log out', 'Join a stream'],
    correct: 1
  },
  {
    question: 'What does car insurance help cover?',
    options: ['Vehicle damage and vandalism', 'Free followers', 'Free broadcast themes', 'Avatar colors'],
    correct: 0
  },
  {
    question: 'Without active insurance, vehicle repairs cost:',
    options: ['Nothing', 'Full repair cost', 'Free after one day', 'Half price always'],
    correct: 1
  },
  {
    question: 'What is a deductible?',
    options: ['A partial amount paid before insurance covers damage', 'A free coin bonus', 'A license plate', 'A broadcast seat'],
    correct: 0
  }
]

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

      // Deduct coins before creating vehicle
      if (finalPrice > 0) {
        const { success: deductSuccess, error: deductError } = await deductCoins({
          userId: user.id,
          amount: finalPrice,
          type: 'purchase',
          coinType: 'troll_coins',
          description: `Vehicle purchase: ${vehicleName}`,
          metadata: { vehicle_name: vehicleName, make, model, year }
        })

        if (!deductSuccess) {
          return { success: false, error: deductError || 'Insufficient coins to purchase vehicle' }
        }
      }

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

  const recordDrivingViolation = async (): Promise<{success: boolean, message: string}> => {
    if (!user?.id) return { success: false, message: 'Not authenticated' }

    try {
      // Get current profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('license_status, license_strikes, insurance_required')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      // Update profile for violation
      const newStrikes = (profile.license_strikes || 0) + 1
      const updateData: any = {
        license_status: 'suspended',
        license_strikes: newStrikes,
        insurance_required: true,
        license_suspended_at: new Date().toISOString()
      }

      await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id)

      await fetchLicense()
      return { 
        success: true, 
        message: 'Driving without an active license is not allowed. Your license status has been suspended and insurance is now required.' 
      }
    } catch (error: any) {
      console.error('Error recording violation:', error)
      return { success: false, message: 'Failed to record violation' }
    }
  }

  const canUserDrive = async (): Promise<{canDrive: boolean, message?: string}> => {
    if (!user?.id) return { canDrive: false, message: 'Not authenticated' }

    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('license_status, insurance_required')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (profile.license_status === 'active') {
        return { canDrive: true }
      }

      if (profile.license_status === 'suspended') {
        return { 
          canDrive: false, 
          message: 'Your license is suspended. Complete the driver test and ensure you have active insurance to restore your license.' 
        }
      }

      return { 
        canDrive: false, 
        message: 'You need an active driver license to use vehicles. Take the driver test to get licensed.' 
      }
    } catch (error) {
      console.error('Error checking drive permission:', error)
      return { canDrive: false, message: 'Unable to verify license status' }
    }
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
    getActiveLoan,
    recordDrivingViolation,
    canUserDrive
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

  const takeTest = async (answers: number[], correctAnswers: number[] = [1, 2, 1, 1, 1, 1, 1, 0, 1, 0]): Promise<{success: boolean, passed: boolean, score: number, message?: string}> => {
    if (!user?.id) return { success: false, passed: false, score: 0 }

    const score = answers.reduce((sum, answer, index) => {
      return sum + (answer === correctAnswers[index] ? 1 : 0)
    }, 0)

    const totalQuestions = DRIVER_TEST_QUESTIONS.length
    const passingScore = Math.ceil(totalQuestions * 0.8) // 80%
    const passed = score >= passingScore

    try {
      // Get current profile to check insurance_required
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('insurance_required, license_status')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      let newLicenseStatus = 'none'
      let message = ''

      if (passed) {
        // Check if insurance is required and active
        let hasActiveInsurance = false
        if (profile.insurance_required) {
          const { data: insurance } = await supabase
            .from('car_insurances')
            .select('status, expires_at')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gt('expires_at', new Date().toISOString())
            .maybeSingle()
          hasActiveInsurance = !!insurance
        }

        if (!profile.insurance_required || hasActiveInsurance) {
          newLicenseStatus = 'active'
          message = 'Congratulations! You passed the driver test and your license is now active.'
        } else {
          newLicenseStatus = 'suspended'
          message = 'You passed, but insurance is required before your license can be restored. Please purchase car insurance.'
        }
      } else {
        newLicenseStatus = 'none'
        message = 'You did not pass the test. Please review the material and try again.'
      }

      // Update profile
      const updateData: any = {
        license_status: newLicenseStatus,
        driver_test_passed_at: passed ? new Date().toISOString() : null
      }

      if (passed && newLicenseStatus === 'active') {
        updateData.license_restored_at = new Date().toISOString()
      }

      await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id)

      // Save test result
      await supabase.from('driver_tests').insert({
        user_id: user.id,
        score,
        passed,
        test_date: new Date().toISOString(),
        license_number: passed ? `TC${Date.now().toString(36).toUpperCase()}` : null
      })

      await fetchLicense()
      return { success: true, passed, score, message }
    } catch (error: any) {
      console.error('Error taking test:', error)
      return { success: false, passed: false, score: 0, message: error.message }
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