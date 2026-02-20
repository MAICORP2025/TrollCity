/**
 * Bug Alert Types
 * Real-time bug reporting system for admin notifications
 */

export type BugAlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type BugAlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export type BugAlertCategory = 
  | 'broadcast' 
  | 'auth' 
  | 'database' 
  | 'payment' 
  | 'chat' 
  | 'ui' 
  | 'performance' 
  | 'security'
  | 'other';

export interface BugAlert {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  severity: BugAlertSeverity;
  category: BugAlertCategory;
  status: BugAlertStatus;
  reported_by: string | null;
  reported_by_username: string | null;
  affected_users: string[];
  affected_components: string[];
  error_message: string | null;
  stack_trace: string | null;
  user_agent: string | null;
  page_url: string | null;
  metadata: Record<string, unknown>;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  admin_notes: string | null;
}

export interface BugAlertCreate {
  title: string;
  description: string;
  severity: BugAlertSeverity;
  category: BugAlertCategory;
  error_message?: string;
  stack_trace?: string;
  affected_components?: string[];
  metadata?: Record<string, unknown>;
}

export interface BugAlertFilters {
  status?: BugAlertStatus;
  severity?: BugAlertSeverity;
  category?: BugAlertCategory;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface BugAlertStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  active: number;
  acknowledged: number;
  resolved: number;
}

export interface RealtimeBugAlertPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  new: BugAlert;
  old: BugAlert | null;
}

export const BUG_ALERT_SEVERITY_ORDER: BugAlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
export const BUG_ALERT_STATUS_COLORS: Record<BugAlertSeverity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
};
