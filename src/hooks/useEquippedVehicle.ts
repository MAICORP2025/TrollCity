import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export interface Vehicle {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  overlay_video_url: string;
  speed: number;
  armor: number;
  tier: string;
}

export function useEquippedVehicle() {
  const { user } = useAuthStore();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setVehicle(null);
      setLoading(false);
      return;
    }

    async function fetchEquippedVehicle() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('user_vehicles')
          .select(`
            *,
            vehicle:vehicles_catalog(*)
          `)
          .eq('user_id', user.id)
          .eq('is_equipped', true)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data && data.vehicle) {
          setVehicle(data.vehicle as Vehicle);
        } else {
          setVehicle(null);
        }
      } catch (err: any) {
        console.error('Error fetching equipped vehicle:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEquippedVehicle();

    // Subscribe to changes in user_vehicles for the current user
    const channel = supabase
      .channel(`equipped-vehicle-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_vehicles',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchEquippedVehicle();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { vehicle, loading, error };
}
