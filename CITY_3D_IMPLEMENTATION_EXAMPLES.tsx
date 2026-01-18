import type React from 'react';
import { useCity3DStore } from '@/lib/stores/cityScene3D';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const useCarPurchase = () => {
  const user = useAuthStore((s) => s.user);
  const { addCar, setActiveCar, ownedCars } = useCity3DStore();

  const purchaseCar = async (carData: {
    id: string;
    name: string;
    price: number;
    baseColor?: string;
  }) => {
    if (!user?.id) {
      toast.error('Please log in to purchase cars');
      return false;
    }

    try {
      // 1. Deduct coins
      const { error: deductError } = await supabase.rpc('deduct_coins', {
        p_user_id: user.id,
        p_amount: carData.price,
        p_type: 'car_purchase',
        p_description: `Purchased car: ${carData.name}`,
      });

      if (deductError) throw deductError;

      // 2. Add to user_perks table
      const { error: insertError } = await supabase
        .from('user_perks')
        .insert([
          {
            user_id: user.id,
            perk_id: carData.id,
            is_active: true,
            expires_at: null, // Cars don't expire
            metadata: {
              car_model: carData.name,
              color: carData.baseColor || '#ff0000',
              purchased_at: new Date().toISOString(),
            },
          },
        ]);

      if (insertError) throw insertError;

      // 3. Add to 3D scene ⭐ KEY INTEGRATION
      const newCar = {
        id: carData.id,
        model: carData.name,
        color: carData.baseColor || '#ff0000',
        position: [Math.random() * 20 - 10, 0, Math.random() * 20 - 10] as [
          number,
          number,
          number,
        ],
        rotation: Math.random() * Math.PI * 2,
        isOwned: true,
      };

      addCar(newCar);

      // 4. Optionally set as active car
      setActiveCar(newCar);

      toast.success(`${carData.name} added to your city!`);
      return true;
    } catch (error) {
      console.error('Car purchase error:', error);
      toast.error('Failed to purchase car');
      return false;
    }
  };

  return { purchaseCar, ownedCars };
};

const useHousePurchase = () => {
  const user = useAuthStore((s) => s.user);
  const { addHouse, setActiveHouse, ownedHouses } = useCity3DStore();

  const purchaseHouse = async (houseData: {
    id: string;
    name: string;
    price: number;
    style: 'modern' | 'classic' | 'luxury' | 'villa';
  }) => {
    if (!user?.id) {
      toast.error('Please log in to purchase houses');
      return false;
    }

    try {
      // 1. Deduct coins
      const { error: deductError } = await supabase.rpc('deduct_coins', {
        p_user_id: user.id,
        p_amount: houseData.price,
        p_type: 'house_purchase',
        p_description: `Purchased ${houseData.style} house: ${houseData.name}`,
      });

      if (deductError) throw deductError;

      // 2. Add to user_perks table
      const { error: insertError } = await supabase
        .from('user_perks')
        .insert([
          {
            user_id: user.id,
            perk_id: houseData.id,
            is_active: true,
            expires_at: null, // Houses don't expire
            metadata: {
              house_name: houseData.name,
              style: houseData.style,
              purchased_at: new Date().toISOString(),
            },
          },
        ]);

      if (insertError) throw insertError;

      // 3. Add to 3D scene ⭐ KEY INTEGRATION
      const newHouse = {
        id: houseData.id,
        position: [
          Math.random() * 100 - 50,
          0,
          Math.random() * 100 - 50,
        ] as [number, number, number],
        style: houseData.style,
        isOwned: true,
      };

      addHouse(newHouse);

      // 4. Optionally set as active house
      setActiveHouse(newHouse);

      toast.success(`${houseData.style} ${houseData.name} added to your city!`);
      return true;
    } catch (error) {
      console.error('House purchase error:', error);
      toast.error('Failed to purchase house');
      return false;
    }
  };

  return { purchaseHouse, ownedHouses };
};

const useGameMode = () => {
  const {
    activeCar,
    gameControlsActive,
    setGameControlsActive,
  } = useCity3DStore();

  const enterGameMode = (car = activeCar) => {
    if (!car) {
      toast.error('No car available. Purchase a car first!');
      return;
    }
    setGameControlsActive(true);
    toast.success('Game mode active! Use WASD to drive, ESC to exit.');
  };

  const exitGameMode = () => {
    setGameControlsActive(false);
    toast.success('Game mode disabled');
  };

  return {
    enterGameMode,
    exitGameMode,
    isGameModeActive: gameControlsActive,
    hasActiveCar: !!activeCar,
  };
};

