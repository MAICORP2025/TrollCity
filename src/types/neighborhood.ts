// Neighborhood System Types

export interface Neighborhood {
  id: string
  leader_user_id: string
  name: string
  zip_code: string
  officer_id: string
  created_at: string
}

export interface NeighborhoodMember {
  id: string
  neighborhood_id: string
  user_id: string
  role: 'leader' | 'member' | 'follower'
  house_id: string | null
  joined_at: string
  user?: {
    username: string
    avatar_url: string
  }
}

export interface House {
  id: string
  neighborhood_id: string
  owner_user_id: string
  upgrade_level: number
  condition: number // 0-100, below 85 needs repair
  is_reposessed: boolean
  electric_on: boolean
  water_on: boolean
  internet_on: boolean
  created_at: string
}

export interface HouseUpgrade {
  id: string
  house_id: string
  upgrade_type: string
  cost: number
  installed_at: string
}

export interface HouseLoan {
  id: string
  house_id: string
  total_amount: number
  remaining_amount: number
  monthly_payment: number
  is_default: boolean
  default_at: string | null
}

export interface Vehicle {
  id: string
  owner_user_id: string
  vehicle_name: string
  make: string
  model: string
  year: number
  plate_number: string | null
  plate_status: 'none' | 'active' | 'suspended'
  loan_id: string | null
  insurance_expiry: string | null
  created_at: string
}

export interface VehicleLoan {
  id: string
  vehicle_id: string
  total_amount: number
  remaining_amount: number
  monthly_payment: number
  is_default: boolean
  default_at: string | null
  cashout_hold_until: string | null
}

export interface DriverTest {
  id: string
  user_id: string
  score: number
  passed: boolean
  test_date: string
  license_number: string | null
}

export interface UserLicense {
  id: string
  user_id: string
  license_number: string
  status: 'active' | 'suspended' | 'none'
  issued_at: string
  expires_at: string
  suspended_until: string | null
  reports_count_week: number
  arrests_count_week: number
}

export interface NeighborhoodInvite {
  id: string
  leader_user_id: string
  follower_user_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

// House fee types
export interface HouseFees {
  deed_fee: number
  electric_fee: number
  water_fee: number
  internet_fee: number
  yard_trash_fee: number
  monthly_total: number
}

// House raid types
export interface HouseRaid {
  id: string
  house_id: string
  raided_by_user_id: string
  damage_level: 'minor' | 'major' | 'destroyed'
  raided_at: string
  repaired_at: string | null
}

// Insurance types (extends existing)
export interface HomeownersInsurance {
  id: string
  user_id: string
  house_id: string
  expires_at: string
  deductible_paid: number
}

export interface CarInsurance {
  id: string
  user_id: string
  vehicle_id: string
  expires_at: string
  deductible_paid: number
}

export interface BroadcastInsurance {
  id: string
  user_id: string
  expires_at: string
  coverage_type: 'raid_damage' | 'vandalism' | 'all'
}

export interface PropertyCustomizationOption {
  id: string
  label: string
  preview: string
  cost: number
  requiredUpgradeLevel: number
}

export interface CarOption {
  id: string
  name: string
  tier: 'Common' | 'Rare' | 'Epic'
  description: string
  price: number
  speed: number
  armor: number
  insurance_required: boolean
}
