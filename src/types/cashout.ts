// Types for Enhanced Cashout System
import { UserProfile } from './supabase';

export type PayoutMethod = 'cash_app' | 'paypal' | 'venmo';

export type CashoutStatus = 'pending' | 'processing' | 'approved' | 'completed' | 'denied' | 'submitted';

export interface CashoutRequest {
  id: string;
  user_id: string;
  coins_reserved: number;          // total coins committed (including fee)
  eligible_gift_coins_used: number; // actual eligible coins being cashed out
  fee_percentage: number;
  fee_coins: number;
  net_coins: number;
  usd_amount: number;
  status: CashoutStatus;
  payout_method: PayoutMethod | null;
  payout_details: string | null;   // provider username/handle/email
  id_verification_url: string | null;
  id_verification_uploaded_at: string | null;
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  opened_by_admin_id: string | null;
  opened_at: string | null;
  prior_status: string | null;
  cashout_type: 'gift' | 'friday_bonus' | 'admin_override';
  is_friday_battle_bonus: boolean;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export interface CashoutDocument {
  id: string;
  cashout_request_id: string;
  document_type: 'id_verification' | 'payment_receipt' | 'admin_notes';
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_at: string;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface GiftBreakdown {
  sender_id: string;
  sender_username: string;
  total_coins: number;
  gift_count: number;
  coin_type: 'paid' | 'free';
  is_eligible: boolean;
  is_manually_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
}

export interface CashoutDetails {
  success: boolean;
  cashout: {
    id: string;
    user_id: string;
    username: string;
    coins_redeemed: number;
    eligible_gift_coins_used: number;
    fee_coins: number;
    net_coins: number;
    usd_amount: number;
    status: CashoutStatus;
    payout_method: PayoutMethod | null;
    payout_provider_username: string | null;
    id_verification_url: string | null;
    id_verification_uploaded_at: string | null;
    receipt_url: string | null;
    receipt_uploaded_at: string | null;
    admin_notes: string | null;
    opened_by_admin_id: string | null;
    opened_at: string | null;
    rejection_reason: string | null;
    requested_at: string;
    processed_at: string | null;
    processed_by: string | null;
  };
  user: {
    id: string;
    username: string;
    email?: string;
    troll_coins: number;
    reserved_troll_coins: number;
    available_coins: number;
  };
  gift_breakdown: GiftBreakdown[];
  summary: {
    total_gift_coins: number;
    distinct_senders: number;
    eligible_gift_coins: number;
    eligible_for_cashout: boolean;
  };
}

export interface EligibleCoinsResult {
  total_eligible_coins: number;
  gift_summary: JSONB;
  breakdown: GiftBreakdown[];
}

export interface RequestCashoutResponse {
  success: boolean;
  cashout_id?: string;
  coins_reserved?: number;
  fee_coins?: number;
  net_coins?: number;
  usd_amount?: number;
  eligible_coins?: number;
  error?: string;
}

export interface ProcessCashoutResponse {
  success: boolean;
  status?: CashoutStatus;
  action?: string;
  error?: string;
}

// Extended CashoutTier with fee info
export interface CashoutTier {
  id: string;
  coin_amount: number;
  cash_amount: number;
  currency: string;
  processing_fee_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Fee calculation utility
export function calculateFeeCoins(coinAmount: number, feePercentage: number = 2.9): number {
  return Math.ceil(coinAmount * (feePercentage / 100));
}

export function calculateNetCoins(coinAmount: number, feeCoins: number): number {
  return coinAmount - feeCoins;
}

export function isFriday(): boolean {
  const now = new Date();
  const mtDateString = now.toLocaleString("en-US", { timeZone: "America/Denver" });
  const mtDate = new Date(mtDateString);
  return mtDate.getDay() === 5; // 0=Sun, 5=Fri
}

export function isCashoutWindowOpen(): boolean {
  const now = new Date();
  const mtDateString = now.toLocaleString("en-US", { timeZone: "America/Denver" });
  const mtDate = new Date(mtDateString);
  const day = mtDate.getDay();
  const hour = mtDate.getHours();

  // Weekend payout window: Friday, Saturday, or Sunday between 1 AM and 7 PM Mountain Time
  return [5, 6, 0].includes(day) && hour >= 1 && hour < 19;
}
