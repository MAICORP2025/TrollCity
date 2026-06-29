/**
 * useStaffAudit Hook
 *
 * Provides access to the staff action audit log for the Staff Audit Dashboard.
 * Fetches audit entries, summaries, and permission matrix data.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

// ─── Types ───────────────────────────────────────────────────

export interface StaffAuditEntry {
  id: string;
  staff_user_id: string;
  staff_role: string;
  staff_email: string;
  action_type: string;
  action_category: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown>;
  route_path: string | null;
  result: string;
  error_message: string | null;
  created_at: string;
}

export interface StaffAuditSummary {
  staff_role: string;
  action_type: string;
  action_count: number;
  last_action: string;
  denied_count: number;
}

export interface PermissionEntry {
  id: string;
  role_name: string;
  resource: string;
  permission: string;
  conditions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StaffAuditFilters {
  staffRole?: string;
  actionType?: string;
  actionCategory?: string;
  targetType?: string;
  result?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// ─── Hook ────────────────────────────────────────────────────

export function useStaffAudit(filters?: StaffAuditFilters) {
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<StaffAuditEntry[]>([]);
  const [summary, setSummary] = useState<StaffAuditSummary[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const isAdmin =
    profile?.is_admin ||
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    profile?.role === 'ceo';

  // Fetch audit entries
  const fetchEntries = useCallback(async () => {
    if (!profile || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('staff_action_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.staffRole) {
        query = query.eq('staff_role', filters.staffRole);
      }
      if (filters?.actionType) {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters?.actionCategory) {
        query = query.eq('action_category', filters.actionCategory);
      }
      if (filters?.targetType) {
        query = query.eq('target_type', filters.targetType);
      }
      if (filters?.result) {
        query = query.eq('result', filters.result);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      if (filters?.search) {
        query = query.or(
          `target_name.ilike.%${filters.search}%,staff_email.ilike.%${filters.search}%,action_type.ilike.%${filters.search}%`
        );
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setEntries((data || []) as StaffAuditEntry[]);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('[useStaffAudit] Fetch error:', err);
      setError(err.message || 'Failed to fetch audit entries');
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, page, filters]);

  // Fetch summary
  const fetchSummary = useCallback(async (days: number = 7) => {
    if (!isAdmin) return;

    try {
      const { data, error: summaryError } = await supabase.rpc(
        'get_staff_audit_summary',
        { p_days: days }
      );

      if (summaryError) throw summaryError;
      setSummary((data || []) as StaffAuditSummary[]);
    } catch (err: any) {
      console.error('[useStaffAudit] Summary error:', err);
    }
  }, [isAdmin]);

  // Fetch permission matrix
  const fetchPermissions = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error: permError } = await supabase
        .from('role_permission_matrix')
        .select('*')
        .order('role_name')
        .order('resource');

      if (permError) throw permError;
      setPermissions((data || []) as PermissionEntry[]);
    } catch (err: any) {
      console.error('[useStaffAudit] Permissions error:', err);
    }
  }, [isAdmin]);

  // Update permission
  const updatePermission = useCallback(
    async (id: string, permission: 'allow' | 'deny') => {
      if (!isAdmin) return false;

      try {
        const { error: updateError } = await supabase
          .from('role_permission_matrix')
          .update({ permission, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (updateError) throw updateError;

        // Refresh permissions
        await fetchPermissions();
        return true;
      } catch (err: any) {
        console.error('[useStaffAudit] Update permission error:', err);
        setError(err.message || 'Failed to update permission');
        return false;
      }
    },
    [isAdmin, fetchPermissions]
  );

  // Add permission
  const addPermission = useCallback(
    async (roleName: string, resource: string, permission: 'allow' | 'deny') => {
      if (!isAdmin) return false;

      try {
        const { error: insertError } = await supabase
          .from('role_permission_matrix')
          .insert({ role_name: roleName, resource, permission });

        if (insertError) throw insertError;

        await fetchPermissions();
        return true;
      } catch (err: any) {
        console.error('[useStaffAudit] Add permission error:', err);
        setError(err.message || 'Failed to add permission');
        return false;
      }
    },
    [isAdmin, fetchPermissions]
  );

  // Remove permission
  const removePermission = useCallback(
    async (id: string) => {
      if (!isAdmin) return false;

      try {
        const { error: deleteError } = await supabase
          .from('role_permission_matrix')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        await fetchPermissions();
        return true;
      } catch (err: any) {
        console.error('[useStaffAudit] Remove permission error:', err);
        setError(err.message || 'Failed to remove permission');
        return false;
      }
    },
    [isAdmin, fetchPermissions]
  );

  // Initial fetch
  useEffect(() => {
    fetchEntries();
    fetchSummary();
    fetchPermissions();
  }, [fetchEntries, fetchSummary, fetchPermissions]);

  return {
    entries,
    summary,
    permissions,
    loading,
    error,
    totalCount,
    page,
    pageSize,
    setPage,
    refresh: fetchEntries,
    refreshSummary: fetchSummary,
    refreshPermissions: fetchPermissions,
    updatePermission,
    addPermission,
    removePermission,
    isAdmin,
  };
}
