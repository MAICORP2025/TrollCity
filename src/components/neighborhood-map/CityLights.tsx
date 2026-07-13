import React from 'react'

// Street lights are now driven by the road network (see cityRoadNetwork.ts and
// CityRoads.tsx), so this component only supplies the coloured ambient fill
// that makes the night city read clearly from the overhead camera.
export default function CityLights() {
  return (
    <group>
      {/* Soft cyan ambient fill so the night city reads clearly */}
      <pointLight position={[0, 18, 0]} color="#2dd4ef" intensity={6} distance={120} decay={1.6} />
      <pointLight position={[-40, 14, -30]} color="#a855f7" intensity={4} distance={90} decay={1.8} />
      <pointLight position={[40, 14, 30]} color="#22d3ee" intensity={4} distance={90} decay={1.8} />
    </group>
  )
}
