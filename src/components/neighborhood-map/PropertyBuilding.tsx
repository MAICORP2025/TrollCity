import React, { useMemo, useState } from 'react'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { HouseMarker } from './ThreeNeighborhoodMap'

type PropertyKind = 'house' | 'mansion' | 'tower'

interface PositionedHouse extends HouseMarker {
  worldX: number
  worldZ: number
  kind?: PropertyKind
  isAdmin?: boolean
  upgradeLevel?: number
  label?: string
}

interface PropertyBuildingProps {
  property: PositionedHouse
  position: [number, number, number]
  onClick?: () => void
}

interface BuildingPalette {
  wall: string
  wallSecondary: string
  roof: string
  trim: string
  glass: string
  window: string
  door: string
  ground: string
}

function hashString(value: string) {
  return value.split('').reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) >>> 0
  }, 2166136261)
}

function getStatusColor(property: PositionedHouse) {
  if (property.status === 'raided') return '#ef4444'
  if (property.status === 'locked') return '#64748b'
  if (property.status === 'admin' || property.isAdmin) return '#facc15'
  if (property.isLive) return '#22c55e'
  return '#22d3ee'
}

function inferKind(property: PositionedHouse, seed: number): PropertyKind {
  if (property.kind) return property.kind
  if (property.status === 'admin' || property.isAdmin) return 'mansion'
  if ((property.upgradeLevel ?? 0) >= 4) return 'tower'
  if ((property.upgradeLevel ?? 0) >= 2) return 'mansion'
  return seed % 7 === 0 ? 'mansion' : 'house'
}

function getPalette(seed: number, kind: PropertyKind): BuildingPalette {
  const housePalettes: BuildingPalette[] = [
    {
      wall: '#d5d0c4',
      wallSecondary: '#a89f90',
      roof: '#2f343d',
      trim: '#eee8dc',
      glass: '#16384e',
      window: '#ffd98a',
      door: '#493226',
      ground: '#243128',
    },
    {
      wall: '#aab4bc',
      wallSecondary: '#69757e',
      roof: '#202731',
      trim: '#dce5ea',
      glass: '#18394f',
      window: '#bfe9ff',
      door: '#30251f',
      ground: '#27362c',
    },
    {
      wall: '#b79273',
      wallSecondary: '#755b49',
      roof: '#382b28',
      trim: '#e7d4c2',
      glass: '#173748',
      window: '#ffe2a6',
      door: '#4a241c',
      ground: '#2f3827',
    },
  ]

  const mansionPalettes: BuildingPalette[] = [
    {
      wall: '#ded7c9',
      wallSecondary: '#8d887e',
      roof: '#242933',
      trim: '#f2ede3',
      glass: '#112f45',
      window: '#ffdb83',
      door: '#36281f',
      ground: '#20342a',
    },
    {
      wall: '#8b939c',
      wallSecondary: '#424b56',
      roof: '#151b23',
      trim: '#d8e0e5',
      glass: '#0b3046',
      window: '#aee9ff',
      door: '#201a18',
      ground: '#24342a',
    },
  ]

  const towerPalettes: BuildingPalette[] = [
    {
      wall: '#26313d',
      wallSecondary: '#111923',
      roof: '#0d1219',
      trim: '#8ba3b7',
      glass: '#0b3f5a',
      window: '#8ee8ff',
      door: '#d2af61',
      ground: '#222b2d',
    },
    {
      wall: '#32313a',
      wallSecondary: '#17161c',
      roof: '#0f1015',
      trim: '#aa9d7c',
      glass: '#17384c',
      window: '#ffd77a',
      door: '#b88735',
      ground: '#242b2a',
    },
  ]

  const collection =
    kind === 'tower'
      ? towerPalettes
      : kind === 'mansion'
        ? mansionPalettes
        : housePalettes

  return collection[seed % collection.length]
}

