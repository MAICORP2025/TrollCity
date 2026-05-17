import React from 'react';
import { motion } from 'framer-motion';
import ThemeEffectLayer from './ThemeEffectLayer';
import { getThemeEffectType } from './themeEffectMap';

export type BroadcastTheme = {
  id: string;
  name: string;
  category: string;
  accentColor: string;
  backgroundImage: string;
  isPremium: boolean;
};

function rgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function SoloBroadcastMockup({ theme }: { theme: BroadcastTheme }) {
  const effectType = getThemeEffectType(theme);

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl border" style={{ borderColor: `${theme.accentColor}50` }}>
      <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(140deg, ${rgba(theme.accentColor, 0.28)}, rgba(0,0,0,0.95) 65%)` }} />
      <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
      <ThemeEffectLayer effectType={effectType} accentColor={theme.accentColor} />

      <div className="absolute inset-0 z-10 p-3">
        <motion.div
          className="absolute left-20 right-36 top-3 bottom-3 rounded-lg border"
          style={{ borderColor: `${theme.accentColor}40` }}
          animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.18)}`, `0 0 14px ${rgba(theme.accentColor, 0.42)}`, `0 0 8px ${rgba(theme.accentColor, 0.18)}`] }}
          transition={{ repeat: Infinity, duration: 2.3 }}
        />
        <div className="absolute left-3 top-3 w-14 space-y-2">
          <motion.div className="h-8 rounded-lg border bg-black/55" style={{ borderColor: `${theme.accentColor}50` }} animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.2)}`, `0 0 18px ${rgba(theme.accentColor, 0.55)}`, `0 0 8px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.1 }} />
          <motion.div className="h-8 rounded-lg border bg-black/55" style={{ borderColor: `${theme.accentColor}50` }} animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.2)}`, `0 0 18px ${rgba(theme.accentColor, 0.55)}`, `0 0 8px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.1, delay: 0.2 }} />
          <motion.div className="h-8 rounded-lg border bg-black/55" style={{ borderColor: `${theme.accentColor}50` }} animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.2)}`, `0 0 18px ${rgba(theme.accentColor, 0.55)}`, `0 0 8px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.1, delay: 0.4 }} />
        </div>

        <motion.div className="absolute left-20 right-36 top-3 rounded-lg border bg-black/55 p-2 text-xs text-white" style={{ borderColor: `${theme.accentColor}50` }} animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.2)}`, `0 0 20px ${rgba(theme.accentColor, 0.5)}`, `0 0 8px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.3 }}>
          Live Broadcast
        </motion.div>

        <motion.div className="absolute left-20 right-36 bottom-3 rounded-lg border bg-black/60 p-2 text-xs text-white" style={{ borderColor: `${theme.accentColor}50` }} animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.2)}`, `0 0 20px ${rgba(theme.accentColor, 0.5)}`, `0 0 8px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.2, delay: 0.2 }}>
          <div className="flex items-center justify-between">
            <span>@streamer_name</span>
            <span style={{ color: theme.accentColor }}>12.8K</span>
          </div>
        </motion.div>

        <motion.div className="absolute right-3 top-3 bottom-3 w-32 rounded-lg border bg-black/75" style={{ borderColor: `${theme.accentColor}30` }} animate={{ boxShadow: [`0 0 8px ${rgba(theme.accentColor, 0.2)}`, `0 0 20px ${rgba(theme.accentColor, 0.45)}`, `0 0 8px ${rgba(theme.accentColor, 0.2)}`] }} transition={{ repeat: Infinity, duration: 2.4 }}>
          <div className="border-b p-2 text-[10px] text-white" style={{ borderColor: `${theme.accentColor}30` }}>Chat</div>
          <div className="space-y-1 p-2 text-[10px] text-gray-200">
            <div>this theme is fire</div>
            <div>gift train incoming</div>
            <div style={{ color: theme.accentColor }}>+999 coins</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
