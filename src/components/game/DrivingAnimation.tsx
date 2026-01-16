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

  const activeCarImage = useMemo(() => {
    if (!user?.id) return null;
    const raw = localStorage.getItem(`trollcity_car_${user.id}`);
    const stored = raw ? JSON.parse(raw) : null;
    const activeId = profile?.active_vehicle ?? stored?.carId;
    const car = cars.find(entry => entry.id === activeId);
    return car?.image || null;
  }, [user?.id, profile?.active_vehicle]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${drivingImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-black/40" />

      {raidAlert && (
        <div className="absolute top-8 z-50 rounded-lg bg-red-600/90 text-white px-5 py-3 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-200" />
            <span className="font-semibold">Road threat detected</span>
          </div>
        </div>
      )}

      <div className="relative z-10 text-center mb-10">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-widest uppercase">
          Driving to {destination}
        </h2>
        <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden border border-white/30">
          <div
            className="h-full bg-white/90 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {activeCarImage && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 w-72 max-w-[70vw]">
          <img
            src={activeCarImage}
            alt="Active vehicle"
            className="w-full h-auto object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
          />
        </div>
      )}
    </div>
  );
}