function WindowGrid({
  width,
  height,
  depth,
  rows,
  columns,
  color,
  seed,
}: {
  width: number
  height: number
  depth: number
  rows: number
  columns: number
  color: string
  seed: number
}) {
  const windows = useMemo(() => {
    const result: React.ReactNode[] = []
    const horizontalSpacing = width / (columns + 1)
    const verticalSpacing = height / (rows + 1)

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const illuminated = (seed + row * 13 + column * 7) % 5 !== 0
        const x = -width / 2 + horizontalSpacing * (column + 1)
        const y = verticalSpacing * (row + 1)

        result.push(
          <mesh key={`front-${row}-${column}`} position={[x, y, depth / 2 + 0.012]}>
            <planeGeometry args={[horizontalSpacing * 0.42, verticalSpacing * 0.42]} />
            <meshStandardMaterial
              color={illuminated ? color : '#0c1820'}
              emissive={illuminated ? color : '#000000'}
              emissiveIntensity={illuminated ? 1.3 : 0}
              roughness={0.25}
              metalness={0.2}
            />
          </mesh>,
        )

        result.push(
          <mesh
            key={`back-${row}-${column}`}
            position={[x, y, -depth / 2 - 0.012]}
            rotation={[0, Math.PI, 0]}
          >
            <planeGeometry args={[horizontalSpacing * 0.42, verticalSpacing * 0.42]} />
            <meshStandardMaterial
              color={illuminated ? color : '#0c1820'}
              emissive={illuminated ? color : '#000000'}
              emissiveIntensity={illuminated ? 1.1 : 0}
              roughness={0.25}
            />
          </mesh>,
        )
      }
    }

    return result
  }, [width, height, depth, rows, columns, color, seed])

  return <>{windows}</>
}

