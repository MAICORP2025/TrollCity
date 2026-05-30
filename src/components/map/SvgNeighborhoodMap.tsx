import React from 'react';
import PropertyMarkerV2 from './PropertyMarkerV2';
import CarOnPath from './CarOnPath';

interface HouseMarker {
  id: string;
  x: number; // 0-100 percent
  y: number; // 0-100 percent
  owner?: string;
  isLive?: boolean;
  badges?: string[];
}

export default function SvgNeighborhoodMap({ houses = [], cars = [] }: { houses?: HouseMarker[]; cars?: { pathId: string; offset?: number; color?: string }[] }) {
  return (
    <div className="w-full h-[620px] bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl overflow-hidden relative">
      <svg viewBox="0 0 1200 800" className="w-full h-full">
        <defs>
          <linearGradient id="roadGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="#263244" />
            <stop offset="100%" stopColor="#1b2430" />
          </linearGradient>
          <linearGradient id="bgGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#07111f" />
            <stop offset="100%" stopColor="#041018" />
          </linearGradient>
          <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="1200" height="800" fill="url(#bgGrad)" />

        {/* Parks */}
        <ellipse cx="220" cy="160" rx="140" ry="80" fill="#06313a" opacity="0.28" />
        <ellipse cx="980" cy="680" rx="180" ry="120" fill="#2b3a1e" opacity="0.18" />

        {/* Roads (example curvy roads) */}
        <path id="road-main" d="M100,700 C200,600 400,600 500,520 C620,420 780,420 900,500 C980,560 1100,560 1100,560" stroke="url(#roadGrad)" strokeWidth={36} strokeLinecap="round" fill="none" filter="url(#shadow)" />
        <path id="road-cross" d="M300,80 C350,180 550,180 650,260 C720,310 760,380 760,460" stroke="url(#roadGrad)" strokeWidth={28} strokeLinecap="round" fill="none" filter="url(#shadow)" />

        {/* Road centerlines */}
        <path d="M100,700 C200,600 400,600 500,520 C620,420 780,420 900,500 C980,560 1100,560 1100,560" stroke="#f3c677" strokeWidth={2} strokeDasharray="8 10" fill="none" opacity="0.6" />

        {/* Street signs */}
        <g id="signs" fill="#ffffff" fontSize={12} fontFamily="sans-serif">
          <g transform="translate(520,500)">
            <rect x={-32} y={-60} width={64} height={26} rx={4} fill="#0f1724" stroke="#cbd5e1" strokeWidth={0.8} />
            <text x={0} y={-42} fill="#cfe8ff" textAnchor="middle">Main Troll Blvd</text>
            <rect x={-2} y={-34} width={2} height={36} fill="#1f2937" />
          </g>
          <g transform="translate(700,220)">
            <rect x={-28} y={-60} width={56} height={22} rx={4} fill="#071728" stroke="#9fb8ff" strokeWidth={0.7} />
            <text x={0} y={-46} fill="#aee6ff" textAnchor="middle">Creator Row</text>
            <rect x={-2} y={-34} width={2} height={36} fill="#1f2937" />
          </g>
        </g>

        {/* Cars following paths */}
        {cars.map((c, idx) => (
          <CarOnPath key={idx} pathId={c.pathId} color={c.color || '#ff6b6b'} offset={c.offset || (idx * 20) % 100} />
        ))}

        {/* House markers as foreignObject for rich HTML popups */}
        {houses.map((h) => (
          <foreignObject key={h.id} x={(h.x / 100) * 1200 - 70} y={(h.y / 100) * 800 - 52} width={140} height={100} pointerEvents="none">
            <div style={{ pointerEvents: 'auto' }}>
              <PropertyMarkerV2 id={h.id} x={h.x} y={h.y} owner={h.owner} isLive={h.isLive} badges={h.badges} />
            </div>
          </foreignObject>
        ))}
      </svg>
      {/* Optional overlay UI */}
      <div className="absolute left-4 top-4 text-xs text-slate-300 bg-black/40 backdrop-blur rounded-full px-3 py-1">Neighborhood Map</div>
    </div>
  );
}
