// =============================================================================
// Auction Interactive Features — TypeScript Types
// =============================================================================

export type AuctionShowStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

export type AuctionLotStatus =
  | 'draft'
  | 'upcoming'
  | 'queued'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'show'
  | 'up'
  | 'down'
  | 'pass'
  | 'sold'
  | 'unsold'
  | 'cancelled'
  | 'ended'
  | 'removed'
  | 'remove';

// -----------------------------------------------------------------------------
// Anonymous Round Types
// -----------------------------------------------------------------------------

export interface AnonymousRoundState {
  isActive: boolean;
  endsAt: string | null;
  durationSeconds: number;
  maxDuration: number;
  secondsRemaining: number;
}

export interface StartAnonymousRoundResult {
  success: boolean;
  reason?: string;
  ends_at?: string;
  duration?: number;
}

export interface EndAnonymousRoundResult {
  success: boolean;
  reason?: string;
}

// -----------------------------------------------------------------------------
// Boost Bid Types
// -----------------------------------------------------------------------------

export interface BoostBidConfig {
  enabled: boolean;
  allowedIncrements: number[];
  maxAmount: number;
  customEnabled: boolean;
}

export interface BoostBidResult {
  accepted: boolean;
  reason?: string;
  bid_id?: string;
  new_highest_bid?: number;
  boost_amount?: number;
}

// -----------------------------------------------------------------------------
// Prediction Types
// -----------------------------------------------------------------------------

export type PredictionType = 'winner' | 'price' | 'combined';

export interface AuctionPredictionSettings {
  id: number;
  enabled: boolean;
  enabled_global: boolean;
  lock_before_end_seconds: number;
  reward_crowns_correct_winner: number;
  reward_crowns_correct_price: number;
  reward_crowns_combined: number;
  reward_xp_correct_winner: number;
  reward_xp_correct_price: number;
  reward_xp_combined: number;
  reward_event_points_correct_winner: number;
  reward_event_points_correct_price: number;
  reward_event_points_combined: number;
  min_entries_for_leaderboard: number;
  created_at: string;
  updated_at: string;
}

export interface AuctionPrediction {
  id: string;
  user_id: string;
  auction_show_id: string;
  predicted_winner_id: string | null;
  predicted_price: number | null;
  prediction_type: PredictionType;
  is_locked: boolean;
  locked_at: string | null;
  is_correct_winner?: boolean;
  is_correct_price?: boolean;
  price_accuracy?: number;
  submitted_at: string;
  updated_at: string;
  // Joined fields
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface AuctionPredictionReward {
  id: string;
  prediction_id: string;
  user_id: string;
  auction_show_id: string;
  reward_type: 'crowns' | 'xp' | 'event_points';
  reward_amount: number;
  reason: string;
  granted: boolean;
  granted_at: string | null;
  created_at: string;
}

export interface SubmitPredictionResult {
  success: boolean;
  reason?: string;
  prediction_id?: string;
  action?: 'created' | 'updated';
}

export interface LockPredictionsResult {
  success: boolean;
  reason?: string;
}

export interface SettlePredictionsResult {
  success: boolean;
  reason?: string;
  total_rewards_granted?: number;
}

// -----------------------------------------------------------------------------
// Extended Auction Show (with new feature columns)
// -----------------------------------------------------------------------------

export interface AuctionShowExtended {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  thumbnail_url?: string | null;
  status: AuctionShowStatus;
  scheduled_for?: string | null;
  live_started_at?: string | null;
  ended_at?: string | null;
  livekit_room_name?: string | null;
  auctioneer_id: string;
  current_lot_id?: string | null;
  display_text?: string;
  is_featured?: boolean;
  // Anonymous round
  is_anonymous_round_active: boolean;
  anonymous_round_ends_at?: string | null;
  anonymous_round_duration_seconds: number;
  anonymous_round_max_duration: number;
  // Boost bid
  boost_bids_enabled: boolean;
  boost_bid_allowed_increments: number[];
  boost_bid_max_amount: number;
  boost_bid_custom_enabled: boolean;
  // Predictions
  predictions_enabled: boolean;
  predictions_locked: boolean;
  predictions_lock_at?: string | null;
  predictions_lock_threshold_coins?: number | null;
}

// -----------------------------------------------------------------------------
// Extended Auction Bid (with new feature columns)
// -----------------------------------------------------------------------------

export interface AuctionBidExtended {
  id: string;
  lot_id?: string | null;
  auction_show_id?: string | null;
  bidder_id: string;
  bid_amount: number;
  created_at: string;
  // Anonymous
  is_anonymous: boolean;
  anonymous_label?: string | null;
  // Boost
  is_boost_bid: boolean;
  boost_amount: number;
  // Joined
  bidder?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}