const useBroadcastEntrance = () => {
  const { selectedEntrance, activeCar, avatar } = useCity3DStore();

  const getEntranceAnimation = async () => {
    if (!selectedEntrance) {
      return {
        type: 'none',
        duration: 0,
      };
    }

    if (selectedEntrance.type === 'car' && activeCar) {
      return {
        type: 'car_drive',
        carModel: activeCar.model,
        carColor: activeCar.color,
        duration: 3, // 3 second car entrance
      };
    }

    if (selectedEntrance.type === 'avatar' && avatar) {
      return {
        type: 'avatar_walk',
        avatarStyle: avatar.modelUrl,
        duration: 2.5, // 2.5 second walk entrance
      };
    }

    if (selectedEntrance.type === 'effect') {
      return {
        type: 'particle_effect',
        effectId: selectedEntrance.effectId,
        duration: 2,
      };
    }

    return {
      type: 'none',
      duration: 0,
    };
  };

  return { getEntranceAnimation, selectedEntrance };
};

const useSceneVisibility = () => {
  const { sceneVisible, setSceneVisible, ownedCars, ownedHouses } =
    useCity3DStore();

  const toggleScene = (show?: boolean) => {
    const newState = show !== undefined ? show : !sceneVisible;
    setSceneVisible(newState);

    if (newState) {
      console.log('3D City loaded');
    } else {
      console.log('3D City hidden (reduces GPU usage)');
    }

    return newState;
  };

  return { sceneVisible, toggleScene, ownedCars, ownedHouses };
};

const useCustomCarModel = (carId: string, _gltfUrl: string) => {
  const { addCar } = useCity3DStore();

  const loadCustomCar = async (carData: {
    name: string;
    color: string;
  }) => {
    try {
      // In a real implementation, you'd load the GLTF model here
      // For now, using the procedural geometry fallback

      const newCar = {
        id: carId,
        model: carData.name,
        color: carData.color,
        position: [0, 0, 0] as [number, number, number],
        rotation: 0,
        isOwned: true,
      };

      addCar(newCar);
      return true;
    } catch (error) {
      console.error('Failed to load custom car model:', error);
      return false;
    }
  };

  return { loadCustomCar };
};

const usePlayerTracking = () => {
  const { cameraPosition, setCameraPosition, activeCar } = useCity3DStore();

  const updatePlayerPosition = (position: [number, number, number]) => {
    setCameraPosition(position);
  };

  const followActiveCar = () => {
    if (activeCar) {
      updatePlayerPosition([
        activeCar.position[0],
        activeCar.position[1] + 5,
        activeCar.position[2] + 8,
      ]);
    }
  };

  return { cameraPosition, updatePlayerPosition, followActiveCar };
};

const useCarCustomization = () => {
  const { ownedCars, activeCar, setActiveCar } = useCity3DStore();

  const customizeCar = async (carId: string, newColor: string) => {
    const car = ownedCars.find((c) => c.id === carId);
    if (!car) return false;

    try {
      // Update in database
      await supabase
        .from('user_perks')
        .update({
          metadata: {
            ...car,
            color: newColor,
          },
        })
        .eq('perk_id', carId);

      // Update in state
      const updatedCar = { ...car, color: newColor };
      if (activeCar?.id === carId) {
        setActiveCar(updatedCar);
      }

      toast.success('Car color updated!');
      return true;
    } catch (error) {
      console.error('Failed to customize car:', error);
      toast.error('Failed to update car color');
      return false;
    }
  };

  return { customizeCar, ownedCars };
};

// ============================================================================
// EXAMPLE 9: Complete Integration Component (Ready to Use)
// ============================================================================

export const City3DControlPanel: React.FC = () => {
  const { ownedCars, ownedHouses, sceneVisible, toggleScene } =
    useSceneVisibility();
  const { enterGameMode, isGameModeActive } = useGameMode();
  const { selectedEntrance } = useCity3DStore();

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 border border-purple-500 rounded-lg p-4 max-w-xs">
      <h3 className="text-white font-bold mb-3">City Controls</h3>

      {/* Scene Toggle */}
      <button
        onClick={() => toggleScene()}
        className="w-full mb-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm"
      >
        {sceneVisible ? '🎮 Hide City' : '🎮 Show City'}
      </button>

      {/* Game Mode */}
      {ownedCars.length > 0 && (
        <button
          onClick={() => enterGameMode()}
          className="w-full mb-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
        >
          {isGameModeActive ? '🛑 Exit Game' : '▶️ Drive Car'}
        </button>
      )}

      {/* Stats */}
      <div className="text-xs text-gray-400 space-y-1 mt-3 border-t border-purple-500/30 pt-3">
        <div>🚗 Cars: {ownedCars.length}</div>
        <div>🏠 Houses: {ownedHouses.length}</div>
        {selectedEntrance && (
          <div>✨ Entrance: {selectedEntrance.type.toUpperCase()}</div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// EXPORT ALL HOOKS FOR USE IN YOUR COMPONENTS
// ============================================================================

export default {
  useCarPurchase,
  useHousePurchase,
  useGameMode,
  useBroadcastEntrance,
  useSceneVisibility,
  useCustomCarModel,
  usePlayerTracking,
  useCarCustomization,
  City3DControlPanel,
};
