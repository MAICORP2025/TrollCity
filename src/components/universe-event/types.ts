export interface Tournament {
  id: string
  title: string
  subtitle?: string
  status: 'draft' | 'open' | 'live' | 'ended' | 'upcoming'
  start_at: string
  end_at?: string
  entry_fee?: number
  prize_pool?: string
  rules_text?: string
  theme?: string
  season?: string
  max_participants?: number
  description?: string
}

export interface Participant {
  tournament_id: string
  user_id: string
  joined_at: string
  score?: number
  points?: number
  wins?: number
  losses?: number
  status: 'active' | 'eliminated' | 'withdrawn'
  placement?: number
  stats?: {
    withdrawn?: boolean
    withdrawn_at?: string
    [key: string]: any
  }
  user_profile?: {
    username: string
    avatar_url: string
  }
}
