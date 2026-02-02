import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import { toast } from 'sonner';

interface BroadcastLockdownSettings {
  enabled: boolean;
  admin_broadcast_room: string | null;
}

// interface MaxBroadcastersSettings {
//   limit: number;
// }

export function useBroadcastLockdown() {
  const { profile } = useAuthStore();
  const [settings, setSettings] = useState<BroadcastLockdownSettings>({
    enabled: false,
    admin_broadcast_room: null
  });
  const [maxBroadcasters, setMaxBroadcasters] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load lockdown settings
        const { data: lockdownData, error: lockdownError } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'broadcast_lockdown_enabled')
          .maybeSingle();

        if (lockdownError) throw lockdownError;
        
        if (lockdownData?.setting_value) {
          setSettings(lockdownData.setting_value);
        }

        // Load max broadcasters
        const { data: limitData, error: limitError } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'max_broadcasters')
          .maybeSingle();

        if (limitError && limitError.code !== 'PGRST116') throw limitError;

        if (limitData?.setting_value?.limit) {
          setMaxBroadcasters(limitData.setting_value.limit);
        }

      } catch (err: any) {
        console.error('Failed to load broadcast settings:', err);
        setError(err.message);
      }
    };

    loadSettings();

    // Subscribe to changes using realtime
    const subscription = supabase
      .channel('admin_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'admin_settings'
        },
        (payload) => {
          if (payload.new?.setting_key === 'broadcast_lockdown_enabled') {
            setSettings(payload.new.setting_value);
          }
          if (payload.new?.setting_key === 'max_broadcasters') {
            setMaxBroadcasters(payload.new.setting_value.limit);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update lockdown settings (admin only)
  const updateSettings = async (newSettings: BroadcastLockdownSettings) => {
    if (!profile?.is_admin && profile?.role !== 'admin') {
      toast.error('Only admins can change broadcast settings');
      return false;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('admin_settings')
        .update({
          setting_value: newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'broadcast_lockdown_enabled');

      if (updateError) throw updateError;

      setSettings(newSettings);
      toast.success('Broadcast settings updated');
      return true;
    } catch (err: any) {
      console.error('Failed to update broadcast lockdown settings:', err);
      toast.error('Failed to update settings: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Update max broadcasters (admin only)
  const updateMaxBroadcasters = async (limit: number) => {
    if (!profile?.is_admin && profile?.role !== 'admin') {
      toast.error('Only admins can change broadcast settings');
      return false;
    }

    setLoading(true);
    try {
      // Upsert the setting
      const { error: updateError } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'max_broadcasters',
          setting_value: { limit },
          description: 'Maximum number of authorized broadcasters',
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (updateError) throw updateError;

      setMaxBroadcasters(limit);
      toast.success('Max broadcasters limit updated');
      return true;
    } catch (err: any) {
      console.error('Failed to update max broadcasters:', err);
      toast.error('Failed to update limit: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check if current user can broadcast (RPC check)
  const checkEligibility = async (): Promise<{ allowed: boolean; reason?: string }> => {
    try {
      // 1. Check RPC first for hard logic
      const { data: allowed, error } = await supabase.rpc('can_start_broadcast');
      if (error) throw error;

      if (allowed) return { allowed: true };

      // If not allowed, determine why (client side estimation or specific RPC)
      // For now, we can guess based on flags or just say "Not authorized"
      // But we can check badge status explicitly if we want to be helpful
      if (!profile) return { allowed: false, reason: 'Not logged in' };

      // Check badge
      if (!profile.is_admin && profile.role !== 'admin') {
         // Refresh profile to get latest flags?
         const { data: user } = await supabase
            .from('user_profiles')
            .select('is_broadcast_locked, has_broadcast_badge')
            .eq('id', profile.id)
            .single();
         
         if (user?.is_broadcast_locked) return { allowed: false, reason: 'Your broadcasting privileges are locked.' };
         if (settings.enabled) return { allowed: false, reason: 'Global broadcast lockdown is active.' };
         if (!user?.has_broadcast_badge) return { allowed: false, reason: 'You do not have a Broadcast Badge. Slots may be full.' };
      }

      return { allowed: false, reason: 'Not authorized to broadcast.' };
    } catch (err: any) {
      console.error('Eligibility check failed:', err);
      return { allowed: false, reason: err.message };
    }
  };

  // Attempt to claim a badge
  const attemptGrantBadge = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.rpc('ensure_broadcaster_badge');
      if (error) throw error;
      return data as { success: boolean; message: string };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  return {
    settings,
    maxBroadcasters,
    loading,
    error,
    updateSettings,
    updateMaxBroadcasters,
    checkEligibility,
    attemptGrantBadge
  };
}
