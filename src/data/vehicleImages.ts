// =====================================================
// VEHICLE ASSET SYSTEM - Static Data
// =====================================================
// Images are in /public/assets/cars/
// =====================================================

export interface VehicleImage {
  vehicle_id: string;
  name: string;
  image: string;
}

export const VEHICLE_IMAGES: VehicleImage[] = [
  { vehicle_id: 'troll_compact', name: 'Troll Compact', image: '/assets/cars/troll_compact_s1.png' },
  { vehicle_id: 'troll_sedan', name: 'Troll Sedan', image: '/assets/cars/midline_xr.png' },
  { vehicle_id: 'troll_coupe', name: 'Troll Coupe', image: '/assets/cars/urban_drift_r.png' },
  { vehicle_id: 'troll_sport', name: 'Troll Sport', image: '/assets/cars/ironclad_gt.png' },
  { vehicle_id: 'troll_gt', name: 'Troll GT', image: '/assets/cars/phantom_x.png' },
  { vehicle_id: 'troll_racing', name: 'Troll Racing', image: '/assets/cars/vanta_lx.png' },
  { vehicle_id: 'troll_luxury', name: 'Troll Luxury', image: '/assets/cars/vehicle_1_original.png' },
  { vehicle_id: 'troll_exotic', name: 'Troll Exotic', image: '/assets/cars/vehicle_2_original.png' },
  { vehicle_id: 'troll_supercar', name: 'Troll Supercar', image: '/assets/cars/vehicle_3_original.png' },
  { vehicle_id: 'troll_royale', name: 'Troll Royale', image: '/assets/cars/vehicle_4_original.png' },
  { vehicle_id: 'troll_hyper', name: 'Troll Hyper', image: '/assets/cars/vehicle_5_original.png' },
  { vehicle_id: 'troll_apex', name: 'Troll Apex', image: '/assets/cars/vehicle_6_original.png' },
];

export function getVehicleImage(vehicleId: string): string | undefined {
  return VEHICLE_IMAGES.find(v => v.vehicle_id === vehicleId)?.image;
}

export function getVehicleImageByName(name: string): string | undefined {
  return VEHICLE_IMAGES.find(v => v.name === name)?.image;
}
