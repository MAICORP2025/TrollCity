import React, { useState } from 'react';
import { ChevronDown, Layout } from 'lucide-react';

interface LayoutSelectorProps {
  currentLayout: string;
  onLayoutChange: (layout: string) => void;
}

const LAYOUTS = [
  { id: 'hero-immersive', name: 'Hero Immersive', premium: true },
  { id: 'glass-bento', name: 'Glass Bento', premium: true },
  { id: 'cinematic-marquee', name: 'Cinematic Marquee', premium: true },
  { id: 'spread-magazine', name: 'Spread Magazine', premium: true },
  { id: 'neon-noir', name: 'Neon Noir', premium: true },
  { id: 'parallax-depth', name: 'Parallax Depth', premium: true },
  { id: 'luxury-carousel', name: 'Luxury Carousel', premium: true },
  { id: 'ambient-aurora', name: 'Ambient Aurora', premium: true },
  { id: 'swiss-minimal', name: 'Swiss Minimal', premium: true },
  { id: 'dark-crystalline', name: 'Dark Crystalline', premium: true },
];

export default function LayoutSelector({ currentLayout, onLayoutChange }: LayoutSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentLayoutConfig = LAYOUTS.find(l => l.id === currentLayout) || LAYOUTS[0];

  return (
    <div className="fixed top-20 right-4 z-[9999]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-lg border border-white/20 hover:border-cyan-400/50 rounded-full text-white/80 hover:text-cyan-300 text-xs font-medium transition-all shadow-lg hover:shadow-cyan-500/20"
      >
        <Layout size={14} />
        <span>{currentLayoutConfig.name}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl z-50">
            {LAYOUTS.map((layout) => (
              <button
                key={layout.id}
                onClick={() => {
                  onLayoutChange(layout.id);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between group ${
                  currentLayout === layout.id
                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border-l-2 border-cyan-400'
                    : 'text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
                }`}
              >
                <span>{layout.name}</span>
                {layout.premium && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-300 border border-yellow-500/30 rounded-full">
                    PREMIUM
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
