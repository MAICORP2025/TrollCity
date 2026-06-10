export type AgencyApplicationStatus = 'pending' | 'approved' | 'rejected';
export type AgencyMemberRole = 'creator' | 'leader' | 'manager';
export type AgencyTier = 'none' | 'bronze' | 'silver' | 'gold' | 'legend';
export type AgencyTransactionType = 'stream_hours' | 'platform_share' | 'verified_viewer' | 'user_registration' | 'tier_bonus' | 'admin_adjustment' | 'reward_redemption';
export type AgencyRewardStatus = 'pending' | 'available' | 'claimed' | 'expired' | 'revoked';
export type AgencyRewardType = 'bonus_coins' | 'badge' | 'exclusive_access' | 'custom_role' | 'merchandise' | 'cash_payout' | 'tier_milestone';

export interface AgencyApplication {
  id: string;
  user_id: string;
  display_name: string;
  primary_platform: string;
  channel_url?: string | null;
  avg_weekly_hours: number;
  avg_weekly_viewers: number;
  content_category: string[];
  motivation?: string | null;
  experience?: string | null;
  referral_code?: string | null;
  status: AgencyApplicationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyMember {
  id: string;
  user_id: string;
  application_id?: string | null;
  role: AgencyMemberRole;
  current_tier: AgencyTier;
  total_points: number;
  lifetime_points: number;
  joined_at: string;
  promoted_at?: string | null;
  last_active_at?: string | null;
  is_active: boolean;
  notified_tier_change: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgencyPointTransaction {
  id: string;
  user_id: string;
  transaction_type: AgencyTransactionType;
  points: number;
  description?: string | null;
  source_id?: string | null;
  source_table?: string | null;
  verified: boolean;
  verification_data: Record<string, unknown>;
  week_start?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface AgencyWeeklyStats {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  stream_hours_points: number;
  platform_share_points: number;
  viewer_points: number;
  registration_points: number;
  tier_bonus_points: number;
  admin_adjustment_points: number;
  total_points: number;
  hours_streamed: number;
  shares_count: number;
  verified_viewers: number;
  verified_registrations: number;
  tier_at_end: AgencyTier;
  calculated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyReward {
  id: string;
  user_id: string;
  reward_type: AgencyRewardType;
  title: string;
  description?: string | null;
  points_cost: number;
  tier_requirement: AgencyTier;
  coin_value: number;
  status: AgencyRewardStatus;
  available_at?: string | null;
  claimed_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  revoked_by?: string | null;
  revoke_reason?: string | null;
  fulfillment_data: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyAuditLog {
  id: string;
  actor_id?: string | null;
  target_user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  previous_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AgencySettings {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  current_tier: AgencyTier;
  total_points: number;
  lifetime_points: number;
  weekly_points: number;
  rank: number;
}

export interface WeeklyEvaluationResult {
  user_id: string;
  week_start: string;
  week_end: string;
  total_points: number;
  previous_tier: AgencyTier;
  new_tier: AgencyTier;
  tier_changed: boolean;
}

export interface AddPointsResult {
  points_awarded: number;
  new_total: number;
  new_tier: AgencyTier;
}

export interface AdjustPointsResult {
  previous_total: number;
  new_total: number;
  new_tier: AgencyTier;
}

export interface NextTierThreshold {
  tier: AgencyTier;
  threshold: number;
}

export interface PointValues {
  stream_hours: number;
  platform_share: number;
  verified_viewer: number;
  user_registration: number;
}

export interface TierThresholds {
  bronze: number;
  silver: number;
  gold: number;
  legend: number;
}

export interface TierInfo {
  name: AgencyTier;
  label: string;
  threshold: number;
  color: string;
  bgColor: string;
  borderColor: string;
  glowClass: string;
  icon: string;
}

export const TIER_CONFIG: Record<AgencyTier, TierInfo> = {
  none: {
    name: 'none',
    label: 'No Tier',
    threshold: 0,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    glowClass: '',
    icon: '○',
  },
  bronze: {
    name: 'bronze',
    label: 'Bronze',
    threshold: 250,
    color: 'text-amber-600',
    bgColor: 'bg-amber-700/15',
    borderColor: 'border-amber-600/40',
    glowClass: 'shadow-[0_0_20px_rgba(180,120,40,0.3)]',
    icon: '🥉',
  },
  silver: {
    name: 'silver',
    label: 'Silver',
    threshold: 500,
    color: 'text-slate-300',
    bgColor: 'bg-slate-400/15',
    borderColor: 'border-slate-300/40',
    glowClass: 'shadow-[0_0_20px_rgba(192,192,192,0.3)]',
    icon: '🥈',
  },
  gold: {
    name: 'gold',
    label: 'Gold',
    threshold: 1000,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/15',
    borderColor: 'border-yellow-400/40',
    glowClass: 'shadow-[0_0_20px_rgba(255,215,0,0.35)]',
    icon: '🥇',
  },
  legend: {
    name: 'legend',
    label: 'Legend',
    threshold: 2000,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-400/40',
    glowClass: 'shadow-[0_0_25px_rgba(168,85,247,0.4)]',
    icon: '👑',
  },
};

export const POINT_VALUES: Record<string, number> = {
  stream_hours: 10,
  platform_share: 2,
  verified_viewer: 5,
  user_registration: 25,
};
