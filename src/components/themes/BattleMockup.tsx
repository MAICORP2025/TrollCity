import React from 'react';
import { motion } from 'framer-motion';
import type { BroadcastTheme } from './SoloBroadcastMockup';
import ThemeEffectLayer from './ThemeEffectLayer';
import { getThemeEffectType } from './themeEffectMap';

function rgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function BattleMockup({ theme }: { theme: BroadcastTheme }) {
  const effectType = getThemeEffectType(theme);

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl border" style={{ borderColor: `${theme.accentColor}50` }}>
      <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(135deg, ${rgba(theme.accentColor, 0.24)}, rgba(0,0,0,0.95) 68%)` }} />
      <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />

      <div className="absolute inset-0 z-0">
        <div className="absolute inset-y-0 left-0 w-1/2" style={{ background: `linear-gradient(90deg, ${rgba(theme.accentColor, 0.28)}, transparent)` }} />
        <div className="absolute inset-y-0 right-0 w-1/2" style={{ background: `linear-gradient(270deg, ${rgba(theme.accentColor, 0.2)}, transparent)` }} />
      </div>
      <ThemeEffectLayer effectType={effectType} accentColor={theme.accentColor} isBattle />

      <div className="absolute inset-0 z-10 p-3">
        <motion.div
          className="absolute left-3 right-36 top-3 bottom-3 rounded-lg border"
          style={{ borderColor: `${theme.accentColor}40` }}
          animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.18)}`, `0 0 14px ${rgba(theme.accentColor, 0.42)}`, `0 0 8px ${rgba(theme.accentColor, 0.18)}`] }}
          transition={{ repeat: Infinity, duration: 2.3 }}
        />
        <div className="absolute left-3 right-36 top-3 bottom-3 grid grid-cols-2 gap-3">
          <motion.div className="rounded-lg border bg-black/55" style={{ borderColor: `${theme.accentColor}50` }} animate={{ boxShadow: [`0 0 10px ${rgba(theme.accentColor, 0.2)}`, `0 0 24px ${rgba(theme.accentColor, 0.55)}`, `0 0 10px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.1 }} />
          <motion.div className="rounded-lg border bg-black/55" style={{ borderColor: `${theme.accentColor}50` }} animate={{ boxShadow: [`0 0 10px ${rgba(theme.accentColor, 0.2)}`, `0 0 24px ${rgba(theme.accentColor, 0.55)}`, `0 0 10px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.1, delay: 0.3 }} />
        </div>

        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border bg-black/75 px-4 py-1.5 text-xs font-orbitron text-white" style={{ borderColor: `${theme.accentColor}50`, boxShadow: `0 0 20px ${rgba(theme.accentColor, 0.3)}` }}>
          <span style={{ color: theme.accentColor }}>2780</span> VS <span style={{ color: theme.accentColor }}>2615</span>
        </div>

        <motion.div className="absolute right-3 top-3 bottom-3 w-32 rounded-lg border bg-black/75" style={{ borderColor: `${theme.accentColor}30` }} animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.2)}`, `0 0 22px ${rgba(theme.accentColor, 0.48)}`, `0 0 8px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.4 }}>
          <div className="border-b p-2 text-[10px] text-white" style={{ borderColor: `${theme.accentColor}30` }}>Chat</div>
          <div className="space-y-1 p-2 text-[10px] text-gray-200">
            <div>left side pushing</div>
            <div>big gift drop</div>
            <div style={{ color: theme.accentColor }}>combo x7</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