function SideWindows({
  width,
  height,
  depth,
  rows,
  color,
  seed,
}: {
  width: number
  height: number
  depth: number
  rows: number
  color: string
  seed: number
}) {
  const spacing = height / (rows + 1)

  return (
    <>
      {Array.from({ length: rows }).map((_, index) => {
        const illuminated = (seed + index * 11) % 4 !== 0
        const y = spacing * (index + 1)

        return (
          <React.Fragment key={index}>
            <mesh position={[width / 2 + 0.012, y, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[Math.min(depth * 0.46, 2.2), spacing * 0.42]} />
              <meshStandardMaterial
                color={illuminated ? color : '#0c1820'}
                emissive={illuminated ? color : '#000000'}
                emissiveIntensity={illuminated ? 1.05 : 0}
                roughness={0.25}
              />
            </mesh>

            <mesh position={[-width / 2 - 0.012, y, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[Math.min(depth * 0.46, 2.2), spacing * 0.42]} />
              <meshStandardMaterial
                color={illuminated ? color : '#0c1820'}
                emissive={illuminated ? color : '#000000'}
                emissiveIntensity={illuminated ? 0.95 : 0}
                roughness={0.25}
              />
            </mesh>
          </React.Fragment>
        )
      })}
    </>
  )
}

function GabledRoof({
  width,
  depth,
  color,
}: {
  width: number
  depth: number
  color: string
}) {
  return (
    <group>
      <mesh castShadow position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[width * 0.77, width * 0.77, depth * 1.12]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.08} />
      </mesh>
    </group>
  )
}

function FlatRoof({
  width,
  depth,
  color,
  trim,
}: {
  width: number
  depth: number
  color: string
  trim: string
}) {
  return (
    <group>
      <mesh castShadow position={[0, 0.18, 0]}>
        <boxGeometry args={[width * 1.03, 0.36, depth * 1.03]} />
        <meshStandardMaterial color={color} roughness={0.72} metalness={0.2} />
      </mesh>

      <mesh castShadow position={[0, 0.48, 0]}>
        <boxGeometry args={[width * 0.5, 0.32, depth * 0.42]} />
        <meshStandardMaterial color={trim} roughness={0.6} metalness={0.25} />
      </mesh>
    </group>
  )
}

function Landscaping({
  width,
  depth,
  seed,
}: {
  width: number
  depth: number
  seed: number
}) {
  const trees = useMemo(() => {
    const count = 2 + (seed % 3)

    return Array.from({ length: count }).map((_, index) => {
      const side = index % 2 === 0 ? -1 : 1
      const x = side * (width / 2 + 1.2 + (index % 2) * 0.4)
      const z = -depth / 2 + 1 + ((index * 1.7) % Math.max(depth - 2, 1))

      return { x, z, scale: 0.7 + ((seed + index) % 3) * 0.13 }
    })
  }, [width, depth, seed])

  return (
    <>
      {trees.map((tree, index) => (
        <group
          key={index}
          position={[tree.x, 0, tree.z]}
          scale={tree.scale}
        >
          <mesh castShadow position={[0, 0.65, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 1.3, 8]} />
            <meshStandardMaterial color="#4d3020" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.7, 0]}>
            <coneGeometry args={[0.75, 1.9, 10]} />
            <meshStandardMaterial color="#1f5b3b" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function HouseBuilding({
  palette,
  seed,
}: {
  palette: BuildingPalette
  seed: number
}) {
  const width = 5.6 + (seed % 3) * 0.35
  const depth = 5 + ((seed >> 2) % 3) * 0.3
  const height = 3.7 + ((seed >> 4) % 2) * 0.4

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[width + 2.6, 0.24, depth + 2.8]} />
        <meshStandardMaterial color={palette.ground} roughness={0.98} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={palette.wall} roughness={0.78} />
      </mesh>

      <mesh castShadow position={[0, height + 0.05, 0]}>
        <GabledRoof width={width} depth={depth} color={palette.roof} />
      </mesh>

      <mesh castShadow position={[0, 1.5, depth / 2 + 0.18]}>
        <boxGeometry args={[1.45, 2.65, 0.35]} />
        <meshStandardMaterial color={palette.door} roughness={0.62} />
      </mesh>

      <mesh position={[0, 1.7, depth / 2 + 0.37]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial
          color="#f5c76f"
          emissive="#f5c76f"
          emissiveIntensity={1.8}
        />
      </mesh>

      <WindowGrid
        width={width}
        height={height}
        depth={depth}
        rows={2}
        columns={3}
        color={palette.window}
        seed={seed}
      />

      <SideWindows
        width={width}
        height={height}
        depth={depth}
        rows={2}
        color={palette.window}
        seed={seed + 5}
      />

      <mesh receiveShadow position={[0, 0.17, depth / 2 + 2.5]}>
        <boxGeometry args={[1.8, 0.16, 5]} />
        <meshStandardMaterial color="#687078" roughness={0.95} />
      </mesh>

      <Landscaping width={width} depth={depth} seed={seed} />

      <pointLight
        position={[0, 2.4, depth / 2 + 1.1]}
        color="#ffd28a"
        intensity={1.9}
        distance={8}
        decay={2}
      />
    </group>
  )
}

function MansionBuilding({
  palette,
  seed,
  admin,
}: {
  palette: BuildingPalette
  seed: number
  admin: boolean
}) {
  const width = admin ? 10.8 : 9.2
  const depth = admin ? 8.8 : 7.7
  const height = admin ? 5.8 : 5.1
  const wingWidth = width * 0.3

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[width + 5, 0.24, depth + 5.5]} />
        <meshStandardMaterial color={palette.ground} roughness={0.98} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width * 0.56, height, depth]} />
        <meshStandardMaterial color={palette.wall} roughness={0.72} />
      </mesh>

      <mesh castShadow receiveShadow position={[-width * 0.36, height * 0.42, 0.4]}>
        <boxGeometry args={[wingWidth, height * 0.84, depth * 0.82]} />
        <meshStandardMaterial color={palette.wallSecondary} roughness={0.76} />
      </mesh>

      <mesh castShadow receiveShadow position={[width * 0.36, height * 0.42, 0.4]}>
        <boxGeometry args={[wingWidth, height * 0.84, depth * 0.82]} />
        <meshStandardMaterial color={palette.wallSecondary} roughness={0.76} />
      </mesh>

      <group position={[0, height, 0]}>
        <FlatRoof
          width={width * 0.58}
          depth={depth}
          color={palette.roof}
          trim={palette.trim}
        />
      </group>

      <group position={[-width * 0.36, height * 0.84, 0.4]}>
        <FlatRoof
          width={wingWidth}
          depth={depth * 0.82}
          color={palette.roof}
          trim={palette.trim}
        />
      </group>

      <group position={[width * 0.36, height * 0.84, 0.4]}>
        <FlatRoof
          width={wingWidth}
          depth={depth * 0.82}
          color={palette.roof}
          trim={palette.trim}
        />
      </group>

      <mesh castShadow position={[0, 1.65, depth / 2 + 0.28]}>
        <boxGeometry args={[2.05, 3.1, 0.5]} />
        <meshStandardMaterial color={palette.door} roughness={0.5} metalness={0.18} />
      </mesh>

      <mesh castShadow position={[0, 3.7, depth / 2 + 0.38]}>
        <boxGeometry args={[3.6, 0.38, 0.65]} />
        <meshStandardMaterial color={palette.trim} roughness={0.55} />
      </mesh>

      {[-1.55, 1.55].map((x) => (
        <mesh key={x} castShadow position={[x, 1.75, depth / 2 + 0.35]}>
          <cylinderGeometry args={[0.22, 0.28, 3.45, 14]} />
          <meshStandardMaterial color={palette.trim} roughness={0.64} />
        </mesh>
      ))}

      <WindowGrid
        width={width * 0.52}
        height={height}
        depth={depth}
        rows={2}
        columns={3}
        color={palette.window}
        seed={seed}
      />

      <mesh receiveShadow position={[0, 0.17, depth / 2 + 4.2]}>
        <boxGeometry args={[3, 0.16, 7.2]} />
        <meshStandardMaterial color="#676e75" roughness={0.96} />
      </mesh>

      <mesh receiveShadow position={[width * 0.32, 0.2, -depth / 2 - 1.8]}>
        <boxGeometry args={[4.8, 0.22, 2.7]} />
        <meshStandardMaterial
          color="#0d4860"
          emissive="#0b3040"
          emissiveIntensity={0.35}
          roughness={0.18}
          metalness={0.1}
        />
      </mesh>

      <mesh position={[width * 0.32, 0.35, -depth / 2 - 1.8]}>
        <boxGeometry args={[4.2, 0.08, 2.2]} />
        <meshStandardMaterial
          color="#2a8eb1"
          emissive="#14536b"
          emissiveIntensity={0.75}
          transparent
          opacity={0.9}
        />
      </mesh>

      <Landscaping width={width + 1} depth={depth + 1} seed={seed + 13} />

      {admin && (
        <>
          <mesh castShadow position={[0, height + 1.4, 0]}>
            <cylinderGeometry args={[0.45, 0.72, 2.8, 12]} />
            <meshStandardMaterial color="#b78f42" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, height + 2.95, 0]}>
            <octahedronGeometry args={[0.58, 0]} />
            <meshStandardMaterial
              color="#ffd86a"
              emissive="#ffb82e"
              emissiveIntensity={1.8}
              metalness={0.5}
              roughness={0.2}
            />
          </mesh>
          <pointLight
            position={[0, height + 2.9, 0]}
            color="#ffd36b"
            intensity={3}
            distance={15}
            decay={2}
          />
        </>
      )}

      <pointLight
        position={[0, 3, depth / 2 + 1.4]}
        color={admin ? '#ffd36b' : '#ffd89a'}
        intensity={admin ? 3 : 2.2}
        distance={12}
        decay={2}
      />
    </group>
  )
}

