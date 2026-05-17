/**
 * Types for the queue-based seat request system
 */

// Request status types
export type SeatRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired' | 'joined' | 'refunded';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

// Seat UI state - derived from request + session + LiveKit state
export type SeatUIState = 'empty' | 'pending_request' | 'approved_waiting' | 'connecting' | 'live' | 'failed';

export interface StreamSeatRequest {
  id: string;
  stream_id: string;
  broadcaster_id: string;
  user_id: string;
  seat_index: number;
  
  status: SeatRequestStatus;
  seat_price: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  
  created_at: string;
  approved_at: string | null;
  denied_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  joined_at: string | null;
  
  deny_reason?: string | null;
  
  // Joined user profile for display
  user_profile?: {
    username: string;
    avatar_url: string;
    is_gold?: boolean;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
    role?: string;
    troll_coins?: number;
    trollmonds_balance?: number;
    troll_role?: string;
    created_at?: string;
  };
}

export interface SeatRequestQueueItem {
  request: StreamSeatRequest;
  expiresIn?: number; // milliseconds until expiry
}

export interface RefundRequest {
  request_id: string;
  session_id?: string;
  reason: 'denied' | 'expired' | 'failed_to_join' | 'livekit_error' | 'user_cancelled' | 'permission_denied';
}

export interface SeatLiveKitTokenRequest {
  participantType: 'seat';
  streamId: string;
  roomName: string;
  userId: string;
  seatIndex: number;
  requestId: string;
}

export interface SeatLiveKitTokenResponse {
  token: string;
  url: string;
  roomName: string;
}

// Merged seat state combining request + session + LiveKit info
export interface SeatStateWithLiveKit {
  seatIndex: number;
  requestStatus: SeatRequestStatus | null;
  isLiveKitConnected: boolean;
  hasPublishedTracks: boolean;
  userId?: string;
  guestId?: string;
  userProfile?: StreamSeatRequest['user_profile'];
  
  // Computed UI state
  uiState: SeatUIState;
  
  // Expiry info for approved but not joined
  expiresAt?: string | null;
  expiresInMs?: number;
}
