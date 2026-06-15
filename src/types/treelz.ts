export interface TreelzPost {
  id: string
  user_id: string
  video_url: string
  thumbnail_url?: string | null
  caption?: string
  video_duration_seconds?: number
  video_size_bytes?: number
  likes_count?: number
  comments_count?: number
  shares_count?: number
  saves_count?: number
  views_count?: number
  watch_time_seconds?: number
  completion_rate?: number
  gifts_received?: number
  coins_received?: number
  is_ai_flagged?: boolean
  ai_detection_score?: number
  ai_review_status?: 'pending' | 'reviewed' | 'cleared' | 'actioned'
  status?: 'active' | 'hidden' | 'removed' | 'age_restricted'
  is_featured?: boolean
  is_pinned?: boolean
  is_boosted?: boolean
  boost_expires_at?: string | null
  is_live_promotion?: boolean
  live_stream_id?: string | null
  created_at: string
  updated_at?: string
  author?: TreelzAuthor
  user_interaction?: TreelzUserInteraction
}

export interface TreelzAuthor {
  id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
  role?: string
  troll_role?: string
  is_verified?: boolean
}

export interface TreelzUserInteraction {
  liked: boolean
  saved: boolean
}

export interface TreelzComment {
  id: string
  user_id: string
  post_id: string
  content: string
  created_at: string
  author?: TreelzAuthor
}

export interface TreelzTip {
  id: string
  from_user_id: string
  to_user_id: string
  post_id: string
  amount: number
  created_at: string
}

export interface TreelzShare {
  id: string
  user_id: string
  post_id: string
  platform: string
  created_at: string
}

export interface TreelzAiFlag {
  id: string
  post_id: string
  flagged_at: string
  confidence: number
  action_taken: 'pending' | 'cleared' | 'removed' | 'age_restricted'
  reviewed_by?: string | null
  reviewed_at?: string | null
}

export interface TreelzUploadBan {
  id: string
  user_id: string
  reason: string
  banned_until?: string | null
  strike_count: number
  created_at: string
}

export interface TreelzSettings {
  autoPlayNext: boolean
  autoPlayEnabled: boolean
  soundOnByDefault: boolean
  uploadQuality: 'low' | 'medium' | 'high'
}

export interface TreelzAnalytics {
  post_id: string
  views: number
  watch_time_seconds: number
  completion_rate: number
  shares: number
  gifts_received: number
  coins_received: number
}

export interface TreelzFeedCursor {
  created_at: string
  id: string
}

export type TreelzModerationAction =
  | 'feature'
  | 'pin'
  | 'boost'
  | 'hide'
  | 'remove'
  | 'age_restrict'
  | 'disable_uploads'
  | 'enable_uploads'