function TowerBuilding({
  palette,
  seed,
}: {
  palette: BuildingPalette
  seed: number
}) {
  const width = 6.8 + (seed % 3) * 0.45
  const depth = 6.6 + ((seed >> 3) % 3) * 0.4
  const height = 15 + (seed % 7)

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[width + 4, 0.24, depth + 4]} />
        <meshStandardMaterial color={palette.ground} roughness={0.96} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={palette.wall}
          roughness={0.36}
          metalness={0.42}
        />
      </mesh>

      <mesh castShadow position={[0, height * 0.62, depth / 2 + 0.08]}>
        <boxGeometry args={[width * 0.78, height * 0.54, 0.18]} />
        <meshStandardMaterial
          color={palette.glass}
          roughness={0.14}
          metalness={0.72}
        />
      </mesh>

      <WindowGrid
        width={width}
        height={height}
        depth={depth}
        rows={7}
        columns={4}
        color={palette.window}
        seed={seed}
      />

      <SideWindows
        width={width}
        height={height}
        depth={depth}
        rows={7}
        color={palette.window}
        seed={seed + 19}
      />

      <group position={[0, height, 0]}>
        <FlatRoof
          width={width}
          depth={depth}
          color={palette.roof}
          trim={palette.trim}
        />
      </group>

      <mesh castShadow position={[0, height + 2.1, 0]}>
        <cylinderGeometry args={[0.12, 0.28, 3.9, 10]} />
        <meshStandardMaterial color="#9aa9b6" metalness={0.82} roughness={0.22} />
      </mesh>

      <mesh position={[0, height + 4.1, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color="#ff4b4b"
          emissive="#ff1f1f"
          emissiveIntensity={2.6}
        />
      </mesh>

      <mesh castShadow position={[0, 1.7, depth / 2 + 0.25]}>
        <boxGeometry args={[2.1, 3.2, 0.48]} />
        <meshStandardMaterial
          color={palette.door}
          metalness={0.42}
          roughness={0.32}
        />
      </mesh>

      <pointLight
        position={[0, 4, depth / 2 + 1.7]}
        color={palette.window}
        intensity={2.8}
        distance={14}
        decay={2}
      />
    </group>
  )
}

