/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */


export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  coin_balance: number;
  profile_complete: boolean;
  role: 'user' | 'admin' | 'creator';
  paypal_email?: string;
  payment_method: 'paypal' | 'stripe' | 'bank';
  created_at: string;
  updated_at: string;
}

export interface SignUpRequest {
  email: string;
  username: string;
  password: string;
}

export interface SignUpResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface CreateProfileRequest {
  display_name: string;
  bio: string;
  favorite_category: 'shorts' | 'movies' | 'creator';
  avatar_url?: string;
}

export interface CreateProfileResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface SessionResponse {
  user?: User;
  authenticated: boolean;
}

export interface GrantCoinsRequest {
  user_id: string;
  amount: number;
}

export interface GrantCoinsResponse {
  success: boolean;
  new_balance?: number;
  error?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'purchase' | 'grant' | 'spend' | 'payout';
  description?: string;
  created_at: string;
}

export interface TransactionListResponse {
  success: boolean;
  transactions?: Transaction[];
  error?: string;
}

export interface PayoutGoal {
  id: string;
  user_id: string;
  coin_goal: number;
  payout_amount: number;
  enabled: boolean;
  last_payout_date?: string;
  created_at: string;
  updated_at: string;
}

export interface SetPayoutGoalRequest {
  user_id: string;
  coin_goal: number;
  payout_amount: number;
}

export interface PayoutGoalResponse {
  success: boolean;
  goal?: PayoutGoal;
  error?: string;
}

export interface AllPayoutGoalsResponse {
  success: boolean;
  goals?: PayoutGoal[];
  error?: string;
}

export interface ProcessPayoutsResponse {
  success: boolean;
  processed?: number;
  message?: string;
  error?: string;
}

export interface Series {
  id: string;
  creator_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentWithCreator {
  id: string;
  creator_id: string;
  series_id?: string;
  title: string;
  description?: string;
  type: 'short' | 'movie';
  thumbnail_url?: string;
  video_url: string;
  views: number;
  likes: number;
  featured: boolean;
  status: 'pending' | 'approved' | 'rejected';
  is_unlockable: boolean;
  unlock_price?: number;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    username: string;
    display_name: string;
    role: string;
  };
  series?: Series;
}

export interface ContentListResponse {
  success: boolean;
  content?: ContentWithCreator[];
  error?: string;
}

export interface UpdatePayPalSettingsRequest {
  paypal_email?: string;
  payment_method: 'paypal' | 'stripe' | 'bank';
}

export interface UpdatePayPalSettingsResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  error?: string;
}

export interface CreateSeriesRequest {
  name: string;
  description?: string;
}

export interface CreateSeriesResponse {
  success: boolean;
  series?: Series;
  error?: string;
}

export interface ListSeriesResponse {
  success: boolean;
  series?: Series[];
  error?: string;
}

export interface UploadVideoRequest {
  title: string;
  description?: string;
  content_type: 'short' | 'movie';
  series_id?: string;
  video_file: File;
  thumbnail_file?: File;
}

export interface UploadVideoResponse {
  success: boolean;
  video?: ContentWithCreator;
  error?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

export interface Conversation {
  id: string;
  other_user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
  last_read_at: string;
  last_message?: Message;
}

export interface MessagePricing {
  id: string;
  creator_id: string;
  coin_cost_per_message: number;
  free_daily_messages: number;
  vip_fans_message_free: boolean;
  fam_members_discount_percent: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GetConversationsResponse {
  success: boolean;
  conversations?: Conversation[];
  error?: string;
}

export interface GetMessagesResponse {
  success: boolean;
  messages?: Message[];
  error?: string;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
}

export interface SendMessageResponse {
  success: boolean;
  message?: Message;
  requires_payment?: boolean;
  payment_amount?: number;
  error?: string;
}

export interface StartConversationRequest {
  otherUserId: string;
}

export interface StartConversationResponse {
  success: boolean;
  conversationId?: string;
  error?: string;
}

export interface GetMessagePricingResponse {
  success: boolean;
  pricing?: MessagePricing | null;
  error?: string;
}

export interface SetMessagePricingRequest {
  creator_id: string;
  coin_cost_per_message: number;
  free_daily_messages: number;
  vip_fans_message_free: boolean;
  fam_members_discount_percent: number;
  enabled: boolean;
}

export interface SetMessagePricingResponse {
  success: boolean;
  pricing?: MessagePricing;
  error?: string;
}

export interface PayForMessageRequest {
  messageId: string;
  creatorId: string;
  coinAmount: number;
}

export interface PayForMessageResponse {
  success: boolean;
  payment?: any;
  error?: string;
}

export interface CheckMessagePaymentResponse {
  success: boolean;
  requires_payment: boolean;
  payment_amount: number;
  reason?: string;
  error?: string;
}

export interface GetDailyMessageCountResponse {
  success: boolean;
  daily_count: number;
  free_messages_remaining: number;
  error?: string;
}
