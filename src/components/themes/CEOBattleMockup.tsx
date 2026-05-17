import React from 'react';
import { motion } from 'framer-motion';
import { Crown3D } from './themeVisualEffects';

export default function CEOBattleMockup() {
  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl border" style={{ borderColor: 'rgba(212,175,55,0.5)' }}>
      <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(140deg, rgba(127,29,29,0.75), rgba(17,24,39,0.95) 45%, rgba(250,204,21,0.3))' }} />
      <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)' }} />
      <motion.div
        className="absolute inset-0 z-[5] rounded-xl border"
        style={{ borderColor: 'rgba(250,204,21,0.65)', boxShadow: '0 0 18px rgba(250,204,21,0.35)' }}
        animate={{ opacity: [0.6, 1, 0.6], boxShadow: ['0 0 16px rgba(250,204,21,0.28)', '0 0 30px rgba(250,204,21,0.6)', '0 0 16px rgba(250,204,21,0.28)'] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
      />
      <motion.div className="absolute left-4 top-4 z-20" style={{ width: 52, height: 52 }} animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 2.1 }}>
        <Crown3D size={48} cushion />
      </motion.div>
      <motion.div className="absolute right-4 top-4 z-20" style={{ width: 52, height: 52 }} animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}>
        <Crown3D size={48} cushion />
      </motion.div>
      <motion.div className="absolute left-4 bottom-4 z-20" style={{ width: 52, height: 52 }} animate={{ y: [0, 2, 0] }} transition={{ repeat: Infinity, duration: 2.1 }}>
        <Crown3D size={48} cushion />
      </motion.div>
      <motion.div className="absolute right-4 bottom-4 z-20" style={{ width: 52, height: 52 }} animate={{ y: [0, 2, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}>
        <Crown3D size={48} cushion />
      </motion.div>

      <div className="absolute inset-0 z-0">
        <div className="absolute inset-y-0 left-0 w-1/2" style={{ background: 'linear-gradient(90deg, rgba(220,38,38,0.28), transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-1/2" style={{ background: 'linear-gradient(270deg, rgba(34,197,94,0.28), transparent)' }} />
      </div>

      <div className="absolute inset-0 z-10 p-3">
        <div className="absolute left-3 right-36 top-3 bottom-3 grid grid-cols-2 gap-3">
          <motion.div className="rounded-lg border bg-black/55" style={{ borderColor: 'rgba(250,204,21,0.7)', boxShadow: '0 0 18px rgba(250,204,21,0.3)' }} animate={{ boxShadow: ['0 0 12px rgba(250,204,21,0.2)', '0 0 28px rgba(250,204,21,0.55)', '0 0 12px rgba(250,204,21,0.2)'] }} transition={{ repeat: Infinity, duration: 2.3, ease: 'easeInOut' }} />
          <motion.div className="rounded-lg border bg-black/55" style={{ borderColor: 'rgba(250,204,21,0.7)', boxShadow: '0 0 18px rgba(250,204,21,0.3)' }} animate={{ boxShadow: ['0 0 12px rgba(250,204,21,0.2)', '0 0 28px rgba(250,204,21,0.55)', '0 0 12px rgba(250,204,21,0.2)'] }} transition={{ repeat: Infinity, duration: 2.3, delay: 0.3, ease: 'easeInOut' }} />
        </div>
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border bg-black/80 px-4 py-1.5 font-orbitron text-xs" style={{ borderColor: 'rgba(212,175,55,0.6)', color: '#ffd700', boxShadow: '0 0 18px rgba(212,175,55,0.35)' }}>
          <span className="text-red-400">3300</span> VS <span className="text-green-400">2875</span>
        </div>
        <motion.div className="absolute left-1/2 top-12 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px]" style={{ borderColor: 'rgba(212,175,55,0.5)', color: '#ffd700', background: 'rgba(0,0,0,0.6)' }} animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
          WIN STREAK x9
        </motion.div>
      </div>
    </div>
  );
}
