/**
 * Troll City Background Audio Safety & Location System Types
 *
 * Covers:
 * - Audio safety monitoring
 * - Safety alerts
 * - User IP/location intelligence
 * - Admin audit logging
 *
 * Role model note:
 * This file uses current Troll City canonical roles only.
 * Do not reintroduce moderator, super_admin, platform_admin,
 * troll_officer, or lead_troll_officer here unless the app role model changes.
 */

// ============================================================
// CANONICAL TROLL CITY ROLE TYPES
// ============================================================

export type TrollCitySafetyRole =
  | 'admin'
  | 'ceo'
  | 'staff'
  | 'officer'
  | 'broadofficer'
  | 'secretary'
  | 'president';

export type LocationAccessRole =
  | 'admin'
  | 'ceo'
  | 'secretary';

export type SafetyAlertAccessRole = TrollCitySafetyRole;

export const LOCATION_ACCESS_ROLES: LocationAccessRole[] = [
  'admin',
  'ceo',
  'secretary'
];

export const SAFETY_ALERT_ACCESS_ROLES: SafetyAlertAccessRole[] = [
  'admin',
  'ceo',
  'staff',
  'officer',
  'broadofficer',
  'secretary',
  'president'
];

export const canAccessSafetyAlerts = (role?: string | null): role is SafetyAlertAccessRole => {
  if (!role) return false;
  return SAFETY_ALERT_ACCESS_ROLES.includes(role.toLowerCase() as SafetyAlertAccessRole);
};

export const canAccessLocationIntelligence = (role?: string | null): role is LocationAccessRole => {
  if (!role) return false;
  return LOCATION_ACCESS_ROLES.includes(role.toLowerCase() as LocationAccessRole);
};

// ============================================================
// SAFETY ALERT TYPES
// ============================================================

export type SafetyTriggerType = 'SELF_HARM' | 'THREAT' | 'VIOLENCE' | 'ABUSE';

export type AlertLevel = 1 | 2 | 3;

export type SafetyAlertReviewStatus =
  | 'unreviewed'
  | 'reviewing'
  | 'reviewed'
  | 'dismissed'
  | 'escalated';

export interface SafetyAlert {
  id: string;
  stream_id: string;
  user_id: string;
  trigger_type: SafetyTriggerType;
  trigger_phrase: string;
  audio_chunk_timestamp: string;
  alert_level: AlertLevel;
  review_status?: SafetyAlertReviewStatus;
  reviewed_by?: string | null;
  action_taken?: SafetyAction | string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SafetyAlertWithDetails extends SafetyAlert {
  user_username: string;
  stream_title?: string | null;
  reviewer_username?: string | null;
  total_triggers?: number;
  alert_status: 'HIGH PRIORITY' | 'FLAGGED' | 'NOTIFICATION';
}

export interface CreateSafetyAlertRequest {
  stream_id: string;
  user_id: string;
  trigger_type: SafetyTriggerType;
  trigger_phrase: string;
}

export interface CreateSafetyAlertResponse {
  alert_id: string;
  alert_level: AlertLevel;
  total_triggers: number;
}

export interface ReviewSafetyAlertRequest {
  alert_id: string;
  action_taken: SafetyAction;
  review_notes?: string;
}

// ============================================================
// SAFETY ACTIONS
// ============================================================

export type SafetyAction =
  | 'JOIN_STREAM'
  | 'REVIEW_STREAM'
  | 'ISSUE_WARNING'
  | 'END_BROADCAST'
  | 'SEND_TO_TROLL_COURT'
  | 'PLACE_IN_TROLL_JAIL'
  | 'DISMISSED'
  | 'NO_ACTION';

export interface SafetyActionOption {
  value: SafetyAction;
  label: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  icon: string;
}

export const SAFETY_ACTIONS: SafetyActionOption[] = [
  {
    value: 'JOIN_STREAM',
    label: 'Join Stream',
    description: 'Enter the stream to observe the situation.',
    severity: 'low',
    icon: 'Eye'
  },
  {
    value: 'REVIEW_STREAM',
    label: 'Review Stream',
    description: 'Mark the stream for closer monitoring.',
    severity: 'low',
    icon: 'Search'
  },
  {
    value: 'NO_ACTION',
    label: 'No Action',
    description: 'Close the review with no enforcement action.',
    severity: 'low',
    icon: 'CheckCircle'
  },
  {
    value: 'DISMISSED',
    label: 'Dismiss Alert',
    description: 'Dismiss the alert as not actionable.',
    severity: 'low',
    icon: 'XCircle'
  },
  {
    value: 'ISSUE_WARNING',
    label: 'Issue Warning',
    description: 'Send a warning to the user.',
    severity: 'medium',
    icon: 'AlertTriangle'
  },
  {
    value: 'END_BROADCAST',
    label: 'End Broadcast',
    description: 'Immediately terminate the stream.',
    severity: 'high',
    icon: 'StopCircle'
  },
  {
    value: 'SEND_TO_TROLL_COURT',
    label: 'Send to Troll Court',
    description: 'Escalate the incident to judicial review.',
    severity: 'high',
    icon: 'Gavel'
  },
  {
    value: 'PLACE_IN_TROLL_JAIL',
    label: 'Place in Troll Jail',
    description: 'Apply immediate jail restriction pending or after review.',
    severity: 'high',
    icon: 'Lock'
  }
];

// ============================================================
// KEYWORD DETECTION TYPES
// ============================================================

export interface KeywordCategory {
  name: SafetyTriggerType;
  keywords: string[];
  severity: AlertLevel;
  description: string;
}

export interface DetectedKeyword {
  category: SafetyTriggerType;
  keyword: string;
  severity: AlertLevel;
  position: number;
}

export interface AudioChunkResult {
  chunk_id: string;
  stream_id: string;
  user_id: string;
  transcript: string;
  detected_keywords: DetectedKeyword[];
  timestamp: string;
  should_alert: boolean;
}

// ============================================================
// USER LOCATION TYPES
// ============================================================

export type UserLocationSource = 'login' | 'signup' | 'manual_lookup';

export interface UserIpLocation {
  id: string;
  user_id: string;
  ip_address: string;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  country?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isp?: string | null;
  organization?: string | null;
  timezone?: string | null;
  source: UserLocationSource;
  created_at: string;
}

export interface UserLocationWithProfile extends UserIpLocation {
  username: string;
  email?: string | null;
  role: string;
}

export interface UserLocationSearchRequest {
  search_type: 'username' | 'user_id' | 'ip_address';
  search_value: string;
}

export interface EmergencyUserInfo {
  user_id: string;
  username: string;
  email?: string | null;
  latest_ip?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isp?: string | null;
  last_seen?: string | null;
}

// ============================================================
// AUDIT LOG TYPES
// ============================================================

export type AuditActionType =
  | 'safety_alert_generated'
  | 'safety_alert_reviewed'
  | 'admin_location_lookup'
  | 'emergency_info_accessed'
  | 'stream_ended_safety'
  | 'warning_issued_safety'
  | 'troll_court_referral'
  | 'user_jailed_safety';

export interface AdminAuditLog {
  id: string;
  admin_id?: string | null;

