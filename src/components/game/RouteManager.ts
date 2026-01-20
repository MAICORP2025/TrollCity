export type DestinationKey =
  | 'troll_town'
  | 'mall'
  | 'casino'
  | 'court'
  | 'store'
  | 'studio'
  | 'hospital'
  | 'gas'
  | 'dealership'
  | 'city';

export interface RouteConfig {
  key: DestinationKey;
  displayName: string;
  routeLength: number;
}

const ROUTES: RouteConfig[] = [
  { key: 'troll_town', displayName: 'Troll Town', routeLength: 650 },
  { key: 'mall', displayName: 'Mall', routeLength: 520 },
  { key: 'casino', displayName: 'Casino', routeLength: 580 },
  { key: 'court', displayName: 'Troll Court', routeLength: 540 },
  { key: 'store', displayName: 'General Store', routeLength: 480 },
  { key: 'studio', displayName: 'Studio', routeLength: 500 },
  { key: 'hospital', displayName: 'Hospital', routeLength: 560 },
  { key: 'gas', displayName: 'Gas Station', routeLength: 420 },
  { key: 'dealership', displayName: 'Dealership', routeLength: 460 },
  { key: 'city', displayName: 'Troll City', routeLength: 600 }
];

export function resolveDestination(raw: string | null | undefined): RouteConfig {
  const label = (raw || '').toLowerCase();

  if (label.includes('troll') && label.includes('town')) return ROUTES[0];
  if (label.includes('mall')) return ROUTES[1];
  if (label.includes('casino')) return ROUTES[2];
  if (label.includes('court')) return ROUTES[3];
  if (label.includes('store') || label.includes('mart')) return ROUTES[4];
  if (label.includes('studio')) return ROUTES[5];
  if (label.includes('hospital')) return ROUTES[6];
  if (label.includes('gas') || label.includes('station') || label.includes('fuel')) return ROUTES[7];
  if (label.includes('dealer') || label.includes('garage')) return ROUTES[8];

  return ROUTES[9];
}

