import { create } from 'zustand';

export interface CarData {
  id: string;
  model: string;
  color: string;
  position: [number, number, number];
  rotation: number;
  isOwned: boolean;
}

export interface HouseData {
  id: string;
  position: [number, number, number];
  style: 'modern' | 'classic' | 'luxury' | 'villa';
  isOwned: boolean;
}

export interface AvatarData {
  id: string;
  modelUrl?: string;
  position: [number, number, number];
  rotation: number;
  animationState: 'idle' | 'walking' | 'running' | 'driving';
}

export interface EntranceEffectChoice {
  type: 'avatar' | 'car' | 'effect';
  carId?: string;
  effectId?: string;
  avatarStyle?: string;
}

interface City3DStore {
  // Avatar state
  avatar: AvatarData | null;
  setAvatar: (avatar: AvatarData) => void;

  // Car state
  ownedCars: CarData[];
  activeCar: CarData | null;
  addCar: (car: CarData) => void;
  setActiveCar: (car: CarData | null) => void;

  // House state
  ownedHouses: HouseData[];
  activeHouse: HouseData | null;
  addHouse: (house: HouseData) => void;
  setActiveHouse: (house: HouseData | null) => void;

  // Scene state
  sceneVisible: boolean;
  setSceneVisible: (visible: boolean) => void;
  cameraPosition: [number, number, number];
  setCameraPosition: (pos: [number, number, number]) => void;

  // Entrance effect selection
  selectedEntrance: EntranceEffectChoice | null;
  setSelectedEntrance: (choice: EntranceEffectChoice | null) => void;

  // Game controls
  gameControlsActive: boolean;
  setGameControlsActive: (active: boolean) => void;
  
  // Navigation state
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export const useCity3DStore = create<City3DStore>((set) => ({
  // Avatar
  avatar: null,
  setAvatar: (avatar) => set({ avatar }),

  // Cars
  ownedCars: [],
  activeCar: null,
  addCar: (car) =>
    set((state) => ({
      ownedCars: [...state.ownedCars, car],
    })),
  setActiveCar: (car) => set({ activeCar: car }),

  // Houses
  ownedHouses: [],
  activeHouse: null,
  addHouse: (house) =>
    set((state) => ({
      ownedHouses: [...state.ownedHouses, house],
    })),
  setActiveHouse: (house) => set({ activeHouse: house }),

  // Scene
  sceneVisible: true,
  setSceneVisible: (visible) => set({ sceneVisible: visible }),
  cameraPosition: [0, 10, 20],
  setCameraPosition: (pos) => set({ cameraPosition: pos }),

  // Entrance
  selectedEntrance: null,
  setSelectedEntrance: (choice) => set({ selectedEntrance: choice }),

  // Controls
  gameControlsActive: false,
  setGameControlsActive: (active) => set({ gameControlsActive: active }),

  // Navigation
  currentPage: '/',
  setCurrentPage: (page) => set({ currentPage: page }),
}));
