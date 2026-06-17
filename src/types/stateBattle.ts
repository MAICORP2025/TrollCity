// ============================================================
// State Battle Types
// ============================================================

export interface StateRow {
  id: string;
  state_code: string;
  state_name: string;
  battle_points: number;
  wins: number;
  losses: number;
  representative_user_id: string | null;
  monthly_points: number;
  monthly_wins: number;
  monthly_losses: number;
  last_month_reset: string;
  updated_at: string;
}

export interface StateMemberRow {
  user_id: string;
  state_code: string;
  joined_at: string;
  battle_points_earned: number;
  battles_participated: number;
  battles_won: number;
}

export interface StateBattleRow {
  id: string;
  battle_id: string | null;
  state_a: string;
  state_b: string;
  winner_state: string | null;
  points_awarded: number;
  host_user_id: string | null;
  challenger_user_id: string | null;
  created_at: string;
}

export interface StateLeaderboardEntry {
  rank: number;
  state_code: string;
  state_name: string;
  battle_points: number;
  wins: number;
  losses: number;
  representative_user_id: string | null;
  representative_username: string | null;
}

export interface StateMonthlyReward {
  id: string;
  state_code: string;
  reward_month: string;
  rank: number;
  badge_awarded: string | null;
  profile_frame_awarded: string | null;
  troll_coins_awarded: number;
  created_at: string;
}

export type BattleModeType = 'world' | 'state';

export interface StateBattleMatchResult {
  matched: boolean;
  battle_id?: string;
  battle_started_at?: string;
  battle_ends_at?: string;
  opponent_stream_id?: string;
  opponent_state?: string;
  broadcaster_state?: string;
  error?: string;
}

export interface RecordStateBattleResult {
  success: boolean;
  draw?: boolean;
  winner_state?: string;
  loser_state?: string;
  points_awarded?: number;
  state_battle_id?: string;
  error?: string;
}
