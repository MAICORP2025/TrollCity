import React from 'react';
import { motion } from 'framer-motion';
import CEOBroadcastMockup from '../../components/themes/CEOBroadcastMockup';
import CEOBattleMockup from '../../components/themes/CEOBattleMockup';

export default function CEOTheme({
  onBack,
  mode,
  setMode,
}: {
  onBack: () => void;
  mode: 'solo' | 'battle';
  setMode: (m: 'solo' | 'battle') => void;
}) {
  const features = [
    'Pulsing gold trim around full layout',
    'Crown markers in all four corners',
    'Broadcast boxes inherit same CEO gold frame',
    'Battle boxes inherit same CEO gold frame',
    'Stop Random Battles control',
    'RGB disabled for CEO/Admin visual mode',
  ];

  return (
    <div className="min-h-screen bg-black px-4 py-4 text-white">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="rounded-md bg-white/10 px-3 py-1 text-xs">Back</button>
          <div className="flex items-center gap-2 text-xl font-bold">
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>G</motion.span>
            <span style={{ background: 'linear-gradient(90deg,#dc2626,#ffd700,#22c55e)', WebkitBackgroundClip: 'text', color: 'transparent' }}>The Empire</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMode('solo')} className={`rounded-md px-3 py-1 text-xs ${mode === 'solo' ? 'bg-white/20' : 'bg-white/5'}`}>Solo</button>
            <button onClick={() => setMode('battle')} className={`rounded-md px-3 py-1 text-xs ${mode === 'battle' ? 'bg-white/20' : 'bg-white/5'}`}>Battle</button>
          </div>
        </div>

        {mode === 'solo' ? <CEOBroadcastMockup /> : <CEOBattleMockup />}

        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="rounded-lg border px-4 py-2 text-sm" style={{ background: 'linear-gradient(90deg,#7f1d1d,#dc2626)', borderColor: 'rgba(212,175,55,0.6)', color: '#ffd700' }}>
          Apply Empire Theme
        </motion.button>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {features.map((f) => <div key={f} className="rounded-lg border border-yellow-600/30 bg-black/60 p-3 text-sm">{f}</div>)}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <motion.div
            className="aspect-video w-full rounded-xl border border-yellow-500/40"
            style={{ background: 'linear-gradient(140deg, rgba(127,29,29,0.8), rgba(17,24,39,0.9) 50%, rgba(250,204,21,0.3))' }}
            animate={{ boxShadow: ['0 0 12px rgba(250,204,21,0.2)', '0 0 24px rgba(250,204,21,0.5)', '0 0 12px rgba(250,204,21,0.2)'] }}
            transition={{ repeat: Infinity, duration: 2.2 }}
          />
          <motion.div
            className="aspect-video w-full rounded-xl border border-yellow-500/40"
            style={{ background: 'linear-gradient(140deg, rgba(127,29,29,0.8), rgba(17,24,39,0.9) 50%, rgba(250,204,21,0.3))' }}
            animate={{ boxShadow: ['0 0 12px rgba(250,204,21,0.2)', '0 0 24px rgba(250,204,21,0.5)', '0 0 12px rgba(250,204,21,0.2)'] }}
            transition={{ repeat: Infinity, duration: 2.2, delay: 0.25 }}
          />
        </div>
      </div>
    </div>
  );
}
