import React from 'react';
import { motion } from 'framer-motion';
import { Crown3D } from './themeVisualEffects';

export default function CEOBroadcastMockup() {
  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl border" style={{ borderColor: 'rgba(212,175,55,0.5)' }}>
      <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(140deg, rgba(127,29,29,0.75), rgba(17,24,39,0.95) 45%, rgba(250,204,21,0.3))' }} />
      <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.68) 100%)' }} />
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

      <div className="absolute inset-0 z-10 p-3 text-white">
        <div className="flex items-center justify-between">
          <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'rgba(212,175,55,0.5)', background: 'linear-gradient(90deg,#7f1d1d,#b91c1c)' }}>CEO ONLY</div>
          <button className="rounded-md border px-3 py-1 text-xs" style={{ borderColor: 'rgba(212,175,55,0.6)', background: 'rgba(220,38,38,0.8)', boxShadow: '0 0 18px rgba(220,38,38,0.35)' }}>Stop Random Battles</button>
        </div>
        <div className="absolute left-3 right-36 bottom-3 rounded-lg border bg-black/60 p-2 text-xs" style={{ borderColor: 'rgba(212,175,55,0.5)' }}>
          <div className="flex items-center justify-between"><span className="text-yellow-300">@CEO_OF_MAI</span><span className="text-red-300">? 992K</span><span className="text-green-300">$ 188K</span></div>
        </div>
        <div className="absolute left-3 right-36 top-12 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((idx) => (
            <motion.div
              key={idx}
              className="h-14 rounded-lg border bg-black/60"
              style={{ borderColor: 'rgba(250,204,21,0.65)', boxShadow: '0 0 16px rgba(250,204,21,0.28)' }}
              animate={{ boxShadow: ['0 0 12px rgba(250,204,21,0.2)', '0 0 24px rgba(250,204,21,0.52)', '0 0 12px rgba(250,204,21,0.2)'] }}
              transition={{ repeat: Infinity, duration: 2.1, delay: idx * 0.25, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <motion.div className="absolute right-3 top-12 bottom-3 w-32 rounded-lg border bg-black/75" style={{ borderColor: 'rgba(250,204,21,0.4)' }} animate={{ boxShadow: ['0 0 10px rgba(250,204,21,0.2)', '0 0 22px rgba(250,204,21,0.52)', '0 0 10px rgba(250,204,21,0.2)'] }} transition={{ repeat: Infinity, duration: 2.2 }} />
      </div>
    </div>
  );
}
