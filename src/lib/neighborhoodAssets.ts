import type { CarOption, PropertyCustomizationOption } from '../types/neighborhood'

export const HOUSE_TYPES: PropertyCustomizationOption[] = [
  { id: 'townhouse', label: 'Townhouse', preview: 'bg-slate-700', cost: 250, requiredUpgradeLevel: 1 },
  { id: 'modern', label: 'Modern Home', preview: 'bg-cyan-700', cost: 500, requiredUpgradeLevel: 2 },
  { id: 'victorian', label: 'Victorian', preview: 'bg-purple-700', cost: 750, requiredUpgradeLevel: 3 },
  { id: 'loft', label: 'Loft Loft', preview: 'bg-indigo-700', cost: 650, requiredUpgradeLevel: 2 },
  { id: 'bungalow', label: 'Bungalow', preview: 'bg-amber-700', cost: 300, requiredUpgradeLevel: 1 }
]

export const DOOR_COLORS: PropertyCustomizationOption[] = [
  { id: 'neon-blue', label: 'Neon Blue', preview: 'bg-blue-500', cost: 50, requiredUpgradeLevel: 1 },
  { id: 'solar-orange', label: 'Solar Orange', preview: 'bg-orange-500', cost: 75, requiredUpgradeLevel: 1 },
  { id: 'ghost-white', label: 'Ghost White', preview: 'bg-slate-200', cost: 50, requiredUpgradeLevel: 1 },
  { id: 'galaxy-purple', label: 'Galaxy Purple', preview: 'bg-fuchsia-500', cost: 100, requiredUpgradeLevel: 2 }
]

export const TRIM_COLORS: PropertyCustomizationOption[] = [
  { id: 'gold-trim', label: 'Gold Trim', preview: 'bg-amber-400', cost: 120, requiredUpgradeLevel: 2 },
  { id: 'chrome', label: 'Chrome', preview: 'bg-slate-300', cost: 90, requiredUpgradeLevel: 1 },
  { id: 'midnight', label: 'Midnight', preview: 'bg-slate-900', cost: 80, requiredUpgradeLevel: 1 },
  { id: 'teal-flare', label: 'Teal', preview: 'bg-teal-400', cost: 100, requiredUpgradeLevel: 2 }
]

export const WINDOW_STYLES: PropertyCustomizationOption[] = [
  { id: 'arched', label: 'Arched', preview: 'border rounded-t-full', cost: 60, requiredUpgradeLevel: 1 },
  { id: 'panoramic', label: 'Panoramic', preview: 'border border-white/20', cost: 100, requiredUpgradeLevel: 2 },
  { id: 'classic', label: 'Classic', preview: 'border border-slate-400', cost: 40, requiredUpgradeLevel: 1 },
  { id: 'studio', label: 'Studio', preview: 'border border-cyan-400', cost: 90, requiredUpgradeLevel: 2 }
]

export const ROOF_STYLES: PropertyCustomizationOption[] = [
  { id: 'flat', label: 'Flat Roof', preview: 'bg-slate-600', cost: 80, requiredUpgradeLevel: 1 },
  { id: 'gabled', label: 'Gabled', preview: 'bg-slate-800', cost: 120, requiredUpgradeLevel: 2 },
  { id: 'hip', label: 'Hip Roof', preview: 'bg-slate-700', cost: 100, requiredUpgradeLevel: 1 },
  { id: 'solar', label: 'Solar Roof', preview: 'bg-yellow-500', cost: 180, requiredUpgradeLevel: 3 }
]

export const YARD_DECORATIONS: PropertyCustomizationOption[] = [
  { id: 'neon-sign', label: 'Neon Sign', preview: 'bg-fuchsia-500', cost: 150, requiredUpgradeLevel: 2 },
  { id: 'garden', label: 'Garden', preview: 'bg-emerald-500', cost: 100, requiredUpgradeLevel: 1 },
  { id: 'fence', label: 'Fence', preview: 'bg-slate-500', cost: 80, requiredUpgradeLevel: 1 },
  { id: 'sculpture', label: 'Sculpture', preview: 'bg-yellow-400', cost: 180, requiredUpgradeLevel: 3 }
]

export const CAR_OPTIONS: CarOption[] = [
  {
    id: 'troll_compact_s1',
    name: 'Troll Compact S1',
    tier: 'Common',
    description: 'Light, reliable, starter-ready with a built-in street glow. FREE for new users starting out!',
    price: 0,
    speed: 40,
    armor: 20,
    insurance_required: true
  },
  {
    id: 'urban_drift_r',
    name: 'Urban Drift R',
    tier: 'Rare',
    description: 'Agile and stylish for city streets, perfect for a new driver.',
    price: 12000,
    speed: 65,
    armor: 35,
    insurance_required: true
  },
  {
    id: 'midline_xr',
    name: 'Midline XR',
    tier: 'Epic',
    description: 'A premium ride with extra durability and room for upgrades.',
    price: 18000,
    speed: 70,
    armor: 45,
    insurance_required: true
  }
]
