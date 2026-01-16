import React, { useEffect, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { useAvatar } from '../../lib/hooks/useAvatar';
import Avatar3D from '../avatar/Avatar3D';
import { useAuthStore } from '../../lib/store';

interface DrivingAnimationProps {
  destination: string;
  onComplete: () => void;
  isRaid?: boolean;
}

type TimeOfDay = 'day' | 'evening' | 'night';

function getTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export default function DrivingAnimation({ destination, onComplete, isRaid = false }: DrivingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [raidAlert, setRaidAlert] = useState(false);
  const { config } = useAvatar();
  const { user, profile } = useAuthStore();
  const [carColors, setCarColors] = useState<{ from: string; to: string }>({
    from: '#b91c1c',
    to: '#7f1d1d'
  });
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay(new Date()));
  const [carTier, setCarTier] = useState<'starter' | 'mid' | 'elite'>('starter');

  useEffect(() => {
    if (!user?.id) return;

    try {
      const raw = localStorage.getItem(`trollcity_car_${user.id}`);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      let from = parsed.colorFrom as string | undefined;
      let to = parsed.colorTo as string | undefined;
      const carId = parsed.carId as number | undefined;

      if (!from || !to) {
        if (carId === 1) {
          from = '#38bdf8';
          to = '#22c55e';
        } else if (carId === 2) {
          from = '#fbbf24';
          to = '#f87171';
        } else if (carId === 3) {
          from = '#a855f7';
          to = '#ec4899';
        } else if (carId === 4) {
          from = '#94a3b8';
          to = '#475569';
        } else if (carId === 5) {
          from = '#1e293b';
          to = '#000000';
        } else if (carId === 6) {
          from = '#4c1d95';
          to = '#8b5cf6';
        }
      }

      setCarColors({ from: from || '#b91c1c', to: to || '#7f1d1d' });

      if (carId && carId <= 2) {
        setCarTier('starter');
      } else if (carId && carId <= 5) {
        setCarTier('mid');
      } else {
        setCarTier('elite');
      }
    } catch (e) {
      console.error('Failed to parse car data:', e);
    }
  }, [user?.id]);
          from = '#22c55e';
          to = '#0ea5e9';
        } else if (carId === 3) {
          from = '#a855f7';
          to = '#ec4899';
        }
      }

      if (from && to) {
        setCarColors({ from, to });
      }

      if (carId === 3) {
        setCarTier('elite');
      } else if (carId === 2) {
        setCarTier('mid');
      } else {
        setCarTier('starter');
      }
    } catch {
      setCarTier('starter');
    }
  }, [user?.id]);

  useEffect(() => {
    setTimeOfDay(getTimeOfDay(new Date()));
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay(new Date()));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const duration = Math.floor(Math.random() * 2000) + 2000;
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min((currentStep / steps) * 100, 100);
      setProgress(newProgress);

      if (currentStep >= steps) {
        clearInterval(timer);
        onComplete();
      }
    }, intervalTime);

    if (isRaid) {
      setTimeout(() => {
        setRaidAlert(true);
      }, duration / 2);
    }

    return () => clearInterval(timer);
  }, [onComplete, isRaid]);

  const drivingImageUrl =
    import.meta.env.VITE_GEMINI_DRIVING_SCENE_URL || "/assets/driving_scene.jpg";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-colors duration-700"
      style={{
        background: timeOfDay === 'day' 
          ? 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)' 
          : timeOfDay === 'evening'
          ? 'linear-gradient(180deg, #5a4a8a 0%, #2d1e4e 50%, #1a1034 100%)'
          : 'linear-gradient(180deg, #0a0a0a 0%, #1a0a1a 50%, #0f0a1a 100%)'
      }}
    >
      {/* City Skyline with Buildings - from TrollsTown background */}
      <div className="absolute inset-0 bottom-0 pointer-events-none z-1">
        {/* Back buildings layer */}
        <div className="absolute bottom-0 w-full h-32 opacity-40" style={{ transform: 'translateZ(-500px) scale(1.5)' }}>
          <div className="flex items-end justify-around h-full px-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={`bg-${i}`}
                className="bg-gradient-to-t from-purple-600/50 to-purple-400/20 rounded-t-lg border border-purple-500/40"
                style={{
                  width: `${40 + (i % 3) * 20}px`,
                  height: `${80 + (i % 4) * 40}px`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Mid buildings layer */}
        <div className="absolute bottom-0 w-full h-48 opacity-60" style={{ transform: 'translateZ(-250px)' }}>
          <div className="flex items-end justify-between h-full px-8">
            {[...Array(6)].map((_, i) => (
              <div
                key={`mid-${i}`}
                className="bg-gradient-to-b from-purple-500/60 via-purple-600/50 to-purple-700/70 rounded-t-xl border-2 border-purple-400/50 shadow-lg shadow-purple-500/40"
                style={{
                  width: `${60 + (i % 3) * 30}px`,
                  height: `${120 + (i % 5) * 60}px`,
                }}
              >
                {/* Windows */}
                {[...Array(Math.floor(120 / 20))].map((_, w) => (
                  <div
                    key={`window-${w}`}
                    className={`absolute left-1/4 w-2 h-2 rounded-sm m-1 ${
                      timeOfDay === 'night' 
                        ? 'bg-yellow-300/70' 
                        : timeOfDay === 'evening'
                        ? 'bg-yellow-200/60'
                        : 'bg-yellow-100/40'
                    }`}
                    style={{ top: `${w * 20}px` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Front buildings layer */}
        <div className="absolute bottom-0 w-full h-80 opacity-75">
          <div className="flex items-end justify-between h-full px-12 gap-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={`front-${i}`}
                className="bg-gradient-to-b from-cyan-500/50 via-purple-600/60 to-purple-900/80 rounded-t-2xl border-2 border-purple-400/60 shadow-2xl shadow-purple-500/50"
                style={{
                  width: `${100 + (i % 2) * 40}px`,
                  height: `${180 + (i % 3) * 80}px`,
                }}
              >
                {/* Building windows grid */}
                {[...Array(5)].map((_, row) =>
                  [...Array(2)].map((_, col) => (
                    <div
                      key={`win-${row}-${col}`}
                      className={`absolute w-3 h-3 rounded-sm border border-yellow-400/60 ${
                        timeOfDay === 'night' 
                          ? 'bg-yellow-200/80' 
                          : timeOfDay === 'evening'
                          ? 'bg-yellow-100/70'
                          : 'bg-yellow-100/40'
                      }`}
                      style={{
                        left: `${col * 30 + 15}px`,
                        top: `${row * 35 + 20}px`,
                      }}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Trolls at street level */}
        <div className="absolute bottom-24 w-full h-64 opacity-75 flex items-end justify-around px-8">
          {/* Troll 1 - Left side */}
          <div className="relative" style={{ animation: 'float 6s ease-in-out infinite' }}>
            <svg width="100" height="140" viewBox="0 0 100 140" className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.5))' }}>
              <ellipse cx="35" cy="115" rx="12" ry="20" fill="#6b4d9c" opacity="1" />
              <ellipse cx="65" cy="115" rx="12" ry="20" fill="#6b4d9c" opacity="1" />
              <ellipse cx="35" cy="135" rx="14" ry="8" fill="#4a3470" opacity="1" />
              <ellipse cx="65" cy="135" rx="14" ry="8" fill="#4a3470" opacity="1" />
              <ellipse cx="50" cy="70" rx="28" ry="35" fill="#8b5fbf" opacity="1" />
              <path d="M 50 40 Q 48 70 50 85" stroke="#6b4d9c" strokeWidth="2" fill="none" opacity="0.6" />
              <ellipse cx="22" cy="55" rx="15" ry="20" fill="#8b5fbf" opacity="1" />
              <ellipse cx="78" cy="55" rx="15" ry="20" fill="#8b5fbf" opacity="1" />
              <rect x="8" y="50" width="16" height="35" rx="8" fill="#7c4da8" opacity="1" />
              <rect x="76" y="50" width="16" height="35" rx="8" fill="#7c4da8" opacity="1" />
              <circle cx="16" cy="90" r="10" fill="#5a3a7a" opacity="1" />
              <circle cx="84" cy="90" r="10" fill="#5a3a7a" opacity="1" />
              <polygon points="10,95 6,105 8,98" fill="#3d2654" opacity="1" />
              <polygon points="22,95 26,105 24,98" fill="#3d2654" opacity="1" />
              <polygon points="78,95 74,105 76,98" fill="#3d2654" opacity="1" />
              <polygon points="90,95 94,105 92,98" fill="#3d2654" opacity="1" />
              <rect x="42" y="25" width="16" height="20" rx="8" fill="#7c4da8" opacity="1" />
              <ellipse cx="50" cy="18" rx="22" ry="24" fill="#9d68cc" opacity="1" />
              <circle cx="35" cy="12" r="4" fill="#7c4da8" opacity="0.4" />
              <circle cx="65" cy="10" r="4" fill="#7c4da8" opacity="0.4" />
              <circle cx="50" cy="28" r="3" fill="#7c4da8" opacity="0.4" />
              <ellipse cx="50" cy="10" rx="20" ry="5" fill="#6b4d9c" opacity="0.5" />
              <ellipse cx="38" cy="15" rx="4" ry="6" fill="#00ffff" opacity="1" />
              <ellipse cx="62" cy="15" rx="4" ry="6" fill="#00ffff" opacity="1" />
              <circle cx="38" cy="14" r="2.5" fill="#00ffff" opacity="0.8" />
              <circle cx="62" cy="14" r="2.5" fill="#00ffff" opacity="0.8" />
              <polygon points="50,22 46,28 54,28" fill="#5a3a7a" opacity="1" />
              <ellipse cx="48" cy="26" rx="2" ry="3" fill="#3d2654" opacity="0.6" />
              <ellipse cx="52" cy="26" rx="2" ry="3" fill="#3d2654" opacity="0.6" />
              <path d="M 40 32 Q 50 37 60 32" stroke="#fbbf24" strokeWidth="2.5" fill="none" opacity="1" />
              <line x1="43" y1="33" x2="43" y2="35" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
              <line x1="47" y1="34" x2="47" y2="36" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
              <line x1="53" y1="34" x2="53" y2="36" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
              <line x1="57" y1="33" x2="57" y2="35" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
              <path d="M 28 6 Q 15 2 12 12" stroke="#fbbf24" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
              <path d="M 72 6 Q 85 2 88 12" stroke="#fbbf24" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
              <path d="M 30 7 Q 22 4 20 11" stroke="#fde047" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
              <path d="M 70 7 Q 78 4 80 11" stroke="#fde047" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
            </svg>
          </div>

          {/* Troll 2 - Center */}
          <div className="relative" style={{ animation: 'float 7s ease-in-out infinite 1s', transform: 'scaleX(-1)' }}>
            <svg width="110" height="160" viewBox="0 0 110 160" className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.6))' }}>
              <ellipse cx="40" cy="130" rx="16" ry="24" fill="#5a3a7a" opacity="1" />
              <ellipse cx="70" cy="130" rx="16" ry="24" fill="#5a3a7a" opacity="1" />
              <ellipse cx="40" cy="155" rx="18" ry="10" fill="#3d2654" opacity="1" />
              <ellipse cx="70" cy="155" rx="18" ry="10" fill="#3d2654" opacity="1" />
              <ellipse cx="55" cy="80" rx="32" ry="42" fill="#7c4da8" opacity="1" />
              <ellipse cx="38" cy="65" rx="10" ry="15" fill="#6b4d9c" opacity="0.5" />
              <ellipse cx="72" cy="65" rx="10" ry="15" fill="#6b4d9c" opacity="0.5" />
              <ellipse cx="20" cy="70" rx="18" ry="24" fill="#8b5fbf" opacity="1" />
              <ellipse cx="90" cy="70" rx="18" ry="24" fill="#8b5fbf" opacity="1" />
              <rect x="2" y="65" width="20" height="45" rx="10" fill="#6b4d9c" opacity="1" />
              <rect x="88" y="65" width="20" height="45" rx="10" fill="#6b4d9c" opacity="1" />
              <circle cx="12" cy="115" r="12" fill="#4a3470" opacity="1" />
              <circle cx="98" cy="115" r="12" fill="#4a3470" opacity="1" />
              <rect x="45" y="30" width="20" height="25" rx="10" fill="#7c4da8" opacity="1" />
              <ellipse cx="55" cy="20" rx="26" ry="28" fill="#8b5fbf" opacity="1" />
              <ellipse cx="40" cy="18" rx="6" ry="8" fill="#00ffff" opacity="1" />
              <ellipse cx="70" cy="18" rx="6" ry="8" fill="#00ffff" opacity="1" />
              <circle cx="40" cy="18" r="8" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.5" />
              <circle cx="70" cy="18" r="8" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.5" />
              <ellipse cx="55" cy="28" rx="5" ry="6" fill="#4a3470" opacity="1" />
              <ellipse cx="52" cy="30" rx="1.5" ry="2.5" fill="#2a1a47" opacity="0.8" />
              <ellipse cx="58" cy="30" rx="1.5" ry="2.5" fill="#2a1a47" opacity="0.8" />
              <path d="M 45 38 Q 55 45 65 38" stroke="#fbbf24" strokeWidth="3" fill="none" opacity="1" strokeLinecap="round" />
            </svg>
          </div>

          {/* Troll 3 - Right side */}
          <div className="relative" style={{ animation: 'float 6.5s ease-in-out infinite 0.5s' }}>
            <svg width="95" height="135" viewBox="0 0 95 135" className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.5))' }}>
              <ellipse cx="33" cy="110" rx="11" ry="18" fill="#7c4da8" opacity="1" />
              <ellipse cx="62" cy="110" rx="11" ry="18" fill="#7c4da8" opacity="1" />
              <ellipse cx="33" cy="128" rx="12" ry="7" fill="#5a3a7a" opacity="1" />
              <ellipse cx="62" cy="128" rx="12" ry="7" fill="#5a3a7a" opacity="1" />
              <ellipse cx="47" cy="65" rx="26" ry="32" fill="#9d68cc" opacity="1" />
              <ellipse cx="20" cy="50" rx="14" ry="18" fill="#8b5fbf" opacity="1" />
              <ellipse cx="74" cy="50" rx="14" ry="18" fill="#8b5fbf" opacity="1" />
              <rect x="7" y="45" width="15" height="33" rx="7" fill="#7c4da8" opacity="1" />
              <rect x="71" y="45" width="15" height="33" rx="7" fill="#7c4da8" opacity="1" />
              <circle cx="14" cy="82" r="9" fill="#6b4d9c" opacity="1" />
              <circle cx="81" cy="82" r="9" fill="#6b4d9c" opacity="1" />
              <rect x="40" y="22" width="15" height="18" rx="7" fill="#8b5fbf" opacity="1" />
              <ellipse cx="47" cy="16" rx="20" ry="22" fill="#9d68cc" opacity="1" />
              <ellipse cx="35" cy="12" rx="4" ry="6" fill="#00ffff" opacity="1" />
              <ellipse cx="59" cy="12" rx="4" ry="6" fill="#00ffff" opacity="1" />
              <path d="M 37 29 Q 47 34 57 29" stroke="#fbbf24" strokeWidth="2" fill="none" opacity="1" />
            </svg>
          </div>
        </div>
      </div>

      {/* Raid Alert */}
      {raidAlert && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-red-600 border-4 border-yellow-400 text-white px-8 py-4 rounded-xl shadow-[0_0_50px_rgba(255,0,0,0.5)] flex items-center gap-4">
            <AlertTriangle size={48} className="text-yellow-400 animate-pulse" />
            <div>
              <h1 className="text-4xl font-black uppercase tracking-widest">RAID!</h1>
              <p className="text-sm font-bold text-yellow-100">ROAD AMBUSH DETECTED</p>
            </div>
            <AlertTriangle size={48} className="text-yellow-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Progress Info */}
      <div className="relative z-10 text-center mb-32">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-widest uppercase drop-shadow-lg">
          Driving to {destination}
        </h2>
        <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
          <div 
            className="h-full bg-yellow-400 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Road and Car */}
      <div className="absolute inset-x-0 bottom-0 h-1/3">
        {/* Road */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-800 to-slate-700">
          {/* Road markings */}
          <div className="absolute inset-x-1/3 inset-y-0 bg-gradient-to-b from-slate-700 to-slate-900" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-yellow-400/60" />
        </div>

        {/* Car driving across screen */}
        <div className="absolute inset-x-0 bottom-20 flex justify-center">
          <div
            className="relative w-48 h-20 animate-pulse"
            style={{
              animation: `drivingBounce ${2 + Math.random()}s ease-in-out infinite`
            }}
          >
            {/* Car body gradient */}
            <div
              className="w-full h-full rounded-lg shadow-2xl relative overflow-hidden border-2 border-slate-900/50"
              style={{
                background: `linear-gradient(135deg, ${carColors.from} 0%, ${carColors.to} 100%)`
              }}
            >
              {/* Car shine/highlight */}
              <div className="absolute top-0 left-0 w-1/3 h-1/2 bg-white/20 rounded-bl-full" />
              
              {/* Windows */}
              <div className="absolute top-4 left-4 w-12 h-8 bg-cyan-300/40 rounded border border-cyan-500/30" />
              <div className="absolute top-4 right-4 w-12 h-8 bg-cyan-300/40 rounded border border-cyan-500/30" />
              
              {/* Headlights */}
              <div className="absolute left-0 top-1/4 w-2 h-6 rounded-full bg-yellow-300/80 shadow-lg shadow-yellow-400/50" />
              <div className="absolute left-0 bottom-1/4 w-2 h-6 rounded-full bg-red-400/80 shadow-lg shadow-red-500/50" />
            </div>

            {/* Wheels */}
            <div className="absolute -bottom-2 left-6 w-6 h-6 rounded-full bg-slate-900 shadow-lg border-2 border-slate-800">
              <div className="absolute inset-1 rounded-full bg-gradient-to-r from-slate-700 to-slate-900" />
            </div>
            <div className="absolute -bottom-2 right-6 w-6 h-6 rounded-full bg-slate-900 shadow-lg border-2 border-slate-800">
              <div className="absolute inset-1 rounded-full bg-gradient-to-r from-slate-700 to-slate-900" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
          <div className="flex animate-scroll-city w-[200%] h-full">
            <div className="flex w-1/2 px-10 items-end justify-between">
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-24 h-28 rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 border border-slate-500 shadow-xl shadow-slate-900/80">
                  <div className="absolute inset-x-2 top-3 h-12 grid grid-cols-4 gap-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-sm ${
                          timeOfDay === 'night' ? 'bg-amber-300/80' : 'bg-slate-200/40'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-3 bottom-3 h-5 bg-slate-900/80 rounded-md border border-slate-700/80" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-slate-200/80">
                  Starter Home
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-28 h-36 rounded-xl bg-gradient-to-b from-slate-600 to-slate-950 border border-slate-500 shadow-xl shadow-slate-900/90">
                  <div className="absolute inset-x-3 top-4 h-4 bg-slate-800/80 rounded-md" />
                  <div className="absolute inset-x-3 top-10 bottom-6 grid grid-cols-5 gap-1">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-sm ${
                          timeOfDay === 'night' ? 'bg-amber-200/90' : 'bg-slate-100/30'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-4 bottom-3 h-3 bg-slate-900/90 rounded-md" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-slate-200/80">
                  Townhouse
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-32 h-44 rounded-xl bg-gradient-to-b from-slate-500 to-slate-950 border border-slate-400 shadow-[0_0_60px_rgba(15,23,42,0.9)]">
                  <div className="absolute inset-x-4 top-4 h-3 bg-slate-900/70 rounded-md" />
                  <div className="absolute inset-x-4 top-8 bottom-8 grid grid-cols-6 gap-1">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-sm ${
                          timeOfDay === 'night' ? 'bg-amber-200' : 'bg-slate-100/40'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-6 bottom-4 h-2 bg-slate-900/80 rounded-md" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-slate-200/80">
                  Luxury Tower
                </span>
              </div>
            </div>
            <div className="flex w-1/2 px-10 items-end justify-between">
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-24 h-28 rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 border border-slate-500 shadow-xl shadow-slate-900/80">
                  <div className="absolute inset-x-2 top-3 h-12 grid grid-cols-4 gap-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-sm ${
                          timeOfDay === 'night' ? 'bg-amber-300/80' : 'bg-slate-200/40'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-3 bottom-3 h-5 bg-slate-900/80 rounded-md border border-slate-700/80" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-slate-200/80">
                  Starter Home
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-28 h-36 rounded-xl bg-gradient-to-b from-slate-600 to-slate-950 border border-slate-500 shadow-xl shadow-slate-900/90">
                  <div className="absolute inset-x-3 top-4 h-4 bg-slate-800/80 rounded-md" />
                  <div className="absolute inset-x-3 top-10 bottom-6 grid grid-cols-5 gap-1">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-sm ${
                          timeOfDay === 'night' ? 'bg-amber-200/90' : 'bg-slate-100/30'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-4 bottom-3 h-3 bg-slate-900/90 rounded-md" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-slate-200/80">
                  Townhouse
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-32 h-44 rounded-xl bg-gradient-to-b from-slate-500 to-slate-950 border border-slate-400 shadow-[0_0_60px_rgba(15,23,42,0.9)]">
                  <div className="absolute inset-x-4 top-4 h-3 bg-slate-900/70 rounded-md" />
                  <div className="absolute inset-x-4 top-8 bottom-8 grid grid-cols-6 gap-1">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-sm ${
                          timeOfDay === 'night' ? 'bg-amber-200' : 'bg-slate-100/40'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-6 bottom-4 h-2 bg-slate-900/80 rounded-md" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-slate-200/80">
                  Luxury Tower
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-32 perspective-hero">
          <div className="absolute left-1/2 bottom-0 w-[140%] h-[200%] -translate-x-1/2 origin-bottom transform-gpu road-plane">
            <div className="absolute inset-x-1/3 inset-y-0 bg-gradient-to-b from-slate-700 to-slate-900" />
            <div className="absolute inset-y-0 left-0 right-0 flex justify-center">
              <div className="w-1 bg-yellow-400/80 dashed-line" />
            </div>
            <div className="absolute inset-y-0 left-0 w-1 bg-slate-500/80" />
            <div className="absolute inset-y-0 right-0 w-1 bg-slate-500/80" />
          </div>

          <div className="absolute inset-x-0 bottom-20 flex justify-between px-10">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="relative w-1 h-16 bg-slate-800 rounded-full overflow-visible"
              >
                <div className="absolute inset-x-[-4px] bottom-4 h-3 rounded-full bg-slate-900" />
                <div
                  className={`absolute inset-x-[-6px] bottom-3 h-5 rounded-full ${
                    timeOfDay === 'night'
                      ? 'bg-amber-300/80 shadow-[0_0_18px_rgba(252,211,77,0.9)]'
                      : timeOfDay === 'evening'
                      ? 'bg-amber-200/70 shadow-[0_0_14px_rgba(252,211,77,0.7)]'
                      : 'bg-slate-200/50'
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="absolute top-[-52px] left-1/2 -translate-x-1/2 flex items-end gap-4 animate-bounce-gentle">
            <div className="relative">
              <div className="relative z-20 transform -scale-x-100">
                <div
                  className={`relative rounded-xl shadow-2xl overflow-hidden transform-gpu car-body ${
                    carTier === 'elite'
                      ? 'w-40 h-18'
                      : carTier === 'mid'
                      ? 'w-36 h-16'
                      : 'w-32 h-14'
                  }`}
                  style={{
                    background: `linear-gradient(to right, ${carColors.from}, ${carColors.to})`
                  }}
                >
                  <div className="absolute inset-x-4 top-2 h-6 bg-slate-900/70 rounded-t-xl border border-slate-400/40">
                    <div className="absolute inset-1 bg-gradient-to-b from-slate-300/40 to-slate-900/80 rounded-t-lg" />
                  </div>
                  <div className="absolute top-4 left-6 w-16 h-8 flex items-center justify-center">
                    <Avatar3D config={config} size="sm" showInCar />
                  </div>
                  <div className="absolute top-3 right-3 w-10 h-4 bg-sky-200/75 rounded-sm shadow-[0_0_12px_rgba(191,219,254,0.9)]" />
                  <div className="absolute inset-y-3 left-3 w-2 bg-slate-900/60" />
                  <div className="absolute inset-y-3 right-3 w-2 bg-slate-900/60" />
                  <div className="absolute bottom-2 left-0 w-4 h-2 bg-amber-300/80 rounded-r-sm shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
                  <div className="absolute bottom-2 right-0 w-4 h-2 bg-red-500/80 rounded-l-sm shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
                  {carTier !== 'starter' && (
                    <div className="absolute inset-x-4 bottom-4 h-1 bg-slate-900/50 rounded-full" />
                  )}
                  {raidAlert && (
                    <Zap className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 animate-ping" size={32} />
                  )}
                  <div className="absolute -bottom-4 left-6 w-9 h-9 bg-slate-900 rounded-full border-2 border-slate-500 shadow-[0_0_16px_rgba(15,23,42,0.9)] animate-spin-slow">
                    <div className="w-2.5 h-2.5 bg-slate-300 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="absolute -bottom-4 right-6 w-9 h-9 bg-slate-900 rounded-full border-2 border-slate-500 shadow-[0_0_16px_rgba(15,23,42,0.9)] animate-spin-slow">
                    <div className="w-2.5 h-2.5 bg-slate-300 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="absolute -bottom-7 left-4 right-4 h-5 bg-black/60 blur-md rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scroll-city {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-city {
          animation: scroll-city 4s linear infinite;
        }
        @keyframes bounce-gentle {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -5px); }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 0.5s ease-in-out infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 0.5s linear infinite;
        }
        .perspective-hero {
          perspective: 900px;
        }
        .road-plane {
          transform: translate(-50%, 10%) rotateX(62deg);
        }
        .dashed-line {
          background-image: linear-gradient(
            to bottom,
            rgba(250, 204, 21, 0.9) 0%,
            rgba(250, 204, 21, 0.9) 40%,
            transparent 40%,
            transparent 100%
          );
          background-size: 100% 18px;
          background-repeat: repeat-y;
        }
        .car-body {
          transition: width 250ms ease, height 250ms ease;
        }
      `}</style>
    </div>
  );
}
