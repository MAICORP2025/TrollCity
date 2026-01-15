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
          from = '#f97316';
          to = '#ef4444';
        } else if (carId === 2) {
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-colors duration-700 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url('${drivingImageUrl}')`
      }}
    >
      {/* Overlay for time of day tinting */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-colors duration-1000 ${
          timeOfDay === 'day' 
            ? 'bg-blue-400/20 mix-blend-overlay' 
            : timeOfDay === 'evening'
            ? 'bg-orange-500/20 mix-blend-overlay'
            : 'bg-black/40'
        }`} 
      />

      <div className="absolute inset-0 pointer-events-none">
        {/* Sky elements removed for realistic background */}
      </div>

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

      <div className="absolute inset-x-0 bottom-0 h-1/2">
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-900/95 via-slate-900/90 to-slate-900/0" />

        <div className="absolute inset-x-0 bottom-20 h-52 overflow-hidden">
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