export default function PropertyBuilding({
  property,
  position,
  onClick,
}: PropertyBuildingProps) {
  const [hovered, setHovered] = useState(false)

  const seed = useMemo(() => hashString(String(property.id)), [property.id])
  const kind = useMemo(() => inferKind(property, seed), [property, seed])
  const palette = useMemo(() => getPalette(seed, kind), [seed, kind])
  const statusColor = getStatusColor(property)

  const buildingHeight =
    kind === 'tower'
      ? 19 + (seed % 5)
      : kind === 'mansion'
        ? property.isAdmin || property.status === 'admin'
          ? 10
          : 8.5
        : 7

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onClick?.()
  }

  const handlePointerEnter = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }

  const handlePointerLeave = () => {
    setHovered(false)
    document.body.style.cursor = 'default'
  }

  return (
    <group
      position={position}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      scale={hovered ? 1.025 : 1}
    >
      <HouseSelectionBoundary
        statusColor={statusColor}
        hovered={hovered}
        kind={kind}
      />

      {kind === 'tower' ? (
        <TowerBuilding palette={palette} seed={seed} />
      ) : kind === 'mansion' ? (
        <MansionBuilding
          palette={palette}
          seed={seed}
          admin={Boolean(property.isAdmin || property.status === 'admin')}
        />
      ) : (
        <HouseBuilding palette={palette} seed={seed} />
      )}

      {hovered && (
        <Html
          position={[0, buildingHeight + 1.8, 0]}
          center
          distanceFactor={14}
          style={{ pointerEvents: 'none' }}
        >
          <div className="min-w-[190px] rounded-xl border border-cyan-300/25 bg-slate-950/95 px-3 py-2 text-white shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-xs font-black">
                {property.label || property.owner || 'Vacant Property'}
              </div>

              {property.isLive && (
                <div className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                  Live
                </div>
              )}
            </div>

            <div className="mt-1 flex items-center justify-between gap-3 text-[10px]">
              <span className="capitalize text-slate-300">
                {kind} · {property.status ?? 'owned'}
              </span>
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: statusColor,
                  boxShadow: `0 0 10px ${statusColor}`,
                }}
              />
            </div>

            {property.badges && property.badges.length > 0 && (
              <div className="mt-1 max-w-[180px] truncate text-[9px] text-cyan-200">
                {property.badges.join(' • ')}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5 text-[9px]">
              <span className="text-slate-400">Property ID</span>
              <span className="font-mono text-slate-200">
                {String(property.id).slice(0, 8)}
              </span>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function HouseSelectionBoundary({
  statusColor,
  hovered,
  kind,
}: {
  statusColor: string
  hovered: boolean
  kind: PropertyKind
}) {
  const radius = kind === 'tower' ? 7 : kind === 'mansion' ? 9 : 6

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[radius, radius + 0.22, 48]} />
        <meshBasicMaterial
          color={statusColor}
          transparent
          opacity={hovered ? 0.88 : 0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {hovered && (
        <pointLight
          position={[0, 1.2, 0]}
          color={statusColor}
          intensity={2.1}
          distance={12}
          decay={2}
        />
      )}
    </>
  )
}