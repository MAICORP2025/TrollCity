// =====================================================
// VEHICLE ASSET SYSTEM - TypeScript Types
// =====================================================
// These types are for the Cars page (Bottom Navigation)
// INDEPENDENT from Neighborhood vehicle types
// =====================================================

export type VehicleTier =
  | 'Common'
  | 'Rare'
  | 'Epic'
  | 'Legendary'
  | 'Mythic'
  | 'Special'
  | 'Limited'
  | 'Holiday'
  | 'Founder';

export type VehicleAssetStatus = 'owned' | 'sold';

export type VehicleTransactionType = 'purchase' | 'sale' | 'buyback';

// Vehicle catalog item (available for purchase)
export interface VehicleCatalogItem {
  vehicle_id: string;
  name: string;
  description?: string;
  tier: VehicleTier;
  image_url?: string;
  base_price: number;
  buyback_value: number;
  buyback_percentage: number;
  stock_quantity: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// User's owned vehicle (from Cars page)
export interface UserVehicleAsset {
  id: string;
  user_id?: string;
  catalog_id?: string;
  vehicle_id?: string; // From catalog
  vehicle_name: string;
  tier?: VehicleTier;
  image_url?: string;
  purchase_price: number;
  buyback_value: number;
  buyback_percentage: number;
  purchase_date: string;
  sold_at?: string;
  sale_price?: number;
  status: VehicleAssetStatus;
  metadata?: Record<string, any>;
}

// Vehicle transaction record
export interface VehicleTransaction {
  id: string;
  user_id?: string;
  catalog_id?: string;
  asset_id?: string;
  transaction_type: VehicleTransactionType;
  vehicle_name: string;
  amount: number;
  metadata?: Record<string, any>;
  created_at: string;
}

// Purchase result
export interface VehiclePurchaseResult {
  success: boolean;
  asset_id?: string;
  vehicle_name?: string;
  purchase_price?: number;
  buyback_percentage?: number;
  buyback_value?: number;
  error?: string;
}

// Sale result
export interface VehicleSaleResult {
  success: boolean;
  vehicle_name?: string;
  purchase_price?: number;
  buyback_value?: number;
  buyback_percentage?: number;
  error?: string;
}

// Vehicle statistics (admin)
export interface VehicleStats {
  vehicle_id: string;
  vehicle_name: string;
  total_purchases: number;
  total_sales: number;
  currently_owned: number;
  total_coins_spent: number;
  total_coins_returned: number;
  net_coin_sink: number;
}

// Admin vehicle creation params
export interface AdminVehicleParams {
  vehicle_id: string;
  name: string;
  tier?: VehicleTier;
  base_price?: number;
  buyback_percentage?: number;
  image_url?: string;
  description?: string;
  stock_quantity?: number;
}

// Admin vehicle update params
export interface AdminVehicleUpdateParams {
  vehicle_id: string;
  name?: string;
  tier?: VehicleTier;
  base_price?: number;
  buyback_percentage?: number;
  image_url?: string;
  description?: string;
  stock_quantity?: number;
  is_active?: boolean;
}

// Tier colors for UI
export const TIER_COLORS: Record<VehicleTier, string> = {
  Common: 'text-gray-400 border-gray-400',
  Rare: 'text-blue-400 border-blue-400',
  Epic: 'text-purple-400 border-purple-400',
  Legendary: 'text-orange-400 border-orange-400',
  Mythic: 'text-yellow-400 border-yellow-400',
  Special: 'text-pink-400 border-pink-400',
  Limited: 'text-red-400 border-red-400',
  Holiday: 'text-green-400 border-green-400',
  Founder: 'text-cyan-400 border-cyan-400',
};

// Tier background colors
export const TIER_BG_COLORS: Record<VehicleTier, string> = {
  Common: 'bg-gray-400/10',
  Rare: 'bg-blue-400/10',
  Epic: 'bg-purple-400/10',
  Legendary: 'bg-orange-400/10',
  Mythic: 'bg-yellow-400/10',
  Special: 'bg-pink-400/10',
  Limited: 'bg-red-400/10',
  Holiday: 'bg-green-400/10',
  Founder: 'bg-cyan-400/10',
};
