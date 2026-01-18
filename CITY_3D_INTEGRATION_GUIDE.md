# Troll City 3D System - Integration Guide

## Overview

This guide covers the complete 3D city visualization system for Troll City, including avatars, cars, houses, and persistent overlays that work across all pages and routes.

## Architecture

### Core Components

1. **CityScene.tsx** - Main 3D canvas using Three.js + React Three Fiber
2. **Car3D.tsx** - Realistic car rendering with game controls (WASD)
3. **Avatar3D.tsx** - Avatar character with animations
4. **House3D.tsx** - Property/house visualization with 4 styles
5. **CityEnvironment.tsx** - Background world (roads, buildings, lights)
6. **EntranceEffectSelector.tsx** - UI to choose entrance animation
7. **GameControlsOverlay.tsx** - Game HUD with controls, minimap, speed
8. **City3DOverlay.tsx** - Wrapper component for app integration

### State Management

Uses **Zustand** store (`useCity3DStore`) to manage:
- Avatar state (position, animation)
- Cars owned and active
- Houses owned
- Scene visibility
- Camera position
- Game controls active/inactive
- Selected entrance effect
- Current page navigation

### Data Loading

`useCity3DDataLoader` hook loads from Supabase:
- User profile avatar data
- Purchased cars (from `user_perks` where `perk_id` like '%car%')
- Purchased houses (from `user_perks` where `perk_id` like '%house%')

## Integration Steps

### 1. Add City3DOverlay to App.tsx

```tsx
import City3DOverlay from '@/components/City3D/City3DOverlay';

// In AppContent return (after Routes):
return (
  <>
    {/* Existing UI */}
    <AppLayout showSidebar={!!user}>
      <Routes>
        {/* all your routes */}
      </Routes>
    </AppLayout>

    {/* Add 3D overlay - persists across all pages */}
    <City3DOverlay />
  </>
);
```

### 2. Add Car Purchase Handler

In your coin store or dealership page when purchasing a car:

```tsx
import { useCity3DStore } from '@/lib/stores/cityScene3D';
import { type CarData } from '@/lib/stores/cityScene3D';

const { addCar } = useCity3DStore();

// After successful car purchase:
const newCar: CarData = {
  id: `car_${carId}`,
  model: carData.name,
  color: selectedColor,
  position: [Math.random() * 20 - 10, 0, 0],
  rotation: 0,
  isOwned: true,
};
addCar(newCar);
```

### 3. Add House Purchase Handler

In your property/real estate page when purchasing a house:

```tsx
import { useCity3DStore } from '@/lib/stores/cityScene3D';
import { type HouseData } from '@/lib/stores/cityScene3D';

const { addHouse } = useCity3DStore();

// After successful house purchase:
const newHouse: HouseData = {
  id: `house_${houseId}`,
  position: [Math.random() * 50 - 25, 0, Math.random() * 50 - 25],
  style: houseStyle, // 'modern' | 'classic' | 'luxury' | 'villa'
  isOwned: true,
};
addHouse(newHouse);
```

### 4. Activate Game Controls

To enter game mode (driving a car):

```tsx
import { useCity3DStore } from '@/lib/stores/cityScene3D';

const { setActiveCar, setGameControlsActive, activeCar } = useCity3DStore();
const carToActivate = ownedCars[0]; // Get a car

// Activate car
setActiveCar(carToActivate);
setGameControlsActive(true); // Enable WASD controls

// Exit game mode
setGameControlsActive(false);
```

### 5. Listen to Entrance Effect Selection

To use selected entrance when broadcasting:

```tsx
import { useCity3DStore } from '@/lib/stores/cityScene3D';

const { selectedEntrance } = useCity3DStore();

useEffect(() => {
  if (selectedEntrance?.type === 'car') {
    // Activate car entrance animation
    console.log('Entering with car:', selectedEntrance.carId);
  } else if (selectedEntrance?.type === 'avatar') {
    // Avatar walk entrance
    console.log('Entering with avatar walk');
  } else if (selectedEntrance?.type === 'effect') {
    // Effect entrance (particles, lights, etc)
    console.log('Entering with effect:', selectedEntrance.effectId);
  }
}, [selectedEntrance]);
```

## Game Controls

When `gameControlsActive` is true:

- **W** - Drive forward
- **A** - Turn left
- **S** - Reverse/brake
- **D** - Turn right
- **ESC** - Exit game mode

## House Styles

Available house styles with unique colors:

- **modern** - Gray/white with cyan accent
- **classic** - Brown/tan with gold accent
- **luxury** - Cream/white with gold accent
- **villa** - White with red roof and pink accent

## Customization

### Change Car Physics

In `Car3D.tsx`, adjust `Car3DProps` parameters:

```tsx
const acceleration = 0.5; // Higher = faster acceleration
const maxSpeed = 0.3; // Higher = faster max speed
const turnSpeed = 0.1; // Higher = sharper turns
const deceleration = 0.92; // Higher = slower deceleration
```

### Add More Car Models

Modify Car3D to use GLTF models:

```tsx
const gltf = useGLTFLoader(carModelUrl);
return <mesh geometry={gltf.scene.children[0].geometry} />;
```

### Adjust Camera

In `CityScene.tsx`:

```tsx
const targetPos = new Vector3(
  activeCar.position[0] + 5,  // Horizontal offset
  activeCar.position[1] + 4,  // Vertical height
  activeCar.position[2] + 8   // Depth behind car
);
```

### Add Custom Effects

Create new entrance effects in `EntranceEffectSelector.tsx` and implement particle systems or animations.

## Performance Optimization

1. **Frustum Culling** - Three.js automatically hides off-screen objects
2. **Shadows** - Currently using basic shadow maps; can disable on mobile
3. **LOD** - Distance-based detail reduction (implement for far objects)
4. **Canvas Fallback** - Scene is hidden when not visible (0 GPU usage)

## Supabase Schema Extensions

Make sure your `user_perks` table supports 3D metadata:

```sql
ALTER TABLE user_perks ADD COLUMN metadata JSONB;

-- Example car perk record:
INSERT INTO user_perks (user_id, perk_id, metadata)
VALUES (
  'user-id',
  'car_ferrari',
  '{"color": "#ff0000", "car_model": "Ferrari F40"}'::jsonb
);

-- Example house perk record:
INSERT INTO user_perks (user_id, perk_id, metadata)
VALUES (
  'user-id',
  'house_luxury',
  '{"style": "luxury"}'::jsonb
);
```

## Troubleshooting

### 3D Scene not showing
- Check `sceneVisible` in store (should be true)
- Verify `City3DOverlay` is added to App.tsx
- Check browser console for WebGL errors

### Performance issues
- Reduce shadow quality: `shadow-mapSize-width={1024}`
- Disable game controls when not needed
- Check number of objects in scene

### Controls not working
- Ensure `gameControlsActive` is true
- Check window event listeners are attached
- Verify game mode UI is visible

## Future Enhancements

1. **GLTF Model Support** - Load professional 3D models from cloud storage
2. **Physics Engine** - Implement cannon-es for realistic collisions
3. **Networking** - Show other players' cars/avatars in real-time
4. **Scripted Sequences** - Cutscenes using Framer Motion + Three.js
5. **Procedural City** - Generate infinite city blocks
6. **Day/Night Cycle** - Dynamic lighting changes
7. **Weather Effects** - Rain, snow, fog systems
8. **Mobile Optimization** - Touch controls, reduced geometry
