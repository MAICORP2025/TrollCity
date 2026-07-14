// Types and constants for the Beta Feedback system.

export type BetaFeedbackCategory =
  | 'Bug Report'
  | 'Mobile / PWA'
  | 'Broadcast'
  | 'Chat'
  | 'Neighborhoods'
  | 'Troll Court'
  | 'Troll Coins'
  | 'Performance'
  | 'Account / Login'
  | 'Design / UI'
  | 'Feature Request'
  | 'Other'

export type BetaFeedbackStatus =
  | 'submitted'
  | 'under_review'
  | 'needs_information'
  | 'confirmed'
  | 'planned'
  | 'in_progress'
  | 'fixed'
  | 'declined'
  | 'duplicate'
  | 'closed'

export type BetaFeedbackPriority = 'low' | 'normal' | 'high' | 'critical'

export type BetaFeedbackSeverity =
  | 'minor'
  | 'inconvenient'
  | 'feature_blocking'
  | 'app_unusable'

export type BetaFeedbackDevice =
  | 'iPhone'
  | 'iPad'
  | 'Android Phone'
  | 'Android Tablet'
  | 'Windows'
  | 'macOS'
  | 'Chromebook'
  | 'Other'

export type BetaReplyVisibility = 'user_visible' | 'staff_only'

export interface BetaFeedback {
  id: string
  public_id: string
  user_id: string
  category: BetaFeedbackCategory
  title: string
  description: string
  affected_feature: string | null
  affected_route: string | null
  device_type: BetaFeedbackDevice | null
  browser_name: string | null
  user_agent: string | null
  viewport_width: number | null
  viewport_height: number | null
  is_pwa: boolean
  app_version: string | null
  screenshot_url: string | null
  severity: BetaFeedbackSeverity | null
  priority: BetaFeedbackPriority
  status: BetaFeedbackStatus
  assigned_to: string | null
  duplicate_of: string | null
  moderator_response: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  archived_at: string | null
}

export interface BetaFeedbackInternalNote {
  id: string
  feedback_id: string
  moderator_id: string
  note: string
  created_at: string
  updated_at: string
}

export interface BetaFeedbackAuditEntry {
  id: string
  feedback_id: string
  actor_id: string
  action: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export interface BetaFeedbackReply {
  id: string
  feedback_id: string
  author_id: string
  body: string
  visibility: BetaReplyVisibility
  created_at: string
}

export interface BetaFeedbackUserGroup {
  user_id: string
  username: string | null
  avatar_url: string | null
  submission_count: number
  latest_submission_at: string | null
  unresolved_count: number
}

export interface BetaFeedbackStats {
  total: number
  submitted: number
  under_review: number
  critical: number
  fixed: number
  unique_reporters: number
}

export const BETA_FEEDBACK_CATEGORIES: BetaFeedbackCategory[] = [
  'Bug Report',
  'Mobile / PWA',
  'Broadcast',
  'Chat',
  'Neighborhoods',
  'Troll Court',
  'Troll Coins',
  'Performance',
  'Account / Login',
  'Design / UI',
  'Feature Request',
  'Other',
]

export const BETA_FEEDBACK_STATUSES: BetaFeedbackStatus[] = [
  'submitted',
  'under_review',
  'needs_information',
  'confirmed',
  'planned',
  'in_progress',
  'fixed',
  'declined',
  'duplicate',
  'closed',
]

export const BETA_FEEDBACK_PRIORITIES: BetaFeedbackPriority[] = [
  'low',
  'normal',
  'high',
  'critical',
]

export const BETA_FEEDBACK_SEVERITIES: BetaFeedbackSeverity[] = [
  'minor',
  'inconvenient',
  'feature_blocking',
  'app_unusable',
]

export const BETA_FEEDBACK_DEVICES: BetaFeedbackDevice[] = [
  'iPhone',
  'iPad',
  'Android Phone',
  'Android Tablet',
  'Windows',
  'macOS',
  'Chromebook',
  'Other',
]

export interface BetaFeedbackUserRef {
  username: string | null
  avatar_url: string | null
}

export type BetaFeedbackWithUser = BetaFeedback & {
  user_profiles?: BetaFeedbackUserRef | null
}

export const STATUS_LABELS: Record<BetaFeedbackStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  needs_information: 'Needs Info',
  confirmed: 'Confirmed',
  planned: 'Planned',
  in_progress: 'In Progress',
  fixed: 'Fixed',
  declined: 'Declined',
  duplicate: 'Duplicate',
  closed: 'Closed',
}

export const PRIORITY_LABELS: Record<BetaFeedbackPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
}

export const SEVERITY_LABELS: Record<BetaFeedbackSeverity, string> = {
  minor: 'Minor',
  inconvenient: 'Inconvenient',
  feature_blocking: 'Feature Blocking',
  app_unusable: 'App Unusable',
}

// Tailwind classes for status badges.
export const STATUS_BADGE_CLASSES: Record<BetaFeedbackStatus, string> = {
  submitted: 'bg-slate-600/40 text-slate-200 border-slate-400/40',
  under_review: 'bg-cyan-600/30 text-cyan-200 border-cyan-400/50',
  needs_information: 'bg-amber-600/30 text-amber-200 border-amber-400/50',
  confirmed: 'bg-violet-600/30 text-violet-200 border-violet-400/50',
  planned: 'bg-indigo-600/30 text-indigo-200 border-indigo-400/50',
  in_progress: 'bg-blue-600/30 text-blue-200 border-blue-400/50',
  fixed: 'bg-emerald-600/30 text-emerald-200 border-emerald-400/50',
  declined: 'bg-rose-600/30 text-rose-200 border-rose-400/50',
  duplicate: 'bg-zinc-600/30 text-zinc-200 border-zinc-400/40',
  closed: 'bg-slate-700/40 text-slate-300 border-slate-500/40',
}

export const PRIORITY_BADGE_CLASSES: Record<BetaFeedbackPriority, string> = {
  low: 'bg-slate-600/30 text-slate-200 border-slate-400/40',
  normal: 'bg-slate-600/30 text-slate-200 border-slate-400/40',
  high: 'bg-orange-600/30 text-orange-200 border-orange-400/50',
  critical: 'bg-red-600/40 text-red-200 border-red-400/60',
}

// Statuses that count as "resolved" for the moderator summary.
export const RESOLVED_STATUSES: BetaFeedbackStatus[] = [
  'fixed',
  'closed',
  'declined',
  'duplicate',
]
