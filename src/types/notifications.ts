// TypeScript types for Trollifications (Notifications System)

// ACCOUNT / SECURITY
export type NotificationType =
  | 'new_login_detected'
  | 'password_changed'
  | 'email_changed'
  | 'profile_updated'
  | 'account_warning'
  | 'account_restriction_started'
  | 'account_restriction_expired'
  | 'jail_sentence_started'
  | 'jail_release_reminder'
  | 'jail_release_completed'
  // BROADCAST / LIVE
  | 'someone_you_follow_went_live'
  | 'your_stream_started'
  | 'your_stream_ended'
  | 'stream_disconnected'
  | 'invited_to_cohost'
  | 'cohost_invite_accepted'
  | 'cohost_invite_declined'
  | 'removed_from_cohost'
  | 'broadofficer_assigned'
  | 'broadofficer_removed'
  | 'chat_disabled'
  | 'kicked_from_live'
  | 'banned_from_live'
  | 'live_received_report'
  | 'live_ended_by_staff'
  // CHAT / SOCIAL
  | 'new_private_message'
  | 'message_request_received'
  | 'someone_replied'
  | 'someone_mentioned'
  | 'someone_followed'
  | 'friend_request_received'
  | 'request_accepted'
  | 'tcps_mail_received'
  | 'paid_message_received'
  | 'paid_message_unlocked'
  // GIFTS / COINS / WALLET
  | 'gift_received'
  | 'gift_sent'
  | 'large_gift_received'
  | 'coin_purchase_success'
  | 'coin_purchase_failed'
  | 'bonus_coins_added'
  | 'daily_reward_available'
  | 'daily_reward_claimed'
  | 'cashout_submitted'
  | 'cashout_approved'
  | 'cashout_rejected'
  | 'cashout_paid'
  | 'cashout_hold_placed'
  | 'cashout_hold_removed'
  | 'wallet_adjustment'
  | 'refund_issued'
  // COURT / JAIL / CITY GOVERNANCE
  | 'court_case_opened'
  | 'added_to_case'
  | 'court_hearing_scheduled'
  | 'hearing_starting_soon'
  | 'judge_assigned'
  | 'attorney_assigned'
  | 'evidence_submitted'
  | 'verdict_issued'
  | 'sentence_issued'
  | 'fine_assigned'
  | 'fine_paid'
  | 'license_suspension_started'
  | 'license_suspension_ended'
  | 'appeal_submitted'
  | 'appeal_decision'
  // AUCTIONS / MARKETPLACE
  | 'auction_starting_soon'
  | 'seller_you_follow_auction'
  | 'you_placed_bid'
  | 'you_were_outbid'
  | 'you_won_auction'
  | 'you_lost_auction'
  | 'payment_required'
  | 'payment_confirmed'
  | 'seller_shipped'
  | 'tracking_added'
  | 'order_delivered'
  | 'mystery_box_assigned'
  | 'mystery_box_opened_live'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'seller_rating_received'
  | 'buyer_rating_received'
  // FAMILIES / NEIGHBORHOODS
  | 'family_invite_received'
  | 'family_invite_accepted'
  | 'family_role_changed'
  | 'family_xp_milestone'
  | 'neighborhood_event_started'
  | 'family_challenge_started'
  | 'family_challenge_completed'
  // STORE / INVENTORY
  | 'purchase_successful'
  | 'purchase_failed'
  | 'item_unlocked'
  | 'entrance_effect_activated'
  | 'theme_purchased'
  | 'theme_equipped'
  | 'vip_perk_unlocked'
  | 'subscription_renewed'
  | 'subscription_expired';

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  metadata: Record<string, any>
  is_read: boolean
  is_dismissed?: boolean
  created_at: string
  username?: string
  avatar_url?: string
}

export interface NotificationMetadata {
  action_url?: string
  // Gift related
  gift_id?: string
  sender_id?: string
  sender_username?: string
  sender_glowing_color?: string
  coins_spent?: number
  // Stream related
  stream_id?: string
  stream_title?: string
  broadcaster_id?: string
  // Badge related
  badge_id?: string
  earned_at?: string
  // Payout related
  payout_id?: string
  status?: string
  amount?: number
  cash_amount?: number
  // Moderation
  action_id?: string
  action_type?: string
  reason?: string
  // Battle
  battle_id?: string
  winner_id?: string
  coins_earned?: number
  // Court/Jail
  case_id?: string
  docket_id?: string
  fine_amount?: number
  evidence_id?: string
  appeal_id?: string
  decision?: string
  // Auction/Marketplace
  order_id?: string
  listing_id?: string
  bid_amount?: number
  tracking_number?: string
  dispute_id?: string
  rating?: number
  // Family
  family_id?: string
  role?: string
  xp_milestone?: number
  // Store
  item_id?: string
  order_number?: string
  // Referral
  referred_user_id?: string
  [key: string]: any
}