export interface XTrollzStream {
  id: string
  user_id: string
  title: string
  description?: string
  category: string
  is_private: boolean
  viewer_count: number
  started_at: string
  cover_image_url?: string
  thumbnail_url?: string
  streamer_display_name?: string
  profile_image_url?: string
  tags?: string[]
  status: string
  livekit_room_name?: string
  created_at: string
  updated_at: string
}

export interface XTrollzFavorite {
  streamer_id: string
  display_name: string
  avatar_url?: string
  is_live: boolean
  title?: string
  category?: string
  viewer_count?: number
  last_live_at?: string
  created_at: string
}

export type ViewerTab = 'live_now' | 'favorites' | 'categories'

export const XTROLLZ_CATEGORIES = [
  'Amateur',
  'Professional',
  'Fetish',
  'BDSM',
  'Roleplay',
  'Solo',
  'Couples',
  'Group',
  'Trans',
  'Other',
] as const

export type XTrollzCategory = typeof XTROLLZ_CATEGORIES[number]
