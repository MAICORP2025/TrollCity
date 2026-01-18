import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { cars } from '../../data/vehicles';

interface DrivingAnimationProps {
  destination: string;
  onComplete: () => void;
  isRaid?: boolean;
}

export default function DrivingAnimation({ destination, onComplete, isRaid = false }: DrivingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [raidAlert, setRaidAlert] = useState(false);
  const { user, profile } = useAuthStore();
  const [driveSpeed, setDriveSpeed] = useState(60);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);
    const handler = () => setPrefersReducedMotion(media.matches);
    media.addEventListener?.('change', handler);
    return () => media.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    try {
      const raw = localStorage.getItem(`trollcity_car_${user.id}`);
      const stored = raw ? JSON.parse(raw) : null;
      const activeId = profile?.active_vehicle ?? stored?.carId;
      const car = cars.find(entry => entry.id === activeId);

      if (!car) {
        setDriveSpeed(60);
        return;
      }

      setDriveSpeed(car.speed);
    } catch (e) {
      console.error('Failed to parse car data:', e);
      setDriveSpeed(60);
    }
  }, [user?.id, profile?.active_vehicle]);

  useEffect(() => {
    const baseDuration = 5200 - driveSpeed * 18;
    const duration = Math.max(1800, Math.min(5200, baseDuration));
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
  }, [onComplete, isRaid, driveSpeed]);

  const drivingImageUrl =
    import.meta.env.VITE_GEMINI_DRIVING_SCENE_URL || '/assets/driving_scene.jpg';
  const drivingVideoUrl = 
    '/assets/driving_scene.mp4';

  const activeCarImage = useMemo(() => {
    if (!user?.id) return null;
    const raw = localStorage.getItem(`trollcity_car_${user.id}`);
    const stored = raw ? JSON.parse(raw) : null;
    const activeId = profile?.active_vehicle ?? stored?.carId;
    const car = cars.find(entry => entry.id === activeId);
    return car?.image || null;
  }, [user?.id, profile?.active_vehicle]);

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#050505]">
      <div className="absolute inset-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover opacity-60"
          poster={drivingImageUrl}
        >
          <source src={drivingVideoUrl} type="video/mp4" />
          <div
            className="absolute inset-0 bg-[#050505]"
            style={{
              backgroundImage: `url(${drivingImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </video>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80" />

      {raidAlert && (
        <div className="absolute top-8 z-50 rounded-lg bg-red-600/90 text-white px-5 py-3 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-200" />
            <span className="font-semibold">Road threat detected</span>
          </div>
        </div>
      )}

      <div className="relative z-10 text-center mb-10 pointer-events-none">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Driving to {destination}
        </h2>
        <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden border border-white/30 backdrop-blur-sm mx-auto">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(168,85,247,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!prefersReducedMotion && activeCarImage && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          {/* Main car that stays visible but has some 'driving' shake */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-72 max-w-[70vw] animate-float">
            <img
              src={activeCarImage}
              alt="Active vehicle"
              className="w-full h-auto object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
            />
          </div>

          {/* Periodic 'drive past' ghost effect to simulate moving through a city */}
          <div className="absolute inset-0 overflow-hidden opacity-30">
             <div className="absolute bottom-16 -left-full w-96 animate-driveCar opacity-40 grayscale brightness-150 blur-[2px]">
                <img src={activeCarImage} alt="" className="w-full h-auto object-contain" />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
