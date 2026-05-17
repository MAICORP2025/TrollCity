/**
 * Repossession System Type Definitions
 */

// Repossession status for assets
export interface RepossessionStatus {
  is_repossessed: boolean;
  repossessed_at: string | null;
  repossessed_by: string | null;
  repossession_reason: string | null;
}

// Property with repossession status
export interface PropertyWithRepossession {
  id: string;
  owner_user_id: string | null;
  property_name: string;
  purchase_price: number;
  is_active_home: boolean;
  is_repossessed: boolean;
  repossessed_at: string | null;
  repossessed_by: string | null;
  repossession_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Vehicle with repossession status
export interface VehicleWithRepossession {
  id: string;
  user_id: string | null;
  catalog_id: number;
  color: string;
  plate: string;
  is_active: boolean;
  is_repossessed: boolean;
  repossessed_at: string | null;
  repossessed_by: string | null;
  repossession_reason: string | null;
  vehicles_catalog?: {
    name: string;
    image: string;
  };
  created_at: string;
  updated_at: string;
}

// Court summon types
export type SummonType = 
  | 'property_repossession' 
  | 'vehicle_repossession' 
  | 'loan_default_hearing';

export type SummonStatus = 
  | 'pending' 
  | 'served' 
  | 'cancelled' 
  | 'resolved';

// Loan default summon
export interface LoanDefaultSummon {
  id: string;
  user_id: string;
  loan_id: string;
  property_id: string | null;
  vehicle_id: string | null;
  summon_type: SummonType;
  status: SummonStatus;
  reason: string;
  amount_owed: number;
  created_by: string | null;
  created_at: string;
  served_at: string | null;
  court_date: string | null;
}

// Delinquent user data
export interface DelinquentUser {
  user_id: string;
  username: string;
  total_balance: number;
  days_overdue: number;
  owned_properties: PropertyWithRepossession[] | null;
  owned_vehicles: VehicleWithRepossession[] | null;
}

// User assets combined
export interface UserAssets {
  properties: PropertyWithRepossession[];
  vehicles: VehicleWithRepossession[];
  loans: {
    id: string;
    user_id: string;
    balance: number;
    principal: number;
    status: string;
    due_date: string;
  }[];
}

// Repossession action result
export interface RepossessionResult {
  success: boolean;
  asset_id: string;
  asset_type: 'property' | 'vehicle';
  restored: boolean;
}

// Court summon result
export interface CourtSummonResult {
  success: boolean;
  summon_id: string;
  user_id: string;
  loan_id: string;
  amount_owed: number;
  court_date: string;
}
