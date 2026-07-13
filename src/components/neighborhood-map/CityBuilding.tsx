import React, { useMemo } from 'react';
import * as THREE from 'three';

interface CityBuildingProps {
  position: [number, number, number];
  width?: number;
  depth?: number;
  height?: number;
  color?: string;
  accent?: string;
}

// Decorative, non-interactive building used to fill out the city skyline.
export default function CityBuilding({
  position,
  width = 5,
  depth = 5,
  height = 12,
  color = '#0e1830',
  accent = '#22d3ee',
}: CityBuildingProps) {
  const windows = useMemo(() => {
    const cols = Math.max(1, Math.floor(width / 1.4));
    const rows = Math.max(2, Math.floor(height / 1.8));
    const cells: { x: number; y: number }[] = [];

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        cells.push({ x: c, y: r });
      }
    }

    const xStep = width / (cols + 1);
    const yStep = height / (rows + 1);

    return cells.map((cell) => ({
      x: -width / 2 + xStep * (cell.x + 1),
      y: yStep * (cell.y + 1),
    }));
  }, [width, depth, height]);

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={color}
          roughness={0.78}
          metalness={0.22}
          emissive={accent}
          emissiveIntensity={0.03}
        />
      </mesh>

      {/* Rooftop cap */}
      <mesh position={[0, height + 0.3, 0]} castShadow>
        <boxGeometry args={[width * 0.6, 0.6, depth * 0.6]} />
        <meshStandardMaterial color="#0b1120" roughness={0.85} />
      </mesh>

      {/* Glowing windows */}
      {windows.map((w, index) => (
        <mesh key={index} position={[w.x, w.y, depth / 2 + 0.02]}>
          <planeGeometry args={[0.7, 0.9]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
