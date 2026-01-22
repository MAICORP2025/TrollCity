import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { cars } from '../../data/vehicles';

export function useGameNavigate() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuthStore();

  const gameNavigate = async (to: string) => {
    const majorPages = [
      '/',
      '/trollstown',
      '/dealership',
      '/mechanic',
      '/hospital',
      '/general-store',
      '/store',
      '/marketplace',
      '/trollmart',
      '/auctions',
      '/inventory',
      '/wall',
      '/leaderboard',
      '/messages',
      '/support',
      '/safety',
      '/family',
      '/family/lounge',
      '/officer',
      '/officer/dashboard',
      '/officer/moderation',
      '/officer/vote',
      '/lead-officer',
      '/secretary',
      '/application',
      '/wallet'
    ];

    const needsDriving = majorPages.some(page => to.startsWith(page));

    if (needsDriving) {
      let hasStoredVehicle = false;
      if (profile?.id) {
        try {
          const stored = localStorage.getItem(`trollcity_car_${profile.id}`);
          hasStoredVehicle = stored ? Boolean(JSON.parse(stored)?.carId) : false;
        } catch {
          hasStoredVehicle = false;
        }
      }

      if (!profile?.active_vehicle && !hasStoredVehicle) {
        const ownedIds = Array.isArray(profile?.owned_vehicle_ids)
          ? profile.owned_vehicle_ids
              .map(id => Number(id))
              .filter(id => Number.isFinite(id))
          : [];

        if (!profile?.id || ownedIds.length === 0) {
          toast.error('Select a vehicle before driving.');
          navigate('/dealership');
          return;
        }

        const defaultVehicleId = ownedIds[0];
        const carConfig = cars.find(car => car.id === defaultVehicleId) || null;

        try {
          if (carConfig) {
            localStorage.setItem(
              `trollcity_car_${profile.id}`,
              JSON.stringify({
                carId: carConfig.id,
                colorFrom: carConfig.colorFrom,
                colorTo: carConfig.colorTo,
                name: carConfig.name,
                tier: carConfig.tier,
                price: carConfig.price,
                style: carConfig.style
              })
            );
          }

          await supabase
            .from('user_profiles')
            .update({
              active_vehicle: defaultVehicleId,
              vehicle_image: carConfig ? carConfig.image || null : null,
              owned_vehicle_ids: ownedIds
            })
            .eq('id', profile.id);

          await refreshProfile();
        } catch (error) {
          console.error('Failed to auto-select active vehicle from profile', error);
          toast.error('Could not load your vehicle. Please select one in the dealership.');
          navigate('/dealership');
          return;
        }
      }

      // Navigate directly without driving scene
      navigate(to);
    } else {
      navigate(to);
    }
  };

  return gameNavigate;
}
