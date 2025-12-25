export interface Video {
  title: string;
  description?: string;
  thumbnail_url?: string;
  video_url: string;
  content_type: 'short' | 'movie';
  category: 'action' | 'comedy' | 'drama' | 'horror' | 'documentary' | 'music' | 'gaming' | 'education' | 'lifestyle' | 'sports' | 'other';
  is_premium?: boolean;
  coin_price?: number;
  duration_minutes?: number;
  views?: number;
  likes?: number;
  creator_email: string;
  creator_name?: string;
  status?: 'pending' | 'approved' | 'rejected';
  featured?: boolean;
}

export interface CoinTransaction {
  user_email: string;
  type: 'purchase' | 'spend' | 'earn' | 'payout';
  amount: number;
  description?: string;
  video_id?: string;
  package_name?: string;
  usd_amount?: number;
  status?: 'pending' | 'completed' | 'failed';
}

export interface CreatorApplication {
  user_email: string;
  full_name: string;
  channel_name: string;
  content_description?: string;
  agreed_to_safety_policy?: boolean;
  agreed_to_copyright_policy?: boolean;
  agreed_to_speech_policy?: boolean;
  agreed_to_terms?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
}

export interface PayoutRequest {
  user_email: string;
  paypal_email: string;
  coin_amount: number;
  usd_amount: number;
  tier_name?: string;
  status?: 'pending' | 'processing' | 'completed' | 'rejected';
  processed_date?: string;
  notes?: string;
}

export interface UnlockedContent {
  user_email: string;
  video_id: string;
  coins_paid?: number;
}

export interface Message {
  from_email: string;
  to_email: string;
  subject?: string;
  content: string;
  is_read?: boolean;
  conversation_id?: string;
}

export interface VIPPackage {
  creator_email: string;
  name: string;
  description?: string;
  coin_price: number;
  duration_days: number;
  perks?: string[];
  badge_color?: string;
  active?: boolean;
}

export interface Subscription {
  subscriber_email: string;
  creator_email: string;
  package_id?: string;
  package_name?: string;
  start_date?: string;
  end_date?: string;
  auto_renew?: boolean;
  status?: 'active' | 'expired' | 'cancelled';
}

export interface FanSupport {
  fan_email: string;
  creator_email: string;
  amount: number;
  message?: string;
  type?: 'tip' | 'vip_purchase' | 'content_unlock' | 'subscription';
}

export interface User {
  email: string;
  is_creator?: boolean;
  role?: string;
  coin_balance?: number;
  // Add other properties as needed
}