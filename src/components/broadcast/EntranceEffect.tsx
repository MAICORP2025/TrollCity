import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ROLE_BASED_ENTRANCE_EFFECTS } from "../../lib/entranceEffects";

interface EntranceEffectProps {
  username: string;
  role: string;
  profile?: {
    rgb_username_expires_at?: string;
  };
}

export default function EntranceEffect({ username, role, profile }: EntranceEffectProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Get configuration from centralized source or fallback
  const roleConfig = ROLE_BASED_ENTRANCE_EFFECTS[role];
  
  // Legacy fallback for other roles (troller, og_user, etc.)
  const legacyConfig: Record<string, any> = {
    troller: {
        color: "from-green-500 to-green-700",
        emoji: "🧟",
        title: "TROLLER",
        sound: "magical.mp3"
    },
    og_user: {
        color: "from-yellow-500 to-yellow-700",
        emoji: "⭐",
        title: "OG USER",
        sound: "fanfare.mp3"
    },
    default: {
        color: "from-gray-400 to-gray-600",
        emoji: "👋",
        title: "USER",
        sound: "coins.mp3"
    }
  };

  const activeConfig = roleConfig || legacyConfig[role] || legacyConfig.default;
  const soundFile = roleConfig ? `${roleConfig.soundEffect}.mp3` : activeConfig.sound;
  const duration = roleConfig ? roleConfig.durationSeconds * 1000 : 5000;
  const animationType = roleConfig?.animationType || 'default';

  useEffect(() => {
    // Play sound
    const audio = new Audio(`/sounds/entrance/${soundFile}`);
    audio.volume = 0.6;
    audio.play().catch(e => console.error("Failed to play entrance sound", e));

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [role, soundFile, duration]);

  if (!isVisible) return null;

  const hasRgb = profile?.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date();

  // Render different effects based on animationType
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden">
        
        {/* === JUSTK: MATRIX THEME === */}
        {animationType === 'matrix_theme' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            className="relative w-full h-full flex items-center justify-center bg-black font-mono overflow-hidden"
          >
            {/* Digital Rain Effect */}
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -100, x: Math.random() * window.innerWidth, opacity: 0 }}
                animate={{ 
                  y: window.innerHeight + 100, 
                  opacity: [0, 1, 0]
                }}
                transition={{ 
                  duration: 1 + Math.random() * 2, 
                  repeat: Infinity, 
                  delay: Math.random() * 2,
                  ease: "linear"
                }}
                className="absolute text-green-500 font-bold text-xl writing-vertical-rl"
                style={{ 
                  writingMode: 'vertical-rl', 
                  textOrientation: 'upright',
                  fontSize: `${Math.random() * 20 + 10}px`,
                  opacity: Math.random()
                }}
              >
                {String.fromCharCode(0x30A0 + Math.random() * 96)}
                {String.fromCharCode(0x30A0 + Math.random() * 96)}
                {String.fromCharCode(0x30A0 + Math.random() * 96)}
                {String.fromCharCode(0x30A0 + Math.random() * 96)}
                {String.fromCharCode(0x30A0 + Math.random() * 96)}
              </motion.div>
            ))}

            <div className="relative z-10 text-center bg-black/80 p-8 border border-green-500/50 shadow-[0_0_50px_rgba(0,255,0,0.4)]">
              <motion.div 
                initial={{ scale: 2, opacity: 0, filter: "blur(10px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.5 }}
                className="text-8xl mb-4 text-green-500 drop-shadow-[0_0_15px_rgba(0,255,0,0.8)]"
              >
                🕶️
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, repeat: 3, repeatType: "reverse" }}
                className="text-7xl font-bold text-white mb-2 tracking-widest glitch-text"
                style={{ textShadow: "2px 2px 0px #00ff00, -2px -2px 0px #003300" }}
              >
                {username.toUpperCase()}
              </motion.h1>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-1 bg-green-500 mx-auto mb-4"
              />
              <div className="text-2xl text-green-400 tracking-[0.5em] uppercase">
                SYSTEM ADMINISTRATOR
              </div>
              <div className="text-xs text-green-700 mt-2 font-mono">
                ACCESS_LEVEL: UNLIMITED // ROOT_USER
              </div>
            </div>
          </motion.div>
        )}

        {/* === MITZIE: CAT THEME === */}
        {animationType === 'cat_theme' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full flex items-center justify-center bg-pink-950/60"
          >
            {/* Floating Paws */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight }}
                animate={{ scale: [0, 1, 0], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 3 }}
                className="absolute text-4xl opacity-50 text-pink-300"
              >
                🐾
              </motion.div>
            ))}

            <div className="relative z-10 text-center">
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.6 }}
                className="relative inline-block"
              >
                <div className="absolute -top-12 -left-8 text-6xl animate-bounce" style={{ animationDuration: '2s' }}>🐱</div>
                <div className="absolute -top-12 -right-8 text-6xl animate-bounce" style={{ animationDuration: '2.5s' }}>🐱</div>
                
                <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 drop-shadow-[0_5px_15px_rgba(236,72,153,0.5)] mb-4">
                  {username}
                </h1>
              </motion.div>
              
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="bg-white/10 backdrop-blur-md rounded-full px-8 py-4 border-2 border-pink-400 mx-auto max-w-2xl"
              >
                <span className="text-4xl mr-3">👑</span>
                <span className="text-3xl font-bold text-pink-200 uppercase tracking-wide">Queen of Cats</span>
                <span className="text-4xl ml-3">👑</span>
              </motion.div>
              
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mt-8 text-2xl text-pink-300 italic"
              >
                *Purr* Welcome *Purr*
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* === ADMIN: THE G.O.A.T === */}
        {animationType === 'admin_best' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="relative w-full h-full flex items-center justify-center bg-black/80"
          >
            {/* Cosmic Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 via-purple-900 to-yellow-600 opacity-50 animate-pulse" />
            
            {/* Spinning Rays */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_deg,gold_90deg,transparent_180deg,gold_270deg,transparent_360deg)] opacity-30"
            />

            <div className="relative z-10 text-center">
              <motion.div 
                initial={{ y: -100 }} 
                animate={{ y: 0 }} 
                className="text-9xl mb-4 filter drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]"
              >
                🐐
              </motion.div>
              <motion.h1 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-yellow-300 drop-shadow-2xl mb-2"
              >
                {username.toUpperCase()}
              </motion.h1>
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-4xl font-bold text-yellow-500 tracking-[1em] uppercase border-t-2 border-b-2 border-yellow-500 py-2"
              >
                THE G.O.A.T
              </motion.div>
            </div>
            
            {/* Floating Particles */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: "100vh", x: Math.random() * window.innerWidth }}
                animate={{ y: "-100vh" }}
                transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
                className="absolute text-4xl"
              >
                ✨
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* === SECRETARY: CASH FLOW === */}
        {animationType === 'secretary_money' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full flex items-center justify-center bg-green-900/40"
          >
            {/* Money Rain */}
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -100, x: Math.random() * window.innerWidth, rotate: 0 }}
                animate={{ y: window.innerHeight + 100, rotate: 360 }}
                transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5, ease: "linear" }}
                className="absolute text-5xl"
              >
                💸
              </motion.div>
            ))}

            <div className="relative z-10 text-center bg-black/60 p-12 rounded-3xl border-4 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.6)]">
              <motion.div 
                animate={{ rotateY: 360 }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-8xl mb-4"
              >
                💰
              </motion.div>
              <h1 className="text-6xl font-black text-green-400 drop-shadow-lg mb-2">
                {username.toUpperCase()}
              </h1>
              <div className="text-3xl font-bold text-green-200 tracking-widest uppercase">
                SECRETARY
              </div>
            </div>
          </motion.div>
        )}

        {/* === LEAD TROLL OFFICER: PRESIDENTIAL === */}
        {animationType === 'lead_officer_presidential' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full flex items-center justify-center bg-indigo-950/80"
          >
             <div className="absolute inset-0 border-[20px] border-double border-yellow-600/50" />
             
             <div className="relative z-10 text-center">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  className="bg-blue-900/90 p-16 rounded-full border-8 border-yellow-500 shadow-2xl"
                >
                  <div className="text-8xl mb-6">🦅</div>
                  <h1 className="text-5xl font-serif font-bold text-white mb-2 tracking-wide">
                    PRESIDENT
                  </h1>
                  <h2 className="text-6xl font-black text-yellow-400 mb-6 drop-shadow-md">
                    {username.toUpperCase()}
                  </h2>
                  <div className="flex justify-center gap-4 text-4xl">
                    <span>🇺🇸</span><span>⭐</span><span>🇺🇸</span>
                  </div>
                </motion.div>
             </div>
             
             {/* Confetti */}
             {[...Array(50)].map((_, i) => (
               <motion.div
                 key={i}
                 initial={{ y: -50, x: Math.random() * window.innerWidth }}
                 animate={{ y: window.innerHeight, x: (Math.random() - 0.5) * 200 + (Math.random() * window.innerWidth) }}
                 transition={{ duration: 3 + Math.random(), repeat: Infinity }}
                 className="absolute w-3 h-3 bg-red-500 rounded-sm"
                 style={{ backgroundColor: ['#ff0000', '#ffffff', '#0000ff'][Math.floor(Math.random() * 3)] }}
               />
             ))}
          </motion.div>
        )}

        {/* === TROLL OFFICER: POLICE RAID === */}
        {animationType === 'officer_police' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full flex items-center justify-center bg-black/60"
          >
            {/* Flashing Lights */}
            <motion.div 
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              className="absolute inset-0 bg-gradient-to-r from-red-600/50 to-blue-600/50 mix-blend-overlay"
            />
            
            <div className="relative z-10 text-center transform -skew-x-12">
              <motion.div 
                initial={{ x: -1000 }}
                animate={{ x: 0 }}
                transition={{ type: "spring", damping: 12 }}
                className="bg-blue-900 border-t-8 border-b-8 border-white p-8 shadow-[0_0_50px_rgba(0,0,255,0.8)]"
              >
                <div className="flex items-center justify-center gap-6 mb-4">
                  <span className="text-6xl animate-pulse">🚨</span>
                  <h1 className="text-7xl font-black text-white italic tracking-tighter">
                    POLICE RAID
                  </h1>
                  <span className="text-6xl animate-pulse">🚨</span>
                </div>
                <div className="bg-white text-black text-5xl font-black py-2 px-6 inline-block transform skew-x-12">
                  {username.toUpperCase()}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* === DEFAULT / FALLBACK === */}
        {animationType === 'default' && (
          <div className="entrance-text text-center">
            <div className={`text-8xl mb-4 glow`}>{activeConfig.emoji}</div>
            <div className={`text-6xl font-black text-transparent bg-gradient-to-r ${activeConfig.color} bg-clip-text mb-4 ${hasRgb ? 'rgb-username text-white !bg-none' : ''}`}>
              {username.toUpperCase()}
            </div>
            <div className={`text-3xl font-bold text-white tracking-widest mb-6`}>
              {activeConfig.title}
            </div>
            <div className="text-lg text-gray-300">
              has entered the stream
            </div>
          </div>
        )}

      </div>
    </AnimatePresence>
  );
}
