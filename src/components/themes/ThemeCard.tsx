import React from 'react';
import { motion } from 'framer-motion';
import SoloBroadcastMockup, { BroadcastTheme } from './SoloBroadcastMockup';
import BattleMockup from './BattleMockup';

export default function ThemeCard({
  theme,
  selected,
  mode,
  onSelect,
  index,
}: {
  theme: BroadcastTheme;
  selected: boolean;
  mode: 'solo' | 'battle';
  onSelect: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border bg-black/60 p-3"
      style={{
        borderColor: `${theme.accentColor}50`,
        boxShadow: selected ? `0 0 20px ${theme.accentColor}55` : undefined,
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{theme.name}</div>
          <div className="text-xs text-gray-400">{theme.category}</div>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: `${theme.accentColor}50`, color: theme.accentColor }}>
          {theme.isPremium ? 'Premium' : 'Free'}
        </span>
      </div>
      {mode === 'solo' ? <SoloBroadcastMockup theme={theme} /> : <BattleMockup theme={theme} />}
      <button
        onClick={onSelect}
        className="mt-3 w-full rounded-md border px-3 py-2 text-xs font-semibold"
        style={{ borderColor: `${theme.accentColor}50`, color: theme.accentColor, background: selected ? `${theme.accentColor}22` : 'rgba(0,0,0,0.45)' }}
      >
        {selected ? 'Selected' : 'Apply Theme'}
      </button>
    </motion.div>
  );
}
