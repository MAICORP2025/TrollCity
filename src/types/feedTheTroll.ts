// ============================================================================
// Feed the Troll — shared TypeScript types
// ============================================================================

export type TrollEvolutionStage = 'baby' | 'young' | 'warrior' | 'king';

export type TrollGiftSize = 'small' | 'medium' | 'large' | 'legendary';

export type TrollPersonalityState =
  | 'idle'
  | 'happy'
  | 'excited'
  | 'sleepy'
  | 'sleeping'
  | 'eating'
  | 'dancing'
  | 'cheering'
  | 'battle_ready'
  | 'winning'
  | 'losing'
  | 'celebrating'
  | 'surprised'
  | 'full'
  | 'evolving';

export type TrollEventPriority =
  | 'evolving'
  | 'legendary_gift'
  | 'battle_result'
  | 'milestone'
  | 'large_gift'
  | 'gift_train'
  | 'eating'
  | 'cheering'
  | 'sleeping'
  | 'idle';

// ----------------------------------------------------------------------------
// Database row shapes (subset needed by the client)
// ----------------------------------------------------------------------------

export interface TrollFeedState {
  broadcaster_id: string;
  current_cycle_balance: number;
  lifetime_fed_coins: number;
  total_feedings: number;
  unique_feeders: number;
  cashout_count: number;
  current_cycle_index: number;
  evolution_stage: TrollEvolutionStage;
  current_seasonal_theme: string | null;
  personality_state: TrollPersonalityState;
  last_fed_at: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrollFeedTransaction {
  id: string;
  broadcaster_id: string;
  sender_id: string;
  stream_id: string | null;
  battle_id: string | null;
  gift_id: string | null;
  gift_name: string | null;
  eligible_gift_value: number;
  troll_allocation: number;
  size_category: TrollGiftSize;
  cycle_index: number;
  idempotency_key: string | null;
  created_at: string;
}

export interface TrollFeedLeaderboardEntry {
  broadcaster_id: string;
  sender_id: string;
  total_eligible_value: number;
  total_troll_allocated: number;
  feeding_count: number;
  largest_single_feed: number;
  updated_at: string;
  // Joined profile fields (when fetched with profile join)
  username?: string;
  avatar_url?: string | null;
  is_watching?: boolean;
}

export interface TrollFeedCashout {
  id: string;
  broadcaster_id: string;
  cycle_index: number;
  amount_cashed_out: number;
  created_at: string;
}

export interface TrollFeedEvolutionHistoryEntry {
  id: string;
  broadcaster_id: string;
  from_stage: TrollEvolutionStage | null;
  to_stage: TrollEvolutionStage;
  lifetime_fed_at_transition: number;
  created_at: string;
}

export interface TrollFeedMilestone {
  broadcaster_id: string;
  milestone_id: string;
  completed_at: string;
  progress: number;
  claimed: boolean;
}

export interface TrollFeedMilestoneConfig {
  id: string;
  category: 'feeding_count' | 'lifetime_coins' | 'cashout_count' | 'unique_feeders' | 'gift_train' | 'evolution' | 'battle_wins';
  name: string;
  description: string | null;
  icon: string | null;
  requirement: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Royal Troll';
}

export interface TrollFeedGiftTrain {
  broadcaster_id: string;
  current_train_count: number;
  current_train_started_at: string | null;
  largest_train_this_live: number;
  largest_train_lifetime: number;
  top_contributor_id: string | null;
  top_contributor_count: number;
  updated_at: string;
}

export interface TrollFeedSettings {
  broadcaster_id: string;
  cashout_threshold: number;
  sleep_after_idle_ms: number;
  sleepy_after_idle_ms: number;
  created_at: string;
  updated_at: string;
}

export interface TrollFeedEvolutionConfig {
  stage: TrollEvolutionStage;
  display_name: string;
  min_lifetime_fed_coins: number;
  sort_order: number;
  badge_label: string | null;
  theme_key: string | null;
  is_active: boolean;
}

export interface TrollFeedSeasonalTheme {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  asset_key: string;
  minimum_stage: TrollEvolutionStage | null;
  maximum_stage: TrollEvolutionStage | null;
  is_active: boolean;
  priority: number;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Realtime event model (one consistent event system for Broadcast + Viewer)
// ----------------------------------------------------------------------------

export type TrollRealtimeEventType =
  | 'troll_fed'
  | 'troll_state_changed'
  | 'troll_gift_train_started'
  | 'troll_gift_train_updated'
  | 'troll_gift_train_ended'
  | 'troll_milestone_completed'
  | 'troll_evolved'
  | 'troll_cashout_completed'
  | 'troll_battle_started'
  | 'troll_battle_lead_changed'
  | 'troll_battle_won'
  | 'troll_battle_lost'
  | 'troll_battle_tied'
  | 'troll_seasonal_theme_changed';

export interface TrollRealtimeEvent {
  eventId?: string;
  eventType: TrollRealtimeEventType;
  trollOwnerId: string;
  streamId?: string | null;
  battleId?: string | null;
  senderId?: string | null;
  senderDisplayName?: string | null;
  giftId?: string | null;
  giftName?: string | null;
  eligibleGiftValue?: number;
  trollAllocation?: number;
  evolutionStage?: TrollEvolutionStage;
  milestoneId?: string | null;
  cashoutAmount?: number;
  sizeCategory?: TrollGiftSize;
  evolved?: boolean;
  cashoutCompleted?: boolean;
  createdAt: string;
}

// Animation variant lists (server-informed category; client-randomized pick).
export type TrollAnimationVariant =
  | 'bite_1' | 'bite_2' | 'catch_and_chew' | 'quick_snack'
  | 'happy_hop' | 'two_hand_feast' | 'spin_and_bite' | 'mini_dance'
  | 'belly_pat' | 'big_burp' | 'victory_dance' | 'confetti_jump'
  | 'royal_feast' | 'firework_pose' | 'crown_glow' | 'stage_transformation'
  | 'sad_sit' | 'tiny_faint' | 'head_drop' | 'shoulder_shrug' | 'determined_recovery';

export type TrollPanelTab = 'status' | 'topGifters' | 'recent' | 'milestones' | 'hallOfFame';
export type HallOfFameWindow = 'live' | 'weekly' | 'monthly' | 'lifetime';