  /**
   * Preferred database column for Troll City audit logs.
   * Use this when the table is public.admin_audit_log/action.
   */
  action?: AuditActionType | string;

  /**
   * Backward-compatible field for older UI code that still expects action_type.
   * Remove later only after all callers are migrated to action.
   */
  action_type?: AuditActionType | string;

  target_user_id?: string | null;
  target_stream_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AdminAuditLogWithDetails extends AdminAuditLog {
  admin_username?: string | null;
  target_username?: string | null;
  stream_title?: string | null;
}

// ============================================================
// STREAM MONITORING TYPES
// ============================================================

export interface StreamAudioMonitoring {
  id: string;
  stream_id: string;
  user_id: string;
  is_monitored: boolean;
  monitoring_started_at: string;
  monitoring_ended_at?: string | null;
  total_triggers: number;
  last_trigger_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreamMonitoringStatus {
  stream_id: string;
  title: string;
  category?: string | null;
  user_id: string;
  broadcaster_name: string;
  is_live: boolean;
  current_viewers: number;
  is_monitored?: boolean;
  monitoring_started_at?: string | null;
  total_triggers?: number;
  last_trigger_at?: string | null;
  pending_alerts: number;
  highest_alert_level?: AlertLevel | null;
}

// ============================================================
// DASHBOARD VIEW TYPES
// ============================================================

export interface SafetyAlertDashboardItem {
  id: string;
  stream_id: string;
  user_id: string;
  user_username: string;
  stream_title?: string | null;
  trigger_type: SafetyTriggerType;
  trigger_phrase: string;
  alert_level: AlertLevel;
  alert_status: string;
  audio_chunk_timestamp: string;
  created_at: string;
  total_triggers?: number;
}

export interface LocationIntelligenceItem {
  user_id: string;
  username: string;
  role: string;
  email?: string | null;
  ip_address: string;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  country?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isp?: string | null;
  organization?: string | null;
  timezone?: string | null;
  source: string;
  last_seen: string;
}

// ============================================================
// OFFICER / STAFF DASHBOARD TYPES
// ============================================================

export interface SafetyAlertFilters {
  trigger_type?: SafetyTriggerType;
  alert_level?: AlertLevel;
  date_from?: string;
  date_to?: string;
  search_query?: string;
}

export interface AlertStats {
  total_alerts_today: number;
  unreviewed_alerts: number;
  high_priority_alerts: number;
  alerts_by_type: Partial<Record<SafetyTriggerType, number>>;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface SafetySystemStatus {
  is_monitoring_active: boolean;
  active_monitored_streams: number;
  total_alerts_24h: number;
  alerts_requiring_review: number;
}

export interface GeolocationApiResponse {
  ip: string;
  city?: string;
  region?: string;
  region_code?: string;
  country?: string;
  country_code?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  asn?: string;
}
