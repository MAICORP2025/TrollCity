import React from 'react';
import CityStatusOrb from '../city/CityStatusOrb';
import { useCityStatusOrb } from '../../lib/hooks/useCityStatusOrb';

interface SeatCityStatusOrbProps {
  userId: string;
  broadcasterId?: string;
  isBroadcaster?: boolean;
  isBroadOfficer?: boolean;
  onClick?: () => void;
}

export default function SeatCityStatusOrb({
  userId,
  broadcasterId,
  isBroadcaster,
  isBroadOfficer,
  onClick,
}: SeatCityStatusOrbProps) {
  const { data, permissions } = useCityStatusOrb({
    userId,
    broadcasterId,
    isBroadcaster,
    isBroadOfficer,
    isSeatHolder: true,
  });

  if (!data) return null;

  return (
    <div className="pointer-events-auto" onClick={onClick}>
      <CityStatusOrb
        data={data}
        permissions={permissions}
        compact
        onHouseClick={onClick}
      />
    </div>
  );
}
