import { useEffect } from 'react';
import { useCity3DStore, type CarData, type HouseData, type AvatarData } from '@/lib/stores/cityScene3D';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

/**
 * Hook to load user's 3D assets (cars, houses, avatar) from Supabase
 * and sync with city scene store
 */
export const useCity3DDataLoader = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const { setAvatar, addCar, addHouse, setActiveCar, setActiveHouse } = useCity3DStore();

  useEffect(() => {
    if (!userId) return;

    const loadCity3DData = async () => {
      try {
        // Load user profile for avatar customization
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username, avatar_color, avatar_style')
          .eq('id', userId)
          .single();

        if (profile) {
          const avatar: AvatarData = {
            id: userId,
            position: [0, 0, 0],
            rotation: 0,
            animationState: 'idle',
            modelUrl: profile.avatar_style,
          };
          setAvatar(avatar);
        }

        // Load purchased cars (from user_vehicles joined with vehicles_catalog)
        const { data: userVehicles } = await supabase
          .from('user_vehicles')
          .select(`
            id,
            mods,
            vehicles_catalog (
              name,
              tier,
              image
            )
          `)
          .eq('user_id', userId);

        if (userVehicles) {
          let firstCar: CarData | null = null;
          userVehicles.forEach((uv: any) => {
            // Determine color from mods or default
            const mods = uv.mods || {};
            const color = mods.color || '#3b82f6'; // Default blue-ish

            const car: CarData = {
              id: uv.id,
              model: uv.vehicles_catalog?.name || 'Unknown Car',
              color: color,
              // Random position for now, or could store in DB if we had it
              position: [Math.random() * 20 - 10, 0, Math.random() * 20 - 10],
              rotation: Math.random() * Math.PI * 2,
              isOwned: true,
            };
            addCar(car);
            if (!firstCar) firstCar = car;
          });
          if (firstCar) setActiveCar(firstCar);
        }

        // Load purchased houses/properties (from user_perks where perk_type = 'house')
        const { data: housePerks } = await supabase
          .from('user_perks')
          .select('perk_id, metadata')
          .eq('user_id', userId)
          .ilike('perk_id', '%house%')
          .eq('is_active', true);

        if (housePerks) {
          let firstHouse: HouseData | null = null;
          housePerks.forEach((perk) => {
            const house: HouseData = {
              id: perk.perk_id,
              position: [Math.random() * 50 - 25, 0, Math.random() * 50 - 25],
              style: (perk.metadata?.style as any) || 'modern',
              isOwned: true,
            };
            addHouse(house);
            if (!firstHouse) firstHouse = house;
          });
          if (firstHouse) setActiveHouse(firstHouse);
        }
      } catch (error) {
        console.error('Error loading 3D city data:', error);
      }
    };

    loadCity3DData();
  }, [userId, setAvatar, addCar, addHouse, setActiveCar, setActiveHouse]);
};
