import React from 'react';
import { cars } from '../../data/vehicles';

interface VehicleRendererProps {
  vehicleId?: number | null;
  className?: string;
  style?: React.CSSProperties;
  showShadow?: boolean;
}

export default function VehicleRenderer({ vehicleId, className = "", style = {}, showShadow = true }: VehicleRendererProps) {
  if (!vehicleId) return null;

  const car = cars.find(c => c.id === vehicleId);

  if (!car || !car.image) {
    return null;
  }

  return (
    <img 
      src={car.image} 
      alt={car.name} 
      className={`${className} ${showShadow ? 'drop-shadow-2xl' : ''}`}
      style={style}
    />
  );
}
