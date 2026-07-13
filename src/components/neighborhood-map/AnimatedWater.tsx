import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;

  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;

    vec3 transformed = position;

    float waveA =
      sin((position.x * 0.32) + (uTime * 0.65)) * 0.22;

    float waveB =
      cos((position.y * 0.44) + (uTime * 0.48)) * 0.14;

    float waveC =
      sin(((position.x + position.y) * 0.18) + (uTime * 0.35)) * 0.1;

    transformed.z += waveA + waveB + waveC;

    vWave = transformed.z;

    gl_Position =
      projectionMatrix *
      modelViewMatrix *
      vec4(transformed, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;

  varying vec2 vUv;
  varying float vWave;

  void main() {
    vec3 deepWater = vec3(0.005, 0.055, 0.12);
    vec3 surfaceWater = vec3(0.015, 0.22, 0.34);
    vec3 cityReflection = vec3(0.1, 0.55, 0.8);

    float movingReflection =
      sin((vUv.x * 90.0) + (uTime * 1.1)) *
      cos((vUv.y * 45.0) - (uTime * 0.7));

    float reflectionMask =
      smoothstep(0.78, 1.0, movingReflection);

    float waveBrightness =
      smoothstep(-0.2, 0.45, vWave);

    vec3 color =
      mix(deepWater, surfaceWater, waveBrightness * 0.65);

    color += cityReflection * reflectionMask * 0.18;

    gl_FragColor = vec4(color, 0.96);
  }
`;

export default function AnimatedWater() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: {
        value: 0,
      },
    }),
    [],
  );

  useFrame((state) => {
    if (!materialRef.current) {
      return;
    }

    if (document.hidden) {
      return;
    }

    materialRef.current.uniforms.uTime.value =
      state.clock.elapsedTime;
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, -48]}
      receiveShadow
    >
      <planeGeometry args={[150, 34, 120, 40]} />

      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
