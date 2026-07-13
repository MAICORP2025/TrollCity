import React, { useMemo } from 'react';
import { Environment } from '@react-three/drei';
import CityRoads from './CityRoads';
import CityLights from './CityLights';
import CityTraffic from './CityTraffic';
import CityBuilding from './CityBuilding';
import PropertyBuilding from './PropertyBuilding';
import {
  getCityRoadNetwork,
  nearestBlockCenter,
  findBlockAt,
  type BlockBounds,
} from './cityRoadNetwork';
import type {
  HouseMarker,
  NeighborhoodCar,
} from './ThreeNeighborhoodMap';

// Decorative non-interactive buildings that fill out the skyline. They are
// snapped into real city blocks so they never sit on a road or intersection.
const DECOR_SEEDS: Array<{
  anchor: [number, number];
  width: number;
  depth: number;
  baseHeight: number;
  color: string;
  accent: string;
}> = [
  { anchor: [-58, 40], width: 7, depth: 7, baseHeight: 18, color: '#0e1830', accent: '#22d3ee' },
  { anchor: [-50, 46], width: 6, depth: 6, baseHeight: 14, color: '#101a30', accent: '#a855f7' },
  { anchor: [54, -44], width: 8, depth: 7, baseHeight: 22, color: '#0e1830', accent: '#22d3ee' },
  { anchor: [62, -50], width: 6, depth: 6, baseHeight: 12, color: '#101a30', accent: '#facc15' },
  { anchor: [-60, -42], width: 6, depth: 6, baseHeight: 16, color: '#0e1830', accent: '#22c55e' },
  { anchor: [50, 46], width: 7, depth: 6, baseHeight: 18, color: '#101a30', accent: '#22d3ee' },
];

function hash(x: number, z: number) {
  return Math.abs(Math.round((x * 73856093) ^ (z * 19349663)))
}

function buildDecorBuildings() {
  const network = getCityRoadNetwork()

  return DECOR_SEEDS.map((seed) => {
    const [bx, bz] = nearestBlockCenter(network, seed.anchor[0], seed.anchor[1])
    const block = findBlockAt(network, bx, bz)

    // Taller buildings in the dense core / broadcast district.
    const tall =
      block?.district === 'center' || block?.district === 'entertainment'

    return {
      position: [bx, 0, bz] as [number, number, number],
      width: seed.width,
      depth: seed.depth,
      height: seed.baseHeight + (tall ? 10 : 0),
      color: seed.color,
      accent: seed.accent,
    }
  })
}

// Fill vacant blocks with non-interactive city buildings so the map reads as a
// populated city. Blocks already holding a user property are skipped.
function buildFillerBuildings(occupied: Set<string>) {
  const network = getCityRoadNetwork()
  const palette = [
    { color: '#0e1830', accent: '#22d3ee' },
    { color: '#101a30', accent: '#a855f7' },
    { color: '#0d1a2b', accent: '#22c55e' },
    { color: '#101826', accent: '#facc15' },
  ]

  const fillable = network.blocks.filter((b) => {
    if (b.district === 'commercial') return true
    if (b.district === 'center' || b.district === 'entertainment') return true
    return false
  })

  const out: Array<{
    position: [number, number, number]
    width: number
    depth: number
    height: number
    color: string
    accent: string
  }> = []

  let n = 0
  for (const block of fillable) {
    const key = `${Math.round(block.cx)}_${Math.round(block.cz)}`
    if (occupied.has(key)) continue
    const h = hash(block.cx, block.cz)
    if (h % 3 !== 0) continue // sparsely fill
    if (n >= 34) break

    const tall = block.district !== 'commercial'
    const p = palette[h % palette.length]

    out.push({
      position: [block.cx, 0, block.cz],
      width: 5 + (h % 3),
      depth: 5 + ((h >> 2) % 3),
      height: (tall ? 16 : 10) + (h % 12),
      color: p.color,
      accent: p.accent,
    })
    n += 1
  }

  return out
}

interface PositionedHouse extends HouseMarker {
  worldX: number
  worldZ: number
}

interface CitySceneProps {
  houses: PositionedHouse[];
  cars: NeighborhoodCar[];
  onPropertyClick?: (property: HouseMarker) => void;
}

function Ground() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.1, 10]}
      receiveShadow
    >
      <planeGeometry args={[160, 150]} />

      <meshStandardMaterial
        color="#0a121c"
        roughness={0.96}
        metalness={0.03}
      />
    </mesh>
  );
}

export default function CityScene({
  houses,
  cars,
  onPropertyClick,
}: CitySceneProps) {
  const decorBuildings = useMemo(() => buildDecorBuildings(), [])

  const occupiedBlocks = useMemo(() => {
    const network = getCityRoadNetwork()
    const set = new Set<string>()
    for (const house of houses) {
      const block: BlockBounds | null = findBlockAt(
        network,
        house.worldX,
        house.worldZ,
      )
      if (block) set.add(`${Math.round(block.cx)}_${Math.round(block.cz)}`)
    }
    return set
  }, [houses])

  const fillerBuildings = useMemo(
    () => buildFillerBuildings(occupiedBlocks),
    [occupiedBlocks],
  )

  return (
    <>
      <ambientLight intensity={0.22} color="#6488bb" />

      <hemisphereLight
        args={['#466891', '#070b10', 0.38]}
        position={[0, 70, 0]}
      />

      <directionalLight
        castShadow
        position={[35, 70, 25]}
        intensity={1.3}
        color="#c4d8ff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-85}
        shadow-camera-right={85}
        shadow-camera-top={85}
        shadow-camera-bottom={-85}
      />

      <Environment preset="night" background={false} />

      <Ground />

      <CityRoads />

      <CityTraffic cars={cars} />

      <CityLights />

      {/* Decorative, non-interactive skyline */}
      {decorBuildings.map((building, index) => (
        <CityBuilding
          key={`decor-${index}`}
          position={building.position}
          width={building.width}
          depth={building.depth}
          height={building.height}
          color={building.color}
          accent={building.accent}
        />
      ))}

      {/* Filler city buildings inside vacant blocks */}
      {fillerBuildings.map((building, index) => (
        <CityBuilding
          key={`filler-${index}`}
          position={building.position}
          width={building.width}
          depth={building.depth}
          height={building.height}
          color={building.color}
          accent={building.accent}
        />
      ))}

      {houses.map((house) => (
        <PropertyBuilding
          key={house.id}
          property={house}
          position={[house.worldX, 0, house.worldZ]}
          onClick={() => onPropertyClick?.(house)}
        />
      ))}
    </>
  );
}
