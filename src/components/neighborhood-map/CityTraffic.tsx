import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { NeighborhoodCar } from './ThreeNeighborhoodMap';

interface CityTrafficProps {
  cars: NeighborhoodCar[];
}

interface TrafficRoute {
  id: string;
  curve: THREE.CatmullRomCurve3;
}

interface MovingCarProps {
  route: TrafficRoute;
  color: string;
  offset: number;
  speed: number;
}

// Traffic follows the real avenue grid so cars drive on actual roads instead
// of floating diagonal paths. Routes use the same ids the hub references.
function createTrafficRoutes(): TrafficRoute[] {
  const Y = 0.45

  return [
    {
      // Main east/west avenue (z = 0)
      id: 'road-main',
      curve: new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-64, Y, 0),
          new THREE.Vector3(-32, Y, 0),
          new THREE.Vector3(0, Y, 0),
          new THREE.Vector3(32, Y, 0),
          new THREE.Vector3(64, Y, 0),
        ],
        true,
        'catmullrom',
        0,
      ),
    },
    {
      // Main north/south avenue (x = 0)
      id: 'road-cross',
      curve: new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(0, Y, -56),
          new THREE.Vector3(0, Y, -28),
          new THREE.Vector3(0, Y, 0),
          new THREE.Vector3(0, Y, 28),
          new THREE.Vector3(0, Y, 56),
        ],
        true,
        'catmullrom',
        0,
      ),
    },
    {
      // Northern avenue (z = 28)
      id: 'waterfront-road',
      curve: new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-64, Y, 28),
          new THREE.Vector3(-32, Y, 28),
          new THREE.Vector3(0, Y, 28),
          new THREE.Vector3(32, Y, 28),
          new THREE.Vector3(64, Y, 28),
        ],
        true,
        'catmullrom',
        0,
      ),
    },
  ]
}

function CarModel({
  color,
  headlights = true,
}: {
  color: string;
  headlights?: boolean;
}) {
  return (
    <group>
      {/* Main car body */}
      <mesh castShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[1.65, 0.52, 3]} />

        <meshStandardMaterial
          color={color}
          roughness={0.34}
          metalness={0.58}
        />
      </mesh>

      {/* Car roof */}
      <mesh castShadow position={[0, 0.83, -0.15]}>
        <boxGeometry args={[1.3, 0.48, 1.55]} />

        <meshStandardMaterial
          color="#111827"
          roughness={0.18}
          metalness={0.75}
        />
      </mesh>

      {/* Front windshield */}
      <mesh position={[0, 0.86, 0.68]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[1.12, 0.43]} />

        <meshStandardMaterial
          color="#79bcd8"
          transparent
          opacity={0.62}
          roughness={0.15}
          metalness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wheels */}
      {[
        [-0.88, 0.25, 0.92],
        [0.88, 0.25, 0.92],
        [-0.88, 0.25, -0.92],
        [0.88, 0.25, -0.92],
      ].map(([x, y, z], index) => (
        <mesh
          key={index}
          castShadow
          position={[x, y, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.31, 0.31, 0.2, 12]} />

          <meshStandardMaterial
            color="#05070b"
            roughness={0.92}
          />
        </mesh>
      ))}

      {headlights && (
        <>
          <mesh position={[-0.54, 0.48, 1.53]}>
            <sphereGeometry args={[0.12, 10, 10]} />

            <meshBasicMaterial color="#fff7d1" />
          </mesh>

          <mesh position={[0.54, 0.48, 1.53]}>
            <sphereGeometry args={[0.12, 10, 10]} />

            <meshBasicMaterial color="#fff7d1" />
          </mesh>

          <pointLight
            position={[-0.5, 0.5, 1.7]}
            color="#fff4c2"
            intensity={2.5}
            distance={7}
            decay={2}
          />

          <pointLight
            position={[0.5, 0.5, 1.7]}
            color="#fff4c2"
            intensity={2.5}
            distance={7}
            decay={2}
          />
        </>
      )}

      {/* Taillights */}
      <mesh position={[-0.54, 0.48, -1.53]}>
        <sphereGeometry args={[0.1, 10, 10]} />

        <meshBasicMaterial color="#ff2525" />
      </mesh>

      <mesh position={[0.54, 0.48, -1.53]}>
        <sphereGeometry args={[0.1, 10, 10]} />

        <meshBasicMaterial color="#ff2525" />
      </mesh>
    </group>
  );
}

function MovingCar({
  route,
  color,
  offset,
  speed,
}: MovingCarProps) {
  const carRef = useRef<THREE.Group>(null);

  const progressRef = useRef(
    THREE.MathUtils.euclideanModulo(offset / 100, 1),
  );

  const currentPosition = useMemo(
    () => new THREE.Vector3(),
    [],
  );

  const lookAtPosition = useMemo(
    () => new THREE.Vector3(),
    [],
  );

  useFrame((_, delta) => {
    const car = carRef.current;

    if (!car || document.hidden) {
      return;
    }

    progressRef.current = THREE.MathUtils.euclideanModulo(
      progressRef.current + delta * speed,
      1,
    );

    const progress = progressRef.current;

    route.curve.getPointAt(progress, currentPosition);

    route.curve.getPointAt(
      THREE.MathUtils.euclideanModulo(progress + 0.002, 1),
      lookAtPosition,
    );

    car.position.copy(currentPosition);

    car.lookAt(
      lookAtPosition.x,
      currentPosition.y,
      lookAtPosition.z,
    );
  });

  return (
    <group ref={carRef}>
      <CarModel color={color} />
    </group>
  );
}

export default function CityTraffic({
  cars,
}: CityTrafficProps) {
  const routes = useMemo(
    () => createTrafficRoutes(),
    [],
  );

  const routeMap = useMemo(
    () =>
      new Map(
        routes.map((route) => [
          route.id,
          route,
        ]),
      ),
    [routes],
  );

  const visibleCars = useMemo(() => {
    return cars
      .map((car, index) => {
        const route =
          routeMap.get(car.pathId) ??
          routes[index % routes.length];

        if (!route) {
          return null;
        }

        return {
          key: `${car.pathId}-${index}`,
          route,
          color: car.color ?? '#ff6b6b',
          offset: car.offset ?? (index * 23) % 100,
          speed: 0.018 + (index % 4) * 0.004,
        };
      })
      .filter(
        (
          car,
        ): car is {
          key: string;
          route: TrafficRoute;
          color: string;
          offset: number;
          speed: number;
        } => Boolean(car),
      );
  }, [cars, routeMap, routes]);

  return (
    <group>
      {visibleCars.map((car) => (
        <MovingCar
          key={car.key}
          route={car.route}
          color={car.color}
          offset={car.offset}
          speed={car.speed}
        />
      ))}
    </group>
  );
}
