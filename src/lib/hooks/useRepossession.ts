import { useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import { toast } from 'sonner';

/**
 * Hook for managing repossession actions (properties, vehicles, court summons)
 * for delinquent loan users.
 */
export function useRepossession() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [delinquentUsers, setDelinquentUsers] = useState<any[]>([]);

  /**
   * Fetch users with delinquent loans
   */
  const fetchDelinquentUsers = useCallback(async () => {
    if (!user) return { success: false, error: 'User not logged in' };
    
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_delinquent_loan_users');
      
      if (error) throw error;
      
      setDelinquentUsers(data || []);
      return { success: true, data };
    } catch (error: any) {
      console.error('Error fetching delinquent users:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Get user's assets (properties, vehicles, loans)
   */
  const getUserAssets = useCallback(async (userId: string) => {
    if (!user) return { success: false, error: 'User not logged in' };
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_user_assets', { user_id: userId });
      
      if (error) throw error;
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Error fetching user assets:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Repossess a property
   */
  const repossessProperty = useCallback(async (propertyId: string, reason?: string) => {
    if (!user) return { success: false, error: 'User not logged in' };
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'repossess_property',
          propertyId,
          reason,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to repossess property');
      }

      toast.success('Property repossessed successfully!');
      return { success: true, data: result.data };
    } catch (error: any) {
      console.error('Error repossessing property:', error);
      toast.error(error.message || 'Failed to repossess property');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Repossess a vehicle
   */
  const repossessVehicle = useCallback(async (vehicleId: string, reason?: string) => {
    if (!user) return { success: false, error: 'User not logged in' };
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'repossess_vehicle',
          vehicleId,
          reason,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to repossess vehicle');
      }

      toast.success('Vehicle repossessed successfully!');
      return { success: true, data: result.data };
    } catch (error: any) {
      console.error('Error repossessing vehicle:', error);
      toast.error(error.message || 'Failed to repossess vehicle');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Issue instant court summon for loan default
   */
  const issueLoanDefaultSummon = useCallback(async (
    targetUserId: string,
    summonType: 'property_repossession' | 'vehicle_repossession' | 'loan_default_hearing',
    reason?: string
  ) => {
    if (!user) return { success: false, error: 'User not logged in' };
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'issue_loan_default_summon',
          targetUserId,
          summonType,
          reason,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to issue court summon');
      }

      toast.success('Court summon issued successfully!');
      return { success: true, data: result.data };
    } catch (error: any) {
      console.error('Error issuing court summon:', error);
      toast.error(error.message || 'Failed to issue court summon');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Restore repossessed asset (when loan is paid)
   */
  const restoreRepossessedAsset = useCallback(async (
    assetId: string,
    assetType: 'property' | 'vehicle',
    targetUserId: string
  ) => {
    if (!user) return { success: false, error: 'User not logged in' };
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore_repossessed_asset',
          assetId,
          assetType,
          targetUserId,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to restore asset');
      }

      toast.success('Asset restored successfully!');
      return { success: true, data: result.data };
    } catch (error: any) {
      console.error('Error restoring asset:', error);
      toast.error(error.message || 'Failed to restore asset');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    loading,
    delinquentUsers,
    fetchDelinquentUsers,
    getUserAssets,
    repossessProperty,
    repossessVehicle,
    issueLoanDefaultSummon,
    restoreRepossessedAsset,
  };
}
