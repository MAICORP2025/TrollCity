import React, { useMemo } from 'react'
import * as THREE from 'three'
import {
  getCityRoadNetwork,
  getIntersectionClearMap,
  roadNodes,
  type RoadSegmentGeo,
  type IntersectionGeo,
  type StreetLamp as LampData,
} from './cityRoadNetwork'

// ---------------------------------------------------------------------------
// Lane markings (clipped near intersections to avoid clutter / z-fighting)
// ---------------------------------------------------------------------------

function LaneMarkings({
  length,
  width,
  lanes,
  centerLine,
  laneLines,
  clearEnd,
}: {
  length: number
  width: number
  lanes: 2 | 4
  centerLine: boolean
  laneLines: boolean
  clearEnd: number
}) {
  const dashLength = 3.2
  const dashGap = 2.6
  const dashCount = Math.floor((length - clearEnd * 2) / (dashLength + dashGap))
  const laneOffsets = lanes === 4 ? [-width * 0.22, width * 0.22] : [0]
  const dashStart = -length / 2 + clearEnd + dashLength / 2
  const effective = Math.max(0, dashCount)

  return (
    <>
      {laneOffsets.map((offsetX) =>
        Array.from({ length: effective }).map((_, index) => {
          const z = dashStart + index * (dashLength + dashGap)
          return (
            <mesh
              key={`${offsetX}-${index}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[offsetX, 0.035, z]}
            >
              <planeGeometry args={[0.18, dashLength]} />
              <meshBasicMaterial
                color="#d9e3ea"
                transparent
                opacity={0.78}
                depthWrite={false}
              />
            </mesh>
          )
        }),
      )}

      {/* Yellow centre line — only on avenues and streets, not residential. */}
      {centerLine && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.04, 0]}
        >
          <planeGeometry args={[0.16, length - clearEnd * 2]} />
          <meshBasicMaterial
            color="#f3c969"
            transparent
            opacity={0.92}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* White lane dividers on wide avenues. */}
      {laneLines && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0.32, 0.041, 0]}
        >
          <planeGeometry args={[0.08, length - clearEnd * 2]} />
          <meshBasicMaterial
            color="#f3c969"
            transparent
            opacity={0.72}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  )
}

function RoadShoulders({ length, width }: { length: number; width: number }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <React.Fragment key={side}>
          <mesh receiveShadow position={[side * (width / 2 + 0.34), 0.11, 0]}>
            <boxGeometry args={[0.7, 0.22, length]} />
            <meshStandardMaterial
              color="#39424d"
              roughness={0.94}
              metalness={0.02}
            />
          </mesh>

          <mesh receiveShadow position={[side * (width / 2 + 1.15), 0.17, 0]}>
            <boxGeometry args={[0.9, 0.32, length]} />
            <meshStandardMaterial
              color="#68717a"
              roughness={0.98}
              metalness={0.01}
            />
          </mesh>

          <mesh position={[side * (width / 2 + 0.68), 0.26, 0]}>
            <boxGeometry args={[0.1, 0.18, length]} />
            <meshStandardMaterial color="#b8c1c8" roughness={0.84} />
          </mesh>
        </React.Fragment>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// A single road segment derived entirely from node coordinates
// ---------------------------------------------------------------------------

function NetworkRoad({
  seg,
  endClear,
}: {
  seg: RoadSegmentGeo
  endClear: Map<string, number>
}) {
  const startClear =
    endClear.get(seg.startId) ?? seg.width / 2 + 1
  const endClearVal = endClear.get(seg.endId) ?? seg.width / 2 + 1
  const clearEnd = Math.max(startClear, endClearVal) + 0.4

  return (
    <group
      position={[seg.center[0], 0, seg.center[1]]}
      rotation={[0, seg.rotationY, 0]}
    >
      {/* Asphalt */}
      <mesh receiveShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[seg.width, 0.18, seg.length]} />
        <meshStandardMaterial
          color="#151a21"
          roughness={0.96}
          metalness={0.03}
        />
      </mesh>

      {/* Slightly lighter road surface */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[seg.width * 0.98, 0.02, seg.length * 0.98]} />
        <meshStandardMaterial
          color="#20262e"
          roughness={0.91}
          metalness={0.02}
        />
      </mesh>

      <RoadShoulders length={seg.length} width={seg.width} />
      <LaneMarkings
        length={seg.length}
        width={seg.width}
        lanes={seg.lanes}
        centerLine={seg.centerLine}
        laneLines={seg.laneLines}
        clearEnd={clearEnd}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Intersections — classified crossing pads that merge roads cleanly
// ---------------------------------------------------------------------------

function Crosswalk({
  side,
  roadWidth,
  padSize,
}: {
  side: 'north' | 'south' | 'east' | 'west'
  roadWidth: number
  padSize: number
}) {
  const stripes = 5
  const stripeW = Math.min(roadWidth * 0.8, padSize * 0.7)
  const stripeThick = 0.42
  const gap = 0.42
  const offset = padSize / 2 - 1.3

  const horizontal = side === 'north' || side === 'south'

  return (
    <>
      {Array.from({ length: stripes }).map((_, i) => {
        const p =
          -((stripes - 1) * (stripeThick + gap)) / 2 +
          i * (stripeThick + gap)

        const position: [number, number, number] = horizontal
          ? [p, 0.251, side === 'north' ? -offset : offset]
          : [side === 'west' ? -offset : offset, 0.251, p]

        const args: [number, number] = horizontal
          ? [stripeThick, stripeW]
          : [stripeW, stripeThick]

        return (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={position}
          >
            <planeGeometry args={args} />
            <meshBasicMaterial
              color="#dce4ea"
              transparent
              opacity={0.74}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </>
  )
}

function Intersection({ geo }: { geo: IntersectionGeo }) {
  const presentSides = (
    ['north', 'south', 'east', 'west'] as const
  ).filter((s) => geo.sides[s])

  return (
    <group position={[geo.x, 0, geo.z]}>
      {/* Intersection pad — sits above the road asphalt so crossings merge
          without z-fighting between the two road planes. */}
      <mesh receiveShadow position={[0, 0.14, 0]}>
        <boxGeometry args={[geo.size, 0.2, geo.size]} />
        <meshStandardMaterial
          color="#191f26"
          roughness={0.95}
          metalness={0.03}
        />
      </mesh>

      {presentSides.map((side) => (
        <Crosswalk
          key={side}
          side={side}
          roadWidth={geo.width}
          padSize={geo.size}
        />
      ))}

      {/* Subtle centre marker for the bigger avenue junctions. */}
      {geo.type === 'avenue' && geo.kind === 'fourway' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.252, 0]}>
          <ringGeometry args={[2.0, 2.15, 40]} />
          <meshBasicMaterial
            color="#f1c96c"
            transparent
            opacity={0.4}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Street light (emissive lamp; point light only on avenues to limit cost)
// ---------------------------------------------------------------------------

function StreetLight({ lamp }: { lamp: LampData }) {
  return (
    <group position={lamp.position}>
      <mesh castShadow position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 3.6, 8]} />
        <meshStandardMaterial color="#2c333b" roughness={0.5} metalness={0.72} />
      </mesh>

      <mesh
        castShadow
        position={[lamp.side * 0.48, 3.5, 0]}
        rotation={[0, 0, lamp.side * -0.18]}
      >
        <boxGeometry args={[0.95, 0.09, 0.09]} />
        <meshStandardMaterial color="#3a424b" roughness={0.42} metalness={0.7} />
      </mesh>

      <mesh position={[lamp.side * 0.9, 3.38, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.32]} />
        <meshStandardMaterial
          color="#f5d58c"
          emissive="#f2c86f"
          emissiveIntensity={2.3}
          roughness={0.35}
        />
      </mesh>

      {lamp.lit && (
        <pointLight
          position={[lamp.side * 0.9, 3.25, 0]}
          color="#ffd98f"
          intensity={2.0}
          distance={11}
          decay={2}
        />
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Decorative props kept from the previous version
// ---------------------------------------------------------------------------

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1.4, 8]} />
        <meshStandardMaterial color="#503424" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 1.8, 0]}>
        <coneGeometry args={[0.8, 2.1, 10]} />
        <meshStandardMaterial color="#1f5a39" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Bench({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[2.2, 0.18, 0.52]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.88} />
      </mesh>
      <mesh castShadow position={[0, 1.05, -0.2]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[2.2, 0.16, 0.65]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.88} />
      </mesh>
      {[-0.82, 0.82].map((x) => (
        <mesh key={x} castShadow position={[x, 0.25, 0]}>
          <boxGeometry args={[0.12, 0.5, 0.4]} />
          <meshStandardMaterial color="#282d33" metalness={0.55} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function Plaza({
  position,
  size = [18, 14],
}: {
  position: [number, number, number]
  size?: [number, number]
}) {
  const [width, depth] = size

  return (
    <group position={position}>
      <mesh receiveShadow position={[0, 0.11, 0]}>
        <boxGeometry args={[width, 0.22, depth]} />
        <meshStandardMaterial color="#26323a" roughness={0.93} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <boxGeometry args={[width * 0.82, 0.08, depth * 0.78]} />
        <meshStandardMaterial color="#41515a" roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[2.3, 2.6, 0.38, 40]} />
        <meshStandardMaterial color="#8b949b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[1.75, 1.9, 0.18, 40]} />
        <meshStandardMaterial
          color="#1c5870"
          emissive="#0d3242"
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      <pointLight position={[0, 2.3, 0]} color="#6edbff" intensity={1.8} distance={11} decay={2} />

      <Bench position={[-4.6, 0.2, -3.5]} rotationY={0.42} />
      <Bench position={[4.6, 0.2, 3.5]} rotationY={Math.PI + 0.42} />

      <Tree position={[-width * 0.38, 0.2, depth * 0.34]} scale={0.9} />
      <Tree position={[width * 0.38, 0.2, -depth * 0.34]} scale={1.05} />
      <Tree position={[width * 0.38, 0.2, depth * 0.34]} scale={0.82} />
      <Tree position={[-width * 0.38, 0.2, -depth * 0.34]} scale={1} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function CityRoads() {
  const network = useMemo(() => getCityRoadNetwork(), [])
  const endClear = useMemo(() => getIntersectionClearMap(), [])

  // Helpers retained so node ids are easy to reference in future districts.
  void roadNodes

  return (
    <group>
      {network.segments.map((seg) => (
        <NetworkRoad key={seg.id} seg={seg} endClear={endClear} />
      ))}

      {network.intersections.map((geo) => (
        <Intersection key={geo.id} geo={geo} />
      ))}

      {network.lamps.map((lamp, index) => (
        <StreetLight key={`lamp-${index}`} lamp={lamp} />
      ))}

      {/* District plazas anchored at memorable city nodes. */}
      <Plaza position={[roadNodes.centerPlaza[0], 0, roadNodes.centerPlaza[1]]} size={[20, 16]} />
      <Plaza position={[roadNodes.broadcastHub[0], 0, roadNodes.broadcastHub[1]]} size={[20, 15]} />
      <Plaza position={[roadNodes.auctionSquare[0], 0, roadNodes.auctionSquare[1]]} size={[22, 16]} />
    </group>
  )
}
