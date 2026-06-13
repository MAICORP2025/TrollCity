// =============================================================================
// Legacy Auction Types — extracted to avoid circular dependencies
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

export interface AuctionShow {
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
}

export interface AuctionLot {
  id: string;
  auction_show_id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  starting_bid: number;
  bid_increment: number;
  current_highest_bid?: number | null;
  current_highest_bidder_id?: string | null;
  status: AuctionLotStatus;
  countdown_end_at?: string | null;
  order_index?: number | null;
  queue_position?: number | null;
  reserve_price?: number | null;
  buy_now_price?: number | null;
  condition?: string | null;
  quantity?: number | null;
  winner_user_id?: string | null;
  final_bid?: number | null;
  sold_at?: string | null;
}

export interface AuctionBid {
  id: string;
  lot_id?: string | null;
  bidder_id: string;
  bid_amount: number;
  created_at: string;
  bidder?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface UserProfile {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  troll_coins: number;
  role?: string | null;
  is_admin?: boolean | null;
  is_superadmin?: boolean | null;
}

export interface LiveAuctionStateRpc {
  current_lot?: AuctionLot | null;
  recent_bids?: AuctionBid[];
  viewer_count?: number;
}

export interface PlaceBidResult {
  accepted?: boolean;
  reason?: string;
  bid_id?: string;
  new_highest_bid?: number;
}
